document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     GLOBAL HELPER FUNCTIONS
     ========================================================================== */
  const select = (selector, all = false) => {
    return all ? [...document.querySelectorAll(selector)] : document.querySelector(selector);
  };

  const on = (type, el, listener, all = false) => {
    const selectEl = typeof el === 'string' ? select(el, all) : el;
    if (selectEl) {
      if (all) {
        selectEl.forEach(e => e.addEventListener(type, listener));
      } else {
        selectEl.addEventListener(type, listener);
      }
    }
  };

  /* ==========================================================================
     HEADER SCROLL & MOBILE MENU TOGGLE
     ========================================================================== */
  const header = select('#main-header');
  const menuToggle = select('#menu-toggle');
  const navMenu = select('#nav-menu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    updateActiveNavLink();
  });

  // Fullscreen Menu Toggle
  if (menuToggle && navMenu) {
    on('click', menuToggle, () => {
      const isOpen = navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
      if (header) header.classList.toggle('menu-active');
      
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    // Close menu when clicking nav links
    on('click', '.nav-link', (e) => {
      navMenu.classList.remove('open');
      menuToggle.classList.remove('active');
      if (header) header.classList.remove('menu-active');
      document.body.style.overflow = '';
    }, true);
  }

  // Active Nav Link highlight on Scroll
  const sections = select('section[id]', true);
  const navLinks = select('.nav-link', true);

  function updateActiveNavLink() {
    let scrollPos = window.scrollY + 120; // offset header height

    sections.forEach(section => {
      if (scrollPos >= section.offsetTop && scrollPos < (section.offsetTop + section.offsetHeight)) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${section.id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  /* ==========================================================================
     HERO SLIDER WITH GLASS SPLIT TRANSITION (RESTORED)
     ========================================================================== */
  const slides = select('.slide', true);
  const dots = select('.slider-dots .dot', true);
  const overlay = select('#glass-transition-overlay');
  let currentSlide = 0;
  let isTransitioning = false;
  let sliderInterval;

  function switchSlide(nextIndex) {
    if (isTransitioning || nextIndex === currentSlide) return;
    isTransitioning = true;

    // Phase 1: Activate overlay and slide panels in to cover screen
    if (overlay) overlay.classList.add('active', 'phase-enter');

    // At 650ms, panels have fully covered the screen. Perform swap.
    setTimeout(() => {
      if (slides[currentSlide]) slides[currentSlide].classList.remove('active');
      if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

      currentSlide = nextIndex;

      if (slides[currentSlide]) slides[currentSlide].classList.add('active');
      if (dots[currentSlide]) dots[currentSlide].classList.add('active');

      // Phase 2: Start slide out animation
      if (overlay) {
        overlay.classList.remove('phase-enter');
        overlay.classList.add('phase-leave');
      }
    }, 650);

    // After total 1300ms, transition is fully completed. Reset state.
    setTimeout(() => {
      if (overlay) overlay.classList.remove('active', 'phase-leave');
      isTransitioning = false;
    }, 1300);
  }

  function startSliderTimer() {
    stopSliderTimer();
    sliderInterval = setInterval(() => {
      let next = (currentSlide + 1) % slides.length;
      switchSlide(next);
    }, 7000); // auto slide every 7 seconds
  }

  function stopSliderTimer() {
    if (sliderInterval) clearInterval(sliderInterval);
  }

  on('click', '#next-slide', () => {
    let next = (currentSlide + 1) % slides.length;
    switchSlide(next);
    startSliderTimer();
  });

  on('click', '#prev-slide', () => {
    let prev = (currentSlide - 1 + slides.length) % slides.length;
    switchSlide(prev);
    startSliderTimer();
  });

  on('click', '.slider-dots .dot', (e) => {
    let index = parseInt(e.target.dataset.slideIndex);
    switchSlide(index);
    startSliderTimer();
  }, true);

  // Initialize Hero Slider
  if (slides.length > 0) {
    startSliderTimer();

    // Pause slider autoplay when scrolled out of view to avoid transitions covering other sections
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startSliderTimer();
          } else {
            stopSliderTimer();
          }
        });
      }, { threshold: 0.05 });

      const heroSection = select('#home');
      if (heroSection) heroObserver.observe(heroSection);
    }
  }

  /* ==========================================================================
     FAQ ACCORDION
     ========================================================================== */
  on('click', '.faq-question', (e) => {
    const question = e.currentTarget;
    const item = question.parentElement;
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    // Close all other FAQs
    select('.faq-item', true).forEach(otherItem => {
      if (otherItem !== item) {
        otherItem.classList.remove('open');
        otherItem.querySelector('.faq-answer').style.maxHeight = '0px';
        otherItem.querySelector('.faq-answer').style.opacity = '0';
      }
    });

    // Toggle selected FAQ
    if (isOpen) {
      item.classList.remove('open');
      answer.style.maxHeight = '0px';
      answer.style.opacity = '0';
    } else {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.style.opacity = '1';
    }
  }, true);

  /* ==========================================================================
     PHOTO GALLERY FULLSCREEN LIGHTBOX MODAL
     ========================================================================== */
  const lightboxModal = select('#lightbox-modal');
  const lightboxImg = select('#lightbox-img');
  const lightboxCaption = select('#lightbox-caption');
  const closeLightboxBtn = select('#close-lightbox-modal');
  const prevLightboxBtn = select('#prev-lightbox-btn');
  const nextLightboxBtn = select('#next-lightbox-btn');
  const galleryItems = select('.gallery-grid .gallery-item', true);

  let lightboxIndex = 0;
  let lightboxItems = [];

  // Map images index
  galleryItems.forEach((item, index) => {
    const img = item.querySelector('.gallery-img');
    const captionEl = item.querySelector('.gallery-title');
    const caption = captionEl ? captionEl.textContent : '';

    lightboxItems.push({
      src: img.src,
      caption: caption
    });

    item.addEventListener('click', () => {
      lightboxIndex = index;
      openLightbox();
    });
  });

  function openLightbox() {
    if (lightboxModal && lightboxImg && lightboxCaption) {
      updateLightboxContent();
      lightboxModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function updateLightboxContent() {
    if (lightboxItems[lightboxIndex]) {
      lightboxImg.src = lightboxItems[lightboxIndex].src;
      lightboxCaption.textContent = lightboxItems[lightboxIndex].caption;
    }
  }

  if (nextLightboxBtn) {
    on('click', nextLightboxBtn, () => {
      lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
      updateLightboxContent();
    });
  }

  if (prevLightboxBtn) {
    on('click', prevLightboxBtn, () => {
      lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
      updateLightboxContent();
    });
  }

  if (closeLightboxBtn) {
    on('click', closeLightboxBtn, () => {
      lightboxModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  /* ==========================================================================
     UNIFIED BOOKING MODAL & MULTI-STEP WIZARD
     ========================================================================== */
  const bookingModal = select('#booking-modal');
  const formSteps = select('.form-step-section', true);
  const formIndicators = select('.modal-form-steps-indicator .step-num', true);
  let currentFormStep = 1;

  // Booking Modal Open & Step reset
  on('click', '.open-booking-btn', (e) => {
    e.preventDefault();
    if (bookingModal) {
      currentFormStep = 1;
      formSteps.forEach((s, idx) => {
        s.classList.remove('active');
        formIndicators[idx].classList.remove('active');
        if (idx === 0) {
          s.classList.add('active');
          formIndicators[idx].classList.add('active');
        }
      });
      bookingModal.classList.add('active');
      document.body.style.overflow = 'hidden'; // block page scroll
    }
  }, true);

  // Close Booking Modal
  const closeBooking = select('#close-booking-modal');
  if (closeBooking) {
    on('click', closeBooking, () => {
      bookingModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Modal Step Wizard Next navigation
  on('click', '.modal-next-btn', (e) => {
    e.preventDefault();
    const activeSection = select(`.form-step-section[data-form-step="${currentFormStep}"]`);
    const inputs = activeSection.querySelectorAll('input, select, textarea');

    let isValid = true;
    inputs.forEach(input => {
      if (!input.checkValidity()) {
        input.reportValidity();
        isValid = false;
      }
    });

    if (isValid && currentFormStep < formSteps.length) {
      formSteps[currentFormStep - 1].classList.remove('active');
      formIndicators[currentFormStep - 1].classList.remove('active');

      currentFormStep++;

      formSteps[currentFormStep - 1].classList.add('active');
      formIndicators[currentFormStep - 1].classList.add('active');
    }
  }, true);

  // Modal Step Wizard Previous navigation
  on('click', '.modal-prev-btn', (e) => {
    e.preventDefault();
    if (currentFormStep > 1) {
      formSteps[currentFormStep - 1].classList.remove('active');
      formIndicators[currentFormStep - 1].classList.remove('active');

      currentFormStep--;

      formSteps[currentFormStep - 1].classList.add('active');
      formIndicators[currentFormStep - 1].classList.add('active');
    }
  }, true);

  // Click on Backdrop to close modals
  on('click', '.modal-backdrop', (e) => {
    if (e.target === bookingModal) {
      bookingModal.classList.remove('active');
      document.body.style.overflow = '';
    } else if (e.target === lightboxModal) {
      lightboxModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }, true);

  /* ==========================================================================
     FORM SUBMISSIONS (MOCK)
     ========================================================================== */
  const contactForm = select('#contact-form');
  const modalBookingForm = select('#modal-booking-form');

  if (contactForm) {
    on('submit', contactForm, (e) => {
      e.preventDefault();
      const status = select('#form-status');
      status.className = 'form-status success';
      status.textContent = 'Thank you. Your inquiry has been sent to our concierge shala desk. We will touch base within 24 hours.';
      contactForm.reset();
      setTimeout(() => { status.textContent = ''; }, 6000);
    });
  }

  if (modalBookingForm) {
    on('submit', modalBookingForm, (e) => {
      e.preventDefault();
      const status = select('#modal-form-status');
      status.className = 'form-status success';
      status.textContent = 'Reservation Request Received! We will call/email you soon to confirm scheduling details.';
      modalBookingForm.reset();
      setTimeout(() => {
        status.textContent = '';
        if (bookingModal) {
          bookingModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      }, 3000);
    });
  }



  /* ==========================================================================
     TESTIMONIALS CAROUSEL SLIDER
     ========================================================================== */
  const testimonialWrapper = select('.testimonials-carousel-wrapper');
  const testimonialTrack = select('.testimonials-carousel-track');
  const testimonialCards = select('.testimonials-carousel-track .testimonial-card', true);
  const testimonialDots = select('.testimonial-dots .dot', true);
  let currentTestimonialIndex = 0;

  function updateTestimonialSlider(index) {
    if (testimonialCards.length === 0) return;

    const cardWidth = testimonialCards[0].offsetWidth;
    const gap = parseFloat(window.getComputedStyle(testimonialTrack).gap) || 0;
    const wrapperWidth = testimonialWrapper ? testimonialWrapper.offsetWidth : 1200;
    const visibleCards = Math.round(wrapperWidth / (cardWidth + gap)) || 1;
    const maxScrollIndex = Math.max(0, testimonialCards.length - visibleCards);

    // Wrap around limits
    if (index > maxScrollIndex) index = 0;
    if (index < 0) index = maxScrollIndex;

    currentTestimonialIndex = index;

    if (testimonialTrack) {
      const translateVal = currentTestimonialIndex * (cardWidth + gap);
      testimonialTrack.style.transform = `translateX(-${translateVal}px)`;
    }

    testimonialDots.forEach((dot, idx) => {
      if (idx > maxScrollIndex) {
        dot.style.display = 'none';
      } else {
        dot.style.display = 'inline-block';
      }

      if (idx === currentTestimonialIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  on('click', '.prev-testimonial', () => {
    updateTestimonialSlider(currentTestimonialIndex - 1);
  });

  on('click', '.next-testimonial', () => {
    updateTestimonialSlider(currentTestimonialIndex + 1);
  });

  on('click', '.testimonial-dots .dot', (e) => {
    let index = parseInt(e.target.dataset.index);
    updateTestimonialSlider(index);
  }, true);

  // Resize listener to re-align
  window.addEventListener('resize', () => {
    updateTestimonialSlider(currentTestimonialIndex);
  });
});

