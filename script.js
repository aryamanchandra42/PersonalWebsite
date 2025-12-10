// Hero image slideshow
const heroImages = [
    'header_images/beautiful mind.jpg',
    'header_images/gwh.jpg',
    'header_images/oppenheimer.jpg',
    'header_images/x+y.jpg'
];

const heroImage = document.getElementById('heroImage');

// Random image on each refresh
const randomIndex = Math.floor(Math.random() * heroImages.length);
heroImage.src = heroImages[randomIndex];

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

// Floating math symbols background
const canvas = document.getElementById('mathCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const mathSymbols = ['φ'];

// Math links for clickable symbols
const mathLinks = [
    { url: 'https://en.wikipedia.org/wiki/Golden_ratio', title: 'golden ratio' },
    { url: 'https://en.wikipedia.org/wiki/Euler%27s_identity', title: 'euler\'s identity' },
    { url: 'https://en.wikipedia.org/wiki/Riemann_hypothesis', title: 'riemann hypothesis' },
    { url: 'https://en.wikipedia.org/wiki/Fibonacci_sequence', title: 'fibonacci sequence' },
    { url: 'https://en.wikipedia.org/wiki/Gödel%27s_incompleteness_theorems', title: 'gödel\'s incompleteness' },
    { url: 'https://en.wikipedia.org/wiki/Mandelbrot_set', title: 'mandelbrot set' },
    { url: 'https://en.wikipedia.org/wiki/Prime_number', title: 'prime numbers' },
    { url: 'https://en.wikipedia.org/wiki/Collatz_conjecture', title: 'collatz conjecture' },
    { url: 'https://en.wikipedia.org/wiki/P_versus_NP_problem', title: 'p vs np' },
    { url: 'https://en.wikipedia.org/wiki/Fermat%27s_Last_Theorem', title: 'fermat\'s last theorem' },
    { url: 'https://en.wikipedia.org/wiki/Pythagorean_theorem', title: 'pythagorean theorem' },
    { url: 'https://en.wikipedia.org/wiki/Fundamental_theorem_of_calculus', title: 'fundamental theorem of calculus' },
    { url: 'https://en.wikipedia.org/wiki/Navier–Stokes_equations', title: 'navier-stokes equations' },
    { url: 'https://en.wikipedia.org/wiki/Fourier_transform', title: 'fourier transform' },
    { url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem', title: 'bayes\' theorem' },
    { url: 'https://en.wikipedia.org/wiki/Central_limit_theorem', title: 'central limit theorem' },
    { url: 'https://en.wikipedia.org/wiki/Cantor%27s_diagonal_argument', title: 'cantor\'s diagonal argument' },
    { url: 'https://en.wikipedia.org/wiki/Zeno%27s_paradoxes', title: 'zeno\'s paradoxes' },
    { url: 'https://en.wikipedia.org/wiki/Banach–Tarski_paradox', title: 'banach-tarski paradox' },
    { url: 'https://en.wikipedia.org/wiki/Halting_problem', title: 'halting problem' },
    { url: 'https://en.wikipedia.org/wiki/Chaos_theory', title: 'chaos theory' },
    { url: 'https://en.wikipedia.org/wiki/Game_theory', title: 'game theory' },
    { url: 'https://en.wikipedia.org/wiki/Nash_equilibrium', title: 'nash equilibrium' },
    { url: 'https://en.wikipedia.org/wiki/Monty_Hall_problem', title: 'monty hall problem' },
    { url: 'https://en.wikipedia.org/wiki/Birthday_problem', title: 'birthday problem' },
    { url: 'https://en.wikipedia.org/wiki/Seven_Bridges_of_Königsberg', title: 'seven bridges of königsberg' },
    { url: 'https://en.wikipedia.org/wiki/Travelling_salesman_problem', title: 'travelling salesman problem' },
    { url: 'https://en.wikipedia.org/wiki/Hilbert%27s_problems', title: 'hilbert\'s problems' },
    { url: 'https://en.wikipedia.org/wiki/Continuum_hypothesis', title: 'continuum hypothesis' },
    { url: 'https://en.wikipedia.org/wiki/Poincaré_conjecture', title: 'poincaré conjecture' },
    { url: 'https://en.wikipedia.org/wiki/Twin_prime', title: 'twin prime conjecture' },
    { url: 'https://en.wikipedia.org/wiki/Goldbach%27s_conjecture', title: 'goldbach\'s conjecture' },
    { url: 'https://en.wikipedia.org/wiki/Catalan_number', title: 'catalan numbers' },
    { url: 'https://en.wikipedia.org/wiki/Stirling%27s_approximation', title: 'stirling\'s approximation' },
    { url: 'https://en.wikipedia.org/wiki/Taylor_series', title: 'taylor series' },
    { url: 'https://en.wikipedia.org/wiki/Laplace_transform', title: 'laplace transform' },
    { url: 'https://en.wikipedia.org/wiki/Eigenvalues_and_eigenvectors', title: 'eigenvalues & eigenvectors' },
    { url: 'https://en.wikipedia.org/wiki/Singular_value_decomposition', title: 'singular value decomposition' },
    { url: 'https://en.wikipedia.org/wiki/Noether%27s_theorem', title: 'noether\'s theorem' },
    { url: 'https://en.wikipedia.org/wiki/Stokes%27_theorem', title: 'stokes\' theorem' },
    { url: 'https://en.wikipedia.org/wiki/Green%27s_theorem', title: 'green\'s theorem' },
    { url: 'https://en.wikipedia.org/wiki/Divergence_theorem', title: 'divergence theorem' },
    { url: 'https://en.wikipedia.org/wiki/Euler%27s_formula', title: 'euler\'s formula' },
    { url: 'https://en.wikipedia.org/wiki/De_Moivre%27s_formula', title: 'de moivre\'s formula' },
    { url: 'https://en.wikipedia.org/wiki/Cauchy%27s_integral_theorem', title: 'cauchy\'s integral theorem' },
    { url: 'https://en.wikipedia.org/wiki/Residue_theorem', title: 'residue theorem' },
    { url: 'https://en.wikipedia.org/wiki/Binomial_theorem', title: 'binomial theorem' },
    { url: 'https://en.wikipedia.org/wiki/Law_of_large_numbers', title: 'law of large numbers' },
    { url: 'https://en.wikipedia.org/wiki/Markov_chain', title: 'markov chains' },
    { url: 'https://en.wikipedia.org/wiki/Monte_Carlo_method', title: 'monte carlo method' },
    { url: 'https://en.wikipedia.org/wiki/Gradient_descent', title: 'gradient descent' },
    { url: 'https://en.wikipedia.org/wiki/Simplex_algorithm', title: 'simplex algorithm' },
    { url: 'https://en.wikipedia.org/wiki/Fast_Fourier_transform', title: 'fast fourier transform' },
    { url: 'https://en.wikipedia.org/wiki/RSA_(cryptosystem)', title: 'rsa cryptosystem' },
    { url: 'https://en.wikipedia.org/wiki/Diffie–Hellman_key_exchange', title: 'diffie-hellman key exchange' },
    { url: 'https://en.wikipedia.org/wiki/Turing_machine', title: 'turing machine' },
    { url: 'https://en.wikipedia.org/wiki/Church–Turing_thesis', title: 'church-turing thesis' },
    { url: 'https://en.wikipedia.org/wiki/Lambda_calculus', title: 'lambda calculus' },
    { url: 'https://en.wikipedia.org/wiki/Boolean_algebra', title: 'boolean algebra' },
    { url: 'https://en.wikipedia.org/wiki/Quaternion', title: 'quaternions' },
    { url: 'https://en.wikipedia.org/wiki/Tensor', title: 'tensors' },
    { url: 'https://en.wikipedia.org/wiki/Topology', title: 'topology' },
    { url: 'https://en.wikipedia.org/wiki/Möbius_strip', title: 'möbius strip' },
    { url: 'https://en.wikipedia.org/wiki/Klein_bottle', title: 'klein bottle' },
    { url: 'https://en.wikipedia.org/wiki/Fractal', title: 'fractals' },
    { url: 'https://en.wikipedia.org/wiki/Julia_set', title: 'julia set' },
    { url: 'https://en.wikipedia.org/wiki/Lorenz_system', title: 'lorenz attractor' },
    { url: 'https://en.wikipedia.org/wiki/Cellular_automaton', title: 'cellular automata' },
    { url: 'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life', title: 'game of life' }
];

// Track which links are currently in use
let usedLinkIndices = new Set();

function getUniqueMathLink() {
    // If all links are used, reset
    if (usedLinkIndices.size >= mathLinks.length) {
        usedLinkIndices.clear();
    }
    
    let index;
    do {
        index = Math.floor(Math.random() * mathLinks.length);
    } while (usedLinkIndices.has(index));
    
    usedLinkIndices.add(index);
    return { link: mathLinks[index], index: index };
}

function releaseMathLink(index) {
    usedLinkIndices.delete(index);
}

// Tooltip element
const tooltip = document.createElement('div');
tooltip.className = 'phi-tooltip';
document.body.appendChild(tooltip);

// Track hovered particle
let hoveredParticle = null;

// Click detection on canvas
canvas.style.pointerEvents = 'auto';

canvas.addEventListener('click', (e) => {
    if (hoveredParticle) {
        window.open(hoveredParticle.link.url, '_blank');
    }
});

// Hover detection
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    hoveredParticle = null;
    
    for (const particle of particles) {
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < particle.size + 10) {
            hoveredParticle = particle;
            particle.hovered = true;
            tooltip.textContent = particle.link.title;
            tooltip.style.left = e.clientX + 'px';
            tooltip.style.top = (e.clientY - 30) + 'px';
            tooltip.style.opacity = '1';
            canvas.style.cursor = 'none';
            break;
        } else {
            particle.hovered = false;
        }
    }
    
    if (!hoveredParticle) {
        tooltip.style.opacity = '0';
        canvas.style.cursor = 'default';
        particles.forEach(p => p.hovered = false);
    }
});

