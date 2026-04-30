import * as THREE from 'three';

export type HeightmapSource = {
    width: number;
    height: number;
    sample(x: number, z: number): number;
    getHeightArray(): Float32Array;
};

// --- ProceduralHeightmap: Simplex FBM-based terrain ---

type Octave = {
    frequency: number;
    amplitude: number;
    lacunarity: number;
    gain: number;
};

export type ProceduralHeightmapConfig = {
    size: number;
    baseHeight: number;
    minHeight: number;
    octaves: Octave[];
    seed?: number;
};

const DEFAULT_OCTAVES: Octave[] = [
    { frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 },
    { frequency: 0.016, amplitude: 0.5, lacunarity: 2.0, gain: 0.5 },
    { frequency: 0.032, amplitude: 0.25, lacunarity: 2.0, gain: 0.5 },
    { frequency: 0.064, amplitude: 0.125, lacunarity: 2.0, gain: 0.5 },
];

// Simple hash-based noise (no external dependency)
function hashNoise(x: number, y: number, seed: number): number {
    const h = seed + x * 374761393 + y * 668265263;
    const s = Math.sin(h) * 43758.5453123;
    return s - Math.floor(s);
}

function smoothNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = hashNoise(ix, iy, seed);
    const n10 = hashNoise(ix + 1, iy, seed);
    const n01 = hashNoise(ix, iy + 1, seed);
    const n11 = hashNoise(ix + 1, iy + 1, seed);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;

    return nx0 * (1 - sy) + nx1 * sy;
}

function fbmNoise(x: number, y: number, seed: number, octaves: Octave[]): number {
    let value = 0;
    let amplitudeSum = 0;

    for (const octave of octaves) {
        value += smoothNoise(x * octave.frequency, y * octave.frequency, seed) * octave.amplitude;
        amplitudeSum += octave.amplitude;
    }

    return value / amplitudeSum;
}

export class ProceduralHeightmap implements HeightmapSource {
    readonly width: number;
    readonly height: number;
    private heights: Float32Array;
    private halfSize: number;
    private baseHeight: number;
    private minHeight: number;
    private octaves: Octave[];
    private seed: number;

    constructor(config: ProceduralHeightmapConfig) {
        this.width = config.size;
        this.height = config.size;
        this.baseHeight = config.baseHeight;
        this.minHeight = config.minHeight;
        this.octaves = config.octaves;
        this.seed = config.seed ?? 42;
        this.halfSize = 132; // matches Arena.halfSize

        this.heights = this.generateHeights();
    }

    private generateHeights(): Float32Array {
        const size = this.width * this.height;
        const heights = new Float32Array(size);

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const x = (col / (this.width - 1) - 0.5) * this.halfSize * 2;
                const z = (row / (this.height - 1) - 0.5) * this.halfSize * 2;

                const noise = fbmNoise(x, z, this.seed, this.octaves);
                const height = this.baseHeight + (noise - 0.5) * 8;

                heights[row * this.width + col] = Math.max(this.minHeight, height);
            }
        }

        return heights;
    }

    sample(x: number, z: number): number {
        const col = ((x + this.halfSize) / (this.halfSize * 2)) * (this.width - 1);
        const row = ((z + this.halfSize) / (this.halfSize * 2)) * (this.height - 1);

        return bilinearSample(this.heights, this.width, this.height, col, row);
    }

    getHeightArray(): Float32Array {
        return this.heights;
    }
}

// --- ImageHeightmap: PNG-based terrain ---

export class ImageHeightmap implements HeightmapSource {
    readonly width: number;
    readonly height: number;
    private heights: Float32Array;
    private halfSize: number;

    constructor(imageData: ImageData, halfSize: number, config: { baseHeight?: number; maxHeight?: number; minHeight?: number } = {}) {
        this.width = imageData.width;
        this.height = imageData.height;
        this.halfSize = halfSize;

        const baseHeight = config.baseHeight ?? 1.45;
        const maxHeight = config.maxHeight ?? 10;
        const minHeight = config.minHeight ?? 0.42;

        this.heights = new Float32Array(this.width * this.height);

        for (let i = 0; i < this.width * this.height; i++) {
            const gray = imageData.data[i * 4];
            const normalized = gray / 255;
            this.heights[i] = THREE.MathUtils.mapLinear(normalized, 0, 1, minHeight, maxHeight) + baseHeight;
        }
    }

