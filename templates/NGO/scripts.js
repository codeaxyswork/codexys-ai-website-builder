/* ==========================================================================
   HopeRise Global Foundation - NGO & Charity Interactive JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initHeroSlider();
  initMobileMenu();
  initImpactCounters();

  // WhatsApp redirect for CTA buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .btn, .service-btn');
    if (btn) {
      if (
        btn.classList.contains('slider-arrow') || 
        btn.classList.contains('dot') || 
        btn.classList.contains('mobile-toggle') || 
        btn.classList.contains('tab-btn') || 
        btn.classList.contains('filter-btn') || 
        btn.classList.contains('region-btn') || 
        btn.classList.contains('modal-close') ||
        btn.innerHTML.includes('&times;') || 
        btn.innerHTML === '×' ||
        btn.closest('.modal-close')
      ) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      window.open('https://wa.me/919876543210', '_blank');
    }
  });
});

/* --- 1. HERO SLIDER CONTROLLER --- */
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-slide');
const dots = document.querySelectorAll('.dot');
let slideInterval = null;

function initHeroSlider() {
  if (slides.length === 0) return;
  startSlideTimer();
}

function showSlide(index) {
  slides.forEach(slide => slide.classList.remove('active'));
  dots.forEach(dot => dot.classList.remove('active'));

  currentSlide = (index + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  if (dots[currentSlide]) {
    dots[currentSlide].classList.add('active');
  }
}

function changeSlide(direction) {
  resetSlideTimer();
  showSlide(currentSlide + direction);
}

function goToSlide(index) {
  resetSlideTimer();
  showSlide(index);
}

function startSlideTimer() {
  slideInterval = setInterval(() => {
    showSlide(currentSlide + 1);
  }, 6000);
}

function resetSlideTimer() {
  clearInterval(slideInterval);
  startSlideTimer();
}

/* --- 2. MOBILE MENU & STICKY HEADER --- */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = toggleBtn.querySelector('i');
      if (navMenu.classList.contains('active')) {
        icon.className = 'ri-close-line';
      } else {
        icon.className = 'ri-menu-3-line';
      }
    });

    // Close menu when clicking nav link
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        toggleBtn.querySelector('i').className = 'ri-menu-3-line';
      });
    });
  }
}

/* --- 3. ANIMATED STATISTICS COUNTER --- */
function initImpactCounters() {
  const counters = document.querySelectorAll('.impact-number');
  if (counters.length === 0) return;

  let hasRun = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasRun) {
        hasRun = true;
        counters.forEach(counter => {
          const target = parseInt(counter.getAttribute('data-target'), 10);
          const duration = 2000; // 2 seconds
          const step = Math.ceil(target / (duration / 20));

          let current = 0;
          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            counter.innerText = current.toLocaleString() + '+';
          }, 20);
        });
      }
    });
  }, { threshold: 0.5 });

  const impactSection = document.getElementById('impact');
  if (impactSection) {
    observer.observe(impactSection);
  }
}

/* --- 4. MISSION/VISION TAB SWITCHING --- */
function switchTab(tabId, btnElement) {
  const tabs = document.querySelectorAll('.tab-content');
  const buttons = document.querySelectorAll('.tab-btn');

  tabs.forEach(tab => tab.classList.remove('active'));
  buttons.forEach(btn => btn.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  if (btnElement) {
    btnElement.classList.add('active');
  }
}

/* --- REGIONAL FILTER CONTROLLER --- */
function filterRegion(region, btnElement) {
  const cards = document.querySelectorAll('.cause-card');
  const buttons = document.querySelectorAll('.region-btn');

  buttons.forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  cards.forEach(card => {
    const cardRegion = card.getAttribute('data-region');
    if (region === 'all' || cardRegion === region) {
      card.style.display = 'flex';
      setTimeout(() => card.style.opacity = '1', 50);
    } else {
      card.style.opacity = '0';
      setTimeout(() => card.style.display = 'none', 300);
    }
  });
}

/* --- 5. FILTERABLE GALLERY --- */
function filterGallery(category, btnElement) {
  const items = document.querySelectorAll('.gallery-item');
  const buttons = document.querySelectorAll('.filter-btn');


  buttons.forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  items.forEach(item => {
    const itemCat = item.getAttribute('data-category');
    if (category === 'all' || itemCat === category) {
      item.style.display = 'block';
      setTimeout(() => item.style.opacity = '1', 50);
    } else {
      item.style.opacity = '0';
      setTimeout(() => item.style.display = 'none', 300);
    }
  });
}

/* --- 6. QUICK DONATION CALCULATOR WIDGET --- */
function selectPreset(amount, btnElement) {
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const customInput = document.getElementById('custom-amount');
  if (customInput) {
    customInput.value = amount;
    updateImpactText(amount);
  }
}

function updateImpactText(amount) {
  const impactDesc = document.getElementById('impact-description');
  if (!impactDesc) return;

  const num = parseInt(amount, 10) || 0;

  if (num < 25) {
    impactDesc.innerHTML = `<i class="ri-information-fill"></i> $${num} provides essential clean water supplies and hygiene kits for 1 family.`;
  } else if (num < 50) {
    impactDesc.innerHTML = `<i class="ri-information-fill"></i> $${num} provides 1 month of nutritious daily meals for a child.`;
  } else if (num < 100) {
    impactDesc.innerHTML = `<i class="ri-information-fill"></i> $${num} provides 1 full month of clean water & nutrition for 2 children.`;
  } else if (num < 250) {
    impactDesc.innerHTML = `<i class="ri-information-fill"></i> $${num} sponsors 1 full semester of school fees, books, & uniforms.`;
  } else {
    impactDesc.innerHTML = `<i class="ri-information-fill"></i> $${num} installs solar borehole clean water pumps for an entire village.`;
  }
}

function processQuickDonation() {
  const customInput = document.getElementById('custom-amount');
  const amount = customInput ? customInput.value : '50';
  showToast(`Thank you! Your donation of $${amount} has been processed.`);
}

/* --- 7. MODALS & TOAST HANDLERS --- */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function openDonateModal(causeName) {
  const title = document.getElementById('modal-cause-title');
  if (title) {
    title.innerText = `Donate to: ${causeName}`;
  }
  openModal('donate-modal');
}

function openLightbox(imgUrl, caption) {
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCap = document.getElementById('lightbox-caption');

  if (lightboxImg) lightboxImg.src = imgUrl;
  if (lightboxCap) lightboxCap.innerText = caption;

  openModal('lightbox-modal');
}

function handleModalDonation(e) {
  e.preventDefault();
  closeModal('donate-modal');
  showToast('Donation successful! A receipt has been sent to your email.');
}

function handleFormSubmission(e, successMsg) {
  e.preventDefault();
  const form = e.target;
  form.reset();
  const modal = form.closest('.modal-overlay');
  if (modal) {
    closeModal(modal.id);
  }
  showToast(successMsg);
}

function handleContactSubmit(e) {
  e.preventDefault();
  e.target.reset();
  showToast('Message sent! Our support team will get back to you shortly.');
}

function handleNewsletter(e) {
  e.preventDefault();
  e.target.reset();
  showToast('Thank you for subscribing to the HopeRise Newsletter!');
}

/* Toast System */
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');

  if (toast && toastMsg) {
    toastMsg.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
}

// Close modals when clicking overlay background
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
