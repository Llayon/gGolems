import * as THREE from 'three';
import type { WeaponMountId } from '../../combat/weaponTypes';
import type { KWIIRuntimeVisual } from '../../entities/KWIIRuntimeAsset';
import type { GolemSectionState } from '../sections';
import type { WeaponRecoilState } from './MechWeaponRuntime';

const _viewForward = new THREE.Vector3();
const _heroTwistQuat = new THREE.Quaternion();
const _heroArmQuat = new THREE.Quaternion();
const _heroLegQuat = new THREE.Quaternion();
const _heroUpAxis = new THREE.Vector3(0, 1, 0);
const _heroPitchAxis = new THREE.Vector3(1, 0, 0);
const _heroRigOffset = new THREE.Vector3();

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function angleDiff(from: number, to: number) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

export type ProceduralSectionVisualContext = {
    heroVisual: KWIIRuntimeVisual | null;
    head: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    sections: GolemSectionState;
};

export function applyProceduralSectionVisuals(context: ProceduralSectionVisualContext) {
    const showProcedural = !context.heroVisual;
    context.head.visible = showProcedural && context.sections.head > 0;
    context.leftArm.visible = showProcedural && context.sections.leftArm > 0;
    context.rightArm.visible = showProcedural && context.sections.rightArm > 0;
    context.leftLeg.visible = showProcedural && context.sections.leftLeg > 0;
    context.rightLeg.visible = showProcedural && context.sections.rightLeg > 0;
}

export function getViewAnchor(
    torso: THREE.Object3D,
    out: THREE.Vector3,
    facingYaw: number
) {
    torso.getWorldPosition(out);
    _viewForward.set(Math.sin(facingYaw), 0, -Math.cos(facingYaw));
    out.addScaledVector(_viewForward, 0.35);
    out.y += 1.45;
    return out;
}

export function getThirdPersonAnchor(
    heroVisual: KWIIRuntimeVisual | null,
    torso: THREE.Object3D,
    out: THREE.Vector3
) {
    const heroViewAnchor = heroVisual?.viewAnchor;
    if (heroViewAnchor) {
        heroViewAnchor.getWorldPosition(out);
        out.y += 0.18;
        return out;
    }

    torso.getWorldPosition(out);
    out.y += 1.35;
    return out;
}

export type HeroVisualSyncContext = {
    heroVisual: KWIIRuntimeVisual | null;
    throttle: number;
    currentSpeed: number;
    topSpeed: number;
    legYaw: number;
    torsoYaw: number;
    weaponRecoil: WeaponRecoilState;
    heroStrideCycle: number;
};

