import type { GolemController } from '../../../entities/GolemController';
import type { TeamId } from '../../../gameplay/types';
import { scheduleRespawnWave, updateRespawns, type RespawnRuntimeContext } from '../../respawn/RespawnRuntime';
import { assert, createFakeBot, createFakeGolem, runTest, type FakeGolem } from '../smokeHelpers';

export function runRespawnTest() {
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
}
