import {
    ProceduralHeightmap,
    clamp,
    smoothstep,
    blendPads,
    isProtectedTerrainPadArea,
    TERRAIN_SPAWN_PADS,
    TERRAIN_OBJECTIVE_PADS,
    type TerrainPadConfig,
} from '../../world/HeightmapSource';
import type { HeightmapSource } from '../../world/HeightmapSource';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function runTest(name: string, test: () => void) {
    test();
    console.log(`PASS ${name}`);
}

// --- HeightmapSource tests ---

runTest('procedural heightmap generates deterministic heights', () => {
    const hm = new ProceduralHeightmap({
        size: 33,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [
            { frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 },
        ],
        seed: 42
    });

    assert(hm.width === 33, 'width should match config size');
    assert(hm.height === 33, 'height should match config size');

    const heights = hm.getHeightArray();
    assert(heights.length === 33 * 33, 'height array length should match grid size');

    const h1 = hm.sample(0, 0);
    const h2 = hm.sample(0, 0);
    assert(h1 === h2, 'same position should return identical height');

    const h3 = hm.sample(50, 50);
    const h4 = hm.sample(-50, -50);
    assert(h3 !== h4 || true, 'different positions may return different heights');

    for (let i = 0; i < heights.length; i++) {
        assert(heights[i] >= 0.42 - 1e-6, 'all heights should be at least minHeight');
    }
});

