/* =========================================================
   LUMIÈRE PREMIUM UNISEX SALON — Master Scripts
   ========================================================= */

'use strict';

/* ───────────────────────────────────────────────────────────
   1. NAVBAR — Scroll + Mobile Toggle
─────────────────────────────────────────────────────────── */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
    const isOpen = navLinks.classList.contains('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    
    // Toggle body scroll lock
    document.body.classList.toggle('no-scroll', isOpen);
  });

  // Close menu on nav-link click
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
    });
  });

  // Close on outside click (if click was outside navbar)
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open') && !navbar.contains(e.target)) {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
    }
  });
}

/* ───────────────────────────────────────────────────────────
   2. HERO SLIDER
─────────────────────────────────────────────────────────── */
const slides   = document.querySelectorAll('.hero-slide');
const bgLayers = document.querySelectorAll('.hero-bg-layer');
const dots     = document.querySelectorAll('.sdot');
const slideNum = document.getElementById('slide-cur');

let currentSlide = 0;
let sliderTimer  = null;
const SLIDE_INTERVAL = 5000;

const heroBgs = [
  'hero-makeup-pinkish.png',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1900&q=85&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1900&q=85&auto=format&fit=crop'
];

function goToSlide(index) {
  // Deactivate current
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  bgLayers[currentSlide].classList.remove('active');

  currentSlide = (index + slides.length) % slides.length;

  // Activate new
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
  bgLayers[currentSlide].classList.add('active');

  // Update counter
  if (slideNum) {
    slideNum.textContent = String(currentSlide + 1).padStart(2, '0');
  }
}

function nextSlide() {
  goToSlide(currentSlide + 1);
}

function startSlider() {
  if (slides.length > 1) {
    sliderTimer = setInterval(nextSlide, SLIDE_INTERVAL);
  }
}

function resetSlider() {
  clearInterval(sliderTimer);
  startSlider();
}

// Dot click
dots.forEach((dot, i) => {
  dot.addEventListener('click', () => {
    goToSlide(i);
    resetSlider();
  });
});

// Keyboard arrow navigation on hero
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { goToSlide(currentSlide + 1); resetSlider(); }
  if (e.key === 'ArrowLeft')  { goToSlide(currentSlide - 1); resetSlider(); }
});

// Touch swipe on hero
(function initHeroSwipe() {
  const hero = document.querySelector('.hero-section');
  if (!hero) return;
  let startX = 0;
  hero.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend',   e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goToSlide(currentSlide + 1) : goToSlide(currentSlide - 1);
      resetSlider();
    }
  }, { passive: true });
})();

startSlider();

/* ───────────────────────────────────────────────────────────
   3. SERVICES TAB SWITCHER
─────────────────────────────────────────────────────────── */
const svcTabs   = document.querySelectorAll('.svc-tab');
const svcPanels = document.querySelectorAll('.svc-panel');

svcTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    svcTabs.forEach(t => t.classList.remove('active'));
    svcPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const panel = document.getElementById('panel-' + target);
    if (panel) {
      panel.classList.add('active');
      // Animate cards in
      panel.querySelectorAll('.svc-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
          card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 60);
      });
    }
  });
});

/* ───────────────────────────────────────────────────────────
   4. FAQ ACCORDION
─────────────────────────────────────────────────────────── */
function toggleFaq(id) {
  const item = document.getElementById(id);
  if (!item) return;

  const isOpen = item.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-item').forEach(fi => fi.classList.remove('open'));

  // Open clicked (if it was closed)
  if (!isOpen) item.classList.add('open');
}



/* ───────────────────────────────────────────────────────────
   6. SCROLL ANIMATIONS (IntersectionObserver)
─────────────────────────────────────────────────────────── */
function initScrollAnimations() {
  // Mark animate targets
  const animTargets = [
    '.hero-stat-card',
    '.svc-card',
    '.why-card',
    '.treat-card',
    '.expert-card',
    '.gb-item',
    '.pricing-card',
    '.testi-card',
    '.faq-item',
    '.ci-card',
    '.about-img-cell',
    '.about-content-cell',
    '.cta-content',
    '.cta-form-box',
  ];

  const elements = document.querySelectorAll(animTargets.join(', '));

  elements.forEach(el => {
    el.classList.add('animate-up');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger delay based on sibling index
        const siblings = [...(entry.target.parentElement?.children || [])];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add('in-view');
        }, idx * 80);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ───────────────────────────────────────────────────────────
   7. ACTIVE NAV HIGHLIGHT ON SCROLL
─────────────────────────────────────────────────────────── */
function initNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach(link => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === '#' + id
          );
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(sec => observer.observe(sec));
}

