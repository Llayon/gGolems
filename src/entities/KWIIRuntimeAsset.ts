import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponMountId } from '../combat/weaponTypes';
import heroMechUrl from '../assets/mechs/KWII_runtime_low.glb?url';
import kwiiAoUrl from '../assets/mechs/kwii_bakes/KWII_AO.png?url';
import kwiiBaseColorUrl from '../assets/mechs/kwii_bakes/KWII_BaseColor.png?url';
import kwiiEmissionUrl from '../assets/mechs/kwii_bakes/KWII_Emission.png?url';
import kwiiNormalUrl from '../assets/mechs/kwii_bakes/KWII_Normal.png?url';

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
const heroTextureLoader = new THREE.TextureLoader();
let heroTemplatePromise: Promise<HeroTemplate | null> | null = null;
let heroTexturesPromise: Promise<{
    ao: THREE.Texture;
    baseColor: THREE.Texture;
    emission: THREE.Texture;
    normal: THREE.Texture;
}> | null = null;

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

function configureTexture(
    texture: THREE.Texture,
    colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
    disableMipmaps = false
) {
    texture.colorSpace = colorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (disableMipmaps) {
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
    }
    texture.needsUpdate = true;
    return texture;
}

async function getHeroTextures() {
    if (!heroTexturesPromise) {
        heroTexturesPromise = Promise.all([
            heroTextureLoader.loadAsync(kwiiAoUrl),
            heroTextureLoader.loadAsync(kwiiBaseColorUrl),
            heroTextureLoader.loadAsync(kwiiEmissionUrl),
            heroTextureLoader.loadAsync(kwiiNormalUrl)
        ]).then(([ao, baseColor, emission, normal]) => ({
            ao: configureTexture(ao, THREE.NoColorSpace, true),
            baseColor: configureTexture(baseColor, THREE.SRGBColorSpace, true),
            emission: configureTexture(emission, THREE.SRGBColorSpace, true),
            normal: configureTexture(normal, THREE.NoColorSpace, true)
        }));
    }

    return heroTexturesPromise;
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

function findClip(animations: THREE.AnimationClip[], name: string) {
    return animations.find((clip) => clip.name === name) ?? null;
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

function ensureSecondaryUv(root: THREE.Object3D) {
    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
        const geometry = child.geometry;
        if (!geometry || geometry.getAttribute('uv2') || !geometry.getAttribute('uv')) return;
        geometry.setAttribute('uv2', geometry.getAttribute('uv').clone());
    });
}

function buildBakedMaterial(
    source: THREE.Material,
    textures: Awaited<ReturnType<typeof getHeroTextures>>
) {
    if (!(source instanceof THREE.MeshStandardMaterial)) {
        return source;
    }

    const material = source.clone();
    material.map = textures.baseColor;
    material.normalMap = textures.normal;
    material.aoMap = textures.ao;
    material.normalScale.setScalar(0.6);
    material.aoMapIntensity = 0.22;
    material.emissiveMap = null;
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 0;

    if (material.name === 'KWII_Runtime_Dark') {
        material.color.setHex(0xd7dde4);
        material.metalness = 0.08;
        material.roughness = 0.9;
        material.aoMapIntensity = 0.16;
    } else if (material.name === 'KWII_Runtime_Glow') {
        material.color.setHex(0xffffff);
        material.metalness = 0.04;
        material.roughness = 0.72;
        material.aoMapIntensity = 0.08;
        material.emissive.setHex(0x83d8ff);
        material.emissiveMap = textures.emission;
        material.emissiveIntensity = 1.55;
    } else {
        material.color.setHex(0xffffff);
        material.metalness = 0.12;
        material.roughness = 0.84;
    }

    material.needsUpdate = true;
    return material;
}

function applyBakedMaterials(root: THREE.Object3D, textures: Awaited<ReturnType<typeof getHeroTextures>>) {
    const materialCache = new Map<string, THREE.Material>();
    ensureSecondaryUv(root);

    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;

        if (Array.isArray(child.material)) {
            child.material = child.material.map((material) => {
                const cached = materialCache.get(material.uuid);
                if (cached) return cached;

                const bakedMaterial = buildBakedMaterial(material, textures);
                materialCache.set(material.uuid, bakedMaterial);
                return bakedMaterial;
            });
            return;
        }

        const cached = materialCache.get(child.material.uuid);
        if (cached) {
            child.material = cached;
            return;
        }

        const bakedMaterial = buildBakedMaterial(child.material, textures);
        materialCache.set(child.material.uuid, bakedMaterial);
        child.material = bakedMaterial;
    });
}

async function getHeroTemplate() {
    if (!heroTemplatePromise) {
        heroTemplatePromise = new Promise((resolve) => {
            heroLoader.load(
                heroMechUrl,
                async (gltf) => {
                    const root = gltf.scene;
                    root.name = 'KWIIRuntimeRoot';
                    try {
                        applyBakedMaterials(root, await getHeroTextures());
                    } catch (error) {
                        console.warn('Failed to load KWII mech textures', error);
                    }
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
            leftArm: getBone(root, 'ArmL', 'Arm.L'),
            rightArm: getBone(root, 'ArmR', 'Arm.R'),
            leftThigh: getBone(root, 'ThighL'),
            rightThigh: getBone(root, 'ThighR'),
            leftShin: getBone(root, 'ShinL'),
            rightShin: getBone(root, 'ShinR'),
            leftFoot: getBone(root, 'FootL'),
            rightFoot: getBone(root, 'FootR')
        },
        restPose: {
            pelvis: captureTransform(getBone(root, 'Pelvis')),
            waist: captureTransform(getBone(root, 'Waist')),
            torso: captureTransform(getBone(root, 'Torso')),
            head: captureTransform(getBone(root, 'Head')),
            leftArm: captureTransform(getBone(root, 'ArmL', 'Arm.L')),
            rightArm: captureTransform(getBone(root, 'ArmR', 'Arm.R')),
            leftThigh: captureTransform(getBone(root, 'ThighL')),
            rightThigh: captureTransform(getBone(root, 'ThighR')),
            leftShin: captureTransform(getBone(root, 'ShinL')),
            rightShin: captureTransform(getBone(root, 'ShinR')),
            leftFoot: captureTransform(getBone(root, 'FootL')),
            rightFoot: captureTransform(getBone(root, 'FootR'))
        },
        mixer,
        actions,
        locomotionState: 'idle'
    };
}
