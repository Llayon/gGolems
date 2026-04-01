import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GolemFactory } from './GolemFactory';
import { GOLEM } from '../utils/constants';
import { ParticleManager } from '../fx/ParticleManager';
import { AudioManager } from '../core/AudioManager';
import { DecalManager } from '../fx/DecalManager';
import { MechCamera } from '../camera/MechCamera';
import { getWeaponDefinition } from '../combat/weapons';
import type { WeaponFireRequest, WeaponGroupId, WeaponId, WeaponMountId, WeaponMountRuntime, WeaponStatusView } from '../combat/weaponTypes';
import { createKWIIRuntimeVisual, type KWIIRuntimeVisual } from './KWIIRuntimeAsset';
import {
    DEFAULT_CHASSIS_ID,
    getChassisDefinition,
    getDefaultLoadoutForChassis,
    getLoadoutDefinition
} from '../mechs/definitions';
import {
    cloneSectionState,
    type GolemSection,
    type GolemSectionState
} from '../mechs/sections';
import type { MechHeatState } from '../mechs/runtimeTypes';
import {
    applySectionDamageState,
    applySectionStatePatch,
    computeSectionTotals,
    resetSectionState
} from '../mechs/rules/sectionRules';
import {
    spendSteamState,
    tickSteamState,
    triggerOverheatState
} from '../mechs/rules/steamRules';
import {
    buildMountAvailabilityPatch,
    buildWeaponCooldownPatch,
    buildWeaponFireCooldownPatch,
    buildWeaponStatusViews,
    canAnyWeaponFire,
    evaluateReadyWeaponMounts
} from '../mechs/rules/weaponRules';
import {
    buildWeaponFireRequests,
    createWeaponMountRuntimeState,
    createWeaponRecoilState,
    resetWeaponRuntimeState,
    tickWeaponRecoilState,
    type WeaponRecoilState
} from '../mechs/runtime/MechWeaponRuntime';
import {
    applyLocalMechDash,
    updateLocalMechMovement
} from '../mechs/runtime/LocalMechMovementRuntime';
import {
    applyProceduralMechPose,
    applyProceduralSectionVisuals,
    getThirdPersonAnchor as getThirdPersonAnchorRuntime,
    getViewAnchor as getViewAnchorRuntime,
    syncHeroVisual as syncHeroVisualRuntime
} from '../mechs/runtime/MechVisualDriver';
import { applyRemoteMechReplication } from '../mechs/runtime/RemoteMechReplicationRuntime';
import type { ChassisDefinition, ChassisId, LoadoutDefinition, LoadoutId } from '../mechs/types';

const _currentVel = new THREE.Vector3();
const _cameraAnchor = new THREE.Vector3();
const _footOffset = new THREE.Vector3();
const _muzzleOffset = new THREE.Vector3();

export type { GolemSection, GolemSectionState } from '../mechs/sections';
export { GOLEM_SECTION_ORDER } from '../mechs/sections';

const DEFAULT_CHASSIS = getChassisDefinition(DEFAULT_CHASSIS_ID);
const DEFAULT_LOADOUT = getDefaultLoadoutForChassis(DEFAULT_CHASSIS_ID);

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

export interface GolemControllerOptions {
    chassisId?: ChassisId;
    loadoutId?: LoadoutId;
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
    heroVisual: KWIIRuntimeVisual | null = null;
    chassis: ChassisDefinition = DEFAULT_CHASSIS;
    loadout: LoadoutDefinition = DEFAULT_LOADOUT;
    sections: GolemSectionState = cloneSectionState(DEFAULT_CHASSIS.sectionMax);
    maxSections: GolemSectionState = cloneSectionState(DEFAULT_CHASSIS.sectionMax);
    weaponMountOrder: WeaponMountId[] = DEFAULT_CHASSIS.mountLayout.map((slot) => slot.mountId);
    weaponMounts: Record<WeaponMountId, WeaponMountRuntime>;
    weaponRecoil: WeaponRecoilState = createWeaponRecoilState();

