import * as THREE from 'three';
import { QualityProfile } from '../utils/quality';

type Particle = {
    active: boolean;
    life: number;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
};

export class ParticleManager {
    system: THREE.Points;
    particles: Particle[] = [];
    burstScale: number;
    nextParticleIndex = 0;
    
    constructor(scene: THREE.Scene, quality: QualityProfile) {
        const geo = new THREE.BufferGeometry();
        const count = quality.particlePool;
        const positions = new Float32Array(count * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const mat = new THREE.PointsMaterial({ 
            color: 0xdddddd, 
            size: 0.6, 
            transparent: true, 
            opacity: 0.4,
            depthWrite: false
        });
        
        this.system = new THREE.Points(geo, mat);
        scene.add(this.system);
        this.burstScale = quality.particleBurstScale;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                active: false,
                life: 0,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3()
            });
        }
    }

    emit(x: number, y: number, z: number) {
        this.spawnParticle(x, y, z, (Math.random() - 0.5) * 1.0, Math.random() * 2 + 2, (Math.random() - 0.5) * 1.0, 1.0);
    }

    emitBurst(
        x: number,
        y: number,
        z: number,
        count = 12,
        spread = 1.4,
        upwardBoost = 2.4,
        lifetime = 1.0
    ) {
        const scaledCount = Math.max(1, Math.round(count * this.burstScale));
        for (let i = 0; i < scaledCount; i++) {
            this.spawnParticle(
                x + (Math.random() - 0.5) * spread,
                y + Math.random() * spread * 0.4,
                z + (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread * 1.4,
                Math.random() * upwardBoost + upwardBoost * 0.4,
                (Math.random() - 0.5) * spread * 1.4,
                lifetime * (0.7 + Math.random() * 0.6)
            );
        }
    }

    spawnParticle(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
        let p: Particle | null = null;
        for (let i = 0; i < this.particles.length; i++) {
            const index = (this.nextParticleIndex + i) % this.particles.length;
            if (!this.particles[index].active) {
                p = this.particles[index];
                this.nextParticleIndex = (index + 1) % this.particles.length;
                break;
            }
        }
        if (!p) return;
        p.active = true;
        p.life = life;
        p.pos.set(x, y, z);
        p.vel.set(vx, vy, vz);
    }

    update(dt: number) {
        const positions = this.system.geometry.attributes.position.array as Float32Array;
        let idx = 0;
        for (const p of this.particles) {
            if (p.active) {
                p.life -= dt * 0.8;
                if (p.life <= 0) {
                    p.active = false;
                    positions[idx] = 0;
                    positions[idx+1] = -1000;
                    positions[idx+2] = 0;
                } else {
                    p.vel.y -= dt * 4.2;
                    p.vel.multiplyScalar(0.992);
                    p.pos.addScaledVector(p.vel, dt);
                    positions[idx] = p.pos.x;
                    positions[idx+1] = p.pos.y;
                    positions[idx+2] = p.pos.z;
                }
            }
            idx += 3;
        }
        this.system.geometry.attributes.position.needsUpdate = true;
    }
}
