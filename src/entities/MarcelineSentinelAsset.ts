import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponMountId } from '../combat/weaponTypes';
import heroMechUrl from '../assets/mechs/MarcelineSentinel_game_512.glb?url';

type StoredTransform = {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
};

export type MarcelineSentinelVisual = {
    root: THREE.Group;
    viewAnchor: THREE.Object3D | null;
    sockets: Partial<Record<WeaponMountId, THREE.Object3D>>;
    bones: {
        pelvis: THREE.Bone | null;
        torso: THREE.Bone | null;
        leftArm: THREE.Bone | null;
        rightArm: THREE.Bone | null;
    };
    restPose: {
        pelvis: StoredTransform | null;
        torso: StoredTransform | null;
        leftArm: StoredTransform | null;
        rightArm: StoredTransform | null;
    };
};

const heroLoader = new GLTFLoader();
let heroTemplatePromise: Promise<THREE.Group | null> | null = null;

function markShadow(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
        }
    });
}

function captureTransform(node: THREE.Object3D | null): StoredTransform | null {
    if (!node) return null;
    return {
        position: node.position.clone(),
        quaternion: node.quaternion.clone()
    };
}

async function getHeroTemplate() {
    if (!heroTemplatePromise) {
        heroTemplatePromise = new Promise((resolve) => {
            heroLoader.load(
                heroMechUrl,
                (gltf) => {
                    const root = gltf.scene;
                    root.name = 'MarcelineSentinelRoot';
                    markShadow(root);
                    resolve(root);
                },
                undefined,
                (error) => {
                    console.warn('Failed to load Marceline Sentinel mech asset', error);
                    resolve(null);
                }
            );
        });
    }

    return heroTemplatePromise;
}

function getBone(root: THREE.Object3D, name: string) {
    const node = root.getObjectByName(name);
    return node instanceof THREE.Bone ? node : null;
}

export async function createMarcelineSentinelVisual(): Promise<MarcelineSentinelVisual | null> {
    const template = await getHeroTemplate();
    if (!template) return null;

    const root = clone(template) as THREE.Group;
    root.name = 'MarcelineSentinelRootInstance';
    root.scale.setScalar(1.45);
    markShadow(root);

    const pelvis = getBone(root, 'MechPelvis');
    const torso = getBone(root, 'MechRibcage');
    const leftArm = getBone(root, 'MechArmLShoulder');
    const rightArm = getBone(root, 'MechArmRShoulder');

    return {
        root,
        viewAnchor: root.getObjectByName('viewAnchor'),
        sockets: {
            leftArmMount: root.getObjectByName('leftArmMount') ?? undefined,
            rightArmMount: root.getObjectByName('rightArmMount') ?? undefined,
            torsoMount: root.getObjectByName('torsoMount') ?? undefined
        },
        bones: {
            pelvis,
            torso,
            leftArm,
            rightArm
        },
        restPose: {
            pelvis: captureTransform(pelvis),
            torso: captureTransform(torso),
            leftArm: captureTransform(leftArm),
            rightArm: captureTransform(rightArm)
        }
    };
}
