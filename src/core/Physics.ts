import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS } from '../utils/constants';

export class Physics {
    world!: RAPIER.World;

    async init() {
        await RAPIER.init();
        this.world = new RAPIER.World(PHYSICS.gravity);
    }

    initSync() {
        this.world = new RAPIER.World(PHYSICS.gravity);
    }

    step() {
        if (this.world) {
            this.world.step();
        }
    }
}
