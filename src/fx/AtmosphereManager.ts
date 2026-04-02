import * as THREE from 'three';
import type { QualityProfile } from '../utils/quality';

type AtmosphereKind = 'steam' | 'pressure' | 'ember';

type AtmosphereNode = {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    basePosition: THREE.Vector3;
    baseScale: THREE.Vector3;
    drift: THREE.Vector3;
    speed: number;
    phase: number;
    baseOpacity: number;
    scalePulse: number;
    kind: AtmosphereKind;
};

export class AtmosphereManager {
    root = new THREE.Group();
    nodes: AtmosphereNode[] = [];
    enabled = true;
    time = 0;
    sphereGeometry: THREE.SphereGeometry;

    constructor(scene: THREE.Scene, quality: QualityProfile, enabled = !quality.isMobile) {
        this.root.name = 'ambient-atmosphere';
        this.root.renderOrder = 1;
        scene.add(this.root);

        this.sphereGeometry = new THREE.SphereGeometry(1, quality.isMobile ? 10 : 12, quality.isMobile ? 10 : 12);
        this.buildSteamLane();
        this.buildPressureLane();
        this.buildRuinLane();
        this.setEnabled(enabled);
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.root.visible = enabled;
    }

    update(dt: number) {
        if (!this.enabled) return;
        this.time += dt;

        for (const node of this.nodes) {
            const cycle = this.time * node.speed + node.phase;
            const material = node.material;
            const mesh = node.mesh;

            if (node.kind === 'steam') {
                mesh.position.set(
                    node.basePosition.x + Math.sin(cycle * 0.9) * node.drift.x,
                    node.basePosition.y + Math.sin(cycle * 0.65) * node.drift.y,
                    node.basePosition.z + Math.cos(cycle * 0.7) * node.drift.z
                );
                const pulse = 0.92 + Math.sin(cycle * 0.85) * node.scalePulse;
                mesh.scale.set(
                    node.baseScale.x * (0.95 + Math.sin(cycle * 0.4) * 0.06),
                    node.baseScale.y * pulse,
                    node.baseScale.z * (0.95 + Math.cos(cycle * 0.45) * 0.06)
                );
                material.opacity = node.baseOpacity * (0.82 + Math.sin(cycle * 0.8) * 0.16);
            } else if (node.kind === 'pressure') {
                mesh.position.set(
                    node.basePosition.x + Math.sin(cycle * 0.55) * node.drift.x,
                    node.basePosition.y + Math.sin(cycle * 0.4) * node.drift.y,
                    node.basePosition.z + Math.cos(cycle * 0.6) * node.drift.z
                );
                const pulse = 0.96 + Math.sin(cycle * 0.7) * node.scalePulse;
                mesh.scale.set(
                    node.baseScale.x * pulse,
                    node.baseScale.y * (0.94 + Math.cos(cycle * 0.4) * 0.05),
                    node.baseScale.z * pulse
                );
                material.opacity = node.baseOpacity * (0.78 + Math.cos(cycle * 0.9) * 0.12);
            } else {
                mesh.position.set(
                    node.basePosition.x + Math.sin(cycle * 0.9) * node.drift.x,
                    node.basePosition.y + Math.sin(cycle * 1.4) * node.drift.y,
                    node.basePosition.z + Math.cos(cycle * 1.1) * node.drift.z
                );
                const pulse = 1 + Math.sin(cycle * 2.2) * node.scalePulse;
                mesh.scale.copy(node.baseScale).multiplyScalar(pulse);
                material.opacity = node.baseOpacity * (0.76 + Math.sin(cycle * 2.6) * 0.24);
            }
        }
    }

    dispose() {
        this.root.removeFromParent();
        this.sphereGeometry.dispose();
        for (const node of this.nodes) {
            node.material.dispose();
        }
        this.nodes = [];
    }

