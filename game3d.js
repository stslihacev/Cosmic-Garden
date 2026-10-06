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

    // Low-frequency fields define broad continental masses and keep
    // coastlines large, organic and free of obvious repetition.
    const continentalA = fbm(x * 1.05 + 4.0, y * 1.05 - 2.0, z * 1.05 + 7.0, 5);
    const continentalB = fbm(x * 1.75 - 13.0, y * 1.75 + 8.0, z * 1.75 + 2.0, 4);
    const continental = continentalA * 0.78 + continentalB * 0.22;

    // Regional geology gives each continent broad lowlands, uplands and plateaus.
    const regionalA = fbm(x * 2.55 - 11.0, y * 2.55 + 6.0, z * 2.55 + 3.0, 5);
    const regionalB = fbm(x * 4.2 + 18.0, y * 4.2 - 9.0, z * 4.2 - 14.0, 4);
    const regional = regionalA * 0.72 + regionalB * 0.28;

    // Fine detail stays restrained so plains read as terrain, not noise.
    const detail = fbm(x * 8.0 + 9.0, y * 8.0 - 14.0, z * 8.0 + 2.0, 3);

    // Several ridge scales combine into connected mountain systems.
    const ridgeLarge = ridgedFbm(x * 2.35 + 23.0, y * 2.35 - 17.0, z * 2.35 + 5.0, 5);
    const ridgeRegional = ridgedFbm(x * 4.8 - 7.0, y * 4.8 + 13.0, z * 4.8 - 19.0, 4);
    const ridgeDetail = ridgedFbm(x * 8.5 + 31.0, y * 8.5 - 21.0, z * 8.5 + 11.0, 3);

    const land = smoothstep(0.47, 0.565, continental);

    const elevation =
        regionalA * 0.68 +
        regionalB * 0.22 +
        detail * 0.10;

    const mountainBelts = smoothstep(0.58, 0.78, elevation);
    const mountainStructure =
        ridgeLarge * 0.58 +
        ridgeRegional * 0.30 +
        ridgeDetail * 0.12;

    const mountainMask =
        land *
        mountainBelts *
        smoothstep(0.38, 0.72, mountainStructure);

    return {
        continental,
        regional,
        detail,
        elevation,
        land,
        mountainMask,
        mountainStructure
    };
}

function getTerrain(direction) {
    const field = terrainField(direction);

    if (field.land < 0.5) {
        return { ...field, isLand: false, height: 1.0, type: "ocean" };
    }

    const coast = smoothstep(0.50, 0.70, field.land);
    const landElevation = THREE.MathUtils.clamp(
        (field.elevation - 0.32) / 0.68,
        0,
        1
    );

    // Broad rolling terrain.
    const rolling = Math.pow(landElevation, 1.45) * 0.020;

    // Mountain ranges rise progressively from surrounding terrain.
    const mountainRise = Math.pow(field.mountainMask, 1.65) * 0.070;

    // Very small coastal lift keeps the shoreline from looking laser-flat.
    const coastLift = coast * 0.004;

    const height = 1.004 + coastLift + rolling + mountainRise;

    let type = "lowland";

    if (field.mountainMask > 0.50) {
        type = "mountain";
    } else if (landElevation > 0.67) {
        type = "highland";
    } else if (coast < 0.24) {
        type = "coast";
    }

    return {
        ...field,
        isLand: true,
        height,
        type,
        coast,
        landElevation
    };
}
// ============================================================
// PLANET GEOMETRY
// ============================================================
// Real terrain is kept in the mesh itself. The surface therefore
// has physical relief, silhouette changes and lighting response.

const planetGeometry = new THREE.SphereGeometry(1, 256, 160);
const positionAttribute = planetGeometry.attributes.position;
const colorAttribute = new THREE.BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);
const vertex = new THREE.Vector3();
const direction = new THREE.Vector3();

const colorLowland = new THREE.Color(0x2f6330);
const colorWarm = new THREE.Color(0x71834b);
const colorHigh = new THREE.Color(0x8f8a67);
const colorRock = new THREE.Color(0x77766e);
const colorSnow = new THREE.Color(0xd8d9d0);
const colorOcean = new THREE.Color(0x063e68);

