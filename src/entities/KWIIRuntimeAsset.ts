import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponMountId } from '../combat/weaponTypes';
import heroMechUrl from '../assets/mechs/KWII_runtime_low.glb?url';

type StoredTransform = {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
};

type HeroAnimationKey = 'idle' | 'walk' | 'fire' | 'torsoTurn';

export type KWIIRuntimeVisual = {
    root: THREE.Group;
    viewAnchor: THREE.Object3D | null;
    sockets: Partial<Record<WeaponMountId, THREE.Object3D>>;
    bones: {
        pelvis: THREE.Bone | null;
        waist: THREE.Bone | null;
        torso: THREE.Bone | null;
        head: THREE.Bone | null;
        leftArm: THREE.Bone | null;
        rightArm: THREE.Bone | null;
    };
    restPose: {
        pelvis: StoredTransform | null;
        waist: StoredTransform | null;
        torso: StoredTransform | null;
        head: StoredTransform | null;
        leftArm: StoredTransform | null;
        rightArm: StoredTransform | null;
    };
    mixer: THREE.AnimationMixer;
    actions: Partial<Record<HeroAnimationKey, THREE.AnimationAction>>;
    locomotionState: 'idle' | 'walk';
};

type HeroTemplate = {
    root: THREE.Group;
    animations: THREE.AnimationClip[];
};

const heroLoader = new GLTFLoader();
let heroTemplatePromise: Promise<HeroTemplate | null> | null = null;

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

function getBone(root: THREE.Object3D, name: string) {
    const node = root.getObjectByName(name);
    return node instanceof THREE.Bone ? node : null;
}

function findClip(animations: THREE.AnimationClip[], name: string) {
    return animations.find((clip) => clip.name === name) ?? null;
}

async function getHeroTemplate() {
    if (!heroTemplatePromise) {
        heroTemplatePromise = new Promise((resolve) => {
            heroLoader.load(
                heroMechUrl,
                (gltf) => {
                    const root = gltf.scene;
                    root.name = 'KWIIRuntimeRoot';
                    markShadow(root);
                    resolve({
                        root,
                        animations: gltf.animations
                    });
                },
                undefined,
                (error) => {
                    console.warn('Failed to load KWII mech asset', error);
                    resolve(null);
                }
            );
        });
    }

    return heroTemplatePromise;
}

function setupLoopAction(mixer: THREE.AnimationMixer, clip: THREE.AnimationClip | null, enabled = true) {
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.enabled = enabled;
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveWeight(enabled ? 1 : 0);
    action.play();
    return action;
}

function setupOneShotAction(mixer: THREE.AnimationMixer, clip: THREE.AnimationClip | null) {
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopOnce, 1);
    action.setEffectiveWeight(1);
    action.stop();
    return action;
}

export async function createKWIIRuntimeVisual(): Promise<KWIIRuntimeVisual | null> {
    const template = await getHeroTemplate();
    if (!template) return null;

    const root = clone(template.root) as THREE.Group;
    root.name = 'KWIIRuntimeRootInstance';
    markShadow(root);

    const mixer = new THREE.AnimationMixer(root);
    const actions: Partial<Record<HeroAnimationKey, THREE.AnimationAction>> = {
        idle: setupLoopAction(mixer, findClip(template.animations, 'KWII_Idle'), true) ?? undefined,
        walk: setupLoopAction(mixer, findClip(template.animations, 'KWII_Walk'), false) ?? undefined,
        fire: setupOneShotAction(mixer, findClip(template.animations, 'KWII_Fire')) ?? undefined,
        torsoTurn: setupLoopAction(mixer, findClip(template.animations, 'KWII_TorsoTurn'), false) ?? undefined
    };

    return {
        root,
        viewAnchor: root.getObjectByName('viewAnchor'),
        sockets: {
            leftArmMount: root.getObjectByName('leftArmMount') ?? undefined,
            rightArmMount: root.getObjectByName('rightArmMount') ?? undefined,
            torsoMount: root.getObjectByName('torsoMount') ?? undefined
        },
        bones: {
            pelvis: getBone(root, 'Pelvis'),
            waist: getBone(root, 'Waist'),
            torso: getBone(root, 'Torso'),
            head: getBone(root, 'Head'),
            leftArm: getBone(root, 'Arm.L'),
            rightArm: getBone(root, 'Arm.R')
        },
        restPose: {
            pelvis: captureTransform(getBone(root, 'Pelvis')),
            waist: captureTransform(getBone(root, 'Waist')),
            torso: captureTransform(getBone(root, 'Torso')),
            head: captureTransform(getBone(root, 'Head')),
            leftArm: captureTransform(getBone(root, 'Arm.L')),
            rightArm: captureTransform(getBone(root, 'Arm.R'))
        },
        mixer,
        actions,
        locomotionState: 'idle'
    };
}
