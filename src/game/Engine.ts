import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { NetworkManager } from './NetworkManager';

export class MechSounds {
    ctx: AudioContext | null = null;
    humOsc: OscillatorNode | null = null;
    humGain: GainNode | null = null;
    servoOsc: OscillatorNode | null = null;
    servoGain: GainNode | null = null;
    
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Reactor hum
            this.humOsc = this.ctx.createOscillator();
            this.humOsc.type = 'triangle';
            this.humOsc.frequency.value = 40;
            this.humGain = this.ctx.createGain();
            this.humGain.gain.value = 0.1;
            this.humOsc.connect(this.humGain);
            this.humGain.connect(this.ctx.destination);
            this.humOsc.start();
            
            // Servo whine
            this.servoOsc = this.ctx.createOscillator();
            this.servoOsc.type = 'sawtooth';
            this.servoOsc.frequency.value = 200;
            this.servoGain = this.ctx.createGain();
            this.servoGain.gain.value = 0;
            this.servoOsc.connect(this.servoGain);
            this.servoGain.connect(this.ctx.destination);
            this.servoOsc.start();
        }
    }

    update(torsoTurnSpeed: number) {
        if (!this.ctx || !this.servoGain || !this.servoOsc) return;
        
        const targetGain = Math.min(0.1, Math.abs(torsoTurnSpeed) * 0.05);
        this.servoGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        
        const targetFreq = 200 + Math.abs(torsoTurnSpeed) * 100;
        this.servoOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    playFootstep(mass: number) {
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        
        // Low frequency impact
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        const baseFreq = Math.max(20, 100 - mass * 0.5); // Heavier = lower pitch
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + 0.3);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.3);

        // Noise burst for crunch
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        noise.start(time);
    }
}

export class InputManager {
    keys: Record<string, boolean> = {};
    movementX = 0;
    movementY = 0;
    isLocked = false;
    isMouseDown = false;
    justPressed = false;

    constructor() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.movementX += e.movementX;
                this.movementY += e.movementY;
            }
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.isLocked) {
                this.isMouseDown = true;
                this.justPressed = true;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isMouseDown = false;
        });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement !== null;
        });
    }

    consumeMovement() {
        const mx = this.movementX;
        const my = this.movementY;
        this.movementX = 0;
        this.movementY = 0;
        return { mx, my };
    }

    consumeClick() {
        const clicked = this.justPressed;
        this.justPressed = false;
        return clicked;
    }
    
    consumeKey(code: string) {
        if (this.keys[code]) {
            this.keys[code] = false;
            return true;
        }
        return false;
    }
}

export class Renderer {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.02);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffaa55, 1.5);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        this.scene.add(dirLight);

        window.addEventListener('resize', this.onResize);
    }

    onResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose() {
        window.removeEventListener('resize', this.onResize);
        this.renderer.dispose();
    }
}

export class World {
    meshes: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        this.meshes.push(ground);

