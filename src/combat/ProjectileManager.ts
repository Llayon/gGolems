import * as THREE from 'three';
import { DummyBot } from '../entities/DummyBot';
import { GolemController } from '../entities/GolemController';
import { DecalManager } from '../fx/DecalManager';

const _segment = new THREE.Vector3();
const _segmentDir = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();
const _travelLine = new THREE.Line3();

export class ProjectileManager {
    projectiles: { mesh: THREE.Mesh, dir: THREE.Vector3, life: number, active: boolean, ownerId: string, prevPos: THREE.Vector3 }[] = [];
    scene: THREE.Scene;
    geo: THREE.SphereGeometry;
    mat: THREE.MeshStandardMaterial;
    raycaster = new THREE.Raycaster();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geo = new THREE.SphereGeometry(0.2, 8, 8);
        this.mat = new THREE.MeshStandardMaterial({ color: 0x00AAFF, emissive: 0x00AAFF, emissiveIntensity: 2 });
    }

    fire(origin: THREE.Vector3, dir: THREE.Vector3, ownerId: string) {
        const mesh = new THREE.Mesh(this.geo, this.mat);
        mesh.position.copy(origin);
        this.scene.add(mesh);
        this.projectiles.push({ mesh, dir: dir.normalize(), life: 2.0, active: true, ownerId, prevPos: origin.clone() });
    }

    update(dt: number) {
        const speed = 60;
        for (const p of this.projectiles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                this.scene.remove(p.mesh);
                continue;
            }
            p.prevPos.copy(p.mesh.position);
            p.mesh.position.addScaledVector(p.dir, speed * dt);
        }
        this.projectiles = this.projectiles.filter(p => p.active);
    }

    checkCollisions(
        dummy: DummyBot, 
        players: Map<string, GolemController>, 
        localPlayer: GolemController, 
        localId: string, 
        isHost: boolean, 
        colliders: THREE.Mesh[],
        decals: DecalManager,
        onPlayerHit: (targetId: string, damage: number) => void
    ) {
        const dummyPos = dummy.mesh.position;
        for (const p of this.projectiles) {
            if (!p.active) continue;

            _travelLine.start.copy(p.prevPos);
            _travelLine.end.copy(p.mesh.position);
            _segment.copy(p.mesh.position).sub(p.prevPos);
            const travelDistance = _segment.length();
            if (travelDistance <= 0.0001) continue;
            _segmentDir.copy(_segment).divideScalar(travelDistance);

            // World collision
            this.raycaster.set(p.prevPos, _segmentDir);
            const intersects = this.raycaster.intersectObjects(colliders);
            if (intersects.length > 0 && intersects[0].distance <= travelDistance) {
                p.active = false;
                this.scene.remove(p.mesh);
                decals.addBulletMark(intersects[0].point);
                continue;
            }

            // Dummy collision
            _travelLine.closestPointToPoint(dummyPos, true, _closestPoint);
            if (_closestPoint.distanceToSquared(dummyPos) < 2.5 * 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) dummy.takeDamage(15);
                continue;
            }

            // Player collisions
            // Check local player
            _travelLine.closestPointToPoint(localPlayer.model.position, true, _closestPoint);
            if (p.ownerId !== localId && _closestPoint.distanceToSquared(localPlayer.model.position) < 2.5 * 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) onPlayerHit(localId, 15);
                continue;
            }

            // Check remote players
            let hitRemote = false;
            for (const [pid, player] of players.entries()) {
                _travelLine.closestPointToPoint(player.model.position, true, _closestPoint);
                if (p.ownerId !== pid && _closestPoint.distanceToSquared(player.model.position) < 2.5 * 2.5) {
                    p.active = false;
                    this.scene.remove(p.mesh);
                    if (isHost) onPlayerHit(pid, 15);
                    hitRemote = true;
                    break;
                }
            }
            if (hitRemote) continue;
        }
    }
}
