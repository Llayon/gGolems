import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ROTATION } from '../../utils/constants';
import { moveTowardsAngle } from '../../utils/math';
import type { WeightClass } from '../types';

const _netPos = new THREE.Vector3();

export type RemoteMechReplicationContext = {
    body: RAPIER.RigidBody;
    targetPos: THREE.Vector3;
    targetLegYaw: number;
    targetTorsoYaw: number;
    legYaw: number;
    torsoYaw: number;
    weightClass: WeightClass;
};

export type RemoteMechReplicationResult = {
    legYaw: number;
    torsoYaw: number;
};

export function applyRemoteMechReplication(
    context: RemoteMechReplicationContext,
    dt: number
): RemoteMechReplicationResult {
    const pos = context.body.translation();
    _netPos.set(pos.x, pos.y, pos.z);
    const dist = context.targetPos.distanceTo(_netPos);

    if (dist > 5) {
        context.body.setNextKinematicTranslation(context.targetPos);
    } else {
        context.body.setNextKinematicTranslation({
            x: THREE.MathUtils.lerp(pos.x, context.targetPos.x, 10 * dt),
            y: THREE.MathUtils.lerp(pos.y, context.targetPos.y, 10 * dt),
            z: THREE.MathUtils.lerp(pos.z, context.targetPos.z, 10 * dt)
        });
    }

    return {
        legYaw: moveTowardsAngle(
            context.legYaw,
            context.targetLegYaw,
            ROTATION.legsTurnRate[context.weightClass] * dt * 4
        ),
        torsoYaw: moveTowardsAngle(
            context.torsoYaw,
            context.targetTorsoYaw,
            ROTATION.torsoTurnRate[context.weightClass] * dt * 5
        )
    };
}
