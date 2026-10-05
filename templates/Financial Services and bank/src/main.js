/* 
================================================================
AURELIA FINANCE - INTERACTIVE LOGIC
================================================================
*/

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. HEADER SCROLL & MOBILE NAVIGATION
  // ==========================================
  const header = document.getElementById('site-header');
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-cta');

  // Sticky header scrolled class
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Toggle mobile overlay
  function toggleMobileMenu() {
    mobileToggle.classList.toggle('active');
    mobileOverlay.classList.toggle('active');
    
    // Toggle icons
    const menuIcon = mobileToggle.querySelector('.menu-icon');
    const closeIcon = mobileToggle.querySelector('.close-icon');
    
    if (mobileOverlay.classList.contains('active')) {
      menuIcon.style.display = 'none';
      closeIcon.style.display = 'block';
      document.body.style.overflow = 'hidden'; // Stop body scrolling
    } else {
      menuIcon.style.display = 'block';
      closeIcon.style.display = 'none';
      document.body.style.overflow = 'auto'; // Re-enable body scrolling
    }
  }

  mobileToggle.addEventListener('click', toggleMobileMenu);

  // Close mobile menu on clicking links
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileOverlay.classList.contains('active')) {
        toggleMobileMenu();
      }
    });
  });

  // ==========================================
  // 2. HERO SLIDER LOGIC
  // ==========================================
  const slides = document.querySelectorAll('#hero-slider .slide');
  const prevBtn = document.getElementById('prev-slide');
  const nextBtn = document.getElementById('next-slide');
  const dotsContainer = document.getElementById('slider-dots');
  let currentSlide = 0;
  let sliderInterval;
  const slideDuration = 6000;

  // Generate dots dynamically
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });

  const dots = document.querySelectorAll('#slider-dots .dot');

  function updateSlides() {
    slides.forEach((slide, idx) => {
      if (idx === currentSlide) {
        slide.classList.add('active');
        dots[idx].classList.add('active');
      } else {
        slide.classList.remove('active');
        dots[idx].classList.remove('active');
      }
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

  function goToSlide(idx) {
    currentSlide = idx;
    updateSlides();
    resetSliderTimer();
  }

  if (nextBtn && prevBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetSliderTimer();
    });
    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetSliderTimer();
    });
  }

  function startSliderTimer() {
    sliderInterval = setInterval(nextSlide, slideDuration);
  }

  function resetSliderTimer() {
    clearInterval(sliderInterval);
    startSliderTimer();
  }

  startSliderTimer();

  // ==========================================
  // 3. STATS COUNT-UP ANIMATION
  // ==========================================
  const statNumbers = document.querySelectorAll('.stat-number');
  
  const countUp = (element) => {
    const target = parseInt(element.getAttribute('data-target'), 10);
    const count = +element.innerText.replace(/[^0-9]/g, '');
    const duration = 2000; // 2 seconds animation
    const stepTime = Math.abs(Math.floor(duration / target));
    
    let current = 0;
    
    // Customize text formatting based on stat ID
    const formatValue = (val) => {
      if (element.parentElement.id === 'stat-customers') {
        return val.toLocaleString() + '+';
      } else if (element.parentElement.id === 'stat-loans') {
        return '$' + val + 'M+';
      } else if (element.parentElement.id === 'stat-years' || element.parentElement.id === 'stat-specialists') {
        return val + '+';
      } else if (element.parentElement.id === 'stat-satisfaction') {
        return val + '%';
      }
      return val;
    };

    const timer = setInterval(() => {
      // Calculate smooth increment step
      const increment = Math.ceil(target / 40);
      current += increment;
      
      if (current >= target) {
        element.innerText = formatValue(target);
        clearInterval(timer);
      } else {
        element.innerText = formatValue(current);
      }
    }, Math.max(stepTime, 20));
  };

  const statsObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(num => statsObserver.observe(num));

  // ==========================================
  // 4. ABOUT US TAB HANDLER (Vision & Mission)
  // ==========================================
  const tabTriggers = document.querySelectorAll('.tab-trigger');
  const tabContents = document.querySelectorAll('.tab-content');

  tabTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tabId = trigger.getAttribute('data-tab');
      
      tabTriggers.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      trigger.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // ==========================================
  // 5. FINANCIAL SOLUTIONS ECOSYSTEM SPATIAL HUB LOGIC
  // ==========================================
  const spatialNodes = document.querySelectorAll('.spatial-node');
  const viewport = document.getElementById('hub-viewport');
  const viewportTitle = document.getElementById('viewport-title');
  const viewportDesc = document.getElementById('viewport-desc');
  const viewportFeatures = document.getElementById('viewport-features');

  // Core database for the spatial hub
  const spatialHubData = [
    {
      title: 'Personal Banking',
      desc: 'Everyday banking solutions designed for convenience and security. Access checking accounts, savings accounts, digital transactions, and premium reward schemes customized to support your daily flow.',
      features: [
        'Yield-maximized checking accounts',
        'Bespoke titanium credit cards',
        'Zero fee international money transfers'
      ]
    },
    {
      title: 'Business Banking',
      desc: 'Tailored financial products for growing businesses. We offer high-yield commercial deposits, automated payroll solutions, optimized merchant banking, and treasury consultation services.',
      features: [
        'Liquid commercial credit lines',
        'Automated corporate treasury suites',
        'Developer-friendly merchant API tools'
      ]
    },
    {
      title: 'Investments',
      desc: 'Active investment strategies designed to build, expand, and solidify long-term wealth. Explore custom portfolio configurations, alternative asset placement plans, and brokerage desks.',
      features: [
        'Direct private equity opportunities',
        'Quantitative risk-management models',
        'High-yield alternative placement avenues'
      ]
    },
    {
      title: 'Wealth Management',
      desc: 'High-touch advisory support for high-net-worth families, private offices, and trusts. Focus on generational estate setup, tax mitigation structures, and capital preservation.',
      features: [
        'Generational wealth transition planning',
        'Bespoke off-shore corporate trusts',
        'Custom asset protection schemes'
      ]
    },
    {
      title: 'Insurance Solutions',
      desc: 'Comprehensive risk mitigation and protection policies to safeguard your commercial operations and high-value personal assets. Structured coverage panels engineered by global underwriters.',
      features: [
        'High-value keyman protection strategies',
        'Global commercial liability coverage panels',
        'Bespoke estate and property indemnity'
      ]
    },
    {
      title: 'Digital Banking',
      desc: 'Modern online financial portals and mobile banking apps featuring biometric security checkpoints, domestic transfers, multi-currency ledger structures, and real-time alerts.',
      features: [
        'Biometric authentication checkpoints',
        'Real-time multi-currency ledger tools',
        'Automated clearing and instant deposits'
      ]
    }
  ];

  function syncSpatialHub(index) {
    if (index < 0 || index >= spatialHubData.length) return;
    
    // Sync active node
    spatialNodes.forEach((node, idx) => {
      if (idx === index) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });

    // Fade viewport out
    viewport.style.opacity = '0';
    viewport.style.transform = 'translateY(10px)';
    viewport.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

    setTimeout(() => {
      const data = spatialHubData[index];
      
      // Update viewport text
      viewportTitle.innerText = data.title;
      viewportDesc.innerText = data.desc;
      
      // Update features list
      viewportFeatures.innerHTML = '';
      data.features.forEach(feat => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="ph ph-circle-wavy-check"></i> ${feat}`;
        viewportFeatures.appendChild(li);
      });

      // Fade viewport in
      viewport.style.opacity = '1';
      viewport.style.transform = 'translateY(0)';
    }, 250);
  }

  // Attach event handlers to spatial nodes
  spatialNodes.forEach((node, index) => {
    // Sync on hover
    node.addEventListener('mouseenter', () => {
      syncSpatialHub(index);
    });

    // Sync on click/tap
    node.addEventListener('click', (e) => {
      e.preventDefault();
      syncSpatialHub(index);
    });
  });

  // Initialize hub
  if (spatialNodes.length > 0) {
    syncSpatialHub(0);
  }


  // ==========================================
  // 6. FEATURED LOANS EXPANDING VISUAL PANELS
  // ==========================================
  const expandingPanels = document.querySelectorAll('.expanding-panel');

  expandingPanels.forEach(panel => {
    // Desktop hover expansion
    panel.addEventListener('mouseenter', () => {
      expandingPanels.forEach(p => p.classList.remove('active'));
      panel.classList.add('active');
    });

    // Mobile click behavior
    panel.addEventListener('click', () => {
      expandingPanels.forEach(p => p.classList.remove('active'));
      panel.classList.add('active');
    });
  });

  // ==========================================
  // 7. JOURNEY TIMELINE SCROLL OBSERVER
  // ==========================================
  const journeySection = document.querySelector('.journey-section');
  const timelineSteps = document.querySelectorAll('.timeline-step');
  const timelineProgress = document.getElementById('timeline-progress');

  const journeyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateTimeline();
      }
    });
  }, { threshold: 0.3 });

  if (journeySection) {
    journeyObserver.observe(journeySection);
  }

  function animateTimeline() {
    let stepCount = timelineSteps.length;
    let delay = 300;

    // Incrementally activate timeline nodes with offsets
    timelineSteps.forEach((step, index) => {
      setTimeout(() => {
        step.classList.add('active');
        
        // Progress bar percentage calculation
        const percent = ((index) / (stepCount - 1)) * 100;
        timelineProgress.style.width = `${percent}%`;
        
      }, index * delay);
    });
  }

  // ==========================================
  // 8. TESTIMONIAL SLIDER CAROUSEL
  // ==========================================
  const testimonials = document.querySelectorAll('.testimonial-slide');
  const prevTestBtn = document.getElementById('prev-testimonial');
  const nextTestBtn = document.getElementById('next-testimonial');
  const testDotsContainer = document.getElementById('testimonial-dots');
  let currentTestimonial = 0;
  let testInterval;
  const testDuration = 8000;

  // Generate test dots
  testimonials.forEach((_, idx) => {
    const dot = document.createElement('div');
    dot.classList.add('test-dot');
    if (idx === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToTestimonial(idx));
    testDotsContainer.appendChild(dot);
  });

  const testDots = document.querySelectorAll('#testimonial-dots .test-dot');

  function updateTestimonials() {
    testimonials.forEach((slide, idx) => {
      if (idx === currentTestimonial) {
        slide.classList.add('active');
        testDots[idx].classList.add('active');
      } else {
        slide.classList.remove('active');
        testDots[idx].classList.remove('active');
      }
    });
  }

  function nextTestimonial() {
    currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    updateTestimonials();
  }

  function prevTestimonial() {
    currentTestimonial = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
    updateTestimonials();
  }

  function goToTestimonial(idx) {
    currentTestimonial = idx;
    updateTestimonials();
    resetTestTimer();
  }

  if (nextTestBtn && prevTestBtn) {
    nextTestBtn.addEventListener('click', () => {
      nextTestimonial();
      resetTestTimer();
    });
    prevTestBtn.addEventListener('click', () => {
      prevTestimonial();
      resetTestTimer();
    });
  }

  function startTestTimer() {
    testInterval = setInterval(nextTestimonial, testDuration);
  }

  function resetTestTimer() {
    clearInterval(testInterval);
    startTestTimer();
  }

  startTestTimer();

  // ==========================================
  // 9. FAQ ACCORDION LOGIC
  // ==========================================
  const faqTriggers = document.querySelectorAll('.faq-trigger');

  faqTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const faqItem = trigger.parentElement;
      const isOpen = faqItem.classList.contains('open');
      const panel = trigger.nextElementSibling;
      
      // Close other accordion panels
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('open');
        item.querySelector('.faq-panel').style.maxHeight = null;
        item.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        faqItem.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });

  // ==========================================
  // 10. SECTION SCROLL REVEAL OBSERVER
  // ==========================================
  const revealElements = document.querySelectorAll('.scroll-reveal');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 11. FORM SUBMISSION VALIDATION & SIMULATION
  // ==========================================
  const consultationForm = document.getElementById('consultation-form');
  const formStatus = document.getElementById('form-status');

  if (consultationForm) {
    consultationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-consultation');
      const submitText = submitBtn.querySelector('span');
      const submitIcon = submitBtn.querySelector('i');
      
      // Basic values
      const fullname = document.getElementById('fullname').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      
      if (!fullname || !email || !phone) {
        formStatus.className = 'form-status error';
        formStatus.innerText = 'Please complete all required fields.';
        return;
      }

      // Start loader state
      submitBtn.disabled = true;
      submitText.innerText = 'Transmitting Inquest...';
      submitIcon.className = 'ph ph-spinner-gap';
      submitIcon.style.animation = 'spin 1.5s linear infinite';
      
      formStatus.innerText = '';
      
      // Simulate modern API post delay
      setTimeout(() => {
        submitBtn.disabled = false;
        submitText.innerText = 'Request Consultation';
        submitIcon.className = 'ph ph-arrow-right';
        submitIcon.style.animation = 'none';
        
        formStatus.className = 'form-status success';
        formStatus.innerText = 'Inquiry successfully processed. An Aurelia Wealth Specialist will contact you within 2 business hours.';
        
        consultationForm.reset();
      }, 1800);
    });
  }

  // Smooth scroll helper for footer/header anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        
        // Offset scroll based on header scrolled size (80px)
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - 80;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

});

// Helper spin keyframe rule for submission loading state
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin {
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
