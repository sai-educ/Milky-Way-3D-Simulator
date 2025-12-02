import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// --- Basic Setup ---
const scene = new THREE.Scene();
const canvas = document.getElementById('galaxyCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Set a darker background for better contrast
renderer.setClearColor(0x0a0a20); // Deep blue-purple background as per reference

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000); // Increased far plane
camera.position.set(0, 60, 80); // Adjusted starting view

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1; // Allow closer zoom
controls.maxDistance = 2000; // Allow zooming further out

// Add subtle blue-purple fog for depth
scene.fog = new THREE.FogExp2(0x1a0a30, 0.00008);

// --- Scientifically Accurate Milky Way Parameters ---
const parameters = {
    // Core Galaxy
    galaxyParticleCount: 200000, // Reduced for performance
    galaxySize: 0.05,
    diskRadius: 50,
    diskThicknessBase: 0.4,      // Thinner for better definition
    diskThicknessEdgeFactor: 4.0,

    // Bulge & Bar parameters
    bulgeRadius: 8,            // Slightly smaller, more concentrated bulge
    bulgeHeight: 4,
    bulgeDensityFactor: 6,

    // Bar parameters
    barLength: 22,             // Longer bar as seen in reference
    barWidth: 5,               // Thicker bar
    barHeight: 1.2,
    barDensityFactor: 6,

    // Spiral Arm Parameters
    numArms: 2,                // Milky Way has 2 major arms (Perseus & Scutum-Centaurus)
    armNames: ['Perseus', 'Scutum-Centaurus'],
    armTightness: 0.45,        // Tighter winding
    armSpreadY: 3,
    armWindingFactor: 4.0,     // More winding
    armWidth: [0.25, 0.25],      // Thinner arms for realism
    armPhaseOffset: [0, Math.PI], // 180 degrees apart

    // Additional features
    localArmEnabled: true,
    localArmPhaseOffset: -0.2, // Adjusted position for Local Arm
    localArmSize: 0.4,           // Thinner local arm
    localArmLength: 0.6,

    // Star Colors (scientifically based)
    // Star Colors (scientifically based on the reference image)
    starPopulations: {
        // Population I: Young, metal-rich disk stars
        youngBlue: new THREE.Color("#d0e0ff"),   // Bright blue-white (reference image)
        youngWhite: new THREE.Color("#ffffff"),  // Pure white
        yellowSun: new THREE.Color("#ffcc66"),   // Bright yellow (core)
        orangeK: new THREE.Color("#ff9944"),     // Bright orange (core)
        redM: new THREE.Color("#ff7050"),        // Red-orange

        // Population II: Old, metal-poor halo stars
        oldRed: new THREE.Color("#d05040"),      // Dimmer red
        oldYellow: new THREE.Color("#ffcc80"),   // Warm yellow

        // Special star types
        blueGiant: new THREE.Color("#a0c0ff"),   // Bright blue-white giants
        redGiant: new THREE.Color("#ff6030"),    // Red giants
        hiiRegion: new THREE.Color("#aa55cc")    // Purple/magenta H-II regions (reference)
    },

    // Population ratios (for realism)
    populationRatios: {
        diskPopI: 0.75,        // % of disk stars that are Pop I
        diskPopII: 0.25,       // % of disk stars that are Pop II
        bulgePopI: 0.2,        // % of bulge stars that are Pop I
        bulgePopII: 0.8,       // % of bulge stars that are Pop II
        haloPopI: 0.05,        // % of halo stars that are Pop I
        haloPopII: 0.95        // % of halo stars that are Pop II
    },

    // Dust Lanes
    dustParticleCount: 40000,  // Reduced for performance
    dustSize: 0.15,
    dustOpacity: 0.35,         // Slightly more transparent
    dustColor: new THREE.Color("#3a2050"), // Purple dust (reference image)
    dustConcentration: 0.8,    // More concentrated in arms

    // Halo Component
    haloParticleCount: 30000,  // Reduced for performance
    haloRadius: 100,           // Extends beyond disk
    haloThickness: 70,         // More spherical
    haloSize: 0.08,
    haloColor: new THREE.Color("#406080"), // Subtle blue-grey halo

    // Globular Clusters
    globularClusters: true,
    globularCount: 8,         // Will generate globular clusters
    globularRadius: 3,
    globularDistanceRange: [20, 70],

    // Background Stars
    backgroundStarCount: 8000, // Reduced for performance
    backgroundStarSize: 0.06,
    backgroundSphereRadius: 2500,

    // Visualization options
    rotationSpeed: 0.00010,    // Slower, majestic rotation
    showLabels: true,
    labelScale: 1.0
};

// --- Variables for simulation objects ---
let galaxyGeometry, galaxyMaterial, galaxyPoints;
let barGeometry, barMaterial, barPoints;
let dustGeometry, dustMaterial, dustPoints;
let haloGeometry, haloMaterial, haloPoints;
let globularClusters = [];
let backgroundStarsGeometry, backgroundStarsMaterial, backgroundStarsPoints;
let armLabels = [];            // For text labels
let galacticPlane;
let rotationEnabled = true;    // Flag to toggle rotation

// --- Create a logarithmic spiral function for more accurate arms ---
function logarithmicSpiral(r, angle, armIndex) {
    // r = a * e^(b * theta)
    const a = 1.0;
    const b = parameters.armTightness;
    const baseAngle = parameters.armPhaseOffset[armIndex];
    const theta = angle + baseAngle;
    return a * Math.exp(b * theta);
}

