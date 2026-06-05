import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { Arena } from '../world/Arena';
import { GolemController, type GolemControllerOptions } from '../entities/GolemController';
import { ParticleManager } from '../fx/ParticleManager';
import { DebrisManager } from '../fx/DebrisManager';
import { DecalManager } from '../fx/DecalManager';
import { AtmosphereManager } from '../fx/AtmosphereManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';
import { ControlPointManager } from '../gameplay/ControlPointManager';
import { Physics } from './Physics';
import { QualityProfile, detectQualityProfile } from '../utils/quality';
import { createTeamScores } from './match/MatchRuntime';
import type { GameMode, TeamScoreState } from '../gameplay/types';

export type EngineSubsystems = {
    renderer: Renderer;
    input: InputManager;
    network: NetworkManager;
    sounds: AudioManager;
    decals: DecalManager;
    physicsWrapper: Physics;
    physics: RAPIER.World;
    world: Arena;
    mechCamera: MechCamera;
    golem: GolemController;
    particles: ParticleManager;
    debris: DebrisManager;
    atmosphere: AtmosphereManager;
    projectiles: ProjectileManager;
    controlPoints: ControlPointManager;
    quality: QualityProfile;
};

export type EngineInitOptions = {
    atmosphereEnabled?: boolean;
};

export type EngineInitResult = {
    subsystems: EngineSubsystems;
    teamScores: TeamScoreState;
};

export function initEngineSubsystems(
    canvas: HTMLCanvasElement,
    gameMode: GameMode,
    scoreToWin: Record<GameMode, number>,
    localMechOptions: GolemControllerOptions,
    runtimeOptions: EngineInitOptions
): EngineInitResult {
    const quality = detectQualityProfile();
    const renderer = new Renderer(canvas, quality);
    const input = new InputManager();
    const network = new NetworkManager();
    const sounds = new AudioManager();
    const decals = new DecalManager(renderer.scene, quality);

    const physicsWrapper = new Physics();
    physicsWrapper.initSync();
    const physics = physicsWrapper.world;

    const world = new Arena(renderer.scene, physics, renderer.camera);
    const mechCamera = new MechCamera(renderer.camera);
    const golem = new GolemController(renderer.scene, physics, true, localMechOptions);
    golem.gameCamera = mechCamera;
    const particles = new ParticleManager(renderer.scene, quality);
    const debris = new DebrisManager(renderer.scene, quality);
    const atmosphere = new AtmosphereManager(
        renderer.scene, quality, runtimeOptions.atmosphereEnabled ?? !quality.isMobile
    );
    const projectiles = new ProjectileManager(renderer.scene);
    const controlPoints = new ControlPointManager(renderer.scene, world.controlPointPositions);
    controlPoints.setVisible(gameMode === 'control');

    return {
        subsystems: {
            renderer, input, network, sounds, decals, physicsWrapper, physics, world,
            mechCamera, golem, particles, debris, atmosphere, projectiles, controlPoints, quality
        },
        teamScores: createTeamScores(gameMode, scoreToWin)
    };
}
