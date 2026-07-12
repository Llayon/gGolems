import * as THREE from 'three';
import type { WeaponStatusView } from '../combat/weaponTypes';
import type { GolemSectionState } from '../mechs/sections';
import type { ChassisId, LoadoutId, SignatureAbilityId } from '../mechs/types';

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
    signatureAbilityId: SignatureAbilityId | null;
    signatureCooldown: number;
    signatureCooldownMax: number;
    signatureActiveTimer: number;
    signatureActiveMax: number;
    signatureIsActive: boolean;
}

export interface GolemEvents {
    dashed: boolean;
    vented: boolean;
    footstep: boolean;
    signatureUsed: boolean;
}

export interface GolemControllerOptions {
    chassisId?: ChassisId;
    loadoutId?: LoadoutId;
}
