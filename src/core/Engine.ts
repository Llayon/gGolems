import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { Arena } from '../world/Arena';
import { GolemController, type GolemSection } from '../entities/GolemController';
import { DummyBot } from '../entities/DummyBot';
import { ParticleManager } from '../fx/ParticleManager';
import { DebrisManager } from '../fx/DebrisManager';
import { DecalManager } from '../fx/DecalManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';
import { ControlPointManager } from '../gameplay/ControlPointManager';
import { CAMERA, GOLEM, ROTATION } from '../utils/constants';
import { QualityProfile, detectQualityProfile } from '../utils/quality';
import type { ProjectileProfileId, WeaponFireRequest, WeaponId } from '../combat/weaponTypes';
import type { BotStateView, GameMode, TeamId, TeamOverview, TeamScoreState } from '../gameplay/types';

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
const _spreadRight = new THREE.Vector3();
const _spreadUp = new THREE.Vector3();
const _spreadDir = new THREE.Vector3();
const _muzzleOrigin = new THREE.Vector3();
const _cameraAimDir = new THREE.Vector3();
const _shotBaseDir = new THREE.Vector3();

type FireShotPayload = {
    weaponId: WeaponId;
    profile: ProjectileProfileId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
    damage: number;
    speed: number;
    range: number;
};

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

type PlayerRespawnState = {
    alive: boolean;
    timer: number;
    slot: number;
};

type RemotePlayerState = PlayerRespawnState & {
    team: TeamId;
};

const TEAM_SIZE = 5;
const SCORE_TO_WIN: Record<GameMode, number> = {
    control: 200,
    tdm: 30
};
const RESPAWN_WAVE_DELAY = 8;
const LOCAL_PLAYER_ID = 'local-player';

export class Game {
    renderer: Renderer;
    input: InputManager;
    world: Arena;
    golem: GolemController;
    mechCamera: MechCamera;
    remotePlayers: Map<string, GolemController> = new Map();
    remotePlayerStates: Map<string, RemotePlayerState> = new Map();
    particles: ParticleManager;
    debris: DebrisManager;
    projectiles: ProjectileManager;
    bots: Map<string, DummyBot> = new Map();
    controlPoints: ControlPointManager;
    physicsWrapper: Physics;
    physics: RAPIER.World;
    network: NetworkManager;
    sounds: AudioManager;
    decals: DecalManager;
    quality: QualityProfile;
    aimRaycaster = new THREE.Raycaster();
    onStateUpdate: (state: any) => void;
    sessionMode: SessionMode;
    gameMode: GameMode;
    remoteSpawnSlots: Map<string, number> = new Map();
    teamScores: TeamScoreState = { blue: 0, red: 0, scoreToWin: SCORE_TO_WIN.control, winner: null };
    localRespawnState: PlayerRespawnState = { alive: true, timer: 0, slot: 0 };
    respawnWaves: Record<TeamId, number> = { blue: 0, red: 0 };
    hitConfirmTimer = 0;
    hitTargetHp = 0;
    hitTargetMaxHp = 100;
    
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;
    boilerParticleTimer = 0;

