import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GolemFactory } from './GolemFactory';
import { angleDiff, moveTowardsAngle } from '../utils/math';
import { GOLEM } from '../utils/constants';
import { ParticleManager } from '../fx/ParticleManager';
import { AudioManager } from '../core/AudioManager';
import { DecalManager } from '../fx/DecalManager';
import { MechCamera } from '../camera/MechCamera';

export interface GolemState {
    pos: THREE.Vector3;
    legYaw: number;
    torsoYaw: number;
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    currentSpeed: number;
    mass: number;
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
    boiler: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    pelvis: THREE.Mesh;
    body: RAPIER.RigidBody;
    isLocal: boolean;
    gameCamera?: MechCamera;
    
    legYaw = 0;
    torsoYaw = 0;
    
    hp = 100;
    maxHp = 100;
    steam = 100;
    maxSteam = 100;
    isOverheated = false;
    overheatTimer = 0;

    mass = 2.0; // 'Вестник' (medium class)
    walkCycle = 0;
    lastStepPhase = 0;
    currentSpeed = 0;

    // Network interpolation
    targetPos = new THREE.Vector3();
    targetLegYaw = 0;
    targetTorsoYaw = 0;

    constructor(scene: THREE.Scene, physics: RAPIER.World, isLocal: boolean = true) {
        this.isLocal = isLocal;
        const parts = GolemFactory.create();
        this.model = parts.model;
        this.legs = parts.legs;
        this.torso = parts.torso;
        this.boiler = parts.boiler;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
        this.pelvis = parts.pelvis;
        scene.add(this.model);

        const bodyDesc = isLocal ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
        bodyDesc.setTranslation(0, 5, 0).lockRotations();
        bodyDesc.setLinearDamping(0.5); // Add some damping for inertia
        this.body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.75, 0.8);
        colliderDesc.setMass(this.mass);
        physics.createCollider(colliderDesc, this.body);
    }

    tryAction(cost: number) {
        if (this.isOverheated) return false;
        if (this.steam < 15 && cost > 0) {
            this.isOverheated = true;
            this.overheatTimer = 3.0;
            return false;
        }
        if (this.steam >= cost) {
            this.steam -= cost;
            return true;
        }
        return false;
    }

    dash() {
        const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
        if (this.isLocal) {
            this.body.applyImpulse({ x: dir.x * 1000, y: 0, z: dir.z * 1000 }, true);
        }
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
        moveX: number, 
        moveZ: number, 
        sounds: AudioManager, 
        decals: DecalManager,
        colliders: THREE.Mesh[] = []
    ): GolemEvents {
        const events: GolemEvents = { dashed: false, vented: false, footstep: false };

        if (this.isOverheated) {
            this.overheatTimer -= dt;
            if (this.overheatTimer <= 0) {
                this.isOverheated = false;
                this.steam = 20;
            }
        } else {
            this.steam = Math.min(this.maxSteam, this.steam + 8 * dt);
        }

        if (this.isLocal) {
            // === ТОРС: фиксированная скорость, не lerp ===
            const torsoMaxSpeed = 1.8; // рад/сек для Вестника
            const torsoStep = torsoMaxSpeed * dt;
            
            let desiredTorsoYaw = aimYawUnclamped;
            
            // Ограничиваем разворот торса относительно ног
            const maxTwist = 1.75;
            let twistFromLegs = angleDiff(this.legYaw, desiredTorsoYaw);
            if (twistFromLegs > maxTwist) desiredTorsoYaw = this.legYaw + maxTwist;
            if (twistFromLegs < -maxTwist) desiredTorsoYaw = this.legYaw - maxTwist;
            
            // Торс доворачивается к цели с ФИКСИРОВАННОЙ скоростью
            this.torsoYaw = moveTowardsAngle(this.torsoYaw, desiredTorsoYaw, torsoStep);
            this.targetTorsoYaw = desiredTorsoYaw; // Для совместимости с остальным кодом

            const maxSpeed = 15;
            const acceleration = 1000; // Force applied
            
            // === НОГИ: ещё медленнее ===
            const legsMaxSpeed = 1.1; // рад/сек
            const legsStep = legsMaxSpeed * dt;

            if (moveZ !== 0 || moveX !== 0) {
                const dir = new THREE.Vector3(moveX, 0, moveZ).normalize();
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.torsoYaw); // Move relative to torso
                
                // Legs rotate towards movement direction
                const targetLegAngle = Math.atan2(dir.x, dir.z);
                
                // Ноги доворачиваются к направлению движения
                this.legYaw = moveTowardsAngle(this.legYaw, targetLegAngle, legsStep);

                // Apply force for acceleration
                const vel = this.body.linvel();
                const currentVel = new THREE.Vector3(vel.x, 0, vel.z);
                if (currentVel.length() < maxSpeed) {
                    this.body.applyImpulse({ x: dir.x * acceleration * this.mass * dt, y: 0, z: dir.z * acceleration * this.mass * dt }, true);
                }
            } else {
                // Deceleration
                const vel = this.body.linvel();
                this.body.applyImpulse({ x: -vel.x * this.mass * 50 * dt, y: 0, z: -vel.z * this.mass * 50 * dt }, true);
                
                // Ноги подтягиваются если прицел ушел слишком далеко (только когда стоим)
                let twistFromAim = angleDiff(this.legYaw, aimYawUnclamped);
                if (Math.abs(twistFromAim) > maxTwist) {
                    this.legYaw = moveTowardsAngle(
                        this.legYaw, aimYawUnclamped, 
                        legsStep * 2 // подтягиваются быстрее
                    );
                }
            }
        } else if (!this.isLocal) {
            // Interpolate towards target state
            const pos = this.body.translation();
            const dist = this.targetPos.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z));
            if (dist > 5) {
                this.body.setNextKinematicTranslation(this.targetPos);
            } else {
                this.body.setNextKinematicTranslation({
                    x: THREE.MathUtils.lerp(pos.x, this.targetPos.x, 10 * dt),
                    y: THREE.MathUtils.lerp(pos.y, this.targetPos.y, 10 * dt),
                    z: THREE.MathUtils.lerp(pos.z, this.targetPos.z, 10 * dt)
                });
            }
            
            // Simple angle lerp
            this.legYaw = THREE.MathUtils.lerp(this.legYaw, this.targetLegYaw, 15 * dt);
            this.torsoYaw = THREE.MathUtils.lerp(this.torsoYaw, this.targetTorsoYaw, 15 * dt);
        }

        const pos = this.body.translation();
        this.model.position.set(pos.x, pos.y - 1.5, pos.z);

        this.legs.rotation.y = this.legYaw;
        this.torso.rotation.y = this.torsoYaw;

        // Animation
        const vel = this.body.linvel();
        this.currentSpeed = new THREE.Vector3(vel.x, 0, vel.z).length();
        
        if (!this.isLocal || !this.gameCamera) {
            if (this.currentSpeed > 0.5) {
                // Frequency based on mass
                const freq = (1.2 / this.mass) * Math.min(this.currentSpeed / 10, 1);
                this.walkCycle += dt * freq * Math.PI * 2;
                
                // Heavy step sound
                const stepPhase = (this.walkCycle / Math.PI) % 2;
                if ((stepPhase < 0.1 && this.lastStepPhase >= 1.9) || (stepPhase > 1.0 && this.lastStepPhase <= 1.0)) {
                    sounds.playFootstep(this.mass);
                    
                    // Add footprint decal
                    const isLeftStep = stepPhase < 0.1;
                    const footOffset = new THREE.Vector3(isLeftStep ? -0.75 : 0.75, 0, 0);
                    footOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
                    const footPos = this.model.position.clone().add(footOffset);
                    decals.addFootprint(footPos, this.legYaw, this.mass);
                }
                this.lastStepPhase = stepPhase;
            } else {
                this.walkCycle = 0;
                this.lastStepPhase = 0;
            }
        } else {
            // Local player with camera: camera handles walk cycle and footsteps
            this.walkCycle = this.gameCamera.walkCycle * Math.PI * 2; // Sync visual animation with camera
            
            const pos = this.body.translation();
            
            this.gameCamera.update(
                new THREE.Vector3(pos.x, pos.y, pos.z),
                this.torsoYaw,                   // камера за торсом
                this.gameCamera.aimYaw,          // прицел для lookAt blend
                this.currentSpeed, 
                this.mass, 
                dt, 
                colliders
            );
            
            // Колбэк шага → звук + след
            this.gameCamera.onFootstep = () => {
                sounds.playFootstep(this.mass);
                
                const isLeft = Math.sin(this.gameCamera!.walkCycle * Math.PI * 2) > 0;
                const footOffset = new THREE.Vector3(isLeft ? -0.75 : 0.75, 0, 0);
                footOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
                const footPos = this.model.position.clone().add(footOffset);
                decals.addFootprint(footPos, this.legYaw, this.mass);
            };
        }

        // Animate parts
        this.leftLeg.position.z = Math.sin(this.walkCycle) * 1.5;
        this.leftLeg.position.y = 1.5 + Math.max(0, Math.sin(this.walkCycle + Math.PI/2)) * 0.5;
        
        this.rightLeg.position.z = Math.sin(this.walkCycle + Math.PI) * 1.5;
        this.rightLeg.position.y = 1.5 + Math.max(0, Math.sin(this.walkCycle - Math.PI/2)) * 0.5;

        this.leftArm.position.z = Math.sin(this.walkCycle + Math.PI) * 1.0;
        this.rightArm.position.z = Math.sin(this.walkCycle) * 1.0;

        this.torso.position.y = 5.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.2;
        this.pelvis.position.y = 2.0 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.2;
        
        // Idle breathing
        this.boiler.scale.set(1 + Math.sin(Date.now() * 0.002) * 0.02, 1, 1 + Math.sin(Date.now() * 0.002) * 0.02);

        return events;
    }

    getState(): GolemState {
        const pos = this.body.translation();
        return {
            pos: new THREE.Vector3(pos.x, pos.y, pos.z),
            legYaw: this.legYaw,
            torsoYaw: this.torsoYaw,
            hp: this.hp,
            maxHp: this.maxHp,
            steam: this.steam,
            maxSteam: this.maxSteam,
            isOverheated: this.isOverheated,
            overheatTimer: this.overheatTimer,
            currentSpeed: this.currentSpeed,
            mass: this.mass
        };
    }
}

