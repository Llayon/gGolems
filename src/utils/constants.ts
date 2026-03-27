export const CAMERA = {
    lookForward: 11,

    // FOV
    fov: 58,
    dashFOV: 64,
    hitFOV: 54,

    // Input sensitivity
    yawSpeed: 0.003,
    pitchSpeed: 0.0015,
    pitchMin: -0.20,
    pitchMax: 0.40,

    // Per-frame smoothing values calibrated for 60 FPS.
    posLerp: 0.14,
    lookLerp: 0.32,
    fovLerp: 0.06,
    cameraReturnRate: 3.2,
};

export const WALK = {
    stepFrequency: 1.2,
    bobAmplitude: 0.08,
    swayAmplitude: 0.04,
    rollAmplitude: 0.005,
};

export const SHAKE = {
    decayRate: 0.92,
    translationScale: 0.5,
    rotationScale: 0.03,
    footstepTrauma: 0.04,
    hitTraumaPerDamage: 0.025,
    fireTraumaScale: 0.1,
};

export const ROTATION = {
    torsoTurnRate: {
        light: 2.8,
        medium: 1.6,
        heavy: 1.1,
    },
    legsTurnRate: {
        light: 1.8,
        medium: 0.95,
        heavy: 0.65,
    },
    maxTorsoTwist: 1.75,
};

export const GOLEM = {
    classes: {
        light: { mass: 1.0, hp: 70, steam: 80, speed: 12 },
        medium: { mass: 2.0, hp: 100, steam: 100, speed: 9 },
        heavy: { mass: 3.5, hp: 150, steam: 120, speed: 5.5 },
    },
    steamRegen: 8,
    overheatThreshold: 15,
    overheatDuration: 3,
};

export const PHYSICS = {
    gravity: { x: 0.0, y: -9.81, z: 0.0 }
};

export const NETWORK = {
    tickRate: 20
};
