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
import { DecalManager } from '../fx/DecalManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';

export class Game {
    renderer: Renderer;
    input: InputManager;
    world: Arena;
    golem: GolemController;
    mechCamera: MechCamera;
    remotePlayers: Map<string, GolemController> = new Map();
    particles: ParticleManager;
    projectiles: ProjectileManager;
    dummy: DummyBot;
    physicsWrapper: Physics;
    physics: RAPIER.World;
    network: NetworkManager;
    sounds: AudioManager;
    decals: DecalManager;
    onStateUpdate: (state: any) => void;
    
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;

    constructor(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void) {
        this.onStateUpdate = onStateUpdate;
        this.renderer = new Renderer(canvas);
        this.input = new InputManager();
        this.network = new NetworkManager();
        this.sounds = new AudioManager();
        this.decals = new DecalManager(this.renderer.scene);
        
        this.physicsWrapper = new Physics();
        this.physicsWrapper.initSync();
        this.physics = this.physicsWrapper.world;

        this.world = new Arena(this.renderer.scene, this.physics);
        this.mechCamera = new MechCamera(this.renderer.camera);
        this.golem = new GolemController(this.renderer.scene, this.physics, true);
        this.golem.gameCamera = this.mechCamera;
        this.particles = new ParticleManager(this.renderer.scene);
        this.projectiles = new ProjectileManager(this.renderer.scene);
        this.dummy = new DummyBot(this.renderer.scene, this.physics, 0, 5, -15);

        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
            this.sounds.init();
        });

        this.setupNetwork();
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            const remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
            this.remotePlayers.set(id, remoteGolem);
        };

        this.network.onDisconnect = (id) => {
            console.log("Player disconnected:", id);
            const remoteGolem = this.remotePlayers.get(id);
            if (remoteGolem) {
                this.renderer.scene.remove(remoteGolem.model);
                this.physics.removeRigidBody(remoteGolem.body);
                this.remotePlayers.delete(id);
            }
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
                                this.golem.hp = pState.hp;
                            }
                            continue;
                        }
                        
                        let remoteGolem = this.remotePlayers.get(pid);
                        if (!remoteGolem) {
                            remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
                            this.remotePlayers.set(pid, remoteGolem);
                        }
                        
                        remoteGolem.targetPos.set(pState.x, pState.y, pState.z);
                        remoteGolem.targetLegYaw = pState.ly;
                        remoteGolem.targetTorsoYaw = pState.ty;
                        if (pState.hp !== undefined) remoteGolem.hp = pState.hp;
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
                this.golem.hp = this.golem.maxHp;
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
            }
        };
    }

    setClientMode() {
        this.dummy.isHost = false;
        this.dummy.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
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

        this.physics.step();

        const { mx, my } = this.input.consumeMovement();
        this.mechCamera.onMouseMove(mx, my);

        let moveZ = 0;
        let moveX = 0;
        if (this.input.keys['KeyW']) moveZ = -1;
        if (this.input.keys['KeyS']) moveZ = 1;
        if (this.input.keys['KeyA']) moveX = -1;
        if (this.input.keys['KeyD']) moveX = 1;

        const events = this.golem.update(dt, this.mechCamera.aimYaw, moveX, moveZ, this.sounds, this.decals, this.world.meshes);
        
        const golemState = this.golem.getState();

        // Calculate torso turn speed for sounds
        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);
        
        this.remotePlayers.forEach(player => {
            player.update(dt, player.targetTorsoYaw, 0, 0, this.sounds, this.decals);
        });

        this.dummy.update(dt);
        this.projectiles.update(dt);
        this.decals.update(dt);
        
        if (this.input.consumeClick()) {
            if (this.golem.tryAction(5)) {
                const origin = new THREE.Vector3();
                this.golem.torso.getWorldPosition(origin);
                origin.y += 0.5;
                
                const dir = new THREE.Vector3(0, 0, -1);
                dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.mechCamera.pitch);
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.golem.torsoYaw);
                
                origin.addScaledVector(dir, 2.0);
                
                this.projectiles.fire(origin, dir, this.network.myId);
                this.mechCamera.onFire(0.3); // RuneBolt weight
                
                // Broadcast fire event
                this.network.broadcast({
                    type: 'fire',
                    ownerId: this.network.myId,
                    ox: origin.x, oy: origin.y, oz: origin.z,
                    dx: dir.x, dy: dir.y, dz: dir.z
                });
            }
        }
        
        if (this.input.consumeKey('ShiftLeft')) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
                this.mechCamera.onDash();
            }
        }
        
        if (this.input.consumeKey('Space')) {
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
            this.network.isHost,
            this.world.meshes,
            this.decals,
            (targetId, damage) => {
                if (targetId === this.network.myId) {
                    this.golem.hp -= damage;
                    this.mechCamera.onHit(damage);
                    if (this.golem.hp <= 0) {
                        this.golem.hp = this.golem.maxHp;
                        this.golem.body.setTranslation({ x: (Math.random() - 0.5) * 40, y: 5, z: (Math.random() - 0.5) * 40 }, true);
                        this.mechCamera.addTrauma(1.0); // Big shake on respawn
                    }
                } else {
                    const p = this.remotePlayers.get(targetId);
                    if (p) {
                        p.hp -= damage;
                        if (p.hp <= 0) {
                            p.hp = p.maxHp;
                            const rx = (Math.random() - 0.5) * 40;
                            const rz = (Math.random() - 0.5) * 40;
                            p.body.setTranslation({ x: rx, y: 5, z: rz }, true);
                            this.network.sendTo(targetId, { type: 'respawn', x: rx, y: 5, z: rz });
                        }
                    }
                }
            }
        );
        
        const boilerPos = new THREE.Vector3();
        this.golem.boiler.getWorldPosition(boilerPos);
        this.particles.emit(boilerPos.x, boilerPos.y + 0.5, boilerPos.z);
        this.particles.update(dt);

        // Network synchronization (20 Hz)
        this.networkTickTimer += dt;
        if (this.networkTickTimer >= 0.05) {
            this.networkTickTimer = 0;
            
            const pos = this.golem.body.translation();
            
            if (this.network.isHost) {
                // Host broadcasts all states
                const playersState: any = {};
                playersState[this.network.myId] = {
                    x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)),
                    ly: Number(this.golem.legYaw.toFixed(2)), ty: Number(this.golem.torsoYaw.toFixed(2)),
                    hp: this.golem.hp
                };
                
                this.remotePlayers.forEach((player, id) => {
                    const pPos = player.body.translation();
                    playersState[id] = {
                        x: Number(pPos.x.toFixed(2)), y: Number(pPos.y.toFixed(2)), z: Number(pPos.z.toFixed(2)),
                        ly: Number(player.legYaw.toFixed(2)), ty: Number(player.torsoYaw.toFixed(2)),
                        hp: player.hp
                    };
                });
                
                this.network.broadcast({ 
                    type: 'state', 
                    players: playersState,
                    dummy: { x: this.dummy.mesh.position.x, y: this.dummy.mesh.position.y, z: this.dummy.mesh.position.z, hp: this.dummy.hp }
                });
            } else {
                // Client sends input/position to Host
                this.network.sendToHost({
                    type: 'input',
                    pos: { x: pos.x, y: pos.y, z: pos.z },
                    ly: this.golem.legYaw,
                    ty: this.golem.torsoYaw
                });
            }
        }

        const aimOffset = this.mechCamera.getAimScreenOffset(this.golem.legYaw);

        this.onStateUpdate({
            hp: this.golem.hp,
            maxHp: this.golem.maxHp,
            steam: this.golem.steam,
            maxSteam: this.golem.maxSteam,
            isOverheated: this.golem.isOverheated,
            overheatTimer: this.golem.overheatTimer,
            aimOffset: aimOffset
        });

        this.renderer.render();
    }
}

export async function initGame(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void) {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate);
    game.start();
    return game;
}
