import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

type LayoutEntry = { x: number; z: number; rot?: number; scale?: number };

export type TreeSnapshot = {
    id: string;
    hp: number;
    destroyed: boolean;
    fallAngle: number;
};

export type HouseSnapshot = {
    id: string;
    hp: number;
    stage: 0 | 1 | 2;
};

export type PropSnapshot = {
    trees: TreeSnapshot[];
    houses: HouseSnapshot[];
};

export type PropFxEvent = {
    kind: 'tree_fall' | 'house_damage' | 'house_collapse';
    x: number;
    y: number;
    z: number;
    intensity: number;
};

type TreeProp = {
    id: string;
    root: THREE.Group;
    intact: THREE.Group;
    trunk: THREE.Mesh;
    stump: THREE.Mesh;
    fallen: THREE.Group;
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    destroyed: boolean;
    fallAngle: number;
    position: THREE.Vector3;
};

type HouseProp = {
    id: string;
    root: THREE.Group;
    intact: THREE.Group;
    damaged: THREE.Group;
    rubble: THREE.Group;
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    stage: 0 | 1 | 2;
    collisionEntries: THREE.Mesh[];
    position: THREE.Vector3;
};

const HOUSE_LAYOUT: LayoutEntry[] = [
    { x: -78, z: -34, rot: 0.12 },
    { x: -66, z: -18, rot: -0.08 },
    { x: -54, z: -30, rot: 0.2 },
    { x: 72, z: 36, rot: -0.12 },
    { x: 84, z: 24, rot: 0.1 },
    { x: 24, z: -84, rot: 0.24 }
];

const PEOPLE_LAYOUT: LayoutEntry[] = [
    { x: -82, z: -26 }, { x: -72, z: -8 }, { x: -60, z: -40 }, { x: -44, z: -18 },
    { x: 64, z: 30 }, { x: 76, z: 18 }, { x: 90, z: 36 }, { x: 34, z: -76 },
    { x: 18, z: -94 }, { x: -24, z: 58 }, { x: 58, z: -48 }, { x: -58, z: 34 }
];

const TREE_LAYOUT: LayoutEntry[] = [
    { x: -110, z: -54, scale: 1.1 },
    { x: -104, z: -28, scale: 0.98 },
    { x: -100, z: 6, scale: 1.04 },
    { x: -94, z: 34, scale: 1.08 },
    { x: -86, z: 64, scale: 1.14 },
    { x: -58, z: 58, scale: 0.94 },
    { x: -34, z: 76, scale: 1.02 },
    { x: 12, z: 92, scale: 1.08 },
    { x: 42, z: 82, scale: 0.92 },
    { x: 72, z: 70, scale: 1.16 },
    { x: 96, z: 46, scale: 1.04 },
    { x: 108, z: 10, scale: 1.02 },
    { x: 104, z: -24, scale: 1.08 },
    { x: 94, z: -58, scale: 1.1 },
    { x: 66, z: -82, scale: 0.96 },
    { x: 20, z: -98, scale: 1.06 },
    { x: -18, z: -90, scale: 0.92 },
    { x: -64, z: -72, scale: 1.14 }
];

function markShadows(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

function collectMeshes(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            meshes.push(child);
        }
    });
    return meshes;
}

export class PropManager {
    collisionMeshes: THREE.Mesh[] = [];
    trees: TreeProp[] = [];
    houses: HouseProp[] = [];
    treeByObjectId = new Map<number, TreeProp>();
    houseByObjectId = new Map<number, HouseProp>();
    fxEvents: PropFxEvent[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    heightAt: (x: number, z: number) => number;

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.physics = physics;
        this.heightAt = heightAt ?? (() => 0);
        this.addScaleObjects();
    }

    addScaleObjects() {
        this.addHouses();
        this.addPeople();
        this.addTrees();
    }