for (let i = 0; i < positionAttribute.count; i++) {
    vertex.fromBufferAttribute(positionAttribute, i);
    direction.copy(vertex).normalize();

    const terrain = getTerrain(direction);

    const coastLift = terrain.isLand ? terrain.coast * 0.005 : 0;
    const rolling = terrain.isLand ? Math.pow(terrain.landElevation, 1.35) * 0.028 : 0;
    const mountainRise = terrain.isLand ? Math.pow(terrain.mountainMask, 1.55) * 0.092 : 0;
    const height = terrain.isLand ? 1.004 + coastLift + rolling + mountainRise : 1.0;

    vertex.copy(direction).multiplyScalar(height);
    positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);

    const c = new THREE.Color();

    if (!terrain.isLand) {
        c.copy(colorOcean);
    } else {
        const e = terrain.landElevation;
        const m = terrain.mountainMask;
        const dry = smoothstep(0.50, 0.78, terrain.regional);

        c.copy(colorLowland);
        c.lerp(colorWarm, smoothstep(0.10, 0.40, e));
        c.lerp(colorHigh, smoothstep(0.34, 0.66, e));
        c.lerp(colorRock, smoothstep(0.48, 0.78, m));
        c.lerp(colorSnow, smoothstep(0.78, 0.98, m + e * 0.18));
        c.lerp(new THREE.Color(0x9a805b), dry * e * 0.20);
        c.multiplyScalar(0.94 + (terrain.detail - 0.5) * 0.12);
    }

    colorAttribute.setXYZ(i, c);
}

positionAttribute.needsUpdate = true;
planetGeometry.setAttribute("color", colorAttribute);
planetGeometry.computeVertexNormals();
planetGeometry.normalizeNormals();
planetGeometry.attributes.normal.needsUpdate = true;

const planetMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

// ============================================================
// CONTINUOUS OCEAN
// ============================================================
// One water shell only. No duplicated continent mask is used.
// Land physically rises above this shell, so ghost continents vanish.

const oceanGeometry = new THREE.SphereGeometry(1.0015, 192, 128);

const oceanShaderNoise = `
float hash3(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float valueNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash3(i);
    float n100 = hash3(i + vec3(1,0,0));
    float n010 = hash3(i + vec3(0,1,0));
    float n110 = hash3(i + vec3(1,1,0));
    float n001 = hash3(i + vec3(0,0,1));
    float n101 = hash3(i + vec3(1,0,1));
    float n011 = hash3(i + vec3(0,1,1));
    float n111 = hash3(i + vec3(1,1,1));
    float nx00 = mix(n000,n100,f.x);
    float nx10 = mix(n010,n110,f.x);
    float nx01 = mix(n001,n101,f.x);
    float nx11 = mix(n011,n111,f.x);
    return mix(mix(nx00,nx10,f.y),mix(nx01,nx11,f.y),f.z);
}
float fbmWater(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float total = 0.0;
    for (int i = 0; i < 5; i++) {
        value += valueNoise3D(p) * amplitude;
        total += amplitude;
        p = p * 2.02 + vec3(17.1,-9.2,11.7);
        amplitude *= 0.5;
    }
    return value / total;
}
`;

const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(-3.5, 2.0, 4.5).normalize() }
    },
    vertexShader: `
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`,
    fragmentShader: `
precision highp float;
uniform float uTime;
uniform vec3 uSunDirection;
varying vec3 vNormal;
varying vec3 vWorldPosition;
${oceanShaderNoise}
void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

    float broad = fbmWater(n * 9.0 + vec3(uTime * 0.010, -uTime * 0.007, uTime * 0.006));
    float detail = fbmWater(n * 34.0 + vec3(-uTime * 0.020, uTime * 0.015, -uTime * 0.011));

    float facing = max(dot(n, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 3.0);

    vec3 deepBlue = vec3(0.006, 0.090, 0.190);
    vec3 clearBlue = vec3(0.015, 0.285, 0.430);
    vec3 color = mix(deepBlue, clearBlue, broad * 0.82 + detail * 0.18);

    vec3 halfVector = normalize(uSunDirection + viewDirection);
    float reflection = pow(max(dot(n, halfVector), 0.0), 44.0);
    float broadReflection = pow(max(dot(n, halfVector), 0.0), 13.0);

    color += vec3(0.45, 0.72, 0.82) * broadReflection * 0.10;
    color += vec3(0.78, 0.92, 0.98) * reflection * 0.22;
    color += vec3(0.02, 0.12, 0.18) * fresnel * 0.18;

    float sun = max(dot(n, uSunDirection), 0.0);
    color *= 0.72 + sun * 0.36;

    gl_FragColor = vec4(color, 0.94);
}
`,
    transparent: true,
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

// A single soft key light keeps the planet readable without creating paired specular hotspots.

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
    oceanMaterial.uniforms.uTime.value = time;
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