export function syncHeroVisual(
    context: HeroVisualSyncContext,
    dt: number
): number {
    const heroVisual = context.heroVisual;
    if (!heroVisual) return context.heroStrideCycle;

    const idleAction = heroVisual.actions.idle;
    const walkAction = heroVisual.actions.walk;
    const locomotionAmount = clamp(
        Math.max(Math.abs(context.throttle), context.currentSpeed / context.topSpeed),
        0,
        1
    );
    const desiredLocomotion = locomotionAmount > 0.06 ? 'walk' : 'idle';

    const resetNode = (
        node: THREE.Object3D | null,
        rest: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null
    ) => {
        if (!node || !rest) return;
        node.position.copy(rest.position);
        node.quaternion.copy(rest.quaternion);
    };
    const offsetRigNodes = (nodes: THREE.Object3D[], offset: THREE.Vector3) => {
        if (nodes.length === 0) return;
        for (const node of nodes) {
            node.position.add(offset);
        }
    };
    const rotateRigNodesAroundPivot = (
        nodes: THREE.Object3D[],
        pivot: THREE.Vector3 | null,
        axis: THREE.Vector3,
        angle: number
    ) => {
        if (!pivot || nodes.length === 0 || Math.abs(angle) <= 0.0001) return;
        _heroTwistQuat.setFromAxisAngle(axis, angle);
        for (const node of nodes) {
            _heroRigOffset.copy(node.position).sub(pivot).applyQuaternion(_heroTwistQuat);
            node.position.copy(pivot).add(_heroRigOffset);
            node.quaternion.premultiply(_heroTwistQuat);
        }
    };

    resetNode(heroVisual.bones.pelvis, heroVisual.restPose.pelvis);
    resetNode(heroVisual.bones.waist, heroVisual.restPose.waist);
    resetNode(heroVisual.bones.torso, heroVisual.restPose.torso);
    resetNode(heroVisual.bones.head, heroVisual.restPose.head);
    resetNode(heroVisual.bones.leftArm, heroVisual.restPose.leftArm);
    resetNode(heroVisual.bones.rightArm, heroVisual.restPose.rightArm);
    resetNode(heroVisual.bones.leftThigh, heroVisual.restPose.leftThigh);
    resetNode(heroVisual.bones.rightThigh, heroVisual.restPose.rightThigh);
    resetNode(heroVisual.bones.leftShin, heroVisual.restPose.leftShin);
    resetNode(heroVisual.bones.rightShin, heroVisual.restPose.rightShin);
    resetNode(heroVisual.bones.leftFoot, heroVisual.restPose.leftFoot);
    resetNode(heroVisual.bones.rightFoot, heroVisual.restPose.rightFoot);
    heroVisual.torsoRigNodes.forEach((node, index) => {
        resetNode(node, heroVisual.torsoRigRestPose[index] ?? null);
    });

    if (idleAction) {
        if (desiredLocomotion === 'idle') {
            if (!idleAction.isRunning()) {
                idleAction.reset();
                idleAction.play();
            }
            idleAction.enabled = true;
            idleAction.setEffectiveWeight(1);
            idleAction.timeScale = 1;
        } else {
            idleAction.setEffectiveWeight(0);
            idleAction.stop();
            idleAction.enabled = false;
        }
    }

    if (walkAction) {
        if (desiredLocomotion === 'walk') {
            if (!walkAction.isRunning()) {
                walkAction.reset();
                walkAction.play();
            }
            walkAction.enabled = true;
            walkAction.setEffectiveWeight(Math.max(0.72, locomotionAmount));
            walkAction.timeScale = THREE.MathUtils.lerp(0.82, 1.25, locomotionAmount);
        } else {
            walkAction.setEffectiveWeight(0);
            walkAction.stop();
            walkAction.enabled = false;
            walkAction.timeScale = 1;
        }
    }

    heroVisual.locomotionState = desiredLocomotion;
    heroVisual.mixer.update(dt);

    let nextStrideCycle = context.heroStrideCycle;
    const strideDirection = context.throttle < -0.05 ? -1 : 1;
    if (locomotionAmount > 0.05) {
        nextStrideCycle += dt * (3.1 + locomotionAmount * 5.2) * strideDirection;
    }

    const torsoTwist = angleDiff(context.legYaw, context.torsoYaw);
    const gaitPhase = nextStrideCycle;
    const bob = Math.abs(Math.sin(gaitPhase * 2)) * 0.08 * (0.35 + locomotionAmount * 0.65);
    heroVisual.root.rotation.set(0, Math.PI - context.legYaw, 0);
    heroVisual.root.position.set(0, 0, 0);

    const torsoRigNodes = heroVisual.torsoRigNodes;
    const pelvis = heroVisual.bones.pelvis;
    const torso = heroVisual.bones.torso;

    if (pelvis && heroVisual.restPose.pelvis) {
        pelvis.position.y += bob;
    }

    if (torsoRigNodes.length > 0) {
        offsetRigNodes(torsoRigNodes, _heroRigOffset.set(0, bob * 0.65, 0));
        rotateRigNodesAroundPivot(torsoRigNodes, heroVisual.torsoPivot, _heroUpAxis, -torsoTwist);
    } else if (torso && heroVisual.restPose.torso) {
        torso.position.y += bob * 0.65;
        _heroTwistQuat.setFromAxisAngle(_heroUpAxis, -torsoTwist);
        torso.quaternion.multiply(_heroTwistQuat);
    }

    if (torso && heroVisual.restPose.torso) {
        torso.position.z += context.weaponRecoil.torsoMount * 0.18;
        _heroArmQuat.setFromAxisAngle(_heroPitchAxis, -context.weaponRecoil.torsoMount * 0.08);
        torso.quaternion.multiply(_heroArmQuat);
    }

    const leftArm = heroVisual.bones.leftArm;
    if (leftArm && heroVisual.restPose.leftArm) {
        _heroArmQuat.setFromAxisAngle(_heroPitchAxis, -context.weaponRecoil.leftArmMount * 0.55);
        leftArm.quaternion.multiply(_heroArmQuat);
    }

    const rightArm = heroVisual.bones.rightArm;
    if (rightArm && heroVisual.restPose.rightArm) {
        _heroArmQuat.setFromAxisAngle(_heroPitchAxis, -context.weaponRecoil.rightArmMount * 0.55);
        rightArm.quaternion.multiply(_heroArmQuat);
    }

    const applyLegGait = (
        thigh: THREE.Object3D | null,
        shin: THREE.Object3D | null,
        foot: THREE.Object3D | null,
        footRest: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null,
        phase: number
    ) => {
        if (!thigh || !shin || !foot || !footRest) return;

        const swing = Math.sin(phase) * locomotionAmount;
        const kneeBend = Math.max(0, -Math.sin(phase)) * locomotionAmount;
        const footLift = Math.max(0, Math.cos(phase)) * locomotionAmount;

        _heroLegQuat.setFromAxisAngle(_heroPitchAxis, swing * 0.58);
        thigh.quaternion.multiply(_heroLegQuat);

        _heroLegQuat.setFromAxisAngle(_heroPitchAxis, kneeBend * 0.82);
        shin.quaternion.multiply(_heroLegQuat);

        _heroLegQuat.setFromAxisAngle(_heroPitchAxis, -swing * 0.26 - footLift * 0.18);
        foot.quaternion.multiply(_heroLegQuat);
        foot.position.y += footLift * 0.085;
        foot.position.z += Math.max(0, swing) * 0.04;
    };

    applyLegGait(
        heroVisual.bones.leftThigh,
        heroVisual.bones.leftShin,
        heroVisual.bones.leftFoot,
        heroVisual.restPose.leftFoot,
        gaitPhase
    );
    applyLegGait(
        heroVisual.bones.rightThigh,
        heroVisual.bones.rightShin,
        heroVisual.bones.rightFoot,
        heroVisual.restPose.rightFoot,
        gaitPhase + Math.PI
    );

    heroVisual.root.updateMatrixWorld(true);
    return nextStrideCycle;
}

