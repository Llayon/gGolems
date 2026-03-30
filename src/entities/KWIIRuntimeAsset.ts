import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponMountId } from '../combat/weaponTypes';
import heroMechUrl from '../assets/mechs/KWII_runtime_rigid.glb?url';

type StoredTransform = {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
};

type HeroAnimationKey = 'idle' | 'walk' | 'fire' | 'torsoTurn';

export type KWIIRuntimeVisual = {
    root: THREE.Group;
    viewAnchor: THREE.Object3D | null;
    torsoPivot: THREE.Vector3 | null;
    torsoRigNodes: THREE.Bone[];
    torsoRigRestPose: StoredTransform[];
    sockets: Partial<Record<WeaponMountId, THREE.Object3D>>;
    bones: {
        pelvis: THREE.Bone | null;
        waist: THREE.Bone | null;
        torso: THREE.Bone | null;
        head: THREE.Bone | null;
        leftArm: THREE.Bone | null;
        rightArm: THREE.Bone | null;
        leftThigh: THREE.Bone | null;
        rightThigh: THREE.Bone | null;
        leftShin: THREE.Bone | null;
        rightShin: THREE.Bone | null;
        leftFoot: THREE.Bone | null;
        rightFoot: THREE.Bone | null;
    };
    restPose: {
        pelvis: StoredTransform | null;
        waist: StoredTransform | null;
        torso: StoredTransform | null;
        head: StoredTransform | null;
        leftArm: StoredTransform | null;
        rightArm: StoredTransform | null;
        leftThigh: StoredTransform | null;
        rightThigh: StoredTransform | null;
        leftShin: StoredTransform | null;
        rightShin: StoredTransform | null;
        leftFoot: StoredTransform | null;
        rightFoot: StoredTransform | null;
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
        if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.needsUpdate = true;
            if (material.name.includes('Glow')) {
                material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.2);
            }
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

function getBone(root: THREE.Object3D, ...names: string[]) {
    for (const name of names) {
        const node = root.getObjectByName(name);
        if (node instanceof THREE.Bone) {
            return node;
        }
    }
    return null;
}

function findClip(animations: THREE.AnimationClip[], ...names: string[]) {
    for (const name of names) {
        const clip = animations.find((candidate) => candidate.name === name);
        if (clip) {
            return clip;
        }
    }
    return null;
}

function normalizeClip(clip: THREE.AnimationClip) {
    if (clip.tracks.length === 0) return clip;

    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = 0;

    for (const track of clip.tracks) {
        if (track.times.length === 0) continue;
        minTime = Math.min(minTime, track.times[0]);
        maxTime = Math.max(maxTime, track.times[track.times.length - 1]);
    }

    if (!Number.isFinite(minTime)) {
        return clip;
    }

    const normalizedTracks = clip.tracks.map((track) => {
        const normalizedTrack = track.clone();
        normalizedTrack.times = Float32Array.from(track.times, (time) => time - minTime);
        return normalizedTrack;
    });

    return new THREE.AnimationClip(clip.name, Math.max(0.001, maxTime - minTime), normalizedTracks);
}

async function getHeroTemplate() {
    if (!heroTemplatePromise) {
        heroTemplatePromise = new Promise((resolve) => {
            heroLoader.load(
                heroMechUrl,
                (gltf) => {
                    const root = gltf.scene as THREE.Group;
                    root.name = 'KWIIRuntimeRoot';
                    markShadow(root);
                    resolve({
                        root,
                        animations: gltf.animations.map((clip) => normalizeClip(clip))
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
    const pelvis = getBone(root, 'Pelvis');
    const waist = getBone(root, 'Waist');
    const torso = getBone(root, 'Torso');
    const head = getBone(root, 'Head');
    const leftArm = getBone(root, 'ArmL', 'Arm.L');
    const rightArm = getBone(root, 'ArmR', 'Arm.R');

    const actions: Partial<Record<HeroAnimationKey, THREE.AnimationAction>> = {
        idle: setupLoopAction(mixer, findClip(template.animations, 'KWII_Idle'), true) ?? undefined,
        walk: setupLoopAction(mixer, findClip(template.animations, 'KWII_Walk'), false) ?? undefined,
        fire: setupOneShotAction(mixer, findClip(template.animations, 'KWII_Fire')) ?? undefined,
        torsoTurn: setupLoopAction(mixer, findClip(template.animations, 'KWII_TorsoTurn'), false) ?? undefined
    };

    return {
        root,
        viewAnchor: root.getObjectByName('viewAnchor') ?? head,
        torsoPivot: null,
        torsoRigNodes: [],
        torsoRigRestPose: [],
        sockets: {
            leftArmMount: root.getObjectByName('leftArmMount') ?? getBone(root, 'GunL', 'Gun.L') ?? undefined,
            rightArmMount: root.getObjectByName('rightArmMount') ?? getBone(root, 'GunR', 'Gun.R') ?? undefined,
            torsoMount: root.getObjectByName('torsoMount') ?? torso ?? undefined
        },
        bones: {
            pelvis,
            waist,
            torso,
            head,
            leftArm,
            rightArm,
            leftThigh: null,
            rightThigh: null,
            leftShin: null,
            rightShin: null,
            leftFoot: null,
            rightFoot: null
        },
        restPose: {
            pelvis: captureTransform(pelvis),
            waist: captureTransform(waist),
            torso: captureTransform(torso),
            head: captureTransform(head),
            leftArm: captureTransform(leftArm),
            rightArm: captureTransform(rightArm),
            leftThigh: null,
            rightThigh: null,
            leftShin: null,
            rightShin: null,
            leftFoot: null,
            rightFoot: null
        },
        mixer,
        actions,
        locomotionState: 'idle'
    };
}
