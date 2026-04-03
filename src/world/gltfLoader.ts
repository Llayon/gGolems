import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

let sharedDracoLoader: DRACOLoader | null = null;

function getSharedDracoLoader() {
    if (!sharedDracoLoader) {
        sharedDracoLoader = new DRACOLoader();
        sharedDracoLoader.setDecoderPath(DRACO_DECODER_PATH);
        sharedDracoLoader.setDecoderConfig({ type: 'js' });
        sharedDracoLoader.preload();
    }

    return sharedDracoLoader;
}

export function createGltfLoader() {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getSharedDracoLoader());
    return loader;
}
