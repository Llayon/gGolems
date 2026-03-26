import * as THREE from 'three';

export class ParticleManager {
    system: THREE.Points;
    particles: any[] = [];
    
    constructor(scene: THREE.Scene) {
        const geo = new THREE.BufferGeometry();
        const count = 200;
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
        const p = this.particles.find(p => !p.active);
        if (p) {
            p.active = true;
            p.life = 1.0;
            p.pos.set(x, y, z);
            p.vel.set((Math.random() - 0.5) * 1.0, Math.random() * 2 + 2, (Math.random() - 0.5) * 1.0);
        }
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
