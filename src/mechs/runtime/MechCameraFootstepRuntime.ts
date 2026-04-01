import * as THREE from 'three';
import type { AudioManager } from '../../core/AudioManager';
import type { MechCamera } from '../../camera/MechCamera';
import type { DecalManager } from '../../fx/DecalManager';
import type { KWIIRuntimeVisual } from '../../entities/KWIIRuntimeAsset';
import { getThirdPersonAnchor, getViewAnchor } from './MechVisualDriver';

const _cameraAnchor = new THREE.Vector3();
const _footOffset = new THREE.Vector3();
const _footprintPos = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export type MechCameraFootstepContext = {
    isLocal: boolean;
    gameCamera: MechCamera | null;
    heroVisual: KWIIRuntimeVisual | null;
    torso: THREE.Object3D;
    modelPosition: THREE.Vector3;
    legYaw: number;
    currentSpeed: number;
    mass: number;
    walkCycle: number;
    lastStepPhase: number;
    dt: number;
    sounds: AudioManager;
    decals: DecalManager;
};

export type MechCameraFootstepResult = {
    walkCycle: number;
    lastStepPhase: number;
    footstepTriggered: boolean;
};

function emitFootstep(
    sounds: AudioManager,
    decals: DecalManager,
    modelPosition: THREE.Vector3,
    legYaw: number,
    mass: number,
    isLeftStep: boolean
) {
    sounds.playFootstep(mass);
    _footOffset.set(isLeftStep ? -0.75 : 0.75, 0, 0);
    _footOffset.applyAxisAngle(_upAxis, legYaw);
    _footprintPos.copy(modelPosition).add(_footOffset);
    decals.addFootprint(_footprintPos, legYaw, mass);
}

export function updateMechCameraAndFootsteps(
    context: MechCameraFootstepContext
): MechCameraFootstepResult {
    let walkCycle = context.walkCycle;
    let lastStepPhase = context.lastStepPhase;
    let footstepTriggered = false;

    if (!context.isLocal || !context.gameCamera) {
        if (context.currentSpeed > 0.5) {
            const freq = (1.2 / context.mass) * Math.min(context.currentSpeed / 10, 1);
            walkCycle += context.dt * freq * Math.PI * 2;

            const stepPhase = (walkCycle / Math.PI) % 2;
            if ((stepPhase < 0.1 && lastStepPhase >= 1.9) || (stepPhase > 1.0 && lastStepPhase <= 1.0)) {
                emitFootstep(
                    context.sounds,
                    context.decals,
                    context.modelPosition,
                    context.legYaw,
                    context.mass,
                    stepPhase < 0.1
                );
                footstepTriggered = true;
            }
            lastStepPhase = stepPhase;
        } else {
            walkCycle = 0;
            lastStepPhase = 0;
        }

        return { walkCycle, lastStepPhase, footstepTriggered };
    }

    const camera = context.gameCamera;
    walkCycle = camera.walkCycle * Math.PI * 2;
    if (camera.mode === 'thirdPerson') {
        getThirdPersonAnchor(context.heroVisual, context.torso, _cameraAnchor);
    } else {
        getViewAnchor(context.torso, _cameraAnchor, context.legYaw);
    }

    camera.update(
        _cameraAnchor,
        context.legYaw,
        camera.aimYaw,
        context.currentSpeed,
        context.mass,
        context.dt
    );

    camera.onFootstep = () => {
        footstepTriggered = true;
        emitFootstep(
            context.sounds,
            context.decals,
            context.modelPosition,
            context.legYaw,
            context.mass,
            Math.sin(camera.walkCycle * Math.PI * 2) > 0
        );
    };

    return { walkCycle, lastStepPhase, footstepTriggered };
}
