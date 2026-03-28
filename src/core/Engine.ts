import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { Arena } from '../world/Arena';
import { GolemController } from '../entities/GolemController';
import { DummyBot } from '../entities/DummyBot';
import { ParticleManager } from '../fx/ParticleManager';
import { DebrisManager } from '../fx/DebrisManager';
import { DecalManager } from '../fx/DecalManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';
import { GOLEM, ROTATION } from '../utils/constants';
import { QualityProfile, detectQualityProfile } from '../utils/quality';

const _weaponOrigin = new THREE.Vector3();
const _weaponDir = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _botTarget = new THREE.Vector3();
const _spawnDir = new THREE.Vector3();
const _propFxPos = new THREE.Vector3();
const _listenerPos = new THREE.Vector3();
const _radarDelta = new THREE.Vector3();
const _radarRight = new THREE.Vector3();
const _radarForward = new THREE.Vector3();

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

type SessionMode = 'solo' | 'host' | 'client';
type RadarContact = {
    x: number;
    y: number;
    kind: 'enemy' | 'bot';
    distance: number;
    meters: number;
};

export class Game {
    renderer: Renderer;
    input: InputManager;
    world: Arena;
    golem: GolemController;
    mechCamera: MechCamera;
    remotePlayers: Map<string, GolemController> = new Map();
    particles: ParticleManager;
    debris: DebrisManager;
    projectiles: ProjectileManager;
    dummy: DummyBot;
    physicsWrapper: Physics;
    physics: RAPIER.World;
    network: NetworkManager;
    sounds: AudioManager;
    decals: DecalManager;
    quality: QualityProfile;
    onStateUpdate: (state: any) => void;
    sessionMode: SessionMode;
    remoteSpawnSlots: Map<string, number> = new Map();
    hitConfirmTimer = 0;
    hitTargetHp = 0;
    hitTargetMaxHp = 100;
    
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;
    boilerParticleTimer = 0;

