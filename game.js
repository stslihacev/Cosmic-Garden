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

    // Поверхность планеты
    ctx.save();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Смещение поверхности при вращении
    const rotationWidth = radius * 1.8;

    let rotationOffset =
        (planetRotation * radius * 0.18) % rotationWidth;

    if (rotationOffset < 0) {
        rotationOffset += rotationWidth;
    }

    rotationOffset -= rotationWidth / 2;

    // Океан
    const oceanGradient = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.4,
        radius * 0.1,
        centerX,
        centerY,
        radius
    );

    oceanGradient.addColorStop(0, "rgba(75, 150, 195, 0.35)");
    oceanGradient.addColorStop(0.5, "rgba(30, 105, 155, 0.2)");
    oceanGradient.addColorStop(1, "rgba(5, 30, 55, 0)");

    ctx.fillStyle = oceanGradient;
    ctx.fillRect(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
    );

    // Материки
    const continents = [
        {
            x: -0.38,
            y: -0.18,
            width: 0.48,
            height: 0.25,
            rotation: -0.2
        },
        {
            x: 0.12,
            y: -0.32,
            width: 0.36,
            height: 0.22,
            rotation: 0.35
        },
        {
            x: 0.28,
            y: 0.12,
            width: 0.42,
            height: 0.27,
            rotation: -0.3
        },
        {
            x: -0.18,
            y: 0.3,
            width: 0.32,
            height: 0.18,
            rotation: 0.15
        }
    ];

    for (const continent of continents) {
        const continentX =
            centerX +
            continent.x * radius +
            rotationOffset;

        const continentY =
            centerY +
            continent.y * radius;

        const continentWidth =
            continent.width * radius;

        const continentHeight =
            continent.height * radius;

        const positions = [
            continentX - rotationWidth,
            continentX,
            continentX + rotationWidth
        ];

        for (const x of positions) {
            const continentGradient = ctx.createRadialGradient(
                x - continentWidth * 0.25,
                continentY - continentHeight * 0.25,
                0,
                x,
                continentY,
                continentWidth
            );

            continentGradient.addColorStop(
                0,
                "rgba(105, 155, 105, 0.75)"
            );

            continentGradient.addColorStop(
                0.65,
                "rgba(65, 110, 75, 0.55)"
            );

            continentGradient.addColorStop(
                1,
                "rgba(30, 70, 55, 0)"
            );

            ctx.beginPath();

            ctx.ellipse(
                x,
                continentY,
                continentWidth,
                continentHeight,
                continent.rotation,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = continentGradient;
            ctx.fill();
        }
    }

    ctx.restore();

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