canvas.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    canvas.style.cursor = 'default';
    hoveredParticle = null;
    particles.forEach(p => p.hovered = false);
});

// Get hero image center for gravitational field
function getImageCenter() {
    const img = document.getElementById('heroImage');
    if (img) {
        const rect = img.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            radius: Math.max(rect.width, rect.height) / 2 + 50
        };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, radius: 200 };
}

class MathParticle {
    constructor() {
        this.reset();
        this.y = Math.random() * canvas.height;
        this.vx = 0;
        this.vy = 0;
    }
    
    reset() {
        // Release old link if exists
        if (this.linkIndex !== undefined) {
            releaseMathLink(this.linkIndex);
        }
        
        this.x = Math.random() * canvas.width;
        this.y = -50;
        this.symbol = mathSymbols[Math.floor(Math.random() * mathSymbols.length)];
        this.size = Math.random() * 20 + 14;
        this.baseSpeed = Math.random() * 0.5 + 0.2;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.01;
        this.baseDrift = (Math.random() - 0.5) * 0.3;
        this.vx = this.baseDrift;
        this.vy = this.baseSpeed;
        
        // Get unique link
        const linkData = getUniqueMathLink();
        this.link = linkData.link;
        this.linkIndex = linkData.index;
        this.hovered = false;
    }
    
