import * as THREE from 'three';

// Процедурная текстура следа — создаётся один раз
function createFootprintTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Прозрачный фон
    ctx.clearRect(0, 0, 64, 64);
    
    // След — тёмный эллипс с мягкими краями
    const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 28);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(32, 32, 28, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Трещины (3 линии)
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
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

interface Decal {
    mesh: THREE.Mesh;
    life: number;      // оставшееся время жизни
    maxLife: number;
    fadeStart: number;  // когда начинать затухание
}

export class DecalManager {
    private scene: THREE.Scene;
    private decals: Decal[] = [];
    private pool: THREE.Mesh[] = [];
    
    private readonly maxDecals = 60;
    private readonly decalLife = 8;       // секунд
    private readonly fadeTime = 3;        // последние 3 сек — затухание
    
    // Один geometry, один material для ВСЕХ следов
    private geo: THREE.PlaneGeometry;
    private mat: THREE.MeshBasicMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geo = new THREE.PlaneGeometry(1, 1);
        this.mat = new THREE.MeshBasicMaterial({
            map: createFootprintTexture(),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            polygonOffset: true,      // предотвращает z-fighting с полом
            polygonOffsetFactor: -1,
        });
        
        // Предсоздаём пул мешей
        for (let i = 0; i < this.maxDecals; i++) {
            const mesh = new THREE.Mesh(this.geo, this.mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            scene.add(mesh);
            this.pool.push(mesh);
        }
    }

    addFootprint(pos: THREE.Vector3, yaw: number, mass: number) {
        // Берём меш из пула или переиспользуем самый старый
        let mesh: THREE.Mesh;
        
        if (this.pool.length > 0) {
            mesh = this.pool.pop()!;
        } else {
            // Переиспользуем самый старый активный
            const oldest = this.decals.shift()!;
            mesh = oldest.mesh;
        }
        
        mesh.visible = true;
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.rotation.z = -yaw + (Math.random() - 0.5) * 0.3; // лёгкая случайность
        
        // Масштаб зависит от массы голема
        const scale = 1.0 + mass * 0.3; // mass 1.0→1.3, 2.0→1.6, 3.5→2.05
        mesh.scale.set(
            scale * (0.9 + Math.random() * 0.2),  // небольшая вариация
            scale * (0.9 + Math.random() * 0.2),
            1
        );
        
        this.decals.push({
            mesh,
            life: this.decalLife,
            maxLife: this.decalLife,
            fadeStart: this.fadeTime,
        });
    }

    addBulletMark(pos: THREE.Vector3) {
        // Маленький тёмный след от снаряда
        let mesh: THREE.Mesh;
        if (this.pool.length > 0) {
            mesh = this.pool.pop()!;
        } else {
            const oldest = this.decals.shift()!;
            mesh = oldest.mesh;
        }
        
        mesh.visible = true;
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.scale.set(0.4, 0.4, 1);
        
        this.decals.push({
            mesh,
            life: 5,
            maxLife: 5,
            fadeStart: 2,
        });
    }

    update(dt: number) {
        for (let i = this.decals.length - 1; i >= 0; i--) {
            const decal = this.decals[i];
            decal.life -= dt;
            
            if (decal.life <= 0) {
                // Возвращаем в пул
                decal.mesh.visible = false;
                this.pool.push(decal.mesh);
                this.decals.splice(i, 1);
                continue;
            }
            
            // Затухание в последние N секунд
            if (decal.life < decal.fadeStart) {
                // Управляем через scale.y чтобы не клонировать material
                // Или используем mesh.material.opacity... но material общий!
                // Решение: уменьшаем scale как "схлопывание"
                const fade = decal.life / decal.fadeStart;
                const currentScale = decal.mesh.scale.x; // сохраняем X
                decal.mesh.scale.y = currentScale * fade;
            }
        }
    }
    
    dispose() {
        this.geo.dispose();
        this.mat.dispose();
        // Меши уже в сцене, их удалит Game при destroy
    }
}
