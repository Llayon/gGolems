import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isProtectedTerrainPadArea } from './HeightmapSource';
import { runWithConcurrency } from '../core/concurrency';

type CoverType = 'bush' | 'bush_flowers' | 'fern' | 'clover_1' | 'clover_2'
    | 'flower_3_single' | 'flower_3_group' | 'flower_4_single' | 'flower_4_group'
    | 'plant_1' | 'plant_1_big' | 'plant_7' | 'plant_7_big';

type ScatterConfig = {
    density: number;
    minScale: number;
    maxScale: number;
    minDistance: number;
};

type Placement = {
    type: CoverType;
    x: number;
    z: number;
    scale: number;
    rotationY: number;
};

const CONFIGS: Record<CoverType, ScatterConfig> = {
    bush: { density: 0.001, minScale: 0.7, maxScale: 1.3, minDistance: 5.0 },
    bush_flowers: { density: 0.0008, minScale: 0.8, maxScale: 1.2, minDistance: 5.0 },
    fern: { density: 0.002, minScale: 0.6, maxScale: 1.0, minDistance: 3.0 },
    clover_1: { density: 0.003, minScale: 0.4, maxScale: 0.7, minDistance: 2.0 },
    clover_2: { density: 0.002, minScale: 0.4, maxScale: 0.7, minDistance: 2.0 },
    flower_3_single: { density: 0.0015, minScale: 0.5, maxScale: 0.9, minDistance: 2.5 },
    flower_3_group: { density: 0.0008, minScale: 0.6, maxScale: 1.0, minDistance: 3.0 },
    flower_4_single: { density: 0.0015, minScale: 0.5, maxScale: 0.9, minDistance: 2.5 },
    flower_4_group: { density: 0.0008, minScale: 0.6, maxScale: 1.0, minDistance: 3.0 },
    plant_1: { density: 0.002, minScale: 0.6, maxScale: 1.0, minDistance: 3.0 },
    plant_1_big: { density: 0.001, minScale: 0.8, maxScale: 1.3, minDistance: 4.0 },
    plant_7: { density: 0.002, minScale: 0.6, maxScale: 1.0, minDistance: 3.0 },
    plant_7_big: { density: 0.001, minScale: 0.8, maxScale: 1.3, minDistance: 4.0 },
};

const PATHS: Record<CoverType, string> = {
    bush: 'assets/nature/Bush_Common.gltf',
    bush_flowers: 'assets/nature/Bush_Common_Flowers.gltf',
    fern: 'assets/nature/Fern_1.gltf',
    clover_1: 'assets/nature/Clover_1.gltf',
    clover_2: 'assets/nature/Clover_2.gltf',
    flower_3_single: 'assets/nature/Flower_3_Single.gltf',
    flower_3_group: 'assets/nature/Flower_3_Group.gltf',
    flower_4_single: 'assets/nature/Flower_4_Single.gltf',
    flower_4_group: 'assets/nature/Flower_4_Group.gltf',
    plant_1: 'assets/nature/Plant_1.gltf',
    plant_1_big: 'assets/nature/Plant_1_Big.gltf',
    plant_7: 'assets/nature/Plant_7.gltf',
    plant_7_big: 'assets/nature/Plant_7_Big.gltf',
};

const ASSET_LOAD_TIMEOUT_MS = 8000;
const _dummy = new THREE.Object3D();

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export class GroundCoverSpawner {
    private scene: THREE.Scene;
    private instanceMeshes: Map<CoverType, THREE.InstancedMesh[]> = new Map();
    private placements: Placement[] = [];
    private loader: GLTFLoader;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
    }

    async loadAll() {
        const types = Object.keys(PATHS) as CoverType[];
        await runWithConcurrency(types, (type) => this.loadType(type), 4);
    }

    private async loadType(type: CoverType) {
        try {
            const gltf = await Promise.race([
                this.loader.loadAsync(PATHS[type]),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout loading ${PATHS[type]}`)), ASSET_LOAD_TIMEOUT_MS))
            ]);
            const mesh = this.extractMesh(gltf.scene);
            if (!mesh) return;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const instancedMesh = new THREE.InstancedMesh(
                mesh.geometry,
                mesh.material as THREE.Material,
                200
            );
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;
            instancedMesh.count = 0;
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            this.scene.add(instancedMesh);
            this.instanceMeshes.set(type, [instancedMesh]);
        } catch (error) {
            console.warn(`Failed to load ground cover ${type}:`, error);
        }
    }

    private extractMesh(scene: THREE.Object3D): THREE.Mesh | null {
        let result: THREE.Mesh | null = null;
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && !result) {
                result = child;
            }
        });
        return result;
    }

    scatter(sampleHeight: (x: number, z: number) => number, halfSize: number, seed = 42) {
        const rand = seededRandom(seed);
        const arenaSize = halfSize * 2;
        const newPlacements: Placement[] = [];

        const types = Object.keys(CONFIGS) as CoverType[];

        for (const type of types) {
            const config = CONFIGS[type];
            const targetCount = Math.floor(arenaSize * arenaSize * config.density);
            const placed: { x: number; z: number }[] = [];

            for (let i = 0; i < targetCount * 4; i++) {
                if (placed.length >= targetCount) break;

                const x = (rand() - 0.5) * arenaSize * 0.94;
                const z = (rand() - 0.5) * arenaSize * 0.94;

                if (isProtectedTerrainPadArea(x, z, 4)) continue;

                const tooClose = placed.some((p) => {
                    const dx = p.x - x;
                    const dz = p.z - z;
                    return dx * dx + dz * dz < config.minDistance * config.minDistance;
                });
                if (tooClose) continue;

                const scale = config.minScale + rand() * (config.maxScale - config.minScale);
                const rotationY = rand() * Math.PI * 2;

                newPlacements.push({ type, x, z, scale, rotationY });
                placed.push({ x, z });
            }
        }

        this.placements = newPlacements;
        this.updateInstances(sampleHeight);
    }

    private updateInstances(sampleHeight: (x: number, z: number) => number) {
        for (const [type, meshes] of this.instanceMeshes.entries()) {
            const placements = this.placements.filter((p) => p.type === type);
            const maxPerMesh = 200;
            let meshIndex = 0;
            let instanceIndex = 0;

            for (const placement of placements) {
                if (meshIndex >= meshes.length) break;

                if (instanceIndex >= maxPerMesh) {
                    meshes[meshIndex].count = instanceIndex;
                    meshes[meshIndex].instanceMatrix.needsUpdate = true;
                    meshIndex++;
                    instanceIndex = 0;
                }

                const y = sampleHeight(placement.x, placement.z);
                _dummy.position.set(placement.x, y, placement.z);
                _dummy.scale.setScalar(placement.scale);
                _dummy.rotation.set(0, placement.rotationY, 0);
                _dummy.updateMatrix();

                meshes[meshIndex].setMatrixAt(instanceIndex, _dummy.matrix);
                instanceIndex++;
            }

            if (meshes[meshIndex]) {
                meshes[meshIndex].count = instanceIndex;
                meshes[meshIndex].instanceMatrix.needsUpdate = true;
            }

            for (let i = meshIndex + 1; i < meshes.length; i++) {
                meshes[i].count = 0;
                meshes[i].instanceMatrix.needsUpdate = true;
            }
        }
    }

    dispose() {
        for (const meshes of this.instanceMeshes.values()) {
            for (const mesh of meshes) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
        this.instanceMeshes.clear();
        this.placements = [];
    }
}