        const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        const groundBody = physics.createRigidBody(groundBodyDesc);
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.1, 50);
        physics.createCollider(groundColliderDesc, groundBody);

        this.createBox(scene, physics, 0, 2.5, -20, 40, 5, 2, 0x3a3a45);
        this.createBox(scene, physics, 0, 2.5, 20, 40, 5, 2, 0x3a3a45);
        this.createBox(scene, physics, -20, 2.5, 0, 2, 5, 40, 0x3a3a45);
        this.createBox(scene, physics, 20, 2.5, 0, 2, 5, 40, 0x3a3a45);
        
        this.createBox(scene, physics, -8, 1.5, -8, 4, 3, 4, 0x4a4a55);
        this.createBox(scene, physics, 8, 1.5, 8, 4, 3, 4, 0x4a4a55);
        
        this.addScaleObjects(scene);
    }

    addScaleObjects(scene: THREE.Scene) {
        // Маленькие домики 
        for (let i = 0; i < 8; i++) {
            const house = new THREE.Group();
            
            // Стены (голем = ~8 единиц высотой, дом = ~3)
            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(2, 3, 2),
                new THREE.MeshStandardMaterial({ color: 0x8B7355 })
            );
            walls.position.y = 1.5;
            walls.castShadow = true;
            walls.receiveShadow = true;
            house.add(walls);
            
            // Крыша
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(1.8, 1.5, 4),
                new THREE.MeshStandardMaterial({ color: 0x8B0000 })
            );
            roof.position.y = 3.5;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            roof.receiveShadow = true;
            house.add(roof);
            
            house.position.set(
                (Math.random() - 0.5) * 35,
                0,
                (Math.random() - 0.5) * 35
            );
            scene.add(house);
        }
        
        // Крошечные фигурки людей
        for (let i = 0; i < 20; i++) {
            const person = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.5, 2, 4), // крошечный!
                new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            person.position.set(
                (Math.random() - 0.5) * 35,
                0.4,
                (Math.random() - 0.5) * 35
            );
            person.castShadow = true;
            scene.add(person);
        }
        
        // Деревья (голему по пояс)
        for (let i = 0; i < 15; i++) {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.3, 3, 5),
                new THREE.MeshStandardMaterial({ color: 0x4A3728 })
            );
            trunk.position.y = 1.5;
            trunk.castShadow = true;
            tree.add(trunk);
            
            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 5, 4),
                new THREE.MeshStandardMaterial({ color: 0x2D5A1E })
            );
            leaves.position.y = 3.5;
            leaves.castShadow = true;
            tree.add(leaves);
            
            tree.position.set(
                (Math.random() - 0.5) * 35,
                0,
                (Math.random() - 0.5) * 35
            );
            scene.add(tree);
        }
    }

    createBox(scene: THREE.Scene, physics: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        this.meshes.push(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2);
        physics.createCollider(colliderDesc, body);
    }
}

export class GameCamera {
    camera: THREE.PerspectiveCamera;
    offset = new THREE.Vector3(2, 5, 8); // право, верх, назад
    pitch = 0;
    minPitch = -0.26;  // ~-15°
    maxPitch = 0.52;   // ~+30°
    lerpFactor = 0.1;
    currentPosition = new THREE.Vector3();
    shakeIntensity = 0;
    shakeDecay = 0.9;
    baseFOV = 60;
    targetFOV = 60;
    raycaster = new THREE.Raycaster();

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        this.camera.fov = this.baseFOV;
        this.camera.updateProjectionMatrix();
    }

    update(golemPosition: THREE.Vector3, torsoAngle: number, dt: number, colliders: THREE.Mesh[], currentSpeed: number = 0) {
        const target = new THREE.Vector3();
        target.copy(this.offset);
        
        target.applyAxisAngle(new THREE.Vector3(0, 1, 0), torsoAngle);
        target.add(golemPosition);
        
        target.y += Math.sin(this.pitch) * 3;

        // Add bobbing based on speed
        if (currentSpeed > 0.5) {
            const bobbing = Math.sin(Date.now() * 0.01) * 0.1 * (currentSpeed / 15);
            target.y += bobbing;
        }

        this.currentPosition.lerp(target, this.lerpFactor);
        
        // Raycast от голема к камере для коллизии со стенами
        const dir = new THREE.Vector3().subVectors(this.currentPosition, golemPosition).normalize();
        const dist = this.currentPosition.distanceTo(golemPosition);
        this.raycaster.set(golemPosition, dir);
        
        const intersects = this.raycaster.intersectObjects(colliders);
        if (intersects.length > 0 && intersects[0].distance < dist) {
            this.currentPosition.copy(golemPosition).addScaledVector(dir, intersects[0].distance * 0.8);
        }

        if (this.shakeIntensity > 0.01) {
            this.currentPosition.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.currentPosition.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= this.shakeDecay;
        }
        
        this.camera.position.copy(this.currentPosition);
        
        const lookTarget = golemPosition.clone();
        lookTarget.y += 3;
        
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), torsoAngle);
        lookTarget.addScaledVector(forward, 5);
        
        this.camera.lookAt(lookTarget);
        
        // Dynamic FOV based on speed (unless dashing)
        if (this.targetFOV <= this.baseFOV + 10) {
            this.targetFOV = this.baseFOV + (currentSpeed / 15) * 5;
        }
        
        this.camera.fov += (this.targetFOV - this.camera.fov) * 0.1;
        this.camera.updateProjectionMatrix();
    }

    shake(intensity: number) {
        this.shakeIntensity = intensity;
    }

    dashFOV() {
        this.targetFOV = 75;
        setTimeout(() => { this.targetFOV = this.baseFOV; }, 300);
    }

    onMouseMove(movementY: number) {
        this.pitch -= movementY * 0.002;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    }
}

