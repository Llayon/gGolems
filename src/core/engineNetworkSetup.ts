import type { NetworkManager } from '../network/NetworkManager';
import type { EngineRuntimeAdapters } from './EngineRuntimeContexts';
import type { EngineSessionRuntimeAdapters } from './EngineSessionRuntimeAdapters';
import { readClientInputPacket } from './network/clientInputPacket';
import {
    handlePeerConnect,
    handlePeerDisconnect
} from './network/NetworkSyncAdapter';
import { dispatchNetworkDataMessage } from './network/NetworkMessageRuntime';

export function setupNetworkHandlers(
    network: NetworkManager,
    runtimeAdapters: EngineRuntimeAdapters,
    sessionRuntimeAdapters: EngineSessionRuntimeAdapters
) {
    network.onConnect = (id) => {
        console.log('Player connected:', id);
        handlePeerConnect(sessionRuntimeAdapters.networkPeerLifecycle(), id);
    };

    network.onDisconnect = (id) => {
        console.log('Player disconnected:', id);
        handlePeerDisconnect(sessionRuntimeAdapters.networkPeerLifecycle(), id);
    };

    network.onData = (id, data) => {
        const inputPacket = network.isHost ? readClientInputPacket(data) : null;
        dispatchNetworkDataMessage(runtimeAdapters.networkDataDispatch(), id, data, inputPacket);
    };
}
