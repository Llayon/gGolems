import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { TeamId } from '../../gameplay/types';
import { createInitialMechSignatureState } from '../../mechs/runtimeTypes';

export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

export function runTest(name: string, test: () => void) {
    test();
    console.log(`PASS ${name}`);
}

export type FakeGolem = GolemController & {
    _translation?: { x: number; y: number; z: number };
    _presence?: boolean;
    _resetCount?: number;
    _lastHit?: { section: GolemSection; damage: number } | null;
    _sectionPatchCount?: number;
    _flashCount?: number;
    _recoilMounts?: string[];
};

export function createFakeGolem(options?: {
    maxHp?: number;
    hp?: number;
    lethalAtDamage?: number;
}) {
    const state = {
        position: { x: 0, y: 0, z: 0 },
        resetCount: 0,
        lastHit: null as { section: GolemSection; damage: number } | null,
        sectionPatchCount: 0,
        flashCount: 0,
        recoilMounts: [] as string[]
    };
    const maxHp = options?.maxHp ?? 100;
    let hp = options?.hp ?? maxHp;

    const golem = {
        maxHp,
        hp,
        maxSteam: 100,
        steam: 75,
        isOverheated: true,
        overheatTimer: 2.4,
        chassis: { id: 'kwii_strider' },
        loadout: { id: 'kwii_standard' },
        legYaw: 0,
        torsoYaw: 0,
        targetLegYaw: 0,
        targetTorsoYaw: 0,
        signatureState: createInitialMechSignatureState(),
        body: {
            setTranslation(next: { x: number; y: number; z: number }) {
                state.position = { ...next };
            }
        },
        targetPos: {
            set(x: number, y: number, z: number) {
                state.position = { x, y, z };
            }
        },
        setSectionState() {
            state.sectionPatchCount += 1;
        },
        flashDamage() {
            state.flashCount += 1;
        },
        getMountIdForWeapon() {
            return 'torsoMount';
        },
        triggerWeaponRecoil(mountId: string) {
            state.recoilMounts.push(mountId);
        },
        resetSections() {
            state.resetCount += 1;
            hp = maxHp;
            golem.hp = maxHp;
        },
        applySectionDamage(section: GolemSection, damage: number) {
            state.lastHit = { section, damage };
            hp = Math.max(0, hp - damage);
            golem.hp = hp;
            return {
                section,
                remaining: hp,
                destroyed: hp <= 0,
                lethal: hp <= 0,
                totalHp: hp
            };
        }
    } as unknown as FakeGolem;

    Object.defineProperty(golem, '_translation', { get: () => state.position });
    Object.defineProperty(golem, '_resetCount', { get: () => state.resetCount });
    Object.defineProperty(golem, '_lastHit', { get: () => state.lastHit });
    Object.defineProperty(golem, '_sectionPatchCount', { get: () => state.sectionPatchCount });
    Object.defineProperty(golem, '_flashCount', { get: () => state.flashCount });
    Object.defineProperty(golem, '_recoilMounts', { get: () => state.recoilMounts });

    return golem;
}

export function createFakeBot(team: TeamId, alive = false) {
    const bot = {
        team,
        alive,
        respawnTimer: 0,
        hp: alive ? 60 : 0,
        maxHp: 60,
        takeDamage(damage: number) {
            bot.hp = Math.max(0, bot.hp - damage);
            if (bot.hp <= 0) {
                bot.alive = false;
            }
            return bot.hp;
        },
        respawnAt(_spawn: { x: number; y: number; z: number }) {
            bot.alive = true;
            bot.respawnTimer = 0;
            bot.hp = bot.maxHp;
        }
    } as unknown as DummyBot;

    return bot;
}