    legYaw = 0;
    torsoYaw = 0;

    hp = 100;
    maxHp = 100;
    steam = DEFAULT_CHASSIS.maxSteam;
    maxSteam = DEFAULT_CHASSIS.maxSteam;
    isOverheated = false;
    overheatTimer = 0;

    mass = DEFAULT_CHASSIS.mass;
    throttle = 0;
    walkCycle = 0;
    heroStrideCycle = 0;
    lastStepPhase = 0;
    currentSpeed = 0;
    damageFlashTimer = 0;
    dashRecoveryTimer = 0;

    targetPos = new THREE.Vector3();
    targetLegYaw = 0;
    targetTorsoYaw = 0;

    constructor(scene: THREE.Scene, physics: RAPIER.World, isLocal: boolean = true, options: GolemControllerOptions = {}) {
        const chassis = getChassisDefinition(options.chassisId ?? DEFAULT_CHASSIS_ID);
        const loadout = getLoadoutDefinition(options.loadoutId ?? chassis.defaultLoadoutId);
        if (loadout.chassisId !== chassis.id) {
            throw new Error(`Loadout "${loadout.id}" does not belong to chassis "${chassis.id}".`);
        }

        this.chassis = chassis;
        this.loadout = loadout;
        this.sections = cloneSectionState(chassis.sectionMax);
        this.maxSections = cloneSectionState(chassis.sectionMax);
        const weaponRuntimeState = createWeaponMountRuntimeState(chassis, loadout);
        this.weaponMountOrder = weaponRuntimeState.mountOrder;
        this.weaponRecoil = createWeaponRecoilState();
        this.mass = chassis.mass;
        this.maxSteam = chassis.maxSteam;
        this.steam = chassis.maxSteam;
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
        this.weaponMounts = weaponRuntimeState.mounts;
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
        if (isLocal) {
            void this.initHeroVisual();
        }
    }

    async initHeroVisual() {
        const heroVisual = await createKWIIRuntimeVisual();
        if (!heroVisual) return;

        this.heroVisual = heroVisual;
        this.model.add(heroVisual.root);
        this.pelvis.visible = false;
        this.legs.visible = false;
        this.torso.visible = false;
        this.syncHeroVisual(0);
        this.applySectionVisuals();
    }

    getHeatState(): MechHeatState {
        return {
            steam: this.steam,
            maxSteam: this.maxSteam,
            isOverheated: this.isOverheated,
            overheatTimer: this.overheatTimer
        };
    }

    applyHeatState(nextState: MechHeatState) {
        this.steam = nextState.steam;
        this.maxSteam = nextState.maxSteam;
        this.isOverheated = nextState.isOverheated;
        this.overheatTimer = nextState.overheatTimer;
    }

    applyWeaponCooldownPatch(patch: Partial<Record<WeaponMountId, number>>) {
        for (const mountId of this.weaponMountOrder) {
            const nextCooldown = patch[mountId];
            if (typeof nextCooldown === 'number') {
                this.weaponMounts[mountId].cooldownRemaining = nextCooldown;
            }
        }
    }

    applyWeaponEnabledPatch(patch: Partial<Record<WeaponMountId, boolean>>) {
        for (const mountId of this.weaponMountOrder) {
            const nextEnabled = patch[mountId];
            if (typeof nextEnabled === 'boolean') {
                this.weaponMounts[mountId].enabled = nextEnabled;
            }
        }
    }

    triggerOverheat(duration = GOLEM.overheatDuration) {
        this.applyHeatState(triggerOverheatState(this.getHeatState(), duration));
    }

    spendSteam(cost: number) {
        const result = spendSteamState(this.getHeatState(), cost);
        this.applyHeatState(result.nextState);
        return result.success;
    }

    updateWeaponCooldowns(dt: number) {
        this.applyWeaponCooldownPatch(buildWeaponCooldownPatch(this.weaponMounts, this.weaponMountOrder, dt));
    }

