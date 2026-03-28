import * as THREE from 'three';
import type { ControlOwner, ControlPointId, ControlPointView, TeamId } from './types';

type UnitPresence = {
    team: TeamId;
    position: THREE.Vector3;
    alive: boolean;
};

type ControlPointRecord = ControlPointView & {
    position: THREE.Vector3;
    outerRing: THREE.Mesh;
    fill: THREE.Mesh;
    progressRing: THREE.Mesh;
    beacon: THREE.Mesh;
    beaconCap: THREE.Mesh;
    beam: THREE.Mesh;
    bannerLeft: THREE.Mesh;
    bannerRight: THREE.Mesh;
    label: THREE.Sprite;
    contested: boolean;
    blueInside: number;
    redInside: number;
};

const ARC_START = -Math.PI / 2;

function createProgressGeometry(progress: number) {
    const clamped = Math.max(0.001, Math.min(1, progress));
    return new THREE.RingGeometry(8.55, 10.75, 48, 1, ARC_START, Math.PI * 2 * clamped);
}

function colorForOwner(owner: ControlOwner) {
    switch (owner) {
        case 'blue':
            return new THREE.Color(0x4bc0ff);
        case 'red':
            return new THREE.Color(0xff7a52);
        default:
            return new THREE.Color(0xe0b36c);
    }
}

function createLabelSprite(id: ControlPointId) {
    if (typeof document === 'undefined') {
        return new THREE.Sprite();
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return new THREE.Sprite();
    }
    canvas.width = 128;
    canvas.height = 128;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(12, 10, 8, 0.78)';
    ctx.beginPath();
    ctx.arc(64, 64, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b98744';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#f1d7a0';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id, 64, 68);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(5.4, 5.4, 1);
    return sprite;
}

export class ControlPointManager {
    points: ControlPointRecord[];
    captureRate = 0.23;
    scoreTickInterval = 1;
    scorePerOwnedPoint = 1;
    scoreTimer = 0;
    time = 0;

