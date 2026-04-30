import * as THREE from 'three';
import { isProtectedTerrainPadArea } from './HeightmapSource';

const GRASS_VERTEX_SHADER = `
    uniform float iTime;
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
        vUv = uv;
        vColor = color;

        vec3 pos = position;
        float heightRatio = color.x;

        float windSpeed = 1.8;
        float windStrength = 0.12;
        float freq = 2.0;

        float windX = sin(iTime * windSpeed + pos.x * freq * 0.3 + pos.z * freq * 0.2) * windStrength;
        float windZ = cos(iTime * windSpeed * 0.7 + pos.x * freq * 0.2 + pos.z * freq * 0.3) * windStrength * 0.4;

        pos.x += windX * heightRatio;
        pos.z += windZ * heightRatio;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const GRASS_FRAGMENT_SHADER = `
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
        vec3 darkGreen = vec3(0.08, 0.16, 0.06);
        vec3 midGreen = vec3(0.14, 0.24, 0.10);
        vec3 tipGreen = vec3(0.22, 0.32, 0.16);

        float h = vColor.x;
        vec3 color = mix(darkGreen, midGreen, smoothstep(0.0, 0.5, h));
        color = mix(color, tipGreen, smoothstep(0.5, 1.0, h));

        color *= vColor.y;

        gl_FragColor = vec4(color, 1.0);
    }
`;

type GrassConfig = {
    bladeCount: number;
    bladeWidth: number;
    bladeHeight: number;
    heightVariation: number;
};

const DEFAULT_CONFIG: GrassConfig = {
    bladeCount: 18000,
    bladeWidth: 0.1,
    bladeHeight: 0.5,
    heightVariation: 0.4,
};

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export class GrassShaderSystem {
    private scene: THREE.Scene;
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private animId = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    init(sampleHeight: (x: number, z: number) => number, halfSize: number, seed = 42) {
        const geometry = this.generateBlades(DEFAULT_CONFIG, sampleHeight, halfSize, seed);

        this.material = new THREE.ShaderMaterial({
            uniforms: { iTime: { value: 0 } },
            vertexShader: GRASS_VERTEX_SHADER,
            fragmentShader: GRASS_FRAGMENT_SHADER,
            vertexColors: true,
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.renderOrder = 10;
        this.scene.add(this.mesh);
        this._startAnimation();
    }

    dispose() {
        cancelAnimationFrame(this.animId);
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material?.dispose();
            this.mesh = null;
            this.material = null;
        }
    }

    private _startAnimation() {
        const tick = () => {
            if (this.material) {
                this.material.uniforms.iTime.value = performance.now() / 1000;
            }
            this.animId = requestAnimationFrame(tick);
        };
        this.animId = requestAnimationFrame(tick);
    }

    private generateBlades(
        config: GrassConfig,
        sampleHeight: (x: number, z: number) => number,
        halfSize: number,
        seed: number
    ): THREE.BufferGeometry {
        const rand = seededRandom(seed);
        const arenaSize = halfSize * 2;
        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        let vertexOffset = 0;

        for (let i = 0; i < config.bladeCount; i++) {
            const x = (rand() - 0.5) * arenaSize * 0.94;
            const z = (rand() - 0.5) * arenaSize * 0.94;

            if (isProtectedTerrainPadArea(x, z, 3)) continue;

            const y = sampleHeight(x, z);
            const height = config.bladeHeight + rand() * config.heightVariation;
            const width = config.bladeWidth * (0.6 + rand() * 0.8);
            const yaw = rand() * Math.PI * 2;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);

            const tipOffX = (rand() - 0.5) * 0.12;
            const tipOffZ = (rand() - 0.5) * 0.12;

            const verts = [
                { lx: -width / 2, ly: 0, lz: 0, h: 0.0, b: 0.75 + rand() * 0.25 },
                { lx: width / 2, ly: 0, lz: 0, h: 0.0, b: 0.75 + rand() * 0.25 },
                { lx: -width * 0.3, ly: height * 0.5, lz: 0, h: 0.5, b: 0.8 + rand() * 0.2 },
                { lx: width * 0.3, ly: height * 0.5, lz: 0, h: 0.5, b: 0.8 + rand() * 0.2 },
                { lx: tipOffX, ly: height, lz: tipOffZ, h: 1.0, b: 0.85 + rand() * 0.15 },
            ];

            for (const v of verts) {
                const wx = v.lx * cos - v.lz * sin;
                const wz = v.lx * sin + v.lz * cos;
                positions.push(x + wx, y + v.ly, z + wz);
                colors.push(v.h, v.b, 0.5);
            }

            indices.push(
                vertexOffset, vertexOffset + 1, vertexOffset + 2,
                vertexOffset + 2, vertexOffset + 4, vertexOffset + 3,
                vertexOffset + 3, vertexOffset, vertexOffset + 2
            );

            vertexOffset += 5;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }
}
