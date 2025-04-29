import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// Optional: Import GUI for real-time tweaking
// import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- Basic Setup ---
const scene = new THREE.Scene();
const canvas = document.getElementById('galaxyCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Set a darker background for better contrast
renderer.setClearColor(0x000005); // Very dark blue/black

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000); // Increased far plane further
camera.position.set(0, 60, 80); // Adjusted starting view

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1; // Allow closer zoom
controls.maxDistance = 2000; // Allow zooming further out

// --- Galaxy Parameters ---
const parameters = {
    // Core Galaxy
    galaxyParticleCount: 250000, // INCREASED particle count (Performance intensive!)
    galaxySize: 0.06,          // DECREASED particle size significantly
    diskRadius: 45,
    diskThicknessBase: 0.5,
    diskThicknessEdgeFactor: 4,
    bulgeRadius: 10,
    bulgeDensityFactor: 3,
    numArms: 4,
    armTightness: 0.45, // Slightly adjusted
    armSpreadY: 4,      // Slightly adjusted
    armWindingFactor: 2 * Math.PI,
    colorInside: new THREE.Color("#ffd8a0"), // Warmer core
    colorOutside: new THREE.Color("#a0c0ff"), // Cooler arms
    colorHIIChance: 0.01, // Low chance for pinkish HII regions in arms
    colorHII: new THREE.Color("#ff80c0"),

    // Dust Lanes
    dustParticleCount: 40000,
    dustSize: 0.15,
    dustOpacity: 0.4,
    dustColor: new THREE.Color("#20150a"), // Slightly adjusted dust color

    // Halo Component (NEW)
    haloParticleCount: 50000,
    haloRadius: 80, // Larger than disk
    haloThickness: 20,
    haloSize: 0.1,
    haloColor: new THREE.Color("#80a0ff"), // Faint blue halo

    // Background Stars
    backgroundStarCount: 15000,
    backgroundStarSize: 0.08,
    backgroundSphereRadius: 2500 // INCREASED radius
};

// --- Variables for simulation objects ---
let galaxyGeometry, galaxyMaterial, galaxyPoints;
let dustGeometry, dustMaterial, dustPoints;
let haloGeometry, haloMaterial, haloPoints; // New Halo
let backgroundStarsGeometry, backgroundStarsMaterial, backgroundStarsPoints;


