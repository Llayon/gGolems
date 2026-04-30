import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { isProtectedTerrainPadArea } from './HeightmapSource';

type BoxMassConfig = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
    roughness?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
};

type CylinderMassConfig = {
    x: number;
    y: number;
    z: number;
    radius: number;
    height: number;
    color: number;
    roughness?: number;
    rotationY?: number;
};

type RockMoundConfig = {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    color: number;
    roughness?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
};

const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function markShadows(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

export function buildTerrainMasses(
    scene: THREE.Scene,
    physics: RAPIER.World,
    sampleHeight: (x: number, z: number) => number,
    collisionMeshes: THREE.Mesh[]
) {
    const rock = 0x56493f;
    const darkRock = 0x473c34;

    const ridgeMounds: RockMoundConfig[] = [
        { x: -110, y: 6.2, z: -74, sx: 11, sy: 7.2, sz: 12, color: darkRock, rotationY: 0.24 },
        { x: -112, y: 6.8, z: -26, sx: 13, sy: 8.2, sz: 14, color: darkRock, rotationY: 0.18 },
        { x: -108, y: 6.9, z: 22, sx: 12, sy: 8.1, sz: 16, color: darkRock, rotationY: -0.12 },
        { x: -102, y: 6.2, z: 68, sx: 11, sy: 7.2, sz: 13, color: darkRock, rotationY: -0.24 },
        { x: -86, y: 4.8, z: 80, sx: 15, sy: 6.1, sz: 11, color: rock, rotationY: -0.16 },
        { x: -78, y: 5.6, z: -108, sx: 16, sy: 7.2, sz: 10, color: darkRock, rotationY: 0.04 },
        { x: -28, y: 5.2, z: -110, sx: 18, sy: 6.4, sz: 9, color: darkRock, rotationY: -0.08 },
        { x: 26, y: 5.2, z: -106, sx: 18, sy: 6.2, sz: 10, color: darkRock, rotationY: 0.1 },
        { x: 78, y: 5.0, z: -102, sx: 15, sy: 6.0, sz: 9, color: darkRock, rotationY: -0.1 },
        { x: -58, y: 5.4, z: 110, sx: 18, sy: 6.2, sz: 10, color: darkRock, rotationY: 0.08 },
        { x: -2, y: 5.6, z: 108, sx: 18, sy: 6.3, sz: 11, color: darkRock, rotationY: -0.04 },
        { x: 50, y: 5.4, z: 110, sx: 17, sy: 6.1, sz: 10, color: darkRock, rotationY: 0.06 },
        { x: 96, y: 5.0, z: 104, sx: 14, sy: 5.8, sz: 9, color: darkRock, rotationY: -0.08 },
        { x: 108, y: 6.0, z: -58, sx: 12, sy: 6.6, sz: 11, color: rock, rotationY: -0.18 },
        { x: 104, y: 6.1, z: -8, sx: 12, sy: 7.0, sz: 14, color: rock, rotationY: 0.04 },
        { x: 104, y: 6.1, z: 44, sx: 11, sy: 6.8, sz: 13, color: rock, rotationY: -0.12 },
        { x: 98, y: 5.5, z: 86, sx: 11, sy: 6.0, sz: 10, color: rock, rotationY: 0.2 },
        { x: -66, y: 3.8, z: -52, sx: 10, sy: 4.4, sz: 8, color: 0x64584c, rotationY: -0.16 },
        { x: 64, y: 3.8, z: -48, sx: 10, sy: 4.4, sz: 8, color: 0x64584c, rotationY: 0.14 },
        { x: 84, y: 4.6, z: 62, sx: 14, sy: 5.0, sz: 9, color: 0x5c4f43, rotationY: -0.06 }
    ];

    ridgeMounds
        .filter((c) => !isProtectedTerrainPadArea(c.x, c.z, Math.max(c.sx, c.sz) * 0.8))
        .forEach((c) => addRockMound(scene, physics, sampleHeight, collisionMeshes, c));

    [
        { x: -18, y: 2.8, z: 96, radius: 8, height: 5.6, color: 0x5e5146 },
        { x: 54, y: 2.3, z: -82, radius: 6, height: 4.6, color: 0x5b4d42 },
        { x: -82, y: 2.6, z: 92, radius: 7.4, height: 5.2, color: 0x5d5147 },
        { x: 100, y: 2.8, z: 74, radius: 7.6, height: 5.4, color: 0x61544a }
    ]
        .filter((c) => !isProtectedTerrainPadArea(c.x, c.z, c.radius * 1.25))
        .forEach((c) => addCylinderMass(scene, physics, sampleHeight, collisionMeshes, c));
}

function addBoxMass(
    scene: THREE.Scene,
    physics: RAPIER.World,
    sampleHeight: (x: number, z: number) => number,
    collisionMeshes: THREE.Mesh[],
    config: BoxMassConfig
) {
    const geometry = new THREE.BoxGeometry(config.w, config.h, config.d);
    const material = new THREE.MeshStandardMaterial({ color: config.color, roughness: config.roughness ?? 0.95 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(config.x, sampleHeight(config.x, config.z) + config.y, config.z);
    mesh.rotation.set(config.rotationX ?? 0, config.rotationY ?? 0, config.rotationZ ?? 0);
    markShadows(mesh);
    scene.add(mesh);
    collisionMeshes.push(mesh);

    _euler.set(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
    _quat.setFromEuler(_euler);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w });
    const body = physics.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(config.w / 2, config.h / 2, config.d / 2);
    physics.createCollider(collider, body);
}

function addCylinderMass(
    scene: THREE.Scene,
    physics: RAPIER.World,
    sampleHeight: (x: number, z: number) => number,
    collisionMeshes: THREE.Mesh[],
    config: CylinderMassConfig
) {
    const geometry = new THREE.CylinderGeometry(config.radius, config.radius * 1.1, config.height, 10);
    const material = new THREE.MeshStandardMaterial({ color: config.color, roughness: config.roughness ?? 0.96 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(config.x, sampleHeight(config.x, config.z) + config.y, config.z);
    mesh.rotation.y = config.rotationY ?? 0;
    markShadows(mesh);
    scene.add(mesh);
    collisionMeshes.push(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    const body = physics.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cylinder(config.height / 2, config.radius);
    physics.createCollider(collider, body);
}

function addRockMound(
    scene: THREE.Scene,
    physics: RAPIER.World,
    sampleHeight: (x: number, z: number) => number,
    collisionMeshes: THREE.Mesh[],
    config: RockMoundConfig
) {
    const geometry = new THREE.DodecahedronGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({ color: config.color, roughness: config.roughness ?? 0.98 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(config.sx, config.sy, config.sz);
    mesh.position.set(config.x, sampleHeight(config.x, config.z) + config.y, config.z);
    mesh.rotation.set(config.rotationX ?? 0, config.rotationY ?? 0, config.rotationZ ?? 0);
    markShadows(mesh);
    scene.add(mesh);
    collisionMeshes.push(mesh);

    _euler.set(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
    _quat.setFromEuler(_euler);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w });
    const body = physics.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(config.sx * 0.82, config.sy * 0.8, config.sz * 0.82);
    physics.createCollider(collider, body);
}
