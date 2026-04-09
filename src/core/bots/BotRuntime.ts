import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { DummyBot } from '../../entities/DummyBot';
import type { BotStateView, GameMode, TeamId } from '../../gameplay/types';
import type { ProjectileProfileId, WeaponId } from '../../combat/weaponTypes';
import type { FireShotPayload } from '../combat/ProjectileCombatRuntime';

const _botRuntimeTarget = new THREE.Vector3();

export type BotShotView = {
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    weaponId: WeaponId;
    profile: ProjectileProfileId;
    damage: number;
    speed: number;
    range: number;
};

export type BotRuntimeContext = {
    bots: Map<string, DummyBot>;
    sessionMode: 'solo' | 'host' | 'client';
    teamSize: number;
    localRespawnSlot: number;
    remoteSpawnSlots: Map<string, number>;
    createBot: (id: string, team: TeamId, slot: number) => DummyBot;
    destroyBot: (id: string) => void;
    getMovementTarget: (botId: string, team: TeamId, from: THREE.Vector3, gameMode: GameMode) => THREE.Vector3 | null;
    getEngageTarget: (team: TeamId, from: THREE.Vector3, maxDistance: number) => THREE.Vector3 | null;
    fireShot: (shot: BotShotView, ownerId: string) => void;
    playWeaponVolleyFx: (shots: FireShotPayload[]) => void;
    haltHorizontalMotion: (body: RAPIER.RigidBody) => void;
};

export function syncTeamBotRoster(context: BotRuntimeContext) {
    if (context.sessionMode === 'client') return;

    const desired = new Map<string, { team: TeamId; slot: number }>();
    const occupiedBlueSlots = new Set<number>([context.localRespawnSlot, ...context.remoteSpawnSlots.values()]);

    for (let slot = 0; slot < context.teamSize; slot++) {
        if (!occupiedBlueSlots.has(slot)) {
            desired.set(`bot-blue-${slot}`, { team: 'blue', slot });
        }
    }

    for (let slot = 0; slot < context.teamSize; slot++) {
        desired.set(`bot-red-${slot}`, { team: 'red', slot });
    }

    for (const [id] of context.bots) {
        if (!desired.has(id)) {
            context.destroyBot(id);
        }
    }

    for (const [id, info] of desired) {
        if (!context.bots.has(id)) {
            context.createBot(id, info.team, info.slot);
        }
    }
}

export function buildBotSnapshots(bots: Map<string, DummyBot>): BotStateView[] {
    return [...bots.values()].map((bot) => {
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

export function applyBotSnapshots(context: Pick<BotRuntimeContext, 'bots' | 'createBot' | 'destroyBot'>, botStates: BotStateView[]) {
    const nextIds = new Set(botStates.map((entry) => entry.id));

    for (const [id] of context.bots) {
        if (!nextIds.has(id)) {
            context.destroyBot(id);
        }
    }

    for (const botState of botStates) {
        let bot = context.bots.get(botState.id);
        if (!bot) {
            bot = context.createBot(botState.id, botState.team, 0);
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

export function updateBots(
    context: BotRuntimeContext,
    dt: number,
    gameMode: GameMode,
    matchEnded: boolean
) {
    const authorityMode = context.sessionMode !== 'client';

    for (const bot of context.bots.values()) {
        const botPos = bot.body.translation();
        const from = _botRuntimeTarget.set(botPos.x, botPos.y, botPos.z);
        const movementTarget = authorityMode && !matchEnded
            ? context.getMovementTarget(bot.id, bot.team, from, gameMode)
            : undefined;
        const engageTarget = authorityMode && !matchEnded
            ? context.getEngageTarget(bot.team, from, 58)
            : undefined;

        const botFireSolution = bot.update(dt, movementTarget ?? undefined, engageTarget ?? undefined, matchEnded);
        if (botFireSolution) {
            for (const shot of botFireSolution.shots) {
                context.fireShot(shot, bot.id);
            }
            context.playWeaponVolleyFx(botFireSolution.shots.map((shot) => ({
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
        context.bots.forEach((bot) => context.haltHorizontalMotion(bot.body));
    }
}
