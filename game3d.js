import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// ===============================
// СЦЕНА
// ===============================

const scene = new THREE.Scene();


// ===============================
// КАМЕРА
// ===============================

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 4.5;


// ===============================
// РЕНДЕР
// ===============================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

document.body.appendChild(renderer.domElement);


// ===============================
// ПЛАНЕТА
// ===============================

const planetGeometry = new THREE.SphereGeometry(
    1,
    192,
    192
);

// ===============================
// КАРТА ПОВЕРХНОСТИ ПЛАНЕТЫ
// ===============================

// ===============================
// ПРОЦЕДУРНАЯ КАРТА ПЛАНЕТЫ
// ===============================

const textureCanvas =
    document.createElement("canvas");

textureCanvas.width = 1024;
textureCanvas.height = 512;

const textureContext =
    textureCanvas.getContext("2d");


// ===============================
// ПРОЦЕДУРНЫЙ РЕЛЬЕФ СФЕРЫ
// ===============================

const noiseSeed = 42;


// ===============================
// 3D HASH
// ===============================

function hash3D(x, y, z) {

    let value =
        Math.sin(
            x * 127.1 +
            y * 311.7 +
            z * 74.7 +
            noiseSeed
        ) *
        43758.5453;

    return value -
        Math.floor(value);
}


// ===============================
// ПЛАВНАЯ ИНТЕРПОЛЯЦИЯ
// ===============================

function fade(value) {

    return value *
        value *
        (3 - 2 * value);
}


// ===============================
// 3D VALUE NOISE
// ===============================

function noise3D(x, y, z) {

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);

    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const z1 = z0 + 1;


    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);


    const n000 =
        hash3D(x0, y0, z0);

    const n100 =
        hash3D(x1, y0, z0);

    const n010 =
        hash3D(x0, y1, z0);

    const n110 =
        hash3D(x1, y1, z0);

    const n001 =
        hash3D(x0, y0, z1);

    const n101 =
        hash3D(x1, y0, z1);

    const n011 =
        hash3D(x0, y1, z1);

    const n111 =
        hash3D(x1, y1, z1);


    const nx00 =
        n000 +
        (n100 - n000) * tx;

    const nx10 =
        n010 +
        (n110 - n010) * tx;

    const nx01 =
        n001 +
        (n101 - n001) * tx;

    const nx11 =
        n011 +
        (n111 - n011) * tx;


    const nxy0 =
        nx00 +
        (nx10 - nx00) * ty;

    const nxy1 =
        nx01 +
        (nx11 - nx01) * ty;


    return nxy0 +
        (nxy1 - nxy0) * tz;
}


// ===============================
// МНОГОУРОВНЕВЫЙ РЕЛЬЕФ
// ===============================

function terrainNoise(x, y, z) {

    let value = 0;

    let amplitude = 1;

    let frequency = 1;

    let totalAmplitude = 0;


    for (
        let octave = 0;
        octave < 4;
        octave++
    ) {

        value +=
            noise3D(
                x * frequency,
                y * frequency,
                z * frequency
            ) *
            amplitude;

        totalAmplitude +=
            amplitude;

        amplitude *= 0.5;

        frequency *= 2;
    }


    return value /
        totalAmplitude;
}

// ===============================
// ГОРНЫЙ РЕЛЬЕФ
// ===============================

function mountainNoise(x, y, z) {

    const large =
        terrainNoise(
            x * 0.75,
            y * 0.75,
            z * 0.75
        );

    const medium =
        terrainNoise(
            x * 2.0,
            y * 2.0,
            z * 2.0
        );

    const detail =
        terrainNoise(
            x * 5.0,
            y * 5.0,
            z * 5.0
        );


    // Создаём более выраженные
    // крупные структуры

    const mountainShape =
        Math.pow(
            Math.max(
                0,
                large - 0.52
            ),
            1.4
        );


    return (
        mountainShape * 0.75 +
        medium * 0.20 +
        detail * 0.05
    );
}

// ===============================
// СОЗДАНИЕ ТЕКСТУРЫ
// ===============================

const imageData =
    textureContext.createImageData(
        textureCanvas.width,
        textureCanvas.height
    );

const pixels =
    imageData.data;