export type ProceduralPoseContext = {
    walkCycle: number;
    weaponRecoil: WeaponRecoilState;
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    torso: THREE.Object3D;
    pelvis: THREE.Object3D;
    boiler: THREE.Object3D;
    nowMs?: number;
};

export function applyProceduralMechPose(context: ProceduralPoseContext) {
    context.leftLeg.position.z = Math.sin(context.walkCycle) * 1.5;
    context.leftLeg.position.y = 1.5 + Math.max(0, Math.sin(context.walkCycle + Math.PI / 2)) * 0.5;

    context.rightLeg.position.z = Math.sin(context.walkCycle + Math.PI) * 1.5;
    context.rightLeg.position.y = 1.5 + Math.max(0, Math.sin(context.walkCycle - Math.PI / 2)) * 0.5;

    context.leftArm.position.z = Math.sin(context.walkCycle + Math.PI) * 1.0 + context.weaponRecoil.leftArmMount * 0.62;
    context.rightArm.position.z = Math.sin(context.walkCycle) * 1.0 + context.weaponRecoil.rightArmMount * 0.62;
    context.leftArm.rotation.x = -context.weaponRecoil.leftArmMount * 0.24;
    context.rightArm.rotation.x = -context.weaponRecoil.rightArmMount * 0.24;

    context.torso.position.y = 5.5 + Math.abs(Math.sin(context.walkCycle * 2)) * 0.2;
    context.torso.position.z = context.weaponRecoil.torsoMount * 0.46;
    context.torso.rotation.x = -context.weaponRecoil.torsoMount * 0.14;
    context.pelvis.position.y = 2.0 + Math.abs(Math.sin(context.walkCycle * 2)) * 0.2;

    const now = context.nowMs ?? Date.now();
    const pulse = 1 + Math.sin(now * 0.002) * 0.02;
    context.boiler.scale.set(pulse, 1, pulse);
}
