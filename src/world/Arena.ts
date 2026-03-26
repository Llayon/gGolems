import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PropManager } from './PropManager';

export class Arena {
    meshes: THREE.Mesh[] = [];
    propManager: PropManager;

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        this.meshes.push(ground);

        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        const groundBody = physics.createRigidBody(groundBodyDesc);
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
        physics.createCollider(groundColliderDesc, groundBody);

        this.createBox(scene, physics, 0, 2.5, -20, 40, 5, 2, 0x3a3a45);
        this.createBox(scene, physics, 0, 2.5, 20, 40, 5, 2, 0x3a3a45);
        this.createBox(scene, physics, -20, 2.5, 0, 2, 5, 40, 0x3a3a45);
        this.createBox(scene, physics, 20, 2.5, 0, 2, 5, 40, 0x3a3a45);
        
        this.createBox(scene, physics, -8, 1.5, -8, 4, 3, 4, 0x4a4a55);
        this.createBox(scene, physics, 8, 1.5, 8, 4, 3, 4, 0x4a4a55);
        
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
