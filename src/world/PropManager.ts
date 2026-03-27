import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

type LayoutEntry = { x: number; z: number; rot?: number; scale?: number };

export type TreeSnapshot = {
    id: string;
    hp: number;
    destroyed: boolean;
    fallAngle: number;
};

type TreeProp = {
    id: string;
    root: THREE.Group;
    intact: THREE.Group;
    trunk: THREE.Mesh;
    leaves: THREE.Mesh;
    stump: THREE.Mesh;
    fallen: THREE.Group;
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    destroyed: boolean;
    fallAngle: number;
    position: THREE.Vector3;
};

const HOUSE_LAYOUT: LayoutEntry[] = [
    { x: -54, z: -12, rot: 0.1 },
    { x: -42, z: 16, rot: -0.18 },
    { x: -18, z: -54, rot: 0.2 },
    { x: 18, z: 54, rot: -0.14 },
    { x: 42, z: -16, rot: 0.22 },
    { x: 54, z: 12, rot: -0.1 }
];

const PEOPLE_LAYOUT: LayoutEntry[] = [
    { x: -34, z: -8 }, { x: -28, z: 22 }, { x: -16, z: 38 }, { x: -8, z: -38 },
    { x: 6, z: 28 }, { x: 12, z: -26 }, { x: 18, z: 12 }, { x: 24, z: -44 },
    { x: 30, z: 40 }, { x: 36, z: -12 }, { x: -38, z: -30 }, { x: 44, z: 30 }
];

const TREE_LAYOUT: LayoutEntry[] = [
    { x: -60, z: -36, scale: 1.05 },
    { x: -58, z: 32, scale: 0.95 },
    { x: -44, z: -50, scale: 1.12 },
    { x: -38, z: 2, scale: 0.9 },
    { x: -30, z: 48, scale: 1.08 },
    { x: -14, z: -18, scale: 0.88 },
    { x: -8, z: 58, scale: 1.0 },
    { x: 10, z: -58, scale: 1.1 },
    { x: 18, z: 18, scale: 0.92 },
    { x: 28, z: -8, scale: 0.86 },
    { x: 36, z: 52, scale: 1.15 },
    { x: 46, z: -42, scale: 1.0 },
    { x: 56, z: -6, scale: 0.98 },
    { x: 60, z: 38, scale: 1.06 }
];

export class PropManager {
    collisionMeshes: THREE.Mesh[] = [];
    trees: TreeProp[] = [];
    treeByObjectId = new Map<number, TreeProp>();
    scene: THREE.Scene;
    physics: RAPIER.World;

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        this.scene = scene;
        this.physics = physics;
        this.addScaleObjects();
    }

    addScaleObjects() {
        this.addHouses();
        this.addPeople();
        this.addTrees();
    }

    addHouses() {
        for (const layout of HOUSE_LAYOUT) {
            const house = new THREE.Group();

            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 3.2, 2.4),
                new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 })
            );
            walls.position.y = 1.6;
            walls.castShadow = true;
            walls.receiveShadow = true;
            house.add(walls);

            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(1.95, 1.7, 4),
                new THREE.MeshStandardMaterial({ color: 0x7d1c18, roughness: 0.9 })
            );
            roof.position.y = 3.8;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            roof.receiveShadow = true;
            house.add(roof);

            const chimney = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.9, 0.35),
                new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 1 })
            );
            chimney.position.set(0.45, 4.2, 0.2);
            chimney.castShadow = true;
            house.add(chimney);

            house.position.set(layout.x, 0, layout.z);
            house.rotation.y = layout.rot ?? 0;
            this.scene.add(house);
        }
    }

    addPeople() {
        for (const layout of PEOPLE_LAYOUT) {
            const person = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.5, 2, 4),
                new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 })
            );
            person.position.set(layout.x, 0.4, layout.z);
            person.castShadow = true;
            this.scene.add(person);
        }
    }

    addTrees() {
        TREE_LAYOUT.forEach((layout, index) => {
            const scale = layout.scale ?? 1;
            const root = new THREE.Group();
            root.position.set(layout.x, 0, layout.z);
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
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            intact.add(trunk);

            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(1.35 * scale, 6, 5),
                leafMat
            );
            leaves.position.y = 4.0 * scale;
            leaves.castShadow = true;
            intact.add(leaves);
            root.add(intact);

            const stump = new THREE.Mesh(
                new THREE.CylinderGeometry(0.34 * scale, 0.42 * scale, 0.9 * scale, 6),
                stumpMat
            );
            stump.position.y = 0.45 * scale;
            stump.castShadow = true;
            stump.receiveShadow = true;
            stump.visible = false;
            root.add(stump);

            const fallen = new THREE.Group();
            const fallenTrunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.24 * scale, 0.32 * scale, 3.1 * scale, 6),
                barkMat.clone()
            );
            fallenTrunk.rotation.z = Math.PI / 2;
            fallenTrunk.position.set(1.45 * scale, 0.4 * scale, 0);
            fallenTrunk.castShadow = true;
            fallenTrunk.receiveShadow = true;
            fallen.add(fallenTrunk);

            const fallenCrown = new THREE.Mesh(
                new THREE.SphereGeometry(1.15 * scale, 6, 5),
                leafMat.clone()
            );
            fallenCrown.position.set(2.8 * scale, 0.95 * scale, 0);
            fallenCrown.castShadow = true;
            fallen.add(fallenCrown);
            fallen.visible = false;
            root.add(fallen);

            const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(layout.x, 1.7 * scale, layout.z);
            const body = this.physics.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.cylinder(1.7 * scale, 0.42 * scale);
            this.physics.createCollider(colliderDesc, body);

            const tree: TreeProp = {
                id: `tree-${index}`,
                root,
                intact,
                trunk,
                leaves,
                stump,
                fallen,
                body,
                hp: 30,
                maxHp: 30,
                destroyed: false,
                fallAngle: 0,
                position: root.position.clone()
            };

            trunk.userData.treeId = tree.id;
            this.treeByObjectId.set(trunk.id, tree);
            this.collisionMeshes.push(trunk);
            this.trees.push(tree);
        });
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
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
    }
}
