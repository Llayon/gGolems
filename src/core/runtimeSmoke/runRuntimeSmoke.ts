import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { TeamId, TeamScoreState } from '../../gameplay/types';
import {
    dispatchNetworkDataMessage,
    type NetworkDataDispatchContext
} from '../network/NetworkMessageRuntime';
import {
    scheduleRespawnWave,
    updateRespawns,
    type RespawnRuntimeContext
} from '../respawn/RespawnRuntime';
import {
    handlePlayerHit,
    type PlayerHitRuntimeContext
} from '../combat/PlayerHitRuntime';
import {
    syncTeamBotRoster,
    type BotRuntimeContext
} from '../bots/BotRuntime';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function runTest(name: string, test: () => void) {
    test();
    console.log(`PASS ${name}`);
}

type FakeGolem = GolemController & {
    _translation?: { x: number; y: number; z: number };
    _presence?: boolean;
    _resetCount?: number;
    _lastHit?: { section: GolemSection; damage: number } | null;
};

function createFakeGolem(options?: {
    maxHp?: number;
    hp?: number;
    lethalAtDamage?: number;
}) {
    const state = {
        position: { x: 0, y: 0, z: 0 },
        resetCount: 0,
        lastHit: null as { section: GolemSection; damage: number } | null
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
        legYaw: 0,
        torsoYaw: 0,
        targetLegYaw: 0,
        targetTorsoYaw: 0,
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
        },
        _translation: state.position,
        _presence: true,
        _resetCount: state.resetCount,
        _lastHit: state.lastHit
    } as unknown as FakeGolem;

    Object.defineProperty(golem, '_translation', { get: () => state.position });
    Object.defineProperty(golem, '_resetCount', { get: () => state.resetCount });
    Object.defineProperty(golem, '_lastHit', { get: () => state.lastHit });

    return golem;
}

