import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isProtectedTerrainPadArea } from './HeightmapSource';
import { runWithConcurrency } from '../core/concurrency';

type TreeSpecies = 'common' | 'dead' | 'twisted' | 'pine';

type TreePlacement = {
    species: TreeSpecies;
    x: number;
    z: number;
    scale: number;
    rotationY: number;
};

type ScatterConfig = {
    density: number;
    minScale: number;
    maxScale: number;
    minDistance: number;
    species: TreeSpecies[];
    speciesWeights: number[];
};

const DEFAULT_CONFIGS: Record<TreeSpecies, ScatterConfig> = {
    common: { density: 0.0008, minScale: 0.8, maxScale: 1.3, minDistance: 12, species: ['common'], speciesWeights: [1] },
    dead: { density: 0.0004, minScale: 0.9, maxScale: 1.4, minDistance: 14, species: ['dead'], speciesWeights: [1] },
    twisted: { density: 0.0003, minScale: 0.7, maxScale: 1.2, minDistance: 16, species: ['twisted'], speciesWeights: [1] },
    pine: { density: 0.0006, minScale: 0.8, maxScale: 1.2, minDistance: 10, species: ['pine'], speciesWeights: [1] },
};

const TREE_PATHS: Record<TreeSpecies, string[]> = {
    common: ['assets/nature/CommonTree_1.gltf', 'assets/nature/CommonTree_2.gltf', 'assets/nature/CommonTree_3.gltf', 'assets/nature/CommonTree_4.gltf', 'assets/nature/CommonTree_5.gltf'],
    dead: ['assets/nature/DeadTree_1.gltf', 'assets/nature/DeadTree_2.gltf', 'assets/nature/DeadTree_3.gltf', 'assets/nature/DeadTree_4.gltf', 'assets/nature/DeadTree_5.gltf'],
    twisted: ['assets/nature/TwistedTree_1.gltf', 'assets/nature/TwistedTree_2.gltf', 'assets/nature/TwistedTree_3.gltf', 'assets/nature/TwistedTree_4.gltf', 'assets/nature/TwistedTree_5.gltf'],
    pine: ['assets/nature/Pine_1.gltf', 'assets/nature/Pine_2.gltf', 'assets/nature/Pine_3.gltf', 'assets/nature/Pine_4.gltf', 'assets/nature/Pine_5.gltf'],
};

const ASSET_LOAD_TIMEOUT_MS = 30000;

const _vec3 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export class TreeSpawner {
    private scene: THREE.Scene;
    private instanceGroups: Map<TreeSpecies, THREE.InstancedMesh[]> = new Map();
    private placements: TreePlacement[] = [];
    private loader: GLTFLoader;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
    }

    async loadAllTrees() {
        const loadTasks: { species: TreeSpecies; path: string }[] = [];

        for (const species of Object.keys(TREE_PATHS) as TreeSpecies[]) {
            const paths = TREE_PATHS[species];
            for (const path of paths) {
                loadTasks.push({ species, path });
            }
        }

        await runWithConcurrency(loadTasks, (task) => this.loadSingleTree(task.species, task.path), 4);
    }

    private async loadSingleTree(species: TreeSpecies, path: string) {
        try {
            const gltf = await Promise.race([
                this.loader.loadAsync(path),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout loading ${path}`)), ASSET_LOAD_TIMEOUT_MS))
            ]);
            const mesh = this.extractMesh(gltf.scene);
            if (!mesh) return;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const key = `${species}:${path}`;
            let group = this.instanceGroups.get(species);
            if (!group) {
                group = [];
                this.instanceGroups.set(species, group);
            }

            const instancedMesh = new THREE.InstancedMesh(
                mesh.geometry,
                mesh.material as THREE.Material,
                100
            );
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;
            instancedMesh.count = 0;
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

            this.scene.add(instancedMesh);
            group.push(instancedMesh);
        } catch (error) {
            console.warn(`Failed to load tree ${path}:`, error);
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

    scatter(
        sampleHeight: (x: number, z: number) => number,
        halfSize: number,
        seed = 42
    ) {
        const rand = seededRandom(seed);
        const arenaSize = halfSize * 2;
        const allPlacements: TreePlacement[] = [];

        for (const species of Object.keys(DEFAULT_CONFIGS) as TreeSpecies[]) {
            const config = DEFAULT_CONFIGS[species];
            const targetCount = Math.floor(arenaSize * arenaSize * config.density);
            const placed: { x: number; z: number }[] = [];

            for (let i = 0; i < targetCount * 3; i++) {
                if (placed.length >= targetCount) break;

                const x = (rand() - 0.5) * arenaSize * 0.92;
                const z = (rand() - 0.5) * arenaSize * 0.92;

                if (isProtectedTerrainPadArea(x, z, 6)) continue;

                const tooClose = placed.some((p) => {
                    const dx = p.x - x;
                    const dz = p.z - z;
                    return dx * dx + dz * dz < config.minDistance * config.minDistance;
                });
                if (tooClose) continue;

                const scale = config.minScale + rand() * (config.maxScale - config.minScale);
                const rotationY = rand() * Math.PI * 2;

                allPlacements.push({ species, x, z, scale, rotationY });
                placed.push({ x, z });
            }
        }

        this.placements = allPlacements;
        this.updateInstances(sampleHeight);
    }

    private updateInstances(sampleHeight: (x: number, z: number) => number) {
        const speciesGroups = new Map<TreeSpecies, TreePlacement[]>();
        for (const p of this.placements) {
            const list = speciesGroups.get(p.species) || [];
            list.push(p);
            speciesGroups.set(p.species, list);
        }

        const dummy = new THREE.Object3D();

        for (const [species, placements] of speciesGroups.entries()) {
            const groups = this.instanceGroups.get(species);
            if (!groups || groups.length === 0) continue;

            const maxPerMesh = 100;
            let meshIndex = 0;
            let instanceIndex = 0;

            for (const placement of placements) {
                if (meshIndex >= groups.length) break;

                if (instanceIndex >= maxPerMesh) {
                    groups[meshIndex].count = instanceIndex;
                    groups[meshIndex].instanceMatrix.needsUpdate = true;
                    meshIndex++;
                    instanceIndex = 0;
                }

                if (meshIndex >= groups.length) break;

                const y = sampleHeight(placement.x, placement.z);
                dummy.position.set(placement.x, y, placement.z);
                dummy.scale.setScalar(placement.scale);
                dummy.rotation.set(0, placement.rotationY, 0);
                dummy.updateMatrix();

                groups[meshIndex].setMatrixAt(instanceIndex, dummy.matrix);
                instanceIndex++;
            }

            if (groups[meshIndex]) {
                groups[meshIndex].count = instanceIndex;
                groups[meshIndex].instanceMatrix.needsUpdate = true;
            }

            for (let i = meshIndex + 1; i < groups.length; i++) {
                groups[i].count = 0;
                groups[i].instanceMatrix.needsUpdate = true;
            }
        }
    }

    dispose() {
        for (const groups of this.instanceGroups.values()) {
            for (const mesh of groups) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
        this.instanceGroups.clear();
        this.placements = [];
    }
}
