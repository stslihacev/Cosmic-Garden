import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { mergeVertices } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000308);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.05, 4.25);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

// ============================================================
// 3D PROCEDURAL TERRAIN
// ============================================================

const noiseSeed = 42;

function hash3D(x, y, z) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + noiseSeed) * 43758.5453;
    return value - Math.floor(value);
}

function fade(value) {
    return value * value * value * (value * (value * 6 - 15) + 10);
}

function noise3D(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);

    const n000 = hash3D(x0, y0, z0);
    const n100 = hash3D(x0 + 1, y0, z0);
    const n010 = hash3D(x0, y0 + 1, z0);
    const n110 = hash3D(x0 + 1, y0 + 1, z0);
    const n001 = hash3D(x0, y0, z0 + 1);
    const n101 = hash3D(x0 + 1, y0, z0 + 1);
    const n011 = hash3D(x0, y0 + 1, z0 + 1);
    const n111 = hash3D(x0 + 1, y0 + 1, z0 + 1);

    const nx00 = n000 + (n100 - n000) * tx;
    const nx10 = n010 + (n110 - n010) * tx;
    const nx01 = n001 + (n101 - n001) * tx;
    const nx11 = n011 + (n111 - n011) * tx;
    const nxy0 = nx00 + (nx10 - nx00) * ty;
    const nxy1 = nx01 + (nx11 - nx01) * ty;

    return nxy0 + (nxy1 - nxy0) * tz;
}

function fbm(x, y, z, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
        value += noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / total;
}

function ridgedFbm(x, y, z, octaves = 4) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
        const n = noise3D(x * frequency, y * frequency, z * frequency);
        const ridge = 1 - Math.abs(n * 2 - 1);
        value += ridge * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2.05;
    }

    return value / total;
}

function smoothstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function terrainAt(direction) {
    const x = direction.x;
    const y = direction.y;
    const z = direction.z;

    // Large continental shapes.
    const continentA = fbm(x * 1.15 + 4.0, y * 1.15 - 2.0, z * 1.15 + 7.0, 5);
    const continentB = fbm(x * 2.0 - 13.0, y * 2.0 + 8.0, z * 2.0 + 2.0, 4);
    const continental = continentA * 0.78 + continentB * 0.22;

    // Regional geology.
    const regionalA = fbm(x * 2.8 - 11.0, y * 2.8 + 6.0, z * 2.8 + 3.0, 5);
    const regionalB = fbm(x * 4.8 + 18.0, y * 4.8 - 9.0, z * 4.8 - 14.0, 4);
    const regional = regionalA * 0.72 + regionalB * 0.28;

    // Small detail only affects terrain gently.
    const detail = fbm(x * 10.0 + 9.0, y * 10.0 - 14.0, z * 10.0 + 2.0, 3);

    // Connected mountain systems.
    const ridgeLarge = ridgedFbm(x * 2.35 + 23.0, y * 2.35 - 17.0, z * 2.35 + 5.0, 5);
    const ridgeRegional = ridgedFbm(x * 5.0 - 7.0, y * 5.0 + 13.0, z * 5.0 - 19.0, 4);
    const ridgeDetail = ridgedFbm(x * 9.0 + 31.0, y * 9.0 - 21.0, z * 9.0 + 11.0, 3);

    const land = smoothstep(0.475, 0.57, continental);

    const elevation =
        regionalA * 0.70 +
        regionalB * 0.22 +
        detail * 0.08;

    const mountainBelts = smoothstep(0.56, 0.74, elevation);
    const mountainStructure =
        ridgeLarge * 0.58 +
        ridgeRegional * 0.30 +
        ridgeDetail * 0.12;

    const mountainMask =
        land *
        mountainBelts *
        smoothstep(0.38, 0.70, mountainStructure);

    if (land < 0.5) {
        return {
            isLand: false,
            land,
            elevation,
            detail,
            mountainMask: 0,
            height: 1.0
        };
    }

    const coast = smoothstep(0.50, 0.72, land);
    const landElevation = THREE.MathUtils.clamp((elevation - 0.30) / 0.70, 0, 1);

    // Deliberately stronger than the old planet: the relief must read as geometry.
    const rolling = Math.pow(landElevation, 1.35) * 0.035;
    const mountains = Math.pow(mountainMask, 1.35) * 0.115;
    const coastLift = coast * 0.006;

    return {
        isLand: true,
        land,
        elevation,
        detail,
        mountainMask,
        landElevation,
        coast,
        height: 1.006 + coastLift + rolling + mountains
    };
}

// ============================================================
// CUBE-SPHERE PLANET
// A cube projected onto a sphere avoids the UV sphere's pole and
// longitude seam problems. Every terrain sample uses a true 3D
// direction, so the planet has no painted 2D continent map.
// ============================================================

const FACE_RESOLUTION = 86;
const positions = [];
const colors = [];
const indices = [];

const lowlandColor = new THREE.Color(0x3f7f42);
const meadowColor = new THREE.Color(0x7d9b51);
const dryColor = new THREE.Color(0xa58f63);
const rockColor = new THREE.Color(0x77756f);
const snowColor = new THREE.Color(0xe2e3df);