// --- Function to Create Galaxy Component (Stars/Dust/Halo/Bar) ---
function createGalaxyComponent(type) {
    let count, size, vertexColorsNeeded;
    let geometry = new THREE.BufferGeometry();

    switch (type) {
        case 'stars':
            count = parameters.galaxyParticleCount;
            size = parameters.galaxySize;
            vertexColorsNeeded = true;
            break;
        case 'bar':
            count = Math.floor(parameters.galaxyParticleCount * 0.15); // 15% of stars in bar
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
            vertexColorsNeeded = true; // For varying halo star colors
            break;
        default: return null;
    }

    const positions = new Float32Array(count * 3);
    const colors = vertexColorsNeeded ? new Float32Array(count * 3) : null;
    const sizes = new Float32Array(count); // For varying star sizes

    for (let i = 0; i < count; i++) {
        const idx = i * 3;
        let x, y, z;
        let distanceFromCenterXZ; // Distance projected onto the galactic plane
        let stellarType = ''; // Used to determine star color
        let starSize = 1.0; // Default star size multiplier

        // --- Different distributions based on component type ---
        if (type === 'halo') {
            // --- Halo Distribution (Spheroidal) ---
            // Use proper dark matter halo distribution (simplified NFW profile)
            const r = Math.pow(Math.random(), 0.8) * parameters.haloRadius;
            const theta = Math.random() * Math.PI * 2;
            // Less flattened than disk but still somewhat oblate
            const phi = Math.acos(2 * Math.random() - 1);

            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta) * (parameters.haloThickness / parameters.haloRadius);
            z = r * Math.cos(phi);
            distanceFromCenterXZ = Math.sqrt(x * x + z * z);

            // Halo populations - mostly Population II
            const isPopII = Math.random() < parameters.populationRatios.haloPopII;
            if (isPopII) {
                // Old, metal-poor stars
                stellarType = Math.random() < 0.7 ? 'oldYellow' : 'oldRed';
            } else {
                // Very few young stars in halo
                stellarType = 'yellowSun';
            }

            // Halo stars are generally dimmer
            starSize = 0.5 + Math.random() * 0.5;

        } else if (type === 'bar') {
            // --- Central Bar Distribution ---
            // Elongated bar shape characteristic of barred spirals
            const u = Math.random() * 2 - 1; // -1 to 1
            const barRandom = Math.random();

            // Bar position along major axis (elongated)
            x = u * parameters.barLength;

            // Bar gets narrower toward the ends (quadratic shape)
            const maxBarWidth = parameters.barWidth * (1 - Math.pow(Math.abs(u), 2) * 0.6);
            z = (barRandom * 2 - 1) * maxBarWidth;

            // Bar height distribution (thinner than bulge)
            const heightRandom = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1);
            y = heightRandom * parameters.barHeight;

            distanceFromCenterXZ = Math.sqrt(x * x + z * z);

            // Bar stellar composition - mix of old and younger stars
            const isPopI = Math.random() < parameters.populationRatios.bulgePopI;
            if (isPopI) {
                // Some younger stars in the bar
                const randStar = Math.random();
                if (randStar < 0.1) stellarType = 'youngWhite';
                else if (randStar < 0.4) stellarType = 'yellowSun';
                else stellarType = 'orangeK';
            } else {
                // Older population stars
                stellarType = Math.random() < 0.7 ? 'oldYellow' : 'oldRed';
                if (Math.random() < 0.05) stellarType = 'redGiant';
            }

            // Add more brighter stars in bar
            starSize = 0.7 + Math.random() * 0.8;

        } else if (type === 'dust' || type === 'stars') {
            // --- Determine if in bulge, arms, or disk ---
            const radiusFraction = Math.random(); // Used to distribute along radius
            let radius, angle, inSpiralArm = false, armIndex = -1;

            // Bulge Distribution (applies only to stars)
            const bulgeChance = Math.exp(-radiusFraction * 6) * parameters.bulgeDensityFactor;
            if (type === 'stars' && Math.random() < bulgeChance) {
                // Spheroidal bulge
                const r_bulge = Math.random() * parameters.bulgeRadius;
                const theta_bulge = Math.random() * Math.PI * 2;
                const phi_bulge = Math.acos(2 * Math.random() - 1);

                // Flattened spheroid for the bulge
                const flatteningFactor = 0.7; // Bulge height/width ratio
                x = r_bulge * Math.sin(phi_bulge) * Math.cos(theta_bulge);
                z = r_bulge * Math.sin(phi_bulge) * Math.sin(theta_bulge);
                y = r_bulge * Math.cos(phi_bulge) * flatteningFactor;

                distanceFromCenterXZ = Math.sqrt(x * x + z * z);

                // Bulge stellar populations
                const isPopI = Math.random() < parameters.populationRatios.bulgePopI;
                if (isPopI) {
                    // Younger stars (minority in bulge)
                    const randStar = Math.random();
                    if (randStar < 0.2) stellarType = 'yellowSun';
                    else stellarType = 'orangeK';
                } else {
                    // Older population (majority in bulge)
                    const randStar = Math.random();
                    if (randStar < 0.6) stellarType = 'oldYellow';
                    else if (randStar < 0.9) stellarType = 'oldRed';
                    else stellarType = 'redGiant'; // Some giants
                }

                // Brighter core
                starSize = 0.8 + Math.random() * 0.6;

            } else {
                // Disk / Spiral Arm Distribution
                radius = radiusFraction * parameters.diskRadius;
                angle = Math.random() * Math.PI * 2;

                // Determine if in a spiral arm
                // Check each arm
                for (let a = 0; a < parameters.numArms; a++) {
                    // Check if we're in this arm
                    const armWidth = parameters.armWidth[a] || parameters.armWidth[0];
                    const armPhase = parameters.armPhaseOffset[a] || 0;

                    // Distance along arm
                    const armDistance = radius / parameters.diskRadius;

                    // Arm angle at this radius
                    const spiralOffset = armDistance * parameters.armWindingFactor;
                    const idealArmAngle = armPhase + spiralOffset / parameters.armTightness;

                    // Angular distance from ideal arm position
                    let angleDelta = Math.abs(((angle - idealArmAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
                    if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta;

                    // Max allowed angle variation - tighter for thinner arms
                    const maxAngleSpread = armWidth * (0.3 - 0.2 * armDistance);

                    if (angleDelta < maxAngleSpread) {
                        inSpiralArm = true;
                        armIndex = a;
                        break;
                    }
                }

                // Check Local Arm (Orion Arm) - smaller secondary arm
                if (!inSpiralArm && parameters.localArmEnabled) {
                    const localArmPhase = parameters.localArmPhaseOffset;
                    const armDistance = radius / parameters.diskRadius;

                    // Local arm only exists in middle part of the disk
                    if (armDistance > 0.3 && armDistance < 0.7) {
                        const spiralOffset = armDistance * parameters.armWindingFactor;
                        const idealArmAngle = localArmPhase + spiralOffset / parameters.armTightness;

                        let angleDelta = Math.abs(((angle - idealArmAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
                        if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta;

                        const maxAngleSpread = parameters.localArmSize * (0.4 - 0.2 * armDistance);

                        if (angleDelta < maxAngleSpread) {
                            inSpiralArm = true;
                            armIndex = -99; // Special code for local arm
                        }
                    }
                }

                // Modify position based on arm membership
                let armPerturbation = 0;
                if (inSpiralArm) {
                    // Add some scatter along the arm
                    const scatterDistance = Math.pow(Math.random(), 2) * radius * 0.1; // More scatter near center
                    const scatterAngle = (Math.random() * 2 - 1) * Math.PI * 0.1; // Small angle variation

                    // Apply scatter
                    radius += scatterDistance;
                    angle += scatterAngle;

                    // Add arm perturbation (warp) for dust
                    if (type === 'dust') {
                        armPerturbation = Math.sin(radius * 0.2) * 0.2;
                    }
                }

                // Calculate final position
                x = Math.cos(angle) * radius;
                z = Math.sin(angle) * radius;

                // Determine disk thickness based on position
                let currentDiskThickness = parameters.diskThicknessBase * (1.0 - Math.pow(radius / parameters.diskRadius, parameters.diskThicknessEdgeFactor));

                // Thicker in arms
                if (inSpiralArm) {
                    currentDiskThickness *= 1.3;
                }

                // Y-position (height above/below disk)
                // Use exponential distribution for more concentration near plane
                const heightRandom = (Math.random() < 0.5 ? -1 : 1) * Math.pow(Math.random(), 2);
                y = heightRandom * currentDiskThickness;

                // Dust lies closer to the plane and follows arms more strictly
                if (type === 'dust') {
                    if (!inSpiralArm && Math.random() > parameters.dustConcentration) {
                        // Skip this dust particle - concentrate dust in arms
                        positions[idx] = Infinity; // Mark for skipping
                        continue;
                    }

                    // Dust is concentrated near the plane
                    y *= 0.3;

                    // Add the arm perturbation to create dust lanes
                    y += armPerturbation;
                }

                distanceFromCenterXZ = Math.sqrt(x * x + z * z);

                // --- Determine star type based on region and population ---
                if (type === 'stars') {
                    // Base populations - different in arms vs disk
                    let isPopI;
                    if (inSpiralArm) {
                        isPopI = Math.random() < 0.95; // Arms are mostly Population I
                    } else {
                        isPopI = Math.random() < parameters.populationRatios.diskPopI;
                    }

                    if (isPopI) {
                        // Young, metal-rich Population I stars
                        const randStar = Math.random();

                        if (inSpiralArm) {
                            // Arms have more color variety
                            if (randStar < 0.008) stellarType = 'youngBlue'; // Slightly more blue for contrast
                            else if (randStar < 0.08) stellarType = 'youngWhite'; // More white stars
                            else if (randStar < 0.25) stellarType = 'yellowSun'; // Reduced yellow
                            else if (randStar < 0.65) stellarType = 'orangeK'; // K stars
                            else stellarType = 'redM'; // M stars

                            // Some special types in arms
                            if (randStar < 0.002) stellarType = 'blueGiant';
                            else if (randStar < 0.015 && Math.random() < 0.3) stellarType = 'hiiRegion';
                        } else {
                            // Regular disk
                            if (randStar < 0.0002) stellarType = 'youngBlue';
                            else if (randStar < 0.02) stellarType = 'youngWhite';
                            else if (randStar < 0.15) stellarType = 'yellowSun';
                            else if (randStar < 0.55) stellarType = 'orangeK';
                            else stellarType = 'redM';
                        }
                    } else {
                        // Older Population II stars
                        const randStar = Math.random();
                        if (randStar < 0.7) stellarType = 'oldYellow';
                        else if (randStar < 0.95) stellarType = 'oldRed';
                        else stellarType = 'redGiant'; // Some giants
                    }

                    // Star size varies by type
                    if (stellarType === 'youngBlue' || stellarType === 'blueGiant') {
                        starSize = 1.2 + Math.random() * 0.8; // Larger
                    } else if (stellarType === 'youngWhite') {
                        starSize = 1.0 + Math.random() * 0.5;
                    } else if (stellarType === 'redGiant') {
                        starSize = 1.5 + Math.random() * 1.0; // Largest
                    } else if (stellarType === 'hiiRegion') {
                        starSize = 1.3 + Math.random() * 0.7; // Larger for nebulae
                    } else {
                        starSize = 0.7 + Math.random() * 0.5; // Normal stars
                    }

                    // Distance-based dimming
                    const distanceFactor = 1.0 - Math.pow(distanceFromCenterXZ / parameters.diskRadius, 0.7) * 0.3;
                    starSize *= distanceFactor;
                }
            }
        }

        // Check for valid position before assigning
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            x = y = z = 0; // Assign to origin if calculation failed
            console.warn("NaN position calculated for particle type:", type);
        }

        // Assign final positions, skipping those marked Infinity
        if (positions[idx] !== Infinity) {
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;
            if (sizes) {
                sizes[i] = starSize * parameters.galaxySize;
            }
        } else {
            // Ensure skipped particles are properly marked
            positions[idx] = 0;
            positions[idx + 1] = 0;
            positions[idx + 2] = 0;
            if (sizes) {
                sizes[i] = 0; // Zero size for skipped particles
            }
        }

        // --- Color Assignment ---
        if (type === 'stars' || type === 'bar' || type === 'halo') {
            if (colors) {
                let color = new THREE.Color();

                // Assign color based on stellar type
                if (stellarType && parameters.starPopulations[stellarType]) {
                    color.copy(parameters.starPopulations[stellarType]);
                } else {
                    // Fallback based on distance from center
                    const lerpFactor = Math.min(distanceFromCenterXZ / (parameters.diskRadius * 0.7), 1.0);
                    color.lerpColors(
                        parameters.starPopulations.yellowSun,
                        parameters.starPopulations.oldYellow,
                        lerpFactor
                    );
                }

                // Apply more realistic color distribution
                // Slight color variations for realism
                const variation = 0.05;
                color.r += (Math.random() - 0.5) * variation;
                color.g += (Math.random() - 0.5) * variation;
                color.b += (Math.random() - 0.5) * variation;

                // Increase brightness for certain types (reference image aesthetic)
                if (stellarType === 'blueGiant' || stellarType === 'youngBlue') {
                    color.multiplyScalar(2.0); // Much brighter for blue stars
                } else if (stellarType === 'youngWhite') {
                    color.multiplyScalar(1.8); // Bright white stars
                } else if (stellarType === 'yellowSun' || stellarType === 'orangeK') {
                    color.multiplyScalar(1.5); // Bright core colors
                }

                // Store final color
                colors[idx] = color.r;
                colors[idx + 1] = color.g;
                colors[idx + 2] = color.b;
            }
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // Variable sizes for stars
    if (type === 'stars' || type === 'bar' || type === 'halo') {
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    }

    // --- Material ---
    let material;
    let blending = THREE.AdditiveBlending; // Default for stars
    let opacity = 1.0;
    let materialColor = null;
    let sizeAttenuation = true; // Default - distant stars look smaller

    if (type === 'dust') {
        blending = THREE.NormalBlending;
        opacity = parameters.dustOpacity;
        materialColor = parameters.dustColor;
        vertexColorsNeeded = false;
    } else if (type === 'halo') {
        opacity = 0.6; // Faint halo with individual star colors
        sizeAttenuation = true;
        vertexColorsNeeded = true;
    } else if (type === 'stars' || type === 'bar') {
        opacity = 0.9;
        vertexColorsNeeded = true;
    }

    // Custom shader material for realistic star rendering
    if (type === 'stars' || type === 'bar' || type === 'halo') {
        const vertexShader = `
            attribute float size;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            varying vec3 vColor;
            
            void main() {
                // Calculate distance from center of point (0.0-1.0)
                float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                
                // Gaussian falloff for realistic star rendering
                float intensity = 0.5 + 0.5 * exp(-r * 5.0);
                
                if (r > 0.5) discard; // Clip to circle
                
                gl_FragColor = vec4(vColor * intensity, 1.0);
            }
        `;

        material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: blending,
            depthTest: true,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
    } else {
        material = new THREE.PointsMaterial({
            size: size,
            sizeAttenuation: sizeAttenuation,
            color: materialColor,
            vertexColors: vertexColorsNeeded,
            blending: blending,
            transparent: true,
            opacity: opacity,
            depthWrite: false
        });
    }

    // Create Points Object
    const points = new THREE.Points(geometry, material);
    return { geometry, material, points };
}

// --- Function to create globular clusters ---
function createGlobularClusters() {
    const clusters = [];

    for (let c = 0; c < parameters.globularCount; c++) {
        // Cluster parameters
        const starCount = 150 + Math.floor(Math.random() * 250); // 150-400 stars
        const clusterRadius = parameters.globularRadius * (0.5 + Math.random());

        // Position cluster in a spherical halo around the galaxy
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.acos(Math.random() * 2 - 1);

        // Distance from galactic center - using actual Milky Way distribution
        // Most globular clusters are 20-70 kpc from center
        const minDist = parameters.globularDistanceRange[0];
        const maxDist = parameters.globularDistanceRange[1];
        const r = minDist + Math.pow(Math.random(), 0.8) * (maxDist - minDist);

        const clusterCenter = new THREE.Vector3(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.sin(theta) * Math.sin(phi) * 0.8, // Slightly flattened distribution
            r * Math.cos(theta)
        );

        // Create cluster geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        // Generate stars for this cluster
        for (let i = 0; i < starCount; i++) {
            const idx = i * 3;

            // Use Plummer model for realistic globular cluster density distribution
            const rad = clusterRadius * Math.pow(Math.random(), -0.5);
            const phi_star = Math.random() * Math.PI * 2; // Renamed to avoid conflict with outer phi
            const theta_star = Math.acos(Math.random() * 2 - 1); // Renamed to avoid conflict

            // Position relative to cluster center
            positions[idx] = clusterCenter.x + rad * Math.sin(theta_star) * Math.cos(phi_star);
            positions[idx + 1] = clusterCenter.y + rad * Math.sin(theta_star) * Math.sin(phi_star);
            positions[idx + 2] = clusterCenter.z + rad * Math.cos(theta_star);

            // Globular clusters are mostly old, Population II stars
            const starType = Math.random() < 0.9 ? 'oldYellow' : 'oldRed';
            let color;

            if (starType === 'oldYellow') {
                color = parameters.starPopulations.oldYellow.clone();
            } else {
                color = parameters.starPopulations.oldRed.clone();
            }

            // Add slight color variation
            const variation = 0.05;
            color.r += (Math.random() - 0.5) * variation;
            color.g += (Math.random() - 0.5) * variation;
            color.b += (Math.random() - 0.5) * variation;

            colors[idx] = color.r;
            colors[idx + 1] = color.g;
            colors[idx + 2] = color.b;

            // Star sizes - central stars tend to be larger
            const sizeFactor = 0.5 + Math.random() * 0.5;
            sizes[i] = parameters.galaxySize * sizeFactor * 0.8;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Create shader material for cluster stars
        const material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                    float intensity = 0.5 + 0.5 * exp(-r * 5.0);
                    
                    if (r > 0.5) discard;
                    
                    gl_FragColor = vec4(vColor * intensity, 1.0);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        const points = new THREE.Points(geometry, material);
        clusters.push(points);
        scene.add(points);
    }

    return clusters;
}

// --- Function to Create Background Stars ---
function createBackgroundStars() {
    const geometry = new THREE.BufferGeometry();
    const count = parameters.backgroundStarCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Color palette based on stellar classification
    const colorPalette = [
        parameters.starPopulations.youngBlue,  // O-type, very rare
        parameters.starPopulations.youngWhite, // A-type
        parameters.starPopulations.yellowSun,  // G-type
        parameters.starPopulations.orangeK,    // K-type
        parameters.starPopulations.redM        // M-type, most common
    ];

    // Weights reflect actual stellar distribution in our galaxy (mostly red/orange)
    const weights = [0.001, 0.01, 0.1, 0.2, 0.689]; // Heavily weighted towards M/K stars

    for (let i = 0; i < count; i++) {
        const idx = i * 3;

        // Distribute stars in a large sphere
        // Use a distance distribution that increases with radius^2 for uniform density
        const r = Math.pow(Math.random(), 1 / 3) * parameters.backgroundSphereRadius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx + 2] = r * Math.cos(phi);

        // Choose star color based on weighted distribution
        let colorIndex = 0;
        const rand = Math.random();
        let cumulativeWeight = 0;

        for (let j = 0; j < weights.length; j++) {
            cumulativeWeight += weights[j];
            if (rand < cumulativeWeight) {
                colorIndex = j;
                break;
            }
        }

        const color = colorPalette[colorIndex].clone();

        // Add slight brightness variation
        const brightnessFactor = 0.7 + Math.random() * 0.3;
        color.r *= brightnessFactor;
        color.g *= brightnessFactor;
        color.b *= brightnessFactor;

        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;

        // Size based on type - brighter stars are larger
        let sizeMultiplier;
        if (colorIndex === 0) sizeMultiplier = 1.3; // O-type, larger
        else if (colorIndex === 1) sizeMultiplier = 1.1; // A-type
        else sizeMultiplier = 0.8 + Math.random() * 0.4; // Others

        sizes[i] = parameters.backgroundStarSize * sizeMultiplier;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Use same shader material as other stars for consistency
    const material = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                float r = distance(gl_PointCoord, vec2(0.5, 0.5));
                float intensity = 0.5 + 0.5 * exp(-r * 5.0);
                
                if (r > 0.5) discard;
                
                gl_FragColor = vec4(vColor * intensity, 1.0);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    const points = new THREE.Points(geometry, material);
    return { geometry, material, points };
}

// --- Create Educational Labels ---
function createArmLabels() {
    // Clear any existing labels
    armLabels.forEach(label => scene.remove(label));
    armLabels = [];

    if (!parameters.showLabels) return;

    // Create a label for each spiral arm
    for (let i = 0; i < parameters.numArms; i++) {
        // Create text sprite with larger canvas for better text rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640;  // MODIFIED: Increased width to prevent cutoff
        canvas.height = 256;

        // Background with slight transparency
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Text with proper padding
        context.font = 'bold 64px Arial';
        context.fillStyle = '#CCCCCC'; // MODIFIED: Less bright color to reduce glow
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(parameters.armNames[i], canvas.width / 2, canvas.height / 2);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });

        const sprite = new THREE.Sprite(material);

        // Position at a good point along the arm
        const armPhase = parameters.armPhaseOffset[i];
        const radius = parameters.diskRadius * 0.7;
        const angle = armPhase + (radius / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness;

        sprite.position.set(
            Math.cos(angle) * radius,
            8,
            Math.sin(angle) * radius
        );

        // Adjusted scale for the larger canvas but similar visual size
        // Consider adjusting these values if labels appear too large or small after canvas width change
        const adjustedScaleWidth = (canvas.width / 512) * 14 * parameters.labelScale;
        const adjustedScaleHeight = (canvas.height / 256) * 7 * parameters.labelScale;
        sprite.scale.set(adjustedScaleWidth, adjustedScaleHeight, 1);

        armLabels.push(sprite);
        scene.add(sprite);
    }

    // Add Local Arm label if enabled
    if (parameters.localArmEnabled) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640; // MODIFIED: Increased width
        canvas.height = 256;

        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = 'bold 56px Arial';
        context.fillStyle = '#CCCCCC'; // MODIFIED: Less bright color
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Orion Arm', canvas.width / 2, canvas.height / 2 - 20);
        context.font = '36px Arial';
        context.fillText('(Local Arm)', canvas.width / 2, canvas.height / 2 + 40);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });

        const sprite = new THREE.Sprite(material);

        // Position at the middle of the local arm
        const armPhase = parameters.localArmPhaseOffset;
        const radius = parameters.diskRadius * 0.5;
        const angle = armPhase + (radius / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness;

        sprite.position.set(
            Math.cos(angle) * radius,
            7,
            Math.sin(angle) * radius
        );

        const adjustedScaleWidth = (canvas.width / 512) * 14 * parameters.labelScale;
        const adjustedScaleHeight = (canvas.height / 256) * 7 * parameters.labelScale;
        sprite.scale.set(adjustedScaleWidth, adjustedScaleHeight, 1);
        armLabels.push(sprite);
        scene.add(sprite);
    }

    // Add Sun position marker (text label)
    const sunTextCanvas = document.createElement('canvas'); // Renamed to avoid conflict
    const sunTextContext = sunTextCanvas.getContext('2d'); // Renamed to avoid conflict
    sunTextCanvas.width = 256;
    sunTextCanvas.height = 256;

    sunTextContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
    sunTextContext.fillRect(0, 0, sunTextCanvas.width, sunTextCanvas.height);

    sunTextContext.font = 'bold 48px Arial';
    sunTextContext.fillStyle = '#DCDC00'; // MODIFIED: Less bright yellow to reduce glow
    sunTextContext.textAlign = 'center';
    sunTextContext.textBaseline = 'middle';
    sunTextContext.fillText('Sun', sunTextCanvas.width / 2, sunTextCanvas.height / 2);

    const sunTexture = new THREE.CanvasTexture(sunTextCanvas); // Use renamed canvas
    const sunLabelMaterial = new THREE.SpriteMaterial({  // Renamed to avoid conflict
        map: sunTexture,
        transparent: true,
        depthWrite: false
    });

    const sunSprite = new THREE.Sprite(sunLabelMaterial); // Renamed to avoid conflict

    const sunRadius = parameters.diskRadius * 0.55;
    const sunAngle = parameters.localArmPhaseOffset + (sunRadius / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness - 0.2;

    sunSprite.position.set(
        Math.cos(sunAngle) * sunRadius,
        2,
        Math.sin(sunAngle) * sunRadius
    );

    sunSprite.scale.set(7 * parameters.labelScale, 7 * parameters.labelScale, 1);
    armLabels.push(sunSprite);
    scene.add(sunSprite);

    // Create actual visible Sun marker with glow
    const sunGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
        emissive: 0xffffaa,
        emissiveIntensity: 3
    });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.set(
        Math.cos(sunAngle) * sunRadius,
        0,
        Math.sin(sunAngle) * sunRadius
    );

    const sunGlowGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffdd,
        transparent: true,
        opacity: 0.4,
        side: THREE.BackSide
    });
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    sunMesh.add(sunGlow);

    armLabels.push(sunMesh);
    scene.add(sunMesh);

    // Add a central core label
    const coreCanvas = document.createElement('canvas');
    const coreContext = coreCanvas.getContext('2d');
    coreCanvas.width = 640; // MODIFIED: Increased width
    coreCanvas.height = 256;

    coreContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
    coreContext.fillRect(0, 0, coreCanvas.width, coreCanvas.height);

    coreContext.font = 'bold 56px Arial';
    coreContext.fillStyle = '#CCCCCC'; // MODIFIED: Less bright color
    coreContext.textAlign = 'center';
    coreContext.textBaseline = 'middle';
    coreContext.fillText('Galactic Center', coreCanvas.width / 2, coreCanvas.height / 2 - 20);
    coreContext.font = '36px Arial';
    coreContext.fillText('Sagittarius A*', coreCanvas.width / 2, coreCanvas.height / 2 + 40);

    const coreTexture = new THREE.CanvasTexture(coreCanvas);
    const coreMaterial = new THREE.SpriteMaterial({
        map: coreTexture,
        transparent: true,
        depthWrite: false
    });

    const coreSprite = new THREE.Sprite(coreMaterial);
    coreSprite.position.set(0, 12, 0);

    const adjustedCoreScaleWidth = (coreCanvas.width / 512) * 15 * parameters.labelScale;
    const adjustedCoreScaleHeight = (coreCanvas.height / 256) * 7.5 * parameters.labelScale;
    coreSprite.scale.set(adjustedCoreScaleWidth, adjustedCoreScaleHeight, 1);

    armLabels.push(coreSprite);
    scene.add(coreSprite);
}