// --- Function to Create Galaxy Component (Stars/Dust/Halo) ---
// Type: 'stars', 'dust', 'halo'
function createGalaxyComponent(type) {
    let count, size, vertexColorsNeeded;
    let geometry = new THREE.BufferGeometry();

    switch (type) {
        case 'stars':
            count = parameters.galaxyParticleCount;
            size = parameters.galaxySize;
            vertexColorsNeeded = true;
            break;
        case 'dust':
            count = parameters.dustParticleCount;
            size = parameters.dustSize;
            vertexColorsNeeded = false;
            break;
        case 'halo':
            count = parameters.haloParticleCount;
            size = parameters.haloSize;
            vertexColorsNeeded = false; // Halo has uniform color
            break;
        default: return null;
    }

    const positions = new Float32Array(count * 3);
    const colors = vertexColorsNeeded ? new Float32Array(count * 3) : null;

    for (let i = 0; i < count; i++) {
        const idx = i * 3;
        let x, y, z;
        let distanceFromCenterXZ; // Distance projected onto the galactic plane

        if (type === 'halo') {
            // --- Halo Distribution (Large, somewhat flattened sphere) ---
            const r = Math.random() * parameters.haloRadius;
            const theta = Math.random() * Math.PI * 2;
            // Make it somewhat flattened - reduce Y component
            const phi = Math.acos(2 * Math.random() - 1) * (0.5 + Math.random() * 0.5); // Bias towards equator

            x = r * Math.sin(phi) * Math.cos(theta);
            // Flatten the Y distribution significantly
            y = r * Math.sin(phi) * Math.sin(theta) * (parameters.haloThickness / parameters.haloRadius);
            z = r * Math.cos(phi);
            distanceFromCenterXZ = Math.sqrt(x * x + z * z);

        } else { // Stars or Dust
            // --- Position Calculation (Bulge, Disk, Arms) ---
            let radius = Math.random() * parameters.diskRadius;
            let angle = Math.random() * Math.PI * 2;

            // Thickness Profile
            let thicknessRandom = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1);
            let currentDiskThickness = parameters.diskThicknessBase * (1.0 - Math.pow(radius / parameters.diskRadius, parameters.diskThicknessEdgeFactor));

            // Bulge Distribution
            const bulgeChance = Math.exp(-radius / parameters.bulgeRadius) * parameters.bulgeDensityFactor;
            if (type === 'stars' && Math.random() < bulgeChance) {
                // Spherical bulge
                const r_bulge = Math.random() * parameters.bulgeRadius;
                const theta_bulge = Math.random() * Math.PI * 2;
                const phi_bulge = Math.acos(2 * Math.random() - 1);
                x = r_bulge * Math.sin(phi_bulge) * Math.cos(theta_bulge);
                y = r_bulge * Math.sin(phi_bulge) * Math.sin(theta_bulge);
                z = r_bulge * Math.cos(phi_bulge);
                distanceFromCenterXZ = Math.sqrt(x * x + z * z); // Distance in plane
                currentDiskThickness = parameters.bulgeRadius; // Override thickness
                y += thicknessRandom * currentDiskThickness * 0.3; // Randomness within bulge thickness
            } else {
                // Disk / Spiral Arm Distribution
                const armIndex = Math.floor(angle / (Math.PI * 2) * parameters.numArms);
                const baseArmAngle = (armIndex / parameters.numArms) * Math.PI * 2;
                const spiralOffset = (radius / parameters.diskRadius) * parameters.armWindingFactor;
                const armAngle = baseArmAngle + spiralOffset / parameters.armTightness + (Math.random() - 0.5) * 0.1; // Add jitter

                const scatterRadius = Math.pow(Math.random(), 2) * parameters.diskRadius * 0.15; // More scatter near center
                const scatterAngle = Math.random() * Math.PI * 2;

                x = Math.cos(armAngle) * radius + Math.cos(scatterAngle) * scatterRadius;
                z = Math.sin(armAngle) * radius + Math.sin(scatterAngle) * scatterRadius;
                distanceFromCenterXZ = Math.sqrt(x * x + z * z);

                y = thicknessRandom * currentDiskThickness;

                if (type === 'dust') {
                    y *= 0.3; // Concentrate dust near plane
                     // Slightly higher chance of dust within arms (conceptual)
                    if (Math.random() > 0.6) {
                       if (Math.random() > Math.exp(-distanceFromCenterXZ / (parameters.diskRadius * 0.6))) {
                            positions[idx] = Infinity; continue; // Skip some distant dust
                       }
                    } else {
                        positions[idx] = Infinity; continue; // Skip dust outside main arm areas more often
                    }
                }
            }
        }

        // Check for valid position before assigning
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            x = y = z = 0; // Assign to origin if calculation failed
            console.warn("NaN position calculated for particle type:", type);
        }

        // Assign final positions, skipping those marked Infinity
         if (x !== Infinity) {
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;
        } else {
             // Ensure skipped particles don't mess up array (optional: could filter later)
             positions[idx] = 0;
             positions[idx+1] = 0;
             positions[idx+2] = 0;
        }


        // --- Color Calculation (Only for 'stars') ---
        if (type === 'stars' && colors) {
            const color = new THREE.Color();
            const lerpFactor = Math.min(distanceFromCenterXZ / (parameters.diskRadius * 0.7), 1.0);
            color.lerpColors(parameters.colorInside, parameters.colorOutside, lerpFactor);

            // Chance for HII region color in arms
            if (distanceFromCenterXZ > parameters.bulgeRadius * 1.2 && Math.random() < parameters.colorHIIChance) {
                color.lerp(parameters.colorHII, 0.7); // Blend towards pink
            }

            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // --- Material ---
    let material;
    let blending = THREE.AdditiveBlending; // Default for stars/halo
    let opacity = 1.0;
    let materialColor = null; // Use vertex colors by default where available

    if (type === 'dust') {
        blending = THREE.NormalBlending;
        opacity = parameters.dustOpacity;
        materialColor = parameters.dustColor;
        vertexColorsNeeded = false; // Ensure dust uses material color
    } else if (type === 'halo') {
        opacity = 0.3; // Faint halo
        materialColor = parameters.haloColor;
         vertexColorsNeeded = false; // Ensure halo uses material color
    }

    material = new THREE.PointsMaterial({
        size: size,
        sizeAttenuation: true,
        color: materialColor, // Use this if vertexColors is false or not needed
        vertexColors: vertexColorsNeeded,
        blending: blending,
        transparent: true,
        opacity: opacity,
        depthWrite: false // Important for blending
    });

    // --- Create Points Object ---
    // Filter out unused positions (marked as Infinity earlier, now at 0,0,0)
    // A more efficient way might be needed for huge counts (e.g., build a filtered array)
    // For now, this might be okay, or accept some particles at the origin.

    const points = new THREE.Points(geometry, material);
    return { geometry, material, points };
}


// --- Function to Create Background Stars ---
function createBackgroundStars() {
    const geometry = new THREE.BufferGeometry();
    const count = parameters.backgroundStarCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorPalette = [
        new THREE.Color(0xff8080), // Reddish
        new THREE.Color(0xffaa80), // Orange
        new THREE.Color(0xffffcc), // Yellowish
        new THREE.Color(0xffffff), // White
        new THREE.Color(0xccccff), // Bluish White
        new THREE.Color(0xaaccff)  // Blue
    ];

    for (let i = 0; i < count; i++) {
        const idx = i * 3;

        // Distribute randomly *within* the volume of a large sphere
        const r = Math.pow(Math.random(), 0.5) * parameters.backgroundSphereRadius; // Bias towards outer parts slightly
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx + 2] = r * Math.cos(phi);

        // Assign random color from palette
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)].clone();
        // Add slight brightness variation
        const brightnessFactor = 0.7 + Math.random() * 0.3;
        color.r *= brightnessFactor;
        color.g *= brightnessFactor;
        color.b *= brightnessFactor;

        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: parameters.backgroundStarSize,
        sizeAttenuation: true, // Attenuate distant background stars slightly
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    return { geometry, material, points };
}

