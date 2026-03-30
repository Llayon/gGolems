import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WeaponMountId } from '../combat/weaponTypes';
import heroMechUrl from '../assets/mechs/KWII_source_low.glb?url';
import materialAssignmentsRaw from '../assets/mechs/KWII_source_low.materials.json';
import handsBaseColorUrl from '../../mech-robot-kw-ii/textures/mech_hands_BaseColor.jpeg?url';
import handsEmissiveUrl from '../../mech-robot-kw-ii/textures/mech_hands_Emissive.jpeg?url';
import legsBaseColorUrl from '../../mech-robot-kw-ii/textures/mech_legs_BaseColor.jpeg?url';
import legsEmissiveUrl from '../../mech-robot-kw-ii/textures/mech_legs_Emissive.jpeg?url';
import torsoBaseColorUrl from '../../mech-robot-kw-ii/textures/mech_torso_BaseColor.jpeg?url';
import torsoEmissiveUrl from '../../mech-robot-kw-ii/textures/mech_torso_Emissive.jpeg?url';

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

type HeroMaterialKey = 'hands' | 'legs' | 'torso';

const heroLoader = new GLTFLoader();
const heroTextureLoader = new THREE.TextureLoader();
let heroTemplatePromise: Promise<HeroTemplate | null> | null = null;
let heroTexturesPromise: Promise<{
    hands: {
        baseColor: THREE.Texture;
        emissive: THREE.Texture;
    };
    legs: {
        baseColor: THREE.Texture;
        emissive: THREE.Texture;
    };
    torso: {
        baseColor: THREE.Texture;
        emissive: THREE.Texture;
    };
}> | null = null;
const materialAssignments = materialAssignmentsRaw as Record<string, HeroMaterialKey>;

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
            heroTextureLoader.loadAsync(handsBaseColorUrl),
            heroTextureLoader.loadAsync(handsEmissiveUrl),
            heroTextureLoader.loadAsync(legsBaseColorUrl),
            heroTextureLoader.loadAsync(legsEmissiveUrl),
            heroTextureLoader.loadAsync(torsoBaseColorUrl),
            heroTextureLoader.loadAsync(torsoEmissiveUrl)
        ]).then(([handsBaseColor, handsEmissive, legsBaseColor, legsEmissive, torsoBaseColor, torsoEmissive]) => ({
            hands: {
                baseColor: configureTexture(handsBaseColor, THREE.SRGBColorSpace),
                emissive: configureTexture(handsEmissive, THREE.SRGBColorSpace)
            },
            legs: {
                baseColor: configureTexture(legsBaseColor, THREE.SRGBColorSpace),
                emissive: configureTexture(legsEmissive, THREE.SRGBColorSpace)
            },
            torso: {
                baseColor: configureTexture(torsoBaseColor, THREE.SRGBColorSpace),
                emissive: configureTexture(torsoEmissive, THREE.SRGBColorSpace)
            }
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

function resolveSourceObjectName(node: THREE.Object3D | null) {
    let current: THREE.Object3D | null = node;
    while (current) {
        const sourceName = current.userData?.name;
        if (typeof sourceName === 'string' && sourceName.length > 0) {
            return sourceName;
        }
        current = current.parent;
    }
    return null;
}

function resolveHeroMaterialKey(node: THREE.Object3D): HeroMaterialKey {
    const sourceObjectName = resolveSourceObjectName(node);
    if (sourceObjectName) {
        const materialKey = materialAssignments[sourceObjectName];
        if (materialKey) {
            return materialKey;
        }
    }
    return 'torso';
}

function buildHeroMaterial(
    source: THREE.Material,
    materialKey: HeroMaterialKey,
    textures: Awaited<ReturnType<typeof getHeroTextures>>
) {
    const material = source instanceof THREE.MeshStandardMaterial
        ? source.clone()
        : new THREE.MeshStandardMaterial();
    const textureSet = textures[materialKey];

    material.name = `KWII_Source_${materialKey}`;
    material.color.setHex(0xffffff);
    material.map = textureSet.baseColor;
    material.emissiveMap = textureSet.emissive;
    material.emissive.setHex(0xa9e7ff);
    material.aoMap = null;
    material.normalMap = null;
    material.metalness = materialKey === 'hands' ? 0.16 : materialKey === 'legs' ? 0.1 : 0.08;
    material.roughness = materialKey === 'hands' ? 0.72 : materialKey === 'legs' ? 0.84 : 0.8;
    material.emissiveIntensity = materialKey === 'torso' ? 0.9 : 0.58;

    material.needsUpdate = true;
    return material;
}

function applyHeroMaterials(root: THREE.Object3D, textures: Awaited<ReturnType<typeof getHeroTextures>>) {
    const materialCache = new Map<HeroMaterialKey, THREE.Material>();

    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
        const materialKey = resolveHeroMaterialKey(child);
        const cached = materialCache.get(materialKey);
        if (cached) {
            child.material = cached;
            return;
        }
        const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
        const material = buildHeroMaterial(sourceMaterial, materialKey, textures);
        materialCache.set(materialKey, material);
        child.material = material;
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
                        applyHeroMaterials(root, await getHeroTextures());
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
        idle: setupLoopAction(mixer, findClip(template.animations, 'KWII_Idle', '00-keying', '00-keying_1'), true) ?? undefined,
        walk: setupLoopAction(mixer, findClip(template.animations, 'KWII_Walk', '01-walk'), false) ?? undefined,
        fire: setupOneShotAction(mixer, findClip(template.animations, 'KWII_Fire')) ?? undefined,
        torsoTurn: setupLoopAction(mixer, findClip(template.animations, 'KWII_TorsoTurn'), false) ?? undefined
    };

    const viewAnchor = root.getObjectByName('viewAnchor') ?? getBone(root, 'DEF-CAMERAS-BASE');
    const leftArmMount = root.getObjectByName('leftArmMount') ?? getBone(root, 'DEF-CANONL', 'DEF-MINIGUNL');
    const rightArmMount = root.getObjectByName('rightArmMount') ?? getBone(root, 'DEF-CANONR', 'DEF-MINIGUNR');
    const torsoMount = root.getObjectByName('torsoMount') ?? getBone(root, 'DEF-BODY', 'DEF-UPPER-BODY');

    return {
        root,
        viewAnchor,
        sockets: {
            leftArmMount: leftArmMount ?? undefined,
            rightArmMount: rightArmMount ?? undefined,
            torsoMount: torsoMount ?? undefined
        },
        bones: {
            pelvis: getBone(root, 'DEF-HIPS'),
            waist: getBone(root, 'DEF-BODY'),
            torso: getBone(root, 'DEF-UPPER-BODY'),
            head: getBone(root, 'DEF-CAMERAS-BASE'),
            leftArm: getBone(root, 'DEF-ARML', 'DEF-ARM.L'),
            rightArm: getBone(root, 'DEF-ARMR', 'DEF-ARM.R'),
            leftThigh: null,
            rightThigh: null,
            leftShin: null,
            rightShin: null,
            leftFoot: null,
            rightFoot: null
        },
        restPose: {
            pelvis: captureTransform(getBone(root, 'DEF-HIPS')),
            waist: captureTransform(getBone(root, 'DEF-BODY')),
            torso: captureTransform(getBone(root, 'DEF-UPPER-BODY')),
            head: captureTransform(getBone(root, 'DEF-CAMERAS-BASE')),
            leftArm: captureTransform(getBone(root, 'DEF-ARML', 'DEF-ARM.L')),
            rightArm: captureTransform(getBone(root, 'DEF-ARMR', 'DEF-ARM.R')),
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