    syncMountAvailabilityFromSections() {
        this.applyWeaponEnabledPatch(buildMountAvailabilityPatch(this.weaponMounts, this.weaponMountOrder, this.sections));
    }

    flashDamage(duration = 0.16) {
        this.damageFlashTimer = Math.max(this.damageFlashTimer, duration);
    }

    syncAggregateHp() {
        const totals = computeSectionTotals(this.sections, this.maxSections);
        this.hp = totals.hp;
        this.maxHp = totals.maxHp;
    }

    setSectionState(nextSections: Partial<GolemSectionState>) {
        this.sections = applySectionStatePatch(this.sections, nextSections);
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
    }

    resetSections() {
        this.sections = resetSectionState(this.maxSections);
        resetWeaponRuntimeState(this.weaponMounts, this.weaponRecoil, this.weaponMountOrder);
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        this.syncAggregateHp();
    }

    applySectionVisuals() {
        applyProceduralSectionVisuals({
            heroVisual: this.heroVisual,
            head: this.head,
            leftArm: this.leftArm,
            rightArm: this.rightArm,
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            sections: this.sections
        });
    }

    applySectionDamage(section: GolemSection, damage: number) {
        const result = applySectionDamageState(this.sections, this.maxSections, section, damage);
        this.sections = result.nextSections;
        this.hp = result.hp;
        this.maxHp = result.maxHp;
        this.flashDamage();
        this.applySectionVisuals();
        this.syncMountAvailabilityFromSections();
        return {
            section: result.section,
            remaining: result.remaining,
            destroyed: result.destroyed,
            lethal: result.lethal,
            totalHp: result.hp
        };
    }

    canFire() {
        return canAnyWeaponFire(this.weaponMounts, this.weaponMountOrder, this.getHeatState());
    }

    tryAction(cost: number) {
        return this.spendSteam(cost);
    }

