import { runNetworkDispatcherTest } from './tests/testNetworkDispatcher';
import { runRespawnTest } from './tests/testRespawn';
import { runPlayerHitTest } from './tests/testPlayerHit';
import { runAuthoritativeStateTest } from './tests/testAuthoritativeState';
import { runRemoteFireTest } from './tests/testRemoteFire';
import { runBotRosterTest } from './tests/testBotRoster';

runNetworkDispatcherTest();
runRespawnTest();
runPlayerHitTest();
runAuthoritativeStateTest();
runRemoteFireTest();
runBotRosterTest();

console.log('Runtime smoke completed successfully.');
