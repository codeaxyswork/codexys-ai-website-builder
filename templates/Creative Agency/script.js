/* ==========================================================================
   AETERNA CREATIVE AGENCY - INTERACTION LOGIC & ANIMATIONS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // 1. LENIS SMOOTH INERTIA SCROLL SYSTEM
    // ==========================================================================
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // inertia ease
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);


    // ==========================================================================
    // 2. CUSTOM CURSOR TRACKER
    // ==========================================================================
    const cursor = document.getElementById('cursor');
    const cursorDot = document.querySelector('.custom-cursor-dot');
    const cursorCircle = document.querySelector('.custom-cursor-circle');
    
    let mouseX = 0, mouseY = 0;
    let circleX = 0, circleY = 0;
    
    // Hide default cursor (done via CSS, but check tracker visibility)
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Dot follows cursor instantly
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
    });
    
    // Lagging follower circle animation
    function animateCursor() {
        circleX += (mouseX - circleX) * 0.15;
        circleY += (mouseY - circleY) * 0.15;
        
        cursorCircle.style.left = `${circleX}px`;
        cursorCircle.style.top = `${circleY}px`;
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Mouse pointer enter/leave states for interactive elements
    const interactives = document.querySelectorAll('a, button, .portfolio-card, .service-card, .faq-trigger, .opening-item, .filter-btn');
    interactives.forEach(el => {
        el.addEventListener('mouseenter', () => {
            document.body.classList.add('hover-interactive');
        });
        el.addEventListener('mouseleave', () => {
            document.body.classList.remove('hover-interactive');
        });
    });

    // Special Drag State for Testimonial Slider
    const testimonialSlider = document.getElementById('testimonial-slider-box');
    if (testimonialSlider) {
        testimonialSlider.addEventListener('mouseenter', () => {
            document.body.classList.add('hover-slider');
        });
        testimonialSlider.addEventListener('mouseleave', () => {
            document.body.classList.remove('hover-slider');
        });
    }


    // ==========================================================================
    // 3. MAGNETIC BUTTONS SYSTEM
    // ==========================================================================
    const magneticBtns = document.querySelectorAll('.btn-magnetic');
    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Translate outer boundary
            btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px)`;
            
            // Translate inner text/icon (gives subtle parallax feeling)
            const innerText = btn.querySelector('span') || btn.querySelector('i');
            if (innerText) {
                innerText.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
            const innerText = btn.querySelector('span') || btn.querySelector('i');
            if (innerText) {
                innerText.style.transform = 'translate(0px, 0px)';
            }
        });
    });


    // ==========================================================================
    // 4. HEADER STICKY & ACTIVE LINK OBSERVER
    // ==========================================================================
    const header = document.getElementById('main-header');
    
    // Header Glassmorphism on Scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }
    });

    // Scroll Progress bar percentage
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        document.getElementById('scroll-progress').style.width = scrolled + '%';
    });

    // Active Link Menu Highlighting corresponding to visible section
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const observerOptions = {
        root: null,
        rootMargin: '-30% 0px -60% 0px', // high contrast center trigger
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const activeId = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${activeId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));


    // ==========================================================================
    // 5. MOBILE HAMBURGER NAVIGATION
    // ==========================================================================
    const hamburger = document.getElementById('hamburger-btn');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    function toggleMobileNav() {
        const isOpened = hamburger.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        
        if (isOpened) {
            mobileOverlay.setAttribute('aria-hidden', 'false');
            hamburger.setAttribute('aria-expanded', 'true');
            lenis.stop(); // stop scrolling behind overlay
            
            // GSAP slide in links
            gsap.fromTo('.mobile-nav-link', 
                { opacity: 0, x: -30 }, 
                { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out', delay: 0.2 }
            );
        } else {
            mobileOverlay.setAttribute('aria-hidden', 'true');
            hamburger.setAttribute('aria-expanded', 'false');
            lenis.start();
        }
    }

    hamburger.addEventListener('click', toggleMobileNav);
    // Smooth scroll navigation anchors using Lenis scrollTo
    const smoothLinks = document.querySelectorAll('a[href^="#"]');
    smoothLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                
                // Close mobile menu if clicked from mobile links
                if (link.classList.contains('mobile-nav-link')) {
                    toggleMobileNav();
                }
                
                // Trigger smooth scroll via Lenis scrollTo API
                lenis.scrollTo(targetElement, {
                    offset: 0,
                    duration: 1.2
                });
            }
        });
    });


    // ==========================================================================
    // 6. GSAP ANIMATIONS & SCROLLTRIGGER
    // ==========================================================================
    
    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Dynamic Text Reveal Utility (splites text by words to wrap inside spans)
    const textRevealElements = document.querySelectorAll('.text-reveal');
    textRevealElements.forEach(element => {
        const text = element.textContent.trim();
        element.innerHTML = '';
        
        const words = text.split(/\s+/);
        words.forEach((word, idx) => {
            const wordWrapper = document.createElement('span');
            wordWrapper.style.display = 'inline-block';
            wordWrapper.style.overflow = 'hidden';
            wordWrapper.style.verticalAlign = 'bottom';
            
            const wordInner = document.createElement('span');
            wordInner.textContent = word + '\u00A0'; // non-breaking space
            
            // Highlight specific words (& Digital Products) in solid neon lime green
            const isHighlight = [6, 7, 8].includes(idx);
            wordInner.className = isHighlight ? 'reveal-word-inner text-highlight' : 'reveal-word-inner';
            
            wordInner.style.display = 'inline-block';
            wordInner.style.transform = 'translateY(100%)';
            wordInner.style.willChange = 'transform';
            
            wordWrapper.appendChild(wordInner);
            element.appendChild(wordWrapper);
        });
    });

    // Hero Reveal Entry Sequence
    const heroTl = gsap.timeline();
    
    // Scale and fade in the hero background visual first
    heroTl.from('.hero-bg-parallax', {
        scale: 1.2,
        opacity: 0,
        duration: 2.2,
        ease: 'power3.out'
    }, 0);
    
    heroTl.to('.reveal-word-inner', {
        y: '0%',
        duration: 1.2,
        stagger: 0.04,
        ease: 'power4.out'
    }, 0.2);
    
    heroTl.from('.reveal-item', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
    }, '-=0.8');

    // Interactive Mouse Move Parallax on Hero Image
    const heroSection = document.querySelector('.hero-section');
    const heroImage = document.querySelector('.hero-bg-parallax');
    if (heroSection && heroImage) {
        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const mouseX = e.clientX - rect.left - width / 2;
            const mouseY = e.clientY - rect.top - height / 2;
            
            // Subtle 3D shift bounds (max 35px translation)
            const xShift = (mouseX / width) * -35;
            const yShift = (mouseY / height) * -35;
            
            gsap.to(heroImage, {
                x: xShift,
                y: yShift,
                duration: 1.2,
                ease: 'power2.out',
                overwrite: 'auto'
            });
        });
        
        // Return image to base layout positions when cursor departs
        heroSection.addEventListener('mouseleave', () => {
            gsap.to(heroImage, {
                x: 0,
                y: 0,
                duration: 1.8,
                ease: 'power2.out'
            });
        });
    }

    // Hero Image Parallax scroll trigger
    gsap.to('.hero-bg-parallax', {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
            trigger: '#home',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    // Section reveal elements (using native IntersectionObserver for robust visibility)
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // trigger animation only once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // Observe all scroll reveal containers
    document.querySelectorAll('.scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-up, .scroll-reveal-card').forEach(el => {
        revealObserver.observe(el);
    });

    // Inject staggered delays dynamically on grid cards to support elegant loading sequences
    const staggerGrids = ['.services-grid', '.team-grid', '.portfolio-grid', '.openings-list'];
    staggerGrids.forEach(gridQuery => {
        const grid = document.querySelector(gridQuery);
        if (grid) {
            const cards = grid.querySelectorAll('.scroll-reveal-card');
            cards.forEach((card, idx) => {
                card.style.transitionDelay = `${idx * 0.1}s`;
            });
        }
    });

    // Counters count-up numbers trigger
    const counters = document.querySelectorAll('.counter-number');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'), 10);
        
        gsap.fromTo(counter, 
            { textContent: 0 }, 
            {
                textContent: target,
                duration: 2.2,
                ease: 'power2.out',
                snap: { textContent: 1 },
                modifiers: {
                    textContent: value => Math.floor(value) + (target > 99 ? '+' : '+')
                },
                scrollTrigger: {
                    trigger: counter,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });


    // ==========================================================================
    // 7. PORTFOLIO FILTER & LIGHTBOX GALLERY SYSTEM
    // ==========================================================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    const portfolioMasonry = document.getElementById('portfolio-masonry');

    // Portfolio category filtering
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active pill styling
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filterValue = btn.getAttribute('data-filter');

            // Animate layout changes using GSAP scale + opacity
            portfolioItems.forEach(item => {
                const matches = filterValue === 'all' || item.classList.contains(filterValue);
                
                if (matches) {
                    item.classList.remove('hidden');
                    gsap.fromTo(item, 
                        { scale: 0.8, opacity: 0 },
                        { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }
                    );
                } else {
                    gsap.to(item, {
                        scale: 0.8,
                        opacity: 0,
                        duration: 0.4,
                        ease: 'power2.in',
                        onComplete: () => {
                            item.classList.add('hidden');
                        }
                    });
                }
            });
            
            // Re-trigger ScrollTrigger to update layouts
            setTimeout(() => {
                ScrollTrigger.refresh();
            }, 550);
        });
    });

    // Lightbox Gallery Setup
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const lightboxClose = document.getElementById('lightbox-close-btn');
    const lightboxPrev = document.getElementById('lightbox-prev-btn');
    const lightboxNext = document.getElementById('lightbox-next-btn');

    let currentGalleryIndex = 0;
    const lightboxItems = Array.from(document.querySelectorAll('.btn-lightbox'));

    function openLightbox(index) {
        currentGalleryIndex = index;
        const trigger = lightboxItems[index];
        const imgSrc = trigger.getAttribute('data-img');
        const titleStr = trigger.getAttribute('data-title');
        const descStr = trigger.getAttribute('data-desc');

        lightboxImg.src = imgSrc;
        lightboxTitle.textContent = titleStr;
        lightboxDesc.textContent = descStr;

        lightboxModal.classList.add('active');
        lightboxModal.setAttribute('aria-hidden', 'false');
        lenis.stop(); // pause smooth scrolling

        // Zoom image sequence
        gsap.fromTo('.lightbox-image-container', 
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' }
        );
        gsap.fromTo('.lightbox-details',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', delay: 0.1 }
        );
    }

    function closeLightbox() {
        lightboxModal.classList.remove('active');
        lightboxModal.setAttribute('aria-hidden', 'true');
        lenis.start(); // resume scrolling
    }

    function showNextLightbox() {
        let nextIndex = currentGalleryIndex + 1;
        if (nextIndex >= lightboxItems.length) nextIndex = 0;
        openLightbox(nextIndex);
    }

    function showPrevLightbox() {
        let prevIndex = currentGalleryIndex - 1;
        if (prevIndex < 0) prevIndex = lightboxItems.length - 1;
        openLightbox(prevIndex);
    }

    lightboxItems.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            openLightbox(idx);
        });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxNext) lightboxNext.addEventListener('click', showNextLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', showPrevLightbox);

    // Close lightbox on backdrop click
    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                closeLightbox();
            }
        });
    }

    // Keyboard navigation support for lightbox
    document.addEventListener('keydown', (e) => {
        if (lightboxModal && lightboxModal.classList.contains('active')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') showNextLightbox();
            if (e.key === 'ArrowLeft') showPrevLightbox();
        }
    });


    // ==========================================================================
    // 8. TESTIMONIAL SLIDER FUNCTIONALITY
    // ==========================================================================
    const slides = document.querySelectorAll('.testimonial-slide');
    const prevBtn = document.getElementById('testimonial-prev-btn');
    const nextBtn = document.getElementById('testimonial-next-btn');
    const indicators = document.querySelectorAll('#testimonial-indicators .indicator');
    
    let currentSlide = 0;
    let slideInterval;
    const intervalTime = 6000; // 6 seconds auto cycle

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(ind => ind.classList.remove('active'));
        
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
        
        // Slide reveal animation
        const activeSlideContent = slides[index].querySelectorAll('.testimonial-text, .client-meta, .quote-icon');
        gsap.fromTo(activeSlideContent, 
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
        );
        
        currentSlide = index;
    }

    function nextSlide() {
        let index = currentSlide + 1;
        if (index >= slides.length) index = 0;
        showSlide(index);
    }

    function prevSlide() {
        let index = currentSlide - 1;
        if (index < 0) index = slides.length - 1;
        showSlide(index);
    }

    function startAutoPlay() {
        slideInterval = setInterval(nextSlide, intervalTime);
    }

    function resetAutoPlay() {
        clearInterval(slideInterval);
        startAutoPlay();
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetAutoPlay();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetAutoPlay();
        });
    }

    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            showSlide(index);
            resetAutoPlay();
        });
    });

    // Start auto slide carousel
    if (slides.length > 0) {
        startAutoPlay();
    }


    // ==========================================================================
    // 9. FAQ ACCORDION COMPONENT
    // ==========================================================================
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    
    faqTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const faqItem = trigger.parentElement;
            const panel = faqItem.querySelector('.faq-panel');
            const isOpened = faqItem.classList.contains('active');
            
            // Close all other panels for clean accordian behavior
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
                item.querySelector('.faq-panel').style.maxHeight = null;
                item.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
            });
            
            if (!isOpened) {
                faqItem.classList.add('active');
                // Calculate dynamic panel scrollHeight for smooth transition
                panel.style.maxHeight = panel.scrollHeight + 'px';
                trigger.setAttribute('aria-expanded', 'true');
            }
            
            // Re-trigger scroll positions since sizes shift
            setTimeout(() => {
                ScrollTrigger.refresh();
            }, 450);
        });
    });


    // ==========================================================================
    // 10. CONTACT FORM VALIDATION & INTERACTION
    // ==========================================================================
    const form = document.getElementById('contact-form');
    const budgetSlider = document.getElementById('form-budget');
    const budgetValue = document.getElementById('budget-value');
    const successBanner = document.getElementById('form-success');

    // Update Slider text representation
    if (budgetSlider && budgetValue) {
        budgetSlider.addEventListener('input', () => {
            const val = parseInt(budgetSlider.value, 10);
            if (val === 100000) {
                budgetValue.textContent = '$100,000+';
            } else {
                budgetValue.textContent = `$${val.toLocaleString()}`;
            }
        });
    }

    // Dynamic field validation on loss-of-focus
    const inputsToValidate = form ? form.querySelectorAll('[required]') : [];
    inputsToValidate.forEach(input => {
        input.addEventListener('blur', () => {
            validateField(input);
        });
        
        input.addEventListener('input', () => {
            if (input.parentElement.classList.contains('invalid')) {
                validateField(input);
            }
        });
    });

    function validateField(input) {
        const group = input.parentElement;
        let isValid = true;
        
        if (input.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(input.value.trim());
        } else {
            isValid = input.value.trim() !== '';
        }
        
        if (isValid) {
            group.classList.remove('invalid');
        } else {
            group.classList.add('invalid');
        }
        
        return isValid;
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isFormValid = true;
            
            // Validate all required inputs
            inputsToValidate.forEach(input => {
                const isFieldValid = validateField(input);
                if (!isFieldValid) {
                    isFormValid = false;
                }
            });
            
            if (isFormValid) {
                const submitBtn = document.getElementById('form-submit-btn');
                const originalText = submitBtn.innerHTML;
                
                // Show Sending state
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending Scope... <i class="fa-solid fa-spinner fa-spin"></i></span>';
                
                // Emulate client API transmission
                setTimeout(() => {
                    // Reset Button
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    
                    // Activate Success dialogues
                    successBanner.classList.add('active');
                    
                    // Clear inputs
                    form.reset();
                    if (budgetValue && budgetSlider) {
                        budgetValue.textContent = '$50,000';
                        budgetSlider.value = 50000;
                    }
                    
                    // Auto-hide success overlay in 6 seconds
                    setTimeout(() => {
                        successBanner.classList.remove('active');
                    }, 6000);
                    
                }, 1800);
            }
        });
    }


    // ==========================================================================
    // 11. FOOTER SCROLL TO TOP
    // ==========================================================================
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            lenis.scrollTo('#home', { duration: 1.5 });
        });
    }

    // Refresh ScrollTrigger after all resources/images are loaded to fix layout shift
    window.addEventListener('load', () => {
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 200);
    });

});
