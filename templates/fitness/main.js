document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  /* ==========================================
     1. SCROLL REVEAL ANIMATIONS (INTERSECTION OBSERVER)
     ========================================== */
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        // Once revealed, no need to track it further
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => {
    revealObserver.observe(el);
  });

  /* ==========================================
     2. FLOATING HEADER & MOBILE NAV TOGGLE
     ========================================== */
  const header = document.getElementById('header');
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  const menuIcon = document.getElementById('menu-icon');

  // Sticky / Scrolled Header & Progress Bar
  const scrollProgressBar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    highlightNavLink();

    // Progress Bar Calculation
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    if (scrollProgressBar) {
      scrollProgressBar.style.width = scrolled + '%';
    }
  });

  // Mobile Menu Action
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    const isExpanded = navMenu.classList.contains('active');
    
    // Toggle Menu Icons
    const currentIcon = document.getElementById('menu-icon');
    if (currentIcon) {
      if (isExpanded) {
        currentIcon.setAttribute('data-lucide', 'x');
      } else {
        currentIcon.setAttribute('data-lucide', 'menu');
      }
      lucide.createIcons();
    }
  });

  // Close Mobile Menu on link click
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      const currentIcon = document.getElementById('menu-icon');
      if (currentIcon) {
        currentIcon.setAttribute('data-lucide', 'menu');
        lucide.createIcons();
      }
    });
  });

  // Highlight active link based on scroll section
  const sections = document.querySelectorAll('section, footer');
  function highlightNavLink() {
    let scrollPos = window.scrollY + 150;
    sections.forEach(section => {
      if (section.id) {
        let top = section.offsetTop;
        let height = section.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section.id}`) {
              link.classList.add('active');
            }
          });
        }
      }
    });
  }

  /* ==========================================
     3. FITNESS IMPACT STATS (ANIMATING COUNTERS)
     ========================================== */
  const statsSection = document.getElementById('impact-stats');
  const statNumbers = document.querySelectorAll('.stat-number');
  let statsAnimated = false;

  const countUp = (element) => {
    const target = parseInt(element.getAttribute('data-target'), 10);
    const duration = 2000; // ms
    const stepTime = Math.abs(Math.floor(duration / target));
    let current = 0;
    
    // Adjust increments for large numbers to look smooth
    let increment = 1;
    if (target > 1000) {
      increment = Math.floor(target / 100);
    }

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      
      // Format number with commas
      element.textContent = current.toLocaleString() + (target === 98 ? '%' : '+');
    }, Math.max(stepTime, 15));
  };

  const statsObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statNumbers.forEach(num => countUp(num));
        statsAnimated = true;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  if (statsSection) {
    statsObserver.observe(statsSection);
  }

  /* ==========================================
     4. PROGRAMS EXPANDABLE PANEL SYSTEM
     ========================================== */
  const programPanels = document.querySelectorAll('.program-panel');

  programPanels.forEach(panel => {
    panel.addEventListener('click', (e) => {
      // Don't trigger if user clicked inside already expanded inner features
      if (e.target.closest('.program-details')) return;

      const isExpanded = panel.classList.contains('expanded');
      
      // Close other panels first
      programPanels.forEach(p => {
        p.classList.remove('expanded');
      });

      // Expand this panel
      if (!isExpanded) {
        panel.classList.add('expanded');
      }
    });
  });

  // Expand the first program by default for visual landing interest
  if (programPanels.length > 0) {
    programPanels[0].classList.add('expanded');
  }

  /* ==========================================
     5. DYNAMIC MASONRY GALLERY FILTER & LIGHTBOX
     ========================================== */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  // Filter functionality
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const itemCat = item.getAttribute('data-category');
        if (filterValue === 'all' || itemCat === filterValue) {
          item.style.display = 'block';
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          }, 10);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.8)';
          setTimeout(() => {
            item.style.display = 'none';
          }, 300);
        }
      });
    });
  });

  // Lightbox functionality
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxCat = document.getElementById('lightbox-cat');
  const lightboxClose = document.getElementById('lightbox-close');

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('.gallery-item-img');
      const title = item.querySelector('.gallery-item-title').textContent;
      const cat = item.querySelector('.gallery-item-cat').textContent;

      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxTitle.textContent = title;
      lightboxCat.textContent = cat;

      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden'; // Lock background scroll
    });
  });

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = ''; // Unlock background scroll
  };

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  /* ==========================================
     6. BEFORE/AFTER INTERACTIVE SLIDER
     ========================================== */
  const sliderWrapper = document.getElementById('comparison-slider');
  const afterImg = document.getElementById('after-img');
  const sliderHandle = document.getElementById('slider-handle');

  if (sliderWrapper && afterImg && sliderHandle) {
    let isDragging = false;

    const setSliderPosition = (xPos) => {
      const rect = sliderWrapper.getBoundingClientRect();
      let position = ((xPos - rect.left) / rect.width) * 100;
      
      // Clamp boundaries between 0% and 100%
      if (position < 0) position = 0;
      if (position > 100) position = 100;

      afterImg.style.width = `${position}%`;
      sliderHandle.style.left = `${position}%`;
    };

    // Mouse and Touch Listeners for sliding
    const onStart = (e) => {
      isDragging = true;
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!isDragging) return;
      
      let clientX;
      if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }
      
      requestAnimationFrame(() => setSliderPosition(clientX));
    };

    const onEnd = () => {
      isDragging = false;
    };

    sliderHandle.addEventListener('mousedown', onStart);
    sliderWrapper.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    sliderHandle.addEventListener('touchstart', onStart);
    sliderWrapper.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);

    // Click anywhere on slider to jump position
    sliderWrapper.addEventListener('click', (e) => {
      if (e.target.closest('.slider-handle-button')) return;
      setSliderPosition(e.clientX);
    });
  }

  /* ==========================================
     7. REVIEWS TESTIMONIAL CAROUSEL
     ========================================== */
  const slides = document.querySelectorAll('.review-slide');
  const dots = document.querySelectorAll('.carousel-dot');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  let currentSlide = 0;
  let autoplayTimer;

  const showSlide = (index) => {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
    currentSlide = index;
  };

  const nextSlide = () => {
    let next = (currentSlide + 1) % slides.length;
    showSlide(next);
  };

  const prevSlide = () => {
    let prev = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(prev);
  };

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoplay();
    });
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoplay();
    });
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index'), 10);
      showSlide(idx);
      resetAutoplay();
    });
  });

  const startAutoplay = () => {
    autoplayTimer = setInterval(nextSlide, 6000);
  };

  const resetAutoplay = () => {
    clearInterval(autoplayTimer);
    startAutoplay();
  };

  startAutoplay();

  // Pause on hover
  const carouselWrapper = document.querySelector('.reviews-carousel-wrapper');
  if (carouselWrapper) {
    carouselWrapper.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
    carouselWrapper.addEventListener('mouseleave', startAutoplay);
  }

  /* ==========================================
     8. FAQ ACCORDION
     ========================================== */
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question-btn');
    const answer = item.querySelector('.faq-answer');

    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other FAQs first
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
        const otherAnswer = otherItem.querySelector('.faq-answer');
        if (otherAnswer) otherAnswer.style.maxHeight = null;
      });

      // Toggle this item
      if (!isActive) {
        item.classList.add('active');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ==========================================
     9. CONTACT FORM VALIDATION & ONBOARDING SYSTEM
     ========================================== */
  const form = document.getElementById('contact-form');
  const nameInput = document.getElementById('form-name');
  const emailInput = document.getElementById('form-email');
  const phoneInput = document.getElementById('form-phone');
  const goalSelect = document.getElementById('form-goal');
  const programSelect = document.getElementById('form-program');
  const messageInput = document.getElementById('form-message');
  const successMsg = document.getElementById('form-success-msg');

  // Input helper validations
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone) => {
    // Basic phone validation (digits, spaces, dashes, brackets, min 7 digits)
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7;
  };

  const checkField = (input, errorEl, validationFn, defaultMsg) => {
    let isValid = false;
    if (input.type === 'select-one') {
      isValid = input.value !== '';
    } else {
      isValid = input.value.trim() !== '';
    }

    if (isValid && validationFn) {
      isValid = validationFn(input.value);
    }

    if (isValid) {
      errorEl.style.display = 'none';
      input.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    } else {
      errorEl.style.display = 'block';
      input.style.borderColor = 'var(--color-orange)';
    }
    return isValid;
  };

  // Bind blur/change validation for real-time feedback
  nameInput.addEventListener('blur', () => checkField(nameInput, document.getElementById('name-error')));
  emailInput.addEventListener('blur', () => checkField(emailInput, document.getElementById('email-error'), validateEmail));
  phoneInput.addEventListener('blur', () => checkField(phoneInput, document.getElementById('phone-error'), validatePhone));
  goalSelect.addEventListener('change', () => checkField(goalSelect, document.getElementById('goal-error')));
  programSelect.addEventListener('change', () => checkField(programSelect, document.getElementById('program-error')));
  messageInput.addEventListener('blur', () => checkField(messageInput, document.getElementById('message-error')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const isNameValid = checkField(nameInput, document.getElementById('name-error'));
    const isEmailValid = checkField(emailInput, document.getElementById('email-error'), validateEmail);
    const isPhoneValid = checkField(phoneInput, document.getElementById('phone-error'), validatePhone);
    const isGoalValid = checkField(goalSelect, document.getElementById('goal-error'));
    const isProgramValid = checkField(programSelect, document.getElementById('program-error'));
    const isMsgValid = checkField(messageInput, document.getElementById('message-error'));

    const isFormValid = isNameValid && isEmailValid && isPhoneValid && isGoalValid && isProgramValid && isMsgValid;

    if (isFormValid) {
      // Show Success Feedbacks
      successMsg.classList.add('success');
      form.querySelector('button[type="submit"]').style.display = 'none';

      // Simulate sending data to API, clear form after delay
      setTimeout(() => {
        form.reset();
        successMsg.classList.remove('success');
        form.querySelector('button[type="submit"]').style.display = 'inline-flex';
        
        // Reset dropdown float label styles
        document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
          input.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        });
      }, 5000);
    }
  });

  /* ==========================================
     Why Train With Us Stacked Scrolling Cards & Mobile Accordion
     ========================================== */
  const cards = document.querySelectorAll('.accordion-card');

  // Handle Stacking & Scaling Scroll Effect (All Screen Widths)
  const handleScrollStacking = () => {
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      
      // If the next card is sliding over this card
      if (index < cards.length - 1) {
        const nextCard = cards[index + 1];
        const nextRect = nextCard.getBoundingClientRect();
        
        // Calculate how much the next card has overlapped this card
        if (nextRect.top < rect.bottom && nextRect.top > rect.top) {
          const overlap = rect.bottom - nextRect.top;
          const ratio = Math.min(overlap / rect.height, 1);
          // Scale down this card slightly based on overlap (from scale 1 to 0.06)
          card.style.transform = `scale(${1 - ratio * 0.06})`;
          // Darken the background card slightly to enhance depth (from brightness 1 to 0.75)
          card.style.filter = `brightness(${1 - ratio * 0.25})`;
        } else if (nextRect.top <= rect.top) {
          card.style.transform = `scale(0.94)`;
          card.style.filter = `brightness(0.75)`;
        } else {
          card.style.transform = `scale(1)`;
          card.style.filter = `brightness(1)`;
        }
      }
    });
  };

  window.addEventListener('scroll', handleScrollStacking);
});

