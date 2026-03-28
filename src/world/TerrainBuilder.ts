import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

type BoxMassConfig = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
    roughness?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
};

type CylinderMassConfig = {
    x: number;
    y: number;
    z: number;
    radius: number;
    height: number;
    color: number;
    roughness?: number;
    rotationY?: number;
};

type RockMoundConfig = {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    color: number;
    roughness?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
};

const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _normal = new THREE.Vector3();
const TERRAIN_SPAWN_PADS = [
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
] as const;

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}

function markShadows(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

function isProtectedSpawnArea(x: number, z: number, extraRadius = 0) {
    return TERRAIN_SPAWN_PADS.some((pad) => Math.hypot(x - pad.x, z - pad.z) < pad.radius + extraRadius);
}

export class TerrainBuilder {
    collisionMeshes: THREE.Mesh[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    halfSize: number;
    groundRows = 97;
    groundCols = 97;
    groundColliderMode: 'heightfield' | 'trimeshFallback' = 'heightfield';
    groundColliderError = '';

    constructor(scene: THREE.Scene, physics: RAPIER.World, halfSize: number) {
        this.scene = scene;
        this.physics = physics;
        this.halfSize = halfSize;

        this.buildGround();
        this.buildTerrainMasses();
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    createGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

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

    sampleHeight(x: number, z: number) {
        const nx = x / this.halfSize;
        const nz = z / this.halfSize;
        const radial = Math.sqrt(nx * nx + nz * nz);

        const centerBowl = -Math.max(0, 1 - radial / 0.58) * 1.3;
        const subtleWave = Math.sin(x * 0.038) * Math.cos(z * 0.034) * 0.75;
        const flankChannel = -Math.exp(-Math.pow((x + z * 0.22) / 34, 2)) * 0.9;
        const westChannel = -Math.exp(-Math.pow((x + 82) / 20, 2) - Math.pow((z - 6) / 72, 2)) * 1.35;
        const northRise = Math.exp(-Math.pow((z - 96) / 22, 2)) * Math.exp(-Math.pow(x / 74, 2)) * 2.2;
        const eastShelf = Math.max(0, 1 - Math.abs(x - this.halfSize * 0.58) / (this.halfSize * 0.24))
            * Math.max(0, 1 - Math.abs(z) / (this.halfSize * 0.86))
            * 3.2;
        const southRise = Math.exp(-Math.pow((z + 88) / 20, 2)) * Math.exp(-Math.pow((x - 14) / 68, 2)) * 1.8;
        const centerKnoll = Math.exp(-Math.pow((x - 16) / 16, 2) - Math.pow((z + 4) / 14, 2)) * 1.75;
        const eastKnoll = Math.exp(-Math.pow((x - 54) / 20, 2) - Math.pow((z + 42) / 16, 2)) * 1.8;
        const westKnoll = Math.exp(-Math.pow((x + 42) / 22, 2) - Math.pow((z - 26) / 20, 2)) * 1.65;
        const westBerm = Math.exp(-Math.pow((x + 38) / 11, 2) - Math.pow((z + 4) / 34, 2)) * 5.4;
        const eastBerm = Math.exp(-Math.pow((x - 40) / 11, 2) - Math.pow((z - 6) / 32, 2)) * 5.1;
        const northBerm = Math.exp(-Math.pow((x + 4) / 25, 2) - Math.pow((z - 40) / 10, 2)) * 3.9;
        const southBerm = Math.exp(-Math.pow((x - 2) / 23, 2) - Math.pow((z + 44) / 10, 2)) * 4.0;
        const centerSaddle = -Math.exp(-Math.pow(x / 18, 2) - Math.pow((z + 2) / 20, 2)) * 1.2;
        const westPass = -Math.exp(-Math.pow((x + 32) / 10, 2) - Math.pow((z + 42) / 14, 2)) * 1.35;
        const eastPass = -Math.exp(-Math.pow((x - 34) / 10, 2) - Math.pow((z - 42) / 14, 2)) * 1.25;
        const northPass = -Math.exp(-Math.pow((x - 26) / 14, 2) - Math.pow((z - 28) / 10, 2)) * 1.1;
        const southPass = -Math.exp(-Math.pow((x + 24) / 14, 2) - Math.pow((z + 28) / 10, 2)) * 1.1;
        const perimeterLift = smoothstep(0.72, 0.98, radial) * 8.4;

        let height = Math.max(
            0.35,
            1.1
            + centerBowl
            + subtleWave
            + flankChannel
            + westChannel
            + northRise
            + eastShelf
            + southRise
            + centerKnoll
            + eastKnoll
            + westKnoll
            + westBerm
            + eastBerm
            + northBerm
            + southBerm
            + centerSaddle
            + westPass
            + eastPass
            + northPass
            + southPass
            + perimeterLift
        );

        for (const pad of TERRAIN_SPAWN_PADS) {
            const distance = Math.hypot(x - pad.x, z - pad.z);
            const influence = 1 - smoothstep(pad.radius * 0.45, pad.radius, distance);
            if (influence > 0) {
                height = THREE.MathUtils.lerp(height, pad.targetY, influence);
            }
        }

        return height;
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

        const normals = geometry.attributes.normal as THREE.BufferAttribute;
        const colors: number[] = [];
        for (let row = 0; row < this.groundRows; row++) {
            const z = -this.halfSize + (row / (this.groundRows - 1)) * size;
            for (let col = 0; col < this.groundCols; col++) {
                const x = -this.halfSize + (col / (this.groundCols - 1)) * size;
                const vertexIndex = row * this.groundCols + col;
                const y = positions.getY(vertexIndex);
                _normal.set(normals.getX(vertexIndex), normals.getY(vertexIndex), normals.getZ(vertexIndex));

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
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
            map: this.createGroundTexture() ?? undefined,
            vertexColors: true,
            roughness: 0.99,
            metalness: 0.02
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.collisionMeshes.push(ground);

        this.createGroundCollider(geometry, heights, size);
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
        const rock = 0x56493f;
        const darkRock = 0x473c34;

        const ridgeMounds: RockMoundConfig[] = [
            { x: -108, y: 6.2, z: -74, sx: 11, sy: 7.2, sz: 12, color: darkRock, rotationY: 0.24 },
            { x: -110, y: 7.0, z: -30, sx: 13, sy: 8.6, sz: 14, color: darkRock, rotationY: 0.18 },
            { x: -108, y: 7.4, z: 12, sx: 12, sy: 8.8, sz: 16, color: darkRock, rotationY: -0.12 },
            { x: -104, y: 6.4, z: 58, sx: 11, sy: 7.4, sz: 13, color: darkRock, rotationY: -0.24 },
            { x: -84, y: 4.6, z: 70, sx: 15, sy: 6.1, sz: 11, color: rock, rotationY: -0.18 },

            { x: -76, y: 5.6, z: -108, sx: 16, sy: 7.4, sz: 10, color: darkRock, rotationY: 0.04 },
            { x: -26, y: 5.2, z: -108, sx: 18, sy: 6.6, sz: 9, color: darkRock, rotationY: -0.08 },
            { x: 24, y: 5.4, z: -106, sx: 18, sy: 6.4, sz: 10, color: darkRock, rotationY: 0.1 },
            { x: 74, y: 5.1, z: -104, sx: 15, sy: 6.2, sz: 9, color: darkRock, rotationY: -0.1 },

            { x: -58, y: 5.4, z: 108, sx: 18, sy: 6.3, sz: 10, color: darkRock, rotationY: 0.08 },
            { x: -4, y: 5.8, z: 106, sx: 18, sy: 6.5, sz: 11, color: darkRock, rotationY: -0.04 },
            { x: 48, y: 5.4, z: 110, sx: 17, sy: 6.2, sz: 10, color: darkRock, rotationY: 0.06 },
            { x: 94, y: 5.0, z: 106, sx: 14, sy: 5.8, sz: 9, color: darkRock, rotationY: -0.08 },

            { x: 106, y: 6.2, z: -62, sx: 12, sy: 6.8, sz: 11, color: rock, rotationY: -0.18 },
            { x: 102, y: 6.4, z: -10, sx: 12, sy: 7.4, sz: 14, color: rock, rotationY: 0.04 },
            { x: 104, y: 6.3, z: 42, sx: 11, sy: 6.8, sz: 13, color: rock, rotationY: -0.12 },
            { x: 98, y: 5.6, z: 86, sx: 11, sy: 6.1, sz: 10, color: rock, rotationY: 0.2 },

            { x: -44, y: 3.0, z: -26, sx: 11, sy: 4.8, sz: 9, color: rock, rotationY: -0.22 },
            { x: -34, y: 2.8, z: 26, sx: 10, sy: 4.4, sz: 8, color: rock, rotationY: 0.18 },
            { x: 26, y: 2.6, z: -38, sx: 9, sy: 4.0, sz: 8, color: 0x64584c, rotationY: -0.16 },
            { x: 34, y: 2.8, z: 34, sx: 10, sy: 4.1, sz: 8, color: 0x64584c, rotationY: 0.14 },
            { x: -8, y: 3.2, z: 88, sx: 15, sy: 4.2, sz: 7, color: 0x5c4f43, rotationY: 0.04 },
            { x: 10, y: 3.2, z: -86, sx: 13, sy: 4.2, sz: 7, color: 0x5c4f43, rotationY: -0.08 }
        ];

        ridgeMounds
            .filter((config) => !isProtectedSpawnArea(config.x, config.z, Math.max(config.sx, config.sz) * 0.8))
            .forEach((config) => this.addRockMound(config));

        [
            { x: -16, y: 2.8, z: 82, radius: 8, height: 5.6, color: 0x5e5146 },
            { x: 52, y: 2.3, z: -78, radius: 6, height: 4.6, color: 0x5b4d42 },
            { x: -78, y: 2.6, z: 92, radius: 7.4, height: 5.2, color: 0x5d5147 },
            { x: 98, y: 2.8, z: 74, radius: 7.6, height: 5.4, color: 0x61544a }
        ]
            .filter((config) => !isProtectedSpawnArea(config.x, config.z, config.radius * 1.25))
            .forEach((config) => this.addCylinderMass(config));
    }

    addBoxMass(config: BoxMassConfig) {
        const geometry = new THREE.BoxGeometry(config.w, config.h, config.d);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness ?? 0.95
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(config.x, this.sampleHeight(config.x, config.z) + config.y, config.z);
        mesh.rotation.set(config.rotationX ?? 0, config.rotationY ?? 0, config.rotationZ ?? 0);
        markShadows(mesh);
        this.scene.add(mesh);
        this.collisionMeshes.push(mesh);

        _euler.set(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        _quat.setFromEuler(_euler);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
            .setRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w });
        const body = this.physics.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cuboid(config.w / 2, config.h / 2, config.d / 2);
        this.physics.createCollider(collider, body);
    }

    addCylinderMass(config: CylinderMassConfig) {
        const geometry = new THREE.CylinderGeometry(config.radius, config.radius * 1.1, config.height, 10);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness ?? 0.96
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(config.x, this.sampleHeight(config.x, config.z) + config.y, config.z);
        mesh.rotation.y = config.rotationY ?? 0;
        markShadows(mesh);
        this.scene.add(mesh);
        this.collisionMeshes.push(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
        const body = this.physics.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(config.height / 2, config.radius);
        this.physics.createCollider(collider, body);
    }

    addRockMound(config: RockMoundConfig) {
        const geometry = new THREE.DodecahedronGeometry(1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness ?? 0.98
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(config.sx, config.sy, config.sz);
        mesh.position.set(config.x, this.sampleHeight(config.x, config.z) + config.y, config.z);
        mesh.rotation.set(config.rotationX ?? 0, config.rotationY ?? 0, config.rotationZ ?? 0);
        markShadows(mesh);
        this.scene.add(mesh);
        this.collisionMeshes.push(mesh);

        _euler.set(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        _quat.setFromEuler(_euler);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
            .setRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w });
        const body = this.physics.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cuboid(config.sx * 0.82, config.sy * 0.8, config.sz * 0.82);
        this.physics.createCollider(collider, body);
    }
}
