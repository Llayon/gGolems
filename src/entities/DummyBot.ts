import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class DummyBot {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    hp = 100;
    mat: THREE.MeshStandardMaterial;
    damageTimer = 0;
    targetPos = new THREE.Vector3();
    isHost: boolean;

    constructor(scene: THREE.Scene, physics: RAPIER.World, x: number, y: number, z: number, isHost: boolean = true) {
        this.isHost = isHost;
        const geo = new THREE.BoxGeometry(2, 3, 2);
        this.mat = new THREE.MeshStandardMaterial({ color: 0x882222 });
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.position.set(x, y, z);
        this.targetPos.set(x, y, z);
        this.mesh.castShadow = true;
        scene.add(this.mesh);

        const bodyDesc = isHost ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
        bodyDesc.setTranslation(x, y, z).lockRotations();
        this.body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1.5, 1);
        physics.createCollider(colliderDesc, this.body);
    }

    takeDamage(amount: number) {
        this.hp -= amount;
        this.damageTimer = 0.1;
        this.mat.emissive.setHex(0xffffff);
        if (this.hp <= 0) {
            this.hp = 100;
            this.body.setTranslation({ x: (Math.random() - 0.5) * 60, y: 5, z: (Math.random() - 0.5) * 60 }, true);
        }
    }

    update(dt: number) {
        if (this.damageTimer > 0) {
            this.damageTimer -= dt;
            if (this.damageTimer <= 0) {
                this.mat.emissive.setHex(0x000000);
            }
        }
        
        if (!this.isHost) {
            const currentPos = this.body.translation();
            const dist = this.targetPos.distanceTo(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));
            if (dist > 5) {
                this.body.setNextKinematicTranslation(this.targetPos);
            } else {
                const newPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).lerp(this.targetPos, 0.3);
                this.body.setNextKinematicTranslation(newPos);
            }
        }

        const pos = this.body.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
    }
}
