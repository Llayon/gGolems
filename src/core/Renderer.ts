import * as THREE from 'three';
import { QualityProfile } from '../utils/quality';

export class Renderer {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    quality: QualityProfile;

    constructor(canvas: HTMLCanvasElement, quality: QualityProfile) {
        this.quality = quality;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, quality.fogDensity);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1800);
        
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = quality.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffaa55, 1.5);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = quality.shadows;
        dirLight.shadow.camera.top = 156;
        dirLight.shadow.camera.bottom = -156;
        dirLight.shadow.camera.left = -156;
        dirLight.shadow.camera.right = 156;
        dirLight.shadow.mapSize.setScalar(quality.shadowMapSize);
        this.scene.add(dirLight);

        window.addEventListener('resize', this.onResize);
    }

    onResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio));
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose() {
        window.removeEventListener('resize', this.onResize);
        this.renderer.dispose();
    }
}
