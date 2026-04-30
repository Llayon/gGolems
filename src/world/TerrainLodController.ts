import * as THREE from 'three';

export type LodLevel = 'high' | 'mid' | 'low';

export type TerrainLodConfig = {
    highDistance: number;
    midDistance: number;
    lowDistance: number;
};

const DEFAULT_CONFIG: TerrainLodConfig = {
    highDistance: 80,
    midDistance: 160,
    lowDistance: Infinity
};

export class TerrainLodController {
    camera: THREE.Camera;
    meshes: Record<LodLevel, THREE.Mesh | null>;
    activeLevel: LodLevel;
    config: TerrainLodConfig;
    private _tempVec = new THREE.Vector3();

    constructor(camera: THREE.Camera, config: Partial<TerrainLodConfig> = {}) {
        this.camera = camera;
        this.meshes = { high: null, mid: null, low: null };
        this.activeLevel = 'high';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    registerMesh(level: LodLevel, mesh: THREE.Mesh) {
        this.meshes[level] = mesh;
        mesh.visible = level === this.activeLevel;
    }

    update() {
        const cameraPos = this.camera.getWorldPosition(this._tempVec);
        const newLevel = this.resolveLevel(cameraPos);
        if (newLevel !== this.activeLevel) {
            this.switchLevel(newLevel);
        }
    }

    private resolveLevel(cameraPos: THREE.Vector3): LodLevel {
        const dist = Math.sqrt(cameraPos.x * cameraPos.x + cameraPos.z * cameraPos.z);
        if (dist <= this.config.highDistance) return 'high';
        if (dist <= this.config.midDistance) return 'mid';
        return 'low';
    }

    private switchLevel(level: LodLevel) {
        const previous = this.meshes[this.activeLevel];
        if (previous) previous.visible = false;

        this.activeLevel = level;
        const next = this.meshes[level];
        if (next) next.visible = true;
    }
}
