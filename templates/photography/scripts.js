/* ==========================================================================
   SNAPTURE HOME-04 + HOME-03 EXACT INTERACTIVE LOGIC
   Hero Slider + Accordion Services Cards + Portfolio Showcase + Reviews Carousel + Scroll Counters
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* --------------------------------------------------------------------------
     1. HERO CINEMATIC SLIDER LOGIC (AUTO-PLAYING)
     -------------------------------------------------------------------------- */
  const heroSlides = document.querySelectorAll('.hero-slide');
  const rulerTicksMajor = document.querySelectorAll('.ruler-tick.tick-major');
  const filmCells = document.querySelectorAll('.film-cell');
  const rulerProgressFill = document.getElementById('rulerProgressFill');
  const totalSlides = heroSlides.length;

  let currentSlideIndex = 0;
  let slideTimer = null;
  const slideDuration = 6000; // 6 seconds per slide

  function showHeroSlide(targetIndex) {
    if (targetIndex === currentSlideIndex) return;

    heroSlides.forEach((slide, idx) => {
      slide.classList.remove('active', 'prev-active');
      if (idx === currentSlideIndex) {
        slide.classList.add('prev-active');
      }
    });

    currentSlideIndex = targetIndex;
    heroSlides[currentSlideIndex].classList.add('active');

    // Update Timeline Major Ticks
    rulerTicksMajor.forEach((tick, idx) => {
      tick.classList.toggle('active-tick', idx === currentSlideIndex);
    });

    // Update Angled Film Strip Cells (both sets in infinite loop)
    filmCells.forEach((cell) => {
      const slideIdx = parseInt(cell.getAttribute('data-slide'), 10);
      cell.classList.toggle('active-cell', slideIdx === currentSlideIndex);
    });

    resetHeroAutoTimer();
  }

  function startRulerProgress() {
    if (!rulerProgressFill) return;
    rulerProgressFill.style.transition = 'none';
    rulerProgressFill.style.width = '0%';
    
    setTimeout(() => {
      rulerProgressFill.style.transition = `width ${slideDuration}ms linear`;
      rulerProgressFill.style.width = '100%';
    }, 50);
  }

  function resetHeroAutoTimer() {
    clearInterval(slideTimer);
    startRulerProgress();

    slideTimer = setInterval(() => {
      const nextIndex = (currentSlideIndex + 1) % totalSlides;
      showHeroSlide(nextIndex);
    }, slideDuration);
  }

  // Click on Timeline Major Ticks
  rulerTicksMajor.forEach((tick) => {
    tick.addEventListener('click', () => {
      const slideIndex = parseInt(tick.getAttribute('data-slide'), 10);
      showHeroSlide(slideIndex);
    });
  });

  // Click on Film Strip Cells
  filmCells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const slideIndex = parseInt(cell.getAttribute('data-slide'), 10);
      showHeroSlide(slideIndex);
    });
  });

  // Initialize Timeline Auto Play
  startRulerProgress();
  resetHeroAutoTimer();


  /* --------------------------------------------------------------------------
     2. MY SERVICES ACCORDION EXPANDING CARDS LOGIC
     -------------------------------------------------------------------------- */
  const serviceCards = document.querySelectorAll('.service-card-single');
  const serviceDetailText = document.getElementById('serviceDetailText');

  serviceCards.forEach((card) => {
    card.addEventListener('click', () => {
      serviceCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const descText = card.getAttribute('data-desc');
      if (serviceDetailText && descText) {
        serviceDetailText.style.opacity = '0';
        setTimeout(() => {
          serviceDetailText.textContent = descText;
          serviceDetailText.style.opacity = '1';
        }, 200);
      }
    });
  });


  /* --------------------------------------------------------------------------
     3. 100vh FULLSCREEN PORTFOLIO SHOWCASE SLIDER LOGIC (AUTO-PLAYING)
     -------------------------------------------------------------------------- */
  const portSlides = document.querySelectorAll('.port-fullscreen-slide');
  const portThumbItems = document.querySelectorAll('.port-thumb-item');
  const portPrevBtn = document.getElementById('portPrevBtn');
  const portNextBtn = document.getElementById('portNextBtn');
  const portCounterText = document.getElementById('portCounterText');
  const totalPortSlides = portSlides.length;

  let currentPortIndex = 0;
  let portAutoTimer = null;
  const portAutoDuration = 5000; // 5 seconds per slide

  function showPortSlide(index) {
    if (index < 0) index = totalPortSlides - 1;
    if (index >= totalPortSlides) index = 0;

    portSlides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });

    portThumbItems.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    currentPortIndex = index;

    if (portCounterText) {
      const formattedNum = String(currentPortIndex + 1).padStart(2, '0');
      const formattedTotal = String(totalPortSlides).padStart(2, '0');
      portCounterText.textContent = `${formattedNum} / ${formattedTotal}`;
    }
  }

  function startPortAutoTimer() {
    stopPortAutoTimer();
    portAutoTimer = setInterval(() => {
      showPortSlide(currentPortIndex + 1);
    }, portAutoDuration);
  }

  function stopPortAutoTimer() {
    if (portAutoTimer) clearInterval(portAutoTimer);
  }

  if (portNextBtn) {
    portNextBtn.addEventListener('click', () => {
      showPortSlide(currentPortIndex + 1);
      startPortAutoTimer();
    });
  }

  if (portPrevBtn) {
    portPrevBtn.addEventListener('click', () => {
      showPortSlide(currentPortIndex - 1);
      startPortAutoTimer();
    });
  }

  portThumbItems.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const targetSlide = parseInt(thumb.getAttribute('data-slide'), 10);
      showPortSlide(targetSlide);
      startPortAutoTimer();
    });
  });

  const portSection = document.querySelector('.portfolio-fullscreen-section');
  if (portSection) {
    portSection.addEventListener('mouseenter', stopPortAutoTimer);
    portSection.addEventListener('mouseleave', startPortAutoTimer);
  }

  // Start Portfolio Carousel Auto-Play
  startPortAutoTimer();


  /* --------------------------------------------------------------------------
     4. REVIEWS CAROUSEL SLIDER LOGIC (ALL 5 CARDS — PIXEL-BASED SLIDING)
     -------------------------------------------------------------------------- */
  const reviewsTrack = document.getElementById('reviewsTrack');
  const revPrevBtn = document.getElementById('revPrevBtn');
  const revNextBtn = document.getElementById('revNextBtn');
  const revCounterText = document.getElementById('revCounterText');
  const reviewCards = reviewsTrack ? Array.from(reviewsTrack.querySelectorAll('.review-creative-card')) : [];

  let currentRevIndex = 0;
  const totalRevSlides = reviewCards.length;
  let revAutoTimer = null;
  const revAutoDuration = 4500;

  function updateReviewsCarousel() {
    if (!reviewsTrack || totalRevSlides === 0) return;

    // Wrap around
    if (currentRevIndex < 0) currentRevIndex = totalRevSlides - 1;
    if (currentRevIndex >= totalRevSlides) currentRevIndex = 0;

    let itemsPerView = 3;
    if (window.innerWidth <= 1024) itemsPerView = 1;
    else if (window.innerWidth <= 1200) itemsPerView = 2;

    // Cards are calc((100% - 4rem) / 3) of the track (which is 100% of viewport)
    // Get the actual rendered card width
    const card = reviewCards[0];
    if (!card) return;
    const cardWidth = card.getBoundingClientRect().width;
    const gap = 32; // 2rem in px

    // Max slide steps before empty space appears
    const maxScrollIndex = Math.max(0, totalRevSlides - itemsPerView);
    const scrollSteps = Math.min(currentRevIndex, maxScrollIndex);

    reviewsTrack.style.transform = `translateX(-${scrollSteps * (cardWidth + gap)}px)`;

    if (revCounterText) {
      revCounterText.textContent = `${String(currentRevIndex + 1).padStart(2, '0')} / ${String(totalRevSlides).padStart(2, '0')}`;
    }
  }

  function startRevAutoTimer() {
    stopRevAutoTimer();
    revAutoTimer = setInterval(() => {
      currentRevIndex = (currentRevIndex + 1) % totalRevSlides;
      updateReviewsCarousel();
    }, revAutoDuration);
  }

  function stopRevAutoTimer() {
    if (revAutoTimer) clearInterval(revAutoTimer);
  }

  if (revNextBtn) {
    revNextBtn.addEventListener('click', () => {
      currentRevIndex = (currentRevIndex + 1) % totalRevSlides;
      updateReviewsCarousel();
      startRevAutoTimer();
    });
  }

  if (revPrevBtn) {
    revPrevBtn.addEventListener('click', () => {
      currentRevIndex = (currentRevIndex - 1 + totalRevSlides) % totalRevSlides;
      updateReviewsCarousel();
      startRevAutoTimer();
    });
  }

  const reviewsSection = document.querySelector('.reviews-section-area');
  if (reviewsSection) {
    reviewsSection.addEventListener('mouseenter', stopRevAutoTimer);
    reviewsSection.addEventListener('mouseleave', startRevAutoTimer);
  }

  window.addEventListener('resize', updateReviewsCarousel);

  // Initial call and Start Reviews Carousel Auto-Play
  updateReviewsCarousel();
  startRevAutoTimer();


  /* --------------------------------------------------------------------------
     5. ON-SCROLL COUNT-UP ANIMATION LOGIC (INTERSECTION OBSERVER)
     -------------------------------------------------------------------------- */
  const countElements = document.querySelectorAll('.stat-number, .metric-num, .about-exp-number');

  function animateCounter(el) {
    const originalText = el.textContent.trim();
    const match = originalText.match(/^(\d+)(.*)$/);
    if (!match) return;

    const targetValue = parseInt(match[1], 10);
    const suffix = match[2] || '';
    
    const duration = 1800; // 1.8 seconds smooth animation
    const startTime = performance.now();

    function updateCount(currentTime) {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Ease Out Cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(easeProgress * targetValue);

      el.textContent = `${currentValue}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        el.textContent = `${targetValue}${suffix}`;
      }
    }

    requestAnimationFrame(updateCount);
  }

  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  countElements.forEach(el => counterObserver.observe(el));


  /* --------------------------------------------------------------------------
     6. ON-SCROLL NAVIGATION ACTIVE LINK HIGHLIGHTING
     -------------------------------------------------------------------------- */
  const navLinks = document.querySelectorAll('.nav-item-link');
  const sections = document.querySelectorAll('section, footer, header.hero-slider-wrapper');

  window.addEventListener('scroll', () => {
    let currentSection = '';
    const scrollPosition = window.scrollY + 280;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active-nav');
      const href = link.getAttribute('href');
      if (href && href.substring(1) === currentSection) {
        link.classList.add('active-nav');
      } else if (currentSection === 'heroSlider' && href === '#') {
        link.classList.add('active-nav');
      }
    });
  });


  /* --------------------------------------------------------------------------
     7. MOBILE NAVIGATION DRAWER INTERACTIVITY
     -------------------------------------------------------------------------- */
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileDrawerClose = document.getElementById('mobileDrawerClose');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item, .mobile-drawer-cta');

  if (mobileMenuToggle && mobileNavDrawer) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileNavDrawer.classList.add('open-drawer');
      document.body.style.overflow = 'hidden';
    });
  }

  if (mobileDrawerClose && mobileNavDrawer) {
    mobileDrawerClose.addEventListener('click', () => {
      mobileNavDrawer.classList.remove('open-drawer');
      document.body.style.overflow = '';
    });
  }

  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      if (mobileNavDrawer) {
        mobileNavDrawer.classList.remove('open-drawer');
        document.body.style.overflow = '';
      }
    });
  });

});
