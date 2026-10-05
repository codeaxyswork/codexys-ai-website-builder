/**
 * AEGIS CREST - REDESIGNED PREMIUM INSURANCE CONTROLLER
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMetrics();
  initEcosystemMesh();
  initChooseGlowMatrix();
  initResourcesDashboard();
  initTradingCalculator();
  initTestimonialSlider();
  initFAQAccordion();
  initContactForm();
});

/* ========================================================================
   1. HEADER SCROLL & MOBILE MENU
======================================================================== */
function initHeader() {
  const header = document.querySelector('header');
  const mobileToggle = document.querySelector('.hamburger-mobile-toggle');
  const mobileMenu = document.querySelector('.mobile-overlay-menu');
  
  if (!mobileToggle || !mobileMenu) return;

  // Add scroll classes to header
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Toggle mobile navigation overlay
  mobileToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('opened');
    const isOpened = mobileMenu.classList.contains('opened');
    
    // Transform hamburger bars to 'X' shape
    const spans = mobileToggle.querySelectorAll('span');
    if (isOpened) {
      spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });

  // Handle dedicated close button in mobile menu overlay
  const mobileClose = document.getElementById('mobile-close-btn');
  if (mobileClose) {
    mobileClose.addEventListener('click', () => {
      mobileMenu.classList.remove('opened');
      const spans = mobileToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  }

  // Close overlay on nav links click
  const navLinks = mobileMenu.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('opened');
      const spans = mobileToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });
}

/* ========================================================================
   2. COUNT-UP METRIC ANIMATION (Overlapping Glass Panel)
======================================================================== */
function initMetrics() {
  const digits = document.querySelectorAll('.glass-metric-digit');
  
  const observerOptions = {
    threshold: 0.5,
    rootMargin: "0px 0px -50px 0px"
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const targetVal = parseFloat(target.getAttribute('data-value'));
        const prefix = target.getAttribute('data-prefix') || '';
        const suffix = target.getAttribute('data-suffix') || '';
        const decimals = parseInt(target.getAttribute('data-decimals') || '0');
        
        animateCount(target, targetVal, prefix, suffix, decimals);
        observer.unobserve(target);
      }
    });
  }, observerOptions);

  digits.forEach(digit => observer.observe(digit));

  function animateCount(element, targetValue, prefix, suffix, decimals) {
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();

    function updateNumber(currentTime) {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Ease out quad
      const easedProgress = progress * (2 - progress);
      const currentValue = start + (targetValue - start) * easedProgress;
      
      element.textContent = prefix + currentValue.toFixed(decimals) + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      } else {
        element.textContent = prefix + targetValue.toFixed(decimals) + suffix;
      }
    }

    requestAnimationFrame(updateNumber);
  }
}

/* ========================================================================
   3. ECOSYSTEM (Hover SVG Mesh Mappings)
======================================================================== */
function initEcosystemMesh() {
  const navBtns = document.querySelectorAll('.eco-nav-btn-item');
  const cards = document.querySelectorAll('.ecosystem-mesh-content-card');
  const meshLines = document.querySelectorAll('.ecosystem-bg-svg-pattern');

  navBtns.forEach(btn => {
    // Dynamic change on mouseenter for high-end feel, fallback to click
    btn.addEventListener('mouseenter', () => {
      activateTab(btn);
    });
    
    btn.addEventListener('click', () => {
      activateTab(btn);
    });
  });

  function activateTab(activeBtn) {
    const targetCategory = activeBtn.getAttribute('data-category');
    
    // Set active nav item
    navBtns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');

    // Set active panel content
    cards.forEach(card => {
      card.classList.remove('active');
      if (card.getAttribute('id') === `eco-mesh-${targetCategory}`) {
        card.classList.add('active');
      }
    });

    // Animate lines background opacity shifts based on category
    meshLines.forEach(line => {
      line.style.opacity = '0.03';
      if (line.getAttribute('data-mesh') === targetCategory) {
        line.style.opacity = '0.12';
      }
    });
  }
}

