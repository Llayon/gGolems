import * as THREE from 'three';
import type { CockpitRecoilProfile, WeaponMountId } from '../combat/weaponTypes';
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

type PendingRecoilPulse = {
    delay: number;
    mountId: WeaponMountId;
    profile: CockpitRecoilProfile;
    trauma: number;
};

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
    recoilQueue: PendingRecoilPulse[] = [];
    cockpitKickX = 0;
    cockpitKickY = 0;
    cockpitKickRoll = 0;
    cockpitFrameKick = 0;
    cockpitFlash = 0;
    reticleKickX = 0;
    reticleKickY = 0;
    recoilRecoveryRate = 10;

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

        this.updateWeaponRecoil(dt);
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

    updateWeaponRecoil(dt: number) {
        if (this.recoilQueue.length > 0) {
            for (let index = this.recoilQueue.length - 1; index >= 0; index--) {
                const pulse = this.recoilQueue[index];
                pulse.delay -= dt;
                if (pulse.delay <= 0) {
                    this.fireRecoilPulse(pulse);
                    this.recoilQueue.splice(index, 1);
                }
            }
        }

        const decay = Math.exp(-dt * this.recoilRecoveryRate);
        this.cockpitKickX *= decay;
        this.cockpitKickY *= decay;
        this.cockpitKickRoll *= Math.exp(-dt * this.recoilRecoveryRate * 1.1);
        this.cockpitFrameKick *= Math.exp(-dt * this.recoilRecoveryRate * 0.95);
        this.cockpitFlash *= Math.exp(-dt * this.recoilRecoveryRate * 1.45);
        this.reticleKickX *= Math.exp(-dt * this.recoilRecoveryRate * 0.9);
        this.reticleKickY *= Math.exp(-dt * this.recoilRecoveryRate * 0.82);
        this.recoilRecoveryRate += (10 - this.recoilRecoveryRate) * frameAlpha(0.08, dt);

        if (Math.abs(this.cockpitKickX) < 0.01) this.cockpitKickX = 0;
        if (Math.abs(this.cockpitKickY) < 0.01) this.cockpitKickY = 0;
        if (Math.abs(this.cockpitKickRoll) < 0.001) this.cockpitKickRoll = 0;
        if (this.cockpitFrameKick < 0.002) this.cockpitFrameKick = 0;
        if (this.cockpitFlash < 0.002) this.cockpitFlash = 0;
        if (Math.abs(this.reticleKickX) < 0.02) this.reticleKickX = 0;
        if (Math.abs(this.reticleKickY) < 0.02) this.reticleKickY = 0;
    }

    fireRecoilPulse(pulse: PendingRecoilPulse) {
        const side = pulse.mountId === 'leftArmMount' ? -1 : pulse.mountId === 'rightArmMount' ? 1 : 0;
        this.cockpitKickY -= pulse.profile.cameraKickBack * 17 + pulse.profile.cameraPitchKick * 30;
        this.cockpitKickX += side * pulse.profile.cameraYawKick * 18;
        this.cockpitKickRoll += side * pulse.profile.cameraYawKick * 0.9;
        this.reticleKickX += side * pulse.profile.cameraYawKick * 34;
        this.reticleKickY -= pulse.profile.cameraKickBack * 9 + pulse.profile.cameraPitchKick * 18;
        this.cockpitFrameKick = Math.min(2.4, this.cockpitFrameKick + pulse.profile.frameKick);
        this.cockpitFlash = Math.min(1, this.cockpitFlash + pulse.profile.frameKick * 0.55);
        this.recoilRecoveryRate = Math.max(this.recoilRecoveryRate, 2.8 / Math.max(0.08, pulse.profile.recoveryTime));
        this.targetFOV = Math.max(this.targetFOV, this.baseFOV + pulse.profile.fovKick);
        this.addTrauma(pulse.trauma);
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

    onWeaponFire(mountId: WeaponMountId, profile: CockpitRecoilProfile, fireTrauma: number) {
        const pulses = Math.max(1, profile.pulseCount);
        const pulseTrauma = (fireTrauma * SHAKE.fireTraumaScale * 1.35) / pulses;
        for (let index = 0; index < pulses; index++) {
            this.recoilQueue.push({
                delay: profile.pulseInterval * index,
                mountId,
                profile,
                trauma: pulseTrauma
            });
        }
    }

    getCockpitRecoilState() {
        return {
            x: this.cockpitKickX,
            y: this.cockpitKickY,
            roll: this.cockpitKickRoll,
            frame: this.cockpitFrameKick,
            flash: this.cockpitFlash,
            reticleX: this.reticleKickX,
            reticleY: this.reticleKickY
        };
    }
}
