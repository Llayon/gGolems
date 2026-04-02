import * as THREE from 'three';
import { PEOPLE_LAYOUT } from './propShared';

export class AmbientPropManager {
    scene: THREE.Scene;
    heightAt: (x: number, z: number) => number;

    constructor(scene: THREE.Scene, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.heightAt = heightAt ?? (() => 0);
        this.addPeople();
    }

    addPeople() {
        for (const layout of PEOPLE_LAYOUT) {
            const person = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.5, 2, 4),
                new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 })
            );
            person.position.set(layout.x, this.heightAt(layout.x, layout.z) + 0.4, layout.z);
            person.castShadow = true;
            this.scene.add(person);
        }
    }
}
