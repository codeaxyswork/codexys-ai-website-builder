document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // Header Scroll State & Active Nav Link Highlighting
  // ==========================================================================
  const header = document.getElementById('main-header');
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    // Add scrolled class for glassmorphism background
    if (header) {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    // Highlighting active section link
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 150;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href').slice(1) === current) {
        link.classList.add('active');
      }
    });
  });

  // ==========================================================================
  // Off-Canvas Sidebar Navigation Toggle
  // ==========================================================================
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const offcanvasMenu = document.getElementById('offcanvas-menu');
  const offcanvasCloseBtn = document.getElementById('offcanvas-close-btn');
  const overlayBg = document.getElementById('overlay-bg');
  const offcanvasLinks = document.querySelectorAll('.offcanvas-link');

  const openOffcanvas = () => {
    offcanvasMenu.classList.add('open');
    overlayBg.classList.add('visible');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
  };

  const closeOffcanvas = () => {
    offcanvasMenu.classList.remove('open');
    overlayBg.classList.remove('visible');
    document.body.style.overflow = '';
  };

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', openOffcanvas);
  }
  if (offcanvasCloseBtn) {
    offcanvasCloseBtn.addEventListener('click', closeOffcanvas);
  }
  overlayBg.addEventListener('click', closeOffcanvas);

  offcanvasLinks.forEach(link => {
    link.addEventListener('click', closeOffcanvas);
  });

  // ==========================================================================
  // Portfolio Grid Category Filtering
  // ==========================================================================
  const filterButtons = document.querySelectorAll('.filter-btn');
  const portfolioItems = document.querySelectorAll('.portfolio-card');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active from all and add to current
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filterValue = button.getAttribute('data-filter');

      portfolioItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (filterValue === 'all' || itemCategory === filterValue) {
          // Show matching items
          item.style.display = 'block';
          if (window.gsap) {
            gsap.fromTo(item, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' });
          } else {
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          }
        } else {
          // Hide non-matching items
          if (window.gsap) {
            gsap.to(item, { scale: 0.85, opacity: 0, duration: 0.3, onComplete: () => { item.style.display = 'none'; } });
          } else {
            item.style.display = 'none';
          }
        }
      });
    });
  });

  // ==========================================================================
  // Custom Lightbox Gallery Implementation
  // ==========================================================================
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const lightboxPrevBtn = document.getElementById('lightbox-prev');
  const lightboxNextBtn = document.getElementById('lightbox-next');

  let currentGalleryIndex = 0;
  const galleryData = Array.from(galleryItems).map(item => ({
    src: item.getAttribute('data-src'),
    caption: item.getAttribute('data-caption')
  }));

  const openLightbox = (index) => {
    currentGalleryIndex = index;
    updateLightboxContent();
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  const updateLightboxContent = () => {
    const item = galleryData[currentGalleryIndex];
    if (window.gsap) {
      // Fade out image, swap source, fade back in
      gsap.to(lightboxImg, { opacity: 0, scale: 0.95, duration: 0.2, onComplete: () => {
        lightboxImg.src = item.src;
        lightboxCaption.textContent = item.caption;
        gsap.to(lightboxImg, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
      }});
    } else {
      lightboxImg.src = item.src;
      lightboxCaption.textContent = item.caption;
    }
  };

  galleryItems.forEach((item, index) => {
    item.addEventListener('click', () => openLightbox(index));
  });

  lightboxCloseBtn.addEventListener('click', closeLightbox);
  
  lightboxPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentGalleryIndex = (currentGalleryIndex - 1 + galleryData.length) % galleryData.length;
    updateLightboxContent();
  });

  lightboxNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentGalleryIndex = (currentGalleryIndex + 1) % galleryData.length;
    updateLightboxContent();
  });

  lightboxModal.addEventListener('click', closeLightbox);

  // Close lightbox on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  });

  // ==========================================================================
  // Accordion FAQ Panel Animation
  // ==========================================================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other active items
      faqItems.forEach(i => {
        if (i !== item) {
          i.classList.remove('active');
          i.querySelector('.faq-answer').style.maxHeight = null;
        }
      });

      // Toggle active state
      if (isActive) {
        item.classList.remove('active');
        answer.style.maxHeight = null;
      } else {
        item.classList.add('active');
        // Set dynamic height from content size
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });

  // ==========================================================================
  // Inquiry Form Validation & Success Toast Notification
  // ==========================================================================
  const form = document.getElementById('inquiry-form');
  const toastSuccess = document.getElementById('toast-success');

  const validateInput = (input) => {
    const parent = input.closest('.form-group');
    let isValid = true;

    if (input.required && !input.value.trim()) {
      isValid = false;
    } else if (input.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      isValid = emailRegex.test(input.value.trim());
    } else if (input.id === 'form-phone') {
      const phoneRegex = /^[+]*[0-9 \-\(\)]{8,20}$/;
      isValid = phoneRegex.test(input.value.trim());
    } else if (input.minLength && input.value.trim().length < input.minLength) {
      isValid = false;
    }

    if (!isValid) {
      parent.classList.add('invalid');
    } else {
      parent.classList.remove('invalid');
    }

    return isValid;
  };

  // Attach blur listeners for instant validation feedback
  form.querySelectorAll('.form-control').forEach(input => {
    input.addEventListener('blur', () => validateInput(input));
    input.addEventListener('input', () => {
      // Clear error immediately when user begins writing valid data
      const parent = input.closest('.form-group');
      if (parent.classList.contains('invalid')) {
        validateInput(input);
      }
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isFormValid = true;

    form.querySelectorAll('.form-control').forEach(input => {
      const isInputValid = validateInput(input);
      if (!isInputValid) {
        isFormValid = false;
      }
    });

    if (isFormValid) {
      // Show success toast notification
      toastSuccess.classList.add('show');
      
      // Clear toast after 4 seconds
      setTimeout(() => {
        toastSuccess.classList.remove('show');
      }, 4000);

      // Reset form variables
      form.reset();
    }
  });

  // ==========================================================================
  // Swiper JS Carousels Setup (Hero & Testimonials)
  // ==========================================================================
  if (typeof Swiper !== 'undefined') {
    // Premium Savoye Hero Slider
    new Swiper('.hero-slider', {
      slidesPerView: 1,
      spaceBetween: 0,
      effect: 'fade',
      fadeEffect: {
        crossFade: true
      },
      loop: true,
      speed: 1200,
      autoplay: {
        delay: 6000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.savoye-dots-pagination',
        clickable: true,
      },
    });

    // Testimonial Carousel
    if (document.querySelector('.testimonial-swiper')) {
      new Swiper('.testimonial-swiper', {
        slidesPerView: 1,
        spaceBetween: 40,
        loop: true,
        autoplay: {
          delay: 5000,
          disableOnInteraction: false,
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
      });
    }
  }

  // ==========================================================================
  // GSAP Premium Scroll Trigger Animations
  // ==========================================================================
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Savoye Hero Entry Animations
    gsap.fromTo('.savoye-subtitle', 
      { x: -50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 1, ease: 'power3.out' }
    );
    gsap.fromTo('.savoye-title', 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.2, delay: 0.25, ease: 'power4.out' }
    );
    gsap.fromTo('.savoye-desc', 
      { y: 30, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1, delay: 0.45, ease: 'power3.out' }
    );
    gsap.fromTo('.savoye-btn', 
      { scale: 0.9, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.8, delay: 0.65, ease: 'back.out(1.5)' }
    );
    gsap.fromTo('.savoye-dot', 
      { y: 15, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.15, delay: 0.85, ease: 'power2.out' }
    );
    gsap.fromTo('.savoye-left-item, .savoye-grid-item', 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1, stagger: 0.1, delay: 1, ease: 'power3.out' }
    );

    // Section Reveals
    // About Us images and text split
    gsap.fromTo('.about-images-wrapper', 
      { x: -50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: {
        trigger: '.about',
        start: 'top 80%',
      }}
    );

    gsap.fromTo('.about-content', 
      { x: 50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: {
        trigger: '.about',
        start: 'top 80%',
      }}
    );

    // Services card grid stagger reveal
    gsap.fromTo('.service-card', 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power2.out', scrollTrigger: {
        trigger: '.services-grid',
        start: 'top 85%',
      }}
    );

    // Portfolio cards stagger reveal
    gsap.fromTo('.portfolio-card', 
      { y: 40, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: 'power2.out', scrollTrigger: {
        trigger: '.portfolio-grid',
        start: 'top 85%',
      }}
    );

    // Process steps timeline tracking
    gsap.fromTo('.process-step', 
      { scale: 0.9, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.8, stagger: 0.2, ease: 'back.out(1.2)', scrollTrigger: {
        trigger: '.process-grid',
        start: 'top 80%',
      }}
    );

    // Why Choose Us features reveal
    gsap.fromTo('.feature-item', 
      { x: -30, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power2.out', scrollTrigger: {
        trigger: '.why-features',
        start: 'top 85%',
      }}
    );

    // Gallery masonry block stagger reveal
    gsap.fromTo('.gallery-item', 
      { scale: 0.9, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: {
        trigger: '.gallery-grid',
        start: 'top 85%',
      }}
    );
  }
});
