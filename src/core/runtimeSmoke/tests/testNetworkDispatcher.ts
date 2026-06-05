import { dispatchNetworkDataMessage, type NetworkDataDispatchContext } from '../../network/NetworkMessageRuntime';
import { assert, runTest } from '../smokeHelpers';

export function runNetworkDispatcherTest() {
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
}