    update() {
        // Respawn if too close to hero image
        const imgCenter = getImageCenter();
        const imgDx = imgCenter.x - this.x;
        const imgDy = imgCenter.y - this.y;
        const imgDist = Math.sqrt(imgDx * imgDx + imgDy * imgDy);
        
        if (imgDist < imgCenter.radius) {
            this.reset();
            return;
        }
        
        // Apply friction and return to base movement
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.vx += (this.baseDrift - this.vx) * 0.01;
        this.vy += (this.baseSpeed - this.vy) * 0.01;
        
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        
        if (this.y > canvas.height + 50 || this.x < -100 || this.x > canvas.width + 100) {
            this.reset();
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        const weight = this.hovered ? 'bold' : 'normal';
        const size = this.hovered ? this.size * 1.3 : this.size;
        const opacity = this.hovered ? 0.8 : this.opacity;
        ctx.font = `${weight} ${size}px "EB Garamond", Georgia, serif`;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.symbol, 0, 0);
        ctx.restore();
    }
}

const particles = [];
const particleCount = Math.min(50, Math.floor(window.innerWidth / 30));

for (let i = 0; i < particleCount; i++) {
    particles.push(new MathParticle());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
    
    requestAnimationFrame(animate);
}

animate();

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

document.querySelectorAll('.section, .project-card, .stat-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
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
    anchor.addEventListener('click', function(e) {
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

