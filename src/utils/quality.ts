export type QualityProfile = {
    isMobile: boolean;
    antialias: boolean;
    maxPixelRatio: number;
    shadows: boolean;
    softShadows: boolean;
    shadowMapSize: number;
    fogDensity: number;
    particlePool: number;
    particleBurstScale: number;
    debrisPool: number;
    debrisBurstScale: number;
    debrisCastShadows: boolean;
    footprintPool: number;
    ruinPool: number;
    ruinLifeScale: number;
    boilerParticleInterval: number;
};

export function detectQualityProfile(): QualityProfile {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const touchDevice = navigator.maxTouchPoints > 0;
    const minViewport = Math.min(window.innerWidth, window.innerHeight);
    const isMobile = coarsePointer || touchDevice || minViewport <= 900;

    if (isMobile) {
        return {
            isMobile: true,
            antialias: false,
            maxPixelRatio: 1.25,
            shadows: true,
            softShadows: false,
            shadowMapSize: 512,
            fogDensity: 0.0061,
            particlePool: 180,
            particleBurstScale: 0.55,
            debrisPool: 40,
            debrisBurstScale: 0.55,
            debrisCastShadows: false,
            footprintPool: 40,
            ruinPool: 10,
            ruinLifeScale: 0.7,
            boilerParticleInterval: 0.12
        };
    }

    return {
        isMobile: false,
        antialias: true,
        maxPixelRatio: 2,
        shadows: true,
        softShadows: true,
        shadowMapSize: 1024,
        fogDensity: 0.0058,
        particlePool: 320,
        particleBurstScale: 1,
        debrisPool: 96,
        debrisBurstScale: 1,
        debrisCastShadows: true,
        footprintPool: 56,
        ruinPool: 18,
        ruinLifeScale: 1,
        boilerParticleInterval: 0.04
    };
}
