import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    type HouseProp,
    type HouseSectionProp,
    BREAKABLE_HOUSE_LAYOUT,
    collectMeshes,
    markShadows
} from './propShared';

export function inferSectionType(sectionId: string): string {
    if (sectionId.includes('FOUNDATION')) return 'foundation';
    if (sectionId.includes('ROOF')) return 'roof';
    if (sectionId.includes('CHIMNEY')) return 'chimney';
    if (sectionId.includes('DECO')) return 'prop';
    return 'wall';
}

export function defaultSectionHp(sectionId: string, sectionType: string): number {
    if (sectionType === 'roof') return 180;
    if (sectionType === 'chimney') return 60;
    if (sectionType === 'prop') return 40;
    if (sectionType === 'foundation') return 9999;
    if (sectionId.includes('CENTER')) return 140;
    return 120;
}

export function shouldSectionBlockMovement(section: HouseSectionProp): boolean {
    return section.sectionType === 'wall' || section.sectionType === 'chimney';
}

export function shouldSectionBlockShots(section: HouseSectionProp): boolean {
    return section.sectionType !== 'foundation' && section.destroyed === false;
}

export function buildSectionedHouses(
    template: THREE.Group,
    proxyTemplate: THREE.Group | undefined,
    scene: THREE.Scene,
    heightAt: (x: number, z: number) => number
): HouseProp[] {
    const houses: HouseProp[] = [];
    BREAKABLE_HOUSE_LAYOUT.forEach((layout, index) => {
        const root = template.clone(true);
        root.name = `village-house-${index}`;
        root.position.set(layout.x, heightAt(layout.x, layout.z), layout.z);
        root.rotation.y = layout.rot ?? 0;
        scene.add(root);
        root.updateMatrixWorld(true);
        markShadows(root);

        const house: HouseProp = {
            id: `house-${index}`,
            root,
            active: true,
            body: null,
            hp: 0,
            maxHp: 0,
            stage: 0,
            collisionEntries: [],
            position: root.position.clone(),
            prefabKind: 'sectioned',
            sections: [],
            sectionById: new Map(),
            loaded: true
        };

        houses.push(house);
    });
    return houses;
}

export function extractHouseSections(
    house: HouseProp,
    collisionMeshes: THREE.Mesh[],
    physics: RAPIER.World
) {
    house.root.traverse((node) => {
        const userData = node.userData ?? {};
        const sectionId = typeof userData.section_id === 'string'
            ? userData.section_id
            : (node.name.startsWith('SEC_') ? node.name : null);
        if (!sectionId || house.sectionById.has(sectionId)) return;

        const meshes = collectMeshes(node);
        if (meshes.length === 0) return;

        const sectionType = typeof userData.section_type === 'string'
            ? userData.section_type
            : inferSectionType(sectionId);
        const maxHp = Math.max(1, Number(userData.hp ?? defaultSectionHp(sectionId, sectionType)));
        const destructible = userData.destructible !== false;
        const position = node.getWorldPosition(new THREE.Vector3());
        const section: HouseSectionProp = {
            id: sectionId,
            root: node,
            meshes,
            body: null,
            hp: maxHp,
            maxHp,
            destroyed: false,
            destructible,
            sectionType,
            position,
            collisionEntries: []
        };

        section.collisionEntries = shouldSectionBlockShots(section) ? [...meshes] : [];
        if (section.collisionEntries.length > 0) {
            collisionMeshes.push(...section.collisionEntries);
            house.collisionEntries.push(...section.collisionEntries);
        }

        if (shouldSectionBlockMovement(section)) {
            section.body = createSectionBody(node, physics);
        }

        house.sections.push(section);
        house.sectionById.set(section.id, section);
    });
}

export function createSectionBody(sectionRoot: THREE.Object3D, physics: RAPIER.World) {
    const bounds = computeSectionLocalBounds(sectionRoot);
    if (!bounds) return null;

    const size = bounds.getSize(new THREE.Vector3());
    if (size.x < 0.08 || size.y < 0.08 || size.z < 0.08) {
        return null;
    }

    const centerLocal = bounds.getCenter(new THREE.Vector3());
    const centerWorld = sectionRoot.localToWorld(centerLocal.clone());
    const rotation = sectionRoot.getWorldQuaternion(new THREE.Quaternion());

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(centerWorld.x, centerWorld.y, centerWorld.z)
        .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    const body = physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
        Math.max(size.x * 0.48, 0.05),
        Math.max(size.y * 0.48, 0.05),
        Math.max(size.z * 0.48, 0.05)
    );
    physics.createCollider(colliderDesc, body);
    return body;
}

function computeSectionLocalBounds(sectionRoot: THREE.Object3D) {
    sectionRoot.updateMatrixWorld(true);
    const sectionInverse = new THREE.Matrix4().copy(sectionRoot.matrixWorld).invert();
    const box = new THREE.Box3();
    let hasGeometry = false;

    sectionRoot.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.geometry) return;
        if (!child.geometry.boundingBox) {
            child.geometry.computeBoundingBox();
        }
        if (!child.geometry.boundingBox) return;
        const localBox = child.geometry.boundingBox.clone();
        const childToSection = new THREE.Matrix4().multiplyMatrices(sectionInverse, child.matrixWorld);
        localBox.applyMatrix4(childToSection);
        if (!hasGeometry) {
            box.copy(localBox);
            hasGeometry = true;
        } else {
            box.union(localBox);
        }
    });

    return hasGeometry ? box : null;
}
