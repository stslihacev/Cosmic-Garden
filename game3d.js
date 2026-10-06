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

// A high-resolution UV sphere gives smooth, continuous normals while the terrain is displaced in real geometry.
// This avoids the visible triangular/diamond facets produced by an icosphere.
const planetGeometry = new THREE.SphereGeometry(1, 256, 160);
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
planetGeometry.normalizeNormals();
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
        const longitude = ((x + 0.5) / textureCanvas.width - 0.5) * Math.PI * 2;

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
            const elevation = THREE.MathUtils.clamp(terrain.landElevation ?? 0, 0, 1);
            const mountain = THREE.MathUtils.clamp(terrain.mountainMask, 0, 1);
            const localVariation = (terrain.detail - 0.5) * 8.0;

            if (terrain.type === "mountain") {
                const rock = mountain * 0.72 + elevation * 0.28;
                const snow = smoothstep(0.72, 0.94, rock);
                red = 74 + rock * 32 + snow * 62;
                green = 82 + rock * 24 + snow * 58;
                blue = 64 + rock * 22 + snow * 52;
            } else if (terrain.type === "highland") {
                red = 58 + elevation * 26;
                green = 98 + elevation * 24;
                blue = 50 + elevation * 12;
            } else if (terrain.type === "coast") {
                red = 30 + elevation * 12;
                green = 91 + elevation * 20;
                blue = 60 + elevation * 10;
            } else {
                red = 34 + elevation * 28;
                green = 88 + elevation * 26;
                blue = 42 + elevation * 14;
            }

            red += localVariation * 0.7;
            green += localVariation;
            blue += localVariation * 0.5;
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
planetTexture.wrapS = THREE.RepeatWrapping;
planetTexture.wrapT = THREE.ClampToEdgeWrapping;
planetTexture.minFilter = THREE.LinearMipmapLinearFilter;
planetTexture.magFilter = THREE.LinearFilter;
planetTexture.colorSpace = THREE.SRGBColorSpace;
planetTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 1.0,
    metalness: 0.0,
    specularIntensity: 0.0
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
const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uOceanMask: { value: oceanMaskTexture }
    },
    vertexShader: `
        uniform float uTime;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));

            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;

            for (int i = 0; i < 4; i++) {
                value += noise(p) * amplitude;
                p = p * 2.02 + vec2(13.7, -8.3);
                amplitude *= 0.5;
            }

            return value;
        }

        void main() {
            vUv = uv;

            float t = uTime * 0.010;
            vec2 flow = uv * 24.0 + vec2(t * 0.70, -t * 0.42);

            float waveA = fbm(flow);
            float waveB = fbm(flow * 1.85 + vec2(4.2, -7.1));

            // Very small geometric displacement: enough to catch light,
            // not enough to create a lumpy or cartoon-like ocean silhouette.
            float displacement = ((waveA - 0.5) * 0.0018) +
                                 ((waveB - 0.5) * 0.0007);

            vec3 displacedPosition = position + normalize(normal) * displacement;

            vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
            vWorldPosition = worldPosition.xyz;

            // Build a gently animated tangent-space normal from the same
            // fields used for displacement.
            float e = 0.003;
            float dx = fbm(flow + vec2(e, 0.0)) - fbm(flow - vec2(e, 0.0));
            float dy = fbm(flow + vec2(0.0, e)) - fbm(flow - vec2(0.0, e));

            vec3 objectNormal = normalize(normal + vec3(dx * 0.18, dy * 0.18, 0.0));
            vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);

            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform sampler2D uOceanMask;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));

            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;

            for (int i = 0; i < 4; i++) {
                value += noise(p) * amplitude;
                p = p * 2.02 + vec2(13.7, -8.3);
                amplitude *= 0.5;
            }

            return value;
        }

        void main() {
            float mask = texture2D(uOceanMask, vUv).a;
            if (mask < 0.02) discard;

            float t = uTime * 0.010;
            float wave = fbm(vUv * 24.0 + vec2(t * 0.70, -t * 0.42));
            float fine = noise(vUv * 72.0 + vec2(-t * 0.55, t * 0.40));

            vec3 n = normalize(vWorldNormal);
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            vec3 sunDir = normalize(vec3(-3.5, 2.0, 4.5));

            float facing = max(dot(n, viewDir), 0.0);
            float diffuse = max(dot(n, sunDir), 0.0);
            float fresnel = pow(1.0 - facing, 2.8);

            // Brighter, more natural blue ocean.
            vec3 deepWater = vec3(0.008, 0.075, 0.15);
            vec3 blueWater = vec3(0.015, 0.28, 0.43);
            vec3 brightWater = vec3(0.035, 0.42, 0.55);

            float waterVariation = clamp(wave * 0.72 + fine * 0.28, 0.0, 1.0);
            vec3 waterColor = mix(deepWater, blueWater, waterVariation * 0.72);

            // Soft atmospheric reflection near the grazing angle.
            vec3 skyReflection = vec3(0.10, 0.34, 0.45);
            waterColor = mix(waterColor, skyReflection, fresnel * 0.42);

            // Broad sunlight reflection, intentionally restrained.
            vec3 halfDir = normalize(sunDir + viewDir);
            float broadReflection = pow(max(dot(n, halfDir), 0.0), 28.0);
            float glint = pow(max(dot(n, halfDir), 0.0), 100.0);

            waterColor += vec3(0.48, 0.70, 0.74) * broadReflection * 0.22;
            waterColor += vec3(0.65, 0.82, 0.84) * glint * 0.055;

            waterColor *= 0.82 + diffuse * 0.24;

            // Slightly softer opacity than before so the planet beneath
            // contributes naturally to the water depth.
            float alpha = mask * (0.72 + fresnel * 0.10);

            gl_FragColor = vec4(waterColor, alpha);
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
