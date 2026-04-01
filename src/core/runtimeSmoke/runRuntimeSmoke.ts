import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { TeamId, TeamScoreState } from '../../gameplay/types';
import {
    applyAuthoritativeStateMessage,
    dispatchNetworkDataMessage,
    type AuthoritativeStateRuntimeContext,
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
import type { RemotePlayerLifecycleContext } from '../network/RemotePlayerLifecycleRuntime';
import {
    applyRemoteFire,
    type FireShotPayload,
    type RemoteFireRuntimeContext
} from '../combat/ProjectileCombatRuntime';

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
    _sectionPatchCount?: number;
    _flashCount?: number;
    _recoilMounts?: string[];
};

function createFakeGolem(options?: {
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
        },
        _translation: state.position,
        _presence: true,
        _resetCount: state.resetCount,
        _lastHit: state.lastHit,
        _sectionPatchCount: state.sectionPatchCount,
        _flashCount: state.flashCount,
        _recoilMounts: state.recoilMounts
    } as unknown as FakeGolem;

    Object.defineProperty(golem, '_translation', { get: () => state.position });
    Object.defineProperty(golem, '_resetCount', { get: () => state.resetCount });
    Object.defineProperty(golem, '_lastHit', { get: () => state.lastHit });
    Object.defineProperty(golem, '_sectionPatchCount', { get: () => state.sectionPatchCount });
    Object.defineProperty(golem, '_flashCount', { get: () => state.flashCount });
    Object.defineProperty(golem, '_recoilMounts', { get: () => state.recoilMounts });

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

runTest('authoritative state runtime reconciles local and remote players', () => {
    const local = createFakeGolem({ maxHp: 100, hp: 90 });
    const remotePlayers = new Map<string, GolemController>();
    const remotePlayerStates = new Map<string, { team: TeamId; alive: boolean; timer: number; slot: number }>();
    const created: string[] = [];
    const removed: string[] = [];
    const setScores: TeamScoreState[] = [];
    const appliedBotSnapshots: any[] = [];
    const pointStates: any[] = [];
    const propSnapshots: any[] = [];

    const lifecycle: RemotePlayerLifecycleContext = {
        remotePlayers,
        createRemoteGolem: (options) => {
            created.push(`${options?.chassisId}:${options?.loadoutId}`);
            return createFakeGolem() as unknown as GolemController;
        },
        disposeRemoteGolem: () => undefined,
        placeGolemAtSpawn: (golem, snapshot, yaw) => {
            golem.body.setTranslation(snapshot, true);
            if (typeof yaw === 'number') {
                golem.legYaw = yaw;
                golem.torsoYaw = yaw;
            }
        },
        setGolemPresence: (golem, alive) => {
            (golem as FakeGolem)._presence = alive;
        }
    };

    const context: AuthoritativeStateRuntimeContext = {
        propManager: { applySnapshot: (snapshot) => propSnapshots.push(snapshot) },
        controlPoints: { setState: (state) => pointStates.push(state) },
        setTeamScores: (scores) => setScores.push(scores),
        setGameMode: () => undefined,
        applyBotSnapshots: (botStates) => appliedBotSnapshots.push(botStates),
        lifecycle,
        remotePlayerStates: remotePlayerStates as any,
        setRemotePlayerState: (id, patch) => {
            const current = remotePlayerStates.get(id) ?? { team: 'blue' as TeamId, alive: true, timer: 0, slot: 0 };
            remotePlayerStates.set(id, { ...current, ...patch });
        },
        getLocalUnitId: () => 'local-player',
        localPlayer: local as unknown as GolemController,
        mechCamera: { onHit: () => undefined } as any,
        localRespawnState: { alive: true, timer: 0, slot: 0 },
        setGolemPresence: (golem, alive) => {
            (golem as FakeGolem)._presence = alive;
        }
    };

    applyAuthoritativeStateMessage(context, {
        props: { structures: 1 },
        points: { blue: 1 },
        scores: { blue: 3, red: 2, scoreToWin: 200, winner: null },
        bots: [{ id: 'bot-red-0', team: 'red', x: 0, y: 0, z: 0, yaw: 0, hp: 60, maxHp: 60, alive: true, respawnTimer: 0 }],
        players: {
            'local-player': {
                x: 1, y: 2, z: 3, ly: 0.1, ty: 0.2, chassisId: 'kwii_strider', loadoutId: 'kwii_standard',
                hp: 70, sections: { head: 18, centerTorso: 48, leftTorso: 34, rightTorso: 34, leftArm: 24, rightArm: 24, leftLeg: 36, rightLeg: 36 },
                alive: true, respawnTimer: 0, slot: 0
            },
            'peer-1': {
                x: 4, y: 5, z: 6, ly: 0.3, ty: 0.4, chassisId: 'kwii_strider', loadoutId: 'kwii_standard',
                hp: 50, sections: { head: 10, centerTorso: 40, leftTorso: 30, rightTorso: 30, leftArm: 20, rightArm: 20, leftLeg: 28, rightLeg: 28 },
                alive: true, respawnTimer: 0, slot: 1
            }
        }
    });

    assert(propSnapshots.length === 1, 'authoritative state should apply prop snapshot');
    assert(pointStates.length === 1, 'authoritative state should apply point state');
    assert(setScores.length === 1 && setScores[0].blue === 3, 'authoritative state should update scores');
    assert(appliedBotSnapshots.length === 1, 'authoritative state should forward bot snapshots');
    assert((local as FakeGolem)._sectionPatchCount === 1, 'local player sections should be patched');
    assert(local.hp === 70, 'local player HP should sync from authoritative state');
    assert(remotePlayers.has('peer-1'), 'remote player should be created from authoritative snapshot');
    assert(created.length === 1, 'remote lifecycle should create one remote player');
    const remote = remotePlayers.get('peer-1') as FakeGolem | undefined;
    assert(Boolean(remote), 'remote golem should exist after authoritative apply');
    assert((remote?._sectionPatchCount ?? 0) >= 1, 'remote player sections should be patched');
    assert(remote?.hp === 50, 'remote player HP should sync from authoritative state');
    assert(remotePlayerStates.get('peer-1')?.slot === 1, 'remote player slot should sync');
});

runTest('remote fire runtime spawns projectiles and applies recoil to the remote owner', () => {
    const remote = createFakeGolem();
    const fired: Array<{ ownerId: string; weaponId: string }> = [];
    const volleys: number[] = [];
    const shots: FireShotPayload[] = [{
        weaponId: 'rune_bolt',
        mountId: 'leftArmMount',
        profile: 'bolt',
        ox: 1,
        oy: 2,
        oz: 3,
        dx: 0,
        dy: 0,
        dz: -1,
        damage: 15,
        speed: 60,
        range: 85
    }];

    const context: RemoteFireRuntimeContext = {
        projectiles: {
            fire(payload: any) {
                fired.push({ ownerId: payload.ownerId, weaponId: payload.weaponId });
            }
        } as any,
        remotePlayers: new Map([['peer-1', remote as unknown as GolemController]]),
        playWeaponVolleyFx: (nextShots) => {
            volleys.push(nextShots.length);
        }
    };

    applyRemoteFire(context, 'peer-1', shots);

    assert(fired.length === 1 && fired[0].ownerId === 'peer-1', 'remote fire should spawn projectile for owner');
    assert((remote as FakeGolem)._recoilMounts?.includes('leftArmMount'), 'remote fire should trigger remote recoil');
    assert(volleys.length === 1 && volleys[0] === 1, 'remote fire should trigger volley FX');
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
