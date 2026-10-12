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

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) document.body.classList.add('page-ready');

  // Move between homepage panels with a deliberately slow, eased scroll.
  if (document.documentElement.classList.contains('home-scroll') && !reducedMotion) {
    var homePanels = Array.prototype.slice.call(document.querySelectorAll('.home-intro-panel, .honours-section, .home-work'));
    var panelAnimation = 0;
    function animatePanelScroll(targetY) {
      var startY = window.scrollY;
      var distance = targetY - startY;
      var startTime = performance.now();
      var duration = 800;
      var root = document.documentElement;
      root.style.scrollBehavior = 'auto';
      function frame(now) {
        var progress = Math.min(1, (now - startTime) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + distance * eased);
        if (progress < 1) {
          panelAnimation = window.requestAnimationFrame(frame);
        } else {
          panelAnimation = 0;
          root.style.removeProperty('scroll-behavior');
        }
      }
      panelAnimation = window.requestAnimationFrame(frame);
    }
    window.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX) || Math.abs(event.deltaY) < 24 || event.ctrlKey) return;
      var chromeOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var currentIndex = 0;
      var nearestDistance = Infinity;
      homePanels.forEach(function (panel, index) {
        var panelTop = panel.getBoundingClientRect().top + window.scrollY;
        var gap = Math.abs(panelTop - (window.scrollY + chromeOffset));
        if (gap < nearestDistance) { nearestDistance = gap; currentIndex = index; }
      });
      var nextIndex = currentIndex + (event.deltaY > 0 ? 1 : -1);
      if (nextIndex < 0 || nextIndex >= homePanels.length) return;
      var currentPanel = homePanels[currentIndex];
      if (currentPanel.offsetHeight > window.innerHeight - 8) return;
      event.preventDefault();
      if (panelAnimation) return;
      var nextTop = homePanels[nextIndex].getBoundingClientRect().top + window.scrollY - chromeOffset;
      animatePanelScroll(Math.max(0, nextTop));
    }, { passive: false });
  }

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

  // Write a small set of fixed research notes once, then leave them in place.
  var canvas = document.querySelector('.math-field');
  var context = canvas && canvas.getContext('2d');
  if (canvas && context) {
    var width = 0;
    var height = 0;
    var ratio = 1;
    var frame = 0;
    var revealStarted = performance.now();
    var writingDuration = 1850;
    var marks = [];
    function resizeCanvas() {
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      marks = width < 680
        ? [
          { text: 'det A = 1', x: .76, y: .19, size: 16, delay: 0 },
          { text: 'G(x, y)', x: .12, y: .84, size: 15, delay: 520 }
        ]
        : [
          { text: 'det A = 1', x: .84, y: .20, size: 18, delay: 0 },
          { text: 'λ₁ ≤ λ₂', x: .09, y: .38, size: 17, delay: 300 },
          { text: 'u″ + λu = 0', x: .86, y: .72, size: 16, delay: 650 },
          { text: 'G(x, y)', x: .12, y: .84, size: 16, delay: 950 }
        ];
    }
    function writeMark(mark, progress) {
      if (progress <= 0) return;
      var text = mark.text;
      var x = mark.x * width;
      var y = mark.y * height;
      context.save();
      context.font = '400 ' + mark.size + 'px Noto Serif,serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillStyle = 'rgba(63,96,122,.34)';
      var measured = context.measureText(text).width;
      if (x + measured > width - 12) x = width - measured - 12;
      context.beginPath();
      context.rect(x, y - mark.size, Math.max(0, measured * progress), mark.size * 2);
      context.clip();
      context.fillText(text, x, y);
      context.restore();

      context.save();
      context.strokeStyle = 'rgba(164,87,73,.24)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y + mark.size * .95);
      context.lineTo(x + measured * progress, y + mark.size * .95);
      context.stroke();
      context.restore();
    }
    function drawMathField(now) {
      var elapsed = Math.max(0, now - revealStarted);
      context.clearRect(0, 0, width, height);
      var complete = true;
      marks.forEach(function (mark) {
        var progress = reducedMotion ? 1 : Math.max(0, Math.min(1, (elapsed - mark.delay) / 540));
        writeMark(mark, progress);
        if (progress < 1) complete = false;
      });
      if (!reducedMotion && !complete && elapsed < writingDuration) {
        frame = window.requestAnimationFrame(drawMathField);
      } else {
        frame = 0;
      }
    }
    function resizeAndRedraw() {
      resizeCanvas();
      if (frame) window.cancelAnimationFrame(frame);
      drawMathField(performance.now());
    }
    resizeCanvas();
    drawMathField(performance.now());
    window.addEventListener('resize', resizeAndRedraw, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        drawMathField(performance.now());
      }
    });
  }

});
