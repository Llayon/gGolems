import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GolemFactory } from './GolemFactory';
import { GOLEM } from '../utils/constants';
import { ParticleManager } from '../fx/ParticleManager';
import { AudioManager } from '../core/AudioManager';
import { DecalManager } from '../fx/DecalManager';
import { MechCamera } from '../camera/MechCamera';
import type { WeaponFireRequest, WeaponGroupId, WeaponId, WeaponMountId, WeaponMountRuntime, WeaponStatusView } from '../combat/weaponTypes';
import { createKWIIRuntimeVisual, type KWIIRuntimeVisual } from './KWIIRuntimeAsset';
import type { GolemControllerOptions, GolemEvents, GolemState } from './GolemControllerTypes';
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
import {
    createWeaponMountRuntimeState,
    createWeaponRecoilState,
    findWeaponMountId,
    resolveWeaponMuzzleOrigin,
    tickWeaponRecoilState,
    triggerWeaponRecoilRuntime,
    type WeaponRecoilState
} from '../mechs/runtime/MechWeaponRuntime';
import {
    applyLocalMechDash,
    updateLocalMechMovement
} from '../mechs/runtime/LocalMechMovementRuntime';
import { updateMechCameraAndFootsteps } from '../mechs/runtime/MechCameraFootstepRuntime';
import {
    applyProceduralMechPose,
    syncHeroVisual as syncHeroVisualRuntime
} from '../mechs/runtime/MechVisualDriver';
import { applyRemoteMechReplication } from '../mechs/runtime/RemoteMechReplicationRuntime';
import type { ChassisDefinition, LoadoutDefinition } from '../mechs/types';
import {
    applyMechSectionDamageRuntime,
    applyMechSectionStateRuntime,
    buildMechStateSnapshot,
    buildMechWeaponStatusRuntime,
    canMechFireRuntime,
    gatherReadyWeaponMountsRuntime,
    resetMechDamageAndWeaponsRuntime,
    spendMechSteamRuntime,
    syncMechDamageRuntime,
    syncMechSectionVisualsRuntime,
    tickMechHeatStateRuntime,
    tickMechWeaponCooldownsRuntime,
    triggerMechOverheatRuntime
} from '../mechs/runtime/MechStateRuntime';

const _currentVel = new THREE.Vector3();
export type { GolemSection, GolemSectionState } from '../mechs/sections';
export { GOLEM_SECTION_ORDER } from '../mechs/sections';
export type { GolemControllerOptions, GolemEvents, GolemState } from './GolemControllerTypes';

const DEFAULT_CHASSIS = getChassisDefinition(DEFAULT_CHASSIS_ID);
const DEFAULT_LOADOUT = getDefaultLoadoutForChassis(DEFAULT_CHASSIS_ID);

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
        this.syncDamageState();
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

    triggerOverheat(duration = GOLEM.overheatDuration) {
        triggerMechOverheatRuntime(this, duration);
    }

    spendSteam(cost: number) {
        return spendMechSteamRuntime(this, cost);
    }

    updateWeaponCooldowns(dt: number) {
        tickMechWeaponCooldownsRuntime(this, dt);
    }

    flashDamage(duration = 0.16) {
        this.damageFlashTimer = Math.max(this.damageFlashTimer, duration);
    }

    applySectionVisuals() {
        syncMechSectionVisualsRuntime(this);
    }

    syncDamageState() {
        syncMechDamageRuntime(this);
    }

    setSectionState(nextSections: Partial<GolemSectionState>) {
        applyMechSectionStateRuntime(this, nextSections);
    }

    resetSections() {
        resetMechDamageAndWeaponsRuntime(this);
    }

    applySectionDamage(section: GolemSection, damage: number) {
        return applyMechSectionDamageRuntime(this, section, damage, () => this.flashDamage());
    }

    canFire() {
        return canMechFireRuntime(this);
    }

    tryAction(cost: number) {
        return this.spendSteam(cost);
    }

    getWeaponStatus(): WeaponStatusView[] {
        return buildMechWeaponStatusRuntime(this);
    }

    getWeaponMuzzleOrigin(mountId: WeaponMountId, out: THREE.Vector3) {
        return resolveWeaponMuzzleOrigin(this, mountId, out);
    }

    getMountIdForWeapon(weaponId: WeaponId): WeaponMountId {
        return findWeaponMountId(this, weaponId);
    }

    triggerWeaponRecoil(mountId: WeaponMountId) {
        triggerWeaponRecoilRuntime(this, mountId);
    }

    gatherReadyMounts(groupId?: WeaponGroupId) {
        return gatherReadyWeaponMountsRuntime(this, groupId, GOLEM.overheatDuration);
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

        tickMechHeatStateRuntime(this, dt);

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

        const cameraAndFootsteps = updateMechCameraAndFootsteps({
            isLocal: this.isLocal,
            gameCamera: this.gameCamera ?? null,
            heroVisual: this.heroVisual,
            torso: this.torso,
            modelPosition: this.model.position,
            legYaw: this.legYaw,
            currentSpeed: this.currentSpeed,
            mass: this.mass,
            walkCycle: this.walkCycle,
            lastStepPhase: this.lastStepPhase,
            dt,
            sounds,
            decals
        });
        this.walkCycle = cameraAndFootsteps.walkCycle;
        this.lastStepPhase = cameraAndFootsteps.lastStepPhase;
        events.footstep = cameraAndFootsteps.footstepTriggered;

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
        return buildMechStateSnapshot(this, pos);
    }

    getMaxSpeed() {
        return this.chassis.topSpeed;
    }
}
