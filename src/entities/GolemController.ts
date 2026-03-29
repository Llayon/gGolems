import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GolemFactory } from './GolemFactory';
import { angleDiff, clamp, moveTowardsAngle } from '../utils/math';
import { GOLEM, ROTATION } from '../utils/constants';
import { ParticleManager } from '../fx/ParticleManager';
import { AudioManager } from '../core/AudioManager';
import { DecalManager } from '../fx/DecalManager';
import { MechCamera } from '../camera/MechCamera';
import { getWeaponDefinition, WEAPON_MOUNT_ORDER } from '../combat/weapons';
import type { WeaponFireRequest, WeaponGroupId, WeaponId, WeaponMountId, WeaponMountRuntime, WeaponStatusView } from '../combat/weaponTypes';
import { createMarcelineSentinelVisual, type MarcelineSentinelVisual } from './MarcelineSentinelAsset';

const _moveDir = new THREE.Vector3();
const _currentVel = new THREE.Vector3();
const _netPos = new THREE.Vector3();
const _cameraAnchor = new THREE.Vector3();
const _viewForward = new THREE.Vector3();
const _footOffset = new THREE.Vector3();
const _bodyForward = new THREE.Vector3();
const _desiredVel = new THREE.Vector3();
const _sideVel = new THREE.Vector3();
const _muzzleOffset = new THREE.Vector3();
const _heroTwistQuat = new THREE.Quaternion();
const _heroArmQuat = new THREE.Quaternion();
const _heroUpAxis = new THREE.Vector3(0, 1, 0);
const _heroPitchAxis = new THREE.Vector3(1, 0, 0);

export type GolemSection =
    | 'head'
    | 'centerTorso'
    | 'leftTorso'
    | 'rightTorso'
    | 'leftArm'
    | 'rightArm'
    | 'leftLeg'
    | 'rightLeg';

export type GolemSectionState = Record<GolemSection, number>;

export const GOLEM_SECTION_ORDER: GolemSection[] = [
    'head',
    'centerTorso',
    'leftTorso',
    'rightTorso',
    'leftArm',
    'rightArm',
    'leftLeg',
    'rightLeg'
];

const GOLEM_SECTION_MAX: GolemSectionState = {
    head: 18,
    centerTorso: 48,
    leftTorso: 34,
    rightTorso: 34,
    leftArm: 24,
    rightArm: 24,
    leftLeg: 36,
    rightLeg: 36
};

function createSectionState(): GolemSectionState {
    return { ...GOLEM_SECTION_MAX };
}

export interface GolemState {
    pos: THREE.Vector3;
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    currentSpeed: number;
    mass: number;
    sections: GolemSectionState;
    maxSections: GolemSectionState;
    weaponStatus: WeaponStatusView[];
}

export interface GolemEvents {
    dashed: boolean;
    vented: boolean;
    footstep: boolean;
}

export class GolemController {
    model: THREE.Group;
    legs: THREE.Group;
    torso: THREE.Group;
    head: THREE.Mesh;
    boiler: THREE.Mesh;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    pelvis: THREE.Mesh;
    body: RAPIER.RigidBody;
    isLocal: boolean;
    gameCamera?: MechCamera;
    bronzeMaterial: THREE.MeshStandardMaterial;
    runeMaterial: THREE.MeshStandardMaterial;
    boilerMaterial: THREE.MeshStandardMaterial;
    heroVisual: MarcelineSentinelVisual | null = null;
    sections: GolemSectionState = createSectionState();
    maxSections: GolemSectionState = createSectionState();
    weaponMounts: Record<WeaponMountId, WeaponMountRuntime>;
    weaponRecoil: Record<WeaponMountId, number> = {
        rightArmMount: 0,
        leftArmMount: 0,
        torsoMount: 0
    };

    legYaw = 0;
    torsoYaw = 0;

    hp = 100;
    maxHp = 100;
    steam = 100;
    maxSteam = 100;
    isOverheated = false;
    overheatTimer = 0;