// --- Add Galactic Plane Reference Grid ---
function createGalacticPlane() {
    const gridSize = parameters.diskRadius * 2.5;
    const divisions = 20;
    const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x222222, 0x080808);
    gridHelper.rotation.x = Math.PI / 2; // Align with galactic plane
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.1;
    scene.add(gridHelper);

    return gridHelper;
}

// --- Dispose function ---
function disposeObject(obj) {
    if (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
            } else {
                obj.material.dispose();
            }
        }
        scene.remove(obj);
    }
}

// --- Generate Simulation ---
function generateSimulation() {
    console.log("Generating Simulation...");

    // Dispose old objects
    disposeObject(galaxyPoints);
    disposeObject(barPoints);
    disposeObject(dustPoints);
    disposeObject(haloPoints);
    disposeObject(backgroundStarsPoints);

    // Clear globular clusters
    globularClusters.forEach(cluster => disposeObject(cluster));
    globularClusters = [];

    // Clear arm labels
    armLabels.forEach(label => scene.remove(label));
    armLabels = [];

    // Create main galaxy components
    const galaxyComp = createGalaxyComponent('stars');
    if (galaxyComp) {
        galaxyGeometry = galaxyComp.geometry;
        galaxyMaterial = galaxyComp.material;
        galaxyPoints = galaxyComp.points;
        scene.add(galaxyPoints);
        console.log("Stars added:", parameters.galaxyParticleCount);
    }

    // Create bar component
    const barComp = createGalaxyComponent('bar');
    if (barComp) {
        barGeometry = barComp.geometry;
        barMaterial = barComp.material;
        barPoints = barComp.points;
        scene.add(barPoints);
        console.log("Bar added");
    }

    // Create dust lanes
    const dustComp = createGalaxyComponent('dust');
    if (dustComp) {
        dustGeometry = dustComp.geometry;
        dustMaterial = dustComp.material;
        dustPoints = dustComp.points;
        scene.add(dustPoints);
        console.log("Dust added:", parameters.dustParticleCount);
    }

    // Create stellar halo
    const haloComp = createGalaxyComponent('halo');
    if (haloComp) {
        haloGeometry = haloComp.geometry;
        haloMaterial = haloComp.material;
        haloPoints = haloComp.points;
        scene.add(haloPoints);
        console.log("Halo added:", parameters.haloParticleCount);
    }

    // Create globular clusters if enabled
    if (parameters.globularClusters) {
        globularClusters = createGlobularClusters();
        console.log("Globular clusters added:", parameters.globularCount);
    }

    // Create background stars
    const bgComp = createBackgroundStars();
    if (bgComp) {
        backgroundStarsGeometry = bgComp.geometry;
        backgroundStarsMaterial = bgComp.material;
        backgroundStarsPoints = bgComp.points;
        scene.add(backgroundStarsPoints);
        console.log("Background added:", parameters.backgroundStarCount);
    }

    // Create educational labels
    createArmLabels();

    // Create galactic plane reference
    if (galacticPlane) { // Dispose old one if exists
        scene.remove(galacticPlane);
        galacticPlane.geometry.dispose();
        galacticPlane.material.dispose();
    }
    galacticPlane = createGalacticPlane();

    console.log("Generation Complete.");
}

