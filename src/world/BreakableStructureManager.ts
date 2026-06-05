import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    type HouseProp,
    type HouseSectionProp,
    type FallingSection,
    type PropFxEvent,
    type HouseSnapshot,
    type LayoutEntry,
    BREAKABLE_HOUSE_LAYOUT,
    collectMeshes
} from './propShared';
import {
    loadSectionedHouseTemplate,
    loadHouseProxyTemplate,
    loadSectionedHouseMaterialLibrary,
    applySectionedHouseMaterials
} from './houseTemplates';
import { buildProceduralHouse } from './proceduralHouse';
import {
    buildSectionedHouses,
    extractHouseSections
} from './sectionedHouse';
import { shouldCollapseSectionedHouse } from './sectionPhysics';
import {
    type HouseProxyRegistry,
    activateHouse as activateHouseLifecycle,
    deactivateHouse as deactivateHouseLifecycle,
    registerHouseProxy,
    promoteNearbyHouses
} from './houseLifecycle';
import {
    destroyHouseSection,
    restoreHouseSection,
    collapseSectionedHouse as collapseSectionedHousePhysics,
    restoreCollapsedHouseExtras,
    recomputeSectionedHouseState,
    setHouseStage,
    damageHouse as damageHouseLogic,
    damageHouseSection as damageHouseSectionLogic,
    updateFallingSections,
    getHouseSnapshot
} from './sectionPhysics';

type HouseSectionHit = { house: HouseProp; section: HouseSectionProp };

export class BreakableStructureManager {
    collisionMeshes: THREE.Mesh[] = [];
    houses: HouseProp[] = [];
    houseByObjectId = new Map<number, HouseProp>();
    houseSectionByObjectId = new Map<number, HouseSectionHit>();
    houseProxyByObjectId = new Map<number, HouseProp>();
    houseProxyState: HouseProxyRegistry = new Map();
    fxEvents: PropFxEvent[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    heightAt: (x: number, z: number) => number;
    pendingHouseSnapshots: HouseSnapshot[] | null = null;
    fallingSections: FallingSection[] = [];

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.physics = physics;
        this.heightAt = heightAt ?? (() => 0);
        void this.addHouses();
    }