for (
    let y = 0;
    y < textureCanvas.height;
    y++
) {

    for (
        let x = 0;
        x < textureCanvas.width;
        x++
    ) {

        // Координаты точки
        // на поверхности сферы

        const longitude =
            (x /
                textureCanvas.width -
                0.5) *
            Math.PI *
            2;

        const latitude =
            (0.5 -
                y /
                textureCanvas.height) *
            Math.PI;


        const cosLatitude =
            Math.cos(latitude);


        const sphereX =
            cosLatitude *
            Math.cos(longitude);

        const sphereY =
            Math.sin(latitude);

        const sphereZ =
            cosLatitude *
            Math.sin(longitude);


        // Основной масштаб материков

        const continentNoise =
            terrainNoise(
                sphereX * 2.2,
                sphereY * 2.2,
                sphereZ * 2.2
            );


        // Более мелкие детали

        const detailNoise =
            terrainNoise(
                sphereX * 5.0,
                sphereY * 5.0,
                sphereZ * 5.0
            );


        // Смешиваем крупные
        // и мелкие формы

        const terrain =
            continentNoise * 0.82 +
            detailNoise * 0.18;


        const index =
            (
                y *
                textureCanvas.width +
                x
            ) * 4;


        // ===========================
        // ГЛУБОКИЙ ОКЕАН
        // ===========================

        if (terrain < 0.46) {

            pixels[index] = 7;
            pixels[index + 1] = 35;
            pixels[index + 2] = 65;

        }

        // ===========================
        // ОКЕАН
        // ===========================

        else if (terrain < 0.52) {

            pixels[index] = 12;
            pixels[index + 1] = 55;
            pixels[index + 2] = 85;

        }

        // ===========================
        // БЕРЕГ
        // ===========================

        else if (terrain < 0.56) {

            pixels[index] = 82;
            pixels[index + 1] = 105;
            pixels[index + 2] = 62;

        }

        // ===========================
        // НИЗМЕННОСТИ
        // ===========================

        else if (terrain < 0.67) {

            pixels[index] = 43;
            pixels[index + 1] = 105;
            pixels[index + 2] = 48;

        }

        // ===========================
        // ВОЗВЫШЕННОСТИ
        // ===========================

        else if (terrain < 0.78) {

            pixels[index] = 75;
            pixels[index + 1] = 105;
            pixels[index + 2] = 55;

        }

        // ===========================
        // ГОРЫ
        // ===========================

        else {

            pixels[index] = 125;
            pixels[index + 1] = 120;
            pixels[index + 2] = 100;
        }


        pixels[index + 3] = 255;
    }
}


textureContext.putImageData(
    imageData,
    0,
    0
);

textureContext.putImageData(
    imageData,
    0,
    0
);

const planetTexture =
    new THREE.CanvasTexture(
        textureCanvas
    );

planetTexture.colorSpace =
    THREE.SRGBColorSpace;


// Материал планеты

const planetMaterial =
    new THREE.MeshStandardMaterial({
        map: planetTexture,
        roughness: 0.65,
        metalness: 0.02
    });

// ===============================
// РЕЛЬЕФ ПОВЕРХНОСТИ
// ===============================

const positionAttribute =
    planetGeometry.attributes.position;

const vertex =
    new THREE.Vector3();


for (
    let i = 0;
    i < positionAttribute.count;
    i++
) {

    vertex.fromBufferAttribute(
        positionAttribute,
        i
    );


    // Нормализованные координаты
    // точки на поверхности сферы

    const direction =
        vertex.clone().normalize();


    const terrain =
        terrainNoise(
            direction.x * 2.2,
            direction.y * 2.2,
            direction.z * 2.2
        );

    const mountains =
        mountainNoise(
            direction.x,
            direction.y,
            direction.z
        );


    // Базовая высота поверхности

    let height = 1;


    // ===============================
    // ОКЕАН
    // ===============================

    if (terrain < 0.52) {

        height = 1.0;

    }


    // ===============================
    // БЕРЕГ
    // ===============================

    else if (terrain < 0.56) {

        const coast =
            (terrain - 0.52) / 0.04;

        height =
            1.0 +
            coast * 0.008;

    }


    // ===============================
    // МАТЕРИК
    // ===============================

    else if (terrain < 0.68) {

        const land =
            (terrain - 0.56) / 0.12;

        height =
            1.008 +
            land * 0.018;

    }


    // ===============================
    // ВОЗВЫШЕННОСТИ
    // ===============================

    else if (terrain < 0.78) {

        const highland =
            (terrain - 0.68) / 0.10;

        height =
            1.026 +
            highland * 0.025;

    }


    // ===============================
    // ГОРЫ
    // ===============================

    else {

        const mountain =
            (terrain - 0.78) / 0.22;


        const mountainRelief =
            Math.min(
                mountains,
                1
            );


        height =
            1.051 +
            mountain * 0.025 +
            mountainRelief * 0.055;
    }


    vertex.copy(
        direction.multiplyScalar(height)
    );


    positionAttribute.setXYZ(
        i,
        vertex.x,
        vertex.y,
        vertex.z
    );
}