// --- Post-Processing (Bloom for Radiance) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,    // Bloom strength (increased for reference image glow)
    0.8,    // Bloom radius (increased for better spread)
    0.55    // Bloom threshold (lower to catch more bright areas)
);

// Add FXAA for smoother stars
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * window.devicePixelRatio);
fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * window.devicePixelRatio);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(fxaaPass);

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    // Update camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer and composer
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    // Update FXAA resolution
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * window.devicePixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * window.devicePixelRatio);
});

// --- Guided Tour Functions (using GSAP if available) ---
function startGuidedTour() {
    let tourStep = 0;
    const tourSteps = [
        {
            position: { x: 0, y: 120, z: 0 },
            target: { x: 0, y: 0, z: 0 },
            message: "Welcome to the Milky Way Galaxy simulation. This is a top-down view of our galaxy, showing its spiral arm structure."
        },
        {
            position: { x: 0, y: 90, z: 90 },
            target: { x: 0, y: 0, z: 0 },
            message: "The Milky Way has four major spiral arms: Perseus, Scutum-Centaurus, Sagittarius, and the Outer arm."
        },
        {
            position: { x: 40, y: 50, z: 40 },
            target: { x: 0, y: 0, z: 0 },
            message: "Our galaxy is a barred spiral galaxy. Notice the elongated bar structure in the center, approximately 27,000 light-years in length."
        },
        {
            position: { x: 0, y: 15, z: 40 },
            target: { x: 0, y: 0, z: 0 },
            message: "The central bulge contains mostly older, redder stars. It's about 10,000 light-years in radius."
        },
        {
            position: { x: 0, y: 10, z: 120 },
            target: { x: 0, y: 0, z: 0 },
            message: "From the edge, you can see that the Milky Way is quite thin compared to its diameter - only about 1,000 light-years thick."
        },
        {
            position: { x: 60, y: 60, z: 60 },
            target: { x: 0, y: 0, z: 0 },
            message: "The stellar halo surrounds the disk and contains older stars and globular clusters orbiting our galaxy."
        },
        {
            position: { x: 30, y: 10, z: 10 }, // Positioned closer to the Sun
            target: { // Look towards the Sun's approximate location for context
                x: parameters.diskRadius * 0.55 * Math.cos(parameters.localArmPhaseOffset + (parameters.diskRadius * 0.55 / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness - 0.2),
                y: 0,
                z: parameters.diskRadius * 0.55 * Math.sin(parameters.localArmPhaseOffset + (parameters.diskRadius * 0.55 / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness - 0.2)
            },
            message: "Our Sun is located about 27,000 light-years from the galactic center, in a smaller feature called the Orion Arm (or Local Arm)."
        },
        {
            position: { x: 0, y: 90, z: 100 },
            target: { x: 0, y: 0, z: 0 },
            message: "This concludes our tour. Feel free to explore the galaxy using the controls provided."
        }
    ];

    const tourMessageDiv = document.getElementById('tourMessage');
    const tourMessageContent = document.getElementById('tourMessageContent');
    const prevStepButton = document.getElementById('prevStep');
    const nextStepButton = document.getElementById('nextStep');
    const endTourButton = document.getElementById('endTour');

    function showTourMessage(message) {
        if (tourMessageContent) tourMessageContent.textContent = message;
        if (tourMessageDiv) tourMessageDiv.style.display = 'block';
        if (prevStepButton) prevStepButton.disabled = (tourStep === 0);
        if (nextStepButton) nextStepButton.disabled = (tourStep === tourSteps.length - 1);
    }

    function goToTourStep(step) {
        tourStep = step;
        const currentStep = tourSteps[step];

        if (typeof gsap !== 'undefined') {
            gsap.to(camera.position, {
                x: currentStep.position.x,
                y: currentStep.position.y,
                z: currentStep.position.z,
                duration: 2,
                onUpdate: function () {
                    controls.target.set(currentStep.target.x, currentStep.target.y, currentStep.target.z);
                    camera.lookAt(currentStep.target.x, currentStep.target.y, currentStep.target.z);
                },
                onComplete: function () {
                    controls.target.set(currentStep.target.x, currentStep.target.y, currentStep.target.z);
                    camera.lookAt(currentStep.target.x, currentStep.target.y, currentStep.target.z);
                    controls.update(); // Ensure controls internal state is updated
                    showTourMessage(currentStep.message);
                }
            });
        } else { // Fallback if GSAP is not loaded
            camera.position.set(currentStep.position.x, currentStep.position.y, currentStep.position.z);
            controls.target.set(currentStep.target.x, currentStep.target.y, currentStep.target.z);
            camera.lookAt(currentStep.target.x, currentStep.target.y, currentStep.target.z);
            controls.update();
            showTourMessage(currentStep.message);
        }
    }

    if (prevStepButton) {
        prevStepButton.onclick = () => { // Use onclick for simplicity or manage event listeners carefully
            if (tourStep > 0) goToTourStep(tourStep - 1);
        };
    }
    if (nextStepButton) {
        nextStepButton.onclick = () => {
            if (tourStep < tourSteps.length - 1) goToTourStep(tourStep + 1);
        };
    }
    if (endTourButton && tourMessageDiv) {
        endTourButton.onclick = () => {
            tourMessageDiv.style.display = 'none';
        };
    }

    // Start tour
    goToTourStep(tourStep);
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Apply rotation if enabled
    if (rotationEnabled) {
        const delta = parameters.rotationSpeed; // This is a very small value, consider time-based rotation: clock.getDelta() * parameters.rotationSpeed
        if (galaxyPoints) galaxyPoints.rotation.y += delta;
        if (barPoints) barPoints.rotation.y += delta;
        if (dustPoints) dustPoints.rotation.y += delta;
        if (haloPoints) haloPoints.rotation.y += delta;

        if (globularClusters.length > 0) {
            globularClusters.forEach(cluster => {
                cluster.rotation.y += delta * 0.5;
            });
        }

        // Labels should NOT rotate with the galaxy components if they are world-space billboards
        // However, if their positions are relative to a rotating object and you want them to maintain that relative position,
        // their positions would need to be updated, or they'd need to be parented to the rotating object.
        // Current setup has them as independent sprites in world space, so their individual rotation.y is not what we want.
        // They should always face the camera (which sprites do by default unless rotation is manipulated).
        // If the intention was for them to orbit with the galaxy structure, their positions would need recalculation each frame
        // based on the galaxy's rotation. The current code rotates the label objects themselves, which is not standard for billboards.
        // For simplicity, and assuming the labels are meant to be static relative to the galaxy's features,
        // their initial positions are calculated once. If the galaxy rotates, the labels should appear to rotate with it due to their fixed world positions.
        // The current rotation logic for armLabels might make them spin on their own Y-axis, which might not be intended.
        // This line might be problematic:
        // armLabels.forEach(label => { if (label instanceof THREE.Sprite || label instanceof THREE.Mesh) { label.rotation.y += delta; } });
        // Let's remove label.rotation.y += delta; for typical billboard behavior.
        // If you want them to appear to move *with* the galaxy features, their *positions* must be updated relative to the galaxy's rotation.
    }

    controls.update();
    composer.render();

    // Update camera distance display
    const camDistEl = document.getElementById('cameraDistance');
    if (camDistEl) {
        camDistEl.textContent = Math.round(camera.position.length());
    }
}

// --- Set up Event Listeners ---
document.addEventListener('DOMContentLoaded', function () {
    // Label toggle
    const labelToggle = document.getElementById('labelToggle');
    if (labelToggle) {
        labelToggle.addEventListener('change', function () {
            parameters.showLabels = this.checked;
            armLabels.forEach(label => {
                label.visible = this.checked;
            });
        });
    }

    // Rotation toggle
    const rotationToggle = document.getElementById('rotationToggle');
    if (rotationToggle) {
        rotationToggle.addEventListener('change', function () {
            rotationEnabled = this.checked;
        });
    }

    // Grid toggle
    const gridToggle = document.getElementById('gridToggle');
    if (gridToggle) {
        gridToggle.addEventListener('change', function () {
            if (galacticPlane) galacticPlane.visible = this.checked;
        });
    }

    // View selection
    const viewSelection = document.getElementById('viewSelection');
    if (viewSelection) {
        viewSelection.addEventListener('change', function () {
            const view = this.value;
            let targetPosition = { x: 0, y: 0, z: 0 };
            let newCamPos = {};

            switch (view) {
                case 'top':
                    newCamPos = { x: 0, y: 150, z: 0 };
                    break;
                case 'edge':
                    newCamPos = { x: 0, y: 5, z: 150 };
                    break;
                case 'sunperspective':
                    const sunRadius = parameters.diskRadius * 0.55;
                    const sunAngle = parameters.localArmPhaseOffset +
                        (sunRadius / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness - 0.2;
                    const sunX = Math.cos(sunAngle) * sunRadius;
                    const sunZ = Math.sin(sunAngle) * sunRadius;
                    newCamPos = { x: sunX, y: 1, z: sunZ };
                    break;
                default:
                    newCamPos = { x: 0, y: 90, z: 100 };
            }

            if (typeof gsap !== 'undefined') {
                gsap.to(camera.position, {
                    ...newCamPos,
                    duration: 2,
                    onUpdate: function () {
                        controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
                        camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
                    },
                    onComplete: function () {
                        controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
                        camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
                        controls.update();
                    }
                });
            } else {
                camera.position.set(newCamPos.x, newCamPos.y, newCamPos.z);
                controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
                camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
                controls.update();
            }
        });
    }

    // Tour button
    const tourButton = document.getElementById('tourButton');
    if (tourButton) {
        tourButton.addEventListener('click', startGuidedTour);
    }
});

// --- Marker Function ---
function createMarker() {
    // Calculate Sun's position
    const sunRadius = parameters.diskRadius * 0.55;
    // Adjust angle calculation to match the new arm parameters
    // We want the sun in the "Orion Arm" spur
    const sunAngle = parameters.localArmPhaseOffset +
        (sunRadius / parameters.diskRadius) * parameters.armWindingFactor / parameters.armTightness;

    const sunX = Math.cos(sunAngle) * sunRadius;
    const sunZ = Math.sin(sunAngle) * sunRadius;
    const sunY = 0;

    const markerGroup = new THREE.Group();
    markerGroup.position.set(sunX, sunY, sunZ);

    // 1. The Circle (Ring)
    const ringGeometry = new THREE.RingGeometry(1.5, 1.8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Lay flat on galactic plane
    markerGroup.add(ring);

    // 2. The Text Label "We are here"
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.font = 'Bold 40px Arial';
    context.fillStyle = '#ffaa00'; // Orange-ish gold color
    context.textAlign = 'center';
    context.fillText('We are here', 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(-5, 0, 0); // Offset to the left of the ring
    sprite.scale.set(10, 2.5, 1);
    markerGroup.add(sprite);

    // 3. Line connecting text to ring
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.8, 0, 0), // Edge of ring
        new THREE.Vector3(-2.5, 0, 0)  // Towards text
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    markerGroup.add(line);

    scene.add(markerGroup);

    // Make marker look at camera (billboard effect for text, but ring stays flat?)
    // Actually, the reference image shows the text flat or facing camera? 
    // Usually text faces camera. The ring is flat on the plane.
    // We'll let the sprite face the camera automatically.

    return markerGroup;
}

// --- Initialize the simulation ---
generateSimulation();
createMarker(); // Add the marker
animate();

// --- Optional: Debug GUI ---
/*
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
const gui = new GUI({ width: 310 });

// Galaxy structure folder
const structureFolder = gui.addFolder('Galaxy Structure');
structureFolder.add(parameters, 'diskRadius', 20, 100).name('Disk Radius').onFinishChange(generateSimulation);
structureFolder.add(parameters, 'diskThicknessBase', 0.1, 2).name('Disk Thickness').onFinishChange(generateSimulation);
structureFolder.add(parameters, 'numArms', 2, 6, 1).name('Number of Arms').onFinishChange(generateSimulation);
structureFolder.add(parameters, 'armTightness', 0.1, 0.5).name('Arm Tightness').onFinishChange(generateSimulation);
structureFolder.add(parameters, 'localArmEnabled').name('Show Local Arm').onFinishChange(generateSimulation);

// Bar structure folder
const barFolder = gui.addFolder('Bar Structure');
barFolder.add(parameters, 'barLength', 10, 25).name('Bar Length').onFinishChange(generateSimulation);
barFolder.add(parameters, 'barWidth', 2, 10).name('Bar Width').onFinishChange(generateSimulation);
barFolder.add(parameters, 'barHeight', 0.5, 3).name('Bar Height').onFinishChange(generateSimulation);

// Visual settings folder
const visualFolder = gui.addFolder('Visual Settings');
visualFolder.add(bloomPass, 'strength', 0, 2).name('Bloom Strength');
visualFolder.add(bloomPass, 'radius', 0, 1).name('Bloom Radius');
visualFolder.add(parameters, 'rotationSpeed', 0, 0.001).name('Rotation Speed');
visualFolder.add(parameters, 'showLabels').name('Show Labels').onChange(() => {
    armLabels.forEach(label => { label.visible = parameters.showLabels; });
});
*/