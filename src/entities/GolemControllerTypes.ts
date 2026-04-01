import * as THREE from 'three';
import type { WeaponStatusView } from '../combat/weaponTypes';
import type { GolemSectionState } from '../mechs/sections';
import type { ChassisId, LoadoutId } from '../mechs/types';

export interface GolemState {
    pos: THREE.Vector3;
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    currentSpeed: number;
    mass: number;
    sections: GolemSectionState;
    maxSections: GolemSectionState;
    weaponStatus: WeaponStatusView[];
}

export interface GolemEvents {
    dashed: boolean;
    vented: boolean;
    footstep: boolean;
}

export interface GolemControllerOptions {
    chassisId?: ChassisId;
    loadoutId?: LoadoutId;
}