    addHouses() {
        HOUSE_LAYOUT.forEach((layout, index) => {
            const root = new THREE.Group();
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            root.rotation.y = layout.rot ?? 0;
            this.scene.add(root);

            const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x7d1c18, roughness: 0.9 });
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 1 });
            const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x655648, roughness: 1 });

            const intact = new THREE.Group();
            const intactWalls = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 3.1), wallMat);
            intactWalls.position.y = 1.6;
            intact.add(intactWalls);

            const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.45, 0.14), trimMat);
            door.position.set(0, 0.72, -1.58);
            intact.add(door);

            const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.12), trimMat.clone());
            windowLeft.position.set(-0.9, 1.7, -1.6);
            intact.add(windowLeft);

            const windowRight = windowLeft.clone();
            windowRight.position.x = 0.9;
            intact.add(windowRight);

            const intactRoof = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.9, 4), roofMat);
            intactRoof.position.y = 4.15;
            intactRoof.rotation.y = Math.PI / 4;
            intact.add(intactRoof);

            const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), trimMat);
            chimney.position.set(0.55, 4.4, 0.28);
            intact.add(chimney);

            const damaged = new THREE.Group();
            const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.75, 0.34), wallMat.clone());
            backWall.position.set(0, 1.35, 1.26);
            damaged.add(backWall);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.7, 2.55), wallMat.clone());
            leftWall.position.set(-1.48, 1.35, 0.02);
            damaged.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.4, 2.15), wallMat.clone());
            rightWall.position.set(1.48, 1.2, -0.18);
            damaged.add(rightWall);

            const frontStubLeft = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.8, 0.34), wallMat.clone());
            frontStubLeft.position.set(-0.95, 0.9, -1.28);
            damaged.add(frontStubLeft);

            const frontStubRight = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.34), wallMat.clone());
            frontStubRight.position.set(1.05, 0.55, -1.28);
            damaged.add(frontStubRight);

            const damagedRoof = new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.35, 4), roofMat.clone());
            damagedRoof.position.set(0.4, 3.15, 0.2);
            damagedRoof.rotation.set(0.36, Math.PI / 4 + 0.18, -0.2);
            damaged.add(damagedRoof);

            const beam = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.16, 0.16), trimMat.clone());
            beam.position.set(-0.35, 2.15, -0.65);
            beam.rotation.z = -0.42;
            damaged.add(beam);

            damaged.visible = false;
            root.add(intact, damaged);

            const rubble = new THREE.Group();
            const rubbleBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 2.8), rubbleMat);
            rubbleBase.position.set(0, 0.45, 0);
            rubble.add(rubbleBase);

            const roofChunk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 1.4), roofMat.clone());
            roofChunk.position.set(-0.6, 0.95, 0.25);
            roofChunk.rotation.set(0.2, 0.4, -0.22);
            rubble.add(roofChunk);

            const wallChunk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.42), wallMat.clone());
            wallChunk.position.set(0.85, 0.62, -0.5);
            wallChunk.rotation.set(0, -0.3, 0.2);
            rubble.add(wallChunk);

            const spar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.16), trimMat.clone());
            spar.position.set(0.15, 0.86, 0.85);
            spar.rotation.set(0.22, 0.55, -0.4);
            rubble.add(spar);

            rubble.visible = false;
            root.add(rubble);

            markShadows(root);

            const house: HouseProp = {
                id: `house-${index}`,
                root,
                intact,
                damaged,
                rubble,
                body: this.createHouseBody(root.position, layout.rot ?? 0),
                hp: 60,
                maxHp: 60,
                stage: 0,
                collisionEntries: [],
                position: root.position.clone()
            };

            for (const mesh of [...collectMeshes(intact), ...collectMeshes(damaged)]) {
                this.houseByObjectId.set(mesh.id, house);
            }

            this.setHouseStage(house, 0);
            this.houses.push(house);
        });
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
                position: root.position.clone()
            };

            this.treeByObjectId.set(trunk.id, tree);
            this.collisionMeshes.push(trunk);
            this.trees.push(tree);
        });
    }

    createHouseBody(position: THREE.Vector3, rotationY: number) {
        const houseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y + 1.6, position.z)
            .setRotation({
                x: houseRotation.x,
                y: houseRotation.y,
                z: houseRotation.z,
                w: houseRotation.w
            });
        const body = this.physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1.8, 1.6, 1.55);
        this.physics.createCollider(colliderDesc, body);
        return body;
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    consumeFxEvents() {
        const events = this.fxEvents;
        this.fxEvents = [];
        return events;
    }

    getSnapshot(): PropSnapshot {
        return {
            trees: this.trees.map((tree) => ({
                id: tree.id,
                hp: tree.hp,
                destroyed: tree.destroyed,
                fallAngle: tree.fallAngle
            })),
            houses: this.houses.map((house) => ({
                id: house.id,
                hp: house.hp,
                stage: house.stage
            }))
        };
    }

    applySnapshot(snapshot: PropSnapshot | TreeSnapshot[]) {
        if (Array.isArray(snapshot)) {
            for (const state of snapshot) {
                const tree = this.trees.find((entry) => entry.id === state.id);
                if (!tree) continue;
                tree.hp = state.hp;
                if (state.destroyed) {
                    this.setTreeDestroyed(tree, state.fallAngle);
                }
            }
            return;
        }

        for (const state of snapshot.trees) {
            const tree = this.trees.find((entry) => entry.id === state.id);
            if (!tree) continue;
            tree.hp = state.hp;
            if (state.destroyed) {
                this.setTreeDestroyed(tree, state.fallAngle);
            }
        }

        for (const state of snapshot.houses) {
            const house = this.houses.find((entry) => entry.id === state.id);
            if (!house) continue;
            house.hp = state.hp;
            this.setHouseStage(house, state.stage);
        }
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        const tree = this.findTree(object);
        if (tree) {
            if (authoritative) {
                this.damageTree(tree, damage, point);
            }
            return true;
        }

        const house = this.findHouse(object);
        if (house) {
            if (authoritative) {
                this.damageHouse(house, damage);
            }
            return true;
        }

        return false;
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

    findHouse(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const house = this.houseByObjectId.get(current.id);
            if (house) return house;
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

    damageHouse(house: HouseProp, damage: number) {
        if (house.stage === 2) return;
        house.hp = Math.max(0, house.hp - damage);

        if (house.hp <= 0) {
            this.setHouseStage(house, 2);
        } else if (house.hp <= house.maxHp * 0.55) {
            this.setHouseStage(house, 1);
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

    setHouseStage(house: HouseProp, stage: 0 | 1 | 2) {
        if (house.stage === stage && house.collisionEntries.length > 0) return;

        const previousStage = house.stage;
        house.stage = stage;
        house.intact.visible = stage === 0;
        house.damaged.visible = stage === 1;
        house.rubble.visible = stage === 2;

        const nextCollisionEntries =
            stage === 0 ? collectMeshes(house.intact) :
            stage === 1 ? collectMeshes(house.damaged) :
            [];

        this.replaceCollisionEntries(house.collisionEntries, nextCollisionEntries);
        house.collisionEntries = nextCollisionEntries;

        if (stage === 2 && house.body) {
            this.physics.removeRigidBody(house.body);
            house.body = null;
        }

        if (stage === 1 && previousStage < 1) {
            this.fxEvents.push({
                kind: 'house_damage',
                x: house.position.x,
                y: 1.8,
                z: house.position.z,
                intensity: 1.0
            });
        } else if (stage === 2 && previousStage < 2) {
            this.fxEvents.push({
                kind: 'house_collapse',
                x: house.position.x,
                y: 1.2,
                z: house.position.z,
                intensity: 1.4
            });
        }
    }

    replaceCollisionEntries(previous: THREE.Mesh[], next: THREE.Mesh[]) {
        const previousIds = new Set(previous.map((mesh) => mesh.id));
        this.collisionMeshes = this.collisionMeshes.filter((mesh) => !previousIds.has(mesh.id));
        this.collisionMeshes.push(...next);
    }
}
