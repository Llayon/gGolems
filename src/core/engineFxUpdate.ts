import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
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
import type { PropManager } from '../world/PropManager';
import type { EngineRuntimeAdapters } from './EngineRuntimeContexts';
import type { EngineSessionRuntimeAdapters } from './EngineSessionRuntimeAdapters';
import { updateProjectileCombat } from './combat/ProjectileCombatRuntime';
import { playProjectileImpactFx as playProjectileImpactFxRuntime } from './combat/ProjectileCombatFxRuntime';
import { playWorldPropFx as playWorldPropFxRuntime } from './world/WorldFxRuntime';
import { updateRespawns as updateRespawnsRuntime } from './respawn/RespawnRuntime';
import { updateControlMatch } from './match/MatchRuntime';

const RESPAWN_WAVE_DELAY = 8;
const _boilerPos = new THREE.Vector3();

export type CombatFxUpdateContext = {
    golem: GolemController;
    mechCamera: MechCamera;
    sounds: AudioManager;
    decals: DecalManager;
    debris: DebrisManager;
    particles: ParticleManager;
    atmosphere: AtmosphereManager;
    quality: QualityProfile;
    projectiles: ProjectileManager;
    controlPoints: ControlPointManager;
    propManager: PropManager;
    bots: Map<string, any>;
    remotePlayers: Map<string, GolemController>;
    remotePlayersAlive: () => Map<string, boolean>;
    localRespawnAlive: boolean;
    matchEnded: boolean;
    authorityMode: boolean;
    localPlayerId: string;
    runtimeAdapters: EngineRuntimeAdapters;
    sessionRuntimeAdapters: EngineSessionRuntimeAdapters;
};

export function updateCombatAndRespawn(ctx: CombatFxUpdateContext, dt: number) {
    if (ctx.matchEnded) return;

    updateProjectileCombat(ctx.runtimeAdapters.projectileCollision(ctx.authorityMode, ctx.localPlayerId));
    playProjectileImpactFxRuntime(ctx.runtimeAdapters.projectileImpactFx());

    playWorldPropFxRuntime({
        propManager: ctx.propManager,
        particles: ctx.particles,
        debris: ctx.debris,
        decals: ctx.decals,
        sounds: ctx.sounds,
        mechCamera: ctx.mechCamera,
        listenerPosition: ctx.golem.body.translation()
    });
    updateRespawnsRuntime(ctx.sessionRuntimeAdapters.respawn(), dt, RESPAWN_WAVE_DELAY);
}

export type ControlPointUpdateContext = {
    authorityMode: boolean;
    matchEnded: boolean;
    gameMode: string;
    controlPoints: ControlPointManager;
    teamScores: any;
    localPlayer: GolemController;
    localRespawnState: any;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, any>;
    bots: Map<string, any>;
};

export function updateControlPoints(ctx: ControlPointUpdateContext, dt: number) {
    if (!ctx.authorityMode || ctx.matchEnded || ctx.gameMode !== 'control') return;
    updateControlMatch({
        controlPoints: ctx.controlPoints,
        teamScores: ctx.teamScores,
        localPlayer: ctx.localPlayer,
        localRespawnState: ctx.localRespawnState,
        remotePlayers: ctx.remotePlayers,
        remotePlayerStates: ctx.remotePlayerStates,
        bots: ctx.bots
    }, dt);
}

export type ParticlesAndPropsContext = {
    golem: GolemController;
    particles: ParticleManager;
    debris: DebrisManager;
    atmosphere: AtmosphereManager;
    propManager: PropManager;
    quality: QualityProfile;
    localRespawnAlive: boolean;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, any>;
    bots: Map<string, any>;
    getBoilerTimer: () => number;
    setBoilerTimer: (value: number) => void;
};

export function updateParticlesAndProps(ctx: ParticlesAndPropsContext, dt: number) {
    let timer = ctx.getBoilerTimer() + dt;
    if (timer >= ctx.quality.boilerParticleInterval) {
        timer = 0;
        ctx.golem.boiler.getWorldPosition(_boilerPos);
        ctx.particles.emit(_boilerPos.x, _boilerPos.y + 0.5, _boilerPos.z);
    }
    ctx.setBoilerTimer(timer);
    ctx.particles.update(dt);
    ctx.debris.update(dt);
    ctx.atmosphere.update(dt);

    const propObservers: THREE.Vector3[] = [];
    if (ctx.localRespawnAlive) {
        const localPos = ctx.golem.body.translation();
        propObservers.push(new THREE.Vector3(localPos.x, localPos.y, localPos.z));
    }
    ctx.remotePlayers.forEach((player, id) => {
        const state = ctx.remotePlayerStates.get(id);
        if (state && !state.alive) return;
        const pos = player.body.translation();
        propObservers.push(new THREE.Vector3(pos.x, pos.y, pos.z));
    });
    for (const bot of ctx.bots.values()) {
        if (!bot.alive) continue;
        const pos = bot.body.translation();
        propObservers.push(new THREE.Vector3(pos.x, pos.y, pos.z));
    }
    ctx.propManager.update(dt, propObservers);
}