    constructor(scene: THREE.Scene, positions: Record<ControlPointId, THREE.Vector3>) {
        this.points = (Object.entries(positions) as Array<[ControlPointId, THREE.Vector3]>).map(([id, position]) => {
            const outerRing = new THREE.Mesh(
                new THREE.RingGeometry(11.15, 12.75, 56),
                new THREE.MeshBasicMaterial({
                    color: 0xe0b36c,
                    transparent: true,
                    opacity: 0.38,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            outerRing.rotation.x = -Math.PI / 2;
            outerRing.position.copy(position);
            outerRing.position.y += 0.2;
            scene.add(outerRing);

            const fill = new THREE.Mesh(
                new THREE.CircleGeometry(8.45, 44),
                new THREE.MeshBasicMaterial({
                    color: 0xe0b36c,
                    transparent: true,
                    opacity: 0.08,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            fill.rotation.x = -Math.PI / 2;
            fill.position.copy(position);
            fill.position.y += 0.16;
            scene.add(fill);

            const progressRing = new THREE.Mesh(
                createProgressGeometry(0.02),
                new THREE.MeshBasicMaterial({
                    color: 0xe0b36c,
                    transparent: true,
                    opacity: 0.52,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            progressRing.rotation.x = -Math.PI / 2;
            progressRing.position.copy(position);
            progressRing.position.y += 0.24;
            scene.add(progressRing);

            const beacon = new THREE.Mesh(
                new THREE.CylinderGeometry(0.34, 0.34, 9.6, 10),
                new THREE.MeshStandardMaterial({
                    color: 0x4e4035,
                    emissive: 0xe0b36c,
                    emissiveIntensity: 0.8,
                    roughness: 0.64,
                    metalness: 0.18
                })
            );
            beacon.position.copy(position);
            beacon.position.y += 4.8;
            beacon.castShadow = true;
            scene.add(beacon);

            const beaconCap = new THREE.Mesh(
                new THREE.SphereGeometry(0.9, 12, 12),
                new THREE.MeshStandardMaterial({
                    color: 0x7c6042,
                    emissive: 0xe0b36c,
                    emissiveIntensity: 0.9,
                    roughness: 0.34,
                    metalness: 0.12
                })
            );
            beaconCap.position.copy(position);
            beaconCap.position.y += 9.6;
            beaconCap.castShadow = true;
            scene.add(beaconCap);

            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.95, 1.8, 20, 14, 1, true),
                new THREE.MeshBasicMaterial({
                    color: 0xe0b36c,
                    transparent: true,
                    opacity: 0.14,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            beam.position.copy(position);
            beam.position.y += 10.5;
            scene.add(beam);

            const bannerMaterial = new THREE.MeshStandardMaterial({
                color: 0x7a5c3d,
                emissive: 0xe0b36c,
                emissiveIntensity: 0.55,
                roughness: 0.74,
                metalness: 0.12,
                side: THREE.DoubleSide
            });
            const bannerLeft = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.8), bannerMaterial);
            bannerLeft.position.copy(position);
            bannerLeft.position.y += 7.4;
            bannerLeft.position.x -= 2.1;
            bannerLeft.rotation.y = Math.PI / 2;
            bannerLeft.castShadow = true;
            scene.add(bannerLeft);

            const bannerRight = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.8), bannerMaterial.clone());
            bannerRight.position.copy(position);
            bannerRight.position.y += 7.4;
            bannerRight.position.x += 2.1;
            bannerRight.rotation.y = -Math.PI / 2;
            bannerRight.castShadow = true;
            scene.add(bannerRight);

            const label = createLabelSprite(id);
            label.position.copy(position);
            label.position.y += 11.6;
            scene.add(label);

            return {
                id,
                owner: 'neutral',
                capture: 0,
                radius: 12.6,
                position: position.clone(),
                outerRing,
                fill,
                progressRing,
                beacon,
                beaconCap,
                beam,
                bannerLeft,
                bannerRight,
                label
                ,
                contested: false,
                blueInside: 0,
                redInside: 0
            };
        });
    }

    setState(nextPoints: ControlPointView[]) {
        for (const point of this.points) {
            const next = nextPoints.find((entry) => entry.id === point.id);
            if (!next) continue;
            point.owner = next.owner;
            point.capture = next.capture;
            point.contested = next.contested;
            point.blueInside = next.blueInside;
            point.redInside = next.redInside;
            this.applyVisual(point);
        }
    }

    getSnapshot() {
        return this.points.map(({ id, owner, capture, radius, contested, blueInside, redInside }) => ({
            id,
            owner,
            capture,
            radius,
            contested,
            blueInside,
            redInside
        }));
    }

    update(dt: number, units: UnitPresence[]) {
        this.time += dt;
        for (const point of this.points) {
            let blueInside = 0;
            let redInside = 0;

            for (const unit of units) {
                if (!unit.alive) continue;
                const distance = unit.position.distanceTo(point.position);
                if (distance > point.radius) continue;
                if (unit.team === 'blue') blueInside++;
                else redInside++;
            }

            point.blueInside = blueInside;
            point.redInside = redInside;
            point.contested = blueInside > 0 && redInside > 0;

            if (blueInside > 0 && redInside === 0) {
                point.capture = Math.min(1, point.capture + this.captureRate * dt);
            } else if (redInside > 0 && blueInside === 0) {
                point.capture = Math.max(-1, point.capture - this.captureRate * dt);
            }

            if (point.capture >= 1) {
                point.owner = 'blue';
            } else if (point.capture <= -1) {
                point.owner = 'red';
            } else if (Math.abs(point.capture) < 0.08) {
                point.owner = 'neutral';
            }

            this.applyVisual(point);
        }
    }

    tickScore(dt: number) {
        this.scoreTimer += dt;
        if (this.scoreTimer < this.scoreTickInterval) {
            return { blue: 0, red: 0 };
        }
        this.scoreTimer = 0;
        let blue = 0;
        let red = 0;
        for (const point of this.points) {
            if (point.owner === 'blue') blue += this.scorePerOwnedPoint;
            else if (point.owner === 'red') red += this.scorePerOwnedPoint;
        }
        return { blue, red };
    }

    applyVisual(point: ControlPointRecord) {
        const owner = point.contested
            ? 'neutral'
            : point.owner !== 'neutral'
            ? point.owner
            : point.capture > 0.04
                ? 'blue'
                : point.capture < -0.04
                    ? 'red'
                    : 'neutral';
        const displayOwner = point.contested ? 'neutral' : owner;
        const color = point.contested ? new THREE.Color(0xf2bc63) : colorForOwner(displayOwner);
        const progress = Math.min(1, Math.abs(point.capture));
        const pulse = 0.82 + Math.sin(this.time * 2.8 + point.position.x * 0.04 + point.position.z * 0.03) * 0.18;
        const outerRingMat = point.outerRing.material as THREE.MeshBasicMaterial;
        outerRingMat.color.copy(color);
        outerRingMat.opacity = point.contested ? 0.5 + Math.sin(this.time * 6) * 0.12 : 0.24 + progress * 0.22 * pulse;

        const fillMat = point.fill.material as THREE.MeshBasicMaterial;
        fillMat.color.copy(color);
        fillMat.opacity = point.contested ? 0.14 : 0.04 + progress * 0.16;

        const progressMat = point.progressRing.material as THREE.MeshBasicMaterial;
        progressMat.color.copy(color);
        progressMat.opacity = progress > 0.02 ? (point.contested ? 0.48 : 0.38 + progress * 0.34) : 0;
        const nextGeometry = createProgressGeometry(progress > 0.02 ? progress : 0.02);
        point.progressRing.geometry.dispose();
        point.progressRing.geometry = nextGeometry;

        const beaconMat = point.beacon.material as THREE.MeshStandardMaterial;
        beaconMat.emissive.copy(color);
        beaconMat.emissiveIntensity = (0.45 + progress * 1.1) * pulse;
        beaconMat.color.set(point.contested ? 0x6d4e34 : 0x4e4035);

        const capMat = point.beaconCap.material as THREE.MeshStandardMaterial;
        capMat.emissive.copy(color);
        capMat.color.set(point.contested ? 0xd39957 : color.offsetHSL(0, 0.02, -0.16));
        capMat.emissiveIntensity = (0.8 + progress * 1.4) * pulse;
        point.beaconCap.scale.setScalar(point.contested ? 1.08 : 0.92 + progress * 0.2);

        const beamMat = point.beam.material as THREE.MeshBasicMaterial;
        beamMat.color.copy(color);
        beamMat.opacity = point.contested
            ? 0.18 + Math.sin(this.time * 7) * 0.05
            : 0.06 + progress * 0.18 * pulse;
        point.beam.scale.set(
            0.92 + progress * 0.22,
            0.96 + progress * 0.28,
            0.92 + progress * 0.22
        );

        const bannerTilt = Math.sin(this.time * 3.2 + point.position.x * 0.04) * 0.08;
        const bannerTone = point.contested ? new THREE.Color(0xd39957) : color.clone().offsetHSL(0, 0.03, -0.08);
        const bannerLeftMat = point.bannerLeft.material as THREE.MeshStandardMaterial;
        bannerLeftMat.color.copy(bannerTone);
        bannerLeftMat.emissive.copy(color);
        bannerLeftMat.emissiveIntensity = 0.32 + progress * 0.7;
        point.bannerLeft.rotation.set(0, Math.PI / 2 + bannerTilt, -0.08 - bannerTilt * 0.5);
        point.bannerLeft.position.y = point.position.y + 7.4 + progress * 0.45;

        const bannerRightMat = point.bannerRight.material as THREE.MeshStandardMaterial;
        bannerRightMat.color.copy(bannerTone);
        bannerRightMat.emissive.copy(color);
        bannerRightMat.emissiveIntensity = 0.32 + progress * 0.7;
        point.bannerRight.rotation.set(0, -Math.PI / 2 - bannerTilt, 0.08 + bannerTilt * 0.5);
        point.bannerRight.position.y = point.position.y + 7.4 + progress * 0.45;

        point.label.material.color = color;
        point.label.position.y = point.position.y + 11.4 + progress * 0.6;
    }
}
