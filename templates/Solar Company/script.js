document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STICKY HEADER & ACTIVE LINKS ON SCROLL
  // ==========================================================================
  const header = document.querySelector('.header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  function handleScroll() {
    // Toggle sticky header
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Dynamic active links
    let currentId = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Initial check

  // ==========================================================================
  // MOBILE NAVIGATION HAMBURGER MENU
  // ==========================================================================
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    });
  });

  // ==========================================================================
  // HERO ROTATING SLIDER
  // ==========================================================================
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  let currentSlide = 0;
  let slideInterval;
  const slideDuration = 6000; // 6 seconds

  function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
    currentSlide = index;
  }

  function nextSlide() {
    let next = (currentSlide + 1) % slides.length;
    showSlide(next);
  }

  function startAutoplay() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, slideDuration);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showSlide(index);
      startAutoplay(); // Reset timer on click
    });
  });

  if (slides.length > 0) {
    showSlide(0);
    startAutoplay();
  }

  // ==========================================================================
  // SCROLL-TRIGGERED REVEAL ANIMATIONS
  // ==========================================================================
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Animates only once
      }
    });
  }, {
    root: null,
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================================================
  // GALLERY CATEGORY FILTER
  // ==========================================================================
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Set active button
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (filterValue === 'all' || itemCategory === filterValue) {
          item.classList.remove('hidden');
          // Trigger scale animate
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          }, 50);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.8)';
          setTimeout(() => {
            item.classList.add('hidden');
          }, 350);
        }
      });
    });
  });

  // ==========================================================================
  // GALLERY LIGHTBOX PREVIEW
  // ==========================================================================
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const lightboxClose = lightbox.querySelector('.lightbox-close');
  const lightboxPrev = lightbox.querySelector('.lightbox-prev');
  const lightboxNext = lightbox.querySelector('.lightbox-next');
  
  let currentGalleryIndex = 0;
  let activeGalleryItems = [];

  function updateActiveGalleryList() {
    // Only scroll between currently visible gallery items
    activeGalleryItems = Array.from(galleryItems).filter(item => !item.classList.contains('hidden'));
  }

  function openLightbox(index) {
    updateActiveGalleryList();
    currentGalleryIndex = index;
    const item = activeGalleryItems[currentGalleryIndex];
    const imgUrl = item.querySelector('.gallery-img').getAttribute('src');
    const captionText = item.querySelector('.gallery-item-title').textContent;

    lightboxImg.setAttribute('src', imgUrl);
    lightboxCaption.textContent = captionText;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock body scroll
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function navigateLightbox(direction) {
    updateActiveGalleryList();
    if (activeGalleryItems.length === 0) return;
    
    currentGalleryIndex = (currentGalleryIndex + direction + activeGalleryItems.length) % activeGalleryItems.length;
    const item = activeGalleryItems[currentGalleryIndex];
    const imgUrl = item.querySelector('.gallery-img').getAttribute('src');
    const captionText = item.querySelector('.gallery-item-title').textContent;

    lightboxImg.setAttribute('src', imgUrl);
    lightboxCaption.textContent = captionText;
  }

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      updateActiveGalleryList();
      const index = activeGalleryItems.indexOf(item);
      if (index !== -1) {
        openLightbox(index);
      }
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  lightboxNext.addEventListener('click', () => navigateLightbox(1));

  // Dismiss on clicking background
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
      closeLightbox();
    }
  });

  // Esc key closure, Left/Right navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  // ==========================================================================
  // FAQ ACCORDION TOGGLE
  // ==========================================================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close other FAQs
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
        otherItem.querySelector('.faq-answer').style.maxHeight = null;
      });

      if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // (Consultation modal popup toggle logic removed in favor of direct WhatsApp redirect links)

  // ==========================================================================
  // CONTACT & MODAL CONSULTATION FORM VALIDATIONS
  // ==========================================================================
  const contactForm = document.getElementById('contact-form');

  function handleFormSubmission(form, successEl, errorEl) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Basic check
      const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
      let allValid = true;

      inputs.forEach(input => {
        if (!input.value.trim()) {
          allValid = false;
          input.style.borderColor = 'hsl(0, 84%, 60%)';
        } else {
          input.style.borderColor = 'var(--clr-gray-border)';
        }
      });

      if (!allValid) {
        if (errorEl) {
          errorEl.textContent = 'Please fill out all required fields.';
          errorEl.style.display = 'block';
        }
        return;
      }

      // If valid, show mock success loading state
      if (errorEl) errorEl.style.display = 'none';
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;

      setTimeout(() => {
        form.style.display = 'none';
        if (successEl) {
          successEl.textContent = 'Thank you! Your request has been submitted successfully. Our solar experts will contact you shortly.';
          successEl.style.display = 'block';
        }
      }, 1500);
    });
  }

  if (contactForm) {
    const successMsg = contactForm.parentNode.querySelector('.form-message.success');
    const errorMsg = contactForm.parentNode.querySelector('.form-message.error');
    handleFormSubmission(contactForm, successMsg, errorMsg);
  }

});