positionAttribute.needsUpdate = true;

planetGeometry.computeVertexNormals();

const planet = new THREE.Mesh(
    planetGeometry,
    planetMaterial
);

scene.add(planet);

// ===============================
// ЛЁГКОЕ СВЕЧЕНИЕ ОКЕАНА
// ===============================

const oceanGlowGeometry =
    new THREE.SphereGeometry(
        1.008,
        64,
        64
    );

const oceanGlowMaterial =
    new THREE.MeshBasicMaterial({
        color: 0x1677a8,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide
    });

const oceanGlow =
    new THREE.Mesh(
        oceanGlowGeometry,
        oceanGlowMaterial
    );

scene.add(oceanGlow);

// ===============================
// ОСВЕЩЕНИЕ
// ===============================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.25
);

scene.add(ambientLight);


const sunLight = new THREE.DirectionalLight(
    0xffffff,
    2
);

sunLight.position.set(
    -3,
    2,
    4
);

scene.add(sunLight);

// ===============================
// ЗВЁЗДЫ
// ===============================

const starCount = 1500;

const starPositions = new Float32Array(
    starCount * 3
);

for (let i = 0; i < starCount; i++) {

    const i3 = i * 3;

    const radius = 20 + Math.random() * 80;

    const theta =
        Math.random() * Math.PI * 2;

    const phi =
        Math.acos(
            2 * Math.random() - 1
        );

    starPositions[i3] =
        radius *
        Math.sin(phi) *
        Math.cos(theta);

    starPositions[i3 + 1] =
        radius *
        Math.sin(phi) *
        Math.sin(theta);

    starPositions[i3 + 2] =
        radius *
        Math.cos(phi);
}


const starGeometry =
    new THREE.BufferGeometry();

starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
        starPositions,
        3
    )
);


const starMaterial =
    new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.08,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75
    });


const stars = new THREE.Points(
    starGeometry,
    starMaterial
);

scene.add(stars);

// ===============================
// АНИМАЦИЯ
// ===============================

function animate() {
    requestAnimationFrame(animate);

    if (!isDragging) {
        planet.rotation.y += 0.002;

        planet.rotation.y +=
            rotationVelocity;

        rotationVelocity *=
            ROTATION_FRICTION;
    }

    const time = performance.now() * 0.001;

    starMaterial.opacity =
        0.75 + Math.sin(time * 1.5) * 0.15;

    renderer.render(
        scene,
        camera
    );
}

let isDragging = false;
let previousMouseX = 0;
let rotationVelocity = 0;

const DRAG_SPEED = 0.005;
const ROTATION_FRICTION = 0.94;

animate();

// ===============================
// УПРАВЛЕНИЕ ПЛАНЕТОЙ
// ===============================

renderer.domElement.addEventListener(
    "mousedown",
    (event) => {

        if (event.button !== 0) {
            return;
        }

        isDragging = true;
        previousMouseX = event.clientX;
        rotationVelocity = 0;
    }
);


window.addEventListener(
    "mousemove",
    (event) => {

        if (!isDragging) {
            return;
        }

        const deltaX =
            event.clientX - previousMouseX;

        planet.rotation.y +=
            deltaX * DRAG_SPEED;

        rotationVelocity =
            deltaX * DRAG_SPEED;

        previousMouseX =
            event.clientX;
    }
);


window.addEventListener(
    "mouseup",
    () => {

        isDragging = false;
    }
);

// ===============================
// ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
// ===============================

window.addEventListener("resize", () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

});