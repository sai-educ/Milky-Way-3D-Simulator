import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// =============================================================================
// MILKY WAY CONFIGURATION
// =============================================================================
const config = {
    // Galactic core - bright yellow-white center
    core: {
        innerRadius: 2,
        outerRadius: 6,
        count: 50000,
        colorInner: new THREE.Color(0xffffff),
        colorMid: new THREE.Color(0xfffde8),
        colorOuter: new THREE.Color(0xffe4a0),
    },

    // Central bar structure
    bar: {
        length: 24,
        width: 4,
        height: 1.0,
        angle: Math.PI * 0.12,
        count: 35000,
        colorInner: new THREE.Color(0xfff8e0),
        colorOuter: new THREE.Color(0xffd070),
    },

    // Galactic bulge
    bulge: {
        radius: 15,
        count: 25000,
        colorInner: new THREE.Color(0xffecb0),
        colorOuter: new THREE.Color(0xd4a050),
    },

    // Spiral arms
    arms: {
        pitchAngle: 14 * Math.PI / 180,
        innerRadius: 10,
        outerRadius: 80,

        definitions: [
            { name: 'Perseus', offset: 0, strength: 1.0, width: 4.5 },
            { name: 'Scutum-Centaurus', offset: Math.PI, strength: 1.0, width: 4.5 },
            { name: 'Sagittarius', offset: Math.PI * 0.55, strength: 0.55, width: 3.5 },
            { name: 'Norma-Outer', offset: Math.PI * 1.55, strength: 0.55, width: 3.5 },
        ],

        starCount: 100000,

        colorBright: new THREE.Color(0x9fbfff),
        colorMedium: new THREE.Color(0xc8dbff),
        colorDim: new THREE.Color(0xe8f0ff),
    },

    // Multi-layered gaseous halo system for dissolving bloom effect
    gasLayers: [
        // Inner layer - brightest, closest to arms
        {
            count: 15000,
            color: new THREE.Color(0x5090dd),
            spreadFactor: 0.8,
            sizeMin: 3,
            sizeMax: 6,
            alphaMin: 0.35,
            alphaMax: 0.55,
        },
        // Middle layer - medium brightness
        {
            count: 20000,
            color: new THREE.Color(0x4080cc),
            spreadFactor: 1.4,
            sizeMin: 5,
            sizeMax: 10,
            alphaMin: 0.18,
            alphaMax: 0.32,
        },
        // Outer layer - faint, dissolving into black
        {
            count: 25000,
            color: new THREE.Color(0x3070bb),
            spreadFactor: 2.2,
            sizeMin: 8,
            sizeMax: 16,
            alphaMin: 0.06,
            alphaMax: 0.15,
        },
        // Outermost haze - very faint
        {
            count: 18000,
            color: new THREE.Color(0x2060aa),
            spreadFactor: 3.2,
            sizeMin: 12,
            sizeMax: 25,
            alphaMin: 0.02,
            alphaMax: 0.08,
        },
    ],

    // HII regions - pink star-forming regions
    nebulae: {
        count: 6000,
        colors: [
            new THREE.Color(0xff5588),
            new THREE.Color(0xff3366),
            new THREE.Color(0xff6699),
            new THREE.Color(0xee4477),
            new THREE.Color(0xff77aa),
        ],
        clusterSize: 2.0,
    },

    // Dust lanes
    dust: {
        count: 28000,
        color: new THREE.Color(0x120805),
        colorBrown: new THREE.Color(0x1a0c06),
        offsetAngle: -0.12,
        width: 0.55,
    },

    // Diffuse disk
    disk: {
        count: 30000,
        radius: 85,
        height: 2.0,
        color: new THREE.Color(0x7799cc),
    },

    // Background stars
    background: {
        starCount: 6000,
        radius: 500,
        colorWarm: new THREE.Color(0xffeedd),
        colorCool: new THREE.Color(0xddeeff),
        colorWhite: new THREE.Color(0xffffff),
    },

    // Animation
    physics: {
        rotationSpeed: 0.000035,
        rotationDirection: -1,
        expansionDuration: 2.8,
    }
};

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
const isLikelyMobile = isTouchDevice || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);
const isLowPowerDevice = Boolean(
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4)
);

