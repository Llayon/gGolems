import * as THREE from 'three';
import type { ControlOwner, ControlPointId } from './types';
import type { ControlPointRecord } from './controlPointMeshes';

const ARC_START = -Math.PI / 2;

export function createProgressGeometry(progress: number) {
    const clamped = Math.max(0.001, Math.min(1, progress));
    return new THREE.RingGeometry(8.55, 10.75, 48, 1, ARC_START, Math.PI * 2 * clamped);
}

export function colorForOwner(owner: ControlOwner) {
    switch (owner) {
        case 'blue':
            return new THREE.Color(0x4bc0ff);
        case 'red':
            return new THREE.Color(0xff7a52);
        default:
            return new THREE.Color(0xe0b36c);
    }
}

export function createLabelSprite(id: ControlPointId) {
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

export function applyControlPointVisual(point: ControlPointRecord, time: number) {
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
    const pulse = 0.82 + Math.sin(time * 2.8 + point.position.x * 0.04 + point.position.z * 0.03) * 0.18;

    const outerRingMat = point.outerRing.material as THREE.MeshBasicMaterial;
    outerRingMat.color.copy(color);
    outerRingMat.opacity = point.contested ? 0.5 + Math.sin(time * 6) * 0.12 : 0.24 + progress * 0.22 * pulse;

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
        ? 0.18 + Math.sin(time * 7) * 0.05
        : 0.06 + progress * 0.18 * pulse;
    point.beam.scale.set(
        0.92 + progress * 0.22,
        0.96 + progress * 0.28,
        0.92 + progress * 0.22
    );

    const bannerTilt = Math.sin(time * 3.2 + point.position.x * 0.04) * 0.08;
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
