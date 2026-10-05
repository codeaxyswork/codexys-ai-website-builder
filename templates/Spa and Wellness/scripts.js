/* =========================================================
   SERENITY SPA & WELLNESS — Master Scripts
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
const SLIDE_INTERVAL = 5500;

function goToSlide(index) {
  if (slides.length === 0) return;

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
   3. FAQ ACCORDION
   ─────────────────────────────────────────────────────────── */
function toggleFaq(id) {
  const item = document.getElementById(id);
  if (!item) return;

  const isOpen = item.classList.contains('open');

  // Close all other items and collapse their heights
  document.querySelectorAll('.faq-item').forEach(fi => {
    fi.classList.remove('open');
    const body = fi.querySelector('.faq-item-body');
    if (body) {
      body.style.height = '0px';
    }
    const icon = fi.querySelector('.faq-toggle-icon i');
    if (icon) {
      icon.className = 'fa-solid fa-plus';
    }
  });

  // Open clicked (if it was closed) and set to scrollHeight
  if (!isOpen) {
    item.classList.add('open');
    const body = item.querySelector('.faq-item-body');
    if (body) {
      body.style.height = body.scrollHeight + 'px';
    }
    const icon = item.querySelector('.faq-toggle-icon i');
    if (icon) {
      icon.className = 'fa-solid fa-minus';
    }
  }
}
// Expose toggleFaq to global scope for html onclick
window.toggleFaq = toggleFaq;

/* ───────────────────────────────────────────────────────────
   3B. CORE FEATURES ACCORDION
   ─────────────────────────────────────────────────────────── */
function toggleFeat(id) {
  const item = document.getElementById(id);
  if (!item) return;

  const isOpen = item.classList.contains('open');

  // Close all and set their icons to chevron-right
  document.querySelectorAll('.feat-acc-item').forEach(fi => {
    fi.classList.remove('open');
    const icon = fi.querySelector('.feat-acc-icon i');
    if (icon) {
      icon.className = 'fa-solid fa-chevron-right';
    }
  });

  // Open clicked (if it was closed) and set its icon to chevron-down
  if (!isOpen) {
    item.classList.add('open');
    const icon = item.querySelector('.feat-acc-icon i');
    if (icon) {
      icon.className = 'fa-solid fa-chevron-down';
    }
  }
}
// Expose toggleFeat to global scope for html onclick
window.toggleFeat = toggleFeat;

/* ───────────────────────────────────────────────────────────
   4. CONTACT PANELS SWITCHER (Form vs Map)
   ─────────────────────────────────────────────────────────── */
const contactTabs   = document.querySelectorAll('.contact-tab');
const contactPanels = document.querySelectorAll('.contact-panel');

contactTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetPanel = tab.dataset.panel;

    contactTabs.forEach(t => t.classList.remove('active'));
    contactPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const panel = document.getElementById('cpanel-' + targetPanel);
    if (panel) {
      panel.classList.add('active');
    }
  });
});

/* ───────────────────────────────────────────────────────────
   5. SCROLL ANIMATIONS (IntersectionObserver)
   ─────────────────────────────────────────────────────────── */
function initScrollAnimations() {
  const animTargets = [
    '.hero-stat-card',
    '.stat-card',
    '.treatment-card',
    '.program-card',
    '.why-card',
    '.featured-box',
    '.expert-card',
    '.pricing-card',
    '.gb-item',
    '.testi-card',
    '.faq-item',
    '.ci-card',
    '.about-img-cell',
    '.about-content-cell',
    '.cta-content',
    '.cta-form-box',
    '.benefit-card',
    '.faq-contact-card',
    '.booking-image-wrap',
    '.booking-form-card',
    '.feat-acc-item',
    '.feat-img-main',
    '.feat-img-sub',
    '.feat-badge-logo',
  ];

  const elements = document.querySelectorAll(animTargets.join(', '));

  elements.forEach(el => {
    el.classList.add('animate-up');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Stagger delay based on sibling index
        const siblings = [...(entry.target.parentElement?.children || [])];
        const idx = siblings.indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add('in-view');
        }, idx * 60);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ───────────────────────────────────────────────────────────
   6. ACTIVE NAV HIGHLIGHT ON SCROLL
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
  }, { threshold: 0.25, rootMargin: '-10% 0px -60% 0px' });

  sections.forEach(sec => observer.observe(sec));
}

/* ───────────────────────────────────────────────────────────
   7. SMOOTH SCROLL FOR ANCHOR LINKS
   ─────────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = navbar ? navbar.offsetHeight + 10 : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ───────────────────────────────────────────────────────────
   8. SET MIN DATE FOR BOOKING CALENDAR
   ─────────────────────────────────────────────────────────── */
