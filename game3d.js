import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { mergeVertices } from "https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js";

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

    const land = smoothstep(0.45, 0.60, continental);

    const elevation =
        regionalA * 0.70 +
        regionalB * 0.22 +
        detail * 0.08;

    const mountainBelts = smoothstep(0.52, 0.80, elevation);
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

const FACE_RESOLUTION = 160;
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

// Make every triangle face outward. The six cube faces have different
// local coordinate orientations, so we correct winding from the actual
// geometry instead of relying on a hard-coded winding order.
const positionArray = planetGeometry.attributes.position.array;

for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const ax = positionArray[ia];
    const ay = positionArray[ia + 1];
    const az = positionArray[ia + 2];

    const bx = positionArray[ib];
    const by = positionArray[ib + 1];
    const bz = positionArray[ib + 2];

    const cx = positionArray[ic];
    const cy = positionArray[ic + 1];
    const cz = positionArray[ic + 2];

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;

    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    const centerX = (ax + bx + cx) / 3;
    const centerY = (ay + by + cy) / 3;
    const centerZ = (az + bz + cz) / 3;

    // Outward normal must point roughly in the same direction as
    // the vertex position on a spherical surface.
    if (nx * centerX + ny * centerY + nz * centerZ < 0) {
        const temp = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = temp;
    }
}

planetGeometry.setIndex(indices);

// Weld duplicated vertices along the six cube-face borders before
// calculating normals. Without this, every cube face keeps its own
// copy of the edge vertices, which makes the planet read as six
// faceted panels instead of one continuous spherical surface.
const weldedGeometry = mergeVertices(planetGeometry, 1e-4);
weldedGeometry.computeVertexNormals();

const planetMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    side: THREE.FrontSide
});

const planet = new THREE.Mesh(weldedGeometry, planetMaterial);
scene.add(planet);

// ============================================================
// CLOSE SURFACE LOD
// A high-resolution local cap is placed over the side facing the
// camera. It carries much finer terrain geometry than the distant
// planet mesh, so approaching the planet reveals real relief rather
// than simply enlarging the coarse global grid.
// ============================================================

const DETAIL_RESOLUTION = 224;
const DETAIL_ANGLE = 1.05;
const detailPositions = [];
const detailColors = [];
const detailIndices = [];

function addDetailVertex(direction) {
    const terrain = terrainAt(direction);
    let radius = terrain.height;

    if (terrain.isLand) {
        const fineA = fbm(
            direction.x * 22.0 + 51.0,
            direction.y * 22.0 - 17.0,
            direction.z * 22.0 + 29.0,
            4
        );
        const fineB = ridgedFbm(
            direction.x * 38.0 - 12.0,
            direction.y * 38.0 + 27.0,
            direction.z * 38.0 + 8.0,
            3
        );
        const micro = fbm(
            direction.x * 85.0 + 7.0,
            direction.y * 85.0 - 31.0,
            direction.z * 85.0 + 19.0,
            3
        );

        // Fine relief is deliberately smooth and layered instead of blocky.
        // Make the close terrain visibly three-dimensional. The global
        // planet keeps subtle relief, while the close patch gets a much
        // stronger geological scale so mountains and valleys read from
        // the camera instead of looking like color noise.
        radius += (fineA - 0.5) * 0.035;
        radius += Math.pow(Math.max(0, fineB - 0.34), 1.15) * 0.085;
        radius += (micro - 0.5) * 0.012;
        radius += terrain.mountainMask * 0.045;
    }

    detailPositions.push(
        direction.x * radius,
        direction.y * radius,
        direction.z * radius
    );

    const color = new THREE.Color();

    if (!terrain.isLand) {
        color.set(0x064d78);
    } else {
        const e = terrain.landElevation;
        const m = terrain.mountainMask;

        color.copy(lowlandColor);
        color.lerp(meadowColor, smoothstep(0.08, 0.36, e));
        color.lerp(dryColor, smoothstep(0.34, 0.62, e));
        color.lerp(rockColor, smoothstep(0.48, 0.72, m));
        color.lerp(snowColor, smoothstep(0.76, 1.0, m + e * 0.18));

            const localVariation = 0.90 + (terrain.detail - 0.5) * 0.20;
        color.multiplyScalar(localVariation);
    }

    detailColors.push(color.r, color.g, color.b);
}

