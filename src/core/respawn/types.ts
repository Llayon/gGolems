import type { TeamId } from '../../gameplay/types';

export type RespawnSessionMode = 'solo' | 'host' | 'client';

export type PlayerRespawnState = {
    alive: boolean;
    timer: number;
    slot: number;
};

export type RemotePlayerState = PlayerRespawnState & {
    team: TeamId;
};
