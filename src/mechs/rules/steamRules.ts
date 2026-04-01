import { GOLEM } from '../../utils/constants';
import type { MechHeatState } from '../runtimeTypes';

export type SpendSteamResult = {
    nextState: MechHeatState;
    success: boolean;
    triggeredOverheat: boolean;
};

export function triggerOverheatState(
    state: MechHeatState,
    duration = GOLEM.overheatDuration
): MechHeatState {
    return {
        ...state,
        isOverheated: true,
        overheatTimer: Math.max(state.overheatTimer, duration)
    };
}

export function spendSteamState(
    state: MechHeatState,
    cost: number,
    overheatThreshold = GOLEM.overheatThreshold,
    overheatDuration = GOLEM.overheatDuration
): SpendSteamResult {
    if (state.isOverheated) {
        return {
            nextState: state,
            success: false,
            triggeredOverheat: false
        };
    }

    if (cost <= 0) {
        return {
            nextState: state,
            success: true,
            triggeredOverheat: false
        };
    }

    if (state.steam < cost) {
        return {
            nextState: triggerOverheatState(state, overheatDuration),
            success: false,
            triggeredOverheat: true
        };
    }

    const nextState: MechHeatState = {
        ...state,
        steam: state.steam - cost
    };

    if (nextState.steam <= overheatThreshold) {
        return {
            nextState: triggerOverheatState(nextState, overheatDuration),
            success: true,
            triggeredOverheat: true
        };
    }

    return {
        nextState,
        success: true,
        triggeredOverheat: false
    };
}

export function tickSteamState(
    state: MechHeatState,
    dt: number,
    steamRegen = GOLEM.steamRegen,
    recoverySteam = 20
): MechHeatState {
    if (state.isOverheated) {
        const nextTimer = state.overheatTimer - dt;
        if (nextTimer <= 0) {
            return {
                ...state,
                steam: recoverySteam,
                isOverheated: false,
                overheatTimer: 0
            };
        }

        return {
            ...state,
            overheatTimer: nextTimer
        };
    }

    return {
        ...state,
        steam: Math.min(state.maxSteam, state.steam + steamRegen * dt)
    };
}
