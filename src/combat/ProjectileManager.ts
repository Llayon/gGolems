import * as THREE from 'three';
import { DummyBot } from '../entities/DummyBot';
import { GolemController } from '../entities/GolemController';
import { DecalManager } from '../fx/DecalManager';

export class ProjectileManager {
    projectiles: { mesh: THREE.Mesh, dir: THREE.Vector3, life: number, active: boolean, ownerId: string }[] = [];
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
        this.projectiles.push({ mesh, dir: dir.normalize(), life: 2.0, active: true, ownerId });
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
            
            // World collision
            this.raycaster.set(p.mesh.position, p.dir);
            const intersects = this.raycaster.intersectObjects(colliders);
            if (intersects.length > 0 && intersects[0].distance < 1.0) {
                p.active = false;
                this.scene.remove(p.mesh);
                decals.addBulletMark(intersects[0].point, intersects[0].face?.normal || new THREE.Vector3(0, 1, 0));
                continue;
            }

            // Dummy collision
            if (p.mesh.position.distanceTo(dummyPos) < 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) dummy.takeDamage(15);
                continue;
            }

            // Player collisions
            // Check local player
            if (p.ownerId !== localId && p.mesh.position.distanceTo(localPlayer.model.position) < 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) onPlayerHit(localId, 15);
                continue;
            }

            // Check remote players
            let hitRemote = false;
            for (const [pid, player] of players.entries()) {
                if (p.ownerId !== pid && p.mesh.position.distanceTo(player.model.position) < 2.5) {
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
