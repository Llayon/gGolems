import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const _currentPos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _desiredVelocity = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();

export class DummyBot {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    hp = 100;
    mat: THREE.MeshStandardMaterial;
    damageTimer = 0;
    targetPos = new THREE.Vector3();
    isHost: boolean;
    strafeSign = Math.random() > 0.5 ? 1 : -1;
    strafeTimer = 0.8;
    fireCooldown = 1.2;
    respawnRadius = 62;

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
            this.body.setTranslation({
                x: (Math.random() - 0.5) * this.respawnRadius * 2,
                y: 5,
                z: (Math.random() - 0.5) * this.respawnRadius * 2
            }, true);
            this.fireCooldown = 1.5;
        }
    }

    update(dt: number, target?: THREE.Vector3) {
        let shot: { origin: THREE.Vector3; dir: THREE.Vector3 } | null = null;

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
        } else if (target) {
            const pos = this.body.translation();
            _currentPos.set(pos.x, pos.y, pos.z);
            _toTarget.copy(target).sub(_currentPos);
            _toTarget.y = 0;

            const distance = _toTarget.length();
            if (distance > 0.001) {
                _toTarget.divideScalar(distance);
                _strafe.set(-_toTarget.z, 0, _toTarget.x);

                this.strafeTimer -= dt;
                if (this.strafeTimer <= 0) {
                    this.strafeTimer = 1.25 + Math.random() * 1.5;
                    this.strafeSign = Math.random() > 0.5 ? 1 : -1;
                }

                _desiredVelocity.set(0, 0, 0);
                if (distance > 21) {
                    _desiredVelocity.add(_toTarget);
                } else if (distance < 11) {
                    _desiredVelocity.addScaledVector(_toTarget, -0.9);
                }
                _desiredVelocity.addScaledVector(_strafe, this.strafeSign * 0.9);

                if (_desiredVelocity.lengthSq() > 0.0001) {
                    _desiredVelocity.normalize().multiplyScalar(8.5);
                }

                const currentVelocity = this.body.linvel();
                this.body.setLinvel({ x: _desiredVelocity.x, y: currentVelocity.y, z: _desiredVelocity.z }, true);

                _aimPoint.copy(target);
                _aimPoint.y = _currentPos.y + 1.2;
                this.mesh.lookAt(_aimPoint);

                this.fireCooldown -= dt;
                if (this.fireCooldown <= 0 && distance < 58) {
                    const origin = _currentPos.clone().addScaledVector(_toTarget, 1.6);
                    origin.y += 1.25;
                    const dir = target.clone().sub(origin).normalize();
                    shot = { origin, dir };
                    this.fireCooldown = 1.35 + Math.random() * 0.75;
                }
            }
        } else {
            const currentVelocity = this.body.linvel();
            this.body.setLinvel({ x: currentVelocity.x * 0.86, y: currentVelocity.y, z: currentVelocity.z * 0.86 }, true);
        }

        const pos = this.body.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
        return shot;
    }
}
