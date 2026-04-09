import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getWeaponDefinition } from '../combat/weapons';
import type { ProjectileProfileId, WeaponId } from '../combat/weaponTypes';
import { GolemFactory } from './GolemFactory';
import type { TeamId } from '../gameplay/types';

const _currentPos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _desiredVelocity = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _botSpreadRight = new THREE.Vector3();
const _botSpreadUp = new THREE.Vector3();
const _botSpreadDir = new THREE.Vector3();
const _botVelocity = new THREE.Vector3();

type BotShot = {
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    weaponId: WeaponId;
    profile: ProjectileProfileId;
    damage: number;
    speed: number;
    range: number;
};

export type BotIntent = 'push' | 'hold' | 'contest' | 'retreat';

export class DummyBot {
    id: string;
    team: TeamId;
    mesh: THREE.Group;
    visual: THREE.Group;
    body: RAPIER.RigidBody;
    hp = 100;
    mat: THREE.MeshStandardMaterial;
    bronzeMaterial: THREE.MeshStandardMaterial;
    boilerMaterial: THREE.MeshStandardMaterial;
    torso: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    boiler: THREE.Mesh;
    damageTimer = 0;
    targetPos = new THREE.Vector3();
    isHost: boolean;
    strafeSign = Math.random() > 0.5 ? 1 : -1;
    strafeTimer = 0.8;
    fireCooldown = 1.2;
    respawnRadius = 62;
    surfaceY?: (x: number, z: number) => number;
    walkCycle = 0;
    maxHp = 100;
    alive = true;
    respawnTimer = 0;
    intent: BotIntent = 'push';

