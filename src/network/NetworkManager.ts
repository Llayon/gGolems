import Peer, { DataConnection } from 'peerjs';

export type NetworkStartupErrorCode =
    | 'peerUnavailable'
    | 'peerIdUnavailable'
    | 'networkUnavailable'
    | 'serverError'
    | 'connectionFailed'
    | 'invalidHostId'
    | 'unknown';

export type NetworkStartupError = {
    code: NetworkStartupErrorCode;
    detail?: string;
    cause?: unknown;
};

function normalizePeerError(error: any): NetworkStartupError {
    const rawDetail = error instanceof Error
        ? error.message
        : typeof error?.message === 'string'
            ? error.message
            : typeof error === 'string'
                ? error
                : undefined;

    const type = typeof error?.type === 'string' ? error.type : '';
    const detail = type && rawDetail
        ? `${type}: ${rawDetail}`
        : rawDetail || type || undefined;

    switch (type) {
        case 'peer-unavailable':
            return { code: 'peerUnavailable', detail, cause: error };
        case 'unavailable-id':
            return { code: 'peerIdUnavailable', detail, cause: error };
        case 'network':
        case 'socket-error':
        case 'socket-closed':
            return { code: 'networkUnavailable', detail, cause: error };
        case 'server-error':
        case 'ssl-unavailable':
            return { code: 'serverError', detail, cause: error };
        case 'invalid-id':
            return { code: 'invalidHostId', detail, cause: error };
        case 'webrtc':
            return { code: 'connectionFailed', detail, cause: error };
        default:
            return { code: 'unknown', detail, cause: error };
    }
}

export class NetworkManager {
    peer: Peer | null = null;
    connections: Map<string, DataConnection> = new Map();
    isHost: boolean = false;
    myId: string = '';
    
    onConnect?: (id: string) => void;
    onData?: (id: string, data: any) => void;
    onDisconnect?: (id: string) => void;

    constructor() {}

    initAsHost(onReady: (id: string) => void, onError?: (err: NetworkStartupError) => void) {
        this.isHost = true;
        this.peer = new Peer();
        
        this.peer.on('open', (id) => {
            this.myId = id;
            onReady(id);
        });

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });

        if (onError) {
            this.peer.on('error', (error) => onError(normalizePeerError(error)));
        }
    }

    initAsClient(hostId: string, onReady: (id: string) => void, onError: (err: NetworkStartupError) => void) {
        this.isHost = false;
        this.peer = new Peer();
        
        this.peer.on('open', (id) => {
            this.myId = id;
            const conn = this.peer!.connect(hostId);
            conn.on('open', () => {
                this.setupConnection(conn);
                onReady(id);
            });
            conn.on('error', (error) => onError(normalizePeerError(error)));
        });
        
        this.peer.on('error', (error) => onError(normalizePeerError(error)));
    }

    private setupConnection(conn: DataConnection) {
        this.connections.set(conn.peer, conn);
        
        conn.on('data', (data) => {
            if (this.onData) this.onData(conn.peer, data);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            if (this.onDisconnect) this.onDisconnect(conn.peer);
        });

        if (this.onConnect) this.onConnect(conn.peer);
    }

    broadcast(data: any, excludeId?: string) {
        this.connections.forEach((conn, id) => {
            if (id !== excludeId) {
                conn.send(data);
            }
        });
    }

    sendTo(id: string, data: any) {
        const conn = this.connections.get(id);
        if (conn) conn.send(data);
    }

    sendToHost(data: any) {
        if (!this.isHost && this.connections.size > 0) {
            // Client only has one connection (to host)
            this.connections.values().next().value.send(data);
        }
    }
}
