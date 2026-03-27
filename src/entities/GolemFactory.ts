import * as THREE from 'three';

function markShadow(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

export class GolemFactory {
    static create() {
        const group = new THREE.Group();

        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.74, roughness: 0.38 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x322c2a, metalness: 0.82, roughness: 0.55 });
        const runeMat = new THREE.MeshStandardMaterial({ color: 0x3ac9ff, emissive: 0x3ac9ff, emissiveIntensity: 1.8 });
        const boilerMat = new THREE.MeshStandardMaterial({ color: 0xff7a22, emissive: 0xff7a22, emissiveIntensity: 1.35 });

        const pelvis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 1.8), bronzeMat);
        pelvis.position.y = 2;

        const pelvisFront = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.24), ironMat);
        pelvisFront.position.set(0, 0.05, -0.98);
        pelvis.add(pelvisFront);

        const leftHipSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 1.45), ironMat);
        leftHipSkirt.position.set(-1.12, -0.05, -0.05);
        pelvis.add(leftHipSkirt);

        const rightHipSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 1.45), ironMat);
        rightHipSkirt.position.set(1.12, -0.05, -0.05);
        pelvis.add(rightHipSkirt);

        const hipTankLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.65, 12), ironMat);
        hipTankLeft.rotation.z = Math.PI / 2;
        hipTankLeft.position.set(-0.8, -0.4, 0.35);
        pelvis.add(hipTankLeft);

        const hipTankRight = hipTankLeft.clone();
        hipTankRight.position.x = 0.8;
        pelvis.add(hipTankRight);

        group.add(pelvis);

        const buildLeg = (side: number) => {
            const leg = new THREE.Group();

            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 3.0, 0.82), ironMat);
            leg.add(thigh);

            const knee = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.46, 1.08), bronzeMat);
            knee.position.set(0, -0.1, -0.14);
            leg.add(knee);

            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.65, 1.08), bronzeMat);
            shin.position.set(0, -0.55, -0.2);
            leg.add(shin);

            const outerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.15, 0.9), bronzeMat);
            outerPlate.position.set(side * 0.43, -0.05, 0.02);
            leg.add(outerPlate);

            const pistonLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.95, 10), ironMat);
            pistonLeft.position.set(-0.2, -0.2, 0.34);
            leg.add(pistonLeft);

            const pistonRight = pistonLeft.clone();
            pistonRight.position.x = 0.2;
            leg.add(pistonRight);

            const foot = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 1.9), bronzeMat);
            foot.position.set(0, -1.24, -0.12);
            leg.add(foot);

            const heel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.8), ironMat);
            heel.position.set(0, -1.18, 0.55);
            leg.add(heel);

            const toe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.74), bronzeMat);
            toe.position.set(0, -1.08, -0.85);
            leg.add(toe);

            markShadow(leg);
            return leg;
        };

        const legsGroup = new THREE.Group();
        const leftLeg = buildLeg(-1);
        leftLeg.position.set(-0.95, 1.5, 0);
        const rightLeg = buildLeg(1);
        rightLeg.position.set(0.95, 1.5, 0);
        legsGroup.add(leftLeg, rightLeg);
        group.add(legsGroup);

        const buildArm = (side: number) => {
            const arm = new THREE.Group();

            const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.82, 1.55), bronzeMat);
            shoulder.position.set(side * 0.12, 0.95, -0.02);
            arm.add(shoulder);

            const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.45, 0.84), ironMat);
            arm.add(upperArm);

            const elbow = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.42, 1.0), bronzeMat);
            elbow.position.set(0, -0.45, -0.04);
            arm.add(elbow);

            const forearm = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.25, 1.28), bronzeMat);
            forearm.position.set(0, -0.82, -0.24);
            arm.add(forearm);

            const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 1.2), ironMat);
            wrist.position.set(0, -1.25, -0.62);
            arm.add(wrist);

            const clawLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.55), runeMat);
            clawLeft.position.set(-0.2, -1.24, -1.2);
            arm.add(clawLeft);

            const clawRight = clawLeft.clone();
            clawRight.position.x = 0.2;
            arm.add(clawRight);

            const shoulderPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 10), ironMat);
            shoulderPipe.rotation.z = Math.PI / 2;
            shoulderPipe.position.set(side * 0.34, 0.25, 0.42);
            arm.add(shoulderPipe);

            markShadow(arm);
            return arm;
        };

        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = 5.5;

        const torso = new THREE.Mesh(new THREE.BoxGeometry(3.25, 3.05, 2.45), bronzeMat);
        torsoGroup.add(torso);

        const shoulderBlockLeft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.84, 1.68), ironMat);
        shoulderBlockLeft.position.set(-1.75, 0.98, 0);
        torsoGroup.add(shoulderBlockLeft);

        const shoulderBlockRight = shoulderBlockLeft.clone();
        shoulderBlockRight.position.x = 1.75;
        torsoGroup.add(shoulderBlockRight);

        const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.75, 0.46), bronzeMat);
        chestPlate.position.set(0, 0.18, -1.15);
        torsoGroup.add(chestPlate);

        const chestVent = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.7, 0.24), ironMat);
        chestVent.position.set(0, -0.82, -1.34);
        torsoGroup.add(chestVent);

        const leftTorsoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.05, 1.62), bronzeMat);
        leftTorsoPlate.position.set(-1.48, 0.02, 0.05);
        torsoGroup.add(leftTorsoPlate);

        const rightTorsoPlate = leftTorsoPlate.clone();
        rightTorsoPlate.position.x = 1.48;
        torsoGroup.add(rightTorsoPlate);

        const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.92), runeMat);
        head.position.set(0, 2.02, -0.72);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.14), bronzeMat);
        visor.position.set(0, 0.02, -0.48);
        head.add(visor);
        torsoGroup.add(head);

        const leftArm = buildArm(-1);
        leftArm.position.set(-2.18, 0.02, 0.02);
        torsoGroup.add(leftArm);

        const rightArm = buildArm(1);
        rightArm.position.set(2.18, 0.02, 0.02);
        torsoGroup.add(rightArm);

        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 1.95, 18), boilerMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 0.08, 1.72);
        torsoGroup.add(boiler);

        const leftStack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.7, 12), ironMat);
        leftStack.position.set(-0.56, 1.14, 1.86);
        torsoGroup.add(leftStack);

        const rightStack = leftStack.clone();
        rightStack.position.x = 0.56;
        torsoGroup.add(rightStack);

        const backTankLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.45, 12), ironMat);
        backTankLeft.rotation.x = Math.PI / 2;
        backTankLeft.position.set(-1.02, -0.25, 1.48);
        torsoGroup.add(backTankLeft);

        const backTankRight = backTankLeft.clone();
        backTankRight.position.x = 1.02;
        torsoGroup.add(backTankRight);

        group.add(torsoGroup);
        markShadow(group);

        return {
            model: group,
            legs: legsGroup,
            torso: torsoGroup,
            head,
            boiler,
            leftLeg,
            rightLeg,
            leftArm,
            rightArm,
            pelvis,
            materials: {
                bronze: bronzeMat,
                rune: runeMat,
                boiler: boilerMat
            }
        };
    }
}
