// Hero image slideshow
const heroImages = [
    'header_images/beautiful mind.jpg',
    'header_images/gwh.jpg',
    'header_images/oppenheimer.jpg',
    'header_images/x+y.jpg'
];

const heroImage = document.getElementById('heroImage');

// Random image on each refresh
// Random image on each refresh
if (heroImage) {
    const randomIndex = Math.floor(Math.random() * heroImages.length);
    heroImage.src = heroImages[randomIndex];
}

// Last updated date
const lastUpdated = document.getElementById('lastUpdated');
if (lastUpdated) {
    const date = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    lastUpdated.textContent = date.toLocaleDateString('en-US', options);
}

// Nav toggle
const navToggle = document.getElementById('navToggle');
const navDropdown = document.getElementById('navDropdown');
if (navToggle && navDropdown) {
    navToggle.addEventListener('click', () => {
        navDropdown.classList.toggle('open');
    });
}

// Carousel functionality
function changeSlide(carouselId, direction) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.carousel-image');
    const dots = carousel.querySelectorAll('.dot');
    let currentIndex = 0;

    images.forEach((img, index) => {
        if (img.classList.contains('active')) {
            currentIndex = index;
        }
    });

    images[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;

    images[newIndex].classList.add('active');
    dots[newIndex].classList.add('active');
}

function currentSlide(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.carousel-image');
    const dots = carousel.querySelectorAll('.dot');

    images.forEach((img, i) => {
        img.classList.toggle('active', i === index);
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

// Auto-advance carousel (optional)
function initCarouselAutoAdvance(carouselId) {
    setInterval(() => {
        changeSlide(carouselId, 1);
    }, 5000);
}

// Initialize auto-advance for IIT carousel
if (document.getElementById('iitCarousel')) {
    initCarouselAutoAdvance('iitCarousel');
}

// Lorenz Attractor Background
const canvas = document.getElementById('mathCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let lorenzPoints = [];
let x = 0.1, y = 0, z = 0;
const sigma = 10;
const rho = 28;
const beta = 8 / 3;
const dt = 0.01;
const scale = 15;
const maxPoints = 2000;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Clear existing points on resize to start fresh center
    lorenzPoints = [];
    x = 0.1; y = 0; z = 0;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateLorenz() {
    const dx = sigma * (y - x) * dt;
    const dy = (x * (rho - z) - y) * dt;
    const dz = (x * y - beta * z) * dt;

    x += dx;
    y += dy;
    z += dz;

    lorenzPoints.push({ x, y, z });
    if (lorenzPoints.length > maxPoints) {
        lorenzPoints.shift();
    }
}

function drawLorenz() {
    // Fade background slightly for trail effect (or clear completely for crisp line)
    // ctx.fillStyle = 'rgba(249, 248, 244, 1)'; // Matches bg-primary
    // ctx.fillRect(0, 0, width, height); -- Actually, let's keep it transparent for the austere look
    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    // Center the attractor
    const centerX = width / 2;
    const centerY = height / 2;

    if (lorenzPoints.length > 0) {
        ctx.moveTo(centerX + lorenzPoints[0].x * scale, centerY + lorenzPoints[0].y * scale);
        for (let i = 1; i < lorenzPoints.length; i++) {
            const p = lorenzPoints[i];
            // Simple projection
            ctx.lineTo(centerX + p.x * scale, centerY + p.y * scale);
        }
    }

    ctx.strokeStyle = 'rgba(44, 62, 80, 0.5)'; // Darker, more visible ink
    ctx.lineWidth = 1;
    ctx.stroke();
}

function animate() {
    updateLorenz();
    drawLorenz();
    requestAnimationFrame(animate);
}

animate();

// Living Footer
const footerMath = document.querySelector('.footer-math');
if (footerMath) {
    const probabilities = [
        "i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi", // Schrödinger
        "G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}", // Einstein Field Equations
        "\\delta S = 0", // Principle of Least Action
        "S = k_B \\ln \\Omega", // Boltzmann Entropy
        "e^{i\\pi} + 1 = 0", // Euler's Identity
        "\\zeta(s) = \\prod_{p} (1-p^{-s})^{-1}", // Riemann Zeta
        "\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}", // Ampere-Maxwell
        "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}" // Bayes
    ];

    // Pick a random one on load
    const randomMath = probabilities[Math.floor(Math.random() * probabilities.length)];
    // Set text content
    footerMath.textContent = `$$${randomMath}$$`;

    // Robust MathJax Typeset Trigger
    function renderMath() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([footerMath]).catch(err => console.log('MathJax error: ' + err));
        } else {
            // If not ready, retry shortly
            setTimeout(renderMath, 100);
        }
    }

    // Attempt render
    renderMath();
}

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.section, .project-card, .stat-card, .maker-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Mobile "Focus" Interaction for Images
document.addEventListener('DOMContentLoaded', () => {
    const archivalImages = document.querySelectorAll('.hero-image, .archival-img');

    archivalImages.forEach(img => {
        img.addEventListener('click', function (e) {
            // Check if mobile (coarse pointer)
            if (window.matchMedia('(pointer: coarse)').matches) {
                // If it's a link, prevent default on first tap if not focused
                // But these are just images for now
                this.classList.toggle('hover-effect');
            }
        });
    });
});

// Add visible class styles
const style = document.createElement('style');
style.textContent = `
    .visible {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Typewriter effect
const typewriter = document.querySelector('.typewriter');
if (typewriter) {
    const text = typewriter.textContent;
    typewriter.textContent = '';
    let i = 0;

    function type() {
        if (i < text.length) {
            typewriter.textContent += text.charAt(i);
            i++;
            setTimeout(type, 80);
        }
    }

    setTimeout(type, 1000);
}

// Easter egg: Konami code reveals a math joke
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiSequence.join(',')) {
        alert('🤓 Why do mathematicians confuse Halloween and Christmas?\n\nBecause Oct 31 = Dec 25!\n\n(31 in octal = 25 in decimal)');
        konamiCode = [];
    }
});

console.log('%c∫ Welcome to my portfolio! %c\n\nIf you\'re reading this, you\'re probably a developer too.\nLet\'s connect! 🧮',
    'font-size: 20px; color: #d4a853; font-weight: bold;',
    'font-size: 12px; color: #9d9d9d;'
);

