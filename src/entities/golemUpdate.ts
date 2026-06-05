import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { tickMechHeatStateRuntime } from '../mechs/runtime/MechStateRuntime';
import { tickWeaponRecoilState } from '../mechs/runtime/MechWeaponRuntime';
import { updateLocalMechMovement } from '../mechs/runtime/LocalMechMovementRuntime';
import { applyRemoteMechReplication } from '../mechs/runtime/RemoteMechReplicationRuntime';
import { updateMechCameraAndFootsteps } from '../mechs/runtime/MechCameraFootstepRuntime';
import { applyProceduralMechPose, syncHeroVisual as syncHeroVisualRuntime } from '../mechs/runtime/MechVisualDriver';
import type { GolemEvents } from './GolemControllerTypes';
import type { AudioManager } from '../core/AudioManager';
import type { DecalManager } from '../fx/DecalManager';

export type GolemUpdateSource = {
    isLocal: boolean;
    body: RAPIER.RigidBody;
    model: THREE.Group;
    legs: THREE.Group;
    torso: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    pelvis: THREE.Mesh;
    boiler: THREE.Mesh;
    bronzeMaterial: THREE.MeshStandardMaterial;
    runeMaterial: THREE.MeshStandardMaterial;
    boilerMaterial: THREE.MeshStandardMaterial;
    heroVisual: any;
    chassis: any;
    sections: any;
    maxSections: any;
    weaponMountOrder: any;
    weaponMounts: any;
    weaponRecoil: any;
    legYaw: number;
    torsoYaw: number;
    targetTorsoYaw: number;
    targetPos: THREE.Vector3;
    targetLegYaw: number;
    throttle: number;
    walkCycle: number;
    heroStrideCycle: number;
    lastStepPhase: number;
    currentSpeed: number;
    damageFlashTimer: number;
    dashRecoveryTimer: number;
    mass: number;
    gameCamera?: any;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    syncHeroVisual: (dt: number) => void;
};

export type GolemUpdateContext = {
    golem: GolemUpdateSource;
    dt: number;
    aimYawUnclamped: number;
    throttleInput: number;
    turnInput: number;
    centerTorso: boolean;
    stopThrottle: boolean;
    sounds: AudioManager;
    decals: DecalManager;
};

const _vel = new THREE.Vector3();

export function updateGolem(ctx: GolemUpdateContext): GolemEvents {
    const events: GolemEvents = { dashed: false, vented: false, footstep: false };
    const g = ctx.golem;

    if (g.damageFlashTimer > 0) {
        g.damageFlashTimer = Math.max(0, g.damageFlashTimer - ctx.dt);
    }
    tickMechHeatStateRuntime(g, ctx.dt);
    tickWeaponRecoilState(g.weaponRecoil, g.weaponMountOrder, ctx.dt);

    const flashRatio = g.damageFlashTimer > 0 ? g.damageFlashTimer / 0.16 : 0;
    const flashIntensity = flashRatio * 1.6;
    g.bronzeMaterial.emissive.setRGB(0.55 * flashRatio, 0.42 * flashRatio, 0.18 * flashRatio);
    g.bronzeMaterial.emissiveIntensity = flashIntensity;
    g.runeMaterial.emissiveIntensity = 2 + flashIntensity * 0.6;
    g.boilerMaterial.emissiveIntensity = 1.5 + flashIntensity * 0.35;

    if (g.isLocal) {
        const localMovement = updateLocalMechMovement({
            body: g.body,
            chassis: g.chassis,
            sections: g.sections,
            maxSections: g.maxSections,
            dt: ctx.dt,
            aimYawUnclamped: ctx.aimYawUnclamped,
            cameraAimYaw: g.gameCamera?.aimYaw ?? null,
            throttleInput: ctx.throttleInput,
            turnInput: ctx.turnInput,
            centerTorso: ctx.centerTorso,
            stopThrottle: ctx.stopThrottle,
            legYaw: g.legYaw,
            torsoYaw: g.torsoYaw,
            throttle: g.throttle,
            dashRecoveryTimer: g.dashRecoveryTimer
        });

        g.legYaw = localMovement.legYaw;
        g.torsoYaw = localMovement.torsoYaw;
        g.targetTorsoYaw = localMovement.targetTorsoYaw;
        g.throttle = localMovement.throttle;
        g.dashRecoveryTimer = localMovement.dashRecoveryTimer;
        if (g.gameCamera && typeof localMovement.cameraAimYaw === 'number') {
            g.gameCamera.aimYaw = localMovement.cameraAimYaw;
        }
    } else {
        const replicatedState = applyRemoteMechReplication({
            body: g.body,
            targetPos: g.targetPos,
            targetLegYaw: g.targetLegYaw,
            targetTorsoYaw: g.targetTorsoYaw,
            legYaw: g.legYaw,
            torsoYaw: g.torsoYaw,
            weightClass: g.chassis.weightClass
        }, ctx.dt);

        g.legYaw = replicatedState.legYaw;
        g.torsoYaw = replicatedState.torsoYaw;
    }

    const pos = g.body.translation();
    g.model.position.set(pos.x, pos.y - 1.5, pos.z);
    g.legs.rotation.y = -g.legYaw;
    g.torso.rotation.y = -g.torsoYaw;

    const vel = g.body.linvel();
    _vel.set(vel.x, 0, vel.z);
    g.currentSpeed = _vel.length();

    const cameraAndFootsteps = updateMechCameraAndFootsteps({
        isLocal: g.isLocal,
        gameCamera: g.gameCamera ?? null,
        heroVisual: g.heroVisual,
        torso: g.torso,
        modelPosition: g.model.position,
        legYaw: g.legYaw,
        currentSpeed: g.currentSpeed,
        mass: g.mass,
        walkCycle: g.walkCycle,
        lastStepPhase: g.lastStepPhase,
        dt: ctx.dt,
        sounds: ctx.sounds,
        decals: ctx.decals
    });
    g.walkCycle = cameraAndFootsteps.walkCycle;
    g.lastStepPhase = cameraAndFootsteps.lastStepPhase;
    events.footstep = cameraAndFootsteps.footstepTriggered;

    applyProceduralMechPose({
        walkCycle: g.walkCycle,
        weaponRecoil: g.weaponRecoil,
        leftLeg: g.leftLeg,
        rightLeg: g.rightLeg,
        leftArm: g.leftArm,
        rightArm: g.rightArm,
        torso: g.torso,
        pelvis: g.pelvis,
        boiler: g.boiler
    });
    g.syncHeroVisual(ctx.dt);

    return events;
}