    getWeaponStatus(): WeaponStatusView[] {
        return buildWeaponStatusViews(this.weaponMounts, this.weaponMountOrder, this.getHeatState());
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

    getMountIdForWeapon(weaponId: WeaponId): WeaponMountId {
        return this.weaponMountOrder.find((mountId) => this.weaponMounts[mountId].weaponId === weaponId) ?? 'torsoMount';
    }

    triggerWeaponRecoil(mountId: WeaponMountId) {
        this.weaponRecoil[mountId] = 1;
        const fireAction = this.heroVisual?.actions.fire;
        if (fireAction) {
            fireAction.stop();
            fireAction.reset();
            fireAction.play();
        }
    }

    gatherReadyMounts(groupId?: WeaponGroupId) {
        const evaluation = evaluateReadyWeaponMounts(
            this.weaponMounts,
            this.weaponMountOrder,
            this.getHeatState(),
            groupId
        );

        if (evaluation.blockedReason === 'noReadyMounts' || evaluation.blockedReason === 'overheated') {
            return [];
        }

        if (evaluation.blockedReason === 'insufficientSteam') {
            this.triggerOverheat();
            return [];
        }

        if (!this.spendSteam(evaluation.totalHeat)) {
            return [];
        }

        this.applyWeaponCooldownPatch(buildWeaponFireCooldownPatch(this.weaponMounts, evaluation.mountIds));

        return buildWeaponFireRequests(this.weaponMounts, evaluation.mountIds);
    }

    tryFireGroup(groupId: WeaponGroupId) {
        return this.gatherReadyMounts(groupId);
    }

    tryFireAlpha() {
        return this.gatherReadyMounts();
    }

    dash() {
        if (this.isLocal) {
            applyLocalMechDash({
                body: this.body,
                chassis: this.chassis,
                legYaw: this.legYaw,
                throttle: this.throttle
            });
            this.dashRecoveryTimer = 0.24;
        }
    }

    getViewAnchor(out: THREE.Vector3, facingYaw = this.torsoYaw) {
        return getViewAnchorRuntime(this.torso, out, facingYaw);
    }

    getThirdPersonAnchor(out: THREE.Vector3) {
        return getThirdPersonAnchorRuntime(this.heroVisual, this.torso, out);
    }

    syncHeroVisual(dt: number) {
        this.heroStrideCycle = syncHeroVisualRuntime({
            heroVisual: this.heroVisual,
            throttle: this.throttle,
            currentSpeed: this.currentSpeed,
            topSpeed: this.chassis.topSpeed,
            legYaw: this.legYaw,
            torsoYaw: this.torsoYaw,
            weaponRecoil: this.weaponRecoil,
            heroStrideCycle: this.heroStrideCycle
        }, dt);
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
        tickWeaponRecoilState(this.weaponRecoil, this.weaponMountOrder, dt);
        const flashRatio = this.damageFlashTimer > 0 ? this.damageFlashTimer / 0.16 : 0;
        const flashIntensity = flashRatio * 1.6;
        this.bronzeMaterial.emissive.setRGB(0.55 * flashRatio, 0.42 * flashRatio, 0.18 * flashRatio);
        this.bronzeMaterial.emissiveIntensity = flashIntensity;
        this.runeMaterial.emissiveIntensity = 2 + flashIntensity * 0.6;
        this.boilerMaterial.emissiveIntensity = 1.5 + flashIntensity * 0.35;

        this.applyHeatState(tickSteamState(this.getHeatState(), dt));

        if (this.isLocal) {
            const localMovement = updateLocalMechMovement({
                body: this.body,
                chassis: this.chassis,
                sections: this.sections,
                maxSections: this.maxSections,
                dt,
                aimYawUnclamped,
                cameraAimYaw: this.gameCamera?.aimYaw ?? null,
                throttleInput,
                turnInput,
                centerTorso,
                stopThrottle,
                legYaw: this.legYaw,
                torsoYaw: this.torsoYaw,
                throttle: this.throttle,
                dashRecoveryTimer: this.dashRecoveryTimer
            });

            this.legYaw = localMovement.legYaw;
            this.torsoYaw = localMovement.torsoYaw;
            this.targetTorsoYaw = localMovement.targetTorsoYaw;
            this.throttle = localMovement.throttle;
            this.dashRecoveryTimer = localMovement.dashRecoveryTimer;
            if (this.gameCamera && typeof localMovement.cameraAimYaw === 'number') {
                this.gameCamera.aimYaw = localMovement.cameraAimYaw;
            }
        } else {
            const replicatedState = applyRemoteMechReplication({
                body: this.body,
                targetPos: this.targetPos,
                targetLegYaw: this.targetLegYaw,
                targetTorsoYaw: this.targetTorsoYaw,
                legYaw: this.legYaw,
                torsoYaw: this.torsoYaw,
                weightClass: this.chassis.weightClass
            }, dt);

            this.legYaw = replicatedState.legYaw;
            this.torsoYaw = replicatedState.torsoYaw;
        }

        const pos = this.body.translation();
        this.model.position.set(pos.x, pos.y - 1.5, pos.z);

        this.legs.rotation.y = -this.legYaw;
        this.torso.rotation.y = -this.torsoYaw;

        const vel = this.body.linvel();
        _currentVel.set(vel.x, 0, vel.z);
        this.currentSpeed = _currentVel.length();

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
            if (this.gameCamera.mode === 'thirdPerson') {
                this.getThirdPersonAnchor(_cameraAnchor);
            } else {
                this.getViewAnchor(_cameraAnchor, this.legYaw);
            }

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

        applyProceduralMechPose({
            walkCycle: this.walkCycle,
            weaponRecoil: this.weaponRecoil,
            leftLeg: this.leftLeg,
            rightLeg: this.rightLeg,
            leftArm: this.leftArm,
            rightArm: this.rightArm,
            torso: this.torso,
            pelvis: this.pelvis,
            boiler: this.boiler
        });
        this.syncHeroVisual(dt);

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

    getMaxSpeed() {
        return this.chassis.topSpeed;
    }
}
