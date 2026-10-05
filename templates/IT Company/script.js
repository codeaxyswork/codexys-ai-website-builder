/* ==========================================================================
   Premium Software Company Landing Page Interactive Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // --- Sticky Navigation & Active Link Tracker ---
  const header = document.getElementById('main-header');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section');

  window.addEventListener('scroll', () => {
    // Sticky Header effect
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Active link highlighting on scroll
    let currentSectionId = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        currentSectionId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSectionId}`) {
        link.classList.add('active');
      }
    });
  });

  // --- Mobile Hamburger Menu ---
  const hamburger = document.getElementById('hamburger-menu-toggle');
  const navMenu = document.getElementById('navigation-menu');

  hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
    // Rotate hamburger bars if active
    const spans = hamburger.querySelectorAll('span');
    if (hamburger.classList.contains('active')) {
      spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });

  // Close mobile nav when link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });


  // --- Full Screen Hero Slider ---
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dot');
  const prevBtn = document.getElementById('slider-arrow-prev');
  const nextBtn = document.getElementById('slider-arrow-next');
  let currentSlide = 0;
  const slideIntervalTime = 6000; // 6 seconds
  let slideTimer;

  function resetProgressBars() {
    dots.forEach(dot => {
      const progress = dot.querySelector('.slider-dot-progress');
      if (progress) {
        progress.style.transition = 'none';
        progress.style.width = '0';
      }
    });
  }

  function startProgressBar(index) {
    resetProgressBars();
    // Force repaint
    dots[index].offsetHeight;
    const progress = dots[index].querySelector('.slider-dot-progress');
    if (progress) {
      progress.style.transition = `width ${slideIntervalTime}ms linear`;
      progress.style.width = '100%';
    }
  }

  function showSlide(index) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = (index + slides.length) % slides.length;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    
    startProgressBar(currentSlide);
    resetAutoplay();
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function resetAutoplay() {
    clearInterval(slideTimer);
    slideTimer = setInterval(nextSlide, slideIntervalTime);
  }

  // Bind controls
  nextBtn.addEventListener('click', nextSlide);
  prevBtn.addEventListener('click', prevSlide);

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      showSlide(index);
    });
  });

  // Start initialization
  startProgressBar(0);
  resetAutoplay();


  // --- Pricing Toggle System ---
  const billingCheckbox = document.getElementById('pricing-billing-checkbox');
  const monthlyLabel = document.getElementById('billing-monthly-lbl');
  const yearlyLabel = document.getElementById('billing-yearly-lbl');
  
  // Prices elements
  const priceStarter = document.getElementById('price-starter');
  const priceGrowth = document.getElementById('price-growth');
  const priceProfessional = document.getElementById('price-professional');

  const plansPrices = {
    starter: { monthly: 49, yearly: 39 },
    growth: { monthly: 99, yearly: 79 },
    professional: { monthly: 199, yearly: 159 }
  };

  billingCheckbox.addEventListener('change', () => {
    const isYearly = billingCheckbox.checked;
    
    if (isYearly) {
      monthlyLabel.classList.remove('active');
      yearlyLabel.classList.add('active');
      
      // Update values with fade effect
      updatePriceElement(priceStarter, plansPrices.starter.yearly, '/mo');
      updatePriceElement(priceGrowth, plansPrices.growth.yearly, '/mo');
      updatePriceElement(priceProfessional, plansPrices.professional.yearly, '/mo');
    } else {
      monthlyLabel.classList.add('active');
      yearlyLabel.classList.remove('active');
      
      updatePriceElement(priceStarter, plansPrices.starter.monthly, '/mo');
      updatePriceElement(priceGrowth, plansPrices.growth.monthly, '/mo');
      updatePriceElement(priceProfessional, plansPrices.professional.monthly, '/mo');
    }
  });

  function updatePriceElement(element, value, suffix) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      element.innerHTML = `<span>$${value}</span><span class="pricing-period">${suffix}</span>`;
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, 200);
  }


  // --- FAQ Accordion System ---
  const faqButtons = document.querySelectorAll('.faq-question-btn');

  faqButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.faq-card');
      const answerPanel = card.querySelector('.faq-answer-panel');
      const isOpen = card.classList.contains('open');

      // Close all other panels
      document.querySelectorAll('.faq-card').forEach(otherCard => {
        if (otherCard !== card) {
          otherCard.classList.remove('open');
          otherCard.querySelector('.faq-answer-panel').style.maxHeight = null;
          otherCard.querySelector('.faq-question-btn').setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        card.classList.remove('open');
        answerPanel.style.maxHeight = null;
        btn.setAttribute('aria-expanded', 'false');
      } else {
        card.classList.add('open');
        answerPanel.style.maxHeight = answerPanel.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });


  // --- Interactive Pointer Coordinates Glow (Mouse Move Glow) ---
  const productCards = document.querySelectorAll('.product-card');

  productCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
    });
  });


  // --- Intersection Observer for Scroll Reveals ---
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Trigger only once
      }
    });
  }, observerOptions);

  const revealElements = document.querySelectorAll('.reveal');
  revealElements.forEach(el => revealObserver.observe(el));


  // --- Contact Form Submission & Validation ---
  const contactForm = document.getElementById('contact-form');
  const successAlert = document.getElementById('form-success-alert');

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const fields = [
      { id: 'contact-name', errorId: 'error-contact-name', validator: val => val.trim().length > 0 },
      { id: 'contact-email', errorId: 'error-contact-email', validator: val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) },
      { id: 'contact-company', errorId: 'error-contact-company', validator: val => val.trim().length > 0 },
      { id: 'contact-service', errorId: 'error-contact-service', validator: val => val !== '' },
      { id: 'contact-message', errorId: 'error-contact-message', validator: val => val.trim().length > 0 }
    ];

    let isFormValid = true;

    fields.forEach(field => {
      const input = document.getElementById(field.id);
      const errorMsg = document.getElementById(field.errorId);
      const isValid = field.validator(input.value);

      if (isValid) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        errorMsg.style.display = 'none';
      } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        errorMsg.style.display = 'block';
        isFormValid = false;
      }
    });

    if (isFormValid) {
      // Hide error text
      fields.forEach(field => {
        const errorMsg = document.getElementById(field.errorId);
        errorMsg.style.display = 'none';
      });

      // Show success alert & disable button
      successAlert.style.display = 'block';
      const submitBtn = document.getElementById('btn-submit-contact');
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = 'Message Sent! <i class="lucide-check"></i>';
      
      // Simulate API submit delay and clear inputs
      setTimeout(() => {
        contactForm.reset();
        fields.forEach(field => {
          const input = document.getElementById(field.id);
          input.classList.remove('valid');
        });
        successAlert.style.display = 'none';
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = 'Send Message <i data-lucide="send"></i>';
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 5000);
    }
  });

  // Dynamic feedback on keyup/change
  const formInputs = contactForm.querySelectorAll('.form-input, .form-select, .form-textarea');
  formInputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid') && input.value.trim() !== '') {
        input.classList.remove('invalid');
        const field = input.getAttribute('id');
        const errorMsg = document.getElementById(`error-${field}`);
        if (errorMsg) errorMsg.style.display = 'none';
      }
    });
  });
});
