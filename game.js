const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;

const stars = [];
const STAR_COUNT = 220;

let zoom = 1;
let targetZoom = 1;

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
    const centerX = width / 2;
    const centerY = height / 2;

    const baseRadius = Math.min(width, height) * 0.18;
    const radius = baseRadius * zoom;

    const gradient = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.35,
        radius * 0.1,
        centerX,
        centerY,
        radius
    );

    gradient.addColorStop(0, "#6fa8dc");
    gradient.addColorStop(0.45, "#2f6fa3");
    gradient.addColorStop(0.8, "#12345a");
    gradient.addColorStop(1, "#050b18");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8 * zoom, 0, Math.PI * 2);

    ctx.strokeStyle = "rgba(120, 200, 255, 0.25)";
    ctx.lineWidth = 8 * zoom;
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