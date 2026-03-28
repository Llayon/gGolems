import Peer, { DataConnection } from 'peerjs';

export class NetworkManager {
    peer: Peer | null = null;
    connections: Map<string, DataConnection> = new Map();
    isHost: boolean = false;
    myId: string = '';
    
    onConnect?: (id: string) => void;
    onData?: (id: string, data: any) => void;
    onDisconnect?: (id: string) => void;

    constructor() {}

    initAsHost(onReady: (id: string) => void, onError?: (err: any) => void) {
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
            this.peer.on('error', onError);
        }
    }

    initAsClient(hostId: string, onReady: (id: string) => void, onError: (err: any) => void) {
        this.isHost = false;
        this.peer = new Peer();
        
        this.peer.on('open', (id) => {
            this.myId = id;
            const conn = this.peer!.connect(hostId);
            conn.on('open', () => {
                this.setupConnection(conn);
                onReady(id);
            });
            conn.on('error', onError);
        });
        
        this.peer.on('error', onError);
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
