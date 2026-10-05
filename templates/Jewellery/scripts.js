/**
 * Luxury Jewellery Landing Page Scripting
 */

document.addEventListener('DOMContentLoaded', () => {
  // === STICKY HEADER & ACTIVE SECTION NAV HIGHLIGHT ===
  const headerWrapper = document.querySelector('.header-wrapper');
  const sections = document.querySelectorAll('section, header');
  const navItems = document.querySelectorAll('.nav-menu a');
  
  const handleScroll = () => {
    // Header sticky transition
    if (window.scrollY > 80) {
      headerWrapper.classList.add('sticky');
      headerWrapper.classList.remove('transparent-header');
    } else {
      headerWrapper.classList.remove('sticky');
      // If we are on the hero section (or at top), make it transparent
      if (document.body.classList.contains('has-hero') || window.scrollY <= 80) {
        headerWrapper.classList.add('transparent-header');
      }
    }

    // Scroll active link highlight
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= (sectionTop - 150)) {
        current = section.getAttribute('id');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === `#${current}`) {
        item.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', handleScroll);
  // Initial run
  handleScroll();


  // === MOBILE NAVIGATION MENU ===
  const menuToggleBtn = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const menuToggleIcon = menuToggleBtn.querySelector('svg');

  const toggleMenu = () => {
    navMenu.classList.toggle('open');
    // Change icon representation from hamburger to close
    if (navMenu.classList.contains('open')) {
      menuToggleIcon.innerHTML = `
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      `;
    } else {
      menuToggleIcon.innerHTML = `
        <line x1="4" y1="12" x2="20" y2="12"></line>
        <line x1="4" y1="6" x2="20" y2="6"></line>
        <line x1="4" y1="18" x2="20" y2="18"></line>
      `;
    }
  };

  const navMenuCloseBtn = document.querySelector('.nav-menu-close');
  if (navMenuCloseBtn) {
    navMenuCloseBtn.addEventListener('click', toggleMenu);
  }

  menuToggleBtn.addEventListener('click', toggleMenu);

  // Close menu when clicking nav item
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (navMenu.classList.contains('open')) {
        toggleMenu();
      }
    });
  });


  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !menuToggleBtn.contains(e.target)) {
      toggleMenu();
    }
  });


  // === INTERSECTION OBSERVER FOR SCROLL REVEAL ===
  const revealElements = document.querySelectorAll('.reveal');

  const revealOnScroll = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Animates only once
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(element => {
    revealOnScroll.observe(element);
  });


  // === CLIENT STORIES ACCORDION ===
  const storyItems = document.querySelectorAll('.story-item');

  storyItems.forEach(item => {
    const trigger = item.querySelector('.story-trigger');
    const content = item.querySelector('.story-content');

    // If it starts active, set initial max-height dynamically so collapsing animation is smooth
    if (item.classList.contains('active')) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }

    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      storyItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.story-content').style.maxHeight = '0px';
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });


  // === MASTERPIECES CAROUSEL ===
  const masterpiecesTrack = document.querySelector('.masterpieces-track');
  const masterpieceSlides = document.querySelectorAll('.masterpiece-slide');
  const prevBtn = document.querySelector('.carousel-arrow.prev');
  const nextBtn = document.querySelector('.carousel-arrow.next');
  const currIndexSpan = document.getElementById('currIndex');
  const progressFill = document.getElementById('progressFill');
  let currentMasterpieceIdx = 0;

  if (masterpieceSlides.length > 0) {
    const updateMasterpieceCarousel = (index) => {
      currentMasterpieceIdx = index;
      masterpiecesTrack.style.transform = `translateX(-${index * 100}%)`;
      
      // Update UI count (e.g. 01, 02, 03)
      if (currIndexSpan) {
        currIndexSpan.textContent = `0${index + 1}`;
      }
      
      // Update progress fill bar
      if (progressFill) {
        progressFill.style.width = `${((index + 1) / masterpieceSlides.length) * 100}%`;
      }
    };

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        let nextIndex = (currentMasterpieceIdx + 1) % masterpieceSlides.length;
        updateMasterpieceCarousel(nextIndex);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        let prevIndex = (currentMasterpieceIdx - 1 + masterpieceSlides.length) % masterpieceSlides.length;
        updateMasterpieceCarousel(prevIndex);
      });
    }
  }


  // === FAQ ACCORDION ===
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');

    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-content').style.maxHeight = '0px';
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });


  // === APPOINTMENT BOOKING MODAL ===
  const modalOverlay = document.getElementById('bookingModal');
  const modalCloseBtn = document.querySelector('.modal-close-btn');
  const openModalBtns = document.querySelectorAll('.book-appointment-trigger');

  const openModal = () => {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // Stop page scrolling background
  };

  const closeModal = () => {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = 'auto'; // Re-enable scroll
  };

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  modalCloseBtn.addEventListener('click', closeModal);

  // Close modal when clicking on the overlay background
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Handle forms (Submit simulator)
  const contactForms = document.querySelectorAll('.contact-form, .modal-contact-form');
  
  contactForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Select submit button to show loading
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Sending...';
      submitBtn.disabled = true;

      // Simulate API call
      setTimeout(() => {
        // Change UI state
        form.innerHTML = `
          <div style="text-align: center; padding: 40px 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C5A880" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <h4 style="font-family: var(--font-serif); font-size: 24px; margin-bottom: 10px;">Consultation Scheduled</h4>
            <p style="color: var(--color-text-muted); font-size: 15px;">Thank you. A jewellery specialist will contact you shortly to confirm your private showroom session.</p>
          </div>
        `;
        
        // If modal form, close modal after a short delay
        if (form.classList.contains('modal-contact-form')) {
          setTimeout(() => {
            closeModal();
          }, 3500);
        }
      }, 1500);
    });
  });
});
