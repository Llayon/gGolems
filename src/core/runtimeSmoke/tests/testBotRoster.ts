import type { DummyBot } from '../../../entities/DummyBot';
import { syncTeamBotRoster, type BotRuntimeContext } from '../../bots/BotRuntime';
import { assert, createFakeBot, runTest } from '../smokeHelpers';

export function runBotRosterTest() {
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
}