    constructor(
        scene: THREE.Scene,
        physics: RAPIER.World,
        id: string,
        team: TeamId,
        x: number,
        y: number,
        z: number,
        isHost: boolean = true,
        surfaceY?: (x: number, z: number) => number
    ) {
        this.id = id;
        this.team = team;
        this.isHost = isHost;
        this.surfaceY = surfaceY;
        const parts = GolemFactory.create();
        this.mesh = new THREE.Group();
        this.visual = parts.model;
        this.visual.position.y = -1.5;
        this.mesh.add(this.visual);
        this.torso = parts.torso;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
        this.boiler = parts.boiler;
        this.bronzeMaterial = parts.materials.bronze;
        this.mat = parts.materials.rune;
        this.boilerMaterial = parts.materials.boiler;
        this.applyTeamStyle(team);
        this.mesh.position.set(x, y, z);
        this.targetPos.set(x, y, z);
        scene.add(this.mesh);

        const bodyDesc = isHost ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
        bodyDesc.setTranslation(x, y, z).lockRotations();
        this.body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.75, 0.8);
        physics.createCollider(colliderDesc, this.body);
    }

    applyTeamStyle(team: TeamId) {
        if (team === 'blue') {
            this.bronzeMaterial.color.setHex(0x5f5f74);
            this.mat.color.setHex(0x6ad7ff);
            this.mat.emissive.setHex(0x46c6ff);
            this.boilerMaterial.color.setHex(0x69a3ff);
            this.boilerMaterial.emissive.setHex(0x3f8cff);
        } else {
            this.bronzeMaterial.color.setHex(0x845244);
            this.mat.color.setHex(0xff6c52);
            this.mat.emissive.setHex(0xff5d45);
            this.boilerMaterial.color.setHex(0xff8f3b);
            this.boilerMaterial.emissive.setHex(0xff7b29);
        }
        this.mat.emissiveIntensity = 2.3;
        this.boilerMaterial.emissiveIntensity = 1.7;
    }

    queueRespawn(delay: number) {
        this.alive = false;
        this.respawnTimer = delay;
        this.hp = 0;
        this.mesh.visible = false;
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setTranslation({ x: 0, y: -120, z: 0 }, true);
    }

    respawnAt(spawn: { x: number; y: number; z: number }) {
        this.hp = this.maxHp;
        this.alive = true;
        this.respawnTimer = 0;
        this.mesh.visible = true;
        this.targetPos.set(spawn.x, spawn.y, spawn.z);
        this.mesh.position.set(spawn.x, spawn.y, spawn.z);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
        this.fireCooldown = 1.2;
    }

    flashDamage(duration = 0.12) {
        this.damageTimer = Math.max(this.damageTimer, duration);
    }

    setIntent(intent: BotIntent) {
        this.intent = intent;
    }

    getSpreadDirection(baseDir: THREE.Vector3, spread: number) {
        if (spread <= 0.00001) {
            return _botSpreadDir.copy(baseDir);
        }
        const referenceUp = Math.abs(baseDir.y) > 0.92 ? _botSpreadUp.set(1, 0, 0) : _botSpreadUp.set(0, 1, 0);
        _botSpreadRight.crossVectors(baseDir, referenceUp).normalize();
        _botSpreadUp.crossVectors(_botSpreadRight, baseDir).normalize();
        return _botSpreadDir
            .copy(baseDir)
            .addScaledVector(_botSpreadRight, (Math.random() - 0.5) * spread)
            .addScaledVector(_botSpreadUp, (Math.random() - 0.5) * spread)
            .normalize();
    }

    takeDamage(amount: number) {
        if (!this.alive) return 0;
        this.hp -= amount;
        this.flashDamage();
        const remainingHp = Math.max(0, this.hp);
        if (this.hp <= 0) {
            this.queueRespawn(0);
        }
        return remainingHp;
    }

    update(dt: number, moveTarget?: THREE.Vector3, engageTarget?: THREE.Vector3, freeze = false, intent: BotIntent = this.intent) {
        let shot: { shots: BotShot[] } | null = null;

        if (this.respawnTimer > 0) {
            return null;
        }

        if (this.damageTimer > 0) {
            this.damageTimer -= dt;
        }
        const flashRatio = this.damageTimer > 0 ? this.damageTimer / 0.12 : 0;
        this.bronzeMaterial.emissive.setRGB(0.6 * flashRatio, 0.22 * flashRatio, 0.12 * flashRatio);
        this.bronzeMaterial.emissiveIntensity = flashRatio * 1.2;
        this.mat.emissiveIntensity = 2.3 + flashRatio * 0.8;
        this.boilerMaterial.emissiveIntensity = 1.7 + flashRatio * 0.5;
        
        if (!this.alive) {
            return null;
        }

        if (!this.isHost) {
            const currentPos = this.body.translation();
            const dist = this.targetPos.distanceTo(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));
            if (dist > 5) {
                this.body.setNextKinematicTranslation(this.targetPos);
            } else {
                const newPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).lerp(this.targetPos, 0.3);
                this.body.setNextKinematicTranslation(newPos);
            }
        } else if (freeze) {
            const currentVelocity = this.body.linvel();
            this.body.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
        } else if (moveTarget || engageTarget) {
            const maneuverTarget = moveTarget ?? engageTarget;
            const combatTarget = engageTarget;
            const pos = this.body.translation();
            _currentPos.set(pos.x, pos.y, pos.z);
            _toTarget.copy(maneuverTarget ?? _currentPos).sub(_currentPos);
            _toTarget.y = 0;

            const distance = _toTarget.length();
            if (distance > 0.001) {
                _toTarget.divideScalar(distance);
                _strafe.set(-_toTarget.z, 0, _toTarget.x);
                const objectiveMode = !!maneuverTarget && !combatTarget;

                this.strafeTimer -= dt;
                if (this.strafeTimer <= 0) {
                    this.strafeTimer = 1.25 + Math.random() * 1.5;
                    this.strafeSign = Math.random() > 0.5 ? 1 : -1;
                }

                _desiredVelocity.set(0, 0, 0);
                if (objectiveMode) {
                    const objectiveAdvanceDistance = intent === 'retreat' ? 6.5 : intent === 'hold' ? 3.4 : 4.5;
                    const objectiveBackoffDistance = intent === 'retreat' ? 4.8 : 1.8;
                    const objectiveStrafe = intent === 'contest' ? 0.14 : intent === 'retreat' ? 0.1 : 0.22;
                    if (distance > objectiveAdvanceDistance) {
                        _desiredVelocity.add(_toTarget);
                    } else if (distance < objectiveBackoffDistance) {
                        _desiredVelocity.addScaledVector(_toTarget, intent === 'retreat' ? -0.55 : -0.35);
                    }
                    _desiredVelocity.addScaledVector(_strafe, this.strafeSign * objectiveStrafe);
                } else {
                    const preferredFarDistance = intent === 'retreat' ? 30 : intent === 'hold' ? 18 : intent === 'contest' ? 15 : 21;
                    const preferredNearDistance = intent === 'retreat' ? 17 : intent === 'hold' ? 12.5 : intent === 'contest' ? 8.5 : 11;
                    const strafeAmount = intent === 'contest' ? 0.55 : intent === 'retreat' ? 0.68 : intent === 'hold' ? 0.72 : 0.9;
                    if (distance > preferredFarDistance) {
                        _desiredVelocity.add(_toTarget);
                    } else if (distance < preferredNearDistance) {
                        _desiredVelocity.addScaledVector(_toTarget, intent === 'contest' ? -0.55 : -0.9);
                    }
                    _desiredVelocity.addScaledVector(_strafe, this.strafeSign * strafeAmount);
                }

                if (_desiredVelocity.lengthSq() > 0.0001) {
                    const targetSpeed = objectiveMode
                        ? (intent === 'retreat' ? 5.7 : intent === 'hold' ? 5.4 : 6.2)
                        : (intent === 'retreat' ? 7.2 : intent === 'hold' ? 7.6 : intent === 'contest' ? 8.1 : 8.5);
                    _desiredVelocity.normalize().multiplyScalar(targetSpeed);
                }

                const currentVelocity = this.body.linvel();
                this.body.setLinvel({ x: _desiredVelocity.x, y: currentVelocity.y, z: _desiredVelocity.z }, true);

                _aimPoint.copy(combatTarget ?? maneuverTarget ?? _currentPos);
                _aimPoint.y = _currentPos.y;
                this.mesh.rotation.y = -Math.atan2(_aimPoint.x - _currentPos.x, -(_aimPoint.z - _currentPos.z));

                this.fireCooldown -= dt;
                const combatDistance = combatTarget ? combatTarget.distanceTo(_currentPos) : Number.POSITIVE_INFINITY;
                if (combatTarget && this.fireCooldown <= 0 && combatDistance < 58) {
                    const weaponId = intent === 'retreat'
                        ? (combatDistance > 30 ? 'rune_bolt' : 'arc_emitter')
                        : intent === 'hold'
                            ? (combatDistance > 34 ? 'rune_bolt' : combatDistance < 16 ? 'steam_cannon' : 'arc_emitter')
                            : combatDistance < 19
                                ? 'steam_cannon'
                                : combatDistance > 52
                                    ? 'rune_bolt'
                                    : 'arc_emitter';
                    const definition = getWeaponDefinition(weaponId);
                    const baseDir = combatTarget.clone().sub(_currentPos).normalize();
                    const origin = _currentPos.clone().addScaledVector(baseDir, weaponId === 'steam_cannon' ? 1.2 : 1.6);
                    origin.y += 1.25;
                    baseDir.copy(combatTarget).sub(origin).normalize();
                    const shots: BotShot[] = [];

                    for (let index = 0; index < definition.projectileCount; index++) {
                        shots.push({
                            origin: origin.clone(),
                            dir: this.getSpreadDirection(baseDir, definition.spread).clone(),
                            weaponId: definition.id,
                            profile: definition.projectileProfile,
                            damage: definition.damage,
                            speed: definition.projectileSpeed,
                            range: definition.effectiveRange
                        });
                    }

                    shot = { shots };
                    const retreatPenalty = intent === 'retreat' ? 0.12 : 0;
                    this.fireCooldown = definition.cooldown + (weaponId === 'steam_cannon' ? 0.55 : 0.25) + retreatPenalty + Math.random() * 0.35;
                }
            }
        } else {
            const currentVelocity = this.body.linvel();
            this.body.setLinvel({ x: currentVelocity.x * 0.86, y: currentVelocity.y, z: currentVelocity.z * 0.86 }, true);
        }

        const pos = this.body.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
        _botVelocity.set(this.body.linvel().x, 0, this.body.linvel().z);
        const speed = _botVelocity.length();
        if (speed > 0.35) {
            this.walkCycle += dt * Math.min(speed / 5.5, 1.35) * Math.PI * 2;
        } else {
            this.walkCycle = 0;
        }

        const stride = Math.sin(this.walkCycle);
        this.leftLeg.position.z = stride * 1.1;
        this.rightLeg.position.z = -stride * 1.1;
        this.leftArm.position.z = -stride * 0.78;
        this.rightArm.position.z = stride * 0.78;
        this.torso.position.y = 5.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.16;
        this.boiler.scale.set(
            1 + Math.sin((performance.now ? performance.now() : Date.now()) * 0.0025) * 0.02,
            1,
            1 + Math.sin((performance.now ? performance.now() : Date.now()) * 0.0025) * 0.02
        );
        return shot;
    }
}
