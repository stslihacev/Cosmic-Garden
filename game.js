const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;

const stars = [];
const STAR_COUNT = 220;

let zoom = 1;
let targetZoom = 1;

let planetRotation = 0;
const PLANET_ROTATION_SPEED = 0.00025;

let cloudRotation = 0;
const CLOUD_ROTATION_SPEED = 0.00018;

const SUN_DIRECTION_X = -0.55;
const SUN_DIRECTION_Y = -0.45;

let isDraggingPlanet = false;
let lastMouseX = 0;
let rotationVelocity = 0;

const DRAG_ROTATION_SPEED = 0.008;
const ROTATION_FRICTION = 0.94;

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.8;
const ZOOM_SPEED = 0.1;

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function createStars() {
    stars.length = 0;

    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.4 + 0.2,
            alpha: Math.random() * 0.7 + 0.2,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            twinkleOffset: Math.random() * Math.PI * 2
        });
    }
}

function drawSpace(time) {
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
        const twinkle =
            Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.25;

        const alpha = Math.max(0.1, star.alpha + twinkle);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
    }
}

function drawPlanet() {
    if (!isDraggingPlanet) {
        planetRotation += PLANET_ROTATION_SPEED * 16;
        planetRotation += rotationVelocity;

        rotationVelocity *= ROTATION_FRICTION;
    }

    const centerX = width / 2;
    const centerY = height / 2;

    const baseRadius = Math.min(width, height) * 0.18;
    const radius = baseRadius * zoom;

    // Основная форма планеты
    const planetGradient = ctx.createRadialGradient(
        centerX - radius * 0.38,
        centerY - radius * 0.42,
        radius * 0.08,
        centerX,
        centerY,
        radius * 1.05
    );

    planetGradient.addColorStop(0, "#8fc7ee");
    planetGradient.addColorStop(0.28, "#4f91c4");
    planetGradient.addColorStop(0.55, "#245b86");
    planetGradient.addColorStop(0.78, "#123653");
    planetGradient.addColorStop(0.93, "#071625");
    planetGradient.addColorStop(1, "#020710");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    ctx.fillStyle = planetGradient;
    ctx.fill();

    // Затемнение дальней стороны планеты
    const shadowGradient = ctx.createRadialGradient(
        centerX + radius * 0.35,
        centerY + radius * 0.15,
        radius * 0.15,
        centerX + radius * 0.45,
        centerY + radius * 0.2,
        radius * 1.1
    );

    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    shadowGradient.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
    shadowGradient.addColorStop(0.78, "rgba(0, 0, 0, 0.42)");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    ctx.fillStyle = shadowGradient;
    ctx.fill();

    // Мягкое свечение атмосферы
    const atmosphereGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.92,
        centerX,
        centerY,
        radius * 1.18
    );

    atmosphereGradient.addColorStop(
        0,
        "rgba(80, 190, 255, 0)"
    );

    atmosphereGradient.addColorStop(
        0.72,
        "rgba(80, 190, 255, 0.04)"
    );

    atmosphereGradient.addColorStop(
        0.88,
        "rgba(80, 200, 255, 0.16)"
    );

    atmosphereGradient.addColorStop(
        1,
        "rgba(80, 200, 255, 0)"
    );

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.18, 0, Math.PI * 2);

    ctx.fillStyle = atmosphereGradient;
    ctx.fill();

    // Тонкая подсветка края атмосферы
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2 * zoom, 0, Math.PI * 2);

    ctx.strokeStyle = "rgba(120, 215, 255, 0.28)";
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();

    // Поверхность океана
    ctx.save();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const oceanGradient = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.4,
        radius * 0.1,
        centerX,
        centerY,
        radius
    );

    oceanGradient.addColorStop(0, "rgba(105, 190, 225, 0.32)");
    oceanGradient.addColorStop(0.45, "rgba(35, 115, 165, 0.22)");
    oceanGradient.addColorStop(0.75, "rgba(10, 55, 95, 0.18)");
    oceanGradient.addColorStop(1, "rgba(0, 10, 25, 0.05)");

    ctx.fillStyle = oceanGradient;
    ctx.fillRect(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
    );

    ctx.restore();

    // Материки
    ctx.save();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const continents = [
        {
            latitude: 0,
            longitude: 0,
            scale: 1.0,
            points: [
                [-0.55, -0.10],
                [-0.35, -0.38],
                [0.05, -0.48],
                [0.38, -0.30],
                [0.55, -0.02],
                [0.35, 0.22],
                [0.48, 0.48],
                [0.10, 0.55],
                [-0.20, 0.40],
                [-0.50, 0.25],
                [-0.62, 0.02]
            ]
        },

        {
            latitude: 35,
            longitude: 100,
            scale: 0.65,
            points: [
                [-0.50, -0.20],
                [-0.15, -0.42],
                [0.35, -0.35],
                [0.55, -0.05],
                [0.30, 0.25],
                [0.05, 0.45],
                [-0.40, 0.30],
                [-0.55, 0.05]
            ]
        },

        {
            latitude: -35,
            longitude: -90,
            scale: 0.55,
            points: [
                [-0.45, -0.25],
                [0.00, -0.45],
                [0.45, -0.20],
                [0.40, 0.20],
                [0.10, 0.45],
                [-0.35, 0.30],
                [-0.55, 0.00]
            ]
        },

        {
            latitude: 45,
            longitude: -130,
            scale: 0.35,
            points: [
                [-0.45, -0.20],
                [-0.10, -0.40],
                [0.40, -0.20],
                [0.50, 0.15],
                [0.10, 0.40],
                [-0.40, 0.25]
            ]
        }
    ];

    for (const continent of continents) {
        const latitudeRad =
            (continent.latitude * Math.PI) / 180;

        const longitudeRad =
            (continent.longitude * Math.PI) / 180;

        const rotatedLongitude =
            longitudeRad + planetRotation;

        const depth =
            Math.cos(rotatedLongitude);

        if (depth <= 0) {
            continue;
        }

        const continentX =
            centerX +
            Math.sin(rotatedLongitude) *
            Math.cos(latitudeRad) *
            radius;

        const continentY =
            centerY +
            Math.sin(latitudeRad) * radius;

        ctx.beginPath();

        continent.points.forEach(([x, y], index) => {
            const px =
                continentX +
                x *
                radius *
                continent.scale *
                depth;

            const py =
                continentY +
                y *
                radius *
                continent.scale *
                depth;

            if (index === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        });

        ctx.closePath();

        const continentGradient = ctx.createRadialGradient(
            continentX - radius * 0.15,
            continentY - radius * 0.18,
            radius * 0.05,
            continentX,
            continentY,
            radius * 0.65 * continent.scale
        );

        continentGradient.addColorStop(
            0,
            "rgba(105, 155, 75, 0.95)"
        );

        continentGradient.addColorStop(
            0.45,
            "rgba(70, 125, 60, 0.95)"
        );

        continentGradient.addColorStop(
            0.8,
            "rgba(40, 85, 50, 0.9)"
        );

        continentGradient.addColorStop(
            1,
            "rgba(20, 50, 35, 0.75)"
        );

        ctx.fillStyle = continentGradient;
        ctx.fill();
    }

    ctx.restore();

    // Облака
    cloudRotation += CLOUD_ROTATION_SPEED * 16;

    ctx.save();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    const clouds = [
        { latitude: 25, longitude: -120, size: 0.30 },
        { latitude: 28, longitude: -113, size: 0.18 },
        { latitude: 22, longitude: -128, size: 0.16 },

        { latitude: 5, longitude: -45, size: 0.22 },
        { latitude: 9, longitude: -38, size: 0.15 },
        { latitude: 1, longitude: -52, size: 0.13 },

        { latitude: -20, longitude: 40, size: 0.28 },
        { latitude: -16, longitude: 48, size: 0.17 },
        { latitude: -25, longitude: 33, size: 0.14 },

        { latitude: 35, longitude: 120, size: 0.18 },
        { latitude: 40, longitude: 126, size: 0.13 },

        { latitude: -35, longitude: 150, size: 0.24 },
        { latitude: -30, longitude: 157, size: 0.15 },

        { latitude: 10, longitude: 170, size: 0.20 },
        { latitude: 14, longitude: 176, size: 0.13 }
    ];

    for (const cloud of clouds) {
        const latitudeRad =
            (cloud.latitude * Math.PI) / 180;

        const longitudeRad =
            (cloud.longitude * Math.PI) / 180;

        const rotatedLongitude =
            longitudeRad + cloudRotation;

        const depth =
            Math.cos(rotatedLongitude);

        if (depth <= 0) {
            continue;
        }

        const cloudX =
            centerX +
            Math.sin(rotatedLongitude) *
            Math.cos(latitudeRad) *
            radius;

        const cloudY =
            centerY +
            Math.sin(latitudeRad) * radius;

        const cloudWidth =
            radius * cloud.size * depth;

        const cloudHeight =
            radius * cloud.size * 0.35 * depth;

        const cloudGradient = ctx.createRadialGradient(
            cloudX,
            cloudY,
            0,
            cloudX,
            cloudY,
            cloudWidth
        );

        cloudGradient.addColorStop(
            0,
            "rgba(255, 255, 255, 0.28)"
        );

        cloudGradient.addColorStop(
            0.55,
            "rgba(220, 235, 240, 0.14)"
        );

        cloudGradient.addColorStop(
            1,
            "rgba(200, 220, 230, 0)"
        );

        ctx.beginPath();

        ctx.ellipse(
            cloudX,
            cloudY,
            cloudWidth,
            cloudHeight,
            0,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = cloudGradient;
        ctx.fill();
    }

    ctx.restore();
    ctx.fill();
    }

function updateCamera() {
    zoom += (targetZoom - zoom) * 0.08;
}

function draw(time) {
    updateCamera();

    drawSpace(time);
    drawPlanet();

    requestAnimationFrame(draw);
}

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
        targetZoom += ZOOM_SPEED;
    } else {
        targetZoom -= ZOOM_SPEED;
    }

    targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, targetZoom)
    );
});

window.addEventListener("resize", () => {
    resizeCanvas();
    createStars();
});

resizeCanvas();
createStars();

requestAnimationFrame(draw);

canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
        return;
    }

    isDraggingPlanet = true;
    lastMouseX = event.clientX;
    rotationVelocity = 0;
});

canvas.addEventListener("mousemove", (event) => {
    if (!isDraggingPlanet) {
        return;
    }

    const deltaX = event.clientX - lastMouseX;

    planetRotation += deltaX * DRAG_ROTATION_SPEED;
    rotationVelocity = deltaX * DRAG_ROTATION_SPEED;

    lastMouseX = event.clientX;
});

window.addEventListener("mouseup", () => {
    isDraggingPlanet = false;
});