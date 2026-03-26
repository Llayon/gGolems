import * as THREE from 'three';
import { angleDiff } from '../utils/math';
import { CAMERA, WALK, SHAKE } from '../utils/constants';

// Статические объекты — НЕ аллоцируются каждый кадр
const _zero = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

export class MechCamera {
    camera: THREE.PerspectiveCamera;
    
    // --- Углы ---
    aimYaw = 0;          // куда ХОЧЕТ мышь (мгновенно)
    cameraYaw = 0;       // куда смотрит камера (следует за торсом)
    pitch = 0;
    
    // --- Текущие позиции (интерполируемые) ---
    currentPos = new THREE.Vector3();
    currentLookAt = new THREE.Vector3();
    initialized = false;
    
    // --- Покачивание ---
    walkCycle = 0;
    bobAmount = new THREE.Vector3();
    currentRoll = 0;
    
    // --- Детектор шага ---
    lastStepSign = 1;    // для надёжного определения момента шага
    onFootstep: (() => void) | null = null; // колбэк наружу
    
    // --- Тряска ---
    trauma = 0;
    shakeOffset = new THREE.Vector3();
    shakeRotation = 0;
    
    // --- FOV ---
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
        this.pitch = Math.max(CAMERA.pitchMin, Math.min(CAMERA.pitchMax, this.pitch));
    }

    update(
        golemPos: THREE.Vector3, 
        torsoYaw: number,       // реальный угол торса
        aimYawClamped: number,   // прицел (после clamp)
        speed: number, 
        mass: number, 
        dt: number, 
        colliders: THREE.Mesh[]
    ) {
        // Камера следует за ТОРСОМ
        this.cameraYaw = torsoYaw;

        // === 1. Позиция камеры (за спиной торса) ===
        _offset.set(CAMERA.offsetRight, CAMERA.offsetUp, CAMERA.offsetBack);
        _offset.y -= this.pitch * 5; 
        _offset.applyAxisAngle(_yAxis, this.cameraYaw);
        _targetPos.copy(golemPos).add(_offset);

        // === 2. Точка взгляда ===
        // Смешиваем направление торса с прицелом (20% к прицелу)
        const aimOffset = angleDiff(torsoYaw, aimYawClamped);
        const lookYaw = torsoYaw + aimOffset * 0.2;
        
        _targetLookAt.set(
            golemPos.x + Math.sin(lookYaw) * CAMERA.lookForward,
            golemPos.y + CAMERA.lookAbove + this.pitch * 15,
            golemPos.z + Math.cos(lookYaw) * CAMERA.lookForward
        );

        // === 3. Первый кадр — телепорт ===
        if (!this.initialized) {
            this.currentPos.copy(_targetPos);
            this.currentLookAt.copy(_targetLookAt);
            this.initialized = true;
        }

        // === 4. Плавная интерполяция ===
        this.currentPos.lerp(_targetPos, CAMERA.posLerp);
        this.currentLookAt.lerp(_targetLookAt, CAMERA.lookLerp);

        // === 5. Коллизия камеры со стенами ===
        _dir.subVectors(this.currentPos, golemPos).normalize();
        const dist = this.currentPos.distanceTo(golemPos);
        this.raycaster.set(golemPos, _dir);
        const intersects = this.raycaster.intersectObjects(colliders);
        if (intersects.length > 0 && intersects[0].distance < dist) {
            this.currentPos.copy(golemPos).addScaledVector(_dir, intersects[0].distance * 0.8);
        }

        // === 6. Эффекты ===
        this.updateWalkBob(speed, mass, dt);
        this.updateShake(dt);
        this.updateFOV(speed, dt);

        // === 7. Применяем к камере ===
        this.camera.position.copy(this.currentPos);
        this.camera.position.add(this.bobAmount);
        this.camera.position.add(this.shakeOffset);
        
        this.camera.lookAt(this.currentLookAt);
        this.camera.rotateZ(this.currentRoll + this.shakeRotation);
    }

    // Смещение прицела от центра экрана (для HUD)
    getAimScreenOffset(torsoYaw: number): number {
        return angleDiff(torsoYaw, this.aimYaw);
    }

    // ==========================================
    // ПОКАЧИВАНИЕ ПРИ ХОДЬБЕ
    // ==========================================
    
    updateWalkBob(speed: number, mass: number, dt: number) {
        const normalizedSpeed = Math.min(speed / 10, 1);
        
        if (normalizedSpeed > 0.1) {
            // Частота: тяжелее = реже шаги
            const freq = (WALK.stepFrequency / mass) * normalizedSpeed;
            this.walkCycle += freq * dt;  // просто freq * dt, без магических чисел
            
            const phase = this.walkCycle * Math.PI * 2;
            
            // Амплитуды масштабируются массой
            const bobAmp = WALK.bobAmplitude * mass * normalizedSpeed;
            const swayAmp = WALK.swayAmplitude * mass * normalizedSpeed;
            const rollAmp = WALK.rollAmplitude * mass * normalizedSpeed;
            
            // Вертикальный bob: синусоида С ПРОВАЛОМ ВНИЗ
            // sin даёт: вверх → вниз → вверх → вниз
            // Смещаем вниз чтобы "удар" был ниже базовой линии
            const rawBob = Math.sin(phase * 2); // 2 горки за цикл = 2 шага
            this.bobAmount.y = rawBob * bobAmp;
            
            // Дополнительный импульс вниз в момент "удара"
            // Когда sin переходит через минимум — резкий тычок вниз
            const impactWave = Math.max(0, -rawBob); // только отрицательная фаза
            this.bobAmount.y -= impactWave * impactWave * bobAmp * 0.5; // квадратичный импульс
            
            // Горизонтальный sway: 1 волна за цикл (лево-право)
            this.bobAmount.x = Math.sin(phase) * swayAmp;
            
            // Лёгкое ныряние вперёд
            this.bobAmount.z = Math.cos(phase * 2) * bobAmp * 0.2;
            
            // Крен — совпадает с sway
            this.currentRoll = Math.sin(phase) * rollAmp;
            
            // === Детектор шага (надёжный) ===
            // Шаг = когда sin(phase*2) переходит через -1 (нижняя точка)
            const stepSin = Math.sin(phase * 2);
            const currentSign = stepSin >= 0 ? 1 : -1;
            if (currentSign !== this.lastStepSign && currentSign === 1) {
                // Переход из минуса в плюс = момент удара ноги
                this.addTrauma(SHAKE.footstepTrauma * mass * normalizedSpeed);
                this.onFootstep?.();
            }
            this.lastStepSign = currentSign;
            
        } else {
            // Стоим — плавное затухание
            this.bobAmount.lerp(_zero, 0.08);
            this.currentRoll *= 0.92;
            this.walkCycle = 0;
            this.lastStepSign = 1;
        }
    }

    // ==========================================
    // ТРЯСКА
    // ==========================================
    
    addTrauma(amount: number) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    updateShake(dt: number) {
        if (this.trauma > 0.001) {
            // Экспоненциальный decay: сильные удары длятся дольше
            this.trauma *= Math.pow(SHAKE.decayRate, dt * 60);
            // decayRate=0.92, dt=0.016 → trauma *= 0.92^0.96 ≈ 0.923
            // Это frame-rate independent!
            
            const shake = this.trauma * this.trauma; // квадратичная
            
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

    // ==========================================
    // FOV
    // ==========================================
    
    updateFOV(speed: number, dt: number) {
        const speedFOV = this.baseFOV + (speed / 15) * 10;
        this.targetFOV = Math.max(this.targetFOV, speedFOV); // не ниже speed-based
        // targetFOV может быть задан извне (dash, hit) — берём максимум
        
        this.camera.fov += (this.targetFOV - this.camera.fov) * CAMERA.fovLerp;
        this.camera.updateProjectionMatrix();
        
        // Возвращаем targetFOV к speed-based (после dash/hit)
        this.targetFOV += (speedFOV - this.targetFOV) * 0.05;
    }

    // ==========================================
    // ВНЕШНИЕ СОБЫТИЯ
    // ==========================================
    
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