    sample(x: number, z: number): number {
        const col = ((x + this.halfSize) / (this.halfSize * 2)) * (this.width - 1);
        const row = ((z + this.halfSize) / (this.halfSize * 2)) * (this.height - 1);

        return bilinearSample(this.heights, this.width, this.height, col, row);
    }

    getHeightArray(): Float32Array {
        return this.heights;
    }
}

// --- Bilinear interpolation ---

function bilinearSample(data: Float32Array, width: number, height: number, col: number, row: number): number {
    const col0 = Math.floor(col);
    const row0 = Math.floor(row);
    const col1 = Math.min(col0 + 1, width - 1);
    const row1 = Math.min(row0 + 1, height - 1);
    const c = Math.max(0, Math.min(col, width - 1));
    const r = Math.max(0, Math.min(row, height - 1));

    const fi = c - col0;
    const fj = r - row0;

    const v00 = data[row0 * width + col0];
    const v10 = data[row0 * width + col1];
    const v01 = data[row1 * width + col0];
    const v11 = data[row1 * width + col1];

    return v00 * (1 - fi) * (1 - fj) + v10 * fi * (1 - fj) + v01 * (1 - fi) * fj + v11 * fi * fj;
}

// --- Pad blending (spawns, objectives) ---

export type TerrainPadConfig = {
    x: number;
    z: number;
    radius: number;
    targetY?: number;
};

export const TERRAIN_SPAWN_PADS: TerrainPadConfig[] = [
    { x: -46, z: 92, radius: 16, targetY: 2.4 },
    { x: 46, z: -92, radius: 16, targetY: 2.4 },
    { x: -92, z: 30, radius: 16, targetY: 2.5 },
    { x: 92, z: -30, radius: 16, targetY: 2.5 },
    { x: -30, z: -92, radius: 16, targetY: 2.4 },
    { x: 30, z: 92, radius: 16, targetY: 2.4 },
    { x: -118, z: -82, radius: 18, targetY: 2.8 },
    { x: -118, z: -42, radius: 18, targetY: 2.8 },
    { x: -118, z: 0, radius: 18, targetY: 2.8 },
    { x: -118, z: 42, radius: 18, targetY: 2.8 },
    { x: -118, z: 82, radius: 18, targetY: 2.8 },
    { x: 118, z: -82, radius: 18, targetY: 2.8 },
    { x: 118, z: -42, radius: 18, targetY: 2.8 },
    { x: 118, z: 0, radius: 18, targetY: 2.8 },
    { x: 118, z: 42, radius: 18, targetY: 2.8 },
    { x: 118, z: 82, radius: 18, targetY: 2.8 }
];

export const TERRAIN_OBJECTIVE_PADS: TerrainPadConfig[] = [
    { x: -74, z: 34, radius: 18 },
    { x: 0, z: -18, radius: 18 },
    { x: 76, z: 38, radius: 18 }
];

export function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function isProtectedTerrainPadArea(x: number, z: number, extraRadius = 0): boolean {
    if (TERRAIN_OBJECTIVE_PADS.some((pad) => Math.hypot(x - pad.x, z - pad.z) < pad.radius + extraRadius)) {
        return true;
    }
    return TERRAIN_SPAWN_PADS.some((pad) => Math.hypot(x - pad.x, z - pad.z) < pad.radius + extraRadius);
}

export function blendPads(source: HeightmapSource, x: number, z: number, spawnPads: TerrainPadConfig[] = TERRAIN_SPAWN_PADS, objectivePads: TerrainPadConfig[] = TERRAIN_OBJECTIVE_PADS): number {
    let height = source.sample(x, z);

    for (const pad of spawnPads) {
        const distance = Math.hypot(x - pad.x, z - pad.z);
        const influence = 1 - smoothstep(pad.radius * 0.45, pad.radius, distance);
        if (influence > 0) {
            height = THREE.MathUtils.lerp(height, pad.targetY, influence);
        }
    }

    for (const pad of objectivePads) {
        const distance = Math.hypot(x - pad.x, z - pad.z);
        const influence = 1 - smoothstep(pad.radius * 0.42, pad.radius, distance);
        if (influence > 0) {
            const targetY = pad.targetY ?? source.sample(pad.x, pad.z);
            height = THREE.MathUtils.lerp(height, targetY, influence);
        }
    }

    return height;
}
