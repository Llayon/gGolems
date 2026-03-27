import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PropManager } from './PropManager';

export class Arena {
    meshes: THREE.Mesh[] = [];
    propManager: PropManager;
    readonly halfSize = 78;
    readonly spawnRadius = 62;
    readonly botSpawn = new THREE.Vector3(0, 5, -54);

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const arenaHalfSize = this.halfSize;
        const wallThickness = 2;
        const wallHeight = 6;
        const wallSpan = arenaHalfSize * 2 - wallThickness * 2;

        const groundGeo = new THREE.PlaneGeometry(arenaHalfSize * 2, arenaHalfSize * 2);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        this.meshes.push(ground);

        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        const groundBody = physics.createRigidBody(groundBodyDesc);
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(arenaHalfSize, 0.1, arenaHalfSize);
        physics.createCollider(groundColliderDesc, groundBody);

        this.createBox(scene, physics, 0, wallHeight / 2, -arenaHalfSize, wallSpan, wallHeight, wallThickness, 0x3a3a45);
        this.createBox(scene, physics, 0, wallHeight / 2, arenaHalfSize, wallSpan, wallHeight, wallThickness, 0x3a3a45);
        this.createBox(scene, physics, -arenaHalfSize, wallHeight / 2, 0, wallThickness, wallHeight, wallSpan, 0x3a3a45);
        this.createBox(scene, physics, arenaHalfSize, wallHeight / 2, 0, wallThickness, wallHeight, wallSpan, 0x3a3a45);

        this.createBox(scene, physics, -32, 1.75, -24, 6, 3.5, 6, 0x4a4a55);
        this.createBox(scene, physics, 32, 1.75, 24, 6, 3.5, 6, 0x4a4a55);
        this.createBox(scene, physics, -28, 2.25, 28, 8, 4.5, 6, 0x4a4a55);
        this.createBox(scene, physics, 28, 2.25, -28, 8, 4.5, 6, 0x4a4a55);
        this.createBox(scene, physics, 0, 2.5, -42, 10, 5, 8, 0x4a4a55);
        this.createBox(scene, physics, 0, 2.5, 42, 10, 5, 8, 0x4a4a55);
        this.createBox(scene, physics, -50, 2, 0, 6, 4, 10, 0x4a4a55);
        this.createBox(scene, physics, 50, 2, 0, 6, 4, 10, 0x4a4a55);
        this.createBox(scene, physics, -12, 1.5, 0, 4, 3, 4, 0x565662);
        this.createBox(scene, physics, 12, 1.5, 0, 4, 3, 4, 0x565662);
        
        this.propManager = new PropManager(scene);
    }

    createBox(scene: THREE.Scene, physics: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        this.meshes.push(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2);
        physics.createCollider(colliderDesc, body);
    }
}