    constructor(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void, sessionMode: SessionMode = 'solo') {
        this.onStateUpdate = onStateUpdate;
        this.sessionMode = sessionMode;
        this.quality = detectQualityProfile();
        this.renderer = new Renderer(canvas, this.quality);
        this.input = new InputManager();
        this.network = new NetworkManager();
        this.sounds = new AudioManager();
        this.decals = new DecalManager(this.renderer.scene, this.quality);
        
        this.physicsWrapper = new Physics();
        this.physicsWrapper.initSync();
        this.physics = this.physicsWrapper.world;

        this.world = new Arena(this.renderer.scene, this.physics);
        this.mechCamera = new MechCamera(this.renderer.camera);
        this.golem = new GolemController(this.renderer.scene, this.physics, true);
        this.golem.gameCamera = this.mechCamera;
        this.particles = new ParticleManager(this.renderer.scene, this.quality);
        this.debris = new DebrisManager(this.renderer.scene, this.quality);
        this.projectiles = new ProjectileManager(this.renderer.scene);
        this.dummy = new DummyBot(
            this.renderer.scene,
            this.physics,
            this.world.botSpawn.x,
            this.world.botSpawn.y,
            this.world.botSpawn.z,
            sessionMode !== 'client'
        );

        if (sessionMode === 'client') {
            this.setClientMode();
        }

        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
        this.syncLocalCameraMode();
        this.dummy.respawnRadius = this.world.spawnRadius;

        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
            this.sounds.init();
        });

        this.setupNetwork();
    }

    playPropFx() {
        const localPos = this.golem.body.translation();
        _listenerPos.set(localPos.x, localPos.y, localPos.z);
        for (const event of this.world.propManager.consumeFxEvents()) {
            _propFxPos.set(event.x, event.y, event.z);
            const distance = _propFxPos.distanceTo(_listenerPos);
            const proximity = THREE.MathUtils.clamp(1 - distance / 28, 0, 1);

            if (event.kind === 'tree_fall') {
                this.particles.emitBurst(event.x, event.y, event.z, 14, 1.8, 2.8, 1.15);
                this.debris.emitBurst(event.x, event.y, event.z, 'tree', event.intensity);
                this.decals.addRuinMark(_propFxPos, 2.8, 22);
                this.sounds.playStructureHit(0.7 * event.intensity);
            } else if (event.kind === 'house_damage') {
                this.particles.emitBurst(event.x, event.y, event.z, 20, 2.8, 3.1, 1.2);
                this.debris.emitBurst(event.x, event.y, event.z, 'houseDamage', event.intensity);
                this.decals.addRuinMark(_propFxPos, 3.6, 28);
                this.sounds.playStructureHit(1.0 * event.intensity);
            } else {
                this.particles.emitBurst(event.x, event.y, event.z, 34, 4.2, 4.2, 1.5);
                this.debris.emitBurst(event.x, event.y, event.z, 'houseCollapse', event.intensity);
                this.decals.addRuinMark(_propFxPos, 5.4, 34);
                this.sounds.playCollapse(1.0 * event.intensity);
            }

            if (proximity > 0) {
                this.mechCamera.addTrauma(proximity * 0.28 * event.intensity);
            }
        }
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            const remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
            this.remotePlayers.set(id, remoteGolem);

            if (this.sessionMode === 'host') {
                const spawnSlot = this.allocateRemoteSpawnSlot();
                this.remoteSpawnSlots.set(id, spawnSlot);
                const spawn = this.getPlayerSpawn(spawnSlot);
                const yaw = this.getSpawnYaw(spawn);
                this.placeGolemAtSpawn(remoteGolem, spawn, yaw);
                this.network.sendTo(id, { type: 'respawn', x: spawn.x, y: spawn.y, z: spawn.z, yaw });
            } else if (this.sessionMode === 'client') {
                this.placeGolemAtSpawn(remoteGolem, this.getPlayerSpawn(0));
            }
        };

        this.network.onDisconnect = (id) => {
            console.log("Player disconnected:", id);
            const remoteGolem = this.remotePlayers.get(id);
            if (remoteGolem) {
                this.renderer.scene.remove(remoteGolem.model);
                this.physics.removeRigidBody(remoteGolem.body);
                this.remotePlayers.delete(id);
            }
            this.remoteSpawnSlots.delete(id);
        };

        this.network.onData = (id, data) => {
            if (data.type === 'state' && !this.network.isHost) {
                // Host sent state to client
                if (data.dummy) {
                    if (this.dummy.hp > data.dummy.hp) {
                        this.dummy.mat.emissive.setHex(0xffffff);
                        this.dummy.damageTimer = 0.1;
                    }
                    this.dummy.hp = data.dummy.hp;
                    this.dummy.targetPos.set(data.dummy.x, data.dummy.y, data.dummy.z);
                }
                if (data.props) {
                    this.world.propManager.applySnapshot(data.props);
                }
                
                if (data.players) {
                    // Remove players that are no longer in the state
                    for (const pid of this.remotePlayers.keys()) {
                        if (!data.players[pid]) {
                            const remoteGolem = this.remotePlayers.get(pid);
                            if (remoteGolem) {
                                this.renderer.scene.remove(remoteGolem.model);
                                this.physics.removeRigidBody(remoteGolem.body);
                                this.remotePlayers.delete(pid);
                            }
                        }
                    }

                    for (const pid in data.players) {
                        const pState = data.players[pid];
                        
                        if (pid === this.network.myId) {
                            // Update my own HP from Host
                            if (pState.hp !== undefined) {
                                if (this.golem.hp > pState.hp) {
                                    this.mechCamera.onHit(this.golem.hp - pState.hp); // I took damage
                                }
                            }
                            if (pState.sections) this.golem.setSectionState(pState.sections);
                            continue;
                        }
                        
                        let remoteGolem = this.remotePlayers.get(pid);
                        if (!remoteGolem) {
                            remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
                            this.remotePlayers.set(pid, remoteGolem);
                            this.placeGolemAtSpawn(remoteGolem, new THREE.Vector3(pState.x, pState.y, pState.z), pState.ly);
                        }
                        
                        remoteGolem.targetPos.set(pState.x, pState.y, pState.z);
                        remoteGolem.targetLegYaw = pState.ly;
                        remoteGolem.targetTorsoYaw = pState.ty;
                        if (pState.sections) {
                            if (remoteGolem.hp > pState.hp) {
                                remoteGolem.flashDamage();
                            }
                            remoteGolem.setSectionState(pState.sections);
                        } else if (pState.hp !== undefined) {
                            if (remoteGolem.hp > pState.hp) {
                                remoteGolem.flashDamage();
                            }
                            remoteGolem.hp = pState.hp;
                        }
                    }
                }
            } else if (data.type === 'input' && this.network.isHost) {
                // Client sent input to Host
                const remoteGolem = this.remotePlayers.get(id);
                if (remoteGolem) {
                    // Apply client inputs (simplified)
                    remoteGolem.targetLegYaw = data.ly;
                    remoteGolem.targetTorsoYaw = data.ty;
                    remoteGolem.targetPos.set(data.pos.x, data.pos.y, data.pos.z);
                }
            } else if (data.type === 'respawn') {
                this.golem.body.setTranslation({ x: data.x, y: data.y, z: data.z }, true);
                this.golem.targetPos.set(data.x, data.y, data.z);
                if (typeof data.yaw === 'number') {
                    this.golem.legYaw = data.yaw;
                    this.golem.torsoYaw = data.yaw;
                    this.golem.targetLegYaw = data.yaw;
                    this.golem.targetTorsoYaw = data.yaw;
                    this.mechCamera.aimYaw = data.yaw;
                }
                this.golem.resetSections();
                this.mechCamera.addTrauma(1.0); // Big shake on respawn
            } else if (data.type === 'fire') {
                if (id !== this.network.myId) {
                    const origin = new THREE.Vector3(data.ox, data.oy, data.oz);
                    const dir = new THREE.Vector3(data.dx, data.dy, data.dz);
                    this.projectiles.fire(origin, dir, data.ownerId);
                    
                    // If Host receives fire from client, forward to other clients
                    if (this.network.isHost) {
                        this.network.connections.forEach((conn, peerId) => {
                            if (peerId !== id) conn.send(data);
                        });
                    }
                }
            } else if (data.type === 'hitConfirm') {
                this.registerHitConfirm(data.hp ?? 0, data.maxHp ?? 100);
            }
        };
    }

    setClientMode() {
        this.sessionMode = 'client';
        this.dummy.isHost = false;
        this.dummy.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    }

    getInitialLocalSpawn() {
        if (this.sessionMode === 'solo') {
            return this.world.soloSpawn;
        }
        return this.getPlayerSpawn(this.sessionMode === 'client' ? 1 : 0);
    }

    getPlayerSpawn(slot: number) {
        const spawn = this.world.playerSpawns[slot % this.world.playerSpawns.length];
        return spawn.clone();
    }

    getSpawnYaw(spawn: THREE.Vector3) {
        _spawnDir.set(-spawn.x, 0, -spawn.z);
        if (_spawnDir.lengthSq() < 0.0001) return 0;
        _spawnDir.normalize();
        return Math.atan2(_spawnDir.x, -_spawnDir.z);
    }

    placeGolemAtSpawn(golem: GolemController, spawn: THREE.Vector3, yaw = this.getSpawnYaw(spawn)) {
        golem.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
        golem.targetPos.copy(spawn);
        golem.legYaw = yaw;
        golem.torsoYaw = yaw;
        golem.targetLegYaw = yaw;
        golem.targetTorsoYaw = yaw;
        golem.model.position.set(spawn.x, spawn.y - 1.5, spawn.z);
        golem.legs.rotation.y = yaw;
        golem.torso.rotation.y = yaw;
        golem.resetSections();

        if (golem.isLocal && golem.gameCamera) {
            golem.gameCamera.aimYaw = yaw;
        }
    }

    syncLocalCameraMode() {
        this.golem.model.visible = this.mechCamera.mode === 'thirdPerson';
    }

    setCameraMode(mode: 'cockpit' | 'thirdPerson') {
        this.mechCamera.setMode(mode);
        this.syncLocalCameraMode();
        return this.mechCamera.mode;
    }

    toggleCameraMode() {
        const mode = this.mechCamera.toggleMode();
        this.syncLocalCameraMode();
        return mode;
    }

    allocateRemoteSpawnSlot() {
        for (let slot = 1; slot < this.world.playerSpawns.length; slot++) {
            if (![...this.remoteSpawnSlots.values()].includes(slot)) {
                return slot;
            }
        }
        return ((this.remotePlayers.size - 1) % Math.max(1, this.world.playerSpawns.length - 1)) + 1;
    }

    registerHitConfirm(targetHp: number, targetMaxHp: number) {
        this.hitConfirmTimer = 0.22;
        this.hitTargetHp = Math.max(0, targetHp);
        this.hitTargetMaxHp = Math.max(1, targetMaxHp);
    }

    confirmHitForOwner(ownerId: string, targetHp: number, targetMaxHp: number) {
        if (ownerId === 'solo-bot') return;

        const isLocalShooter = this.sessionMode === 'solo'
            ? ownerId !== 'solo-bot'
            : ownerId === this.network.myId;

        if (isLocalShooter) {
            this.registerHitConfirm(targetHp, targetMaxHp);
            return;
        }

        if (this.sessionMode === 'host' && ownerId) {
            this.network.sendTo(ownerId, { type: 'hitConfirm', hp: targetHp, maxHp: targetMaxHp });
        }
    }

    buildRadarContacts(): RadarContact[] {
        const localPos = this.golem.body.translation();
        const maxRange = 90;
        const contacts: RadarContact[] = [];
        const yaw = this.golem.legYaw;

        _radarRight.set(Math.cos(yaw), 0, Math.sin(yaw));
        _radarForward.set(Math.sin(yaw), 0, -Math.cos(yaw));

        const pushContact = (worldX: number, worldZ: number, kind: 'enemy' | 'bot') => {
            _radarDelta.set(worldX - localPos.x, 0, worldZ - localPos.z);
            const distance = _radarDelta.length();
            if (distance < 0.001 || distance > maxRange) return;

            let x = _radarDelta.dot(_radarRight) / maxRange;
            let y = _radarDelta.dot(_radarForward) / maxRange;
            const radial = Math.hypot(x, y);
            if (radial > 1) {
                x /= radial;
                y /= radial;
            }

            contacts.push({
                x: Number(x.toFixed(3)),
                y: Number(y.toFixed(3)),
                kind,
                distance: Number((distance / maxRange).toFixed(3)),
                meters: Math.round(distance)
            });
        };

        this.remotePlayers.forEach((player) => {
            const pos = player.body.translation();
            pushContact(pos.x, pos.z, 'enemy');
        });

        if (this.sessionMode === 'solo' && this.dummy.hp > 0) {
            pushContact(this.dummy.mesh.position.x, this.dummy.mesh.position.z, 'bot');
        }

        contacts.sort((left, right) => left.distance - right.distance);
        return contacts.slice(0, 6);
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);
        this.renderer.dispose();
    }

    loop = (time: number) => {
        if (!this.isRunning) return;
        this.animationFrameId = requestAnimationFrame(this.loop);

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.hitConfirmTimer = Math.max(0, this.hitConfirmTimer - dt);

        this.physics.step();

        const { mx, my } = this.input.consumeMovement();
        this.mechCamera.onMouseMove(mx, my);

        if (this.input.consumeKey('KeyV')) {
            this.toggleCameraMode();
        }

        let throttleInput = this.input.virtualThrottle;
        let turnInput = this.input.virtualTurn;
        if (this.input.keys['KeyW']) throttleInput += 1;
        if (this.input.keys['KeyS']) throttleInput -= 1;
        if (this.input.keys['KeyA']) turnInput -= 1;
        if (this.input.keys['KeyD']) turnInput += 1;
        throttleInput = clamp(throttleInput, -1, 1);
        turnInput = clamp(turnInput, -1, 1);

        const centerTorso = this.input.consumeKey('KeyC') || this.input.consumeVirtualAction('centerTorso');
        const stopThrottle = this.input.consumeKey('KeyX') || this.input.consumeVirtualAction('stopThrottle');

        const events = this.golem.update(
            dt,
            this.mechCamera.aimYaw,
            throttleInput,
            turnInput,
            centerTorso,
            stopThrottle,
            this.sounds,
            this.decals
        );
        
        const golemState = this.golem.getState();

        // Calculate torso turn speed for sounds
        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);
        
        this.remotePlayers.forEach(player => {
            player.update(dt, player.targetTorsoYaw, 0, 0, false, false, this.sounds, this.decals);
        });

        const authorityMode = this.sessionMode !== 'client';
        const localPos = this.golem.body.translation();
        const botFireSolution = this.sessionMode === 'solo'
            ? this.dummy.update(dt, _botTarget.set(localPos.x, localPos.y + 1.4, localPos.z))
            : this.dummy.update(dt);
        if (botFireSolution) {
            this.projectiles.fire(botFireSolution.origin, botFireSolution.dir, 'solo-bot');
        }

        this.projectiles.update(dt);
        this.decals.update(dt);
        
        this.mechCamera.getAimDirection(_weaponDir);
        this.golem.getViewAnchor(_weaponOrigin, this.mechCamera.aimYaw);
        _weaponOrigin.addScaledVector(_weaponDir, 0.9);

        if (this.input.consumeClick()) {
            if (this.golem.canFire() && this.golem.tryAction(5)) {
                const origin = _weaponOrigin.clone();
                
                this.projectiles.fire(origin, _weaponDir.clone(), this.network.myId);
                this.mechCamera.onFire(0.3); // RuneBolt weight
                
                // Broadcast fire event
                if (this.sessionMode !== 'solo') {
                    this.network.broadcast({
                        type: 'fire',
                        ownerId: this.network.myId,
                        ox: origin.x, oy: origin.y, oz: origin.z,
                        dx: _weaponDir.x, dy: _weaponDir.y, dz: _weaponDir.z
                    });
                }
            }
        }
        
        if (this.input.consumeKey('ShiftLeft') || this.input.consumeVirtualAction('dash')) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
                this.mechCamera.onDash();
            }
        }
        
        if (this.input.consumeKey('Space') || this.input.consumeVirtualAction('vent')) {
            if (this.golem.tryAction(0)) {
                this.golem.vent(this.particles);
                this.mechCamera.addTrauma(0.5);
            }
        }

        this.projectiles.checkCollisions(
            this.dummy, 
            this.remotePlayers, 
            this.golem, 
            this.network.myId, 
            authorityMode,
            this.world.getCollisionMeshes(),
            this.world.propManager,
            this.decals,
            (ownerId, targetId, damage, section) => {
                if (targetId === '__dummy__') {
                    const remainingHp = this.dummy.takeDamage(damage);
                    this.confirmHitForOwner(ownerId, remainingHp, 100);
                    return;
                }

                const hitSection = section === '__dummy__' ? 'centerTorso' : section;

                if (targetId === this.network.myId) {
                    const result = this.golem.applySectionDamage(hitSection, damage);
                    this.mechCamera.onHit(damage);
                    if (result.lethal) {
                        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
                        this.mechCamera.addTrauma(1.0); // Big shake on respawn
                    }
                    this.confirmHitForOwner(ownerId, result.totalHp, this.golem.maxHp);
                } else {
                    const p = this.remotePlayers.get(targetId);
                    if (p) {
                        const result = p.applySectionDamage(hitSection, damage);
                        if (result.lethal) {
                            const spawnSlot = this.remoteSpawnSlots.get(targetId) ?? 1;
                            const spawn = this.getPlayerSpawn(spawnSlot);
                            const yaw = this.getSpawnYaw(spawn);
                            this.placeGolemAtSpawn(p, spawn, yaw);
                            this.network.sendTo(targetId, { type: 'respawn', x: spawn.x, y: spawn.y, z: spawn.z, yaw });
                        }
                        this.confirmHitForOwner(ownerId, result.totalHp, p.maxHp);
                    }
                }
            }
        );

        this.playPropFx();
        
        this.boilerParticleTimer += dt;
        if (this.boilerParticleTimer >= this.quality.boilerParticleInterval) {
            this.boilerParticleTimer = 0;
            const boilerPos = new THREE.Vector3();
            this.golem.boiler.getWorldPosition(boilerPos);
            this.particles.emit(boilerPos.x, boilerPos.y + 0.5, boilerPos.z);
        }
        this.particles.update(dt);
        this.debris.update(dt);

        // Network synchronization (20 Hz)
        this.networkTickTimer += dt;
        if (this.networkTickTimer >= 0.05) {
            this.networkTickTimer = 0;
            
            const pos = this.golem.body.translation();
            
            if (this.sessionMode === 'host') {
                // Host broadcasts all states
                const playersState: any = {};
                playersState[this.network.myId] = {
                    x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)),
                    ly: Number(this.golem.legYaw.toFixed(2)), ty: Number(this.golem.torsoYaw.toFixed(2)),
                    hp: this.golem.hp,
                    sections: { ...this.golem.sections }
                };
                
                this.remotePlayers.forEach((player, id) => {
                    const pPos = player.body.translation();
                    playersState[id] = {
                        x: Number(pPos.x.toFixed(2)), y: Number(pPos.y.toFixed(2)), z: Number(pPos.z.toFixed(2)),
                        ly: Number(player.legYaw.toFixed(2)), ty: Number(player.torsoYaw.toFixed(2)),
                        hp: player.hp,
                        sections: { ...player.sections }
                    };
                });
                
                this.network.broadcast({ 
                    type: 'state', 
                    players: playersState,
                    dummy: { x: this.dummy.mesh.position.x, y: this.dummy.mesh.position.y, z: this.dummy.mesh.position.z, hp: this.dummy.hp },
                    props: this.world.propManager.getSnapshot()
                });
            } else if (this.sessionMode === 'client') {
                // Client sends input/position to Host
                this.network.sendToHost({
                    type: 'input',
                    pos: { x: pos.x, y: pos.y, z: pos.z },
                    ly: this.golem.legYaw,
                    ty: this.golem.torsoYaw
                });
            }
        }

        _aimPoint.copy(_weaponOrigin).addScaledVector(_weaponDir, 120);
        _aimPoint.project(this.renderer.camera);

        const aimScreenX = THREE.MathUtils.clamp(_aimPoint.x, -1.2, 1.2);
        const aimScreenY = THREE.MathUtils.clamp(_aimPoint.y, -1.2, 1.2);

        this.onStateUpdate({
            hp: this.golem.hp,
            maxHp: this.golem.maxHp,
            steam: this.golem.steam,
            maxSteam: this.golem.maxSteam,
            isOverheated: this.golem.isOverheated,
            overheatTimer: this.golem.overheatTimer,
            legYaw: golemState.legYaw,
            torsoYaw: golemState.torsoYaw,
            throttle: golemState.throttle,
            speed: golemState.currentSpeed,
            maxSpeed: GOLEM.classes.medium.speed,
            maxTwist: ROTATION.maxTorsoTwist,
            cameraMode: this.mechCamera.mode,
            aimOffsetX: aimScreenX,
            aimOffsetY: aimScreenY,
            hitConfirm: this.hitConfirmTimer,
            hitTargetHp: this.hitTargetHp,
            hitTargetMaxHp: this.hitTargetMaxHp,
            sections: { ...golemState.sections },
            maxSections: { ...golemState.maxSections },
            radarContacts: this.buildRadarContacts(),
            terrainColliderMode: this.world.terrain.groundColliderMode,
            terrainColliderError: this.world.terrain.groundColliderError
        });

        this.renderer.render();
    }
}

export async function initGame(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void, sessionMode: SessionMode = 'solo') {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate, sessionMode);
    game.start();
    return game;
}