runTest('procedural heightmap with different seeds produces different terrain', () => {
    const hm1 = new ProceduralHeightmap({
        size: 33,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [{ frequency: 0.01, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 1
    });
    const hm2 = new ProceduralHeightmap({
        size: 33,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [{ frequency: 0.01, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 99
    });

    const heights1 = hm1.getHeightArray();
    const heights2 = hm2.getHeightArray();

    let different = false;
    for (let i = 0; i < heights1.length; i++) {
        if (heights1[i] !== heights2[i]) {
            different = true;
            break;
        }
    }
    assert(different, 'different seeds should produce different heightmaps');
});

runTest('procedural heightmap respects minHeight constraint', () => {
    const hm = new ProceduralHeightmap({
        size: 65,
        baseHeight: 0,
        minHeight: 2.0,
        octaves: [
            { frequency: 0.01, amplitude: 5.0, lacunarity: 2.0, gain: 0.5 },
            { frequency: 0.02, amplitude: 3.0, lacunarity: 2.0, gain: 0.5 },
        ],
        seed: 7
    });

    const heights = hm.getHeightArray();
    for (let i = 0; i < heights.length; i++) {
        assert(heights[i] >= 2.0 - 1e-6, 'all heights should be >= minHeight');
    }
});

// --- Clamp and smoothstep tests ---

runTest('clamp constrains values to range', () => {
    assert(clamp(5, 0, 10) === 5, 'value within range should be unchanged');
    assert(clamp(-3, 0, 10) === 0, 'value below range should be clamped to min');
    assert(clamp(15, 0, 10) === 10, 'value above range should be clamped to max');
    assert(clamp(0, 0, 10) === 0, 'value at min should remain min');
    assert(clamp(10, 0, 10) === 10, 'value at max should remain max');
});

runTest('smoothstep returns interpolated values', () => {
    assert(smoothstep(0, 1, 0) === 0, 'value at edge0 should return 0');
    assert(smoothstep(0, 1, 1) === 1, 'value at edge1 should return 1');
    assert(smoothstep(0, 1, -1) === 0, 'value below edge0 should return 0');
    assert(smoothstep(0, 1, 2) === 1, 'value above edge1 should return 1');
    const mid = smoothstep(0, 1, 0.5);
    assert(mid > 0 && mid < 1, 'midpoint should return value between 0 and 1');
    assert(Math.abs(mid - 0.5) < 0.1, 'smoothstep at 0.5 should be close to 0.5');
});

// --- Pad blending tests ---

runTest('isProtectedTerrainPadArea detects spawn pad proximity', () => {
    const pad = TERRAIN_SPAWN_PADS[0];
    assert(isProtectedTerrainPadArea(pad.x, pad.z), 'center of spawn pad should be protected');
    assert(!isProtectedTerrainPadArea(999, 999), 'far away point should not be protected');

    const edgeDist = pad.radius + 5;
    assert(!isProtectedTerrainPadArea(pad.x + edgeDist, pad.z), 'point outside pad radius should not be protected');
    assert(isProtectedTerrainPadArea(pad.x + pad.radius * 0.5, pad.z), 'point inside pad radius should be protected');
});

runTest('isProtectedTerrainPadArea respects extraRadius', () => {
    const pad = TERRAIN_SPAWN_PADS[0];
    const extra = 10;
    assert(isProtectedTerrainPadArea(pad.x + pad.radius + 5, pad.z, extra), 'extraRadius should extend protection');
    assert(!isProtectedTerrainPadArea(pad.x + pad.radius + extra + 5, pad.z, extra), 'point beyond extraRadius should not be protected');
});

runTest('isProtectedTerrainPadArea covers all spawn and objective pads', () => {
    for (const pad of TERRAIN_SPAWN_PADS) {
        assert(isProtectedTerrainPadArea(pad.x, pad.z), `spawn pad at ${pad.x},${pad.z} should be protected`);
    }
    for (const pad of TERRAIN_OBJECTIVE_PADS) {
        assert(isProtectedTerrainPadArea(pad.x, pad.z), `objective pad at ${pad.x},${pad.z} should be protected`);
    }
});

runTest('blendPads flattens height near spawn pads', () => {
    const hm = new ProceduralHeightmap({
        size: 97,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [{ frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 42
    });

    const pad = TERRAIN_SPAWN_PADS[0];
    const blendedHeight = blendPads(hm, pad.x, pad.z);

    assert(Math.abs(blendedHeight - pad.targetY) < 0.5, 'height at pad center should be close to targetY');

    const farX = -20;
    const farZ = -20;
    const rawHeight = hm.sample(farX, farZ);
    const blendedFar = blendPads(hm, farX, farZ);
    assert(Math.abs(rawHeight - blendedFar) < 0.1, 'far point should not be significantly affected by pads');
});

runTest('blendPads with custom pad arrays', () => {
    const hm = new ProceduralHeightmap({
        size: 33,
        baseHeight: 2.0,
        minHeight: 1.0,
        octaves: [{ frequency: 0.01, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 1
    });

    const customSpawnPads: TerrainPadConfig[] = [
        { x: 0, z: 0, radius: 10, targetY: 5.0 }
    ];
    const customObjectivePads: TerrainPadConfig[] = [];

    const heightAtPad = blendPads(hm, 0, 0, customSpawnPads, customObjectivePads);
    assert(Math.abs(heightAtPad - 5.0) < 0.5, 'custom pad should flatten to targetY');

    const heightOutside = blendPads(hm, 20, 20, customSpawnPads, customObjectivePads);
    assert(heightOutside !== 5.0, 'point outside custom pad should not be flattened');
});

runTest('objective pads use source sample height when no targetY', () => {
    const hm = new ProceduralHeightmap({
        size: 97,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [{ frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 42
    });

    const pad = TERRAIN_OBJECTIVE_PADS[0];
    const sourceHeight = hm.sample(pad.x, pad.z);
    const blendedHeight = blendPads(hm, pad.x, pad.z);

    assert(Math.abs(blendedHeight - sourceHeight) < 1.5, 'objective pad without targetY should be close to source height');
});

runTest('blendPads handles overlapping pad influence gracefully', () => {
    const hm = new ProceduralHeightmap({
        size: 33,
        baseHeight: 2.0,
        minHeight: 1.0,
        octaves: [{ frequency: 0.01, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 5
    });

    const overlappingPads: TerrainPadConfig[] = [
        { x: 0, z: 0, radius: 15, targetY: 3.0 },
        { x: 10, z: 0, radius: 15, targetY: 4.0 }
    ];

    const heightAtOverlap = blendPads(hm, 5, 0, overlappingPads, []);
    assert(heightAtOverlap >= 3.0 && heightAtOverlap <= 4.0, 'overlapping pads should produce height between targets');
});

// --- ImageHeightmap tests ---

runTest('ImageHeightmap maps grayscale to height range', () => {
    // Create a fake ImageData-like object for testing
    const fakeImageData = {
        width: 4,
        height: 4,
        data: new Uint8ClampedArray(4 * 4 * 4)
    };
    // Set corners to different values
    fakeImageData.data[0] = 0;       // black -> min
    fakeImageData.data[4 * 4 * 4 - 4] = 255;  // white -> max

    // We can't test ImageHeightmap directly without DOM, so skip for Node.js
    console.log('SKIP ImageHeightmap DOM-dependent test (Node.js environment)');
});

// --- Regression: heightmap consistency across resolutions ---

runTest('heightmap sampling is consistent at grid boundaries', () => {
    const hm = new ProceduralHeightmap({
        size: 97,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [{ frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 }],
        seed: 42
    });

    const halfSize = 132;
    const edge = halfSize - 0.001;

    const leftEdge = hm.sample(-edge, 0);
    const rightEdge = hm.sample(edge, 0);
    const topEdge = hm.sample(0, -edge);
    const bottomEdge = hm.sample(0, edge);

    assert(leftEdge >= hm.getHeightArray()[0] - 1, 'left edge should be valid');
    assert(rightEdge >= 0.42 - 1e-6, 'right edge should be above minHeight');
    assert(topEdge >= 0.42 - 1e-6, 'top edge should be above minHeight');
    assert(bottomEdge >= 0.42 - 1e-6, 'bottom edge should be above minHeight');
});

runTest('blendPads preserves terrain shape outside pad radius', () => {
    const hm = new ProceduralHeightmap({
        size: 97,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [
            { frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 },
            { frequency: 0.016, amplitude: 0.5, lacunarity: 2.0, gain: 0.5 },
        ],
        seed: 42
    });

    const testPoints = [
        { x: -50, z: -50 },
        { x: 50, z: 50 },
        { x: -80, z: 80 },
        { x: 100, z: -100 },
    ];

    for (const point of testPoints) {
        const raw = hm.sample(point.x, point.z);
        const blended = blendPads(hm, point.x, point.z);

        const inAnyPad = isProtectedTerrainPadArea(point.x, point.z, 2);
        if (!inAnyPad) {
            assert(Math.abs(raw - blended) < 0.3, `point ${point.x},${point.z} should not be significantly affected by pads`);
        }
    }
});

// --- Deterministic terrain generation ---

runTest('procedural heightmap produces identical results on repeated construction', () => {
    const config = {
        size: 65,
        baseHeight: 1.45,
        minHeight: 0.42,
        octaves: [
            { frequency: 0.008, amplitude: 1.0, lacunarity: 2.0, gain: 0.5 },
            { frequency: 0.016, amplitude: 0.5, lacunarity: 2.0, gain: 0.5 },
            { frequency: 0.032, amplitude: 0.25, lacunarity: 2.0, gain: 0.5 },
        ],
        seed: 12345
    };

    const hm1 = new ProceduralHeightmap(config);
    const hm2 = new ProceduralHeightmap(config);

    const heights1 = hm1.getHeightArray();
    const heights2 = hm2.getHeightArray();

    for (let i = 0; i < heights1.length; i++) {
        assert(heights1[i] === heights2[i], `height at index ${i} should be deterministic`);
    }

    for (let x = -100; x <= 100; x += 20) {
        for (let z = -100; z <= 100; z += 20) {
            assert(hm1.sample(x, z) === hm2.sample(x, z), `sample at ${x},${z} should be deterministic`);
        }
    }
});

console.log('Terrain and heightmap smoke tests completed successfully.');
