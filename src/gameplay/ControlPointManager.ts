import * as THREE from 'three';
import type { ControlPointId, ControlPointView, TeamId } from './types';
import { createControlPointMeshes, type ControlPointRecord } from './controlPointMeshes';
import { applyControlPointVisual } from './controlPointVisuals';

export type { ControlPointRecord } from './controlPointMeshes';

export type ControlUnitPresence = {
    team: TeamId;
    position: { x: number; y: number; z: number };
    alive: boolean;
};

const _unitPos = new THREE.Vector3();

export class ControlPointManager {
    points: ControlPointRecord[];
    captureRate = 0.23;
    scoreTickInterval = 1;
    scorePerOwnedPoint = 1;
    scoreTimer = 0;
    time = 0;

    constructor(scene: THREE.Scene, positions: Record<ControlPointId, THREE.Vector3>) {
        this.points = (Object.entries(positions) as Array<[ControlPointId, THREE.Vector3]>).map(
            ([id, position]) => createControlPointMeshes(scene, id, position)
        );
    }

    setVisible(visible: boolean) {
        for (const point of this.points) {
            point.outerRing.visible = visible;
            point.fill.visible = visible;
            point.progressRing.visible = visible;
            point.beacon.visible = visible;
            point.beaconCap.visible = visible;
            point.beam.visible = visible;
            point.bannerLeft.visible = visible;
            point.bannerRight.visible = visible;
            point.label.visible = visible;
        }
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
            applyControlPointVisual(point, this.time);
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

    reset() {
        this.scoreTimer = 0;
        this.time = 0;
        for (const point of this.points) {
            point.owner = 'neutral';
            point.capture = 0;
            point.contested = false;
            point.blueInside = 0;
            point.redInside = 0;
            applyControlPointVisual(point, this.time);
        }
    }

    update(dt: number, units: ControlUnitPresence[]) {
        this.time += dt;
        for (const point of this.points) {
            let blueInside = 0;
            let redInside = 0;

            for (const unit of units) {
                if (!unit.alive) continue;
                _unitPos.set(unit.position.x, unit.position.y, unit.position.z);
                const distance = _unitPos.distanceTo(point.position);
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

            applyControlPointVisual(point, this.time);
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
}
