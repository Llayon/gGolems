import * as THREE from 'three';
import type { ControlPointId } from './types';
import { createLabelSprite } from './controlPointVisuals';

export type ControlPointRecord = {
    id: ControlPointId;
    owner: 'blue' | 'red' | 'neutral';
    capture: number;
    radius: number;
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

export function createControlPointMeshes(scene: THREE.Scene, id: ControlPointId, position: THREE.Vector3): ControlPointRecord {
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
        new THREE.RingGeometry(8.55, 10.75, 48, 1, -Math.PI / 2, Math.PI * 2 * 0.02),
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
        label,
        contested: false,
        blueInside: 0,
        redInside: 0
    };
}
