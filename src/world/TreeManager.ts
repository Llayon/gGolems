import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PropFxEvent, TREE_LAYOUT, TreeProp, TreeSnapshot, markShadows } from './propShared';

export class TreeManager {
    collisionMeshes: THREE.Mesh[] = [];
    trees: TreeProp[] = [];
    treeByObjectId = new Map<number, TreeProp>();
    fxEvents: PropFxEvent[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    heightAt: (x: number, z: number) => number;

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.physics = physics;
        this.heightAt = heightAt ?? (() => 0);
        this.addTrees();
    }

    addTrees() {
        TREE_LAYOUT.forEach((layout, index) => {
            const scale = layout.scale ?? 1;
            const root = new THREE.Group();
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            this.scene.add(root);

            const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 1 });
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.95 });
            const stumpMat = new THREE.MeshStandardMaterial({ color: 0x5f4731, roughness: 1 });

            const intact = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25 * scale, 0.34 * scale, 3.4 * scale, 6),
                barkMat
            );
            trunk.position.y = 1.7 * scale;
            intact.add(trunk);

            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(1.35 * scale, 6, 5),
                leafMat
            );
            leaves.position.y = 4.0 * scale;
            intact.add(leaves);
            root.add(intact);

            const stump = new THREE.Mesh(
                new THREE.CylinderGeometry(0.34 * scale, 0.42 * scale, 0.9 * scale, 6),
                stumpMat
            );
            stump.position.y = 0.45 * scale;
            stump.visible = false;
            root.add(stump);

            const fallen = new THREE.Group();
            const fallenTrunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.24 * scale, 0.32 * scale, 3.1 * scale, 6),
                barkMat.clone()
            );
            fallenTrunk.rotation.z = Math.PI / 2;
            fallenTrunk.position.set(1.45 * scale, 0.4 * scale, 0);
            fallen.add(fallenTrunk);

            const fallenCrown = new THREE.Mesh(
                new THREE.SphereGeometry(1.15 * scale, 6, 5),
                leafMat.clone()
            );
            fallenCrown.position.set(2.8 * scale, 0.95 * scale, 0);
            fallen.add(fallenCrown);
            fallen.visible = false;
            root.add(fallen);

            markShadows(root);

            const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(layout.x, root.position.y + 1.7 * scale, layout.z);
            const body = this.physics.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.cylinder(1.7 * scale, 0.42 * scale);
            this.physics.createCollider(colliderDesc, body);

            const tree: TreeProp = {
                id: `tree-${index}`,
                root,
                intact,
                trunk,
                stump,
                fallen,
                body,
                hp: 30,
                maxHp: 30,
                destroyed: false,
                fallAngle: 0,
                position: root.position.clone(),
                scale
            };

            this.treeByObjectId.set(trunk.id, tree);
            this.collisionMeshes.push(trunk);
            this.trees.push(tree);
        });
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    consumeFxEvents() {
        const events = this.fxEvents;
        this.fxEvents = [];
        return events;
    }

    getSnapshot(): TreeSnapshot[] {
        return this.trees.map((tree) => ({
            id: tree.id,
            hp: tree.hp,
            destroyed: tree.destroyed,
            fallAngle: tree.fallAngle
        }));
    }

    applySnapshot(snapshot: TreeSnapshot[]) {
        for (const state of snapshot) {
            const tree = this.trees.find((entry) => entry.id === state.id);
            if (!tree) continue;
            tree.hp = state.hp;
            if (state.destroyed) {
                this.setTreeDestroyed(tree, state.fallAngle);
            }
        }
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        const tree = this.findTree(object);
        if (!tree) return false;
        if (authoritative) {
            this.damageTree(tree, damage, point);
        }
        return true;
    }

    findTree(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const tree = this.treeByObjectId.get(current.id);
            if (tree) return tree;
            current = current.parent;
        }
        return null;
    }

    damageTree(tree: TreeProp, damage: number, point: THREE.Vector3) {
        if (tree.destroyed) return;
        tree.hp = Math.max(0, tree.hp - damage);
        if (tree.hp <= 0) {
            const dx = tree.position.x - point.x;
            const dz = tree.position.z - point.z;
            const fallAngle = Math.atan2(dx, dz);
            this.setTreeDestroyed(tree, fallAngle);
        }
    }

    setTreeDestroyed(tree: TreeProp, fallAngle: number) {
        if (tree.destroyed) return;
        tree.destroyed = true;
        tree.fallAngle = fallAngle;
        tree.intact.visible = false;
        tree.stump.visible = true;
        tree.fallen.visible = true;
        tree.fallen.rotation.y = fallAngle;

        this.collisionMeshes = this.collisionMeshes.filter((mesh) => mesh !== tree.trunk);
        this.treeByObjectId.delete(tree.trunk.id);

        if (tree.body) {
            this.physics.removeRigidBody(tree.body);
            tree.body = null;
        }

        this.fxEvents.push({
            kind: 'tree_fall',
            x: tree.position.x,
            y: 1.1,
            z: tree.position.z,
            intensity: 0.8
        });
    }

    reset() {
        this.fxEvents = [];
        for (const tree of this.trees) {
            tree.hp = tree.maxHp;
            tree.destroyed = false;
            tree.fallAngle = 0;
            tree.intact.visible = true;
            tree.stump.visible = false;
            tree.fallen.visible = false;
            tree.fallen.rotation.set(0, 0, 0);
            if (!tree.body) {
                const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(tree.position.x, tree.position.y + 1.7 * tree.scale, tree.position.z);
                tree.body = this.physics.createRigidBody(bodyDesc);
                const colliderDesc = RAPIER.ColliderDesc.cylinder(1.7 * tree.scale, 0.42 * tree.scale);
                this.physics.createCollider(colliderDesc, tree.body);
            }
            if (!this.collisionMeshes.includes(tree.trunk)) {
                this.collisionMeshes.push(tree.trunk);
            }
            this.treeByObjectId.set(tree.trunk.id, tree);
        }
    }
}
