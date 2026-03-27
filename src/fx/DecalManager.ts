import * as THREE from 'three';

function createFootprintTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 64, 64);

    const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 28);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(32, 32, 28, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 / 3) * i + Math.random() * 0.5;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.lineTo(
            32 + Math.cos(angle) * (15 + Math.random() * 10),
            32 + Math.sin(angle) * (12 + Math.random() * 8)
        );
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createRuinTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 96, 96);

    const stain = ctx.createRadialGradient(48, 48, 8, 48, 48, 40);
    stain.addColorStop(0, 'rgba(35, 28, 22, 0.55)');
    stain.addColorStop(0.65, 'rgba(22, 18, 14, 0.28)');
    stain.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(48, 48, 40, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 74, 58, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const start = Math.random() * Math.PI * 2;
        const length = 12 + Math.random() * 20;
        ctx.beginPath();
        ctx.moveTo(48 + Math.cos(start) * 6, 48 + Math.sin(start) * 6);
        ctx.lineTo(48 + Math.cos(start) * length, 48 + Math.sin(start) * (10 + Math.random() * 16));
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

interface DecalEntry {
    mesh: THREE.Mesh;
    life: number;
    fadeStart: number;
    baseScaleX: number;
    baseScaleY: number;
}

export class DecalManager {
    private scene: THREE.Scene;
    private footprintDecals: DecalEntry[] = [];
    private footprintPool: THREE.Mesh[] = [];
    private ruinDecals: DecalEntry[] = [];
    private ruinPool: THREE.Mesh[] = [];

    private readonly footprintLife = 8;
    private readonly ruinLife = 26;

    private footprintGeo: THREE.PlaneGeometry;
    private footprintMat: THREE.MeshBasicMaterial;
    private ruinGeo: THREE.PlaneGeometry;
    private ruinMat: THREE.MeshBasicMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        this.footprintGeo = new THREE.PlaneGeometry(1, 1);
        this.footprintMat = new THREE.MeshBasicMaterial({
            map: createFootprintTexture(),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1
        });

        this.ruinGeo = new THREE.PlaneGeometry(1, 1);
        this.ruinMat = new THREE.MeshBasicMaterial({
            map: createRuinTexture(),
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1
        });

        this.prewarmPool(this.footprintPool, this.footprintGeo, this.footprintMat, 56);
        this.prewarmPool(this.ruinPool, this.ruinGeo, this.ruinMat, 18);
    }

    prewarmPool(pool: THREE.Mesh[], geometry: THREE.PlaneGeometry, material: THREE.MeshBasicMaterial, count: number) {
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            this.scene.add(mesh);
            pool.push(mesh);
        }
    }

    addFootprint(pos: THREE.Vector3, yaw: number, mass: number) {
        const scale = 1.0 + mass * 0.3;
        const scaleX = scale * (0.9 + Math.random() * 0.2);
        const scaleY = scale * (0.9 + Math.random() * 0.2);
        const mesh = this.claimMesh(this.footprintPool, this.footprintDecals);
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.rotation.z = -yaw + (Math.random() - 0.5) * 0.3;
        mesh.scale.set(scaleX, scaleY, 1);
        this.footprintDecals.push({
            mesh,
            life: this.footprintLife,
            fadeStart: 3,
            baseScaleX: scaleX,
            baseScaleY: scaleY
        });
    }

    addBulletMark(pos: THREE.Vector3) {
        const mesh = this.claimMesh(this.footprintPool, this.footprintDecals);
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.scale.set(0.4, 0.4, 1);
        this.footprintDecals.push({
            mesh,
            life: 5,
            fadeStart: 2,
            baseScaleX: 0.4,
            baseScaleY: 0.4
        });
    }

    addRuinMark(pos: THREE.Vector3, radius: number, life = this.ruinLife) {
        const mesh = this.claimMesh(this.ruinPool, this.ruinDecals);
        const scaleX = radius * (0.9 + Math.random() * 0.18);
        const scaleY = radius * (0.68 + Math.random() * 0.16);
        mesh.position.set(pos.x, 0.03, pos.z);
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.scale.set(scaleX, scaleY, 1);
        this.ruinDecals.push({
            mesh,
            life,
            fadeStart: Math.min(10, life * 0.4),
            baseScaleX: scaleX,
            baseScaleY: scaleY
        });
    }

    claimMesh(pool: THREE.Mesh[], active: DecalEntry[]) {
        let mesh = pool.pop();
        if (!mesh) {
            const oldest = active.shift()!;
            mesh = oldest.mesh;
        }
        mesh.visible = true;
        return mesh;
    }

    update(dt: number) {
        this.updateEntries(this.footprintDecals, this.footprintPool, dt);
        this.updateEntries(this.ruinDecals, this.ruinPool, dt);
    }

    updateEntries(entries: DecalEntry[], pool: THREE.Mesh[], dt: number) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const decal = entries[i];
            decal.life -= dt;

            if (decal.life <= 0) {
                decal.mesh.visible = false;
                pool.push(decal.mesh);
                entries.splice(i, 1);
                continue;
            }

            if (decal.life < decal.fadeStart) {
                const fade = decal.life / decal.fadeStart;
                decal.mesh.scale.x = decal.baseScaleX * fade;
                decal.mesh.scale.y = decal.baseScaleY * fade;
            } else {
                decal.mesh.scale.x = decal.baseScaleX;
                decal.mesh.scale.y = decal.baseScaleY;
            }
        }
    }

    dispose() {
        this.footprintGeo.dispose();
        this.footprintMat.dispose();
        this.ruinGeo.dispose();
        this.ruinMat.dispose();
    }
}
