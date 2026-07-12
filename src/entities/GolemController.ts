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
    triggerWeaponRecoilRuntime,
    type WeaponRecoilState
} from '../mechs/runtime/MechWeaponRuntime';
import {
    applyLocalMechDash
} from '../mechs/runtime/LocalMechMovementRuntime';
import {
    syncHeroVisual as syncHeroVisualRuntime
} from '../mechs/runtime/MechVisualDriver';
import type { ChassisDefinition, LoadoutDefinition, SignatureAbilityId } from '../mechs/types';
import { createInitialMechSignatureState, type MechSignatureState } from '../mechs/runtimeTypes';
import {
    cancelSignatureOnMoveForTarget,
    getEffectiveDamageMultiplierForTarget,
    getEffectiveIncomingDamageMultiplierForTarget,
    getEffectiveMoveSpeedMultiplierForTarget,
    tickSignatureForTarget,
    useSignatureForTarget
} from '../mechs/runtime/SignatureControllerRuntime';
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
    tickMechWeaponCooldownsRuntime,
    triggerMechOverheatRuntime
} from '../mechs/runtime/MechStateRuntime';
import { updateGolem } from './golemUpdate';

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
    signatureState: MechSignatureState = createInitialMechSignatureState();

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
        const effectiveDamage = damage * this.getEffectiveIncomingDamageMultiplier();
        return applyMechSectionDamageRuntime(this, section, effectiveDamage, () => this.flashDamage());
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

    getSignatureAbilityId(): SignatureAbilityId | null {
        return this.loadout.signatureAbilityId ?? null;
    }

    useSignatureAbility(particles?: ParticleManager): boolean {
        return useSignatureForTarget(this, particles);
    }

    cancelSignatureOnMove(): boolean {
        return cancelSignatureOnMoveForTarget(this);
    }

    tickSignatureCooldown(dt: number) {
        tickSignatureForTarget(this, dt);
    }

    getEffectiveMoveSpeedMultiplier(): number {
        return getEffectiveMoveSpeedMultiplierForTarget(this);
    }

    getEffectiveDamageMultiplier(): number {
        return getEffectiveDamageMultiplierForTarget(this);
    }

    getEffectiveIncomingDamageMultiplier(): number {
        return getEffectiveIncomingDamageMultiplierForTarget(this);
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
        this.updateWeaponCooldowns(dt);
        this.tickSignatureCooldown(dt);
        return updateGolem({
            golem: this,
            dt,
            aimYawUnclamped,
            throttleInput,
            turnInput,
            centerTorso,
            stopThrottle,
            sounds,
            decals
        });
    }

    getState(): GolemState {
        const pos = this.body.translation();
        return buildMechStateSnapshot(this, pos);
    }

    getMaxSpeed() {
        return this.chassis.topSpeed;
    }
}