// --- Dispose function ---
function disposeObject(obj) {
    if (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
        scene.remove(obj);
    }
}


// --- Generate Simulation ---
function generateSimulation() {
    console.log("Generating Simulation..."); // Log start

    // Dispose old objects
    disposeObject(galaxyPoints);
    disposeObject(dustPoints);
    disposeObject(haloPoints);
    disposeObject(backgroundStarsPoints);

    // Create components
    const galaxyComp = createGalaxyComponent('stars');
    if (galaxyComp) {
        galaxyGeometry = galaxyComp.geometry;
        galaxyMaterial = galaxyComp.material;
        galaxyPoints = galaxyComp.points;
        scene.add(galaxyPoints);
        console.log("Stars added:", parameters.galaxyParticleCount);
    }

    const dustComp = createGalaxyComponent('dust');
     if (dustComp) {
        dustGeometry = dustComp.geometry;
        dustMaterial = dustComp.material;
        dustPoints = dustComp.points;
        // Ensure dust renders correctly relative to stars (can depend on add order and depth settings)
        scene.add(dustPoints);
        console.log("Dust added:", parameters.dustParticleCount);
    }

    const haloComp = createGalaxyComponent('halo');
     if (haloComp) {
        haloGeometry = haloComp.geometry;
        haloMaterial = haloComp.material;
        haloPoints = haloComp.points;
        scene.add(haloPoints);
         console.log("Halo added:", parameters.haloParticleCount);
    }

    const bgComp = createBackgroundStars();
     if (bgComp) {
        backgroundStarsGeometry = bgComp.geometry;
        backgroundStarsMaterial = bgComp.material;
        backgroundStarsPoints = bgComp.points;
        scene.add(backgroundStarsPoints);
         console.log("Background added:", parameters.backgroundStarCount);
    }
     console.log("Generation Complete.");
}

generateSimulation(); // Initial generation

// --- Post-Processing (Bloom for Radiance) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5, // Bloom strength - Adjust!
    0.5, // Bloom radius - Adjust!
    0.85 // Bloom threshold - Higher = only brightest parts bloom (core) - Adjust!
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Rotation (applied to all main components together)
    const delta = 0.00015; // Rotation speed
    if (galaxyPoints) galaxyPoints.rotation.y += delta;
    if (dustPoints) dustPoints.rotation.y += delta;
    if (haloPoints) haloPoints.rotation.y += delta;
    // Background can remain static for parallax
    // if (backgroundStarsPoints) backgroundStarsPoints.rotation.y += delta * 0.1;

    controls.update();
    composer.render();
}

animate();

// --- GUI for Tuning (Highly Recommended) ---
/*
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
const gui = new GUI();
const galaxyFolder = gui.addFolder('Galaxy');
galaxyFolder.add(parameters, 'galaxyParticleCount', 50000, 1000000, 1000).onFinishChange(generateSimulation);
galaxyFolder.add(parameters, 'galaxySize', 0.01, 0.3, 0.005).onChange(() => { if(galaxyMaterial) galaxyMaterial.size = parameters.galaxySize; });
galaxyFolder.add(parameters, 'diskRadius', 10, 100).onFinishChange(generateSimulation);
// ... add many more parameters for arms, bulge, thickness, colors

const dustFolder = gui.addFolder('Dust');
dustFolder.add(parameters, 'dustParticleCount', 5000, 100000, 1000).onFinishChange(generateSimulation);
dustFolder.add(parameters, 'dustSize', 0.05, 0.5, 0.01).onChange(() => { if(dustMaterial) dustMaterial.size = parameters.dustSize; });
dustFolder.add(parameters, 'dustOpacity', 0, 1, 0.01).onChange(() => { if(dustMaterial) dustMaterial.opacity = parameters.dustOpacity; });

const haloFolder = gui.addFolder('Halo');
haloFolder.add(parameters, 'haloParticleCount', 10000, 150000, 1000).onFinishChange(generateSimulation);
haloFolder.add(parameters, 'haloSize', 0.01, 0.5, 0.01).onChange(() => { if(haloMaterial) haloMaterial.size = parameters.haloSize; });
haloFolder.add(parameters, 'haloRadius', 30, 150).onFinishChange(generateSimulation);

const backgroundFolder = gui.addFolder('Background');
backgroundFolder.add(parameters, 'backgroundStarCount', 1000, 50000, 500).onFinishChange(generateSimulation);
backgroundFolder.add(parameters, 'backgroundStarSize', 0.01, 0.3, 0.01).onChange(() => { if(backgroundStarsMaterial) backgroundStarsMaterial.size = parameters.backgroundStarSize; });

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(bloomPass, 'strength', 0, 2, 0.05);
bloomFolder.add(bloomPass, 'radius', 0, 2, 0.05);
bloomFolder.add(bloomPass, 'threshold', 0, 1, 0.01);
*/