export class GolemFactory {
    static create() {
        const group = new THREE.Group();
        
        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xCD7F32, metalness: 0.7, roughness: 0.4 });
        const runeMat = new THREE.MeshStandardMaterial({ color: 0x00AAFF, emissive: 0x00AAFF, emissiveIntensity: 2 });
        const boilerMat = new THREE.MeshStandardMaterial({ color: 0xFF6600, emissive: 0xFF6600, emissiveIntensity: 1.5 });

        const legsGroup = new THREE.Group();
        const legGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5);
        const leftLeg = new THREE.Mesh(legGeo, bronzeMat);
        leftLeg.position.set(-0.5, 0.75, 0);
        leftLeg.castShadow = true;
        const rightLeg = new THREE.Mesh(legGeo, bronzeMat);
        rightLeg.position.set(0.5, 0.75, 0);
        rightLeg.castShadow = true;
        legsGroup.add(leftLeg, rightLeg);
        group.add(legsGroup);

        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = 1.5;
        
        const torsoGeo = new THREE.BoxGeometry(1.6, 1.4, 1.2);
        const torso = new THREE.Mesh(torsoGeo, bronzeMat);
        torso.position.y = 0.7;
        torso.castShadow = true;
        torsoGroup.add(torso);

        const headGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
        const head = new THREE.Mesh(headGeo, runeMat);
        head.position.set(0, 1.6, 0.3);
        torsoGroup.add(head);

        const armGeo = new THREE.BoxGeometry(0.4, 1.4, 0.4);
        const leftArm = new THREE.Mesh(armGeo, bronzeMat);
        leftArm.position.set(-1.1, 0.7, 0);
        leftArm.castShadow = true;
        const rightArm = new THREE.Mesh(armGeo, bronzeMat);
        rightArm.position.set(1.1, 0.7, 0);
        rightArm.castShadow = true;
        torsoGroup.add(leftArm, rightArm);

        const boilerGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.0);
        const boiler = new THREE.Mesh(boilerGeo, boilerMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 0.7, -0.8);
        torsoGroup.add(boiler);

        group.add(torsoGroup);

        return { model: group, legs: legsGroup, torso: torsoGroup, boiler, leftLeg, rightLeg, leftArm, rightArm };
    }
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
    body: RAPIER.RigidBody;
    gameCamera: GameCamera | null = null;
    isLocal: boolean;
    
    legYaw = 0;
    torsoYaw = 0;
    
    hp = 100;
    maxHp = 100;
    steam = 100;
    maxSteam = 100;
    isOverheated = false;
    overheatTimer = 0;

    mass = 50;
    walkCycle = 0;
    lastStepPhase = 0;
    currentSpeed = 0;

    // Network interpolation
    targetPos = new THREE.Vector3();
    targetLegYaw = 0;
    targetTorsoYaw = 0;

    constructor(scene: THREE.Scene, physics: RAPIER.World, camera: THREE.PerspectiveCamera | null, isLocal: boolean = true) {
        this.isLocal = isLocal;
        if (camera && isLocal) {
            this.gameCamera = new GameCamera(camera);
        }
        const parts = GolemFactory.create();
        this.model = parts.model;
        this.legs = parts.legs;
        this.torso = parts.torso;
        this.boiler = parts.boiler;
        this.leftLeg = parts.leftLeg;
        this.rightLeg = parts.rightLeg;
        this.leftArm = parts.leftArm;
        this.rightArm = parts.rightArm;
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
            this.body.applyImpulse({ x: dir.x * 40, y: 0, z: dir.z * 40 }, true);
            this.gameCamera?.dashFOV();
        }
    }

    vent(particles: ParticleManager) {
        this.steam = 0;
        if (this.isLocal) this.gameCamera?.shake(0.5);
        const pos = this.body.translation();
        for (let i = 0; i < 30; i++) {
            particles.emit(pos.x + (Math.random() - 0.5) * 4, pos.y + Math.random() * 3, pos.z + (Math.random() - 0.5) * 4);
        }
    }

    update(input: InputManager | null, dt: number, colliders: THREE.Mesh[], sounds: MechSounds, footsteps: FootstepEffect) {
        if (this.isOverheated) {
            this.overheatTimer -= dt;
            if (this.isLocal) this.gameCamera?.shake(0.05);
            if (this.overheatTimer <= 0) {
                this.isOverheated = false;
                this.steam = 20;
            }
        } else {
            this.steam = Math.min(this.maxSteam, this.steam + 8 * dt);
        }

        let moveZ = 0;
        let moveX = 0;

        if (this.isLocal && input) {
            const { mx, my } = input.consumeMovement();
            
            this.targetTorsoYaw -= mx * 0.003;
            this.gameCamera?.onMouseMove(my);

            // Limit torso twist relative to legs
            const maxTwist = Math.PI / 2.5;
            let twist = this.targetTorsoYaw - this.legYaw;
            while (twist > Math.PI) twist -= Math.PI * 2;
            while (twist < -Math.PI) twist += Math.PI * 2;
            if (twist > maxTwist) this.targetTorsoYaw = this.legYaw + maxTwist;
            if (twist < -maxTwist) this.targetTorsoYaw = this.legYaw - maxTwist;

            // Torso catches up to mouse (inertia)
            const torsoTurnSpeed = 10.0;
            this.torsoYaw = THREE.MathUtils.lerp(this.torsoYaw, this.targetTorsoYaw, torsoTurnSpeed * dt);

            if (input.keys['KeyW']) moveZ = -1;
            if (input.keys['KeyS']) moveZ = 1;
            if (input.keys['KeyA']) moveX = -1;
            if (input.keys['KeyD']) moveX = 1;

            const maxSpeed = 15;
            const acceleration = 40; // Force applied
            
            if (moveZ !== 0 || moveX !== 0) {
                const dir = new THREE.Vector3(moveX, 0, moveZ).normalize();
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.torsoYaw); // Move relative to torso
                
                // Legs rotate towards movement direction
                const targetLegAngle = Math.atan2(dir.x, dir.z);
                
                // Shortest path for leg rotation
                let legDiff = targetLegAngle - this.legYaw;
                while (legDiff > Math.PI) legDiff -= Math.PI * 2;
                while (legDiff < -Math.PI) legDiff += Math.PI * 2;
                
                const legTurnSpeed = 3.0;
                this.legYaw += legDiff * legTurnSpeed * dt;

                // Apply force for acceleration
                const vel = this.body.linvel();
                const currentVel = new THREE.Vector3(vel.x, 0, vel.z);
                if (currentVel.length() < maxSpeed) {
                    this.body.applyImpulse({ x: dir.x * acceleration * this.mass * dt, y: 0, z: dir.z * acceleration * this.mass * dt }, true);
                }
            } else {
                // Deceleration
                const vel = this.body.linvel();
                this.body.applyImpulse({ x: -vel.x * this.mass * 2 * dt, y: 0, z: -vel.z * this.mass * 2 * dt }, true);
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
        
        if (this.currentSpeed > 0.5) {
            this.walkCycle += this.currentSpeed * dt * 0.5;
            
            // Heavy step camera shake and sound
            const stepPhase = this.walkCycle % Math.PI;
            if (stepPhase < 0.2 && this.lastStepPhase >= 0.2 && this.currentSpeed > 5) {
                if (this.isLocal) {
                    this.gameCamera?.shake(0.15); // Footstep impact
                }
                sounds.playFootstep(this.mass);
                
                // Add footprint decal
                const isLeftStep = (this.walkCycle % (Math.PI * 2)) < Math.PI;
                const footOffset = new THREE.Vector3(isLeftStep ? -0.5 : 0.5, 0, 0);
                footOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.legYaw);
                const footPos = this.model.position.clone().add(footOffset);
                footsteps.addFootprint(footPos, this.legYaw, this.mass);
            }
            this.lastStepPhase = stepPhase;
        } else {
            this.walkCycle = 0;
            this.lastStepPhase = 0;
        }

        // Animate parts
        this.leftLeg.position.z = Math.sin(this.walkCycle) * 0.8;
        this.leftLeg.position.y = 0.75 + Math.max(0, Math.sin(this.walkCycle + Math.PI/2)) * 0.3;
        
        this.rightLeg.position.z = Math.sin(this.walkCycle + Math.PI) * 0.8;
        this.rightLeg.position.y = 0.75 + Math.max(0, Math.sin(this.walkCycle - Math.PI/2)) * 0.3;

        this.leftArm.position.z = Math.sin(this.walkCycle + Math.PI) * 0.5;
        this.rightArm.position.z = Math.sin(this.walkCycle) * 0.5;

        this.torso.position.y = 1.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.1;
        
        // Idle breathing
        this.boiler.scale.set(1 + Math.sin(Date.now() * 0.002) * 0.02, 1, 1 + Math.sin(Date.now() * 0.002) * 0.02);

        if (this.isLocal) {
            this.gameCamera?.update(this.model.position, this.torsoYaw, dt, colliders, this.currentSpeed);
        }
    }
}

