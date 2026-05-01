import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    HeightmapSource,
    ProceduralHeightmap,
    blendPads,
    clamp,
    smoothstep,
    TERRAIN_SPAWN_PADS,
    TERRAIN_OBJECTIVE_PADS,
    type TerrainPadConfig,
} from './HeightmapSource';
import { type LodLevel, TerrainLodController } from './TerrainLodController';
import { buildTerrainMasses } from './TerrainMasses';

const _color = new THREE.Color();
const _normal = new THREE.Vector3();

function hash2(x: number, y: number) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}

export class TerrainBuilder {
    collisionMeshes: THREE.Mesh[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    halfSize: number;
    heightmap: HeightmapSource;
    groundRows: number;
    groundCols: number;
    groundColliderMode: 'heightfield' | 'trimeshFallback' = 'heightfield';
    groundColliderError = '';
    spawnPads: TerrainPadConfig[];
    objectivePads: TerrainPadConfig[];
    lodController: TerrainLodController | null = null;
    private _groundMaterials: THREE.MeshStandardMaterial | null = null;
    private _groundColors: number[] = [];

    private loadTex(path: string, linear = false): THREE.Texture {
        const tex = new THREE.TextureLoader().load(path, () => {
            console.log(`[Terrain] Loaded texture: ${path}`);
        }, undefined, (err) => {
            console.error(`[Terrain] Failed to load texture: ${path}`, err);
        });
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(14, 14);
        tex.colorSpace = linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
        return tex;
    }

    constructor(
        scene: THREE.Scene,
        physics: RAPIER.World,
        halfSize: number,
        heightmap?: HeightmapSource,
        resolution = 97,
        spawnPads: TerrainPadConfig[] = TERRAIN_SPAWN_PADS,
        objectivePads: TerrainPadConfig[] = TERRAIN_OBJECTIVE_PADS
    ) {
        this.scene = scene;
        this.physics = physics;
        this.halfSize = halfSize;
        this.heightmap = heightmap ?? new ProceduralHeightmap({
            size: resolution,
            baseHeight: 1.45,
            minHeight: 0.42,
            octaves: [
                { frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 },
                { frequency: 0.016, amplitude: 0.5, lacunarity: 2.0, gain: 0.5 },
                { frequency: 0.032, amplitude: 0.25, lacunarity: 2.0, gain: 0.5 },
                { frequency: 0.064, amplitude: 0.125, lacunarity: 2.0, gain: 0.5 },
            ],
            seed: 42
        });
        this.groundRows = resolution;
        this.groundCols = resolution;
        this.spawnPads = spawnPads;
        this.objectivePads = objectivePads;

        this.buildGround();
        this.buildTerrainMasses();
    }

    setupLod(camera: THREE.Camera) {
        this.lodController = new TerrainLodController(camera);
        const size = this.halfSize * 2;
        const lodResolutions = {
            high: this.groundCols,
            mid: Math.floor(this.groundCols / 2),
            low: Math.floor(this.groundCols / 4)
        };

        for (const [level, res] of Object.entries(lodResolutions)) {
            const mesh = this.createLodMesh(level as LodLevel, res, size);
            this.lodController.registerMesh(level as LodLevel, mesh);
        }

        this.collisionMeshes.push(this.lodController.meshes.high!);
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    update() {
        if (this.lodController) {
            this.lodController.update();
        }
    }

    sampleHeight(x: number, z: number) {
        return blendPads(this.heightmap, x, z, this.spawnPads, this.objectivePads);
    }

    createGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const image = ctx.createImageData(canvas.width, canvas.height);
        const data = image.data;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                const nx = x / canvas.width;
                const ny = y / canvas.height;
                const grain = hash2(x * 0.9, y * 1.1);
                const speckle = hash2(x * 2.6 + 18, y * 2.2 + 7);
                const streak = Math.sin((nx * 8.5 + ny * 4.2) * Math.PI) * 0.5 + 0.5;
                const dryDust = smoothstep(0.38, 0.92, ny) * 0.22;
                const tone = 0.38 + grain * 0.18 + streak * 0.08 - dryDust;

                data[i] = Math.round(112 + tone * 72 + speckle * 18);
                data[i + 1] = Math.round(88 + tone * 48 + speckle * 10);
                data[i + 2] = Math.round(68 + tone * 32 + speckle * 8);
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(14, 14);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    buildGround() {
        const size = this.halfSize * 2;
        const geometry = new THREE.PlaneGeometry(size, size, this.groundCols - 1, this.groundRows - 1);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position as THREE.BufferAttribute;
        const heights = new Float32Array(this.groundRows * this.groundCols);

        for (let row = 0; row < this.groundRows; row++) {
            const z = -this.halfSize + (row / (this.groundRows - 1)) * size;
            for (let col = 0; col < this.groundCols; col++) {
                const x = -this.halfSize + (col / (this.groundCols - 1)) * size;
                const y = this.sampleHeight(x, z);
                const vertexIndex = row * this.groundCols + col;
                positions.setY(vertexIndex, y);
                heights[col * this.groundRows + row] = y;
            }
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        this._groundColors = this.computeVertexColors(geometry, size);
        this._groundMaterials = new THREE.MeshStandardMaterial({
            color: 0x6b5a42,
            map: this.loadTex('assets/nature/ground_diffuse.png'),
            normalMap: this.loadTex('assets/nature/ground_normal.png', true),
            normalScale: new THREE.Vector2(0.6, 0.6),
            roughnessMap: this.loadTex('assets/nature/ground_rough.png', true),
            roughness: 0.85,
            metalness: 0.05
        });

        this.createGroundCollider(geometry, heights, size);
    }

    computeVertexColors(geometry: THREE.BufferGeometry, size: number): number[] {
        const normals = geometry.attributes.normal as THREE.BufferAttribute;
        const positions = geometry.attributes.position as THREE.BufferAttribute;
        const count = positions.count;
        const colors: number[] = [];

        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const y = positions.getY(i);
            _normal.set(normals.getX(i), normals.getY(i), normals.getZ(i));

            const ridgeFactor = clamp((y - 0.6) / 8.8, 0, 1);
            const basinFactor = clamp((2.4 - y) / 2.4, 0, 1);
            const slopeFactor = clamp(1 - _normal.y, 0, 1);
            const westDust = smoothstep(0.18, 0.82, (x + this.halfSize) / (this.halfSize * 2));
            const channelAsh = Math.exp(-Math.pow((x + z * 0.18) / 34, 2)) * 0.28;
            const scorchBand = Math.exp(-Math.pow((x - 4) / 28, 2) - Math.pow((z + 4) / 56, 2)) * 0.18;

            const baseR = THREE.MathUtils.lerp(0.19, 0.46, ridgeFactor);
            const baseG = THREE.MathUtils.lerp(0.14, 0.32, ridgeFactor);
            const baseB = THREE.MathUtils.lerp(0.12, 0.21, ridgeFactor);

            const dryLift = westDust * 0.07 + (1 - basinFactor) * 0.03;
            const dampCool = basinFactor * 0.06 + channelAsh * 0.08;
            const rockTint = slopeFactor * 0.18;

            _color.setRGB(
                clamp(baseR + dryLift - dampCool + rockTint * 0.35 - scorchBand * 0.1, 0, 1),
                clamp(baseG + dryLift * 0.6 - dampCool * 0.8 - rockTint * 0.15 - scorchBand * 0.08, 0, 1),
                clamp(baseB - dampCool * 0.3 - rockTint * 0.05 - scorchBand * 0.02, 0, 1)
            );
            colors.push(_color.r, _color.g, _color.b);
        }
        return colors;
    }

    createLodMesh(level: LodLevel, resolution: number, size: number): THREE.Mesh {
        const segments = resolution - 1;
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position as THREE.BufferAttribute;
        for (let row = 0; row < resolution; row++) {
            const z = -this.halfSize + (row / (resolution - 1)) * size;
            for (let col = 0; col < resolution; col++) {
                const x = -this.halfSize + (col / (resolution - 1)) * size;
                const vertexIndex = row * resolution + col;
                positions.setY(vertexIndex, this.sampleHeight(x, z));
            }
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this._groundMaterials!.clone());
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        return mesh;
    }

    createGroundCollider(geometry: THREE.BufferGeometry, heights: Float32Array, size: number) {
        try {
            const groundCollider = RAPIER.ColliderDesc.heightfield(
                this.groundRows - 1,
                this.groundCols - 1,
                heights,
                { x: size, y: 1, z: size }
            );
            const groundBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
            this.physics.createCollider(groundCollider, groundBody);
            this.groundColliderMode = 'heightfield';
            this.groundColliderError = '';
        } catch (error) {
            this.groundColliderMode = 'trimeshFallback';
            this.groundColliderError = error instanceof Error ? error.message : String(error);
            console.warn('Heightfield collider failed, falling back to trimesh ground.', error);

            const positionAttr = geometry.attributes.position;
            const vertices = positionAttr.array instanceof Float32Array
                ? positionAttr.array
                : new Float32Array(positionAttr.array);
            const indices = geometry.index
                ? geometry.index.array instanceof Uint32Array
                    ? geometry.index.array
                    : new Uint32Array(geometry.index.array)
                : new Uint32Array(Array.from({ length: vertices.length / 3 }, (_, index) => index));

            const groundCollider = RAPIER.ColliderDesc.trimesh(
                vertices,
                indices,
                RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
            );
            const groundBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
            this.physics.createCollider(groundCollider, groundBody);
        }
    }

    buildTerrainMasses() {
        buildTerrainMasses(this.scene, this.physics, this.sampleHeight.bind(this), this.collisionMeshes);
    }
}