    constructor(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void, sessionMode: SessionMode = 'solo', gameMode: GameMode = 'control') {
        this.onStateUpdate = onStateUpdate;
        this.sessionMode = sessionMode;
        this.gameMode = gameMode;
        this.teamScores.scoreToWin = SCORE_TO_WIN[gameMode];
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
        this.controlPoints = new ControlPointManager(this.renderer.scene, this.world.controlPointPositions);
        this.controlPoints.setVisible(gameMode === 'control');

        if (sessionMode === 'client') {
            this.setClientMode();
        }

        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
        this.syncLocalCameraMode();
        if (sessionMode !== 'client') {
            this.syncTeamBotRoster();
        }

        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
            this.sounds.init();
        });

        this.setupNetwork();
    }

    setGameMode(mode: GameMode) {
        this.gameMode = mode;
        this.teamScores.scoreToWin = SCORE_TO_WIN[mode];
        this.controlPoints.setVisible(mode === 'control');
    }

    getSpreadDirection(baseDir: THREE.Vector3, spread: number) {
        const spreadScale = Math.max(0, spread);
        if (spreadScale <= 0.00001) {
            return _spreadDir.copy(baseDir);
        }

        const referenceUp = Math.abs(baseDir.y) > 0.92 ? _spreadUp.set(1, 0, 0) : _spreadUp.set(0, 1, 0);
        _spreadRight.crossVectors(baseDir, referenceUp).normalize();
        _spreadUp.crossVectors(_spreadRight, baseDir).normalize();
        return _spreadDir
            .copy(baseDir)
            .addScaledVector(_spreadRight, (Math.random() - 0.5) * spreadScale)
            .addScaledVector(_spreadUp, (Math.random() - 0.5) * spreadScale)
            .normalize();
    }

    getAimTargetPoint(out: THREE.Vector3) {
        this.renderer.camera.getWorldDirection(_cameraAimDir).normalize();
        this.aimRaycaster.set(this.renderer.camera.position, _cameraAimDir);
        this.aimRaycaster.far = CAMERA.aimRayDistance;
        const hits = this.aimRaycaster.intersectObjects(this.world.getCollisionMeshes(), false);
        if (hits.length > 0) {
            return out.copy(hits[0].point);
        }
        return out.copy(this.renderer.camera.position).addScaledVector(_cameraAimDir, CAMERA.aimRayDistance);
    }

    playWeaponVolleyFx(shots: FireShotPayload[]) {
        const played = new Set<ProjectileProfileId>();
        for (const shot of shots) {
            if (played.has(shot.profile)) continue;
            played.add(shot.profile);

            if (shot.profile === 'steam_slug') {
                this.particles.emitBurst(shot.ox, shot.oy, shot.oz, 12, 0.8, 1.8, 0.28);
                this.sounds.playWeaponFire(shot.profile, 1.1);
            } else if (shot.profile === 'arc_pulse') {
                this.particles.emitBurst(shot.ox, shot.oy, shot.oz, 8, 0.45, 1.2, 0.18);
                this.sounds.playWeaponFire(shot.profile, 0.9);
            } else {
                this.particles.emitBurst(shot.ox, shot.oy, shot.oz, 6, 0.32, 0.9, 0.16);
                this.sounds.playWeaponFire(shot.profile, 0.8);
            }
        }
    }

    playProjectileImpactFx() {
        const localPos = this.golem.body.translation();
        _listenerPos.set(localPos.x, localPos.y, localPos.z);

        for (const event of this.projectiles.consumeImpactEvents()) {
            _propFxPos.set(event.x, event.y, event.z);
            const proximity = clamp(1 - _propFxPos.distanceTo(_listenerPos) / 34, 0, 1);

            if (event.profile === 'steam_slug') {
                this.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 18 : 24, 1.2, 2.3, 0.55);
            } else if (event.profile === 'arc_pulse') {
                this.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 12 : 16, 0.85, 1.7, 0.4);
            } else {
                this.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 8 : 12, 0.55, 1.2, 0.3);
            }

            if (proximity > 0.05) {
                this.sounds.playWeaponImpact(event.profile, 0.75 + proximity * 0.45);
                if (event.kind !== 'world') {
                    this.mechCamera.addTrauma(proximity * 0.08);
                }
            }
        }
    }

    spawnShot(shot: FireShotPayload, ownerId: string) {
        this.projectiles.fire({
            origin: _weaponOrigin.set(shot.ox, shot.oy, shot.oz).clone(),
            dir: _weaponDir.set(shot.dx, shot.dy, shot.dz).clone(),
            ownerId,
            weaponId: shot.weaponId,
            profile: shot.profile,
            damage: shot.damage,
            speed: shot.speed,
            range: shot.range
        });
    }

    fireWeaponRequests(ownerId: string, requests: WeaponFireRequest[], aimTarget: THREE.Vector3) {
        if (requests.length === 0) return;

        this.renderer.camera.getWorldDirection(_cameraAimDir).normalize();
        const shots: FireShotPayload[] = [];
        let trauma = 0;

        for (const request of requests) {
            this.golem.getWeaponMuzzleOrigin(request.mountId, _muzzleOrigin);
            trauma = Math.max(trauma, request.fireTrauma);
            _shotBaseDir.copy(aimTarget).sub(_muzzleOrigin);
            if (_shotBaseDir.lengthSq() <= 0.0001) {
                _shotBaseDir.copy(_cameraAimDir);
            } else {
                _shotBaseDir.normalize();
            }

            for (let index = 0; index < request.projectileCount; index++) {
                const dir = this.getSpreadDirection(_shotBaseDir, request.spread).clone();
                const shot: FireShotPayload = {
                    weaponId: request.weaponId,
                    profile: request.projectileProfile,
                    ox: _muzzleOrigin.x,
                    oy: _muzzleOrigin.y,
                    oz: _muzzleOrigin.z,
                    dx: dir.x,
                    dy: dir.y,
                    dz: dir.z,
                    damage: request.damage,
                    speed: request.projectileSpeed,
                    range: request.effectiveRange
                };
                shots.push(shot);
                this.spawnShot(shot, ownerId);
            }
        }

        this.playWeaponVolleyFx(shots);
        this.mechCamera.onFire(trauma);

        if (this.sessionMode !== 'solo') {
            this.network.broadcast({
                type: 'fire',
                ownerId,
                shots
            });
        }
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

    getLocalUnitId() {
        return this.network.myId || LOCAL_PLAYER_ID;
    }

    getTeamSpawns(team: TeamId) {
        return team === 'blue' ? this.world.blueSpawns : this.world.redSpawns;
    }

    getTeamSpawn(team: TeamId, slot: number) {
        const spawns = this.getTeamSpawns(team);
        return spawns[slot % spawns.length].clone();
    }

    createBot(id: string, team: TeamId, slot: number) {
        const spawn = this.getTeamSpawn(team, slot);
        const bot = new DummyBot(
            this.renderer.scene,
            this.physics,
            id,
            team,
            spawn.x,
            spawn.y,
            spawn.z,
            this.sessionMode !== 'client',
            this.world.surfaceY.bind(this.world)
        );
        bot.respawnRadius = this.world.spawnRadius;
        this.bots.set(id, bot);
        return bot;
    }

    destroyBot(id: string) {
        const bot = this.bots.get(id);
        if (!bot) return;
        this.renderer.scene.remove(bot.mesh);
        this.physics.removeRigidBody(bot.body);
        this.bots.delete(id);
    }

    syncTeamBotRoster() {
        if (this.sessionMode === 'client') return;

        const desired = new Map<string, { team: TeamId; slot: number }>();
        const occupiedBlueSlots = new Set<number>([this.localRespawnState.slot, ...this.remoteSpawnSlots.values()]);

        for (let slot = 0; slot < TEAM_SIZE; slot++) {
            if (!occupiedBlueSlots.has(slot)) {
                desired.set(`bot-blue-${slot}`, { team: 'blue', slot });
            }
        }

        for (let slot = 0; slot < TEAM_SIZE; slot++) {
            desired.set(`bot-red-${slot}`, { team: 'red', slot });
        }

        for (const [id] of this.bots) {
            if (!desired.has(id)) {
                this.destroyBot(id);
            }
        }

        for (const [id, info] of desired) {
            if (!this.bots.has(id)) {
                this.createBot(id, info.team, info.slot);
            }
        }
    }

    setGolemPresence(golem: GolemController, alive: boolean) {
        if (golem.isLocal) {
            golem.model.visible = alive && this.mechCamera.mode === 'thirdPerson';
        } else {
            golem.model.visible = alive;
        }
        if (!alive) {
            golem.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
    }

    setRemotePlayerState(id: string, patch: Partial<RemotePlayerState>) {
        const current = this.remotePlayerStates.get(id) ?? { alive: true, timer: 0, slot: 1, team: 'blue' as TeamId };
        this.remotePlayerStates.set(id, { ...current, ...patch });
    }

    applyTeamWaveTimer(team: TeamId, timer: number) {
        const clamped = Math.max(0, timer);
        if (team === 'blue') {
            if (!this.localRespawnState.alive) {
                this.localRespawnState.timer = clamped;
            }
            for (const [id, state] of this.remotePlayerStates) {
                if (state.team === 'blue' && !state.alive) {
                    this.setRemotePlayerState(id, { timer: clamped });
                }
            }
        } else {
            for (const [id, state] of this.remotePlayerStates) {
                if (state.team === 'red' && !state.alive) {
                    this.setRemotePlayerState(id, { timer: clamped });
                }
            }
        }

        for (const bot of this.bots.values()) {
            if (bot.team === team && !bot.alive) {
                bot.respawnTimer = clamped;
            }
        }
    }

    teamHasPendingRespawns(team: TeamId) {
        if (team === 'blue') {
            if (!this.localRespawnState.alive) return true;
            for (const state of this.remotePlayerStates.values()) {
                if (state.team === 'blue' && !state.alive) return true;
            }
        } else {
            for (const state of this.remotePlayerStates.values()) {
                if (state.team === 'red' && !state.alive) return true;
            }
        }

        for (const bot of this.bots.values()) {
            if (bot.team === team && !bot.alive) return true;
        }

        return false;
    }

    scheduleRespawnWave(team: TeamId, delay = RESPAWN_WAVE_DELAY) {
        if (this.respawnWaves[team] <= 0) {
            this.respawnWaves[team] = delay;
        }
        this.applyTeamWaveTimer(team, this.respawnWaves[team]);
    }

    queueLocalRespawn() {
        this.localRespawnState.alive = false;
        this.localRespawnState.timer = 0;
        this.golem.resetSections();
        this.golem.hp = 0;
        this.setGolemPresence(this.golem, false);
        const spawn = this.getTeamSpawn('blue', this.localRespawnState.slot);
        this.placeGolemAtSpawn(this.golem, spawn);
        this.scheduleRespawnWave('blue');
    }

    respawnLocalPlayer() {
        this.localRespawnState.alive = true;
        this.localRespawnState.timer = 0;
        const spawn = this.getTeamSpawn('blue', this.localRespawnState.slot);
        this.placeGolemAtSpawn(this.golem, spawn);
        this.golem.steam = this.golem.maxSteam;
        this.golem.isOverheated = false;
        this.golem.overheatTimer = 0;
        this.setGolemPresence(this.golem, true);
        this.mechCamera.addTrauma(1.0);
    }

    queueRemoteRespawn(id: string) {
        const player = this.remotePlayers.get(id);
        if (!player) return;
        const slot = this.remoteSpawnSlots.get(id) ?? 1;
        this.setRemotePlayerState(id, { alive: false, timer: 0, slot });
        player.resetSections();
        player.hp = 0;
        this.setGolemPresence(player, false);
        const spawn = this.getTeamSpawn('blue', slot);
        this.placeGolemAtSpawn(player, spawn);
        this.scheduleRespawnWave('blue');
    }

    respawnRemotePlayer(id: string) {
        const player = this.remotePlayers.get(id);
        if (!player) return;
        const slot = this.remoteSpawnSlots.get(id) ?? 1;
        const spawn = this.getTeamSpawn('blue', slot);
        this.placeGolemAtSpawn(player, spawn);
        player.steam = player.maxSteam;
        player.isOverheated = false;
        player.overheatTimer = 0;
        this.setGolemPresence(player, true);
        this.setRemotePlayerState(id, { alive: true, timer: 0, slot });
        this.network.sendTo(id, { type: 'respawn', x: spawn.x, y: spawn.y, z: spawn.z, yaw: this.getSpawnYaw(spawn), slot });
    }

    resolveRespawnWave(team: TeamId) {
        if (team === 'blue') {
            if (!this.localRespawnState.alive) {
                this.respawnLocalPlayer();
            }
            for (const [id, state] of this.remotePlayerStates) {
                if (state.team === 'blue' && !state.alive) {
                    this.respawnRemotePlayer(id);
                }
            }
        } else {
            for (const [id, state] of this.remotePlayerStates) {
                if (state.team === 'red' && !state.alive) {
                    this.respawnRemotePlayer(id);
                }
            }
        }

        for (const [id, bot] of this.bots) {
            if (bot.team === team && !bot.alive) {
                const slot = Number(id.split('-').pop() ?? 0) || 0;
                bot.respawnAt(this.getTeamSpawn(bot.team, slot));
            }
        }

        this.respawnWaves[team] = 0;
        this.applyTeamWaveTimer(team, 0);
    }

    getTeamOverview(): TeamOverview {
        let blueAlive = this.localRespawnState.alive ? 1 : 0;
        let blueTotal = 1;
        let blueWave = this.localRespawnState.alive ? 0 : this.localRespawnState.timer;
        let redAlive = 0;
        let redTotal = 0;
        let redWave = 0;

        for (const state of this.remotePlayerStates.values()) {
            if (state.team === 'blue') {
                blueTotal += 1;
                if (state.alive) blueAlive += 1;
                else blueWave = Math.max(blueWave, state.timer);
            } else if (state.team === 'red') {
                redTotal += 1;
                if (state.alive) redAlive += 1;
                else redWave = Math.max(redWave, state.timer);
            }
        }

        for (const bot of this.bots.values()) {
            if (bot.team === 'blue') {
                blueTotal += 1;
                if (bot.alive) blueAlive += 1;
                else blueWave = Math.max(blueWave, bot.respawnTimer);
            } else {
                redTotal += 1;
                if (bot.alive) redAlive += 1;
                else redWave = Math.max(redWave, bot.respawnTimer);
            }
        }

        return {
            blue: {
                alive: blueAlive,
                total: blueTotal,
                waveTimer: blueWave
            },
            red: {
                alive: redAlive,
                total: redTotal,
                waveTimer: redWave
            }
        };
    }

    updateRespawns(dt: number) {
        if (this.sessionMode === 'client') {
            this.localRespawnState.timer = Math.max(0, this.localRespawnState.timer - dt);
            return;
        }

        for (const team of ['blue', 'red'] as TeamId[]) {
            if (this.teamHasPendingRespawns(team) && this.respawnWaves[team] <= 0) {
                this.scheduleRespawnWave(team);
            }

            if (this.respawnWaves[team] > 0) {
                this.respawnWaves[team] = Math.max(0, this.respawnWaves[team] - dt);
                this.applyTeamWaveTimer(team, this.respawnWaves[team]);
                if (this.respawnWaves[team] <= 0) {
                    this.resolveRespawnWave(team);
                }
            }
        }
    }

    getUnitTeam(id: string): TeamId | null {
        if (!id) return 'blue';
        if (id === this.getLocalUnitId()) return 'blue';
        if (id.startsWith('bot-blue')) return 'blue';
        if (id.startsWith('bot-red')) return 'red';
        if (this.remotePlayers.has(id) || this.remotePlayerStates.has(id)) return 'blue';
        return null;
    }

    getNearestEnemyTarget(team: TeamId, from: THREE.Vector3, maxDistance = Number.POSITIVE_INFINITY) {
        let bestDistanceSq = Number.POSITIVE_INFINITY;
        let bestTarget: THREE.Vector3 | null = null;
        const maxDistanceSq = maxDistance * maxDistance;

        const consider = (target: THREE.Vector3, enemyTeam: TeamId, alive: boolean) => {
            if (!alive || enemyTeam === team) return;
            const distanceSq = from.distanceToSquared(target);
            if (distanceSq > maxDistanceSq) return;
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestTarget = target.clone();
            }
        };

        const localPos = this.golem.body.translation();
        consider(_botTarget.set(localPos.x, localPos.y + 1.4, localPos.z), 'blue', this.localRespawnState.alive);

        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            const alive = state ? state.alive : true;
            const pos = player.body.translation();
            consider(_weaponOrigin.set(pos.x, pos.y + 1.4, pos.z), 'blue', alive);
        });

        for (const bot of this.bots.values()) {
            const pos = bot.body.translation();
            consider(_weaponOrigin.set(pos.x, pos.y + 1.3, pos.z), bot.team, bot.alive);
        }

        return bestTarget;
    }

    getPriorityControlPoint(team: TeamId, from: THREE.Vector3) {
        const enemyTeam: TeamId = team === 'blue' ? 'red' : 'blue';
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestPoint: (typeof this.controlPoints.points)[number] | null = null;

        for (const point of this.controlPoints.points) {
            const friendlyInside = team === 'blue' ? point.blueInside : point.redInside;
            const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
            const distance = from.distanceTo(point.position);
            let score = -distance * 1.6;

            if (point.contested) {
                score += 260;
            } else if (point.owner === enemyTeam) {
                score += 220;
            } else if (point.owner === 'neutral') {
                score += 180;
            } else if (enemyInside > 0) {
                score += 210;
            } else {
                score += 60;
            }

            if (point.owner === team && point.capture * (team === 'blue' ? 1 : -1) >= 0.98) {
                score -= 30;
            }

            score -= friendlyInside * 24;
            score += enemyInside * 16;

            if (distance <= point.radius * 0.78) {
                score += 32;
            }

            if (score > bestScore) {
                bestScore = score;
                bestPoint = point;
            }
        }

        return bestPoint;
    }

    getBotMovementTarget(team: TeamId, from: THREE.Vector3) {
        const point = this.getPriorityControlPoint(team, from);
        if (point) {
            return point.position.clone();
        }
        return this.getNearestEnemyTarget(team, from);
    }

    haltHorizontalMotion(body: RAPIER.RigidBody) {
        const velocity = body.linvel();
        body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
    }

    collectControlUnits() {
        const units: Array<{ team: TeamId; position: THREE.Vector3; alive: boolean }> = [];
        const localPos = this.golem.body.translation();
        units.push({
            team: 'blue',
            position: new THREE.Vector3(localPos.x, localPos.y, localPos.z),
            alive: this.localRespawnState.alive
        });

        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            const pos = player.body.translation();
            units.push({
                team: 'blue',
                position: new THREE.Vector3(pos.x, pos.y, pos.z),
                alive: state ? state.alive : true
            });
        });

        for (const bot of this.bots.values()) {
            const pos = bot.body.translation();
            units.push({
                team: bot.team,
                position: new THREE.Vector3(pos.x, pos.y, pos.z),
                alive: bot.alive
            });
        }

        return units;
    }

    buildBotSnapshots(): BotStateView[] {
        return [...this.bots.values()].map((bot) => {
            const pos = bot.body.translation();
            return {
                id: bot.id,
                team: bot.team,
                x: Number(pos.x.toFixed(2)),
                y: Number(pos.y.toFixed(2)),
                z: Number(pos.z.toFixed(2)),
                yaw: Number(bot.mesh.rotation.y.toFixed(2)),
                hp: Math.max(0, Math.round(bot.hp)),
                maxHp: bot.maxHp,
                alive: bot.alive,
                respawnTimer: Number(bot.respawnTimer.toFixed(2))
            };
        });
    }

    applyBotSnapshots(botStates: BotStateView[]) {
        const nextIds = new Set(botStates.map((entry) => entry.id));

        for (const [id] of this.bots) {
            if (!nextIds.has(id)) {
                this.destroyBot(id);
            }
        }

        for (const botState of botStates) {
            let bot = this.bots.get(botState.id);
            if (!bot) {
                bot = this.createBot(botState.id, botState.team, 0);
                bot.isHost = false;
                bot.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
            }

            bot.team = botState.team;
            bot.applyTeamStyle(botState.team);
            bot.hp = botState.hp;
            bot.maxHp = botState.maxHp;
            bot.alive = botState.alive;
            bot.respawnTimer = botState.respawnTimer;
            bot.targetPos.set(botState.x, botState.y, botState.z);
            bot.mesh.rotation.y = botState.yaw;
            bot.mesh.visible = botState.alive;
            if (!botState.alive) {
                bot.body.setNextKinematicTranslation(new THREE.Vector3(botState.x, -120, botState.z));
            }
        }
    }

    handlePlayerHit(ownerId: string, targetId: string, damage: number, section: GolemSection | '__bot__') {
        const ownerTeam = this.getUnitTeam(ownerId);
        if (targetId.startsWith('bot-')) {
            const bot = this.bots.get(targetId);
            if (!bot) return;
            const remainingHp = bot.takeDamage(damage);
            if (remainingHp <= 0) {
                this.scheduleRespawnWave(bot.team);
                if (this.gameMode === 'tdm' && ownerTeam && ownerTeam !== bot.team) {
                    this.teamScores[ownerTeam] = Math.min(this.teamScores.scoreToWin, this.teamScores[ownerTeam] + 1);
                    if (this.teamScores[ownerTeam] >= this.teamScores.scoreToWin) {
                        this.teamScores.winner = ownerTeam;
                    }
                }
            }
            this.confirmHitForOwner(ownerId, remainingHp, bot.maxHp);
            return;
        }

        const hitSection = section === '__bot__' ? 'centerTorso' : section;

        if (targetId === this.getLocalUnitId()) {
            const result = this.golem.applySectionDamage(hitSection, damage);
            this.mechCamera.onHit(damage);
            if (result.lethal) {
                this.queueLocalRespawn();
                if (this.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
                    this.teamScores[ownerTeam] = Math.min(this.teamScores.scoreToWin, this.teamScores[ownerTeam] + 1);
                    if (this.teamScores[ownerTeam] >= this.teamScores.scoreToWin) {
                        this.teamScores.winner = ownerTeam;
                    }
                }
            }
            this.confirmHitForOwner(ownerId, result.totalHp, this.golem.maxHp);
            return;
        }

        const player = this.remotePlayers.get(targetId);
        if (!player) return;
        const result = player.applySectionDamage(hitSection, damage);
        if (result.lethal) {
            this.queueRemoteRespawn(targetId);
            if (this.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
                this.teamScores[ownerTeam] = Math.min(this.teamScores.scoreToWin, this.teamScores[ownerTeam] + 1);
                if (this.teamScores[ownerTeam] >= this.teamScores.scoreToWin) {
                    this.teamScores.winner = ownerTeam;
                }
            }
        }
        this.confirmHitForOwner(ownerId, result.totalHp, player.maxHp);
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            const remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
            this.remotePlayers.set(id, remoteGolem);

            if (this.sessionMode === 'host') {
                const spawnSlot = this.allocateRemoteSpawnSlot();
                this.remoteSpawnSlots.set(id, spawnSlot);
                this.setRemotePlayerState(id, { alive: true, timer: 0, slot: spawnSlot, team: 'blue' });
                const spawn = this.getTeamSpawn('blue', spawnSlot);
                const yaw = this.getSpawnYaw(spawn);
                this.placeGolemAtSpawn(remoteGolem, spawn, yaw);
                this.network.sendTo(id, { type: 'respawn', x: spawn.x, y: spawn.y, z: spawn.z, yaw, slot: spawnSlot });
                this.syncTeamBotRoster();
            } else if (this.sessionMode === 'client') {
                this.setRemotePlayerState(id, { alive: true, timer: 0, slot: 0, team: 'blue' });
                this.placeGolemAtSpawn(remoteGolem, this.getTeamSpawn('blue', 0));
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
            this.remotePlayerStates.delete(id);
            this.remoteSpawnSlots.delete(id);
            if (this.sessionMode === 'host') {
                this.syncTeamBotRoster();
            }
        };

        this.network.onData = (id, data) => {
            if (data.type === 'state' && !this.network.isHost) {
                if (data.props) {
                    this.world.propManager.applySnapshot(data.props);
                }
                if (data.points) {
                    this.controlPoints.setState(data.points);
                }
                if (data.scores) {
                    this.teamScores = data.scores;
                }
                if (data.mode === 'control' || data.mode === 'tdm') {
                    this.setGameMode(data.mode);
                }
                if (data.bots) {
                    this.applyBotSnapshots(data.bots);
                }
                
                if (data.players) {
                    for (const pid of this.remotePlayers.keys()) {
                        if (!data.players[pid]) {
                            const remoteGolem = this.remotePlayers.get(pid);
                            if (remoteGolem) {
                                this.renderer.scene.remove(remoteGolem.model);
                                this.physics.removeRigidBody(remoteGolem.body);
                                this.remotePlayers.delete(pid);
                            }
                            this.remotePlayerStates.delete(pid);
                        }
                    }

                    for (const pid in data.players) {
                        const pState = data.players[pid];
                        
                        if (pid === this.network.myId || (pid === LOCAL_PLAYER_ID && !this.network.myId)) {
                            this.localRespawnState.slot = typeof pState.slot === 'number' ? pState.slot : this.localRespawnState.slot;
                            this.localRespawnState.alive = pState.alive !== false;
                            this.localRespawnState.timer = typeof pState.respawnTimer === 'number' ? pState.respawnTimer : 0;
                            if (pState.hp !== undefined && this.golem.hp > pState.hp) {
                                this.mechCamera.onHit(this.golem.hp - pState.hp);
                            }
                            if (pState.sections) {
                                this.golem.setSectionState(pState.sections);
                            }
                            if (typeof pState.hp === 'number') {
                                this.golem.hp = pState.hp;
                            }
                            this.setGolemPresence(this.golem, this.localRespawnState.alive);
                            continue;
                        }
                        
                        let remoteGolem = this.remotePlayers.get(pid);
                        if (!remoteGolem) {
                            remoteGolem = new GolemController(this.renderer.scene, this.physics, false);
                            this.remotePlayers.set(pid, remoteGolem);
                            this.placeGolemAtSpawn(remoteGolem, new THREE.Vector3(pState.x, pState.y, pState.z), pState.ly ?? 0);
                        }

                        this.setRemotePlayerState(pid, {
                            alive: pState.alive !== false,
                            timer: typeof pState.respawnTimer === 'number' ? pState.respawnTimer : 0,
                            slot: typeof pState.slot === 'number' ? pState.slot : (this.remotePlayerStates.get(pid)?.slot ?? 1),
                            team: 'blue'
                        });
                        
                        remoteGolem.targetPos.set(pState.x, pState.y, pState.z);
                        remoteGolem.targetLegYaw = pState.ly ?? 0;
                        remoteGolem.targetTorsoYaw = pState.ty ?? 0;
                        if (pState.sections) {
                            if (typeof pState.hp === 'number' && remoteGolem.hp > pState.hp) {
                                remoteGolem.flashDamage();
                            }
                            remoteGolem.setSectionState(pState.sections);
                        } else if (pState.hp !== undefined) {
                            if (remoteGolem.hp > pState.hp) {
                                remoteGolem.flashDamage();
                            }
                            remoteGolem.hp = pState.hp;
                        }
                        this.setGolemPresence(remoteGolem, pState.alive !== false);
                    }
                }
            } else if (data.type === 'input' && this.network.isHost) {
                if (!this.remotePlayerStates.get(id)?.alive) return;
                const remoteGolem = this.remotePlayers.get(id);
                if (remoteGolem) {
                    remoteGolem.targetLegYaw = data.ly;
                    remoteGolem.targetTorsoYaw = data.ty;
                    remoteGolem.targetPos.set(data.pos.x, data.pos.y, data.pos.z);
                }
            } else if (data.type === 'respawn') {
                if (typeof data.slot === 'number') {
                    this.localRespawnState.slot = data.slot;
                }
                this.golem.body.setTranslation({ x: data.x, y: data.y, z: data.z }, true);
                this.golem.targetPos.set(data.x, data.y, data.z);
                if (typeof data.yaw === 'number') {
                    this.golem.legYaw = data.yaw;
                    this.golem.torsoYaw = data.yaw;
                    this.golem.targetLegYaw = data.yaw;
                    this.golem.targetTorsoYaw = data.yaw;
                    this.mechCamera.aimYaw = data.yaw;
                }
                this.localRespawnState.alive = true;
                this.localRespawnState.timer = 0;
                this.golem.resetSections();
                this.golem.steam = this.golem.maxSteam;
                this.golem.isOverheated = false;
                this.golem.overheatTimer = 0;
                this.setGolemPresence(this.golem, true);
                this.mechCamera.addTrauma(1.0); // Big shake on respawn
            } else if (data.type === 'fire') {
                if (id !== this.network.myId) {
                    const ownerId = this.network.isHost ? id : data.ownerId;
                    const shots: FireShotPayload[] = Array.isArray(data.shots)
                        ? data.shots
                        : [{
                            weaponId: 'rune_bolt',
                            profile: 'bolt',
                            ox: data.ox,
                            oy: data.oy,
                            oz: data.oz,
                            dx: data.dx,
                            dy: data.dy,
                            dz: data.dz,
                            damage: 15,
                            speed: 60,
                            range: 85
                        }];

                    for (const shot of shots) {
                        this.spawnShot(shot, ownerId);
                    }
                    this.playWeaponVolleyFx(shots);

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
        this.localRespawnState.slot = 1;
    }

    getInitialLocalSpawn() {
        return this.getTeamSpawn('blue', this.sessionMode === 'client' ? this.localRespawnState.slot : 0);
    }

    getPlayerSpawn(slot: number) {
        return this.getTeamSpawn('blue', slot);
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
        this.golem.model.visible = this.localRespawnState.alive && this.mechCamera.mode === 'thirdPerson';
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
        for (let slot = 1; slot < TEAM_SIZE; slot++) {
            if (![...this.remoteSpawnSlots.values()].includes(slot)) {
                return slot;
            }
        }
        return ((this.remotePlayers.size - 1) % Math.max(1, TEAM_SIZE - 1)) + 1;
    }

    registerHitConfirm(targetHp: number, targetMaxHp: number) {
        this.hitConfirmTimer = 0.22;
        this.hitTargetHp = Math.max(0, targetHp);
        this.hitTargetMaxHp = Math.max(1, targetMaxHp);
    }

    confirmHitForOwner(ownerId: string, targetHp: number, targetMaxHp: number) {
        if (!ownerId || ownerId.startsWith('bot-')) return;

        const isLocalShooter = this.sessionMode === 'solo'
            ? ownerId === this.getLocalUnitId()
            : ownerId === this.network.myId || ownerId === this.getLocalUnitId();

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

        this.remotePlayers.forEach((player, id) => {
            const pos = player.body.translation();
            const state = this.remotePlayerStates.get(id);
            if (state?.team === 'red' && state.alive) {
                pushContact(pos.x, pos.z, 'enemy');
            }
        });

        for (const bot of this.bots.values()) {
            if (bot.team === 'red' && bot.alive) {
                const pos = bot.body.translation();
                pushContact(pos.x, pos.z, 'bot');
            }
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

        const matchEnded = this.teamScores.winner !== null;

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
        const canControlLocal = this.localRespawnState.alive && !matchEnded;

        this.golem.update(
            dt,
            this.mechCamera.aimYaw,
            canControlLocal ? throttleInput : 0,
            canControlLocal ? turnInput : 0,
            canControlLocal ? centerTorso : false,
            canControlLocal ? stopThrottle : false,
            this.sounds,
            this.decals
        );
        
        const golemState = this.golem.getState();

        // Calculate torso turn speed for sounds
        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);
        
        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            if (state?.alive === false) return;
            player.update(dt, player.targetTorsoYaw, 0, 0, false, false, this.sounds, this.decals);
        });

        const authorityMode = this.sessionMode !== 'client';
        for (const bot of this.bots.values()) {
            const botPos = bot.body.translation();
            const movementTarget = authorityMode && !matchEnded
                ? this.gameMode === 'control'
                    ? this.getBotMovementTarget(bot.team, _botTarget.set(botPos.x, botPos.y, botPos.z))
                    : this.getNearestEnemyTarget(bot.team, _botTarget.set(botPos.x, botPos.y, botPos.z))
                : undefined;
            const engageTarget = authorityMode && !matchEnded
                ? this.getNearestEnemyTarget(bot.team, _botTarget.set(botPos.x, botPos.y, botPos.z), 58)
                : undefined;
            const botFireSolution = bot.update(dt, movementTarget ?? undefined, engageTarget ?? undefined, matchEnded);
            if (botFireSolution) {
                for (const shot of botFireSolution.shots) {
                    this.projectiles.fire({
                        origin: shot.origin,
                        dir: shot.dir,
                        ownerId: bot.id,
                        weaponId: shot.weaponId,
                        profile: shot.profile,
                        damage: shot.damage,
                        speed: shot.speed,
                        range: shot.range
                    });
                }
                this.playWeaponVolleyFx(botFireSolution.shots.map((shot) => ({
                    weaponId: shot.weaponId,
                    profile: shot.profile,
                    ox: shot.origin.x,
                    oy: shot.origin.y,
                    oz: shot.origin.z,
                    dx: shot.dir.x,
                    dy: shot.dir.y,
                    dz: shot.dir.z,
                    damage: shot.damage,
                    speed: shot.speed,
                    range: shot.range
                })));
            }
        }

        if (matchEnded) {
            this.haltHorizontalMotion(this.golem.body);
            this.remotePlayers.forEach((player) => this.haltHorizontalMotion(player.body));
            this.bots.forEach((bot) => this.haltHorizontalMotion(bot.body));
        } else {
            this.projectiles.update(dt);
        }
        this.decals.update(dt);
        
        this.getAimTargetPoint(_aimPoint);

        const fireGroup1 = this.input.consumeFireGroup(1);
        const fireGroup2 = this.input.consumeFireGroup(2);
        const fireGroup3 = this.input.consumeKey('KeyQ') || this.input.consumeFireGroup(3);
        const alphaStrike = this.input.consumeKey('KeyE') || this.input.consumeVirtualAction('alphaStrike');

        if (canControlLocal) {
            const localOwnerId = this.getLocalUnitId();
            if (fireGroup1) {
                this.fireWeaponRequests(localOwnerId, this.golem.tryFireGroup(1), _aimPoint);
            }
            if (fireGroup2) {
                this.fireWeaponRequests(localOwnerId, this.golem.tryFireGroup(2), _aimPoint);
            }
            if (fireGroup3) {
                this.fireWeaponRequests(localOwnerId, this.golem.tryFireGroup(3), _aimPoint);
            }
            if (alphaStrike) {
                this.fireWeaponRequests(localOwnerId, this.golem.tryFireAlpha(), _aimPoint);
            }
        }
        
        if (canControlLocal && (this.input.consumeKey('ShiftLeft') || this.input.consumeVirtualAction('dash'))) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
                this.mechCamera.onDash();
            }
        }
        
        if (canControlLocal && (this.input.consumeKey('Space') || this.input.consumeVirtualAction('vent'))) {
            if (this.golem.tryAction(0)) {
                this.golem.vent(this.particles);
                this.mechCamera.addTrauma(0.5);
            }
        }

        if (authorityMode && !matchEnded && this.gameMode === 'control') {
            this.controlPoints.update(dt, this.collectControlUnits());
            if (!this.teamScores.winner) {
                const scoreDelta = this.controlPoints.tickScore(dt);
                this.teamScores.blue += scoreDelta.blue;
                this.teamScores.red += scoreDelta.red;
                if (this.teamScores.blue >= this.teamScores.scoreToWin) {
                    this.teamScores.blue = this.teamScores.scoreToWin;
                    this.teamScores.winner = 'blue';
                } else if (this.teamScores.red >= this.teamScores.scoreToWin) {
                    this.teamScores.red = this.teamScores.scoreToWin;
                    this.teamScores.winner = 'red';
                }
            }
        }

        if (!matchEnded) {
            this.projectiles.checkCollisions(
                this.bots,
                this.remotePlayers, 
                this.golem, 
                this.getLocalUnitId(), 
                authorityMode,
                this.world.getCollisionMeshes(),
                this.world.propManager,
                this.decals,
                (unitId) => this.getUnitTeam(unitId),
                (targetId) => targetId === this.getLocalUnitId()
                    ? this.localRespawnState.alive
                    : (this.remotePlayerStates.get(targetId)?.alive ?? true),
                (ownerId, targetId, damage, section) => this.handlePlayerHit(ownerId, targetId, damage, section)
            );
            this.playProjectileImpactFx();

            this.playPropFx();
            this.updateRespawns(dt);
        }
        
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
                const playersState: any = {};
                playersState[this.getLocalUnitId()] = {
                    x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)),
                    ly: Number(this.golem.legYaw.toFixed(2)), ty: Number(this.golem.torsoYaw.toFixed(2)),
                    hp: this.golem.hp,
                    sections: { ...this.golem.sections },
                    alive: this.localRespawnState.alive,
                    respawnTimer: Number(this.localRespawnState.timer.toFixed(2)),
                    slot: this.localRespawnState.slot
                };
                
                this.remotePlayers.forEach((player, id) => {
                    const state = this.remotePlayerStates.get(id) ?? { alive: true, timer: 0, slot: this.remoteSpawnSlots.get(id) ?? 1, team: 'blue' as TeamId };
                    const pPos = player.body.translation();
                    playersState[id] = {
                        x: Number(pPos.x.toFixed(2)), y: Number(pPos.y.toFixed(2)), z: Number(pPos.z.toFixed(2)),
                        ly: Number(player.legYaw.toFixed(2)), ty: Number(player.torsoYaw.toFixed(2)),
                        hp: player.hp,
                        sections: { ...player.sections },
                        alive: state.alive,
                        respawnTimer: Number(state.timer.toFixed(2)),
                        slot: state.slot
                    };
                });
                
                this.network.broadcast({ 
                    type: 'state', 
                    players: playersState,
                    bots: this.buildBotSnapshots(),
                    mode: this.gameMode,
                    points: this.controlPoints.getSnapshot(),
                    scores: { ...this.teamScores },
                    props: this.world.propManager.getSnapshot()
                });
            } else if (this.sessionMode === 'client') {
                if (this.localRespawnState.alive && !matchEnded) {
                    this.network.sendToHost({
                        type: 'input',
                        pos: { x: pos.x, y: pos.y, z: pos.z },
                        ly: this.golem.legYaw,
                        ty: this.golem.torsoYaw
                    });
                }
            }
        }

        this.getAimTargetPoint(_aimPoint);
        _aimPoint.project(this.renderer.camera);

        const aimScreenX = THREE.MathUtils.clamp(_aimPoint.x, -1.2, 1.2);
        const aimScreenY = THREE.MathUtils.clamp(_aimPoint.y, -1.2, 1.2);

        this.onStateUpdate({
            hp: this.localRespawnState.alive ? this.golem.hp : 0,
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
            weaponStatus: golemState.weaponStatus,
            radarContacts: this.buildRadarContacts(),
            gameMode: this.gameMode,
            controlPoints: this.controlPoints.getSnapshot(),
            teamScores: { ...this.teamScores },
            teamOverview: this.getTeamOverview(),
            respawnTimer: this.localRespawnState.timer,
            terrainColliderMode: this.world.terrain.groundColliderMode,
            terrainColliderError: this.world.terrain.groundColliderError
        });

        this.renderer.render();
    }
}

export async function initGame(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void, sessionMode: SessionMode = 'solo', gameMode: GameMode = 'control') {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate, sessionMode, gameMode);
    game.start();
    return game;
}