export class FootstepEffect {
    scene: THREE.Scene;
    decals: THREE.Mesh[] = [];
    maxDecals = 50;
    decalGeo: THREE.PlaneGeometry;
    decalMat: THREE.MeshBasicMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.decalGeo = new THREE.PlaneGeometry(1.5, 1.5);
        
        // Create a simple procedural footprint texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(32, 32, 20, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const tex = new THREE.CanvasTexture(canvas);
        this.decalMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.3,
            color: 0x111111,
            depthWrite: false
        });
    }

    addFootprint(pos: THREE.Vector3, yaw: number, mass: number) {
        const mesh = new THREE.Mesh(this.decalGeo, this.decalMat.clone());
        mesh.position.copy(pos);
        mesh.position.y = 0.05; // Slightly above ground
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -yaw;
        
        const scale = 0.5 + mass / 100;
        mesh.scale.set(scale, scale, scale);
        
        this.scene.add(mesh);
        this.decals.push(mesh);
        
        if (this.decals.length > this.maxDecals) {
            const old = this.decals.shift()!;
            this.scene.remove(old);
            (old.material as THREE.Material).dispose();
        }
    }
}

export class ParticleManager {
    system: THREE.Points;
    particles: any[] = [];
    
    constructor(scene: THREE.Scene) {
        const geo = new THREE.BufferGeometry();
        const count = 200;
        const positions = new Float32Array(count * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const mat = new THREE.PointsMaterial({ 
            color: 0xdddddd, 
            size: 0.6, 
            transparent: true, 
            opacity: 0.4,
            depthWrite: false
        });
        
        this.system = new THREE.Points(geo, mat);
        scene.add(this.system);

        for (let i = 0; i < count; i++) {
            this.particles.push({
                active: false,
                life: 0,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3()
            });
        }
    }

    emit(x: number, y: number, z: number) {
        const p = this.particles.find(p => !p.active);
        if (p) {
            p.active = true;
            p.life = 1.0;
            p.pos.set(x, y, z);
            p.vel.set((Math.random() - 0.5) * 1.0, Math.random() * 2 + 2, (Math.random() - 0.5) * 1.0);
        }
    }

    update(dt: number) {
        const positions = this.system.geometry.attributes.position.array as Float32Array;
        let idx = 0;
        for (const p of this.particles) {
            if (p.active) {
                p.life -= dt * 0.8;
                if (p.life <= 0) {
                    p.active = false;
                    positions[idx] = 0;
                    positions[idx+1] = -1000;
                    positions[idx+2] = 0;
                } else {
                    p.pos.addScaledVector(p.vel, dt);
                    positions[idx] = p.pos.x;
                    positions[idx+1] = p.pos.y;
                    positions[idx+2] = p.pos.z;
                }
            }
            idx += 3;
        }
        this.system.geometry.attributes.position.needsUpdate = true;
    }
}

export class ProjectileManager {
    projectiles: { mesh: THREE.Mesh, dir: THREE.Vector3, life: number, active: boolean, ownerId: string }[] = [];
    scene: THREE.Scene;
    geo: THREE.SphereGeometry;
    mat: THREE.MeshStandardMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geo = new THREE.SphereGeometry(0.2, 8, 8);
        this.mat = new THREE.MeshStandardMaterial({ color: 0x00AAFF, emissive: 0x00AAFF, emissiveIntensity: 2 });
    }

