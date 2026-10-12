document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
        toggle.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (links.classList.contains('open') && !links.contains(event.target) && !toggle.contains(event.target)) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
      }
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var honoursCarousel = document.getElementById('honours-carousel');
  if (honoursCarousel) {
    var honourSlides = Array.prototype.slice.call(honoursCarousel.querySelectorAll('.honour-slide'));
    var honourCount = document.getElementById('honours-count');
    var activeHonour = 0;
    function slideScrollLeft(slide) {
      var carouselLeft = honoursCarousel.getBoundingClientRect().left;
      return slide.getBoundingClientRect().left - carouselLeft + honoursCarousel.scrollLeft;
    }
    function updateHonourCount() {
      var currentLeft = honoursCarousel.scrollLeft;
      var closest = 0;
      var distance = Infinity;
      honourSlides.forEach(function (slide, index) {
        var offset = Math.abs(slideScrollLeft(slide) - currentLeft);
        if (offset < distance) { distance = offset; closest = index; }
      });
      activeHonour = closest;
      if (honourCount) honourCount.textContent = String(closest + 1).padStart(2, '0') + ' / ' + String(honourSlides.length).padStart(2, '0');
    }
    function moveHonours(direction) {
      var next = Math.max(0, Math.min(honourSlides.length - 1, activeHonour + direction));
      honoursCarousel.scrollTo({ left: slideScrollLeft(honourSlides[next]), behavior: reducedMotion ? 'auto' : 'smooth' });
      activeHonour = next;
      if (honourCount) honourCount.textContent = String(next + 1).padStart(2, '0') + ' / ' + String(honourSlides.length).padStart(2, '0');
    }
    var honoursSection = honoursCarousel.closest('.honours-section');
    var autoplayTimer = 0;
    function stopHonourAutoplay() {
      window.clearInterval(autoplayTimer);
      autoplayTimer = 0;
    }
    function startHonourAutoplay() {
      stopHonourAutoplay();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      autoplayTimer = window.setInterval(function () {
        if (document.hidden || honourSlides.length < 2) return;
        moveHonours(activeHonour === honourSlides.length - 1 ? -activeHonour : 1);
      }, 8500);
    }
    if (honoursSection) {
      honoursSection.addEventListener('mouseenter', stopHonourAutoplay);
      honoursSection.addEventListener('mouseleave', startHonourAutoplay);
      honoursSection.addEventListener('focusin', stopHonourAutoplay);
      honoursSection.addEventListener('focusout', function (event) {
        if (!honoursSection.contains(event.relatedTarget)) startHonourAutoplay();
      });
      startHonourAutoplay();
    }
    var previousHonour = document.querySelector('[data-carousel-prev]');
    var nextHonour = document.querySelector('[data-carousel-next]');
    if (previousHonour) previousHonour.addEventListener('click', function () { moveHonours(-1); });
    if (nextHonour) nextHonour.addEventListener('click', function () { moveHonours(1); });
    honoursCarousel.addEventListener('scroll', updateHonourCount, { passive: true });
    honoursCarousel.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') { event.preventDefault(); moveHonours(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveHonours(-1); }
    });
    window.addEventListener('resize', updateHonourCount, { passive: true });
  }

  // Expand Saksham when a direct patent anchor is opened.
  function revealSakshamAnchor() {
    var targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!['patents', 'wearable-cap', 'navigation-stick'].includes(targetId)) return;
    var sakshamDetails = document.querySelector('#saksham > .saksham-card-details');
    if (sakshamDetails) sakshamDetails.open = true;
    var patentDetails = document.querySelector('#saksham .saksham-patent-details');
    if (patentDetails) patentDetails.open = true;
    window.requestAnimationFrame(function () {
      var target = document.getElementById(targetId);
      if (target) target.scrollIntoView();
    });
  }
  revealSakshamAnchor();
  window.addEventListener('hashchange', revealSakshamAnchor);

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) document.body.classList.add('page-ready');

  // Let the reader encounter each section as if turning to the next page.
  var revealItems = document.querySelectorAll(
    '.honours-section, .home-work, .honour-item, .work-index-row, .project-row, .activity-note, .timeline-entry, .publication, .editorial-about, .about-recognition'
  );
  if ('IntersectionObserver' in window && !reducedMotion && revealItems.length) {
    revealItems.forEach(function (item) { item.classList.add('reveal-item'); });
    document.body.classList.add('reveal-ready');
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    revealItems.forEach(function (item) { revealObserver.observe(item); });
  }


});
