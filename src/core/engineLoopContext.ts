import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { MechCamera } from '../camera/MechCamera';
import type { AudioManager } from './AudioManager';
import type { DecalManager } from '../fx/DecalManager';
import type { DebrisManager } from '../fx/DebrisManager';
import type { ParticleManager } from '../fx/ParticleManager';
import type { AtmosphereManager } from '../fx/AtmosphereManager';
import type { QualityProfile } from '../utils/quality';
import type { ProjectileManager } from '../combat/ProjectileManager';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { Arena } from '../world/Arena';
import type { Renderer } from './Renderer';
import type { InputManager } from './InputManager';
import type { NetworkManager } from '../network/NetworkManager';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';
import type { EngineRuntimeAdapters } from './EngineRuntimeContexts';
import type { EngineSessionRuntimeAdapters } from './EngineSessionRuntimeAdapters';
import type { GameHudState } from './gameHudState';
import type { TerrainBuilder } from '../world/TerrainBuilder';

export type GameSources = {
    golem: GolemController;
    renderer: Renderer;
    world: Arena;
    input: InputManager;
    network: NetworkManager;
    mechCamera: MechCamera;
    sounds: AudioManager;
    decals: DecalManager;
    debris: DebrisManager;
    particles: ParticleManager;
    atmosphere: AtmosphereManager;
    quality: QualityProfile;
    projectiles: ProjectileManager;
    controlPoints: ControlPointManager;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    localRespawnState: PlayerRespawnState;
    bots: Map<string, any>;
    sessionMode: 'solo' | 'host' | 'client';
    gameMode: GameMode;
    teamScores: TeamScoreState;
    hitConfirmTimer: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    boilerParticleTimer: number;
    networkTickTimer: number;
    runtimeAdapters: EngineRuntimeAdapters;
    sessionRuntimeAdapters: EngineSessionRuntimeAdapters;
    onStateUpdate: (state: GameHudState) => void;
    haltHorizontalMotion: (body: any) => void;
    getLocalUnitId: () => string;
    getAimTargetPoint: (out: THREE.Vector3) => THREE.Vector3;
};

export type EngineLoopContext = {
    mechContext: () => any;
    combatContext: () => any;
    controlPointContext: () => any;
    particlesContext: () => any;
    networkContext: () => any;
    hudContext: () => any;
    inputContext: () => any;
};

export function buildLoopContext(g: GameSources): EngineLoopContext {
    return {
        mechContext: () => ({
            golem: g.golem,
            remotePlayers: g.remotePlayers,
            remotePlayerStates: g.remotePlayerStates,
            input: g.input,
            mechCamera: g.mechCamera,
            sounds: g.sounds,
            decals: g.decals,
            projectiles: g.projectiles,
            localRespawnAlive: g.localRespawnState.alive,
            matchEnded: g.teamScores.winner !== null,
            haltHorizontalMotion: g.haltHorizontalMotion
        }),
        combatContext: () => ({
            golem: g.golem,
            mechCamera: g.mechCamera,
            sounds: g.sounds,
            decals: g.decals,
            debris: g.debris,
            particles: g.particles,
            atmosphere: g.atmosphere,
            quality: g.quality,
            projectiles: g.projectiles,
            controlPoints: g.controlPoints,
            propManager: g.world.propManager,
            bots: g.bots,
            remotePlayers: g.remotePlayers,
            remotePlayersAlive: () => new Map(),
            localRespawnAlive: g.localRespawnState.alive,
            matchEnded: g.teamScores.winner !== null,
            authorityMode: g.sessionMode !== 'client',
            localPlayerId: g.getLocalUnitId(),
            runtimeAdapters: g.runtimeAdapters,
            sessionRuntimeAdapters: g.sessionRuntimeAdapters
        }),
        controlPointContext: () => ({
            authorityMode: g.sessionMode !== 'client',
            matchEnded: g.teamScores.winner !== null,
            gameMode: g.gameMode,
            controlPoints: g.controlPoints,
            teamScores: g.teamScores,
            localPlayer: g.golem,
            localRespawnState: g.localRespawnState,
            remotePlayers: g.remotePlayers,
            remotePlayerStates: g.remotePlayerStates,
            bots: g.bots
        }),
        particlesContext: () => ({
            golem: g.golem,
            particles: g.particles,
            debris: g.debris,
            atmosphere: g.atmosphere,
            propManager: g.world.propManager,
            quality: g.quality,
            localRespawnAlive: g.localRespawnState.alive,
            remotePlayers: g.remotePlayers,
            remotePlayerStates: g.remotePlayerStates,
            bots: g.bots,
            getBoilerTimer: () => g.boilerParticleTimer,
            setBoilerTimer: (value: number) => { g.boilerParticleTimer = value; }
        }),
        networkContext: () => ({
            sessionMode: g.sessionMode,
            network: g.network,
            networkTickTimer: { value: g.networkTickTimer },
            gameMode: g.gameMode,
            teamScores: g.teamScores,
            controlPoints: g.controlPoints,
            propManager: g.world.propManager,
            bots: g.bots,
            golem: g.golem,
            localRespawnState: g.localRespawnState,
            remotePlayers: g.remotePlayers,
            remotePlayerStates: g.remotePlayerStates,
            remoteSpawnSlots: g.remoteSpawnSlots,
            getLocalUnitId: () => g.getLocalUnitId()
        }),
        hudContext: () => ({
            golem: g.golem,
            mechCamera: g.mechCamera,
            controlPoints: g.controlPoints,
            renderer: g.renderer,
            bots: g.bots,
            remotePlayers: g.remotePlayers,
            remotePlayerStates: g.remotePlayerStates,
            localRespawnState: g.localRespawnState,
            gameMode: g.gameMode,
            teamScores: g.teamScores,
            hitConfirmTimer: g.hitConfirmTimer,
            hitTargetHp: g.hitTargetHp,
            hitTargetMaxHp: g.hitTargetMaxHp,
            terrain: g.world.terrain,
            getAimTargetPoint: (out: THREE.Vector3) => g.getAimTargetPoint(out),
            onStateUpdate: g.onStateUpdate
        }),
        inputContext: () => ({
            golem: g.golem,
            input: g.input,
            mechCamera: g.mechCamera,
            particles: g.particles,
            canControlLocal: g.localRespawnState.alive && g.teamScores.winner === null,
            getLocalUnitId: () => g.getLocalUnitId(),
            getAimTargetPoint: (out: THREE.Vector3) => g.getAimTargetPoint(out),
            weaponFireContext: g.runtimeAdapters.weaponFire()
        })
    };
}
