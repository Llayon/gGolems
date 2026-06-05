import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export type BoxConfig = {
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
    yOffset?: number;
    rotationY?: number;
};

export type ColliderContext = {
    surfaceY: (x: number, z: number) => number;
    meshes: THREE.Mesh[];
};

export function createBox(ctx: ColliderContext, scene: THREE.Scene, physics: RAPIER.World, config: BoxConfig) {
    const geo = new THREE.BoxGeometry(config.w, config.h, config.d);
    const mat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.94 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(config.x, ctx.surfaceY(config.x, config.z) + (config.yOffset ?? config.h / 2), config.z);
    mesh.rotation.y = config.rotationY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    ctx.meshes.push(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    if (mesh.rotation.y !== 0) {
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, mesh.rotation.y, 0));
        bodyDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    }
    const body = physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(config.w / 2, config.h / 2, config.d / 2);
    physics.createCollider(colliderDesc, body);
}

export function createCylinderCollider(physics: RAPIER.World, root: THREE.Group, localPosition: THREE.Vector3, radius: number, height: number) {
    const worldPosition = localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y).add(root.position);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
    const body = physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius);
    physics.createCollider(colliderDesc, body);
}

export function createBoxCollider(
    physics: RAPIER.World,
    root: THREE.Group,
    localPosition: THREE.Vector3,
    w: number,
    h: number,
    d: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number
) {
    const worldPosition = localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y).add(root.position);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, root.rotation.y + rotationY, rotationZ));
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    const body = physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    physics.createCollider(colliderDesc, body);
}

export function registerGroupMeshes(meshes: THREE.Mesh[], root: THREE.Group) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            if (child.userData.nonCollision) {
                return;
            }
            child.castShadow = true;
            child.receiveShadow = true;
            meshes.push(child);
        }
    });
}
