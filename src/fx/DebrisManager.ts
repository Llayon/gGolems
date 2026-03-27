import * as THREE from 'three';

type DebrisProfile = 'tree' | 'houseDamage' | 'houseCollapse';

type DebrisPiece = {
    mesh: THREE.Mesh;
    active: boolean;
    life: number;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
};

export class DebrisManager {
    pieces: DebrisPiece[] = [];
    group: THREE.Group;
    woodMat: THREE.MeshStandardMaterial;
    barkMat: THREE.MeshStandardMaterial;
    masonryMat: THREE.MeshStandardMaterial;
    roofMat: THREE.MeshStandardMaterial;
    beamMat: THREE.MeshStandardMaterial;
    geos: THREE.BufferGeometry[];

    constructor(scene: THREE.Scene) {
        this.group = new THREE.Group();
        scene.add(this.group);

        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.95 });
        this.barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 1 });
        this.masonryMat = new THREE.MeshStandardMaterial({ color: 0x80715c, roughness: 0.98 });
        this.roofMat = new THREE.MeshStandardMaterial({ color: 0x7d1c18, roughness: 0.9 });
        this.beamMat = new THREE.MeshStandardMaterial({ color: 0x493b30, roughness: 1 });

        this.geos = [
            new THREE.BoxGeometry(0.24, 0.24, 0.34),
            new THREE.BoxGeometry(0.18, 0.7, 0.14),
            new THREE.BoxGeometry(0.42, 0.2, 0.28),
            new THREE.BoxGeometry(0.58, 0.14, 0.42)
        ];

        for (let i = 0; i < 96; i++) {
            const mesh = new THREE.Mesh(this.geos[0], this.masonryMat);
            mesh.visible = false;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.pieces.push({
                mesh,
                active: false,
                life: 0,
                velocity: new THREE.Vector3(),
                spin: new THREE.Vector3()
            });
        }
    }

    emitBurst(x: number, y: number, z: number, profile: DebrisProfile, intensity: number) {
        const count =
            profile === 'tree' ? 8 :
            profile === 'houseDamage' ? 14 :
            26;

        const spread =
            profile === 'tree' ? 1.2 :
            profile === 'houseDamage' ? 1.8 :
            2.8;

        const verticalBoost =
            profile === 'tree' ? 2.6 :
            profile === 'houseDamage' ? 3.1 :
            4.2;

        for (let i = 0; i < count; i++) {
            const piece = this.pieces.find((entry) => !entry.active);
            if (!piece) return;

            const material = this.pickMaterial(profile, i);
            const geometry = this.geos[Math.floor(Math.random() * this.geos.length)];
            piece.mesh.geometry = geometry;
            piece.mesh.material = material;
            piece.mesh.visible = true;
            piece.mesh.position.set(
                x + (Math.random() - 0.5) * spread,
                y + Math.random() * spread * 0.5,
                z + (Math.random() - 0.5) * spread
            );
            piece.mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            piece.mesh.scale.setScalar(0.8 + Math.random() * 0.8);

            piece.active = true;
            piece.life = (1.2 + Math.random() * 0.9) * (0.85 + intensity * 0.2);
            piece.velocity.set(
                (Math.random() - 0.5) * spread * 2.1,
                Math.random() * verticalBoost + verticalBoost * 0.4,
                (Math.random() - 0.5) * spread * 2.1
            );
            piece.spin.set(
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 7
            );
        }
    }

    pickMaterial(profile: DebrisProfile, index: number) {
        if (profile === 'tree') {
            return index % 3 === 0 ? this.barkMat : this.woodMat;
        }

        if (profile === 'houseDamage') {
            return index % 4 === 0 ? this.roofMat : index % 3 === 0 ? this.beamMat : this.masonryMat;
        }

        return index % 5 === 0 ? this.roofMat : index % 4 === 0 ? this.beamMat : this.masonryMat;
    }

    update(dt: number) {
        for (const piece of this.pieces) {
            if (!piece.active) continue;

            piece.life -= dt;
            if (piece.life <= 0) {
                piece.active = false;
                piece.mesh.visible = false;
                continue;
            }

            piece.velocity.y -= dt * 8.2;
            piece.velocity.multiplyScalar(0.992);
            piece.mesh.position.addScaledVector(piece.velocity, dt);
            piece.mesh.rotation.x += piece.spin.x * dt;
            piece.mesh.rotation.y += piece.spin.y * dt;
            piece.mesh.rotation.z += piece.spin.z * dt;

            if (piece.mesh.position.y <= 0.12) {
                piece.mesh.position.y = 0.12;
                if (Math.abs(piece.velocity.y) > 0.6) {
                    piece.velocity.y *= -0.28;
                    piece.velocity.x *= 0.8;
                    piece.velocity.z *= 0.8;
                    piece.spin.multiplyScalar(0.72);
                } else {
                    piece.velocity.set(0, 0, 0);
                    piece.spin.multiplyScalar(0.86);
                }
            }
        }
    }
}
