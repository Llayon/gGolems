import * as THREE from 'three';

export class GolemFactory {
    static create() {
        const group = new THREE.Group();
        
        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xCD7F32, metalness: 0.7, roughness: 0.4 });
        const runeMat = new THREE.MeshStandardMaterial({ color: 0x00AAFF, emissive: 0x00AAFF, emissiveIntensity: 2 });
        const boilerMat = new THREE.MeshStandardMaterial({ color: 0xFF6600, emissive: 0xFF6600, emissiveIntensity: 1.5 });

        // Пельвис (таз)
        const pelvisGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const pelvis = new THREE.Mesh(pelvisGeo, bronzeMat);
        pelvis.position.y = 2;
        pelvis.castShadow = true;
        group.add(pelvis);

        const legsGroup = new THREE.Group();
        const legGeo = new THREE.BoxGeometry(0.7, 3, 0.7);
        const leftLeg = new THREE.Mesh(legGeo, bronzeMat);
        leftLeg.position.set(-0.75, 1.5, 0); // 1.5 is half of 3
        leftLeg.castShadow = true;
        const rightLeg = new THREE.Mesh(legGeo, bronzeMat);
        rightLeg.position.set(0.75, 1.5, 0);
        rightLeg.castShadow = true;
        legsGroup.add(leftLeg, rightLeg);
        group.add(legsGroup);

        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = 5.5;
        
        const torsoGeo = new THREE.BoxGeometry(3, 3, 2);
        const torso = new THREE.Mesh(torsoGeo, bronzeMat);
        torso.castShadow = true;
        torsoGroup.add(torso);

        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const head = new THREE.Mesh(headGeo, runeMat);
        head.position.set(0, 2.0, 0.5); // relative to torso (5.5 + 2.0 = 7.5)
        torsoGroup.add(head);

        const armGeo = new THREE.BoxGeometry(0.8, 2.5, 0.8);
        const leftArm = new THREE.Mesh(armGeo, bronzeMat);
        leftArm.position.set(-1.9, 0, 0);
        leftArm.castShadow = true;
        const rightArm = new THREE.Mesh(armGeo, bronzeMat);
        rightArm.position.set(1.9, 0, 0);
        rightArm.castShadow = true;
        torsoGroup.add(leftArm, rightArm);

        const boilerGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.5);
        const boiler = new THREE.Mesh(boilerGeo, boilerMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 0, -1.5);
        torsoGroup.add(boiler);

        group.add(torsoGroup);

        return { model: group, legs: legsGroup, torso: torsoGroup, boiler, leftLeg, rightLeg, leftArm, rightArm, pelvis };
    }
}
