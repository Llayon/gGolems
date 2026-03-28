export type TeamId = 'blue' | 'red';
export type ControlOwner = TeamId | 'neutral';
export type ControlPointId = 'A' | 'B' | 'C';

export type ControlPointView = {
    id: ControlPointId;
    owner: ControlOwner;
    capture: number;
    radius: number;
    contested: boolean;
    blueInside: number;
    redInside: number;
};

export type TeamScoreState = {
    blue: number;
    red: number;
    scoreToWin: number;
    winner: ControlOwner | null;
};

export type BotStateView = {
    id: string;
    team: TeamId;
    x: number;
    y: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    respawnTimer: number;
};
