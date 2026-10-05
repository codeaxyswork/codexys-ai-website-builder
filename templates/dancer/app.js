document.addEventListener('DOMContentLoaded', () => {
    // 1. Header scroll state
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });

    // 2. Hamburger menu — right-side drawer
    const hamburger   = document.getElementById('hamburger');
    const navDrawer   = document.getElementById('navDrawer');
    const navBackdrop = document.getElementById('navBackdrop');
    const navClose    = document.getElementById('navClose');
    const drawerLinks = document.querySelectorAll('.drawer-link');

    function openMenu() {
        hamburger.classList.add('is-open');
        navDrawer.classList.add('is-open');
        navBackdrop.classList.add('is-open');
        hamburger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        hamburger.classList.remove('is-open');
        navDrawer.classList.remove('is-open');
        navBackdrop.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
        hamburger.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    navClose.addEventListener('click', closeMenu);
    navBackdrop.addEventListener('click', closeMenu);
    drawerLinks.forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    // 3. Scroll to top button
    const scrollTopBtn = document.getElementById('scrollTop');
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 4. Testimonials Section — Simple vertical navigation with active slide transitions
    (function() {
        const slides = document.querySelectorAll('.testimonial-slide');
        const navItems = document.querySelectorAll('.testimonial-nav-item');
        if (slides.length === 0 || navItems.length === 0) return;

        let activeIdx = 0;
        let timer;

        function showSlide(idx) {
            slides.forEach((slide, i) => {
                if (i === idx) {
                    slide.classList.add('active');
                } else {
                    slide.classList.remove('active');
                }
            });

            navItems.forEach((item, i) => {
                if (i === idx) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            activeIdx = idx;
        }

        // Add click events to numbers navigation
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-idx'));
                showSlide(idx);
                resetTimer();
            });
        });

        // Auto-play timer
        function startTimer() {
            timer = setInterval(() => {
                let nextIdx = (activeIdx + 1) % slides.length;
                showSlide(nextIdx);
            }, 5000);
        }

        function resetTimer() {
            clearInterval(timer);
            startTimer();
        }

        // Initialize
        showSlide(0);
        startTimer();

        // Pause on hover
        const container = document.querySelector('.testimonial-container');
        if (container) {
            container.addEventListener('mouseenter', () => clearInterval(timer));
            container.addEventListener('mouseleave', startTimer);
        }
    })();


    // Gallery Carousel Logic
    const galleryTrack = document.getElementById('galleryTrack');
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');
    const galleryDots = document.querySelectorAll('.gallery-dot');

    if (galleryTrack && galleryPrev && galleryNext) {
        const slides = galleryTrack.querySelectorAll('.gallery-carousel-slide');
        const total = slides.length;
        let currentIdx = 0;

        function updateCarousel() {
            const slideWidth = slides[0].offsetWidth;
            galleryTrack.style.transform = `translateX(-${currentIdx * slideWidth}px)`;

            // Arrow state
            galleryPrev.style.opacity = currentIdx === 0 ? '0.3' : '1';
            galleryPrev.style.pointerEvents = currentIdx === 0 ? 'none' : 'auto';
            
            galleryNext.style.opacity = currentIdx >= total - 1 ? '0.3' : '1';
            galleryNext.style.pointerEvents = currentIdx >= total - 1 ? 'none' : 'auto';

            // Sync dots
            galleryDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIdx);
            });
        }

        galleryNext.addEventListener('click', () => {
            if (currentIdx < total - 1) {
                currentIdx++;
                updateCarousel();
            }
        });

        galleryPrev.addEventListener('click', () => {
            if (currentIdx > 0) {
                currentIdx--;
                updateCarousel();
            }
        });

        galleryDots.forEach(dot => {
            dot.addEventListener('click', () => {
                currentIdx = parseInt(dot.dataset.idx);
                updateCarousel();
            });
        });

        // Initialize
        updateCarousel();
        window.addEventListener('resize', updateCarousel);
        window.addEventListener('load', updateCarousel);
    }

    // Dance Styles Slider Logic
    const stylesSection = document.getElementById('styles');
    const stylesSlides = document.querySelectorAll('.styles-slide');
    const stylesNavDots = document.querySelectorAll('.styles-nav-dot');
    const stylesBgColors = [
        '#151211', // Classical: Deep warm charcoal
        '#0f1113', // Contemporary: Deep slate blue
        '#110e13', // Neoclassical: Deep warm violet/plum
        '#0f1311'  // Choreography: Deep stage forest green
    ];
    
    if (stylesSlides.length > 0 && stylesNavDots.length > 0) {
        stylesNavDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const targetIdx = parseInt(dot.getAttribute('data-go'));
                
                // Transition background color to match style mood
                if (stylesSection) {
                    stylesSection.style.backgroundColor = stylesBgColors[targetIdx];
                }
                
                // Toggle active dots across all slides in sync
                stylesNavDots.forEach(d => {
                    if (parseInt(d.getAttribute('data-go')) === targetIdx) {
                        d.classList.add('active');
                    } else {
                        d.classList.remove('active');
                    }
                });
                
                // Toggle active slides
                stylesSlides.forEach((slide, idx) => {
                    if (idx === targetIdx) {
                        slide.classList.add('active');
                    } else {
                        slide.classList.remove('active');
                    }
                });
            });
        });
    }

    // 4. Scroll Reveal Animations
    const reveals = document.querySelectorAll('.reveal');
    
    const revealOnScroll = () => {
        reveals.forEach(reveal => {
            const windowHeight = window.innerHeight;
            const elementTop = reveal.getBoundingClientRect().top;
            const elementVisible = 150; // Trigger threshold
            
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };
    
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Initial run to reveal elements already in viewport

    // 5. Image Lightbox for Gallery
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.querySelector('.lightbox');
    const lightboxImg = document.querySelector('.lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');
    
    if (galleryItems.length > 0 && lightbox && lightboxImg && lightboxClose) {
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                const imgSrc = item.querySelector('img').getAttribute('src');
                lightboxImg.setAttribute('src', imgSrc);
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden'; // Disable page scrolling
            });
        });
        
        lightboxClose.addEventListener('click', () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = 'auto'; // Re-enable page scrolling
        });
        
        // Close lightbox on click outside the image
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                lightbox.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    }

    // 6. Testimonials Slider
    const slides = document.querySelectorAll('.testimonial-slide');
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;
    let slideInterval;
    
    const showSlide = (index) => {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;
    };
    
    const nextSlide = () => {
        let index = currentSlide + 1;
        if (index >= slides.length) {
            index = 0;
        }
        showSlide(index);
    };
    
    if (slides.length > 0 && dots.length > 0) {
        // Initialize testimonial slider
        showSlide(0);
        
        // Auto slide every 5 seconds
        slideInterval = setInterval(nextSlide, 5000);
        
        // Add click events to navigation dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                clearInterval(slideInterval); // Reset timer
                showSlide(index);
                slideInterval = setInterval(nextSlide, 5000); // Restart timer
            });
        });
    }
    
    // 7. Video performances visual click (Mock video play overlay)
    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.querySelector('.video-title-bar h3').innerText;
            alert(`Opening performance video for "${title}"...\n(In production, this would initialize a HTML5 video player or load an iframe)`);
        });
    });

    // 8. Hero Carousel/Slider
    const heroSlides = document.querySelectorAll('.hero-slide');
    const heroDots = document.querySelectorAll('.hero-dot');
    let currentHeroSlide = 0;
    let heroInterval;

    const showHeroSlide = (index) => {
        const currentActive = document.querySelector('.hero-slide.active');
        if (currentActive) {
            currentActive.classList.remove('active');
            currentActive.classList.add('outgoing');
            
            // Remove outgoing class after transition completes
            setTimeout(() => {
                currentActive.classList.remove('outgoing');
            }, 1200);
        }

        // Clean outgoing class from other slides
        heroSlides.forEach((slide, idx) => {
            if (idx !== index && slide !== currentActive) {
                slide.classList.remove('outgoing');
            }
        });

        heroDots.forEach(dot => dot.classList.remove('active'));
        
        heroSlides[index].classList.add('active');
        heroDots[index].classList.add('active');
        currentHeroSlide = index;

        // Trigger pulse animation on slide-specific stage spotlight and smoke backdrop
        const activeSlide = heroSlides[index];
        const glow = activeSlide ? activeSlide.querySelector('.circle-glow') : null;
        const splash = activeSlide ? activeSlide.querySelector('.ink-splash') : null;
        
        if (glow && splash) {
            glow.classList.remove('pulse');
            splash.classList.remove('pulse');
            
            // Force browser reflow to restart CSS keyframe animations
            void glow.offsetWidth;
            void splash.offsetWidth;
            
            glow.classList.add('pulse');
            splash.classList.add('pulse');
        }
    };

    const nextHeroSlide = () => {
        let index = currentHeroSlide + 1;
        if (index >= heroSlides.length) {
            index = 0;
        }
        showHeroSlide(index);
    };

    if (heroSlides.length > 0 && heroDots.length > 0) {
        // Initialize hero slider
        showHeroSlide(0);
        
        // Auto slide every 6 seconds
        heroInterval = setInterval(nextHeroSlide, 6000);
        
        // Add click events to navigation dots
        heroDots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                clearInterval(heroInterval); // Reset timer
                showHeroSlide(index);
                heroInterval = setInterval(nextHeroSlide, 6000); // Restart timer
            });
        });
    }
});
