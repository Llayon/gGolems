import * as THREE from 'three';

export class PropManager {
    constructor(scene: THREE.Scene) {
        this.addScaleObjects(scene);
    }

    addScaleObjects(scene: THREE.Scene) {
        // Маленькие домики 
        for (let i = 0; i < 8; i++) {
            const house = new THREE.Group();
            
            // Стены (голем = ~8 единиц высотой, дом = ~3)
            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(2, 3, 2),
                new THREE.MeshStandardMaterial({ color: 0x8B7355 })
            );
            walls.position.y = 1.5;
            walls.castShadow = true;
            walls.receiveShadow = true;
            house.add(walls);
            
            // Крыша
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(1.8, 1.5, 4),
                new THREE.MeshStandardMaterial({ color: 0x8B0000 })
            );
            roof.position.y = 3.5;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            roof.receiveShadow = true;
            house.add(roof);
            
            house.position.set(
                (Math.random() - 0.5) * 35,
                0,
                (Math.random() - 0.5) * 35
            );
            scene.add(house);
        }
        
        // Крошечные фигурки людей
        for (let i = 0; i < 20; i++) {
            const person = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.5, 2, 4), // крошечный!
                new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            person.position.set(
                (Math.random() - 0.5) * 35,
                0.4,
                (Math.random() - 0.5) * 35
            );
            person.castShadow = true;
            scene.add(person);
        }
        
        // Деревья (голему по пояс)
        for (let i = 0; i < 15; i++) {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.3, 3, 5),
                new THREE.MeshStandardMaterial({ color: 0x4A3728 })
            );
            trunk.position.y = 1.5;
            trunk.castShadow = true;
            tree.add(trunk);
            
            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 5, 4),
                new THREE.MeshStandardMaterial({ color: 0x2D5A1E })
            );
            leaves.position.y = 3.5;
            leaves.castShadow = true;
            tree.add(leaves);
            
            tree.position.set(
                (Math.random() - 0.5) * 35,
                0,
                (Math.random() - 0.5) * 35
            );
            scene.add(tree);
        }
    }
}
