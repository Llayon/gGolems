import * as THREE from 'three';
import { angleDiff, clamp, moveTowardsAngle } from '../utils/math';
import { CAMERA, WALK, SHAKE } from '../utils/constants';

const _zero = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _velocityLead = new THREE.Vector3();
const _bodyForward = new THREE.Vector3();
const _bodyRight = new THREE.Vector3();
const _aimForward = new THREE.Vector3();

function setForward(out: THREE.Vector3, yaw: number) {
    out.set(Math.sin(yaw), 0, -Math.cos(yaw));
    return out;
}

function setRight(out: THREE.Vector3, yaw: number) {
    out.set(Math.cos(yaw), 0, Math.sin(yaw));
    return out;
}

export class MechCamera {
    camera: THREE.PerspectiveCamera;
    aimYaw = 0;
    cameraYaw = 0;
    pitch = 0;

    currentPos = new THREE.Vector3();
    currentLookAt = new THREE.Vector3();
    initialized = false;

    walkCycle = 0;
    bobAmount = new THREE.Vector3();
    currentRoll = 0;

    lastStepSign = 1;
    onFootstep: (() => void) | null = null;

    trauma = 0;
    shakeOffset = new THREE.Vector3();
    shakeRotation = 0;

    baseFOV: number;
    targetFOV: number;