function addFace(face) {
    const base = positions.length / 3;

    for (let row = 0; row <= FACE_RESOLUTION; row++) {
        const v = row / FACE_RESOLUTION;

        for (let col = 0; col <= FACE_RESOLUTION; col++) {
            const u = col / FACE_RESOLUTION;
            const a = u * 2 - 1;
            const b = v * 2 - 1;

            let cubeX = 0;
            let cubeY = 0;
            let cubeZ = 0;

            if (face === "px") { cubeX = 1; cubeY = b; cubeZ = -a; }
            if (face === "nx") { cubeX = -1; cubeY = b; cubeZ = a; }
            if (face === "py") { cubeX = a; cubeY = 1; cubeZ = b; }
            if (face === "ny") { cubeX = a; cubeY = -1; cubeZ = -b; }
            if (face === "pz") { cubeX = a; cubeY = b; cubeZ = 1; }
            if (face === "nz") { cubeX = -a; cubeY = b; cubeZ = -1; }

            const length = Math.sqrt(cubeX * cubeX + cubeY * cubeY + cubeZ * cubeZ);
            const dx = cubeX / length;
            const dy = cubeY / length;
            const dz = cubeZ / length;
            const direction = new THREE.Vector3(dx, dy, dz);

            const terrain = terrainAt(direction);
            const radius = terrain.height;

            positions.push(dx * radius, dy * radius, dz * radius);

            const color = new THREE.Color();

            if (!terrain.isLand) {
                // Ocean on the planet body. The separate water shell sits above this.
                color.set(0x064d78);
            } else {
                const e = terrain.landElevation;
                const m = terrain.mountainMask;

                color.copy(lowlandColor);
                color.lerp(meadowColor, smoothstep(0.08, 0.36, e));
                color.lerp(dryColor, smoothstep(0.34, 0.62, e));
                color.lerp(rockColor, smoothstep(0.48, 0.72, m));
                color.lerp(snowColor, smoothstep(0.76, 1.0, m + e * 0.18));

                const variation = 0.94 + (terrain.detail - 0.5) * 0.10;
                color.multiplyScalar(variation);
            }

            colors.push(color.r, color.g, color.b);
        }
    }

    const rowSize = FACE_RESOLUTION + 1;

    for (let row = 0; row < FACE_RESOLUTION; row++) {
        for (let col = 0; col < FACE_RESOLUTION; col++) {
            const a = base + row * rowSize + col;
            const b = a + 1;
            const c = a + rowSize;
            const d = c + 1;

            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }
}

["px", "nx", "py", "ny", "pz", "nz"].forEach(addFace);

const planetGeometry = new THREE.BufferGeometry();
planetGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
);
planetGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
);
planetGeometry.setIndex(indices);

// Merge identical edge vertices so normals flow continuously across cube faces.
const smoothGeometry = mergeVertices(planetGeometry, 1e-5);
smoothGeometry.computeVertexNormals();

const planetMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0
});

const planet = new THREE.Mesh(smoothGeometry, planetMaterial);
scene.add(planet);

// ============================================================
// OCEAN
// The water is a physical sphere slightly above sea level.
// It has no continent mask, so it can never create ghost land.
// ============================================================

const oceanGeometry = new THREE.SphereGeometry(1.003, 192, 128);
const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x087fb5,
    roughness: 0.18,
    metalness: 0.02
});

const oceanSurface = new THREE.Mesh(oceanGeometry, oceanMaterial);
scene.add(oceanSurface);

// ============================================================
// ATMOSPHERE
// ============================================================

const atmosphereGeometry = new THREE.SphereGeometry(1.055, 128, 128);
const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x4aa9e8,
    transparent: true,
    opacity: 0.085,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

// ============================================================
// LIGHTING
// Strong directional light makes the actual relief readable.
// ============================================================

const ambientLight = new THREE.AmbientLight(0x9db9cf, 0.18);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.45);
sunLight.position.set(-3.5, 2.4, 4.5);
scene.add(sunLight);

// ============================================================
// STARS
// ============================================================

const starCount = 1800;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const radius = 22 + Math.random() * 90;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i3 + 2] = radius * Math.cos(phi);
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3)
);

const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// ============================================================
// PLANET CONTROL
// ============================================================

let isDragging = false;
let previousMouseX = 0;
let rotationVelocity = 0;

const DRAG_SPEED = 0.005;
const ROTATION_FRICTION = 0.94;

renderer.domElement.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;

    isDragging = true;
    previousMouseX = event.clientX;
    rotationVelocity = 0;
});

window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const deltaX = event.clientX - previousMouseX;

    planet.rotation.y += deltaX * DRAG_SPEED;
    oceanSurface.rotation.y = planet.rotation.y;
    atmosphere.rotation.y = planet.rotation.y;

    rotationVelocity = deltaX * DRAG_SPEED;
    previousMouseX = event.clientX;
});

window.addEventListener("mouseup", () => {
    isDragging = false;
});

// ============================================================
// ANIMATION
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
        planet.rotation.y += 0.0018;
        rotationVelocity *= ROTATION_FRICTION;
        planet.rotation.y += rotationVelocity;

        oceanSurface.rotation.y = planet.rotation.y;
        atmosphere.rotation.y = planet.rotation.y;
    }

    const time = performance.now() * 0.001;
    const pulse = 0.96 + Math.sin(time * 0.65) * 0.018;
    oceanMaterial.color.setRGB(0.033 * pulse, 0.50 * pulse, 0.71 * pulse);

    starMaterial.opacity = 0.72 + Math.sin(time * 1.5) * 0.12;

    renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