    mass = 2.0;
    throttle = 0;
    walkCycle = 0;
    lastStepPhase = 0;
    currentSpeed = 0;
    damageFlashTimer = 0;
    dashRecoveryTimer = 0;

    targetPos = new THREE.Vector3();
    targetLegYaw = 0;
    targetTorsoYaw = 0;

    constructor(scene: THREE.Scene, physics: RAPIER.World, isLocal: boolean = true) {
        this.isLocal = isLocal;
        const parts = GolemFactory.create();
        this.model = parts.model;
        this.legs = parts.legs;
        this.torso = parts.torso;
        this.head = parts.head;
        this.boiler = parts.boiler;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
        this.pelvis = parts.pelvis;
        this.bronzeMaterial = parts.materials.bronze;
        this.runeMaterial = parts.materials.rune;
        this.boilerMaterial = parts.materials.boiler;
        scene.add(this.model);
        if (isLocal) {
            this.model.visible = false;
        }

        const bodyDesc = isLocal ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
        bodyDesc.setTranslation(0, 5, 0).lockRotations();
        bodyDesc.setLinearDamping(0.5);
        this.body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.75, 0.8);
        colliderDesc.setMass(this.mass);
        physics.createCollider(colliderDesc, this.body);
        this.weaponMounts = this.createWeaponMounts();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
        if (isLocal) {
            void this.initHeroVisual();
        }
    }

    createWeaponMounts(): Record<WeaponMountId, WeaponMountRuntime> {
        return {
            rightArmMount: {
                mountId: 'rightArmMount',
                weaponId: 'rune_bolt',
                group: 1,
                section: 'rightArm',
                cooldownRemaining: 0,
                enabled: true
            },
            leftArmMount: {
                mountId: 'leftArmMount',
                weaponId: 'arc_emitter',
                group: 2,
                section: 'leftArm',
                cooldownRemaining: 0,
                enabled: true
            },
            torsoMount: {
                mountId: 'torsoMount',
                weaponId: 'steam_cannon',
                group: 3,
                section: 'rightTorso',
                cooldownRemaining: 0,
                enabled: true
            }
        };
    }

    async initHeroVisual() {
        const heroVisual = await createMarcelineSentinelVisual();
        if (!heroVisual) return;

        this.heroVisual = heroVisual;
        this.model.add(heroVisual.root);
        this.pelvis.visible = false;
        this.legs.visible = false;
        this.torso.visible = false;
        this.syncHeroVisual();
        this.applySectionVisuals();
    }

    triggerOverheat(duration = GOLEM.overheatDuration) {
        this.isOverheated = true;
        this.overheatTimer = Math.max(this.overheatTimer, duration);
    }

    spendSteam(cost: number) {
        if (this.isOverheated) return false;
        if (cost <= 0) return true;
        if (this.steam < cost) {
            this.triggerOverheat();
            return false;
        }
        this.steam -= cost;
        if (this.steam <= GOLEM.overheatThreshold) {
            this.triggerOverheat();
        }
        return true;
    }

    updateWeaponCooldowns(dt: number) {
        for (const mountId of WEAPON_MOUNT_ORDER) {
            this.weaponMounts[mountId].cooldownRemaining = Math.max(0, this.weaponMounts[mountId].cooldownRemaining - dt);
        }
    }

    syncMountAvailabilityFromSections() {
        for (const mountId of WEAPON_MOUNT_ORDER) {
            const mount = this.weaponMounts[mountId];
            mount.enabled = this.sections[mount.section] > 0;
        }
    }

    flashDamage(duration = 0.16) {
        this.damageFlashTimer = Math.max(this.damageFlashTimer, duration);
    }

    syncAggregateHp() {
        this.maxHp = GOLEM_SECTION_ORDER.reduce((sum, section) => sum + this.maxSections[section], 0);
        this.hp = GOLEM_SECTION_ORDER.reduce((sum, section) => sum + this.sections[section], 0);
    }

    setSectionState(nextSections: Partial<GolemSectionState>) {
        for (const section of GOLEM_SECTION_ORDER) {
            const nextValue = nextSections[section];
            if (typeof nextValue === 'number') {
                this.sections[section] = nextValue;
            }
        }
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
    }

    resetSections() {
        this.sections = createSectionState();
        for (const mountId of WEAPON_MOUNT_ORDER) {
            this.weaponMounts[mountId].cooldownRemaining = 0;
            this.weaponRecoil[mountId] = 0;
        }
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
    }

    applySectionVisuals() {
        const showProcedural = !this.heroVisual;
        this.head.visible = showProcedural && this.sections.head > 0;
        this.leftArm.visible = showProcedural && this.sections.leftArm > 0;
        this.rightArm.visible = showProcedural && this.sections.rightArm > 0;
        this.leftLeg.visible = showProcedural && this.sections.leftLeg > 0;
        this.rightLeg.visible = showProcedural && this.sections.rightLeg > 0;
    }

    applySectionDamage(section: GolemSection, damage: number) {
        const current = this.sections[section];
        const remaining = Math.max(0, current - damage);
        this.sections[section] = remaining;
        this.flashDamage();
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
        return {
            section,
            remaining,
            destroyed: current > 0 && remaining <= 0,
            lethal: (section === 'head' || section === 'centerTorso') && remaining <= 0,
            totalHp: this.hp
        };
    }

    canFire() {
        return WEAPON_MOUNT_ORDER.some((mountId) => {
            const mount = this.weaponMounts[mountId];
            const definition = getWeaponDefinition(mount.weaponId);
            return mount.enabled && mount.cooldownRemaining <= 0 && !this.isOverheated && this.steam >= definition.heatCost;
        });
    }

    tryAction(cost: number) {
        return this.spendSteam(cost);
    }

    getWeaponStatus(): WeaponStatusView[] {
        return WEAPON_MOUNT_ORDER.map((mountId) => {
            const mount = this.weaponMounts[mountId];
            const definition = getWeaponDefinition(mount.weaponId);

            let state: WeaponStatusView['state'] = 'ready';
            if (!mount.enabled) {
                state = 'offline';
            } else if (mount.cooldownRemaining > 0) {
                state = 'recycle';
            } else if (this.isOverheated || this.steam < definition.heatCost) {
                state = 'heat';
            }

            return {
                mountId: mount.mountId,
                weaponId: mount.weaponId,
                group: mount.group,
                section: mount.section,
                nameKey: definition.nameKey,
                shortKey: definition.shortKey,
                state,
                cooldownRemaining: mount.cooldownRemaining,
                heatCost: definition.heatCost
            };
        });
    }

    getMountRoot(mountId: WeaponMountId) {
        switch (mountId) {
            case 'leftArmMount':
                return this.leftArm;
            case 'rightArmMount':
                return this.rightArm;
            case 'torsoMount':
            default:
                return this.torso;
        }
    }

    getHeroMountSocket(mountId: WeaponMountId) {
        return this.heroVisual?.sockets[mountId] ?? null;
    }

    getWeaponMuzzleOrigin(mountId: WeaponMountId, out: THREE.Vector3) {
        const heroSocket = this.getHeroMountSocket(mountId);
        if (heroSocket) {
            return heroSocket.getWorldPosition(out);
        }

        const mount = this.weaponMounts[mountId];
        const definition = getWeaponDefinition(mount.weaponId);
        _muzzleOffset.set(definition.muzzleOffset.x, definition.muzzleOffset.y, definition.muzzleOffset.z);
        this.getMountRoot(mountId).localToWorld(out.copy(_muzzleOffset));
        return out;
    }

    triggerWeaponRecoil(weaponId: WeaponId) {
        const mountId = getWeaponDefinition(weaponId).mountId;
        this.weaponRecoil[mountId] = 1;
    }

    buildWeaponFireRequest(mount: WeaponMountRuntime): WeaponFireRequest {
        const definition = getWeaponDefinition(mount.weaponId);
        return {
            mountId: mount.mountId,
            weaponId: mount.weaponId,
            group: mount.group,
            section: mount.section,
            nameKey: definition.nameKey,
            shortKey: definition.shortKey,
            damage: definition.damage,
            heatCost: definition.heatCost,
            spread: definition.spread,
            projectileSpeed: definition.projectileSpeed,
            effectiveRange: definition.effectiveRange,
            projectileProfile: definition.projectileProfile,
            projectileCount: definition.projectileCount,
            fireTrauma: definition.fireTrauma,
            cockpitRecoil: definition.cockpitRecoil,
            muzzleOffset: definition.muzzleOffset
        };
    }

    gatherReadyMounts(groupId?: WeaponGroupId) {
        const mounts = WEAPON_MOUNT_ORDER
            .map((mountId) => this.weaponMounts[mountId])
            .filter((mount) => groupId === undefined || mount.group === groupId)
            .filter((mount) => mount.enabled && mount.cooldownRemaining <= 0);

        if (mounts.length === 0 || this.isOverheated) {
            return [];
        }

        const totalHeat = mounts.reduce((sum, mount) => sum + getWeaponDefinition(mount.weaponId).heatCost, 0);
        if (this.steam < totalHeat) {
            this.triggerOverheat();
            return [];
        }

        if (!this.spendSteam(totalHeat)) {
            return [];
        }

        for (const mount of mounts) {
            mount.cooldownRemaining = getWeaponDefinition(mount.weaponId).cooldown;
        }

        return mounts.map((mount) => this.buildWeaponFireRequest(mount));
    }

    tryFireGroup(groupId: WeaponGroupId) {
        return this.gatherReadyMounts(groupId);
    }

    tryFireAlpha() {
        return this.gatherReadyMounts();
    }

    dash() {
        _bodyForward.set(Math.sin(this.legYaw), 0, -Math.cos(this.legYaw));
        const vel = this.body.linvel();
        _currentVel.set(vel.x, 0, vel.z);
        const forwardSpeed = _currentVel.dot(_bodyForward);
        const dashSign = Math.abs(this.throttle) > 0.08
            ? Math.sign(this.throttle)
            : forwardSpeed < -0.5
                ? -1
                : 1;
        const dir = _bodyForward.clone().multiplyScalar(dashSign || 1);
        if (this.isLocal) {
            const dashSpeed = 16.5;
            this.body.setLinvel({
                x: dir.x * dashSpeed,
                y: Math.min(vel.y, 0),
                z: dir.z * dashSpeed
            }, true);
            this.dashRecoveryTimer = 0.24;
        }
    }

    getViewAnchor(out: THREE.Vector3, facingYaw = this.torsoYaw) {
        this.torso.getWorldPosition(out);
        _viewForward.set(Math.sin(facingYaw), 0, -Math.cos(facingYaw));
        out.addScaledVector(_viewForward, 0.35);
        out.y += 1.45;
        return out;
    }

    syncHeroVisual() {
        if (!this.heroVisual) return;

        const torsoTwist = angleDiff(this.legYaw, this.torsoYaw);
        const bob = Math.abs(Math.sin(this.walkCycle * 2)) * 0.08;
        this.heroVisual.root.rotation.set(0, this.legYaw, 0);
        this.heroVisual.root.position.set(0, 0, 0);

        const pelvis = this.heroVisual.bones.pelvis;
        const pelvisRest = this.heroVisual.restPose.pelvis;
        if (pelvis && pelvisRest) {
            pelvis.position.copy(pelvisRest.position);
            pelvis.position.y += bob;
            pelvis.quaternion.copy(pelvisRest.quaternion);
        }

        const torso = this.heroVisual.bones.torso;
        const torsoRest = this.heroVisual.restPose.torso;
        if (torso && torsoRest) {
            torso.position.copy(torsoRest.position);
            torso.position.y += bob * 0.65;
            torso.quaternion.copy(torsoRest.quaternion);
            _heroTwistQuat.setFromAxisAngle(_heroUpAxis, torsoTwist);
            torso.quaternion.multiply(_heroTwistQuat);
        }

        const leftArm = this.heroVisual.bones.leftArm;
        const leftArmRest = this.heroVisual.restPose.leftArm;
        if (leftArm && leftArmRest) {
            leftArm.position.copy(leftArmRest.position);
            leftArm.quaternion.copy(leftArmRest.quaternion);
            _heroArmQuat.setFromAxisAngle(_heroPitchAxis, -this.weaponRecoil.leftArmMount * 0.55);
            leftArm.quaternion.multiply(_heroArmQuat);
        }

        const rightArm = this.heroVisual.bones.rightArm;
        const rightArmRest = this.heroVisual.restPose.rightArm;
        if (rightArm && rightArmRest) {
            rightArm.position.copy(rightArmRest.position);
            rightArm.quaternion.copy(rightArmRest.quaternion);
            _heroArmQuat.setFromAxisAngle(_heroPitchAxis, -this.weaponRecoil.rightArmMount * 0.55);
            rightArm.quaternion.multiply(_heroArmQuat);
        }

        this.heroVisual.root.updateMatrixWorld(true);
    }

    vent(particles: ParticleManager) {
        this.steam = 0;
        const pos = this.body.translation();
        for (let i = 0; i < 30; i++) {
            particles.emit(pos.x + (Math.random() - 0.5) * 4, pos.y + Math.random() * 3, pos.z + (Math.random() - 0.5) * 4);
        }
    }

    update(
        dt: number,
        aimYawUnclamped: number,
        throttleInput: number,
        turnInput: number,
        centerTorso: boolean,
        stopThrottle: boolean,
        sounds: AudioManager,
        decals: DecalManager
    ): GolemEvents {
        const events: GolemEvents = { dashed: false, vented: false, footstep: false };

        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
        }
        this.updateWeaponCooldowns(dt);
        for (const mountId of WEAPON_MOUNT_ORDER) {
            this.weaponRecoil[mountId] = Math.max(0, this.weaponRecoil[mountId] - dt * 8.5);
        }
        const flashRatio = this.damageFlashTimer > 0 ? this.damageFlashTimer / 0.16 : 0;
        const flashIntensity = flashRatio * 1.6;
        this.bronzeMaterial.emissive.setRGB(0.55 * flashRatio, 0.42 * flashRatio, 0.18 * flashRatio);
        this.bronzeMaterial.emissiveIntensity = flashIntensity;
        this.runeMaterial.emissiveIntensity = 2 + flashIntensity * 0.6;
        this.boilerMaterial.emissiveIntensity = 1.5 + flashIntensity * 0.35;

        if (this.isOverheated) {
            this.overheatTimer -= dt;
            if (this.overheatTimer <= 0) {
                this.isOverheated = false;
                this.steam = 20;
            }
        } else {
            this.steam = Math.min(this.maxSteam, this.steam + GOLEM.steamRegen * dt);
        }

        if (this.isLocal) {
            const torsoStep = ROTATION.torsoTurnRate.medium * dt;
            const maxTwist = ROTATION.maxTorsoTwist;
            const throttleRamp = 1.05;
            const brakeResponse = 6.4;
            const driveResponse = 5.4;
            const lateralGrip = 10;
            const legIntegrity = Math.max(
                0.25,
                (this.sections.leftLeg / this.maxSections.leftLeg + this.sections.rightLeg / this.maxSections.rightLeg) * 0.5
            );
            const bodyTurnStep = ROTATION.legsTurnRate.medium * dt * (0.45 + legIntegrity * 0.55);
            const maxSpeed = GOLEM.classes.medium.speed * (0.3 + legIntegrity * 0.72);

            if (centerTorso) {
                aimYawUnclamped = this.legYaw;
                if (this.gameCamera) {
                    this.gameCamera.aimYaw = this.legYaw;
                }
            }

            if (stopThrottle) {
                this.throttle = 0;
            } else if (throttleInput !== 0) {
                this.throttle = clamp(this.throttle + throttleInput * throttleRamp * dt, -0.45, 1);
            }

            if (turnInput !== 0) {
                this.legYaw += turnInput * bodyTurnStep;
            } else if (this.gameCamera) {
                const bodyCatchTarget = this.gameCamera.aimYaw;
                const bodyCatchOffset = angleDiff(this.legYaw, bodyCatchTarget);
                const bodyCatchAbs = Math.abs(bodyCatchOffset);
                const catchThreshold = maxTwist * 0.72;

                if (bodyCatchAbs > catchThreshold) {
                    const catchStrength = clamp((bodyCatchAbs - catchThreshold) / (maxTwist - catchThreshold), 0, 1);
                    const locomotionBias = Math.abs(this.throttle) > 0.08 ? 0.55 : 0.22;
                    const catchStep = bodyTurnStep * locomotionBias * catchStrength;
                    this.legYaw = moveTowardsAngle(this.legYaw, bodyCatchTarget, catchStep);
                }
            }

            let desiredTorsoYaw = aimYawUnclamped;
            const twistFromBody = angleDiff(this.legYaw, desiredTorsoYaw);
            if (twistFromBody > maxTwist) {
                desiredTorsoYaw = this.legYaw + maxTwist;
                if (this.gameCamera) {
                    this.gameCamera.aimYaw = desiredTorsoYaw;
                }
            }
            if (twistFromBody < -maxTwist) {
                desiredTorsoYaw = this.legYaw - maxTwist;
                if (this.gameCamera) {
                    this.gameCamera.aimYaw = desiredTorsoYaw;
                }
            }

            this.torsoYaw = moveTowardsAngle(this.torsoYaw, desiredTorsoYaw, torsoStep);
            this.targetTorsoYaw = desiredTorsoYaw;

            const vel = this.body.linvel();
            _currentVel.set(vel.x, 0, vel.z);

            _bodyForward.set(Math.sin(this.legYaw), 0, -Math.cos(this.legYaw));
            const forwardSpeed = _currentVel.dot(_bodyForward);
            _sideVel.copy(_currentVel).addScaledVector(_bodyForward, -forwardSpeed);
            this.body.applyImpulse({
                x: -_sideVel.x * this.mass * lateralGrip * dt,
                y: 0,
                z: -_sideVel.z * this.mass * lateralGrip * dt
            }, true);

            _desiredVel.copy(_bodyForward).multiplyScalar(maxSpeed * this.throttle);
            _moveDir.copy(_desiredVel).sub(_currentVel);
            const response = Math.abs(this.throttle) > 0.001 ? driveResponse : brakeResponse;
            const desiredForwardSpeed = maxSpeed * this.throttle;
            let finalResponse = response;

            if (this.dashRecoveryTimer > 0) {
                this.dashRecoveryTimer = Math.max(0, this.dashRecoveryTimer - dt);
                if (Math.abs(forwardSpeed) > Math.abs(desiredForwardSpeed) + 0.35) {
                    finalResponse = Math.max(finalResponse, 8.1);
                }
            }

            this.body.applyImpulse({
                x: _moveDir.x * this.mass * finalResponse * dt,
                y: 0,
                z: _moveDir.z * this.mass * finalResponse * dt
            }, true);
        } else {
            const pos = this.body.translation();
            _netPos.set(pos.x, pos.y, pos.z);
            const dist = this.targetPos.distanceTo(_netPos);
            if (dist > 5) {
                this.body.setNextKinematicTranslation(this.targetPos);
            } else {
                this.body.setNextKinematicTranslation({
                    x: THREE.MathUtils.lerp(pos.x, this.targetPos.x, 10 * dt),
                    y: THREE.MathUtils.lerp(pos.y, this.targetPos.y, 10 * dt),
                    z: THREE.MathUtils.lerp(pos.z, this.targetPos.z, 10 * dt)
                });
            }

            this.legYaw = moveTowardsAngle(this.legYaw, this.targetLegYaw, ROTATION.legsTurnRate.medium * dt * 4);
            this.torsoYaw = moveTowardsAngle(this.torsoYaw, this.targetTorsoYaw, ROTATION.torsoTurnRate.medium * dt * 5);
        }

        const pos = this.body.translation();
        this.model.position.set(pos.x, pos.y - 1.5, pos.z);

        this.legs.rotation.y = this.legYaw;
        this.torso.rotation.y = this.torsoYaw;
        this.syncHeroVisual();

        const vel = this.body.linvel();
        this.currentSpeed = new THREE.Vector3(vel.x, 0, vel.z).length();

        if (!this.isLocal || !this.gameCamera) {
            if (this.currentSpeed > 0.5) {
                const freq = (1.2 / this.mass) * Math.min(this.currentSpeed / 10, 1);
                this.walkCycle += dt * freq * Math.PI * 2;

                const stepPhase = (this.walkCycle / Math.PI) % 2;
                if ((stepPhase < 0.1 && this.lastStepPhase >= 1.9) || (stepPhase > 1.0 && this.lastStepPhase <= 1.0)) {
                    sounds.playFootstep(this.mass);

                    const isLeftStep = stepPhase < 0.1;
                    _footOffset.set(isLeftStep ? -0.75 : 0.75, 0, 0);
                    _footOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
                    decals.addFootprint(this.model.position.clone().add(_footOffset), this.legYaw, this.mass);
                }
                this.lastStepPhase = stepPhase;
            } else {
                this.walkCycle = 0;
                this.lastStepPhase = 0;
            }
        } else {
            this.walkCycle = this.gameCamera.walkCycle * Math.PI * 2;
            this.getViewAnchor(_cameraAnchor, this.legYaw);

            this.gameCamera.update(
                _cameraAnchor,
                this.legYaw,
                this.gameCamera.aimYaw,
                this.currentSpeed,
                this.mass,
                dt
            );

            this.gameCamera.onFootstep = () => {
                sounds.playFootstep(this.mass);

                const isLeft = Math.sin(this.gameCamera!.walkCycle * Math.PI * 2) > 0;
                _footOffset.set(isLeft ? -0.75 : 0.75, 0, 0);
                _footOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
                decals.addFootprint(this.model.position.clone().add(_footOffset), this.legYaw, this.mass);
            };
        }

        this.leftLeg.position.z = Math.sin(this.walkCycle) * 1.5;
        this.leftLeg.position.y = 1.5 + Math.max(0, Math.sin(this.walkCycle + Math.PI / 2)) * 0.5;

        this.rightLeg.position.z = Math.sin(this.walkCycle + Math.PI) * 1.5;
        this.rightLeg.position.y = 1.5 + Math.max(0, Math.sin(this.walkCycle - Math.PI / 2)) * 0.5;

        this.leftArm.position.z = Math.sin(this.walkCycle + Math.PI) * 1.0 + this.weaponRecoil.leftArmMount * 0.62;
        this.rightArm.position.z = Math.sin(this.walkCycle) * 1.0 + this.weaponRecoil.rightArmMount * 0.62;
        this.leftArm.rotation.x = -this.weaponRecoil.leftArmMount * 0.24;
        this.rightArm.rotation.x = -this.weaponRecoil.rightArmMount * 0.24;

        this.torso.position.y = 5.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.2;
        this.torso.position.z = this.weaponRecoil.torsoMount * 0.46;
        this.torso.rotation.x = -this.weaponRecoil.torsoMount * 0.14;
        this.pelvis.position.y = 2.0 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.2;
        this.syncHeroVisual();

        this.boiler.scale.set(1 + Math.sin(Date.now() * 0.002) * 0.02, 1, 1 + Math.sin(Date.now() * 0.002) * 0.02);

        return events;
    }

    getState(): GolemState {
        const pos = this.body.translation();
        return {
            pos: new THREE.Vector3(pos.x, pos.y, pos.z),
            legYaw: this.legYaw,
            torsoYaw: this.torsoYaw,
            throttle: this.throttle,
            hp: this.hp,
            maxHp: this.maxHp,
            steam: this.steam,
            maxSteam: this.maxSteam,
            isOverheated: this.isOverheated,
            overheatTimer: this.overheatTimer,
            currentSpeed: this.currentSpeed,
            mass: this.mass,
            sections: { ...this.sections },
            maxSections: { ...this.maxSections },
            weaponStatus: this.getWeaponStatus()
        };
    }
}