const performanceProfile = isLikelyMobile || isLowPowerDevice
    ? {
        particleScale: 0.44,
        gasSizeScale: 0.8,
        maxPixelRatio: 1.1,
        initialRenderScale: 0.86,
        minRenderScale: 0.55,
        adaptiveResolution: true,
        targetFrameMs: 1000 / 45,
        bloomStrength: 1.3,
        bloomRadius: 0.65,
        bloomThreshold: 0.16,
        toneMappingExposure: 1.0,
        backgroundBlurriness: 0.22
    }
    : {
        particleScale: 0.78,
        gasSizeScale: 1.0,
        maxPixelRatio: 1.6,
        initialRenderScale: 1.0,
        minRenderScale: 0.72,
        adaptiveResolution: true,
        targetFrameMs: 1000 / 60,
        bloomStrength: 2.1,
        bloomRadius: 0.95,
        bloomThreshold: 0.09,
        toneMappingExposure: 1.05,
        backgroundBlurriness: 0.1
    };

function scaledCount(value, minimum = 800) {
    return Math.max(minimum, Math.floor(value * performanceProfile.particleScale));
}

config.core.count = scaledCount(config.core.count);
config.bar.count = scaledCount(config.bar.count);
config.bulge.count = scaledCount(config.bulge.count);
config.arms.starCount = scaledCount(config.arms.starCount);
config.nebulae.count = scaledCount(config.nebulae.count);
config.dust.count = scaledCount(config.dust.count);
config.disk.count = scaledCount(config.disk.count);
config.background.starCount = scaledCount(config.background.starCount);

config.gasLayers = config.gasLayers.map((layer) => ({
    ...layer,
    count: scaledCount(layer.count),
    sizeMin: layer.sizeMin * performanceProfile.gasSizeScale,
    sizeMax: layer.sizeMax * performanceProfile.gasSizeScale
}));

// =============================================================================
// RENDERER SETUP
// =============================================================================
const scene = new THREE.Scene();
const canvas = document.getElementById('galaxyCanvas');

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 1);  // PITCH BLACK
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = performanceProfile.toneMappingExposure;
renderer.dithering = true;

const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);
camera.position.set(0, 12, 200);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 20;
controls.maxDistance = 600;
controls.rotateSpeed = isLikelyMobile ? 0.6 : 0.85;
controls.zoomSpeed = isLikelyMobile ? 0.72 : 1;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

// =============================================================================
// SHADERS
// =============================================================================
const vertexShader = `
    attribute float size;
    attribute vec3 customColor;
    attribute float alpha;

    varying vec3 vColor;
    varying float vAlpha;

    uniform float uTime;
    uniform float uExpansion;
    uniform float uRotationDirection;

    void main() {
        vColor = customColor;
        vAlpha = alpha;

        vec3 pos = position * uExpansion;

        float radius = length(pos.xz);
        float angularVelocity = uTime * uRotationDirection * (1.0 + 6.0 / (radius + 3.0));

        float cosA = cos(angularVelocity);
        float sinA = sin(angularVelocity);

        float x = pos.x * cosA - pos.z * sinA;
        float z = pos.x * sinA + pos.z * cosA;

        vec4 mvPosition = modelViewMatrix * vec4(x, pos.y, z, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 0.5, 60.0);
    }
`;

const staticVertexShader = `
    attribute float size;
    attribute vec3 customColor;
    attribute float alpha;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = customColor;
        vAlpha = alpha;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 0.3, 30.0);
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);

        if (dist > 0.5) discard;

        float intensity = exp(-dist * dist * 8.0);

        gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
    }
`;

// Special shader for gaseous clouds - extra soft falloff for dissolving effect
const gasFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);

        if (dist > 0.5) discard;

        // Very soft gaussian falloff for cloud-like dissolving effect
        float intensity = exp(-dist * dist * 3.5);
        intensity = pow(intensity, 0.6);

        // Smooth fade to zero at edges
        float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);
        intensity *= edgeFade;

        gl_FragColor = vec4(vColor, vAlpha * intensity);
    }
