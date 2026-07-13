import * as THREE from 'three';
import type { DummyBot } from '../../entities/DummyBot';
import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { TeamId } from '../../gameplay/types';

export type SplashDamageContext = {
    point: THREE.Vector3;
    radius: number;
    splashFalloff: number;
    baseDamage: number;
    ownerId: string;
    ownerTeam: TeamId | null;
    excludeTargetId?: string;
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    localPlayer: GolemController;
    localPlayerId: string;
    isHost: boolean;
    getUnitTeam: (id: string) => TeamId | null;
    isTargetAlive: (id: string) => boolean;
    onPlayerHit: (ownerId: string, targetId: string, damage: number, section: GolemSection | '__bot__') => void;
};

function computeSplashDamage(distance: number, radius: number, baseDamage: number, splashFalloff: number): number {
    if (distance >= radius) return 0;
    if (distance <= 0) return Math.max(1, Math.round(baseDamage));
    const t = distance / radius;
    const scale = 1 - t * (1 - splashFalloff);
    return Math.max(1, Math.round(baseDamage * Math.max(splashFalloff, scale)));
}

export function applySplashDamage(ctx: SplashDamageContext): number {
    if (ctx.radius <= 0) return 0;
    let hitsCount = 0;
    const radiusSq = ctx.radius * ctx.radius;

    const localPos = ctx.localPlayer.body.translation();
    const localDistanceSq = Math.max(0, ctx.point.distanceToSquared(localPos));
    if (
        ctx.localPlayerId !== ctx.ownerId &&
        ctx.localPlayerId !== ctx.excludeTargetId &&
        ctx.isTargetAlive(ctx.localPlayerId) &&
        ctx.getUnitTeam(ctx.localPlayerId) !== ctx.ownerTeam &&
        localDistanceSq <= radiusSq
    ) {
        const damage = computeSplashDamage(Math.sqrt(localDistanceSq), ctx.radius, ctx.baseDamage, ctx.splashFalloff);
        if (damage > 0 && ctx.isHost) {
            ctx.onPlayerHit(ctx.ownerId, ctx.localPlayerId, damage, 'centerTorso');
            hitsCount += 1;
        }
    }

    ctx.remotePlayers.forEach((player, id) => {
        if (id === ctx.ownerId || id === ctx.excludeTargetId) return;
        if (!ctx.isTargetAlive(id)) return;
        if (ctx.getUnitTeam(id) === ctx.ownerTeam) return;
        const pos = player.body.translation();
        const distanceSq = Math.max(0, ctx.point.distanceToSquared(pos));
        if (distanceSq > radiusSq) return;
        const damage = computeSplashDamage(Math.sqrt(distanceSq), ctx.radius, ctx.baseDamage, ctx.splashFalloff);
        if (damage > 0 && ctx.isHost) {
            ctx.onPlayerHit(ctx.ownerId, id, damage, 'centerTorso');
            hitsCount += 1;
        }
    });

    ctx.bots.forEach((bot, id) => {
        if (id === ctx.ownerId || id === ctx.excludeTargetId) return;
        if (!bot.alive) return;
        if (bot.team === ctx.ownerTeam) return;
        const pos = bot.body.translation();
        const distanceSq = Math.max(0, ctx.point.distanceToSquared(pos));
        if (distanceSq > radiusSq) return;
        const damage = computeSplashDamage(Math.sqrt(distanceSq), ctx.radius, ctx.baseDamage, ctx.splashFalloff);
        if (damage > 0 && ctx.isHost) {
            ctx.onPlayerHit(ctx.ownerId, id, damage, '__bot__');
            hitsCount += 1;
        }
    });

    return hitsCount;
}