    fire(origin: THREE.Vector3, dir: THREE.Vector3, ownerId: string) {
        const mesh = new THREE.Mesh(this.geo, this.mat);
        mesh.position.copy(origin);
        this.scene.add(mesh);
        this.projectiles.push({ mesh, dir: dir.normalize(), life: 2.0, active: true, ownerId });
    }

    update(dt: number) {
        const speed = 60;
        for (const p of this.projectiles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                this.scene.remove(p.mesh);
                continue;
            }
            p.mesh.position.addScaledVector(p.dir, speed * dt);
        }
        this.projectiles = this.projectiles.filter(p => p.active);
    }

    checkCollisions(dummy: DummyBot, players: Map<string, GolemController>, localPlayer: GolemController, localId: string, isHost: boolean, onPlayerHit: (targetId: string, damage: number) => void) {
        const dummyPos = dummy.mesh.position;
        for (const p of this.projectiles) {
            if (!p.active) continue;
            
            // Dummy collision
            if (p.mesh.position.distanceTo(dummyPos) < 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) dummy.takeDamage(15);
                continue;
            }

            // Player collisions
            // Check local player
            if (p.ownerId !== localId && p.mesh.position.distanceTo(localPlayer.model.position) < 2.5) {
                p.active = false;
                this.scene.remove(p.mesh);
                if (isHost) onPlayerHit(localId, 15);
                continue;
            }

            // Check remote players
            let hitRemote = false;
            for (const [pid, player] of players.entries()) {
                if (p.ownerId !== pid && p.mesh.position.distanceTo(player.model.position) < 2.5) {
                    p.active = false;
                    this.scene.remove(p.mesh);
                    if (isHost) onPlayerHit(pid, 15);
                    hitRemote = true;
                    break;
                }
            }
            if (hitRemote) continue;
        }
    }
}

