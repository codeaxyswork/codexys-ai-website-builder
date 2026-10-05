/* =============================================
   FORMA STUDIO — PREMIUM ARCHITECTURE JS
   ============================================= */
'use strict';

// ===== UTILITY: DOM Helper =====
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

// ===== HEADER: Scroll Behavior =====
(function initHeader() {
  const header = $('#header');
  if (!header) return;

  const scrollThreshold = 80;

  const updateHeader = () => {
    if (window.scrollY > scrollThreshold) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
})();

// ===== MOBILE MENU =====
(function initMobileMenu() {
  const hamburger = $('#hamburger-btn');
  const mobileMenu = $('#mobile-menu');
  if (!hamburger || !mobileMenu) return;

  const toggleMenu = () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    hamburger.classList.toggle('is-active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  hamburger.addEventListener('click', toggleMenu);

  // Close on link click
  $$('.mobile-menu__link, .mobile-menu .btn', mobileMenu).forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
      toggleMenu();
    }
  });
})();

// ===== HERO SLIDER =====
(function initHeroSlider() {
  const slides = $$('.hero__slide');
  const dots = $$('.hero__dot');
  const prevBtn = $('#hero-prev');
  const nextBtn = $('#hero-next');

  if (!slides.length) return;

  let currentIndex = 0;
  let autoplayInterval = null;
  let isAnimating = false;

  const goToSlide = (index) => {
    if (isAnimating || index === currentIndex) return;
    isAnimating = true;

    // Deactivate current
    slides[currentIndex].classList.remove('hero__slide--active');
    dots[currentIndex]?.classList.remove('hero__dot--active');
    dots[currentIndex]?.setAttribute('aria-selected', 'false');

    // Update index
    currentIndex = (index + slides.length) % slides.length;

    // Activate new
    slides[currentIndex].classList.add('hero__slide--active');
    dots[currentIndex]?.classList.add('hero__dot--active');
    dots[currentIndex]?.setAttribute('aria-selected', 'true');

    // Re-enable after transition
    setTimeout(() => { isAnimating = false; }, 1400);
  };

  const nextSlide = () => goToSlide(currentIndex + 1);
  const prevSlide = () => goToSlide(currentIndex - 1);

  const startAutoplay = () => {
    stopAutoplay();
    autoplayInterval = setInterval(nextSlide, 6000);
  };

  const stopAutoplay = () => {
    if (autoplayInterval) clearInterval(autoplayInterval);
  };

  prevBtn?.addEventListener('click', () => { prevSlide(); startAutoplay(); });
  nextBtn?.addEventListener('click', () => { nextSlide(); startAutoplay(); });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goToSlide(i); startAutoplay(); });
  });

  // Keyboard support
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { prevSlide(); startAutoplay(); }
    if (e.key === 'ArrowRight') { nextSlide(); startAutoplay(); }
  });

  // Touch/swipe support
  let touchStartX = 0;
  const heroEl = document.querySelector('.hero');
  if (heroEl) {
    heroEl.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    heroEl.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        dx > 0 ? prevSlide() : nextSlide();
        startAutoplay();
      }
    }, { passive: true });
  }

  startAutoplay();
})();

// ===== SCROLL REVEAL ANIMATIONS =====
(function initScrollReveal() {
  const targets = $$('.reveal-up, .reveal-left, .reveal-right');
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -60px 0px'
  });

  targets.forEach(target => observer.observe(target));
})();

// ===== GALLERY LIGHTBOX =====
(function initLightbox() {
  const galleryItems = $$('.gallery__item');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightbox-img');
  const closeBtn = $('#lightbox-close');

  if (!lightbox || !lightboxImg) return;

  const openLightbox = (src, alt) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    lightbox.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImg.src = ''; }, 400);
  };

  galleryItems.forEach(item => {
    const img = item.querySelector('.gallery__img');
    if (!img) return;
    item.addEventListener('click', () => openLightbox(img.src, img.alt));
  });

  closeBtn?.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
})();

// ===== REVIEWS SLIDER =====
(function initReviewsSlider() {
  const slides = $$('.review-slide');
  const prevBtn = $('#reviews-prev');
  const nextBtn = $('#reviews-next');
  const currentText = $('#reviews-current');
  const totalText = $('#reviews-total');
  const progressBar = $('#reviews-progress-bar');

  if (!slides.length) return;

  let current = 0;
  let autoInterval = null;

  // Set total counter
  if (totalText) {
    totalText.textContent = String(slides.length).padStart(2, '0');
  }

  const updateProgressBar = (index) => {
    if (!progressBar) return;
    const percentage = ((index + 1) / slides.length) * 100;
    progressBar.style.width = `${percentage}%`;
  };

  const goTo = (index) => {
    slides[current].classList.remove('review-slide--active');

    current = (index + slides.length) % slides.length;

    slides[current].classList.add('review-slide--active');

    // Update text counter
    if (currentText) {
      currentText.textContent = String(current + 1).padStart(2, '0');
    }

    updateProgressBar(current);
  };

  const nextSlide = () => goTo(current + 1);
  const prevSlide = () => goTo(current - 1);

  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); restartAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); restartAutoplay(); });

  const restartAutoplay = () => {
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = setInterval(nextSlide, 7000);
  };

  // Initial progress setup
  updateProgressBar(0);
  restartAutoplay();
})();

// ===== FAQ ACCORDION =====
(function initFAQ() {
  const questions = $$('.faq__question');

  questions.forEach(btn => {
    const answerId = btn.getAttribute('aria-controls');
    const answer = document.getElementById(answerId);
    if (!answer) return;

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      // Close all
      questions.forEach(otherBtn => {
        const otherId = otherBtn.getAttribute('aria-controls');
        const otherAnswer = document.getElementById(otherId);
        otherBtn.setAttribute('aria-expanded', 'false');
        if (otherAnswer) otherAnswer.classList.remove('is-open');
      });

      // Toggle clicked
      if (!isExpanded) {
        btn.setAttribute('aria-expanded', 'true');
        answer.classList.add('is-open');
      }
    });
  });
})();

// ===== CONTACT FORM =====
(function initContactForm() {
  const form = $('#contact-form');
  const successMsg = $('#form-success');
  const submitBtn = $('#form-submit');

  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Simulate submission
    const btnText = submitBtn.querySelector('span');
    const btnIcon = submitBtn.querySelector('svg');

    submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Sending…';
    if (btnIcon) btnIcon.style.opacity = '0';

    setTimeout(() => {
      if (successMsg) successMsg.style.display = 'block';
      form.reset();
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Send Message';
      if (btnIcon) btnIcon.style.opacity = '1';

      setTimeout(() => {
        if (successMsg) successMsg.style.display = 'none';
      }, 5000);
    }, 1600);
  });
})();

// ===== BACK TO TOP =====
(function initBackToTop() {
  const btn = $('#back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('is-visible', window.scrollY > 600);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ===== SMOOTH ANCHOR NAVIGATION =====
(function initSmoothNav() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

// ===== COUNTER ANIMATION =====
(function initCounters() {
  const numbers = $$('.stat-card__number');

  const animateCounter = (el, target) => {
    let current = 0;
    const duration = 1800;
    const step = target / (duration / 16);
    const rawText = el.innerHTML;
    const plusSpan = el.querySelector('.stat-card__plus')?.outerHTML || '';

    const update = () => {
      current = Math.min(current + step, target);
      el.innerHTML = Math.floor(current) + plusSpan;
      if (current < target) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const text = el.textContent.replace('+', '').trim();
        const target = parseInt(text, 10);
        if (!isNaN(target)) animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  numbers.forEach(n => observer.observe(n));
})();