const detailSide = Math.sin(DETAIL_ANGLE);

for (let row = 0; row <= DETAIL_RESOLUTION; row++) {
    const t = row / DETAIL_RESOLUTION;
    const y = (t * 2 - 1) * detailSide;

    for (let col = 0; col <= DETAIL_RESOLUTION; col++) {
        const u = col / DETAIL_RESOLUTION;
        const x = (u * 2 - 1) * detailSide;
        const radial = x * x + y * y;

        // Outside the circular cap: keep a harmless point on the edge.
        // Triangles touching it are skipped below, leaving a true round LOD patch.
        if (radial >= detailSide * detailSide) {
            detailPositions.push(0, 0, 0);
            detailColors.push(0, 0, 0);
            continue;
        }

        const z = Math.sqrt(1 - radial);
        const direction = new THREE.Vector3(x, y, z).normalize();
        addDetailVertex(direction);
    }
}

const detailRowSize = DETAIL_RESOLUTION + 1;

for (let row = 0; row < DETAIL_RESOLUTION; row++) {
    for (let col = 0; col < DETAIL_RESOLUTION; col++) {
        const a = row * detailRowSize + col;
        const b = a + 1;
        const c = a + detailRowSize;
        const d = c + 1;

        if (detailPositions[a * 3] === 0 && detailPositions[a * 3 + 2] === 0) continue;
        if (detailPositions[b * 3] === 0 && detailPositions[b * 3 + 2] === 0) continue;
        if (detailPositions[c * 3] === 0 && detailPositions[c * 3 + 2] === 0) continue;
        if (detailPositions[d * 3] === 0 && detailPositions[d * 3 + 2] === 0) continue;

        detailIndices.push(a, c, b, b, c, d);
    }
}

const detailGeometry = new THREE.BufferGeometry();
detailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(detailPositions, 3));
detailGeometry.setAttribute("color", new THREE.Float32BufferAttribute(detailColors, 3));
detailGeometry.setIndex(detailIndices);
detailGeometry.computeVertexNormals();

const detailMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.0,
    side: THREE.FrontSide
});

const detailPatch = new THREE.Mesh(detailGeometry, detailMaterial);
detailPatch.visible = false;
scene.add(detailPatch);

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

const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
sunLight.position.set(-3.5, 2.4, 4.5);
sunLight.target.position.set(0, 0, 0);
scene.add(sunLight);
scene.add(sunLight.target);

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
// CAMERA ZOOM / SURFACE APPROACH
// ============================================================

const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraDistance = { value: 4.25, target: 4.25 };
const MIN_CAMERA_DISTANCE = 1.18;
const MAX_CAMERA_DISTANCE = 5.4;
const ZOOM_SPEED = 0.0028;

renderer.domElement.addEventListener("wheel", (event) => {
    event.preventDefault();
    cameraDistance.target += event.deltaY * ZOOM_SPEED;
    cameraDistance.target = THREE.MathUtils.clamp(cameraDistance.target, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
}, { passive: false });

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
    detailPatch.rotation.y = planet.rotation.y;

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
        detailPatch.rotation.y = planet.rotation.y;
    }

    detailPatch.rotation.y = planet.rotation.y;
    detailPatch.visible = false;

    cameraDistance.value = THREE.MathUtils.lerp(cameraDistance.value, cameraDistance.target, 0.075);
    camera.position.set(0, 0.05, cameraDistance.value);
    camera.lookAt(cameraTarget);

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
