import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { InputManager } from './InputManager';
import type { MechCamera } from '../camera/MechCamera';
import type { AudioManager } from './AudioManager';
import type { DecalManager } from '../fx/DecalManager';
import type { ProjectileManager } from '../combat/ProjectileManager';
import type { RemotePlayerState } from './respawn/types';

const _aimPoint = new THREE.Vector3();

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export type MechUpdateContext = {
    golem: GolemController;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    input: InputManager;
    mechCamera: MechCamera;
    sounds: AudioManager;
    decals: DecalManager;
    projectiles: ProjectileManager;
    localRespawnAlive: boolean;
    matchEnded: boolean;
    haltHorizontalMotion: (body: RAPIER.RigidBody) => void;
};

export function updateMechs(ctx: MechUpdateContext, dt: number) {
    const canControlLocal = ctx.localRespawnAlive && !ctx.matchEnded;
    let throttleInput = ctx.input.virtualThrottle;
    let turnInput = ctx.input.virtualTurn;
    if (ctx.input.keys['KeyW']) throttleInput += 1;
    if (ctx.input.keys['KeyS']) throttleInput -= 1;
    if (ctx.input.keys['KeyA']) turnInput -= 1;
    if (ctx.input.keys['KeyD']) turnInput += 1;
    throttleInput = clamp(throttleInput, -1, 1);
    turnInput = clamp(turnInput, -1, 1);

    ctx.golem.update(
        dt,
        ctx.mechCamera.aimYaw,
        canControlLocal ? throttleInput : 0,
        canControlLocal ? turnInput : 0,
        canControlLocal ? ctx.input.consumeKey('KeyC') || ctx.input.consumeVirtualAction('centerTorso') : false,
        canControlLocal ? ctx.input.consumeKey('KeyX') || ctx.input.consumeVirtualAction('stopThrottle') : false,
        ctx.sounds,
        ctx.decals
    );

    const torsoTurnSpeed = (ctx.golem.targetTorsoYaw - ctx.golem.torsoYaw) / dt;
    ctx.sounds.update(torsoTurnSpeed);

    ctx.remotePlayers.forEach((player, id) => {
        const state = ctx.remotePlayerStates.get(id);
        if (state?.alive === false) return;
        player.update(dt, player.targetTorsoYaw, 0, 0, false, false, ctx.sounds, ctx.decals);
    });

    if (ctx.matchEnded) {
        ctx.haltHorizontalMotion(ctx.golem.body);
        ctx.remotePlayers.forEach((player) => ctx.haltHorizontalMotion(player.body));
    } else {
        ctx.projectiles.update(dt);
    }
    ctx.decals.update(dt);
}

export function updateCameraAndInput(
    input: InputManager,
    mechCamera: MechCamera,
    toggleMode: () => void
) {
    const { mx, my } = input.consumeMovement();
    mechCamera.onMouseMove(mx, my);
    if (input.consumeKey('KeyV')) {
        toggleMode();
    }
}

export function getAimTargetPoint(
    out: THREE.Vector3,
    camera: THREE.Camera,
    aimRaycaster: THREE.Raycaster,
    collisionMeshes: THREE.Object3D[],
    aimRayDistance: number
) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir).normalize();
    aimRaycaster.set(camera.position, dir);
    aimRaycaster.far = aimRayDistance;
    const hits = aimRaycaster.intersectObjects(collisionMeshes, false);
    if (hits.length > 0) {
        return out.copy(hits[0].point);
    }
    return out.copy(camera.position).addScaledVector(dir, aimRayDistance);
}

export { _aimPoint };