function createFakeBot(team: TeamId, alive = false) {
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

runTest('network dispatcher routes message types to the correct handlers', () => {
    const calls: string[] = [];
    const context: NetworkDataDispatchContext = {
        isHost: true,
        onStateMessage: () => calls.push('state'),
        onClientInputPacket: () => calls.push('clientInput'),
        onRestartRequest: () => calls.push('restartRequest'),
        onRespawnMessage: () => calls.push('respawn'),
        onRestartMatchMessage: () => calls.push('restartMatch'),
        onRemoteFireMessage: () => calls.push('fire'),
        onHitConfirmMessage: () => calls.push('hitConfirm')
    };

    dispatchNetworkDataMessage(context, 'peer-a', { type: 'state' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'noop' }, { type: 'input', pos: { x: 0, y: 0, z: 0 }, ly: 0, ty: 0, chassisId: 'kwii_strider', loadoutId: 'kwii_standard' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'restartRequest' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'respawn' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'restartMatch' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'fire' });
    dispatchNetworkDataMessage(context, 'peer-a', { type: 'hitConfirm' });

    assert(calls.join(',') === 'clientInput,restartRequest,respawn,restartMatch,fire,hitConfirm', 'unexpected network dispatch order');
});

runTest('respawn runtime resolves a blue wave for local, remote, and bot units', () => {
    const local = createFakeGolem();
    const remote = createFakeGolem();
    const blueBot = createFakeBot('blue', false);
    const remotePlayerStates = new Map([
        ['peer-1', { team: 'blue' as TeamId, alive: false, timer: 0, slot: 1 }]
    ]);
    const remotePlayers = new Map([
        ['peer-1', remote as unknown as GolemController]
    ]);
    const bots = new Map([
        ['bot-blue-2', blueBot]
    ]);
    const sentRespawns: Array<{ id: string; slot: number }> = [];

    const context: RespawnRuntimeContext = {
        sessionMode: 'host',
        localRespawnState: { alive: false, timer: 0, slot: 0 },
        remotePlayerStates,
        respawnWaves: { blue: 0, red: 0 },
        remoteSpawnSlots: new Map([['peer-1', 1]]),
        bots,
        remotePlayers,
        golem: local as unknown as GolemController,
        mechCamera: { addTrauma: () => undefined } as any,
        getTeamSpawn: (_team, slot) => ({ x: slot * 10, y: 1, z: slot * -5 }),
        getSpawnYaw: () => 1.25,
        placeGolemAtSpawn: (golem, spawn, yaw) => {
            golem.body.setTranslation(spawn, true);
            golem.targetPos.set(spawn.x, spawn.y, spawn.z);
            if (typeof yaw === 'number') {
                golem.legYaw = yaw;
                golem.torsoYaw = yaw;
                golem.targetLegYaw = yaw;
                golem.targetTorsoYaw = yaw;
            }
        },
        setGolemPresence: (golem, alive) => {
            (golem as FakeGolem)._presence = alive;
        },
        setRemotePlayerState: (id, patch) => {
            const current = remotePlayerStates.get(id);
            if (current) remotePlayerStates.set(id, { ...current, ...patch });
        },
        sendRemoteRespawn: (id, payload) => {
            sentRespawns.push({ id, slot: payload.slot });
        }
    };

    scheduleRespawnWave(context, 'blue', 1);
    updateRespawns(context, 1.1, 8);

    assert(context.localRespawnState.alive === true, 'local player should respawn on blue wave');
    assert(remotePlayerStates.get('peer-1')?.alive === true, 'remote blue player should respawn on blue wave');
    assert(sentRespawns.length === 1 && sentRespawns[0].id === 'peer-1', 'remote respawn should be broadcast');
    assert((local as FakeGolem)._presence === true && (remote as FakeGolem)._presence === true, 'golems should be marked alive after respawn');
    assert((blueBot as any).alive === true, 'blue bot should respawn on blue wave');
});

runTest('player hit runtime applies lethal remote damage and awards TDM score', () => {
    const remote = createFakeGolem({ maxHp: 40, hp: 20 });
    const scores: TeamScoreState = { blue: 0, red: 0, scoreToWin: 10, winner: null };
    const queued: string[] = [];
    const confirms: Array<{ ownerId: string; hp: number; maxHp: number }> = [];

    const context: PlayerHitRuntimeContext = {
        bots: new Map(),
        remotePlayers: new Map([['remote-blue', remote as unknown as GolemController]]),
        localPlayer: createFakeGolem() as unknown as GolemController,
        mechCamera: { onHit: () => undefined } as any,
        gameMode: 'tdm',
        teamScores: scores,
        localPlayerId: 'local-player',
        getUnitTeam: (id) => id === 'enemy-red' ? 'red' : 'blue',
        queueLocalRespawn: () => queued.push('local'),
        queueRemoteRespawn: (id) => queued.push(id),
        scheduleRespawnWave: () => undefined,
        confirmHitForOwner: (ownerId, hp, maxHp) => confirms.push({ ownerId, hp, maxHp })
    };

    handlePlayerHit(context, 'enemy-red', 'remote-blue', 25, 'centerTorso');

    assert(queued.includes('remote-blue'), 'lethal remote hit should queue remote respawn');
    assert(scores.red === 1 && scores.winner === null, 'enemy team should gain one TDM score');
    assert(confirms.length === 1 && confirms[0].hp === 0, 'owner should receive lethal hit confirm');
});

runTest('bot roster sync creates missing team bots and removes obsolete ones', () => {
    const bots = new Map<string, DummyBot>();
    bots.set('bot-blue-9', createFakeBot('blue', true));
    const created: string[] = [];
    const destroyed: string[] = [];

    const context: BotRuntimeContext = {
        bots,
        sessionMode: 'host',
        teamSize: 3,
        localRespawnSlot: 0,
        remoteSpawnSlots: new Map([['peer-1', 1]]),
        createBot: (id, team) => {
            created.push(id);
            const bot = createFakeBot(team, true);
            bots.set(id, bot);
            return bot;
        },
        destroyBot: (id) => {
            destroyed.push(id);
            bots.delete(id);
        },
        getMovementTarget: () => null,
        getEngageTarget: () => null,
        fireShot: () => undefined,
        playWeaponVolleyFx: () => undefined,
        haltHorizontalMotion: () => undefined
    };

    syncTeamBotRoster(context);

    assert(destroyed.includes('bot-blue-9'), 'obsolete bot should be destroyed');
    assert(created.includes('bot-blue-2'), 'free blue slot should create replacement bot');
    assert(created.includes('bot-red-0') && created.includes('bot-red-1') && created.includes('bot-red-2'), 'red team roster should be filled');
});

console.log('Runtime smoke completed successfully.');
