import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000308);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.05, 4.35);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// ============================================================
// PROCEDURAL TERRAIN
// Smooth, large-scale planetary geology.
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
    let totalAmplitude = 0;

    for (let octave = 0; octave < octaves; octave++) {
        value += noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / totalAmplitude;
}

function ridgedFbm(x, y, z, octaves = 4) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let totalAmplitude = 0;

    for (let octave = 0; octave < octaves; octave++) {
        const n = noise3D(x * frequency, y * frequency, z * frequency);
        const ridge = 1 - Math.abs(n * 2 - 1);
        value += ridge * amplitude;
        totalAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2.05;
    }

    return value / totalAmplitude;
}

function smoothstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function terrainField(direction) {
    const x = direction.x;
    const y = direction.y;
    const z = direction.z;

    // Very broad continents.
    const continental = fbm(
        x * 1.15 + 4.0,
        y * 1.15 - 2.0,
        z * 1.15 + 7.0,
        5
    );

    // Regional geological variation.
    const regional = fbm(
        x * 2.35 - 11.0,
        y * 2.35 + 6.0,
        z * 2.35 + 3.0,
        4
    );

    // Small detail is intentionally weak: it should enrich the surface,
    // not turn it into a collection of visible blocks.
    const detail = fbm(
        x * 5.5 + 9.0,
        y * 5.5 - 14.0,
        z * 5.5 + 2.0,
        3
    );

    const land = smoothstep(0.475, 0.565, continental);

    // Broad elevation field.
    const elevation = regional * 0.78 + detail * 0.22;

    // Ridged terrain creates long mountain systems rather than isolated bumps.
    const ridgeLarge = ridgedFbm(
        x * 2.7 + 23.0,
        y * 2.7 - 17.0,
        z * 2.7 + 5.0,
        4
    );

    const ridgeRegional = ridgedFbm(
        x * 5.0 - 7.0,
        y * 5.0 + 13.0,
        z * 5.0 - 19.0,
        3
    );

    const mountainBelts = smoothstep(0.64, 0.82, elevation);
    const mountainMask =
        land *
        mountainBelts *
        smoothstep(0.38, 0.70, ridgeLarge) *
        (0.72 + ridgeRegional * 0.28);

    return {
        continental,
        regional,
        detail,
        elevation,
        land,
        mountainMask
    };
}

function getTerrain(direction) {
    const field = terrainField(direction);

    if (field.land < 0.5) {
        return { ...field, isLand: false, height: 1.0, type: "ocean" };
    }

    const coast = smoothstep(0.50, 0.72, field.land);
    const landElevation = THREE.MathUtils.clamp(
        (field.elevation - 0.34) / 0.66,
        0,
        1
    );

    // Keep ordinary terrain subtle. Mountains carry most of the relief.
    const rolling = Math.pow(landElevation, 1.55) * 0.015;
    const mountain = Math.pow(field.mountainMask, 1.45) * 0.042;
    const coastLift = coast * 0.003;

    const height = 1.004 + coastLift + rolling + mountain;

    let type = "lowland";

    if (field.mountainMask > 0.46) {
        type = "mountain";
    } else if (landElevation > 0.64) {
        type = "highland";
    } else if (coast < 0.22) {
        type = "coast";
    }

    return { ...field, isLand: true, height, type };
}

// ============================================================
// PLANET GEOMETRY
// ============================================================

// An icosphere gives nearly uniform triangles over the whole planet.
// This removes the lat/long grid look of a UV sphere and keeps relief smooth.
const planetGeometry = new THREE.IcosahedronGeometry(1, 7);
const positionAttribute = planetGeometry.attributes.position;
const vertex = new THREE.Vector3();
const direction = new THREE.Vector3();

for (let i = 0; i < positionAttribute.count; i++) {
    vertex.fromBufferAttribute(positionAttribute, i);
    direction.copy(vertex).normalize();

    const terrain = getTerrain(direction);
    vertex.copy(direction).multiplyScalar(terrain.height);

    positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
}

positionAttribute.needsUpdate = true;
planetGeometry.computeVertexNormals();
planetGeometry.attributes.normal.needsUpdate = true;

// ============================================================
// PLANET TEXTURE
// ============================================================

const textureCanvas = document.createElement("canvas");
textureCanvas.width = 2048;
textureCanvas.height = 1024;

const textureContext = textureCanvas.getContext("2d");
const imageData = textureContext.createImageData(textureCanvas.width, textureCanvas.height);
const pixels = imageData.data;
const textureDirection = new THREE.Vector3();

