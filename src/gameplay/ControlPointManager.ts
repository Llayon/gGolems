import * as THREE from 'three';
import type { ControlOwner, ControlPointId, ControlPointView, TeamId } from './types';

type UnitPresence = {
    team: TeamId;
    position: THREE.Vector3;
    alive: boolean;
};

type ControlPointRecord = ControlPointView & {
    position: THREE.Vector3;
    ring: THREE.Mesh;
    beacon: THREE.Mesh;
    label: THREE.Sprite;
};

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

    constructor(scene: THREE.Scene, positions: Record<ControlPointId, THREE.Vector3>) {
        this.points = (Object.entries(positions) as Array<[ControlPointId, THREE.Vector3]>).map(([id, position]) => {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(9.6, 12.6, 48),
                new THREE.MeshBasicMaterial({
                    color: 0xe0b36c,
                    transparent: true,
                    opacity: 0.32,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(position);
            ring.position.y += 0.22;
            scene.add(ring);

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

            const label = createLabelSprite(id);
            label.position.copy(position);
            label.position.y += 10.4;
            scene.add(label);

            return {
                id,
                owner: 'neutral',
                capture: 0,
                radius: 12.6,
                position: position.clone(),
                ring,
                beacon,
                label
            };
        });
    }

    setState(nextPoints: ControlPointView[]) {
        for (const point of this.points) {
            const next = nextPoints.find((entry) => entry.id === point.id);
            if (!next) continue;
            point.owner = next.owner;
            point.capture = next.capture;
            this.applyVisual(point);
        }
    }

    getSnapshot() {
        return this.points.map(({ id, owner, capture, radius }) => ({ id, owner, capture, radius }));
    }

    update(dt: number, units: UnitPresence[]) {
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
        const owner = point.owner !== 'neutral'
            ? point.owner
            : point.capture > 0.04
                ? 'blue'
                : point.capture < -0.04
                    ? 'red'
                    : 'neutral';
        const color = colorForOwner(owner);
        const progress = Math.min(1, Math.abs(point.capture));
        (point.ring.material as THREE.MeshBasicMaterial).color.copy(color);
        (point.ring.material as THREE.MeshBasicMaterial).opacity = 0.22 + progress * 0.34;
        const beaconMat = point.beacon.material as THREE.MeshStandardMaterial;
        beaconMat.emissive.copy(color);
        beaconMat.emissiveIntensity = 0.45 + progress * 1.1;
        point.label.material.color = color;
    }
}