/* ========================================================================
   4. WHY CHOOSE US (Matrix Mouse Follow Glow)
======================================================================== */
function initChooseGlowMatrix() {
  const cells = document.querySelectorAll('.choose-matrix-cell');
  
  cells.forEach(cell => {
    cell.addEventListener('mousemove', (e) => {
      const rect = cell.getBoundingClientRect();
      // Calculate cursor coordinates relative to cell viewport
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      cell.style.setProperty('--mouse-x', `${x}px`);
      cell.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

/* ========================================================================
   5. CUSTOMER RESOURCES SIDEBAR MENU
======================================================================== */
function initResourcesDashboard() {
  const sidebarBtns = document.querySelectorAll('.resource-sidebar-btn');
  const panelCards = document.querySelectorAll('.resource-screen-panel-card');

  sidebarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      
      sidebarBtns.forEach(b => b.classList.remove('active'));
      panelCards.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetCard = document.getElementById(targetId);
      if (targetCard) targetCard.classList.add('active');
    });
  });
}

/* ========================================================================
   6. PREMIUM TRADING-STYLE CALCULATOR
======================================================================== */
function initTradingCalculator() {
  const coverageInput = document.getElementById('trade-calc-coverage');
  const coverageVal = document.getElementById('trade-calc-coverage-val');
  
  const termInput = document.getElementById('trade-calc-term');
  const termVal = document.getElementById('trade-calc-term-val');
  
  const categorySelect = document.getElementById('trade-calc-category');
  const terminalResult = document.getElementById('trade-calc-premium-result');

  if (!coverageInput || !termInput) return;

  function formatCurrency(value) {
    return '$' + parseInt(value).toLocaleString();
  }

  function updatePricing() {
    const coverage = parseInt(coverageInput.value);
    const term = parseInt(termInput.value);
    const category = categorySelect.value;

    coverageVal.textContent = formatCurrency(coverage);
    termVal.textContent = `${term} Years`;

    // Multiplier rates for premium dashboard
    let baseRate = 0.00042;
    if (category === 'life') baseRate = 0.00028;
    if (category === 'asset') baseRate = 0.00062;
    if (category === 'business') baseRate = 0.00082;
    if (category === 'wealth') baseRate = 0.00022;

    let annualPremium = coverage * baseRate;
    
    // Loyalty discount factor
    let discount = 1 - (term * 0.006); 
    if (discount < 0.82) discount = 0.82;

    let finalMonthlyPremium = (annualPremium * discount) / 12;

    animateTerminalValue(parseFloat(finalMonthlyPremium.toFixed(0)));
  }

  // Easing premium values
  let currentVal = 0;
  let calculationInterval;

  function animateTerminalValue(targetVal) {
    clearInterval(calculationInterval);
    const stepSpeed = 15;
    
    calculationInterval = setInterval(() => {
      const delta = targetVal - currentVal;
      if (Math.abs(delta) <= 1) {
        currentVal = targetVal;
        clearInterval(calculationInterval);
      } else {
        currentVal += delta / 4;
      }
      terminalResult.textContent = `$${Math.round(currentVal)}/mo`;
    }, stepSpeed);
  }

  coverageInput.addEventListener('input', updatePricing);
  termInput.addEventListener('input', updatePricing);
  categorySelect.addEventListener('change', updatePricing);

  // Initialize Calculator on load
  updatePricing();
}

/* ========================================================================
   7. REVIEWS & TESTIMONIAL SLIDER
======================================================================== */
function initTestimonialSlider() {
  const slides = document.querySelectorAll('.review-slide-full');
  const prevBtn = document.querySelector('.testimonial-prev-action');
  const nextBtn = document.querySelector('.testimonial-next-action');
  
  if (!slides.length) return;

  let activeIndex = 0;

  function goToSlide(index) {
    slides[activeIndex].classList.remove('active');
    activeIndex = (index + slides.length) % slides.length;
    slides[activeIndex].classList.add('active');
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      goToSlide(activeIndex + 1);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToSlide(activeIndex - 1);
    });
  }

  // Autoplay testimonials
  setInterval(() => {
    goToSlide(activeIndex + 1);
  }, 9000);
}

/* ========================================================================
   8. FAQ ACCORDION MODERNS
======================================================================== */
function initFAQAccordion() {
  const items = document.querySelectorAll('.faq-row-item');

  items.forEach(item => {
    const toggleBtn = item.querySelector('.faq-question-btn-row');
    
    toggleBtn.addEventListener('click', () => {
      const isCurrentlyActive = item.classList.contains('active');
      
      // Close all siblings
      items.forEach(it => it.classList.remove('active'));
      
      // If it wasn't open, open it
      if (!isCurrentlyActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ========================================================================
   9. CONTACT FORM LOGIC (Success Dialog Overlay Animation)
======================================================================== */
function initContactForm() {
  const form = document.querySelector('.contact-overhauled-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('form-name').value;
    const email = document.getElementById('form-email').value;
    const category = document.getElementById('form-category').value;
    
    // Create animated success dialog window matching deep dark palette
    const dialogWindow = document.createElement('div');
    dialogWindow.style.position = 'fixed';
    dialogWindow.style.top = '0';
    dialogWindow.style.left = '0';
    dialogWindow.style.width = '100%';
    dialogWindow.style.height = '100%';
    dialogWindow.style.backgroundColor = 'rgba(3, 7, 18, 0.98)';
    dialogWindow.style.zIndex = '2000';
    dialogWindow.style.display = 'flex';
    dialogWindow.style.flexDirection = 'column';
    dialogWindow.style.justifyContent = 'center';
    dialogWindow.style.alignItems = 'center';
    dialogWindow.style.color = 'white';
    dialogWindow.style.opacity = '0';
    dialogWindow.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    
    dialogWindow.innerHTML = `
      <div style="text-align: center; max-width: 540px; padding: 3rem; background: #050b18; border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; box-shadow: 0 30px 80px rgba(0,0,0,0.5);">
        <svg viewBox="0 0 24 24" width="70" height="70" fill="#00F0FF" style="margin-bottom: 2rem; filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.3));">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 2.8rem; font-weight: 700; margin-bottom: 1rem; color: #FFFFFF;">Request Logged</h2>
        <div style="width: 60px; height: 2px; background: linear-gradient(135deg, #00F0FF, #3B82F6); margin: 1.5rem auto;"></div>
        <p style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.05rem; color: #9CA3AF; line-height: 1.8;">
          Thank you, <strong>${name}</strong>. A senior risk analyst is reviewing your inquiry for <strong>${category.toUpperCase()} Coverage</strong>. We have sent confirmation details to <strong>${email}</strong>.
        </p>
        <button id="close-dialog-btn" class="btn-prism btn-prism-cyan" style="margin-top: 3rem; border-radius: 4px;">Return to Site</button>
      </div>
    `;
    
    document.body.appendChild(dialogWindow);
    
    // Trigger fade-in
    setTimeout(() => {
      dialogWindow.style.opacity = '1';
    }, 15);
    
    // Bind close
    document.getElementById('close-dialog-btn').addEventListener('click', () => {
      dialogWindow.style.opacity = '0';
      setTimeout(() => {
        dialogWindow.remove();
        form.reset();
      }, 600);
    });
  });
}