for (let y = 0; y < textureCanvas.height; y++) {
    const latitude = (0.5 - y / textureCanvas.height) * Math.PI;
    const cosLatitude = Math.cos(latitude);

    for (let x = 0; x < textureCanvas.width; x++) {
        const longitude = (x / textureCanvas.width - 0.5) * Math.PI * 2;

        textureDirection.set(
            cosLatitude * Math.cos(longitude),
            Math.sin(latitude),
            cosLatitude * Math.sin(longitude)
        ).normalize();

        const terrain = getTerrain(textureDirection);

        let red;
        let green;
        let blue;

        if (!terrain.isLand) {
            const shelf = smoothstep(0.50, 0.60, terrain.land);
            red = 4 + shelf * 5;
            green = 24 + shelf * 30;
            blue = 54 + shelf * 46;
        } else {
            const elevation = THREE.MathUtils.clamp((terrain.elevation - 0.30) / 0.70, 0, 1);
            const coastAmount = smoothstep(0.5, 0.7, terrain.land);

            if (terrain.type === "mountain") {
                const snow = smoothstep(0.58, 0.90, terrain.mountainMask);
                red = 78 + snow * 105;
                green = 86 + snow * 98;
                blue = 61 + snow * 92;
            } else if (terrain.type === "highland") {
                red = 58 + elevation * 30;
                green = 105 + elevation * 20;
                blue = 52 + elevation * 12;
            } else if (terrain.type === "coast") {
                red = 72 + coastAmount * 12;
                green = 105 + coastAmount * 18;
                blue = 58 + coastAmount * 8;
            } else {
                red = 38 + elevation * 30;
                green = 100 + elevation * 24;
                blue = 45 + elevation * 14;
            }
        }

        const index = (y * textureCanvas.width + x) * 4;
        pixels[index] = Math.round(red);
        pixels[index + 1] = Math.round(green);
        pixels[index + 2] = Math.round(blue);
        pixels[index + 3] = 255;
    }
}

textureContext.putImageData(imageData, 0, 0);

const planetTexture = new THREE.CanvasTexture(textureCanvas);
planetTexture.colorSpace = THREE.SRGBColorSpace;
planetTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 0.88,
    metalness: 0.0
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

// ============================================================
// WATER SURFACE
// The water remains perfectly spherical, but the transparent material
// is masked to ocean pixels so it never washes over the continents.
// ============================================================

const oceanMaskCanvas = document.createElement("canvas");
oceanMaskCanvas.width = textureCanvas.width;
oceanMaskCanvas.height = textureCanvas.height;

const oceanMaskContext = oceanMaskCanvas.getContext("2d");
const oceanMaskData = oceanMaskContext.createImageData(
    oceanMaskCanvas.width,
    oceanMaskCanvas.height
);
const oceanMaskPixels = oceanMaskData.data;

for (let y = 0; y < oceanMaskCanvas.height; y++) {
    const latitude = (0.5 - y / oceanMaskCanvas.height) * Math.PI;
    const cosLatitude = Math.cos(latitude);

    for (let x = 0; x < oceanMaskCanvas.width; x++) {
        const longitude = (x / oceanMaskCanvas.width - 0.5) * Math.PI * 2;

        textureDirection.set(
            cosLatitude * Math.cos(longitude),
            Math.sin(latitude),
            cosLatitude * Math.sin(longitude)
        ).normalize();

        const terrain = getTerrain(textureDirection);
        const index = (y * oceanMaskCanvas.width + x) * 4;
        const alpha = terrain.isLand ? 0 : 150;

        oceanMaskPixels[index] = 255;
        oceanMaskPixels[index + 1] = 255;
        oceanMaskPixels[index + 2] = 255;
        oceanMaskPixels[index + 3] = alpha;
    }
}

oceanMaskContext.putImageData(oceanMaskData, 0, 0);

const oceanMaskTexture = new THREE.CanvasTexture(oceanMaskCanvas);
oceanMaskTexture.colorSpace = THREE.SRGBColorSpace;
oceanMaskTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const oceanGeometry = new THREE.SphereGeometry(1.003, 128, 128);
const oceanMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a4772,
    roughness: 0.34,
    metalness: 0.0,
    transparent: true,
    opacity: 0.62,
    alphaMap: oceanMaskTexture,
    depthWrite: false
});

const oceanSurface = new THREE.Mesh(oceanGeometry, oceanMaterial);
scene.add(oceanSurface);

// ============================================================
// ATMOSPHERIC RIM
// ============================================================

const atmosphereGeometry = new THREE.SphereGeometry(1.05, 128, 128);
const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b9ed1,
    transparent: true,
    opacity: 0.075,
    side: THREE.BackSide,
    depthWrite: false
});

const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

// ============================================================
// LIGHTING
// ============================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.95);
sunLight.position.set(-3.5, 2.0, 4.5);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x6b9dcc, 0.12);
fillLight.position.set(4, -1, -3);
scene.add(fillLight);

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
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));

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
    starMaterial.opacity = 0.72 + Math.sin(time * 1.5) * 0.12;

    renderer.render(scene, camera);
}

animate();

// ============================================================
// RESIZE
// ============================================================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});
