import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { DummyBot } from '../entities/DummyBot';
import type { TeamId } from '../gameplay/types';
import type { BotIntent } from './bots/BotObjectiveSystem';

export type BotSpawnContext = {
    scene: THREE.Scene;
    physics: RAPIER.World;
    bots: Map<string, DummyBot>;
    sessionMode: 'solo' | 'host' | 'client';
    surfaceY: (x: number, z: number) => number;
    spawnRadius: number;
};

export function createBot(
    ctx: BotSpawnContext,
    id: string,
    team: TeamId,
    spawn: { x: number; y: number; z: number }
): DummyBot {
    const bot = new DummyBot(
        ctx.scene,
        ctx.physics,
        id,
        team,
        spawn.x,
        spawn.y,
        spawn.z,
        ctx.sessionMode !== 'client',
        ctx.surfaceY
    );
    bot.respawnRadius = ctx.spawnRadius;
    ctx.bots.set(id, bot);
    return bot;
}

export function destroyBot(ctx: BotSpawnContext, id: string) {
    const bot = ctx.bots.get(id);
    if (!bot) return;
    ctx.scene.remove(bot.mesh);
    ctx.physics.removeRigidBody(bot.body);
    ctx.bots.delete(id);
}

export function setBotIntent(bots: Map<string, DummyBot>, botId: string, intent: BotIntent) {
    bots.get(botId)?.setIntent(intent);
}