    buildSteamLane() {
        this.addVolume('steam', { x: -100, y: 6.4, z: 56 }, { x: 4.6, y: 7.4, z: 4.2 }, 0x6b8e90, 0.16, { x: 1.55, y: 2.8, z: 1.5 }, { x: 1.8, y: 1.4, z: 1.6 }, 0.18, 0.1);
        this.addVolume('steam', { x: -94, y: 4.6, z: 18 }, { x: 4.0, y: 6.2, z: 3.8 }, 0x708f95, 0.14, { x: 1.35, y: 2.4, z: 1.3 }, { x: 1.4, y: 1.1, z: 1.2 }, 0.16, 1.2);
        this.addVolume('steam', { x: -84, y: 5.0, z: 30 }, { x: 3.6, y: 5.6, z: 3.4 }, 0x628388, 0.11, { x: 1.15, y: 2.1, z: 1.1 }, { x: 1.1, y: 0.95, z: 1.0 }, 0.14, 2.3);
    }

    buildPressureLane() {
        this.addVolume('pressure', { x: -8, y: 3.4, z: -18 }, { x: 7.2, y: 2.0, z: 8.2 }, 0x7ea7a2, 0.09, { x: 2.9, y: 0.55, z: 2.4 }, { x: 1.9, y: 0.8, z: 1.9 }, 0.08, 0.5);
        this.addVolume('pressure', { x: 9, y: 3.2, z: -20 }, { x: 7.0, y: 1.8, z: 7.8 }, 0x6f9997, 0.085, { x: 2.6, y: 0.5, z: 2.2 }, { x: 1.8, y: 0.7, z: 1.8 }, 0.08, 1.7);
        this.addVolume('pressure', { x: 0, y: 4.4, z: -4 }, { x: 4.8, y: 1.4, z: 4.8 }, 0x89b1a9, 0.05, { x: 1.8, y: 0.35, z: 1.6 }, { x: 1.2, y: 0.55, z: 1.2 }, 0.06, 2.4);
    }

    buildRuinLane() {
        this.addVolume('ember', { x: 102, y: 5.6, z: 48 }, { x: 1.2, y: 1.8, z: 1.2 }, 0xd59355, 0.22, { x: 0.7, y: 0.55, z: 0.6 }, { x: 0.6, y: 0.6, z: 0.6 }, 0.12, 0.2);
        this.addVolume('ember', { x: 108, y: 4.4, z: 22 }, { x: 1.0, y: 1.5, z: 1.0 }, 0xe1a366, 0.18, { x: 0.55, y: 0.45, z: 0.55 }, { x: 0.48, y: 0.48, z: 0.48 }, 0.1, 1.3);
        this.addVolume('ember', { x: 86, y: 4.8, z: 32 }, { x: 0.95, y: 1.35, z: 0.95 }, 0xc97d48, 0.14, { x: 0.5, y: 0.4, z: 0.45 }, { x: 0.4, y: 0.4, z: 0.4 }, 0.08, 2.1);
    }

    addVolume(
        kind: AtmosphereKind,
        position: { x: number; y: number; z: number },
        scale: { x: number; y: number; z: number },
        color: number,
        opacity: number,
        drift: { x: number; y: number; z: number },
        speed: { x: number; y: number; z: number },
        scalePulse: number,
        phase: number
    ) {
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: kind === 'ember' ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        const mesh = new THREE.Mesh(this.sphereGeometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.scale.set(scale.x, scale.y, scale.z);
        mesh.renderOrder = kind === 'ember' ? 3 : 2;
        this.root.add(mesh);
        this.nodes.push({
            mesh,
            material,
            basePosition: new THREE.Vector3(position.x, position.y, position.z),
            baseScale: new THREE.Vector3(scale.x, scale.y, scale.z),
            drift: new THREE.Vector3(drift.x, drift.y, drift.z),
            speed: (speed.x + speed.y + speed.z) / 3,
            phase,
            baseOpacity: opacity,
            scalePulse,
            kind
        });
    }
}
