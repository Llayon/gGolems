export const CAMERA = {
    // Позиция
    offsetBack: 12,
    offsetUp: 7,
    offsetRight: 1.5,
    lookAbove: 6.5,
    lookForward: 8,
    
    // FOV
    fov: 55,
    dashFOV: 78,
    hitFOV: 50,
    
    // Чувствительность
    yawSpeed: 0.003,
    pitchSpeed: 0.0015,
    pitchMin: -0.20,
    pitchMax: 0.40,
    
    // Плавность (lerp за кадр)
    posLerp: 0.045,
    lookLerp: 0.07,
    fovLerp: 0.06,
    
    // Макс отклонение прицела от торса
    maxAimLead: 0.5, // ~28°
};

export const WALK = {
    stepFrequency: 1.2,     // базовая частота (Гц) до деления на массу
    bobAmplitude: 0.08,     // вертикальное качание (множится на mass)
    swayAmplitude: 0.04,    // горизонтальное (множится на mass)
    rollAmplitude: 0.005,   // крен в радианах (множится на mass)
};

export const SHAKE = {
    decayRate: 0.92,              // экспоненциальный decay (за кадр при 60fps)
    translationScale: 0.5,        // макс смещение камеры при trauma=1
    rotationScale: 0.03,          // макс вращение камеры при trauma=1
    footstepTrauma: 0.04,         // добавляется при каждом шаге (множится на mass)
    hitTraumaPerDamage: 0.025,    // trauma за единицу урона
    fireTraumaScale: 0.1,         // множитель на вес оружия
};

export const ROTATION = {
    // Скорость доворота (рад/сек)
    torsoTurnRate: {
        light: 2.8,    // Тень
        medium: 1.8,   // Вестник
        heavy: 1.1,    // Страж
    },
    legsTurnRate: {
        light: 1.8,
        medium: 1.1,
        heavy: 0.65,
    },
    maxTorsoTwist: 1.75,  // ~100° макс разворот торса от ног
};

export const GOLEM = {
    classes: {
        light:  { mass: 1.0, hp: 70,  steam: 80,  speed: 14 },
        medium: { mass: 2.0, hp: 100, steam: 100, speed: 10 },
        heavy:  { mass: 3.5, hp: 150, steam: 120, speed: 6  },
    },
    steamRegen: 8,        // в секунду
    overheatThreshold: 15,
    overheatDuration: 3,  // секунд
};

export const PHYSICS = {
    gravity: { x: 0.0, y: -9.81, z: 0.0 }
};

export const NETWORK = {
    tickRate: 20 // Hz
};