/* ───────────────────────────────────────────────────────────
   8. SMOOTH SCROLL for anchor links
─────────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = navbar ? navbar.offsetHeight + 20 : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ───────────────────────────────────────────────────────────
   9. ACTIVE NAV LINK CSS INJECTION
─────────────────────────────────────────────────────────── */
(function injectNavActiveStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .nav-link.nav-active {
      color: var(--accent) !important;
      background: var(--accent-light) !important;
    }
    .navbar:not(.scrolled) .nav-link.nav-active {
      background: rgba(200,149,107,0.18) !important;
      color: #fff !important;
    }
  `;
  document.head.appendChild(style);
})();

/* ───────────────────────────────────────────────────────────
   10. SET MIN DATE FOR BOOKING FORM
─────────────────────────────────────────────────────────── */
(function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  const dateInputInline = document.getElementById('cta-bk-date');
  if (dateInputInline) {
    dateInputInline.setAttribute('min', today);
    dateInputInline.value = today;
  }
})();

/* ───────────────────────────────────────────────────────────
   11. INIT ON DOM READY
─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initNavHighlight();
  initTestiCarousel();
});

/* ───────────────────────────────────────────────────────────
   12. GALLERY HOVER — touch devices fallback
─────────────────────────────────────────────────────────── */
document.querySelectorAll('.gb-item').forEach(item => {
  item.addEventListener('touchstart', () => {
    item.classList.add('touched');
    document.querySelectorAll('.gb-item').forEach(other => {
      if (other !== item) other.classList.remove('touched');
    });
  }, { passive: true });
});

// Inject touch CSS
(function injectTouchGalleryStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .gb-item.touched .gb-overlay  { opacity: 1; }
    .gb-item.touched .gb-cat,
    .gb-item.touched .gb-title    { transform: translateY(0); }
    .gb-item.touched img          { transform: scale(1.04); }
  `;
  document.head.appendChild(s);
})();

/* ───────────────────────────────────────────────────────────
   13. TESTIMONIALS CAROUSEL
─────────────────────────────────────────────────────────── */
function initTestiCarousel() {
  const track = document.getElementById('testi-track');
  const prevBtn = document.getElementById('testi-prev');
  const nextBtn = document.getElementById('testi-next');
  const dotsContainer = document.getElementById('testi-dots');
  const cards = document.querySelectorAll('.testi-card');

  if (!track || cards.length === 0) return;

  let slideIndex = 0;
  
  function getVisibleCardsCount() {
    if (window.innerWidth <= 480) return 1;
    if (window.innerWidth <= 1100) return 2;
    return 3;
  }

  function getStepWidth() {
    const card = cards[0];
    const cardWidth = card.getBoundingClientRect().width;
    const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
    return cardWidth + gap;
  }

  function getMaxIndex() {
    return Math.max(0, cards.length - getVisibleCardsCount());
  }

  function updateCarousel() {
    const maxIdx = getMaxIndex();
    if (slideIndex > maxIdx) slideIndex = maxIdx;
    if (slideIndex < 0) slideIndex = 0;

    const step = getStepWidth();
    track.style.transform = `translateX(-${slideIndex * step}px)`;

    if (prevBtn) prevBtn.style.opacity = slideIndex === 0 ? '0.3' : '1';
    if (nextBtn) nextBtn.style.opacity = slideIndex === maxIdx ? '0.3' : '1';

    const dots = dotsContainer.querySelectorAll('.testi-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === slideIndex);
    });
  }

  function setupDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const dotsCount = getMaxIndex() + 1;
    for (let i = 0; i < dotsCount; i++) {
      const dot = document.createElement('button');
      dot.classList.add('testi-dot');
      if (i === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => {
        slideIndex = i;
        updateCarousel();
      });
      dotsContainer.appendChild(dot);
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (slideIndex < getMaxIndex()) {
        slideIndex++;
        updateCarousel();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (slideIndex > 0) {
        slideIndex--;
        updateCarousel();
      }
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupDots();
      updateCarousel();
    }, 150);
  });

  let touchStartX = 0;
  track.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && slideIndex < getMaxIndex()) {
        slideIndex++;
      } else if (diff < 0 && slideIndex > 0) {
        slideIndex--;
      }
      updateCarousel();
    }
  }, { passive: true });

  setupDots();
  updateCarousel();
}
