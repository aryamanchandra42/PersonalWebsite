// ─── Nav: scrolled border state ─────────────────────────────
const nav = document.getElementById('siteNav');
if (nav) {
    const updateNav = () => {
        nav.classList.toggle('scrolled', window.scrollY > 16);
    };
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
}

// ─── Nav toggle ──────────────────────────────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks && nav) {
    const setMenuOpen = (open) => {
        navLinks.classList.toggle('open', open);
        nav.classList.toggle('menu-open', open);
        document.documentElement.classList.toggle('nav-open', open);
        navToggle.setAttribute('aria-expanded', String(open));
    };

    navToggle.addEventListener('click', () => {
        setMenuOpen(!navLinks.classList.contains('open'));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('click', (event) => {
        if (!navLinks.classList.contains('open')) return;
        if (nav.contains(event.target) || navToggle.contains(event.target)) return;
        setMenuOpen(false);
    });
}

// ─── Highlight current page in nav ───────────────────────────
const path = window.location.pathname.replace(/\\/g, '/');
const page = path.split('/').pop() || 'index.html';

if (navLinks) {
    navLinks.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const linkPage = href.split('#')[0].split('/').pop();
        if (linkPage === page) link.classList.add('is-active');
    });
}

// ─── Stagger reveal delays ───────────────────────────────────
document.querySelectorAll('.achievement-grid, .selected-grid, .card-grid, .contact-row').forEach((group) => {
    group.querySelectorAll('.reveal').forEach((el, i) => {
        el.dataset.delay = String(Math.min(i % 4 + 1, 3));
    });
});

// ─── Scroll reveal ────────────────────────────────────────────
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

    revealEls.forEach((el) => observer.observe(el));
}

// ─── YouTube embeds: file:// fallback ────────────────────────
if (location.protocol === 'file:') {
    document.querySelectorAll('.video-embed, .research-award-video').forEach((embed) => {
        embed.classList.add('is-file-fallback');
        const fallback = embed.querySelector('.video-fallback');
        const iframe = embed.querySelector('iframe');
        if (fallback) fallback.style.display = 'block';
        if (iframe) iframe.style.display = 'none';
    });
}
