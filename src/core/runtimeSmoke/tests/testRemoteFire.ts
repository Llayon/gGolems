import type { GolemController } from '../../../entities/GolemController';
import { applyRemoteFire, type FireShotPayload, type RemoteFireRuntimeContext } from '../../combat/ProjectileCombatRuntime';
import { assert, createFakeGolem, runTest, type FakeGolem } from '../smokeHelpers';

export function runRemoteFireTest() {
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
}
