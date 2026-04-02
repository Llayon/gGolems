import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { AmbientPropManager } from './AmbientPropManager';
import { BreakableStructureManager } from './BreakableStructureManager';
import { StaticVillageManager } from './StaticVillageManager';
import { TreeManager } from './TreeManager';
import { PropSnapshot, TreeSnapshot } from './propShared';

export class WorldPropSystem {
    ambientProps: AmbientPropManager;
    breakableStructures: BreakableStructureManager;
    staticVillage: StaticVillageManager;
    trees: TreeManager;

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.staticVillage = new StaticVillageManager(scene, physics, heightAt);
        this.breakableStructures = new BreakableStructureManager(scene, physics, heightAt);
        this.trees = new TreeManager(scene, physics, heightAt);
        this.ambientProps = new AmbientPropManager(scene, heightAt);
    }

    getCollisionMeshes() {
        return [
            ...this.staticVillage.getCollisionMeshes(),
            ...this.breakableStructures.getCollisionMeshes(),
            ...this.trees.getCollisionMeshes()
        ];
    }

    consumeFxEvents() {
        return [
            ...this.breakableStructures.consumeFxEvents(),
            ...this.trees.consumeFxEvents()
        ];
    }

    update(dt: number, observerPositions: THREE.Vector3[] = []) {
        this.breakableStructures.update(dt, observerPositions);
    }

    getSnapshot(): PropSnapshot {
        return {
            trees: this.trees.getSnapshot(),
            houses: this.breakableStructures.getSnapshot()
        };
    }

    applySnapshot(snapshot: PropSnapshot | TreeSnapshot[]) {
        if (Array.isArray(snapshot)) {
            this.trees.applySnapshot(snapshot);
            return;
        }

        this.trees.applySnapshot(snapshot.trees);
        this.breakableStructures.applySnapshot(snapshot.houses);
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        if (this.trees.handleProjectileHit(object, point, damage, authoritative)) {
            return true;
        }

        return this.breakableStructures.handleProjectileHit(object, point, damage, authoritative);
    }

    reset() {
        this.staticVillage.reset();
        this.breakableStructures.reset();
        this.trees.reset();
    }
}
