import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ROTATION } from '../../utils/constants';
import { angleDiff, clamp, moveTowardsAngle } from '../../utils/math';
import type { GolemSectionState } from '../sections';
import type { ChassisDefinition } from '../types';

const _dashForward = new THREE.Vector3();
const _dashVelocity = new THREE.Vector3();
const _movementForward = new THREE.Vector3();
const _movementCurrentVelocity = new THREE.Vector3();
const _movementSideVelocity = new THREE.Vector3();
const _movementDesiredVelocity = new THREE.Vector3();
const _movementDeltaVelocity = new THREE.Vector3();

type MovementChassis = Pick<ChassisDefinition, 'weightClass' | 'topSpeed' | 'dashSpeed' | 'mass'>;

export type LocalMechDashContext = {
    body: RAPIER.RigidBody;
    chassis: MovementChassis;
    legYaw: number;
    throttle: number;
};

export type LocalMechMovementContext = {
    body: RAPIER.RigidBody;
    chassis: MovementChassis;
    sections: GolemSectionState;
    maxSections: GolemSectionState;
    dt: number;
    aimYawUnclamped: number;
    cameraAimYaw: number | null;
    throttleInput: number;
    turnInput: number;
    centerTorso: boolean;
    stopThrottle: boolean;
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    dashRecoveryTimer: number;
};

export type LocalMechMovementResult = {
    legYaw: number;
    torsoYaw: number;
    targetTorsoYaw: number;
    throttle: number;
    dashRecoveryTimer: number;
    cameraAimYaw: number | null;
};

export function applyLocalMechDash(context: LocalMechDashContext) {
    _dashForward.set(Math.sin(context.legYaw), 0, -Math.cos(context.legYaw));

    const velocity = context.body.linvel();
    _dashVelocity.set(velocity.x, 0, velocity.z);
    const forwardSpeed = _dashVelocity.dot(_dashForward);
    const dashSign = Math.abs(context.throttle) > 0.08
        ? Math.sign(context.throttle)
        : forwardSpeed < -0.5
            ? -1
            : 1;

    context.body.setLinvel({
        x: _dashForward.x * context.chassis.dashSpeed * (dashSign || 1),
        y: Math.min(velocity.y, 0),
        z: _dashForward.z * context.chassis.dashSpeed * (dashSign || 1)
    }, true);
}

export function updateLocalMechMovement(
    context: LocalMechMovementContext
): LocalMechMovementResult {
    const torsoStep = ROTATION.torsoTurnRate[context.chassis.weightClass] * context.dt;
    const maxTwist = ROTATION.maxTorsoTwist;
    const throttleRamp = 1.05;
    const brakeResponse = 6.4;
    const driveResponse = 5.4;
    const lateralGrip = 10;
    const legIntegrity = Math.max(
        0.25,
        (context.sections.leftLeg / context.maxSections.leftLeg + context.sections.rightLeg / context.maxSections.rightLeg) * 0.5
    );
    const bodyTurnStep = ROTATION.legsTurnRate[context.chassis.weightClass] * context.dt * (0.45 + legIntegrity * 0.55);
    const maxSpeed = context.chassis.topSpeed * (0.3 + legIntegrity * 0.72);

    let resolvedAimYaw = context.aimYawUnclamped;
    let nextCameraAimYaw = context.cameraAimYaw;
    let nextThrottle = context.throttle;
    let nextLegYaw = context.legYaw;
    let nextDashRecoveryTimer = context.dashRecoveryTimer;

    if (context.centerTorso) {
        resolvedAimYaw = context.legYaw;
        nextCameraAimYaw = resolvedAimYaw;
    }

    if (context.stopThrottle) {
        nextThrottle = 0;
    } else if (context.throttleInput !== 0) {
        nextThrottle = clamp(nextThrottle + context.throttleInput * throttleRamp * context.dt, -0.45, 1);
    }

    if (context.turnInput !== 0) {
        nextLegYaw += context.turnInput * bodyTurnStep;
    } else if (typeof context.cameraAimYaw === 'number') {
        const bodyCatchTarget = context.cameraAimYaw;
        const bodyCatchOffset = angleDiff(nextLegYaw, bodyCatchTarget);
        const bodyCatchAbs = Math.abs(bodyCatchOffset);
        const catchThreshold = maxTwist * 0.72;

        if (bodyCatchAbs > catchThreshold) {
            const catchStrength = clamp((bodyCatchAbs - catchThreshold) / (maxTwist - catchThreshold), 0, 1);
            const locomotionBias = Math.abs(nextThrottle) > 0.08 ? 0.55 : 0.22;
            const catchStep = bodyTurnStep * locomotionBias * catchStrength;
            nextLegYaw = moveTowardsAngle(nextLegYaw, bodyCatchTarget, catchStep);
        }
    }

    let targetTorsoYaw = resolvedAimYaw;
    const twistFromBody = angleDiff(nextLegYaw, targetTorsoYaw);
    if (twistFromBody > maxTwist) {
        targetTorsoYaw = nextLegYaw + maxTwist;
        nextCameraAimYaw = targetTorsoYaw;
    }
    if (twistFromBody < -maxTwist) {
        targetTorsoYaw = nextLegYaw - maxTwist;
        nextCameraAimYaw = targetTorsoYaw;
    }

    const nextTorsoYaw = moveTowardsAngle(context.torsoYaw, targetTorsoYaw, torsoStep);

    const velocity = context.body.linvel();
    _movementCurrentVelocity.set(velocity.x, 0, velocity.z);
    _movementForward.set(Math.sin(nextLegYaw), 0, -Math.cos(nextLegYaw));

    const forwardSpeed = _movementCurrentVelocity.dot(_movementForward);
    _movementSideVelocity.copy(_movementCurrentVelocity).addScaledVector(_movementForward, -forwardSpeed);
    context.body.applyImpulse({
        x: -_movementSideVelocity.x * context.chassis.mass * lateralGrip * context.dt,
        y: 0,
        z: -_movementSideVelocity.z * context.chassis.mass * lateralGrip * context.dt
    }, true);

    _movementDesiredVelocity.copy(_movementForward).multiplyScalar(maxSpeed * nextThrottle);
    _movementDeltaVelocity.copy(_movementDesiredVelocity).sub(_movementCurrentVelocity);
    const desiredForwardSpeed = maxSpeed * nextThrottle;
    let finalResponse = Math.abs(nextThrottle) > 0.001 ? driveResponse : brakeResponse;

    if (nextDashRecoveryTimer > 0) {
        nextDashRecoveryTimer = Math.max(0, nextDashRecoveryTimer - context.dt);
        if (Math.abs(forwardSpeed) > Math.abs(desiredForwardSpeed) + 0.35) {
            finalResponse = Math.max(finalResponse, 8.1);
        }
    }

    context.body.applyImpulse({
        x: _movementDeltaVelocity.x * context.chassis.mass * finalResponse * context.dt,
        y: 0,
        z: _movementDeltaVelocity.z * context.chassis.mass * finalResponse * context.dt
    }, true);

    return {
        legYaw: nextLegYaw,
        torsoYaw: nextTorsoYaw,
        targetTorsoYaw,
        throttle: nextThrottle,
        dashRecoveryTimer: nextDashRecoveryTimer,
        cameraAimYaw: nextCameraAimYaw
    };
}