(function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('cta-bk-date');
  if (dateInput) {
    dateInput.setAttribute('min', today);
    dateInput.value = today;
  }
})();

/* ───────────────────────────────────────────────────────────
   9. GALLERY HOVER FALLBACK FOR TOUCH PHONES
   ─────────────────────────────────────────────────────────── */
document.querySelectorAll('.gb-item').forEach(item => {
  item.addEventListener('touchstart', () => {
    item.classList.add('touched');
    document.querySelectorAll('.gb-item').forEach(other => {
      if (other !== item) other.classList.remove('touched');
    });
  }, { passive: true });
});

// Touch styling dynamic injection
(function injectTouchGalleryStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .gb-item.touched .gb-overlay  { opacity: 1; }
    .gb-item.touched .gb-cat,
    .gb-item.touched .gb-title    { transform: translateY(0); }
    .gb-item.touched img          { transform: scale(1.05); }
  `;
  document.head.appendChild(s);
})();

/* ───────────────────────────────────────────────────────────
   10. TESTIMONIALS CAROUSEL
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
    if (window.innerWidth <= 767) return 1;
    if (window.innerWidth <= 1200) return 2;
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

    if (prevBtn) {
      if (slideIndex === 0) {
        prevBtn.style.opacity = '0.35';
        prevBtn.style.pointerEvents = 'none';
      } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.pointerEvents = 'auto';
      }
    }
    
    if (nextBtn) {
      if (slideIndex === maxIdx) {
        nextBtn.style.opacity = '0.35';
        nextBtn.style.pointerEvents = 'none';
      } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'auto';
      }
    }

    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.testi-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === slideIndex);
      });
    }
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

/* ───────────────────────────────────────────────────────────
   11. TREATMENTS CAROUSEL
   ─────────────────────────────────────────────────────────── */
function initTreatmentsCarousel() {
  const track   = document.getElementById('treatments-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const cards   = document.querySelectorAll('.treatment-slide-card');

  if (!track || cards.length === 0) return;

  let currentIndex = 0;
  let autoTimer    = null;
  const AUTO_DELAY = 4000;

  function getVisibleCount() {
    if (window.innerWidth <= 767) return 1;
    if (window.innerWidth <= 991) return 2;
    return 3;
  }

  function getStepWidth() {
    const card = cards[0];
    const cardW = card.getBoundingClientRect().width;
    const gap   = parseFloat(getComputedStyle(track).gap) || 24;
    return cardW + gap;
  }

  function getMaxIndex() {
    return Math.max(0, cards.length - getVisibleCount());
  }

  function goTo(index, wrap = true) {
    const max = getMaxIndex();
    if (wrap) {
      if (index < 0)    index = max;
      if (index > max)  index = 0;
    } else {
      index = Math.max(0, Math.min(max, index));
    }
    currentIndex = index;
    track.style.transform = `translateX(-${currentIndex * getStepWidth()}px)`;
    updateArrows();
  }

  function updateArrows() {
    const max = getMaxIndex();
    if (prevBtn) prevBtn.style.opacity = currentIndex === 0 ? '0.4' : '1';
    if (nextBtn) nextBtn.style.opacity = currentIndex === max ? '0.4' : '1';
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => goTo(currentIndex + 1, true), AUTO_DELAY);
  }

  function stopAuto() {
    clearInterval(autoTimer);
  }

  // Arrow buttons
  if (nextBtn) {
    nextBtn.addEventListener('click', () => { goTo(currentIndex + 1, true); startAuto(); });
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => { goTo(currentIndex - 1, true); startAuto(); });
  }

  // Touch swipe
  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; stopAuto(); }, { passive: true });
  track.addEventListener('touchend',   e => {
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? currentIndex + 1 : currentIndex - 1, true);
    }
    startAuto();
  }, { passive: true });

  // Pause on hover
  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  // Recalculate on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goTo(Math.min(currentIndex, getMaxIndex()), false), 150);
  });

  // Init
  goTo(0, false);
  startAuto();
}

/* ───────────────────────────────────────────────────────────
   11. INITIALIZATION ON DOM READY
   ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initNavHighlight();
  initTestiCarousel();
  initTreatmentsCarousel();

  // Set initial height for open FAQ items on page load
  document.querySelectorAll('.faq-item.open').forEach(item => {
    const body = item.querySelector('.faq-item-body');
    if (body) {
      body.style.height = body.scrollHeight + 'px';
    }
  });
});