`;

const dustFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);

        if (dist > 0.5) discard;

        float intensity = 1.0 - dist * 2.0;
        intensity = pow(intensity, 0.8);

        gl_FragColor = vec4(vColor, vAlpha * intensity * 0.8);
    }
`;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev + mean;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(color1, color2, t) {
    return new THREE.Color(
        lerp(color1.r, color2.r, t),
        lerp(color1.g, color2.g, t),
        lerp(color1.b, color2.b, t)
    );
}

function inverseSpiralTheta(r, a, b) {
    return Math.log(r / a) / b;
}

const FAST_HDR_URL = 'https://cdn.needle.tools/static/hdris/studio_small_09_2k.pmrem.ktx2';

function createFallbackBackgroundTexture() {
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 256;
    const ctx = gradientCanvas.getContext('2d');

    if (!ctx) return null;

    const baseGradient = ctx.createLinearGradient(0, 0, 0, gradientCanvas.height);
    baseGradient.addColorStop(0, '#050912');
    baseGradient.addColorStop(0.35, '#030611');
    baseGradient.addColorStop(1, '#000000');

    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

    const blueNebula = ctx.createRadialGradient(350, 80, 20, 350, 80, 220);
    blueNebula.addColorStop(0, 'rgba(68, 136, 216, 0.24)');
    blueNebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = blueNebula;
    ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

    const texture = new THREE.CanvasTexture(gradientCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    return texture;
}

const fallbackBackgroundTexture = createFallbackBackgroundTexture();
if (fallbackBackgroundTexture) {
    scene.background = fallbackBackgroundTexture;
    scene.environment = fallbackBackgroundTexture;
    scene.backgroundBlurriness = performanceProfile.backgroundBlurriness;
}

function loadFastHDRBackground() {
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://unpkg.com/three@0.153.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);

    ktx2Loader.load(
        FAST_HDR_URL,
        (texture) => {
            texture.mapping = THREE.CubeUVReflectionMapping;
            scene.environment = texture;
            scene.background = texture;
            scene.backgroundBlurriness = performanceProfile.backgroundBlurriness;
        },
        undefined,
        () => {
            // Keep procedural background fallback if Fast HDR is unavailable.
        }
    );
}

loadFastHDRBackground();

// =============================================================================
// BACKGROUND STARS
// =============================================================================
function generateBackground() {
    const data = { positions: [], colors: [], sizes: [], alphas: [] };

    const add = (x, y, z, color, size, alpha) => {
        data.positions.push(x, y, z);
        data.colors.push(color.r, color.g, color.b);
        data.sizes.push(size);
        data.alphas.push(alpha);
    };

    const { background } = config;

    for (let i = 0; i < background.starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = background.radius * (0.5 + Math.random() * 0.5);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        const colorRoll = Math.random();
        let color;
        if (colorRoll < 0.3) {
            color = background.colorWarm.clone();
        } else if (colorRoll < 0.6) {
            color = background.colorCool.clone();
        } else {
            color = background.colorWhite.clone();
        }

        color.r += (Math.random() - 0.5) * 0.1;
        color.g += (Math.random() - 0.5) * 0.1;
        color.b += (Math.random() - 0.5) * 0.1;

        const size = Math.random() * 1.2 + 0.2;
        const alpha = 0.3 + Math.random() * 0.5;

        add(x, y, z, color, size, alpha);
    }

    return data;
}

// =============================================================================
// GASEOUS HALO LAYERS - Creates dissolving bloom effect
// =============================================================================
function generateGasLayers() {
    const data = { positions: [], colors: [], sizes: [], alphas: [] };

    const add = (x, y, z, color, size, alpha) => {
        data.positions.push(x, y, z);
        data.colors.push(color.r, color.g, color.b);
        data.sizes.push(size);
        data.alphas.push(alpha);
    };

    const { arms } = config;
    const spiralA = arms.innerRadius;
    const spiralB = Math.tan(arms.pitchAngle);

    // Generate each gas layer
    for (const layer of config.gasLayers) {
        for (let i = 0; i < layer.count; i++) {
            const armIndex = Math.floor(Math.random() * arms.definitions.length);
            const arm = arms.definitions[armIndex];

            // Position along the arm
            const t = Math.random();
            const baseRadius = lerp(arms.innerRadius * 0.8, arms.outerRadius * 0.98, t);

            const spiralTheta = inverseSpiralTheta(baseRadius, spiralA, spiralB);
            const theta = spiralTheta + arm.offset + config.bar.angle;

            // Spread increases with layer
            const scatter = gaussianRandom(0, arm.width * layer.spreadFactor);
            const r = baseRadius + scatter;
            const finalTheta = theta + gaussianRandom(0, 0.2 * layer.spreadFactor);

            const x = r * Math.cos(finalTheta);
            const z = r * Math.sin(finalTheta);
            const y = gaussianRandom(0, 1.0 + layer.spreadFactor * 0.5);

            const color = layer.color.clone();
            // Add slight variation
            color.r += (Math.random() - 0.5) * 0.04;
            color.g += (Math.random() - 0.5) * 0.04;
            color.b += (Math.random() - 0.5) * 0.06;

            // Fade toward outer edges of galaxy
            const radialFade = 1.0 - Math.pow(t, 2) * 0.5;

            // Distance from arm center affects opacity
            const distFromArm = Math.abs(scatter) / (arm.width * layer.spreadFactor);
            const armFade = Math.exp(-distFromArm * distFromArm * 0.8);

            const size = lerp(layer.sizeMin, layer.sizeMax, Math.random()) * radialFade;
            const alpha = lerp(layer.alphaMin, layer.alphaMax, Math.random()) * radialFade * armFade;

            add(x, y, z, color, size, alpha);
        }
    }

    return data;
}

// =============================================================================
// GALAXY GENERATION
// =============================================================================
function generateGalaxy() {
    const starData = { positions: [], colors: [], sizes: [], alphas: [] };
    const dustData = { positions: [], colors: [], sizes: [], alphas: [] };

    const addStar = (x, y, z, color, size, alpha) => {
        starData.positions.push(x, y, z);
        starData.colors.push(color.r, color.g, color.b);
        starData.sizes.push(size);
        starData.alphas.push(alpha);
    };

    const addDust = (x, y, z, color, size, alpha) => {
        dustData.positions.push(x, y, z);
        dustData.colors.push(color.r, color.g, color.b);
        dustData.sizes.push(size);
        dustData.alphas.push(alpha);
    };

    // -------------------------------------------------------------------------
    // 1. GALACTIC CORE
    // -------------------------------------------------------------------------
    for (let i = 0; i < config.core.count; i++) {
        const r = Math.pow(Math.random(), 3) * config.core.outerRadius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const flattenY = 0.45 + 0.35 * (r / config.core.outerRadius);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta) * flattenY;
        const z = r * Math.cos(phi);

        const t = r / config.core.outerRadius;
        let color;
        if (t < 0.3) {
            color = lerpColor(config.core.colorInner, config.core.colorMid, t / 0.3);
        } else {
            color = lerpColor(config.core.colorMid, config.core.colorOuter, (t - 0.3) / 0.7);
        }

        const size = (1 - t * 0.4) * (Math.random() * 3.0 + 2.0);
        const alpha = 0.8 + (1 - t) * 0.2;

        addStar(x, y, z, color, size, alpha);
    }

    // -------------------------------------------------------------------------
    // 2. GALACTIC BULGE
    // -------------------------------------------------------------------------
    for (let i = 0; i < config.bulge.count; i++) {
        const r = Math.pow(Math.random(), 1.5) * config.bulge.radius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const flattenY = 0.35;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta) * flattenY;
        const z = r * Math.cos(phi);

        const t = r / config.bulge.radius;
        const color = lerpColor(config.bulge.colorInner, config.bulge.colorOuter, t);

        const size = (1 - t * 0.3) * (Math.random() * 2.0 + 1.0);
        const alpha = (0.4 + (1 - t) * 0.3) * 0.8;

        addStar(x, y, z, color, size, alpha);
    }

    // -------------------------------------------------------------------------
    // 3. CENTRAL BAR
    // -------------------------------------------------------------------------
    const barCos = Math.cos(config.bar.angle);
    const barSin = Math.sin(config.bar.angle);

    for (let i = 0; i < config.bar.count; i++) {
        const barX = (Math.random() - 0.5) * config.bar.length;
        const barZ = gaussianRandom(0, config.bar.width * 0.35);
        const barY = gaussianRandom(0, config.bar.height * 0.35);

        const barDist = Math.abs(barX) / (config.bar.length * 0.5);
        if (Math.random() > (1 - barDist * 0.25)) continue;

        const x = barX * barCos - barZ * barSin;
        const z = barX * barSin + barZ * barCos;

        const t = barDist;
        const color = lerpColor(config.bar.colorInner, config.bar.colorOuter, t);

        const size = Math.random() * 2.2 + 1.0;
        const alpha = 0.55 + (1 - t) * 0.3;

        addStar(x, barY, z, color, size, alpha);
    }

    // -------------------------------------------------------------------------
    // 4. SPIRAL ARMS
    // -------------------------------------------------------------------------
    const { arms } = config;
    const spiralA = arms.innerRadius;
    const spiralB = Math.tan(arms.pitchAngle);

    for (let i = 0; i < arms.starCount; i++) {
        const armIndex = Math.floor(Math.random() * arms.definitions.length);
        const arm = arms.definitions[armIndex];

        if (arm.strength < 1.0 && Math.random() > arm.strength) continue;

        const t = Math.pow(Math.random(), 0.75);
        const baseRadius = lerp(arms.innerRadius, arms.outerRadius, t);

        const spiralTheta = inverseSpiralTheta(baseRadius, spiralA, spiralB);
        const theta = spiralTheta + arm.offset + config.bar.angle;

        const scatter = gaussianRandom(0, arm.width * (0.6 + t * 0.4));
        const r = baseRadius + scatter;

        const angularScatter = gaussianRandom(0, 0.12 / (t + 0.35));
        const finalTheta = theta + angularScatter;

        const x = r * Math.cos(finalTheta);
        const z = r * Math.sin(finalTheta);

        const diskHeight = (1.3 - t * 0.7) * 1.0;
        const y = gaussianRandom(0, diskHeight * 0.35);

        const colorRoll = Math.random();
        let color;
        if (colorRoll < 0.45) {
            color = arms.colorBright.clone();
        } else if (colorRoll < 0.75) {
            color = arms.colorMedium.clone();
        } else {
            color = arms.colorDim.clone();
        }

        color.r += (Math.random() - 0.5) * 0.06;
        color.g += (Math.random() - 0.5) * 0.04;
        color.b += (Math.random() - 0.5) * 0.06;

        const fadeOuter = 1 - Math.pow(t, 2.5) * 0.5;
        const size = (Math.random() * 1.6 + 0.7) * fadeOuter;
        const alpha = (0.5 + Math.random() * 0.35) * fadeOuter;

        addStar(x, y, z, color, size, alpha);
    }

    // -------------------------------------------------------------------------
    // 5. HII REGIONS (Pink Nebulae)
    // -------------------------------------------------------------------------
    for (let i = 0; i < config.nebulae.count; i++) {
        const armIndex = Math.floor(Math.random() * arms.definitions.length);
        const arm = arms.definitions[armIndex];

        const t = 0.1 + Math.random() * 0.7;
        const baseRadius = lerp(arms.innerRadius, arms.outerRadius * 0.88, t);

        const spiralTheta = inverseSpiralTheta(baseRadius, spiralA, spiralB);
        const theta = spiralTheta + arm.offset + config.bar.angle;

        const scatter = gaussianRandom(0, arm.width * 0.45);
        const r = baseRadius + scatter;
        const finalTheta = theta + gaussianRandom(0, 0.08);

        const clusterCount = Math.floor(Math.random() * 5) + 2;
        for (let j = 0; j < clusterCount; j++) {
            const cx = r * Math.cos(finalTheta) + gaussianRandom(0, config.nebulae.clusterSize);
            const cz = r * Math.sin(finalTheta) + gaussianRandom(0, config.nebulae.clusterSize);
            const cy = gaussianRandom(0, 0.6);

            const color = config.nebulae.colors[Math.floor(Math.random() * config.nebulae.colors.length)].clone();
            color.r += (Math.random() - 0.5) * 0.08;

            const size = Math.random() * 3.5 + 1.8;
            const alpha = 0.65 + Math.random() * 0.3;

            addStar(cx, cy, cz, color, size, alpha);
        }
    }

    // -------------------------------------------------------------------------
    // 6. DUST LANES
    // -------------------------------------------------------------------------
    for (let i = 0; i < config.dust.count; i++) {
        const armIndex = Math.floor(Math.random() * arms.definitions.length);
        const arm = arms.definitions[armIndex];

        const t = Math.random();
        const baseRadius = lerp(arms.innerRadius, arms.outerRadius * 0.85, t);

        const spiralTheta = inverseSpiralTheta(baseRadius, spiralA, spiralB);
        const theta = spiralTheta + arm.offset + config.bar.angle + config.dust.offsetAngle;

        const scatter = gaussianRandom(0, arm.width * config.dust.width);
        const r = baseRadius + scatter;
        const finalTheta = theta + gaussianRandom(0, 0.06);

        const x = r * Math.cos(finalTheta);
        const z = r * Math.sin(finalTheta);
        const y = gaussianRandom(0, 0.25);

        const color = Math.random() < 0.6 ?
            config.dust.color.clone() :
            config.dust.colorBrown.clone();

        color.r += Math.random() * 0.015;
        color.g += Math.random() * 0.008;

        const size = Math.random() * 4.5 + 2.0;
        const alpha = 0.65 + Math.random() * 0.25;

        addDust(x, y, z, color, size, alpha);
    }

    // -------------------------------------------------------------------------
    // 7. DIFFUSE DISK STARS
    // -------------------------------------------------------------------------
    for (let i = 0; i < config.disk.count; i++) {
        const r = -config.disk.radius * 0.35 * Math.log(1 - Math.random() * 0.95);
        const theta = Math.random() * Math.PI * 2;

        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const y = gaussianRandom(0, config.disk.height * (1 - r / config.disk.radius * 0.4));

        const color = config.disk.color.clone();
        color.r += (Math.random() - 0.5) * 0.12;
        color.g += (Math.random() - 0.5) * 0.08;
        color.b += (Math.random() - 0.5) * 0.08;

        const fade = 1 - (r / config.disk.radius) * 0.55;
        const size = (Math.random() * 1.0 + 0.4) * fade;
        const alpha = (0.25 + Math.random() * 0.18) * fade;

        addStar(x, y, z, color, size, alpha);
    }

    return { starData, dustData };
}

