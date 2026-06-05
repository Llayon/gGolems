import type { GolemController } from '../../../entities/GolemController';
import type { TeamId, TeamScoreState } from '../../../gameplay/types';
import { applyAuthoritativeStateMessage, type AuthoritativeStateRuntimeContext } from '../../network/NetworkMessageRuntime';
import type { RemotePlayerLifecycleContext } from '../../network/RemotePlayerLifecycleRuntime';
import { assert, createFakeGolem, runTest, type FakeGolem } from '../smokeHelpers';

export function runAuthoritativeStateTest() {
    runTest('authoritative state runtime reconciles local and remote players', () => {
        const local = createFakeGolem({ maxHp: 100, hp: 90 });
        const remotePlayers = new Map<string, GolemController>();
        const remotePlayerStates = new Map<string, { team: TeamId; alive: boolean; timer: number; slot: number }>();
        const created: string[] = [];
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
}
