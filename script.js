import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

// ======== SETUP SCENE & RENDERER ========
const canvas = document.getElementById('galaxyCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x000000, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 200, 950);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

// ======== POSTPROCESS: BLOOM EFFECT ========
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.1, 0.48, 0.28 // intensity, radius, threshold
);
composer.addPass(bloomPass);

// ======== REALISTIC MILKY WAY PARAMETERS ========
const STAR_COUNT = 520000; // Main stars
const DISK_RADIUS = 600;   // px units
const BULGE_RADIUS = 120;
const SPIRAL_ARM_COUNT = 4;
const SPIRAL_ARM_WIDTH = 42;

// Milky Way blue/white/dust palette
function getStarColor(radius, theta, type) {
    // Bulge: cool white, Arms: blue-white, Dust: dim/dark
    if (type === "bulge")   return new THREE.Color(0xE6EFFF); // very pale blue-white
    if (type === "arm")     return new THREE.Color(0xAABAFE).lerp(new THREE.Color(0xB4D8FA), Math.random()*0.5); // blue-white gradient
    if (type === "dust")    return new THREE.Color(0x191921); // dark, faint blue/gray
    // Halo stars: cool pale
    return new THREE.Color(0xDDDFF8);
}

// ======== CREATE GALAXY ========
const starGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(STAR_COUNT * 3);
const colors = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
    // Generate a bulge, arms, or dust/haze
    let r, theta, x, y, z, type;
    let t = Math.random();
    if (t < 0.13) {
        // Central bulge
        r = BULGE_RADIUS * Math.pow(Math.random(), 0.37);
        theta = Math.random() * 2 * Math.PI;
        x = r * Math.cos(theta) * (0.84 + Math.random()*0.1);
        y = (Math.random()-0.5)*BULGE_RADIUS*0.39;
        z = r * Math.sin(theta) * (0.84 + Math.random()*0.1);
        type = "bulge";
    } else if (t < 0.82) {
        // Disk / spiral arms
        r = Math.random() * (DISK_RADIUS - 20) + 20;
        let arm = Math.floor(Math.random() * SPIRAL_ARM_COUNT);
        let armTheta = (2 * Math.PI / SPIRAL_ARM_COUNT) * arm;
        let spiralOffset = r * 0.32 + Math.pow(r, 1.18) * 0.0022;
        let scatter = (Math.random() - 0.5) * SPIRAL_ARM_WIDTH;
        theta = armTheta + spiralOffset / DISK_RADIUS + scatter / 130;
        x = r * Math.cos(theta);
        y = (Math.random() - 0.5) * (1.5 + r * 0.015); // disk thickness
        z = r * Math.sin(theta);
        // Dust lanes: 10% are dust, the rest blue-white
        type = (Math.random() < 0.10 && r > BULGE_RADIUS * 1.2) ? "dust" : "arm";
    } else {
        // Halo/haze
        r = DISK_RADIUS + Math.pow(Math.random(), 0.38) * 500;
        theta = Math.random() * 2 * Math.PI;
        x = r * Math.cos(theta);
        y = (Math.random() - 0.5) * (DISK_RADIUS * 1.2);
        z = r * Math.sin(theta);
        type = "halo";
    }
    let color = getStarColor(r, theta, type);
    positions[3*i] = x;
    positions[3*i+1] = y;
    positions[3*i+2] = z;
    colors[3*i] = color.r;
    colors[3*i+1] = color.g;
    colors[3*i+2] = color.b;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const starMaterial = new THREE.PointsMaterial({
    size: 2.1, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.86,
    blending: THREE.AdditiveBlending
});
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// ======== GALACTIC PLANE ========
const gridHelper = new THREE.GridHelper(DISK_RADIUS*2, 20, 0x6ec5ff, 0x222d50);
gridHelper.visible = true;
scene.add(gridHelper);

// ======== PNG TEXTURE OVERLAY ========
const loader = new THREE.TextureLoader();
loader.load('9381eba2-d6ac-4ee8-b4cc-0af21aea6b41.png', function (texture) {
    const texMat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.24, depthWrite: false
    });
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(DISK_RADIUS*2.12, DISK_RADIUS*2.12),
        texMat
    );
    plane.position.set(0, 0, 0.1); // Tiny offset above the star field
    plane.rotation.x = -Math.PI/2;
    scene.add(plane);
});

// ======== SUN + LABELS (with HTML overlay) ========
const sun = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
sun.position.set(225, 0, 0); // ~27,000 ly from center (scaled)
scene.add(sun);

// Label data (position, text)
const labelsData = [
    { position: new THREE.Vector3(0, 0, 0), text: 'Galactic Center' },
    { position: sun.position, text: 'Sun (Solar System)' }
];
let labels = [];

// Create label DOM elements
function createLabels() {
    labels.forEach(lab => lab.remove());
    labels = [];
    labelsData.forEach(({ position, text }) => {
        const div = document.createElement('div');
        div.className = "galaxy-label";
        div.textContent = text;
        div.style.opacity = "0"; // Start hidden
        document.body.appendChild(div);
        labels.push(div);
    });
}
createLabels();

function updateLabels() {
    const width = window.innerWidth, height = window.innerHeight;
    labelsData.forEach(({ position }, idx) => {
        const vector = position.clone().project(camera);
        const x = (vector.x * 0.5 + 0.5) * width;
        const y = ( -vector.y * 0.5 + 0.5) * height;
        // Clamp labels within window (15px padding)
        const label = labels[idx];
        label.style.left = Math.max(10, Math.min(x, width - label.offsetWidth - 10)) + 'px';
        label.style.top = Math.max(10, Math.min(y, height - label.offsetHeight - 10)) + 'px';
        // Fade in if onscreen, fade out if not
        if (vector.z < 1 && vector.z > -1 && x > 0 && x < width && y > 0 && y < height) {
            label.style.opacity = '1';
        } else {
            label.style.opacity = '0';
        }
    });
}

// ======== RESIZE HANDLING ========
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
   