// =============================================================================
// CREATE POINT SYSTEMS
// =============================================================================
const uniforms = {
    uTime: { value: 0 },
    uExpansion: { value: 0 },
    uRotationDirection: { value: config.physics.rotationDirection }
};

function createPointSystem(data, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(data.sizes, 1));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(data.alphas, 1));
    return new THREE.Points(geometry, material);
}

// Generate all systems
const { starData, dustData } = generateGalaxy();
const gasData = generateGasLayers();
const backgroundData = generateBackground();

// Materials
const starMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const gasMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: gasFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const dustMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
});

const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: staticVertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// Create meshes
const backgroundStars = createPointSystem(backgroundData, backgroundMaterial);
const gas = createPointSystem(gasData, gasMaterial);
const stars = createPointSystem(starData, starMaterial);
const dust = createPointSystem(dustData, dustMaterial);

backgroundStars.frustumCulled = false;

// Render order: background first, then galaxy body layers.
backgroundStars.renderOrder = -1;
gas.renderOrder = 0;
stars.renderOrder = 1;
dust.renderOrder = 2;

scene.add(backgroundStars);
scene.add(gas);
scene.add(stars);
scene.add(dust);

// =============================================================================
// POST PROCESSING - Enhanced bloom for dissolving effect
// =============================================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    performanceProfile.bloomStrength,
    performanceProfile.bloomRadius,
    performanceProfile.bloomThreshold
);
bloomPass.strength = performanceProfile.bloomStrength;
bloomPass.radius = performanceProfile.bloomRadius;
bloomPass.threshold = performanceProfile.bloomThreshold;
composer.addPass(bloomPass);

