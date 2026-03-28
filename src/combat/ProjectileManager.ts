import * as THREE from 'three';
import { PROJECTILE_PROFILES } from './weapons';
import type { ProjectileProfileId, WeaponId } from './weaponTypes';
import { DummyBot } from '../entities/DummyBot';
import { GolemController, GolemSection } from '../entities/GolemController';
import { DecalManager } from '../fx/DecalManager';
import { PropManager } from '../world/PropManager';

const _segment = new THREE.Vector3();
const _segmentDir = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();
const _travelLine = new THREE.Line3();
const _sectionCenter = new THREE.Vector3();
const _sectionOffset = new THREE.Vector3();
const _sectionWorld = new THREE.Vector3();

type HitResult = { section: GolemSection; distanceSq: number } | null;

type ProjectileInstance = {
    mesh: THREE.Mesh;
    dir: THREE.Vector3;
    prevPos: THREE.Vector3;
    life: number;
    active: boolean;
    ownerId: string;
    damage: number;
    speed: number;
    weaponId: WeaponId;
    profile: ProjectileProfileId;
};

type ProjectileSpawnSpec = {
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    ownerId: string;
    weaponId: WeaponId;
    profile: ProjectileProfileId;
    damage: number;
    speed: number;
    range: number;
};

export class ProjectileManager {
    projectiles: ProjectileInstance[] = [];
    scene: THREE.Scene;
    geometryByProfile: Record<ProjectileProfileId, THREE.SphereGeometry>;
    materialByProfile: Record<ProjectileProfileId, THREE.MeshStandardMaterial>;
    raycaster = new THREE.Raycaster();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geometryByProfile = {
            bolt: new THREE.SphereGeometry(PROJECTILE_PROFILES.bolt.radius, 8, 8),
            arc_pulse: new THREE.SphereGeometry(PROJECTILE_PROFILES.arc_pulse.radius, 8, 8),
            steam_slug: new THREE.SphereGeometry(PROJECTILE_PROFILES.steam_slug.radius, 10, 10)
        };
        this.materialByProfile = {
            bolt: new THREE.MeshStandardMaterial({
                color: PROJECTILE_PROFILES.bolt.color,
                emissive: PROJECTILE_PROFILES.bolt.emissive,
                emissiveIntensity: PROJECTILE_PROFILES.bolt.emissiveIntensity
            }),
            arc_pulse: new THREE.MeshStandardMaterial({
                color: PROJECTILE_PROFILES.arc_pulse.color,
                emissive: PROJECTILE_PROFILES.arc_pulse.emissive,
                emissiveIntensity: PROJECTILE_PROFILES.arc_pulse.emissiveIntensity
            }),
            steam_slug: new THREE.MeshStandardMaterial({
                color: PROJECTILE_PROFILES.steam_slug.color,
                emissive: PROJECTILE_PROFILES.steam_slug.emissive,
                emissiveIntensity: PROJECTILE_PROFILES.steam_slug.emissiveIntensity
            })
        };
    }

    fire(spec: ProjectileSpawnSpec) {
        const geometry = this.geometryByProfile[spec.profile];
        const material = this.materialByProfile[spec.profile];
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(spec.origin);
        this.scene.add(mesh);
        this.projectiles.push({
            mesh,
            dir: spec.dir.clone().normalize(),
            life: Math.max(0.35, spec.range / Math.max(spec.speed, 0.1)),
            active: true,
            ownerId: spec.ownerId,
            prevPos: spec.origin.clone(),
            damage: spec.damage,
            speed: spec.speed,
            weaponId: spec.weaponId,
            profile: spec.profile
        });
    }

    update(dt: number) {
        for (const p of this.projectiles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                this.scene.remove(p.mesh);
                continue;
            }
            p.prevPos.copy(p.mesh.position);
            p.mesh.position.addScaledVector(p.dir, p.speed * dt);
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
        props: PropManager,
        decals: DecalManager,
        onPlayerHit: (ownerId: string, targetId: string, damage: number, section: GolemSection | '__dummy__') => void
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
                const hit = intersects[0];
                const consumedByProp = props.handleProjectileHit(hit.object, hit.point, p.damage, isHost);
                if (!consumedByProp) {
                    decals.addBulletMark(hit.point);
                }
                continue;
            }

            // Dummy collision
            _travelLine.closestPointToPoint(dummyPos, true, _closestPoint);
            if (p.ownerId !== 'solo-bot' && _closestPoint.distanceToSquared(dummyPos) < 2.5 * 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) onPlayerHit(p.ownerId, '__dummy__', p.damage, '__dummy__');
                continue;
            }

            // Player collisions
            // Check local player
            const localHit = this.getGolemHitSection(localPlayer);
            if (p.ownerId !== localId && localHit) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) onPlayerHit(p.ownerId, localId, p.damage, localHit.section);
                continue;
            }

            // Check remote players
            let hitRemote = false;
            for (const [pid, player] of players.entries()) {
                const remoteHit = this.getGolemHitSection(player);
                if (p.ownerId !== pid && remoteHit) {
                    p.active = false;
                    this.scene.remove(p.mesh);
                    if (isHost) onPlayerHit(p.ownerId, pid, p.damage, remoteHit.section);
                    hitRemote = true;
                    break;
                }
            }
            if (hitRemote) continue;
        }
    }

    getGolemHitSection(player: GolemController): HitResult {
        let bestHit: HitResult = null;

        const testSphere = (center: THREE.Vector3, radius: number, section: GolemSection) => {
            _travelLine.closestPointToPoint(center, true, _closestPoint);
            const distanceSq = _closestPoint.distanceToSquared(center);
            if (distanceSq > radius * radius) return;
            if (!bestHit || distanceSq < bestHit.distanceSq) {
                bestHit = { section, distanceSq };
            }
        };

        player.head.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 0.7, 'head');

        player.torso.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 1.35, 'centerTorso');

        _sectionOffset.set(-0.95, 0, 0);
        player.torso.localToWorld(_sectionWorld.copy(_sectionOffset));
        testSphere(_sectionWorld, 1.05, 'leftTorso');

        _sectionOffset.set(0.95, 0, 0);
        player.torso.localToWorld(_sectionWorld.copy(_sectionOffset));
        testSphere(_sectionWorld, 1.05, 'rightTorso');

        player.leftArm.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 1.0, 'leftArm');

        player.rightArm.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 1.0, 'rightArm');

        player.leftLeg.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 0.95, 'leftLeg');

        player.rightLeg.getWorldPosition(_sectionCenter);
        testSphere(_sectionCenter, 0.95, 'rightLeg');

        return bestHit;
    }
}