    async addHouses() {
        try {
            const [template, proxyTemplate] = await Promise.all([
                loadSectionedHouseTemplate(),
                loadHouseProxyTemplate(),
                loadSectionedHouseMaterialLibrary()
            ]);
            applySectionedHouseMaterials(template, await loadSectionedHouseMaterialLibrary());
            this.addSectionedHouses(template, proxyTemplate);
            if (this.pendingHouseSnapshots) {
                this.applySnapshot(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        } catch (error) {
            console.warn('Failed to load sectioned village house prefab. Falling back to procedural houses.', error);
            this.addProceduralHouses();
            if (this.pendingHouseSnapshots) {
                this.applySnapshot(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        }
    }

    addProceduralHouses() {
        BREAKABLE_HOUSE_LAYOUT.forEach((layout: LayoutEntry, index: number) => {
            const { house } = buildProceduralHouse(index, layout, this.heightAt, this.scene, this.physics);
            for (const mesh of [...collectMeshes(house.intact!), ...collectMeshes(house.damaged!)]) {
                this.houseByObjectId.set(mesh.id, house);
            }
            this.setHouseStage(house, 0);
            this.houses.push(house);
            this.registerHouseProxyFor(house);
            this.deactivateHouse(house);
        });
    }

    addSectionedHouses(template: THREE.Group, proxyTemplate?: THREE.Group) {
        const sectionedHouses = buildSectionedHouses(template, proxyTemplate, this.scene, this.heightAt);
        for (const house of sectionedHouses) {
            extractHouseSections(house, this.collisionMeshes, this.physics);
            for (const section of house.sections) {
                for (const mesh of section.meshes) {
                    this.houseByObjectId.set(mesh.id, house);
                    this.houseSectionByObjectId.set(mesh.id, { house, section });
                }
            }
            recomputeSectionedHouseState(house);
            this.houses.push(house);
            this.registerHouseProxyFor(house, proxyTemplate);
            this.deactivateHouse(house);
        }
    }

    private registerHouseProxyFor(house: HouseProp, proxyTemplate?: THREE.Group) {
        registerHouseProxy(house, proxyTemplate, this.scene, this.houseProxyState, this.houseProxyByObjectId);
    }

    activateHouse(house: HouseProp) {
        activateHouseLifecycle(
            house, this.scene, this.physics, this.collisionMeshes, this.houseProxyState,
            (section) => this.restoreHouseSection(section),
            (h) => shouldCollapseSectionedHouse(h),
            (h) => this.collapseSectionedHouse(h),
            (h) => this.restoreCollapsedHouseExtras(h),
            (h) => recomputeSectionedHouseState(h),
            (h, s) => this.setHouseStage(h, s)
        );
    }

    deactivateHouse(house: HouseProp) {
        deactivateHouseLifecycle(house, this.physics, this.collisionMeshes, this.houseProxyState);
    }

    private setHouseStage(house: HouseProp, stage: 0 | 1 | 2) {
        setHouseStage(house, stage, this.physics, this.collisionMeshes, this.fxEvents);
    }

    private restoreHouseSection(section: HouseSectionProp) {
        restoreHouseSection(
            section, this.physics, this.collisionMeshes,
            this.houseByObjectId, this.houseSectionByObjectId, true
        );
    }

    private restoreCollapsedHouseExtras(house: HouseProp) {
        restoreCollapsedHouseExtras(
            house, this.physics, this.collisionMeshes,
            this.houseByObjectId, this.houseSectionByObjectId
        );
        recomputeSectionedHouseState(house);
    }

    private collapseSectionedHouse(house: HouseProp) {
        collapseSectionedHousePhysics(
            house, this.physics, this.collisionMeshes, this.houseSectionByObjectId,
            this.scene, this.fallingSections, this.fxEvents,
            (h) => recomputeSectionedHouseState(h)
        );
    }

    promoteNearbyHouses(observerPositions: THREE.Vector3[]) {
        promoteNearbyHouses(this.houses, observerPositions, (house) => this.activateHouse(house));
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    consumeFxEvents() {
        const events = this.fxEvents;
        this.fxEvents = [];
        return events;
    }

    update(dt: number, observerPositions: THREE.Vector3[] = []) {
        this.promoteNearbyHouses(observerPositions);
        updateFallingSections(this.fallingSections, this.scene, this.heightAt, dt);
    }

    getSnapshot(): HouseSnapshot[] {
        return getHouseSnapshot(this.houses);
    }

    applySnapshot(snapshot: HouseSnapshot[]) {
        if (snapshot.length > 0 && this.houses.length === 0) {
            this.pendingHouseSnapshots = snapshot;
            return;
        }

        for (const state of snapshot) {
            const house = this.houses.find((entry) => entry.id === state.id);
            if (!house) continue;
            if (house.sections.length > 0 && state.sections) {
                this.applyHouseSectionSnapshot(house, state.sections);
            } else {
                house.hp = state.hp;
                if (house.active) {
                    this.setHouseStage(house, state.stage);
                } else {
                    house.stage = state.stage;
                }
            }
        }
    }

    applyHouseSnapshots(houseStates: HouseSnapshot[]) {
        this.applySnapshot(houseStates);
    }

    private applyHouseSectionSnapshot(house: HouseProp, sectionState: Record<string, number>) {
        for (const section of house.sections) {
            const nextHp = sectionState[section.id] ?? section.maxHp;
            const wasDestroyed = section.destroyed;
            section.hp = THREE.MathUtils.clamp(nextHp, 0, section.maxHp);
            if (section.hp <= 0) {
                destroyHouseSection(
                    section, this.physics, this.collisionMeshes, this.houseSectionByObjectId,
                    this.scene, this.fallingSections, false, house.active && !wasDestroyed
                );
            } else {
                this.restoreHouseSection(section);
            }
        }
        if (shouldCollapseSectionedHouse(house)) {
            this.collapseSectionedHouse(house);
        } else {
            this.restoreCollapsedHouseExtras(house);
        }
        recomputeSectionedHouseState(house);
        if (!house.active && house.sections.some((section) => section.destroyed)) {
            this.activateHouse(house);
        }
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        const proxyHouse = this.findHouseProxy(object);
        if (proxyHouse) {
            if (authoritative) {
                const section = this.findClosestSection(proxyHouse, point);
                if (section) {
                    const previousHp = section.hp;
                    this.damageHouseSection(proxyHouse, section, damage, point);
                    if (previousHp > 0 && section.hp <= 0) {
                        this.activateHouse(proxyHouse);
                    }
                } else {
                    this.damageHouse(proxyHouse, damage);
                    if (proxyHouse.stage > 0) {
                        this.activateHouse(proxyHouse);
                    }
                }
            }
            return true;
        }

        const sectionHit = this.findHouseSection(object);
        if (sectionHit) {
            if (authoritative) {
                this.damageHouseSection(sectionHit.house, sectionHit.section, damage, point);
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

    findHouseProxy(object: THREE.Object3D | null): HouseProp | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            const house = this.houseProxyByObjectId.get(current.id);
            if (house) return house;
            current = current.parent;
        }
        return null;
    }

    findHouse(object: THREE.Object3D | null): HouseProp | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            const house = this.houseByObjectId.get(current.id);
            if (house) return house;
            current = current.parent;
        }
        return null;
    }

    findHouseSection(object: THREE.Object3D | null): HouseSectionHit | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            const hit = this.houseSectionByObjectId.get(current.id);
            if (hit) return hit;
            current = current.parent;
        }
        return null;
    }

    findClosestSection(house: HouseProp, point: THREE.Vector3): HouseSectionProp | null {
        let bestSection: HouseSectionProp | null = null;
        let bestDistanceSq = Number.POSITIVE_INFINITY;
        for (const section of house.sections) {
            if (section.destroyed || !section.destructible) continue;
            const distanceSq = section.position.distanceToSquared(point);
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestSection = section;
            }
        }
        return bestSection;
    }

    private damageHouse(house: HouseProp, damage: number) {
        damageHouseLogic(house, damage, (h, s) => this.setHouseStage(h, s));
    }

    private damageHouseSection(house: HouseProp, section: HouseSectionProp, damage: number, point: THREE.Vector3) {
        damageHouseSectionLogic(
            house, section, damage, point,
            this.physics, this.collisionMeshes, this.houseSectionByObjectId,
            this.scene, this.fallingSections, this.fxEvents,
            (h) => shouldCollapseSectionedHouse(h),
            (h) => this.collapseSectionedHouse(h),
            (h) => recomputeSectionedHouseState(h)
        );
    }

    reset() {
        this.fxEvents = [];
        for (const piece of this.fallingSections) {
            this.scene.remove(piece.root);
        }
        this.fallingSections = [];
        for (const house of this.houses) {
            this.activateHouse(house);
            if (house.sections.length > 0) {
                for (const section of house.sections) {
                    section.hp = section.maxHp;
                    this.restoreHouseSection(section);
                }
                this.restoreCollapsedHouseExtras(house);
                recomputeSectionedHouseState(house);
            } else {
                house.hp = house.maxHp;
                this.setHouseStage(house, 0);
            }
            this.deactivateHouse(house);
        }
    }
}
