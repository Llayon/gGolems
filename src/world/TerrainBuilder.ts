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

const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function markShadows(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
}

export class TerrainBuilder {
    collisionMeshes: THREE.Mesh[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    halfSize: number;

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

    sampleHeight(x: number, z: number) {
        const nx = x / this.halfSize;
        const nz = z / this.halfSize;
        const radial = Math.sqrt(nx * nx + nz * nz);

        const centerBowl = Math.max(0, 1 - radial / 0.58) * 0.12;
        const subtleWave = Math.sin(x * 0.028) * Math.cos(z * 0.024) * 0.1;
        const flankChannel = Math.exp(-Math.pow((x + z * 0.24) / 42, 2)) * 0.08;
        const eastShelf = Math.max(0, 1 - Math.abs(x - this.halfSize * 0.58) / (this.halfSize * 0.24))
            * Math.max(0, 1 - Math.abs(z) / (this.halfSize * 0.86))
            * 0.3;
        const perimeterLift = smoothstep(0.74, 0.98, radial) * 2.9;

        return Math.max(0, 0.06 + centerBowl + subtleWave + flankChannel + eastShelf + perimeterLift);
    }

    buildGround() {
        const size = this.halfSize * 2;
        const geometry = new THREE.PlaneGeometry(size, size, 96, 96);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position as THREE.BufferAttribute;
        const colors: number[] = [];

        for (let index = 0; index < positions.count; index++) {
            const x = positions.getX(index);
            const z = positions.getZ(index);
            const y = this.sampleHeight(x, z);
            positions.setY(index, y);

            const ridgeFactor = clamp(y / 3.2, 0, 1);
            _color.setRGB(
                THREE.MathUtils.lerp(0.17, 0.34, ridgeFactor),
                THREE.MathUtils.lerp(0.14, 0.28, ridgeFactor),
                THREE.MathUtils.lerp(0.15, 0.22, ridgeFactor)
            );
            colors.push(_color.r, _color.g, _color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.98,
            metalness: 0.02
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.collisionMeshes.push(ground);

        const groundBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        const groundCollider = RAPIER.ColliderDesc.cuboid(this.halfSize, 0.1, this.halfSize);
        this.physics.createCollider(groundCollider, groundBody);
    }

    buildTerrainMasses() {
        const rock = 0x56493f;
        const darkRock = 0x473c34;

        this.addBoxMass({ x: -102, y: 4.8, z: -12, w: 22, h: 9.6, d: 92, color: darkRock, rotationY: 0.08 });
        this.addBoxMass({ x: 0, y: 3.2, z: -102, w: 88, h: 6.4, d: 20, color: darkRock, rotationY: -0.04 });
        this.addBoxMass({ x: 14, y: 3.3, z: 104, w: 98, h: 6.6, d: 22, color: darkRock, rotationY: 0.05 });
        this.addBoxMass({ x: -80, y: 2.5, z: 68, w: 34, h: 5, d: 28, color: rock, rotationY: -0.18 });

        this.addBoxMass({ x: 96, y: 3.2, z: 0, w: 22, h: 6.4, d: 86, color: rock });
        this.addBoxMass({ x: 108, y: 1.9, z: -58, w: 20, h: 2.4, d: 36, color: 0x62564c, rotationX: -0.17 });
        this.addBoxMass({ x: 108, y: 1.9, z: 58, w: 20, h: 2.4, d: 36, color: 0x62564c, rotationX: 0.17 });
        this.addBoxMass({ x: 84, y: 2.1, z: -18, w: 14, h: 4.2, d: 24, color: 0x605348, rotationY: 0.12 });
        this.addBoxMass({ x: 82, y: 2.2, z: 28, w: 16, h: 4.4, d: 26, color: 0x605348, rotationY: -0.12 });

        this.addBoxMass({ x: -42, y: 1.8, z: -24, w: 18, h: 3.6, d: 24, color: rock, rotationY: -0.22 });
        this.addBoxMass({ x: -36, y: 1.7, z: 24, w: 20, h: 3.4, d: 22, color: rock, rotationY: 0.18 });
        this.addBoxMass({ x: 26, y: 1.4, z: -38, w: 16, h: 2.8, d: 18, color: 0x64584c, rotationY: -0.16 });
        this.addBoxMass({ x: 32, y: 1.5, z: 36, w: 18, h: 3.0, d: 18, color: 0x64584c, rotationY: 0.14 });

        this.addCylinderMass({ x: -16, y: 2.8, z: 82, radius: 8, height: 5.6, color: 0x5e5146 });
        this.addCylinderMass({ x: 52, y: 2.3, z: -78, radius: 6, height: 4.6, color: 0x5b4d42 });
    }

    addBoxMass(config: BoxMassConfig) {
        const geometry = new THREE.BoxGeometry(config.w, config.h, config.d);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness ?? 0.95
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(config.x, config.y, config.z);
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
        mesh.position.set(config.x, config.y, config.z);
        mesh.rotation.y = config.rotationY ?? 0;
        markShadows(mesh);
        this.scene.add(mesh);
        this.collisionMeshes.push(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
        const body = this.physics.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(config.height / 2, config.radius);
        this.physics.createCollider(collider, body);
    }
}