export class DummyBot {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    hp = 100;
    mat: THREE.MeshStandardMaterial;
    damageTimer = 0;
    targetPos = new THREE.Vector3();
    isHost: boolean;

    constructor(scene: THREE.Scene, physics: RAPIER.World, x: number, y: number, z: number, isHost: boolean = true) {
        this.isHost = isHost;
        const geo = new THREE.BoxGeometry(2, 3, 2);
        this.mat = new THREE.MeshStandardMaterial({ color: 0x882222 });
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.position.set(x, y, z);
        this.targetPos.set(x, y, z);
        this.mesh.castShadow = true;
        scene.add(this.mesh);

        const bodyDesc = isHost ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
        bodyDesc.setTranslation(x, y, z).lockRotations();
        this.body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1.5, 1);
        physics.createCollider(colliderDesc, this.body);
    }

    takeDamage(amount: number) {
        this.hp -= amount;
        this.damageTimer = 0.1;
        this.mat.emissive.setHex(0xffffff);
        if (this.hp <= 0) {
            this.hp = 100;
            this.body.setTranslation({ x: (Math.random() - 0.5) * 20, y: 5, z: (Math.random() - 0.5) * 20 }, true);
        }
    }

    update(dt: number) {
        if (this.damageTimer > 0) {
            this.damageTimer -= dt;
            if (this.damageTimer <= 0) {
                this.mat.emissive.setHex(0x000000);
            }
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
        }

        const pos = this.body.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
    }
}

export class Game {
    renderer: Renderer;
    input: InputManager;
    world: World;
    golem: GolemController;
    remotePlayers: Map<string, GolemController> = new Map();
    particles: ParticleManager;
    projectiles: ProjectileManager;
    dummy: DummyBot;
    physics: RAPIER.World;
    network: NetworkManager;
    sounds: MechSounds;
    footsteps: FootstepEffect;
    onStateUpdate: (state: any) => void;
    
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;

