import * as THREE from 'three';
import sectionedHouseUrl from '../assets/props/VillagePrefab_House_A_breakable_web.glb?url';
import staticHouseUrl from '../assets/props/VillageStatic_House_A_mobile.glb?url';
import brickBaseUrl from '../assets/props/breakable-house-textures/T_Brick_BaseColor.png?url';
import brickNormalUrl from '../assets/props/breakable-house-textures/T_Brick_Normal.png?url';
import plasterBaseUrl from '../assets/props/breakable-house-textures/T_Plaster_BaseColor.png?url';
import plasterNormalUrl from '../assets/props/breakable-house-textures/T_Plaster_Normal.png?url';
import roundTilesBaseUrl from '../assets/props/breakable-house-textures/T_RoundTiles_BaseColor.png?url';
import roundTilesNormalUrl from '../assets/props/breakable-house-textures/T_RoundTiles_Normal.png?url';
import unevenBrickBaseUrl from '../assets/props/breakable-house-textures/T_UnevenBrick_BaseColor.png?url';
import unevenBrickNormalUrl from '../assets/props/breakable-house-textures/T_UnevenBrick_Normal.png?url';
import woodTrimBaseUrl from '../assets/props/breakable-house-textures/T_WoodTrim_BaseColor.png?url';
import woodTrimNormalUrl from '../assets/props/breakable-house-textures/T_WoodTrim_Normal.png?url';
import { createGltfLoader } from './gltfLoader';

const houseLoader = createGltfLoader();
const houseTextureLoader = new THREE.TextureLoader();

let housePrefabTemplatePromise: Promise<THREE.Group> | null = null;
let houseProxyTemplatePromise: Promise<THREE.Group> | null = null;
let sectionedHouseMaterialLibraryPromise: Promise<Map<string, THREE.Material>> | null = null;

function loadHouseTexture(url: string, color = false) {
    return houseTextureLoader.loadAsync(url).then((texture) => {
        texture.flipY = false;
        if (color) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.needsUpdate = true;
        return texture;
    });
}

export function loadSectionedHouseTemplate(): Promise<THREE.Group> {
    if (!housePrefabTemplatePromise) {
        housePrefabTemplatePromise = houseLoader.loadAsync(sectionedHouseUrl).then((gltf) => {
            gltf.scene.updateMatrixWorld(true);
            return gltf.scene as THREE.Group;
        });
    }
    return housePrefabTemplatePromise;
}

export function loadHouseProxyTemplate(): Promise<THREE.Group> {
    if (!houseProxyTemplatePromise) {
        houseProxyTemplatePromise = houseLoader.loadAsync(staticHouseUrl).then((gltf) => {
            gltf.scene.updateMatrixWorld(true);
            return gltf.scene as THREE.Group;
        });
    }
    return houseProxyTemplatePromise;
}

export function loadSectionedHouseMaterialLibrary(): Promise<Map<string, THREE.Material>> {
    if (!sectionedHouseMaterialLibraryPromise) {
        sectionedHouseMaterialLibraryPromise = Promise.all([
            loadHouseTexture(plasterBaseUrl, true),
            loadHouseTexture(plasterNormalUrl),
            loadHouseTexture(woodTrimBaseUrl, true),
            loadHouseTexture(woodTrimNormalUrl),
            loadHouseTexture(roundTilesBaseUrl, true),
            loadHouseTexture(roundTilesNormalUrl),
            loadHouseTexture(unevenBrickBaseUrl, true),
            loadHouseTexture(unevenBrickNormalUrl),
            loadHouseTexture(brickBaseUrl, true),
            loadHouseTexture(brickNormalUrl)
        ]).then(([
            plasterBase, plasterNormal,
            woodBase, woodNormal,
            roofBase, roofNormal,
            stoneBase, stoneNormal,
            brickBase, brickNormal
        ]) => {
            const materialLibrary = new Map<string, THREE.Material>();
            materialLibrary.set('BH_Plaster', new THREE.MeshStandardMaterial({
                name: 'BH_Plaster_Textured', map: plasterBase, normalMap: plasterNormal, roughness: 0.98, metalness: 0
            }));
            materialLibrary.set('BH_Wood', new THREE.MeshStandardMaterial({
                name: 'BH_Wood_Textured', map: woodBase, normalMap: woodNormal, roughness: 0.92, metalness: 0
            }));
            materialLibrary.set('BH_Roof', new THREE.MeshStandardMaterial({
                name: 'BH_Roof_Textured', map: roofBase, normalMap: roofNormal, roughness: 0.9, metalness: 0
            }));
            materialLibrary.set('BH_Stone', new THREE.MeshStandardMaterial({
                name: 'BH_Stone_Textured', map: stoneBase, normalMap: stoneNormal, roughness: 1, metalness: 0
            }));
            materialLibrary.set('BH_Brick', new THREE.MeshStandardMaterial({
                name: 'BH_Brick_Textured', map: brickBase, normalMap: brickNormal, roughness: 0.96, metalness: 0
            }));
            materialLibrary.set('BH_Window', new THREE.MeshStandardMaterial({
                name: 'BH_Window_Textured', color: 0x1f2530, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.82
            }));
            return materialLibrary;
        });
    }
    return sectionedHouseMaterialLibraryPromise;
}

export function applySectionedHouseMaterials(root: THREE.Object3D, materialLibrary: Map<string, THREE.Material>) {
    root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (Array.isArray(node.material)) {
            node.material = node.material.map((material) => materialLibrary.get(material.name) ?? material);
            return;
        }
        node.material = materialLibrary.get(node.material.name) ?? node.material;
    });
}
