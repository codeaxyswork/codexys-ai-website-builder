document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. Sticky Header & Active Navigation Link Highlight
       ========================================================================== */
    const header = document.getElementById('main-header');
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        // Sticky header class toggle
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Active link tracking
        let currentSectionId = '';
        sections.forEach(sec => {
            const secTop = sec.offsetTop - 120;
            const secHeight = sec.clientHeight;
            if (window.scrollY >= secTop && window.scrollY < secTop + secHeight) {
                currentSectionId = sec.getAttribute('id');
            }
        });

        if (currentSectionId) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentSectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });

    /* ==========================================================================
       2. Mobile Hamburger Menu Toggle
       ========================================================================== */
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !isExpanded);
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when a link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    /* ==========================================================================
       3. Hero Slider Logic
       ========================================================================== */
    const slides = document.querySelectorAll('.hero-slide');
    const btnPrev = document.getElementById('slider-prev');
    const btnNext = document.getElementById('slider-next');
    const dotsContainer = document.getElementById('slider-dots');
    
    let currentSlide = 0;
    let sliderInterval;
    const slideDuration = 6000; // 6s per slide

    if (slides.length > 0) {
        // Generate dot elements
        slides.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.classList.add('slider-dot');
            if (idx === 0) dot.classList.add('active');
            dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
            dot.addEventListener('click', () => goToSlide(idx));
            dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.slider-dot');

        function updateSlideClasses() {
            slides.forEach((slide, idx) => {
                slide.classList.remove('active');
                if (dots[idx]) dots[idx].classList.remove('active');
            });
            slides[currentSlide].classList.add('active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('active');
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % slides.length;
            updateSlideClasses();
        }

        function prevSlide() {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            updateSlideClasses();
        }

        function goToSlide(idx) {
            currentSlide = idx;
            updateSlideClasses();
            resetSliderTimer();
        }

        function startSliderTimer() {
            sliderInterval = setInterval(nextSlide, slideDuration);
        }

        function resetSliderTimer() {
            clearInterval(sliderInterval);
            startSliderTimer();
        }

        // Action bindings
        if (btnNext) btnNext.addEventListener('click', () => { nextSlide(); resetSliderTimer(); });
        if (btnPrev) btnPrev.addEventListener('click', () => { prevSlide(); resetSliderTimer(); });

        // Initialize Slider Timer
        startSliderTimer();
    }

    /* ==========================================================================
       4. Count-up Stats Animation (Intersection Observer)
       ========================================================================== */
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsSection = document.querySelector('.about-stats-container');
    let countersInitiated = false;

    function countUp(element) {
        const target = parseInt(element.getAttribute('data-target'), 10);
        const duration = 2000; // 2 seconds
        const stepTime = 30; // Milliseconds per frame
        const steps = Math.ceil(duration / stepTime);
        const increment = target / steps;
        let current = 0;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += increment;
            if (step >= steps) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, stepTime);
    }

    if (statNumbers.length > 0 && statsSection) {
        const observerOptions = {
            root: null,
            threshold: 0.15
        };

        const statsObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !countersInitiated) {
                    countersInitiated = true;
                    statNumbers.forEach(num => countUp(num));
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        statsObserver.observe(statsSection);
    }

    /* ==========================================================================
       5. Testimonial Carousel sliding track logic
       ========================================================================== */
    const track = document.getElementById('carousel-track');
    const cSlides = document.querySelectorAll('.carousel-slide');
    const cPrev = document.getElementById('carousel-prev');
    const cNext = document.getElementById('carousel-next');
    const cDotsContainer = document.getElementById('carousel-dots');
    
    let activeCarouselSlide = 0;
    let carouselInterval;
    const carouselDuration = 7000; // 7 seconds

    if (track && cSlides.length > 0) {
        // Generate testimonial navigation dots
        cSlides.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.classList.add('carousel-dot');
            if (idx === 0) dot.classList.add('active');
            dot.setAttribute('aria-label', `Go to testimonial ${idx + 1}`);
            dot.addEventListener('click', () => goToCarouselSlide(idx));
            cDotsContainer.appendChild(dot);
        });

        const cDots = document.querySelectorAll('.carousel-dot');

        function updateCarousel() {
            track.style.transform = `translateX(-${activeCarouselSlide * 100}%)`;
            cDots.forEach((dot, idx) => {
                dot.classList.remove('active');
                if (idx === activeCarouselSlide) dot.classList.add('active');
            });
        }

        function nextCarouselSlide() {
            activeCarouselSlide = (activeCarouselSlide + 1) % cSlides.length;
            updateCarousel();
        }

        function prevCarouselSlide() {
            activeCarouselSlide = (activeCarouselSlide - 1 + cSlides.length) % cSlides.length;
            updateCarousel();
        }

        function goToCarouselSlide(idx) {
            activeCarouselSlide = idx;
            updateCarousel();
            resetCarouselTimer();
        }

        function startCarouselTimer() {
            carouselInterval = setInterval(nextCarouselSlide, carouselDuration);
        }

        function resetCarouselTimer() {
            clearInterval(carouselInterval);
            startCarouselTimer();
        }

        if (cNext) cNext.addEventListener('click', () => { nextCarouselSlide(); resetCarouselTimer(); });
        if (cPrev) cPrev.addEventListener('click', () => { prevCarouselSlide(); resetCarouselTimer(); });

        startCarouselTimer();

        // Optional responsive track width recalculation
        window.addEventListener('resize', updateCarousel);
    }

    /* ==========================================================================
       6. FAQ Accordion Heights & Transitions
       ========================================================================== */
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const body = item.querySelector('.accordion-body');
            const isOpen = item.classList.contains('active');

            // Close all items
            document.querySelectorAll('.accordion-item').forEach(accItem => {
                accItem.classList.remove('active');
                accItem.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
                accItem.querySelector('.accordion-body').style.maxHeight = '0';
                accItem.querySelector('.accordion-body').setAttribute('aria-hidden', 'true');
            });

            // Open selected item if it wasn't already open
            if (!isOpen) {
                item.classList.add('active');
                header.setAttribute('aria-expanded', 'true');
                body.style.maxHeight = body.scrollHeight + 'px';
                body.setAttribute('aria-hidden', 'false');
            }
        });
    });

    /* ==========================================================================
       7. Scroll Reveal Trigger Observer
       ========================================================================== */
    const reveals = document.querySelectorAll('.reveal');

    if (reveals.length > 0) {
        const revealObserverOptions = {
            root: null,
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px' // Trigger slightly before element enters view fully
        };

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, revealObserverOptions);

        reveals.forEach(rev => revealObserver.observe(rev));
    }

    /* ==========================================================================
       8. Consultation Contact Form Handle (Simulated Ajax feedback)
       ========================================================================== */
    const contactForm = document.getElementById('consultation-form');
    const feedbackBox = document.getElementById('form-feedback');
    const submitBtn = document.getElementById('submit-btn');

    if (contactForm && feedbackBox) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Visual loading state
            submitBtn.textContent = 'Sending Request...';
            submitBtn.disabled = true;

            // Simulate server network latency
            setTimeout(() => {
                // Success visual state toggle
                submitBtn.textContent = 'Request Consultation';
                submitBtn.disabled = false;
                
                feedbackBox.classList.remove('hide');
                contactForm.reset();

                // Smooth scroll to feedback message if needed
                feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Reset feedback visibility after 8 seconds
                setTimeout(() => {
                    feedbackBox.classList.add('hide');
                }, 8000);

            }, 1500);
        });
    }

});