    raycaster = new THREE.Raycaster();

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        this.baseFOV = CAMERA.fov;
        this.targetFOV = CAMERA.fov;
        this.camera.fov = CAMERA.fov;
        this.camera.near = 0.5;
        this.camera.far = 200;
        this.camera.updateProjectionMatrix();
    }

    onMouseMove(movementX: number, movementY: number) {
        this.aimYaw -= movementX * CAMERA.yawSpeed;
        this.pitch -= movementY * CAMERA.pitchSpeed;
        this.pitch = clamp(this.pitch, CAMERA.pitchMin, CAMERA.pitchMax);
    }

    update(
        anchorPos: THREE.Vector3,
        bodyYaw: number,
        torsoYaw: number,
        aimYawUnclamped: number,
        speed: number,
        mass: number,
        dt: number,
        colliders: THREE.Mesh[]
    ) {
        const torsoOffset = angleDiff(bodyYaw, torsoYaw);
        const aimOffset = clamp(angleDiff(bodyYaw, aimYawUnclamped), -CAMERA.maxAimLead, CAMERA.maxAimLead);
        const torsoAimOffset = clamp(angleDiff(torsoYaw, aimYawUnclamped), -CAMERA.maxAimLead, CAMERA.maxAimLead);

        const yawTarget = bodyYaw + torsoOffset * CAMERA.cameraTorsoInfluence;
        if (!this.initialized) {
            this.cameraYaw = yawTarget;
        } else {
            const yawStep = Math.max(CAMERA.cameraYawLag, Math.abs(angleDiff(this.cameraYaw, yawTarget)) * 0.35) * dt * 10;
            this.cameraYaw = moveTowardsAngle(this.cameraYaw, yawTarget, yawStep);
        }

        setForward(_bodyForward, this.cameraYaw);
        setRight(_bodyRight, this.cameraYaw);

        _offset.copy(anchorPos);
        _offset.addScaledVector(_bodyRight, CAMERA.offsetRight);
        _offset.addScaledVector(_bodyForward, -CAMERA.offsetBack);
        _offset.y += CAMERA.offsetUp;

        _velocityLead.copy(_bodyForward).multiplyScalar(-Math.min(speed, 12) * CAMERA.cameraVelocityLead);
        _targetPos.copy(_offset).add(_velocityLead);

        const actualAimYaw = torsoYaw + torsoAimOffset * CAMERA.cameraAimInfluence;
        setForward(_aimForward, actualAimYaw);
        _targetLookAt.copy(anchorPos);
        _targetLookAt.addScaledVector(_aimForward, CAMERA.lookForward);
        _targetLookAt.y += CAMERA.lookAbove + this.pitch * 8;

        if (!this.initialized) {
            this.currentPos.copy(_targetPos);
            this.currentLookAt.copy(_targetLookAt);
            this.initialized = true;
        }

        this.currentPos.lerp(_targetPos, CAMERA.posLerp);
        this.currentLookAt.lerp(_targetLookAt, CAMERA.lookLerp);

        _dir.subVectors(this.currentPos, anchorPos).normalize();
        const dist = this.currentPos.distanceTo(anchorPos);
        this.raycaster.set(anchorPos, _dir);
        const intersects = this.raycaster.intersectObjects(colliders);
        if (intersects.length > 0 && intersects[0].distance < dist) {
            this.currentPos.copy(anchorPos).addScaledVector(_dir, intersects[0].distance * 0.85);
        }

        this.updateWalkBob(speed, mass, dt);
        this.updateShake(dt);
        this.updateFOV(speed, dt);

        this.camera.position.copy(this.currentPos);
        this.camera.position.add(this.bobAmount);
        this.camera.position.add(this.shakeOffset);
        this.camera.lookAt(this.currentLookAt);
        this.camera.rotateZ(this.currentRoll + this.shakeRotation);
    }

    getAimScreenOffset(referenceYaw: number): number {
        return clamp(angleDiff(referenceYaw, this.aimYaw), -CAMERA.maxAimLead, CAMERA.maxAimLead);
    }

    updateWalkBob(speed: number, mass: number, dt: number) {
        const normalizedSpeed = Math.min(speed / 10, 1);

        if (normalizedSpeed > 0.1) {
            const freq = (WALK.stepFrequency / mass) * normalizedSpeed;
            this.walkCycle += freq * dt;

            const phase = this.walkCycle * Math.PI * 2;
            const bobAmp = WALK.bobAmplitude * mass * normalizedSpeed;
            const swayAmp = WALK.swayAmplitude * 0.45 * mass * normalizedSpeed;
            const rollAmp = WALK.rollAmplitude * 0.35 * mass * normalizedSpeed;

            const rawBob = Math.sin(phase * 2);
            this.bobAmount.y = rawBob * bobAmp;

            const impactWave = Math.max(0, -rawBob);
            this.bobAmount.y -= impactWave * impactWave * bobAmp * 0.5;

            this.bobAmount.x = Math.sin(phase) * swayAmp;
            this.bobAmount.z = Math.cos(phase * 2) * bobAmp * 0.12;
            this.currentRoll = Math.sin(phase) * rollAmp;

            const stepSin = Math.sin(phase * 2);
            const currentSign = stepSin >= 0 ? 1 : -1;
            if (currentSign !== this.lastStepSign && currentSign === 1) {
                this.addTrauma(SHAKE.footstepTrauma * mass * normalizedSpeed);
                this.onFootstep?.();
            }
            this.lastStepSign = currentSign;
        } else {
            this.bobAmount.lerp(_zero, 0.08);
            this.currentRoll *= 0.92;
            this.walkCycle = 0;
            this.lastStepSign = 1;
        }
    }

    addTrauma(amount: number) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    updateShake(dt: number) {
        if (this.trauma > 0.001) {
            this.trauma *= Math.pow(SHAKE.decayRate, dt * 60);
            const shake = this.trauma * this.trauma;

            this.shakeOffset.set(
                (Math.random() - 0.5) * shake * SHAKE.translationScale,
                (Math.random() - 0.5) * shake * SHAKE.translationScale * 0.7,
                (Math.random() - 0.5) * shake * SHAKE.translationScale * 0.5
            );
            this.shakeRotation = (Math.random() - 0.5) * shake * SHAKE.rotationScale;
        } else {
            this.shakeOffset.set(0, 0, 0);
            this.shakeRotation = 0;
            this.trauma = 0;
        }
    }

    updateFOV(speed: number, dt: number) {
        const speedFOV = this.baseFOV + (speed / 15) * 4;
        this.targetFOV = Math.max(this.targetFOV, speedFOV);
        this.camera.fov += (this.targetFOV - this.camera.fov) * CAMERA.fovLerp;
        this.camera.updateProjectionMatrix();
        this.targetFOV += (speedFOV - this.targetFOV) * Math.min(1, CAMERA.cameraReturnRate * dt);
    }

    onDash() {
        this.targetFOV = CAMERA.dashFOV;
        this.addTrauma(0.15);
    }

    onHit(damage: number) {
        this.addTrauma(damage * SHAKE.hitTraumaPerDamage);
        this.targetFOV = CAMERA.hitFOV;
    }

    onFire(weaponWeight: number) {
        this.addTrauma(weaponWeight * SHAKE.fireTraumaScale);
    }
}