    constructor(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void) {
        this.onStateUpdate = onStateUpdate;
        this.renderer = new Renderer(canvas);
        this.input = new InputManager();
        this.network = new NetworkManager();
        this.sounds = new MechSounds();
        this.footsteps = new FootstepEffect(this.renderer.scene);
        
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.physics = new RAPIER.World(gravity);

        this.world = new World(this.renderer.scene, this.physics);
        this.golem = new GolemController(this.renderer.scene, this.physics, this.renderer.camera, true);
        this.particles = new ParticleManager(this.renderer.scene);
        this.projectiles = new ProjectileManager(this.renderer.scene);
        this.dummy = new DummyBot(this.renderer.scene, this.physics, 0, 5, -15);

        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
            this.sounds.init();
        });

        this.setupNetwork();
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            const remoteGolem = new GolemController(this.renderer.scene, this.physics, null, false);
            this.remotePlayers.set(id, remoteGolem);
        };

        this.network.onDisconnect = (id) => {
            console.log("Player disconnected:", id);
            const remoteGolem = this.remotePlayers.get(id);
            if (remoteGolem) {
                this.renderer.scene.remove(remoteGolem.model);
                this.physics.removeRigidBody(remoteGolem.body);
                this.remotePlayers.delete(id);
            }
        };

        this.network.onData = (id, data) => {
            if (data.type === 'state' && !this.network.isHost) {
                // Host sent state to client
                if (data.dummy) {
                    if (this.dummy.hp > data.dummy.hp) {
                        this.dummy.mat.emissive.setHex(0xffffff);
                        this.dummy.damageTimer = 0.1;
                    }
                    this.dummy.hp = data.dummy.hp;
                    this.dummy.targetPos.set(data.dummy.x, data.dummy.y, data.dummy.z);
                }
                
                if (data.players) {
                    // Remove players that are no longer in the state
                    for (const pid of this.remotePlayers.keys()) {
                        if (!data.players[pid]) {
                            const remoteGolem = this.remotePlayers.get(pid);
                            if (remoteGolem) {
                                this.renderer.scene.remove(remoteGolem.model);
                                this.physics.removeRigidBody(remoteGolem.body);
                                this.remotePlayers.delete(pid);
                            }
                        }
                    }

                    for (const pid in data.players) {
                        const pState = data.players[pid];
                        
                        if (pid === this.network.myId) {
                            // Update my own HP from Host
                            if (pState.hp !== undefined) {
                                if (this.golem.hp > pState.hp) {
                                    this.golem.gameCamera?.shake(0.5); // I took damage
                                }
                                this.golem.hp = pState.hp;
                            }
                            continue;
                        }
                        
                        let remoteGolem = this.remotePlayers.get(pid);
                        if (!remoteGolem) {
                            remoteGolem = new GolemController(this.renderer.scene, this.physics, null, false);
                            this.remotePlayers.set(pid, remoteGolem);
                        }
                        
                        remoteGolem.targetPos.set(pState.x, pState.y, pState.z);
                        remoteGolem.targetLegYaw = pState.ly;
                        remoteGolem.targetTorsoYaw = pState.ty;
                        if (pState.hp !== undefined) remoteGolem.hp = pState.hp;
                    }
                }
            } else if (data.type === 'input' && this.network.isHost) {
                // Client sent input to Host
                const remoteGolem = this.remotePlayers.get(id);
                if (remoteGolem) {
                    // Apply client inputs (simplified)
                    remoteGolem.targetLegYaw = data.ly;
                    remoteGolem.targetTorsoYaw = data.ty;
                    remoteGolem.targetPos.set(data.pos.x, data.pos.y, data.pos.z);
                }
            } else if (data.type === 'respawn') {
                this.golem.body.setTranslation({ x: data.x, y: data.y, z: data.z }, true);
                this.golem.hp = this.golem.maxHp;
                this.golem.gameCamera?.shake(1.0); // Big shake on respawn
            } else if (data.type === 'fire') {
                if (id !== this.network.myId) {
                    const origin = new THREE.Vector3(data.ox, data.oy, data.oz);
                    const dir = new THREE.Vector3(data.dx, data.dy, data.dz);
                    this.projectiles.fire(origin, dir, data.ownerId);
                    
                    // If Host receives fire from client, forward to other clients
                    if (this.network.isHost) {
                        this.network.connections.forEach((conn, peerId) => {
                            if (peerId !== id) conn.send(data);
                        });
                    }
                }
            }
        };
    }

    setClientMode() {
        this.dummy.isHost = false;
        this.dummy.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);
        this.renderer.dispose();
    }

    loop = (time: number) => {
        if (!this.isRunning) return;
        this.animationFrameId = requestAnimationFrame(this.loop);

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.physics.step();
        this.golem.update(this.input, dt, this.world.meshes, this.sounds, this.footsteps);
        
        // Calculate torso turn speed for sounds
        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);
        
        this.remotePlayers.forEach(player => {
            player.update(null, dt, this.world.meshes, this.sounds, this.footsteps);
        });

        this.dummy.update(dt);
        this.projectiles.update(dt);
        
        if (this.input.consumeClick()) {
            if (this.golem.tryAction(5)) {
                const origin = new THREE.Vector3();
                this.golem.torso.getWorldPosition(origin);
                origin.y += 0.5;
                
                const dir = new THREE.Vector3(0, 0, -1);
                dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.golem.gameCamera!.pitch);
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.golem.torsoYaw);
                
                origin.addScaledVector(dir, 2.0);
                
                this.projectiles.fire(origin, dir, this.network.myId);
                
                // Broadcast fire event
                this.network.broadcast({
                    type: 'fire',
                    ownerId: this.network.myId,
                    ox: origin.x, oy: origin.y, oz: origin.z,
                    dx: dir.x, dy: dir.y, dz: dir.z
                });
            }
        }
        
        if (this.input.consumeKey('ShiftLeft')) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
            }
        }
        
        if (this.input.consumeKey('Space')) {
            if (this.golem.tryAction(0)) {
                this.golem.vent(this.particles);
            }
        }

        this.projectiles.checkCollisions(
            this.dummy, 
            this.remotePlayers, 
            this.golem, 
            this.network.myId, 
            this.network.isHost,
            (targetId, damage) => {
                if (targetId === this.network.myId) {
                    this.golem.hp -= damage;
                    this.golem.gameCamera?.shake(0.5);
                    if (this.golem.hp <= 0) {
                        this.golem.hp = this.golem.maxHp;
                        this.golem.body.setTranslation({ x: (Math.random() - 0.5) * 40, y: 5, z: (Math.random() - 0.5) * 40 }, true);
                    }
                } else {
                    const p = this.remotePlayers.get(targetId);
                    if (p) {
                        p.hp -= damage;
                        if (p.hp <= 0) {
                            p.hp = p.maxHp;
                            const rx = (Math.random() - 0.5) * 40;
                            const rz = (Math.random() - 0.5) * 40;
                            p.body.setTranslation({ x: rx, y: 5, z: rz }, true);
                            this.network.sendTo(targetId, { type: 'respawn', x: rx, y: 5, z: rz });
                        }
                    }
                }
            }
        );
        
        const boilerPos = new THREE.Vector3();
        this.golem.boiler.getWorldPosition(boilerPos);
        this.particles.emit(boilerPos.x, boilerPos.y + 0.5, boilerPos.z);
        this.particles.update(dt);

        // Network synchronization (20 Hz)
        this.networkTickTimer += dt;
        if (this.networkTickTimer >= 0.05) {
            this.networkTickTimer = 0;
            
            const pos = this.golem.body.translation();
            
            if (this.network.isHost) {
                // Host broadcasts all states
                const playersState: any = {};
                playersState[this.network.myId] = {
                    x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)),
                    ly: Number(this.golem.legYaw.toFixed(2)), ty: Number(this.golem.torsoYaw.toFixed(2)),
                    hp: this.golem.hp
                };
                
                this.remotePlayers.forEach((player, id) => {
                    const pPos = player.body.translation();
                    playersState[id] = {
                        x: Number(pPos.x.toFixed(2)), y: Number(pPos.y.toFixed(2)), z: Number(pPos.z.toFixed(2)),
                        ly: Number(player.legYaw.toFixed(2)), ty: Number(player.torsoYaw.toFixed(2)),
                        hp: player.hp
                    };
                });
                
                this.network.broadcast({ 
                    type: 'state', 
                    players: playersState,
                    dummy: { x: this.dummy.mesh.position.x, y: this.dummy.mesh.position.y, z: this.dummy.mesh.position.z, hp: this.dummy.hp }
                });
            } else {
                // Client sends input/position to Host
                this.network.sendToHost({
                    type: 'input',
                    pos: { x: pos.x, y: pos.y, z: pos.z },
                    ly: this.golem.legYaw,
                    ty: this.golem.torsoYaw
                });
            }
        }

        this.onStateUpdate({
            hp: this.golem.hp,
            maxHp: this.golem.maxHp,
            steam: this.golem.steam,
            maxSteam: this.golem.maxSteam,
            isOverheated: this.golem.isOverheated,
            overheatTimer: this.golem.overheatTimer
        });

        this.renderer.render();
    }
}

export async function initGame(canvas: HTMLCanvasElement, onStateUpdate: (state: any) => void) {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate);
    game.start();
    return game;
}