const renderState = {
    renderScale: performanceProfile.initialRenderScale,
    frameTimeEMA: performanceProfile.targetFrameMs,
    adjustTimer: 0,
    appliedPixelRatio: 0
};

function applyRenderScale(scale) {
    const clampedScale = THREE.MathUtils.clamp(scale, performanceProfile.minRenderScale, 1);
    renderState.renderScale = clampedScale;

    const targetPixelRatio = Math.min(window.devicePixelRatio, performanceProfile.maxPixelRatio) * clampedScale;
    if (Math.abs(targetPixelRatio - renderState.appliedPixelRatio) < 0.02) return;

    renderState.appliedPixelRatio = targetPixelRatio;
    renderer.setPixelRatio(targetPixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setPixelRatio(targetPixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function updateAdaptiveResolution(deltaSeconds) {
    if (!performanceProfile.adaptiveResolution) return;

    const frameTimeMs = deltaSeconds * 1000;
    renderState.frameTimeEMA = lerp(renderState.frameTimeEMA, frameTimeMs, 0.08);
    renderState.adjustTimer += deltaSeconds;

    if (renderState.adjustTimer < 1.25) return;

    const tooSlowThreshold = performanceProfile.targetFrameMs * 1.2;
    const fastThreshold = performanceProfile.targetFrameMs * 0.82;

    let nextScale = renderState.renderScale;
    if (renderState.frameTimeEMA > tooSlowThreshold) {
        nextScale -= 0.08;
    } else if (renderState.frameTimeEMA < fastThreshold) {
        nextScale += 0.04;
    }

    nextScale = THREE.MathUtils.clamp(nextScale, performanceProfile.minRenderScale, 1);
    if (Math.abs(nextScale - renderState.renderScale) >= 0.03) {
        applyRenderScale(nextScale);
    }

    if (
        renderState.frameTimeEMA > tooSlowThreshold * 1.15 &&
        renderState.renderScale <= performanceProfile.minRenderScale + 0.02
    ) {
        bloomPass.enabled = false;
    } else if (
        renderState.frameTimeEMA < fastThreshold &&
        renderState.renderScale >= performanceProfile.initialRenderScale - 0.05
    ) {
        bloomPass.enabled = true;
    }

    renderState.adjustTimer = 0;
}

applyRenderScale(performanceProfile.initialRenderScale);

// =============================================================================
// ANIMATION
// =============================================================================
const clock = new THREE.Clock();
let time = 0;
let readyEventSent = false;

function startExpansion() {
    let startTime = null;
    const duration = config.physics.expansionDuration * 1000;

    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1.0);

        const ease = 1 - Math.pow(1 - progress, 3);
        uniforms.uExpansion.value = ease;

        if (progress < 1.0) {
            requestAnimationFrame(animate);
        }
    };

    requestAnimationFrame(animate);
}

startExpansion();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    time += delta * config.physics.rotationSpeed * 1000;

    uniforms.uTime.value = time;
    controls.update();
    updateAdaptiveResolution(delta);

    composer.render();

    if (!readyEventSent) {
        readyEventSent = true;
        window.dispatchEvent(new Event('galaxy-ready'));
    }
}

// =============================================================================
// RESIZE HANDLER
// =============================================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyRenderScale(renderState.renderScale);
});

animate();
