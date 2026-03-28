import * as THREE from 'three';
import { clamp } from '../utils/math';
import { CAMERA, WALK, SHAKE } from '../utils/constants';

const _zero = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _aimForward = new THREE.Vector3();
const _bodyForward = new THREE.Vector3();
const _cameraRight = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function setLookVector(out: THREE.Vector3, yaw: number, pitch: number) {
    const flatLength = Math.cos(pitch);
    out.set(
        Math.sin(yaw) * flatLength,
        Math.sin(pitch),
        -Math.cos(yaw) * flatLength
    );
    return out;
}

function frameAlpha(alphaAt60Fps: number, dt: number) {
    return 1 - Math.pow(1 - alphaAt60Fps, dt * 60);
}

export type CameraMode = 'cockpit' | 'thirdPerson';

export class MechCamera {
    camera: THREE.PerspectiveCamera;
    aimYaw = 0;
    pitch = 0;
    mode: CameraMode = 'cockpit';

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

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        this.baseFOV = CAMERA.fov;
        this.targetFOV = CAMERA.fov;
        this.camera.fov = CAMERA.fov;
        this.camera.near = 0.5;
        this.camera.far = 200;
        this.camera.updateProjectionMatrix();
    }

    setMode(mode: CameraMode) {
        if (this.mode === mode) return;
        this.mode = mode;
        this.initialized = false;
    }

    toggleMode() {
        this.setMode(this.mode === 'cockpit' ? 'thirdPerson' : 'cockpit');
        return this.mode;
    }

    getAimDirection(out: THREE.Vector3) {
        return setLookVector(out, this.aimYaw, this.pitch);
    }

    onMouseMove(movementX: number, movementY: number) {
        this.aimYaw += movementX * CAMERA.yawSpeed;
        this.pitch -= movementY * CAMERA.pitchSpeed;
        this.pitch = clamp(this.pitch, CAMERA.pitchMin, CAMERA.pitchMax);
    }

    update(
        anchorPos: THREE.Vector3,
        bodyYaw: number,
        aimYaw: number,
        speed: number,
        mass: number,
        dt: number
    ) {
        this.aimYaw = aimYaw;
        this.getAimDirection(_aimForward);

        if (this.mode === 'thirdPerson') {
            setLookVector(_bodyForward, bodyYaw, 0);
            _cameraRight.set(Math.cos(bodyYaw), 0, Math.sin(bodyYaw));

            _targetPos
                .copy(anchorPos)
                .addScaledVector(_bodyForward, -CAMERA.thirdPersonDistance)
                .addScaledVector(_cameraRight, CAMERA.thirdPersonShoulderOffset)
                .addScaledVector(_up, CAMERA.thirdPersonHeight);
            _targetLookAt.copy(anchorPos).addScaledVector(_aimForward, CAMERA.thirdPersonLookForward);
        } else {
            _targetPos.copy(anchorPos);
            _targetLookAt.copy(_targetPos).addScaledVector(_aimForward, CAMERA.lookForward);
        }

        if (!this.initialized) {
            this.currentPos.copy(_targetPos);
            this.currentLookAt.copy(_targetLookAt);
            this.initialized = true;
        }

        this.currentPos.lerp(_targetPos, frameAlpha(CAMERA.posLerp, dt));
        this.currentLookAt.lerp(_targetLookAt, frameAlpha(CAMERA.lookLerp, dt));

        this.updateWalkBob(speed, mass, dt);
        this.updateShake(dt);
        this.updateFOV(speed, dt);

        this.camera.position.copy(this.currentPos);
        this.camera.position.add(this.bobAmount);
        this.camera.position.add(this.shakeOffset);
        this.camera.lookAt(this.currentLookAt);
        this.camera.rotateZ(this.currentRoll + this.shakeRotation);
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
            const settle = frameAlpha(0.08, dt);
            this.bobAmount.lerp(_zero, settle);
            this.currentRoll *= Math.pow(0.92, dt * 60);
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
        this.camera.fov += (this.targetFOV - this.camera.fov) * frameAlpha(CAMERA.fovLerp, dt);
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
