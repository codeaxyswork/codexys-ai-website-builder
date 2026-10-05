document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. MOBILE MENU TOGGLE
  // ==========================================================================
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const menuIcon = navToggle.querySelector('i');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isActive = navMenu.classList.contains('active');
      
      // Update Lucide icon dynamically
      if (isActive) {
        navToggle.innerHTML = '<i data-lucide="x"></i>';
      } else {
        navToggle.innerHTML = '<i data-lucide="menu"></i>';
      }
      lucide.createIcons();
    });

    // Close menu when a link is clicked
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.innerHTML = '<i data-lucide="menu"></i>';
        lucide.createIcons();
      });
    });
  }

  // ==========================================================================
  // 2. HEADER SCROLL & THEME MANAGEMENT
  // ==========================================================================
  const header = document.getElementById('header');
  const navLogo = document.querySelector('.nav-logo');
  const navLinks = document.querySelectorAll('.nav-link');
  const toggleBtn = document.querySelector('.nav-toggle');

  function handleHeaderScroll() {
    const isScrolled = window.scrollY > 50;
    if (isScrolled) {
      header.classList.add('scrolled');
      // Remove transparent mode classes
      navLogo.classList.remove('on-dark-slide');
      toggleBtn?.classList.remove('on-dark-slide');
      navLinks.forEach(link => link.classList.remove('on-dark-slide'));
    } else {
      header.classList.remove('scrolled');
      
      // If we are on hero section (which is dark), apply white text when not scrolled
      const heroSection = document.getElementById('home');
      if (heroSection) {
        navLogo.classList.add('on-dark-slide');
        toggleBtn?.classList.add('on-dark-slide');
        navLinks.forEach(link => link.classList.add('on-dark-slide'));
      }
    }
  }

  window.addEventListener('scroll', handleHeaderScroll);
  // Initial check
  handleHeaderScroll();

  // ==========================================================================
  // 3. HERO SLIDER
  // ==========================================================================
  const slides = document.querySelectorAll('.hero-slide');
  const dotsContainer = document.getElementById('slider-dots');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  let currentSlide = 0;
  let slideInterval;
  const slideDuration = 9000; // 9 seconds

  if (slides.length > 0) {
    // Create indicator dots
    slides.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.classList.add('slider-dot');
      if (index === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goToSlide(index));
      dotsContainer.appendChild(dot);
    });

    const dots = document.querySelectorAll('.slider-dot');

    function updateSlides() {
      slides.forEach((slide, index) => {
        if (index === currentSlide) {
          slide.classList.add('active');
          // Re-trigger SVG animations inside active slide
          const svgLines = slide.querySelectorAll('.svg-chart-line');
          svgLines.forEach(line => {
            line.style.animation = 'none';
            // Force reflow
            line.offsetHeight;
            line.style.animation = 'drawLine 2.5s ease-out forwards';
          });
        } else {
          slide.classList.remove('active');
        }
      });

      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
      });
    }

    function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
      updateSlides();
    }

    function prevSlide() {
      currentSlide = (currentSlide - 1 + slides.length) % slides.length;
      updateSlides();
    }

    function goToSlide(index) {
      currentSlide = index;
      updateSlides();
      resetInterval();
    }

    function startInterval() {
      slideInterval = setInterval(nextSlide, slideDuration);
    }

    function resetInterval() {
      clearInterval(slideInterval);
      startInterval();
    }

    nextBtn?.addEventListener('click', () => {
      nextSlide();
      resetInterval();
    });

    prevBtn?.addEventListener('click', () => {
      prevSlide();
      resetInterval();
    });

    // Pause on hover
    const heroSec = document.getElementById('home');
    heroSec?.addEventListener('mouseenter', () => clearInterval(slideInterval));
    heroSec?.addEventListener('mouseleave', () => startInterval());

    // Initialize slider
    updateSlides();
    startInterval();
  }

  // ==========================================================================
  // 4. SCROLL REVEAL (INTERSECTION OBSERVER)
  // ==========================================================================
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // Stop tracking once animated
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================================================
  // 5. RESULTS COUNTER ANIMATION
  // ==========================================================================
  const statNums = document.querySelectorAll('.stat-num');
  let countersAnimated = false;

  function animateCounters() {
    statNums.forEach(stat => {
      const targetText = stat.getAttribute('data-target');
      // Parse numeric portion and find the suffix
      const numberPattern = /[0-9.]+/;
      const targetVal = parseFloat(targetText.match(numberPattern)[0]);
      const suffix = targetText.replace(numberPattern, '');
      const decimals = targetText.includes('.') ? 1 : 0;
      
      let startVal = 0;
      const duration = 2000; // 2 seconds
      const startTime = performance.now();

      function updateCounter(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing curve (easeOutQuad)
        const easeProgress = progress * (2 - progress);
        const currentVal = startVal + (targetVal - startVal) * easeProgress;
        
        stat.textContent = currentVal.toFixed(decimals) + suffix;

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          stat.textContent = targetText; // Ensure exact final value
        }
      }

      requestAnimationFrame(updateCounter);
    });
  }

  const resultsSection = document.getElementById('results');
  if (resultsSection) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersAnimated) {
          animateCounters();
          countersAnimated = true;
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.3
    });

    counterObserver.observe(resultsSection);
  }

  // ==========================================================================
  // 6. FAQ ACCORDION
  // ==========================================================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    const body = item.querySelector('.faq-body');

    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other FAQs
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-body').style.maxHeight = '0';
        }
      });

      // Toggle current FAQ
      if (isActive) {
        item.classList.remove('active');
        body.style.maxHeight = '0';
      } else {
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });

  // ==========================================================================
  // 7. ACTIVE NAVIGATION LINK ON SCROLL
  // ==========================================================================
  const sections = document.querySelectorAll('section[id]');

  function highlightNavigation() {
    const scrollY = window.pageYOffset;
    
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      
      const navLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);

      if (navLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navLink.classList.add('active');
        } else {
          navLink.classList.remove('active');
        }
      }
    });
  }

  window.addEventListener('scroll', highlightNavigation);

  // ==========================================================================
  // 8. INTERACTIVE CONTACT FORM WIDGETS
  // ==========================================================================
  // Budget Buttons selection logic
  const budgetBtns = document.querySelectorAll('.budget-btn');
  const budgetInput = document.getElementById('marketing-budget');

  budgetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      budgetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      budgetInput.value = btn.getAttribute('data-value');
    });
  });

  // Form submission and validation logic
  const contactForm = document.getElementById('contact-form');
  const formSuccess = document.getElementById('form-success');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Basic field checks
      const name = document.getElementById('full-name').value.trim();
      const email = document.getElementById('email').value.trim();
      const website = document.getElementById('website').value.trim();
      const budget = budgetInput.value;
      const message = document.getElementById('message').value.trim();

      // Find selected services
      const selectedServices = Array.from(document.querySelectorAll('.checkbox-pill-input:checked'))
        .map(input => input.value);

      if (!name || !email || !message) {
        alert('Please fill out all required fields (Name, Email, and Message).');
        return;
      }

      // Email format verification
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      // Show simulated loader on submit button
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="audit-indicator"></span> Generating Your Free Audit...';

      setTimeout(() => {
        // Hide form and display success panel
        contactForm.style.display = 'none';
        formSuccess.style.display = 'block';
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Console log values for diagnostic simulation
        console.log('Lead Captured Successfully:', {
          name,
          email,
          website,
          budget,
          selectedServices,
          message
        });
      }, 2000);
    });
  }
});
