document.addEventListener("DOMContentLoaded", function() {

  // ============================================================
  // 1. RESPONSIVE FONT SIZING (dynamic-text CSS variable support)
  // ============================================================
  function applyDynamicTextSizes() {
    var w = window.innerWidth;
    document.querySelectorAll(".dynamic-text").forEach(function(el) {
      var ds = el.style.getPropertyValue("--desktop-size");
      var ts = el.style.getPropertyValue("--tablet-size");
      var ms = el.style.getPropertyValue("--mobile-size");
      if (!ds && !ts && !ms) return;
      var size;
      if (w < 768) size = ms || ts || ds;
      else if (w < 1024) size = ts || ds;
      else size = ds;
      if (size) el.style.fontSize = size;
    });
  }
  applyDynamicTextSizes();
  window.addEventListener("resize", applyDynamicTextSizes);

  // ============================================================
  // 2. PREMIUM SMOOTH SCROLL FOR ANCHOR NAVIGATION LINKS
  // ============================================================
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function smoothScrollToTarget(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;

    var header = document.querySelector("header");
    var headerHeight = header ? header.getBoundingClientRect().height : 0;
    var targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;

    var startY = window.scrollY;
    var distance = targetTop - startY;
    var duration = Math.min(Math.max(Math.abs(distance) * 0.4, 400), 800);
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeInOutCubic(progress);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setActiveNavLink(activeId) {
    document.querySelectorAll(".header-menu-link, .mobile-menu-link").forEach(function(el) {
      el.classList.remove("active-nav-link");
    });
    document.querySelectorAll(".header-menu-link[href='#" + activeId + "'], .mobile-menu-link[href='#" + activeId + "']").forEach(function(el) {
      el.classList.add("active-nav-link");
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener("click", function(e) {
      var href = anchor.getAttribute("href");
      if (href && href.length > 1) {
        var targetId = href.slice(1);
        var target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          smoothScrollToTarget(targetId);
          setActiveNavLink(targetId);
        }
      }
    });
  });

  // ============================================================
  // 2.5. STICKY HEADER & LOGO SWAP
  // ============================================================
  (function() {
    var header = document.querySelector("header[data-sticky-header]");
    if (!header) return;

    var isSticky = header.getAttribute("data-sticky-header") === "true";
    var bgStyle = header.getAttribute("data-bg-style") || "solid-white";
    var defaultLogoUrl = header.getAttribute("data-default-logo-url") || "";
    var stickyLogoUrl = header.getAttribute("data-sticky-logo-url") || "";
    var transparentLogoUrl = header.getAttribute("data-transparent-logo-url") || "";
    var headerPadding = parseInt(header.getAttribute("data-header-padding") || "16", 10);
    var logoImg = header.querySelector("img[alt='Website Logo']");
    var innerContainer = header.querySelector(".max-w-7xl");

    var initBgColor = header.getAttribute("data-init-bg-color") || "#ffffff";
    var initMenuColor = header.getAttribute("data-init-menu-color") || "#1f2937";
    var initMenuHoverColor = header.getAttribute("data-init-menu-hover-color") || "#4f46e5";
    var initActiveMenuColor = header.getAttribute("data-init-active-menu-color") || "#4f46e5";
    var initBtnColor = header.getAttribute("data-init-btn-color") || "#4f46e5";
    var initBtnHoverColor = header.getAttribute("data-init-btn-hover-color") || "#4f46e5";

    var stickyBgColor = header.getAttribute("data-sticky-bg-color") || "#ffffff";
    var stickyMenuColor = header.getAttribute("data-sticky-menu-color") || "#1f2937";
    var stickyMenuHoverColor = header.getAttribute("data-sticky-menu-hover-color") || "#4f46e5";
    var stickyActiveMenuColor = header.getAttribute("data-sticky-active-menu-color") || "#4f46e5";
    var stickyBtnColor = header.getAttribute("data-sticky-btn-color") || "#4f46e5";
    var stickyBtnHoverColor = header.getAttribute("data-sticky-btn-hover-color") || "#4f46e5";

    var initialBoxShadow = header.style.boxShadow || "";
    var initialBg = header.style.backgroundColor || "";
    var initialBackgroundImage = header.style.backgroundImage || "";
    var initialBackdrop = header.style.backdropFilter || "";
    var initialWebkitBackdrop = header.style.webkitBackdropFilter || "";
    var initialBorderBottom = header.style.borderBottom || "";

    function updateHeaderScroll() {
      var scrolled = window.scrollY > 10;

      if (logoImg) {
        if (scrolled && isSticky && stickyLogoUrl) {
          logoImg.setAttribute("src", stickyLogoUrl);
        } else if (!scrolled && (bgStyle === "transparent" || bgStyle === "glass") && transparentLogoUrl) {
          logoImg.setAttribute("src", transparentLogoUrl);
        } else {
          logoImg.setAttribute("src", defaultLogoUrl);
        }
      }

      if (innerContainer) {
        var currentPadding = (scrolled && isSticky) ? Math.max(headerPadding * 0.65, 8) : headerPadding;
        innerContainer.style.paddingTop = currentPadding + "px";
        innerContainer.style.paddingBottom = currentPadding + "px";
      }

      if (scrolled && isSticky) {
        header.classList.add("shadow-[0_2px_20px_rgba(0,0,0,0.08)]");
        header.style.backgroundColor = stickyBgColor;
        header.style.backdropFilter = "";
        header.style.webkitBackdropFilter = "";
        header.style.boxShadow = "0 2px 20px rgba(0,0,0,0.08)";
        header.style.borderBottom = "";

        header.style.setProperty("--menu-color", stickyMenuColor);
        header.style.setProperty("--menu-hover-color", stickyMenuHoverColor);
        header.style.setProperty("--active-menu-color", stickyActiveMenuColor);
        header.style.setProperty("--btn-color", stickyBtnColor);
        header.style.setProperty("--btn-hover-color", stickyBtnHoverColor);
      } else {
        header.classList.remove("shadow-[0_2px_20px_rgba(0,0,0,0.08)]");
        header.style.backgroundColor = initialBg;
        header.style.backgroundImage = initialBackgroundImage;
        header.style.backdropFilter = initialBackdrop;
        header.style.webkitBackdropFilter = initialWebkitBackdrop;
        header.style.boxShadow = initialBoxShadow;
        header.style.borderBottom = initialBorderBottom;

        header.style.setProperty("--menu-color", initMenuColor);
        header.style.setProperty("--menu-hover-color", initMenuHoverColor);
        header.style.setProperty("--active-menu-color", initActiveMenuColor);
        header.style.setProperty("--btn-color", initBtnColor);
        header.style.setProperty("--btn-hover-color", initBtnHoverColor);
      }
    }

    if (isSticky) {
      window.addEventListener("scroll", updateHeaderScroll, { passive: true });
      updateHeaderScroll();
    } else {
      updateHeaderScroll();
    }
  })();

  // ============================================================
  // 3. MOBILE MENU TOGGLE
  // ============================================================
  var mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  var mobileMenuPanel = document.getElementById("mobile-menu-panel");

  if (mobileMenuToggle && mobileMenuPanel) {
    var iconOpen = mobileMenuToggle.querySelector(".mobile-menu-icon-open");
    var iconClose = mobileMenuToggle.querySelector(".mobile-menu-icon-close");

    mobileMenuToggle.addEventListener("click", function() {
      var isHidden = mobileMenuPanel.classList.contains("hidden");
      if (isHidden) {
        mobileMenuPanel.classList.remove("hidden");
        mobileMenuPanel.classList.add("block");
        if (iconOpen) iconOpen.style.display = "none";
        if (iconClose) iconClose.style.display = "block";
      } else {
        mobileMenuPanel.classList.remove("block");
        mobileMenuPanel.classList.add("hidden");
        if (iconOpen) iconOpen.style.display = "block";
        if (iconClose) iconClose.style.display = "none";
      }
    });

    mobileMenuPanel.querySelectorAll("a").forEach(function(link) {
      link.addEventListener("click", function() {
        mobileMenuPanel.classList.remove("block");
        mobileMenuPanel.classList.add("hidden");
        if (iconOpen) iconOpen.style.display = "block";
        if (iconClose) iconClose.style.display = "none";
      });
    });
  }

  // ============================================================
  // 4. ANIMATED COUNTERS (Intersection Observer)
  // ============================================================
  var counterElements = document.querySelectorAll("[data-counter-value]");
  if (counterElements.length > 0 && "IntersectionObserver" in window) {
    function parseCounterValue(str) {
      str = String(str || "0").trim();
      var match = str.match(/^([^\d]*?)([\d,]+\.?\d*)\s*(.*)$/);
      if (!match) return { numericValue: 0, prefix: "", suffix: str, decimals: 0 };
      var prefix = match[1];
      var numStr = match[2].replace(/,/g, "");
      var numericValue = parseFloat(numStr) || 0;
      var decimals = numStr.indexOf(".") !== -1 ? (numStr.split(".")[1] || "").length : 0;
      var suffix = match[3];
      return { numericValue: numericValue, prefix: prefix, suffix: suffix, decimals: decimals };
    }

    function animateCounter(el) {
      var targetStr = el.getAttribute("data-counter-value");
      var parsed = parseCounterValue(targetStr);
      var numericValue = parsed.numericValue, prefix = parsed.prefix, suffix = parsed.suffix, decimals = parsed.decimals;
      var duration = 2000;
      var startTime = performance.now();
      function step(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = eased * numericValue;
        var displayValue = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
        el.textContent = prefix + displayValue + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    var counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    counterElements.forEach(function(el) { counterObserver.observe(el); });
  }

  // ============================================================
  // 5. REVIEWS CAROUSEL
  // ============================================================
  function initReviewsCarousel() {
    var section = document.getElementById("reviews");
    if (!section) return;

    var track = section.querySelector(".flex.items-stretch");
    if (!track) return;

    var slides = Array.from(track.children);
    if (slides.length === 0) return;

    var prevBtn = section.querySelector('[aria-label="Previous review"]');
    var nextBtn = section.querySelector('[aria-label="Next review"]');
    var dotsContainer = section.querySelector(".flex.justify-center.gap-2");

    var currentIndex = 0;
    var cardsToShow = 1;
    var isHovered = false;
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#4f46e5";

    function getCardsToShow() {
      var w = window.innerWidth;
      if (w < 768) return 1;
      if (w < 1024) return 2;
      return 3;
    }

    function updateTrack() {
      track.style.transform = "translate3d(-" + ((currentIndex * 100) / slides.length) + "%, 0, 0)";
      track.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    }

    function updateDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      var maxIndex = Math.max(0, slides.length - cardsToShow);
      for (var i = 0; i <= maxIndex; i++) {
        (function(idx) {
          var dot = document.createElement("button");
          dot.className = "h-2.5 rounded-full transition-all duration-300";
          dot.setAttribute("aria-label", "Go to slide " + (idx + 1));
          if (idx === currentIndex) {
            dot.style.width = "24px";
            dot.style.backgroundColor = primaryColor;
          } else {
            dot.style.width = "10px";
            dot.style.backgroundColor = "#cbd5e1";
          }
          dot.addEventListener("click", function() { currentIndex = idx; updateTrack(); updateDots(); });
          dotsContainer.appendChild(dot);
        })(i);
      }
    }

    function updateLayout() {
      cardsToShow = getCardsToShow();
      track.style.width = ((slides.length * 100) / cardsToShow) + "%";
      slides.forEach(function(slide) { slide.style.width = (100 / slides.length) + "%"; });
      var maxIndex = Math.max(0, slides.length - cardsToShow);
      if (currentIndex > maxIndex) currentIndex = maxIndex;
      updateTrack();
      updateDots();
    }

    function nextSlide() {
      var maxIndex = Math.max(0, slides.length - cardsToShow);
      if (slides.length <= cardsToShow) return;
      currentIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
      updateTrack(); updateDots();
    }
    function prevSlide() {
      var maxIndex = Math.max(0, slides.length - cardsToShow);
      if (slides.length <= cardsToShow) return;
      currentIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
      updateTrack(); updateDots();
    }

    if (prevBtn) prevBtn.addEventListener("click", prevSlide);
    if (nextBtn) nextBtn.addEventListener("click", nextSlide);

    section.addEventListener("mouseenter", function() { isHovered = true; });
    section.addEventListener("mouseleave", function() { isHovered = false; });
    setInterval(function() { if (!isHovered) nextSlide(); }, 4000);

    var touchStartX = null;
    track.addEventListener("touchstart", function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function(e) {
      if (touchStartX === null) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 50) nextSlide();
      else if (diff < -50) prevSlide();
      touchStartX = null;
    });

    window.addEventListener("resize", updateLayout);
    updateLayout();
  }

  // ============================================================
  // 6. SAAS PRODUCT CAROUSEL (full-width, single card per view)
  // ============================================================
  function initSaaSProductCarousel() {
    var section = document.getElementById("saas-product");
    if (!section) return;

    var overflowContainer = section.querySelector(".relative.overflow-hidden");
    if (!overflowContainer) return;

    var track = null;
    var containerChildren = Array.from(overflowContainer.children);
    for (var i = 0; i < containerChildren.length; i++) {
      var child = containerChildren[i];
      if (child.style && child.style.display === "flex") {
        track = child;
        break;
      }
    }
    if (!track) return;

    var slides = Array.from(track.children);
    if (slides.length === 0) return;
    var totalSlides = slides.length;

    var allButtons = Array.from(section.querySelectorAll("button"));
    var prevBtn = null, nextBtn = null;
    allButtons.forEach(function(b) {
      if (b.className && b.className.indexOf("left-6") !== -1) prevBtn = b;
      if (b.className && b.className.indexOf("right-6") !== -1) nextBtn = b;
    });

    var dotsContainer = section.querySelector(".mt-8.flex.items-center.justify-center");

    var currentIndex = 0;
    var isHovered = false;
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#4f46e5";

    function updateTrack() {
      var pct = (currentIndex * 100) / totalSlides;
      track.style.transform = "translateX(-" + pct + "%)";
      track.style.transition = "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)";
    }

    function updateDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      for (var i = 0; i < totalSlides; i++) {
        (function(idx) {
          var dot = document.createElement("button");
          dot.className = "h-2.5 rounded-full transition-all duration-300";
          if (idx === currentIndex) {
            dot.className += " w-6";
            dot.style.backgroundColor = primaryColor;
          } else {
            dot.className += " w-2.5";
            dot.style.backgroundColor = "rgba(0,0,0,0.12)";
          }
          dot.addEventListener("click", function() { currentIndex = idx; updateTrack(); updateDots(); });
          dotsContainer.appendChild(dot);
        })(i);
      }
    }

    function nextSlide() {
      currentIndex = currentIndex >= totalSlides - 1 ? 0 : currentIndex + 1;
      updateTrack(); updateDots();
    }
    function prevSlide() {
      currentIndex = currentIndex <= 0 ? totalSlides - 1 : currentIndex - 1;
      updateTrack(); updateDots();
    }

    if (prevBtn) prevBtn.addEventListener("click", prevSlide);
    if (nextBtn) nextBtn.addEventListener("click", nextSlide);

    section.addEventListener("mouseenter", function() { isHovered = true; });
    section.addEventListener("mouseleave", function() { isHovered = false; });
    setInterval(function() { if (!isHovered) nextSlide(); }, 3000);

    var touchStartX = null;
    track.addEventListener("touchstart", function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function(e) {
      if (touchStartX === null) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 50) nextSlide();
      else if (diff < -50) prevSlide();
      touchStartX = null;
    });

    updateTrack();
    updateDots();
  }

  // ============================================================
  // 7. FAQ ACCORDION INTERACTIVITY
  // ============================================================
  function initFaqAccordion() {
    var section = document.getElementById("faq");
    if (!section) return;

    var cards = Array.from(section.querySelectorAll(".group.rounded-2xl"));
    cards.forEach(function(card) {
      var btn = card.querySelector("button");
      var panel = card.querySelector(".grid.transition-all");

      if (btn && panel) {
        btn.addEventListener("click", function() {
          var isOpen = panel.classList.contains("grid-rows-[1fr]");

          cards.forEach(function(c) {
            var p = c.querySelector(".grid.transition-all");
            var b = c.querySelector("button");
            var iw = b ? b.querySelector(".p-1\\.5") : null;
            if (p) {
              p.classList.remove("grid-rows-[1fr]", "opacity-100");
              p.classList.add("grid-rows-[0fr]", "opacity-0");
            }
            if (iw) {
              iw.classList.remove("bg-indigo-50", "text-indigo-600", "rotate-180");
              iw.classList.add("bg-gray-50", "text-gray-400");
            }
          });

          if (!isOpen) {
            panel.classList.remove("grid-rows-[0fr]", "opacity-0");
            panel.classList.add("grid-rows-[1fr]", "opacity-100");
            var iconWrapper = btn.querySelector(".p-1\\.5");
            if (iconWrapper) {
              iconWrapper.classList.remove("bg-gray-50", "text-gray-400");
              iconWrapper.classList.add("bg-indigo-50", "text-indigo-600", "rotate-180");
            }
          }
        });
      }
    });
  }

  // ============================================================
  // 8. TEAM SECTION CAROUSEL
  // ============================================================
  function initTeamCarousel() {
    var section = document.getElementById("our-team");
    if (!section) return;

    var overflowContainer = section.querySelector(".relative.overflow-hidden");
    if (!overflowContainer) return;

    var track = null;
    var containerChildren = Array.from(overflowContainer.children);
    for (var i = 0; i < containerChildren.length; i++) {
      var child = containerChildren[i];
      if (child.style && child.style.display === "flex") {
        track = child;
        break;
      }
    }
    if (!track) return;

    var slides = Array.from(track.children);
    if (slides.length === 0) return;
    var totalSlides = slides.length;

    var allButtons = Array.from(section.querySelectorAll("button"));
    var prevBtn = null, nextBtn = null;
    allButtons.forEach(function(b) {
      if (b.className && b.className.indexOf("-left-4") !== -1) prevBtn = b;
      if (b.className && b.className.indexOf("-right-4") !== -1) nextBtn = b;
    });

    var dotsContainer = section.querySelector(".mt-8.flex.items-center.justify-center");

    var currentIndex = 0;
    var isHovered = false;
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#4f46e5";

    function updateTrack() {
      var pct = (currentIndex * 100) / totalSlides;
      track.style.transform = "translateX(-" + pct + "%)";
      track.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
    }

    function updateDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      for (var i = 0; i < totalSlides; i++) {
        (function(idx) {
          var dot = document.createElement("button");
          dot.className = "h-2.5 rounded-full transition-all duration-300";
          if (idx === currentIndex) {
            dot.className += " w-6";
            dot.style.backgroundColor = primaryColor;
          } else {
            dot.className += " w-2.5";
            dot.style.backgroundColor = "rgba(0,0,0,0.12)";
          }
          dot.addEventListener("click", function() { currentIndex = idx; updateTrack(); updateDots(); });
          dotsContainer.appendChild(dot);
        })(i);
      }
    }

    function nextSlide() {
      currentIndex = currentIndex >= totalSlides - 1 ? 0 : currentIndex + 1;
      updateTrack(); updateDots();
    }
    function prevSlide() {
      currentIndex = currentIndex <= 0 ? totalSlides - 1 : currentIndex - 1;
      updateTrack(); updateDots();
    }

    if (prevBtn) prevBtn.addEventListener("click", prevSlide);
    if (nextBtn) nextBtn.addEventListener("click", nextSlide);

    section.addEventListener("mouseenter", function() { isHovered = true; });
    section.addEventListener("mouseleave", function() { isHovered = false; });

    var autoplayAttr = section.querySelector("[data-autoplay]");
    var speed = 3000;
    if (autoplayAttr) {
      var speedVal = parseInt(autoplayAttr.getAttribute("data-autoplay-speed") || "3000", 10);
      if (!isNaN(speedVal)) speed = speedVal;
    }
    setInterval(function() { if (!isHovered) nextSlide(); }, speed);

    var touchStartX = null;
    track.addEventListener("touchstart", function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function(e) {
      if (touchStartX === null) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 50) nextSlide();
      else if (diff < -50) prevSlide();
      touchStartX = null;
    });

    updateTrack();
    updateDots();
  }

  // ============================================================
  // 9. GALLERY INTERACTIVE LIGHTBOX & FILTERING
  // ============================================================
  function initGallery() {
    var gallerySection = document.getElementById("gallery");
    if (!gallerySection) return;

    var tabButtons = Array.from(gallerySection.querySelectorAll("button[data-tab-id]"));
    var imageItems = Array.from(gallerySection.querySelectorAll("div[data-category-id]"));

    var activeBg = "";
    var activeText = "";
    var activeBorder = "";
    var normalBg = "";
    var normalText = "";
    var normalBorder = "";

    tabButtons.forEach(function(btn) {
      if (btn.getAttribute("data-tab-id") === "all") {
        activeBg = btn.getAttribute("data-active-bg") || "";
        activeText = btn.getAttribute("data-active-text") || "";
        activeBorder = btn.getAttribute("data-active-border") || "";
        normalBg = btn.getAttribute("data-normal-bg") || "transparent";
        normalText = btn.getAttribute("data-normal-text") || "#4b5563";
        normalBorder = btn.getAttribute("data-normal-border") || "#e5e7eb";
      }
    });

    function filterGallery(tabId) {
      imageItems.forEach(function(item) {
        var catId = item.getAttribute("data-category-id");
        if (tabId === "all" || catId === tabId) {
          item.style.display = "block";
        } else {
          item.style.display = "none";
        }
      });

      tabButtons.forEach(function(btn) {
        var btnTabId = btn.getAttribute("data-tab-id");
        if (btnTabId === tabId) {
          btn.style.backgroundColor = btn.getAttribute("data-active-bg") || activeBg || btn.style.backgroundColor;
          btn.style.color = btn.getAttribute("data-active-text") || activeText || btn.style.color;
          btn.style.borderColor = btn.getAttribute("data-active-border") || activeBorder || btn.style.borderColor;
        } else {
          btn.style.backgroundColor = btn.getAttribute("data-normal-bg") || normalBg || btn.style.backgroundColor;
          btn.style.color = btn.getAttribute("data-normal-text") || normalText || btn.style.color;
          btn.style.borderColor = btn.getAttribute("data-normal-border") || normalBorder || btn.style.borderColor;
        }
      });
    }

    tabButtons.forEach(function(btn) {
      btn.addEventListener("click", function() {
        var tabId = btn.getAttribute("data-tab-id");
        filterGallery(tabId);
      });
    });

    var lightbox = null;
    var lightboxImg = null;
    var lightboxCaption = null;
    var lbPrevBtn = null;
    var lbNextBtn = null;
    var activeIndex = 0;

    function getVisibleImages() {
      return imageItems.filter(function(item) {
        return item.style.display !== "none";
      });
    }

    function updateLightboxImage() {
      var visibleItems = getVisibleImages();
      if (activeIndex < 0 || activeIndex >= visibleItems.length) return;
      var currentItem = visibleItems[activeIndex];
      var img = currentItem.querySelector("img");
      if (img && lightboxImg) {
        lightboxImg.setAttribute("src", img.getAttribute("src"));
      }
      if (lightboxCaption) {
        lightboxCaption.textContent = "Image " + (activeIndex + 1) + " of " + visibleItems.length;
      }
      if (lbPrevBtn) lbPrevBtn.style.display = activeIndex > 0 ? "flex" : "none";
      if (lbNextBtn) lbNextBtn.style.display = activeIndex < visibleItems.length - 1 ? "flex" : "none";
    }

    function openLightbox(index) {
      activeIndex = index;
      if (!lightbox) {
        lightbox = document.createElement("div");
        lightbox.className = "fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm select-none";
        lightbox.style.boxSizing = "border-box";

        var closeBtn = document.createElement("button");
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.className = "absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center border-none";
        closeBtn.addEventListener("click", closeLightbox);
        lightbox.appendChild(closeBtn);

        lbPrevBtn = document.createElement("button");
        lbPrevBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        lbPrevBtn.className = "absolute left-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center border-none";
        lbPrevBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          if (activeIndex > 0) { activeIndex--; updateLightboxImage(); }
        });
        lightbox.appendChild(lbPrevBtn);

        var contentContainer = document.createElement("div");
        contentContainer.className = "max-w-5xl max-h-[85vh] flex flex-col items-center gap-4 w-full";
        contentContainer.addEventListener("click", function(e) { e.stopPropagation(); });

        lightboxImg = document.createElement("img");
        lightboxImg.className = "max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/5";
        contentContainer.appendChild(lightboxImg);

        lightboxCaption = document.createElement("span");
        lightboxCaption.className = "text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full";
        contentContainer.appendChild(lightboxCaption);

        lightbox.appendChild(contentContainer);

        lbNextBtn = document.createElement("button");
        lbNextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        lbNextBtn.className = "absolute right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center border-none";
        lbNextBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          var visibleItems = getVisibleImages();
          if (activeIndex < visibleItems.length - 1) { activeIndex++; updateLightboxImage(); }
        });
        lightbox.appendChild(lbNextBtn);

        lightbox.addEventListener("click", closeLightbox);
        document.body.appendChild(lightbox);
      }
      lightbox.style.display = "flex";
      updateLightboxImage();
      document.addEventListener("keydown", handleLightboxKeys);
    }

    function closeLightbox() {
      if (lightbox) lightbox.style.display = "none";
      document.removeEventListener("keydown", handleLightboxKeys);
    }

    function handleLightboxKeys(e) {
      var visibleItems = getVisibleImages();
      if (e.key === "ArrowLeft" && activeIndex > 0) { activeIndex--; updateLightboxImage(); }
      else if (e.key === "ArrowRight" && activeIndex < visibleItems.length - 1) { activeIndex++; updateLightboxImage(); }
      else if (e.key === "Escape") { closeLightbox(); }
    }

    imageItems.forEach(function(item) {
      item.addEventListener("click", function() {
        var visibleItems = getVisibleImages();
        var index = visibleItems.indexOf(item);
        if (index !== -1) openLightbox(index);
      });
    });

    filterGallery("all");
  }

  // ============================================================
  // 10. HOSPITAL HERO SLIDER
  // ============================================================
  function initHospitalHeroSlider() {
    var section = document.getElementById("hospital-hero-section");
    if (!section) return;

    var slidesAttr = section.getAttribute("data-slides");
    if (!slidesAttr) return;

    var slides;
    try { slides = JSON.parse(slidesAttr); } catch(e) { return; }
    if (!slides || slides.length === 0) return;

    var totalSlides = slides.length;
    var currentIdx = 0;
    var prevIdx = 0;
    var direction = "next";
    var timerRef = null;
    var autoplaySpeed = parseInt(section.getAttribute("data-autoplay-speed") || "7500", 10);
    var overlayColor = section.getAttribute("data-overlay-color") || "#0f172a";
    var overlayOpacity = parseFloat(section.getAttribute("data-overlay-opacity") || "0.58");
    var secondaryColor = section.getAttribute("data-secondary-color") || "#10b981";

    function hexToRgba(hex, alpha) {
      var h = (hex || "#000000").replace("#", "");
      var r = parseInt(h.substring(0, 2), 16) || 0;
      var g = parseInt(h.substring(2, 4), 16) || 0;
      var b = parseInt(h.substring(4, 6), 16) || 0;
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    }

    // Build the slider DOM completely from data-slides
    section.innerHTML = "";

    // Inject required CSS keyframes
    var styleEl = document.createElement("style");
    styleEl.textContent = [
      "@keyframes hosp-ken-burns { from { transform: scale(1.0); } to { transform: scale(1.08); } }",
      "@keyframes hosp-fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }",
      "@keyframes hosp-line-grow { from { width: 0; } to { width: 48px; } }",
      ".hosp-kb-active { animation: hosp-ken-burns 8.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }",
      ".hosp-animate-title { animation: hosp-fade-up 800ms ease-in-out both; animation-delay: 100ms; }",
      ".hosp-animate-desc { animation: hosp-fade-up 800ms ease-in-out both; animation-delay: 250ms; }",
      ".hosp-animate-btn { animation: hosp-fade-up 800ms ease-in-out both; animation-delay: 400ms; }",
      ".hosp-animate-stats { animation: hosp-fade-up 800ms ease-in-out both; animation-delay: 550ms; }",
      ".hosp-line-anim { animation: hosp-line-grow 600ms ease both; animation-delay: 300ms; }",
      ".hosp-parallax-bg { transition: transform 1200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 1000ms cubic-bezier(0.25, 1, 0.5, 1); will-change: transform, opacity; }",
      ".hosp-slide-active { opacity: 1; transform: translateY(0) scale(1); }",
      ".hosp-slide-prev { opacity: 0; transform: translateY(-40px) scale(1.05); }",
      ".hosp-slide-idle { opacity: 0; transform: translateY(40px) scale(1.05); }",
      ".hosp-transition-800 { transition-property: all; transition-duration: 800ms !important; transition-timing-function: ease-in-out !important; }",
      "@keyframes hosp-thumbnail-glow { 0%, 100% { box-shadow: 0 0 15px rgba(255,255,255,0.25),0 4px 10px rgba(0,0,0,0.3); } 50% { box-shadow: 0 0 30px rgba(255,255,255,0.5),0 4px 15px rgba(0,0,0,0.5); } }",
      ".hosp-active-thumbnail { animation: hosp-thumbnail-glow 3s infinite ease-in-out; }",
      "@keyframes hosp-btn-scale-fade { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }",
      ".hosp-active-btn { animation: hosp-btn-scale-fade 800ms cubic-bezier(0.34,1.56,0.64,1) forwards; }",
      ".scrollbar-none::-webkit-scrollbar { display: none; }",
      ".scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }",
      ".hosp-hero-primary-btn { background-color: " + secondaryColor + " !important; color: #ffffff !important; padding: 14px 34px; border-radius: 50px !important; border: 1px solid transparent !important; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 8px; transition: background-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease; white-space: nowrap; }",
      ".hosp-hero-primary-btn:hover { opacity: 0.85; transform: translateY(-2px); }"
    ].join("\n");
    section.appendChild(styleEl);

    // Build background slide layers
    var bgContainer = document.createElement("div");
    bgContainer.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;background:#0f172a;";

    var bgDivs = slides.map(function(slide, idx) {
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:hidden;";
      wrapper.style.zIndex = idx === 0 ? "2" : "0";
      wrapper.style.pointerEvents = idx === 0 ? "auto" : "none";

      var bg = document.createElement("div");
      bg.className = "hosp-parallax-bg " + (idx === 0 ? "hosp-slide-active" : "hosp-slide-idle");
      bg.style.cssText = "position:absolute;width:100%;height:110%;top:-5%;background-size:cover;background-position:center;background-repeat:no-repeat;";
      bg.style.backgroundImage = "linear-gradient(135deg, " + hexToRgba(overlayColor, overlayOpacity) + " 0%, " + hexToRgba(overlayColor, overlayOpacity * 0.75) + " 100%), url(" + slide.imageUrl + ")";
      wrapper.appendChild(bg);
      bgContainer.appendChild(wrapper);
      return { wrapper: wrapper, bg: bg };
    });
    section.appendChild(bgContainer);

    // Content area
    var contentArea = document.createElement("div");
    contentArea.style.cssText = "position:relative;z-index:10;max-width:80rem;margin:0 auto;padding:0 3rem;width:100%;display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:3rem;transform:translateY(-4rem);";

    // Left: text block
    var textBlock = document.createElement("div");
    textBlock.style.cssText = "max-width:42rem;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:1.5rem;";

    var badgeEl = document.createElement("span");
    badgeEl.style.cssText = "display:inline-flex;align-items:center;gap:0.5rem;padding:6px 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border-radius:999px;background:rgba(255,255,255,0.12);color:#ffffff;border:1px solid rgba(255,255,255,0.2);";

    var headingEl = document.createElement("h1");
    headingEl.className = "hosp-animate-title";
    headingEl.style.cssText = "font-weight:800;line-height:1.1;letter-spacing:-0.02em;white-space:pre-line;font-size:clamp(1.8rem,6vw,3.8rem);color:#ffffff;margin:0;";

    var descEl = document.createElement("p");
    descEl.className = "hosp-animate-desc";
    descEl.style.cssText = "font-weight:400;line-height:1.6;font-size:clamp(0.95rem,1.5vw,1.05rem);color:rgba(255,255,255,0.8);margin:0;max-width:32rem;";

    var lineEl = document.createElement("div");
    lineEl.className = "hosp-line-anim";
    lineEl.style.cssText = "width:48px;height:2px;background:" + secondaryColor + ";";

    var btnWrapper = document.createElement("div");
    btnWrapper.className = "hosp-animate-btn";
    btnWrapper.style.cssText = "display:flex;justify-content:flex-start;margin-top:0.5rem;";

    var btnEl = document.createElement("a");
    btnEl.className = "hosp-hero-primary-btn";
    btnEl.innerHTML = 'Book Appointment <svg style="width:16px;height:16px;margin-left:4px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>';

    btnWrapper.appendChild(btnEl);
    textBlock.appendChild(badgeEl);
    textBlock.appendChild(headingEl);
    textBlock.appendChild(descEl);
    textBlock.appendChild(lineEl);
    textBlock.appendChild(btnWrapper);
    contentArea.appendChild(textBlock);

    // Right: stats block
    var statsBlock = document.createElement("div");
    statsBlock.className = "hosp-animate-stats";
    statsBlock.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;gap:1.5rem;";
    contentArea.appendChild(statsBlock);

    section.appendChild(contentArea);

    // Bottom controls
    var bottomBar = document.createElement("div");
    bottomBar.style.cssText = "position:absolute;bottom:2.5rem;left:0;width:100%;z-index:20;pointer-events:none;";

    var bottomInner = document.createElement("div");
    bottomInner.style.cssText = "max-width:80rem;margin:0 auto;padding:0 3rem;width:100%;display:flex;justify-content:flex-start;pointer-events:auto;";

    var controlsCol = document.createElement("div");
    controlsCol.style.cssText = "display:flex;flex-direction:column;gap:1.5rem;max-width:502px;width:100%;";

    // Arrow row
    var arrowRow = document.createElement("div");
    arrowRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;width:100%;color:white;";

    var arrowLeft = document.createElement("div");
    arrowLeft.style.cssText = "display:flex;align-items:center;gap:4rem;";

    var prevBtn = document.createElement("button");
    prevBtn.innerHTML = '<svg style="width:2rem;height:2rem;stroke-width:1.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75-6.75M4.5 12l6.75 6.75"/></svg>';
    prevBtn.style.cssText = "background:none;border:none;color:white;cursor:pointer;padding:0.5rem;";
    prevBtn.setAttribute("aria-label", "Previous slide");

    var nextBtnEl = document.createElement("button");
    nextBtnEl.innerHTML = '<svg style="width:2rem;height:2rem;stroke-width:1.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"/></svg>';
    nextBtnEl.style.cssText = "background:none;border:none;color:white;cursor:pointer;padding:0.5rem;";
    nextBtnEl.setAttribute("aria-label", "Next slide");

    arrowLeft.appendChild(prevBtn);
    arrowLeft.appendChild(nextBtnEl);

    // Slide counter
    var counterEl = document.createElement("div");
    counterEl.style.cssText = "display:flex;align-items:center;gap:1rem;font-size:13px;letter-spacing:0.1em;font-weight:600;font-family:monospace;color:rgba(255,255,255,0.9);margin-right:1rem;";

    var slideNumWrapper = document.createElement("div");
    slideNumWrapper.style.cssText = "position:relative;width:1.5rem;height:1.25rem;overflow:hidden;";
    var slideNumTrack = document.createElement("div");
    slideNumTrack.style.cssText = "position:absolute;left:0;width:100%;display:flex;flex-direction:column;transition:transform 0.8s ease-in-out;";
    slides.forEach(function(_, i) {
      var span = document.createElement("span");
      span.style.cssText = "height:1.25rem;display:flex;align-items:center;justify-content:center;font-weight:700;";
      span.textContent = String(i + 1).padStart(2, "0");
      slideNumTrack.appendChild(span);
    });
    slideNumWrapper.appendChild(slideNumTrack);

    var sepEl = document.createElement("span");
    sepEl.style.cssText = "color:rgba(255,255,255,0.4);font-weight:300;";
    sepEl.textContent = "─────";

    var totalEl = document.createElement("span");
    totalEl.style.cssText = "color:rgba(255,255,255,0.55);font-weight:700;";
    totalEl.textContent = String(totalSlides).padStart(2, "0");

    counterEl.appendChild(slideNumWrapper);
    counterEl.appendChild(sepEl);
    counterEl.appendChild(totalEl);

    arrowRow.appendChild(arrowLeft);
    arrowRow.appendChild(counterEl);

    // Thumbnails
    var thumbRow = document.createElement("div");
    thumbRow.className = "scrollbar-none";
    thumbRow.style.cssText = "display:flex;align-items:center;gap:1rem;overflow-x:auto;scroll-behavior:smooth;padding-bottom:0.5rem;width:100%;justify-content:flex-start;";

    var thumbEls = slides.map(function(slide, idx) {
      var btn = document.createElement("button");
      btn.className = "hosp-transition-800";
      btn.style.cssText = "position:relative;border-radius:0.5rem;overflow:hidden;cursor:pointer;flex-shrink:0;border:1px solid " + (secondaryColor || "#6ff3c7") + ";background:none;padding:0;";
      btn.style.width = idx === 0 ? "170px" : "150px";
      btn.style.height = idx === 0 ? "110px" : "98px";
      if (idx === 0) { btn.classList.add("hosp-active-thumbnail"); btn.style.transform = "scale(1.05)"; }
      else { btn.style.opacity = "0.6"; }

      var img = document.createElement("img");
      img.src = slide.imageUrl;
      img.alt = "Slide " + (idx + 1) + " thumbnail";
      img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 0.8s ease-in-out;";
      btn.appendChild(img);

      var overlay = document.createElement("div");
      overlay.className = "hosp-transition-800";
      overlay.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.6);transition:opacity 0.8s ease-in-out;opacity:" + (idx === 0 ? "1" : "0") + ";";
      btn.appendChild(overlay);

      if (idx === 0) {
        var circle = document.createElement("div");
        circle.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;";
        var inner = document.createElement("div");
        inner.className = "hosp-active-btn";
        inner.style.cssText = "width:2.5rem;height:2.5rem;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
        inner.innerHTML = '<svg style="width:1.25rem;height:1.25rem;color:#111;stroke-width:2.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></svg>';
        circle.appendChild(inner);
        btn.appendChild(circle);
      }

      thumbRow.appendChild(btn);
      return { btn: btn, img: img, overlay: overlay };
    });

    controlsCol.appendChild(arrowRow);
    controlsCol.appendChild(thumbRow);
    bottomInner.appendChild(controlsCol);
    bottomBar.appendChild(bottomInner);
    section.appendChild(bottomBar);

    // ── Slide update logic ──
    function updateSlideContent(idx) {
      var slide = slides[idx];
      badgeEl.textContent = slide.badgeText || "";
      headingEl.textContent = slide.mainHeading || "";
      descEl.textContent = slide.description || "";
      btnEl.href = slide.primaryButtonLink || "#";
      btnEl.innerHTML = (slide.primaryButtonText || "Book Appointment") + ' <svg style="width:16px;height:16px;margin-left:4px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>';

      // Rebuild stats
      statsBlock.innerHTML = "";
      if (Array.isArray(slide.stats) && slide.stats.length > 0) {
        slide.stats.forEach(function(stat) {
          var statDiv = document.createElement("div");
          statDiv.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;text-align:right;";
          var valEl = document.createElement("span");
          valEl.style.cssText = "font-size:1.875rem;font-weight:900;letter-spacing:-0.02em;color:" + secondaryColor + ";";
          valEl.textContent = stat.value || "";
          var labelEl = document.createElement("span");
          labelEl.style.cssText = "font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.05em;margin-top:0.25rem;";
          labelEl.textContent = stat.label || "";
          statDiv.appendChild(valEl);
          statDiv.appendChild(labelEl);
          statsBlock.appendChild(statDiv);
        });
      }

      // Restart CSS animations by forcing reflow
      [headingEl, descEl, btnWrapper, statsBlock, lineEl, badgeEl].forEach(function(el) {
        el.style.animation = "none";
        el.offsetHeight; // trigger reflow
        el.style.animation = "";
      });

      // Slide counter animation
      slideNumTrack.style.transform = "translateY(-" + (idx * 20) + "px)";
    }

    function applySlideTransition(newIdx) {
      var exitY = direction === "next" ? "-40px" : "40px";
      var enterY = direction === "next" ? "40px" : "-40px";

      // Update z-indexes and classes
      bgDivs.forEach(function(item, i) {
        if (i === newIdx) {
          item.wrapper.style.zIndex = "2";
          item.wrapper.style.pointerEvents = "auto";
          item.bg.style.setProperty("--enter-y", enterY);
          item.bg.className = "hosp-parallax-bg hosp-slide-idle";
          // Force reflow then activate
          item.bg.offsetHeight;
          item.bg.className = "hosp-parallax-bg hosp-slide-active";
        } else if (i === currentIdx) {
          item.wrapper.style.zIndex = "1";
          item.wrapper.style.pointerEvents = "none";
          item.bg.style.setProperty("--exit-y", exitY);
          item.bg.className = "hosp-parallax-bg hosp-slide-prev";
        } else {
          item.wrapper.style.zIndex = "0";
          item.wrapper.style.pointerEvents = "none";
          item.bg.className = "hosp-parallax-bg hosp-slide-idle";
        }
      });

      // Update thumbnails
      thumbEls.forEach(function(item, i) {
        if (i === newIdx) {
          item.btn.style.width = "170px";
          item.btn.style.height = "110px";
          item.btn.style.opacity = "1";
          item.btn.style.transform = "scale(1.05)";
          item.btn.classList.add("hosp-active-thumbnail");
          item.overlay.style.opacity = "1";
        } else {
          item.btn.style.width = "150px";
          item.btn.style.height = "98px";
          item.btn.style.opacity = "0.6";
          item.btn.style.transform = "scale(1)";
          item.btn.classList.remove("hosp-active-thumbnail");
          item.overlay.style.opacity = "0";
        }
      });

      // Scroll thumbnail into view
      var activeThumb = thumbEls[newIdx].btn;
      activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

      prevIdx = currentIdx;
      currentIdx = newIdx;
      updateSlideContent(newIdx);
    }

    function gotoSlide(idx) {
      if (idx === currentIdx) return;
      direction = idx > currentIdx ? "next" : "prev";
      applySlideTransition(idx);
    }

    function gotoNext() {
      direction = "next";
      var next = (currentIdx + 1) % totalSlides;
      applySlideTransition(next);
    }

    function gotoPrev() {
      direction = "prev";
      var prev = (currentIdx - 1 + totalSlides) % totalSlides;
      applySlideTransition(prev);
    }

    function startTimer() {
      if (timerRef) clearInterval(timerRef);
      timerRef = setInterval(gotoNext, autoplaySpeed);
    }

    prevBtn.addEventListener("click", function() { gotoPrev(); startTimer(); });
    nextBtnEl.addEventListener("click", function() { gotoNext(); startTimer(); });

    thumbEls.forEach(function(item, idx) {
      item.btn.addEventListener("click", function() { gotoSlide(idx); startTimer(); });
    });

    // Touch / swipe
    var touchStartX = null;
    section.addEventListener("touchstart", function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    section.addEventListener("touchend", function(e) {
      if (touchStartX === null) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 50) { gotoNext(); startTimer(); }
      else if (diff < -50) { gotoPrev(); startTimer(); }
      touchStartX = null;
    });

    // Initialize first slide content
    updateSlideContent(0);
    startTimer();
  }

  // ============================================================
  // 11. SAAS CAROUSEL (Before & After section for Dental)
  // ============================================================
  function initSaaSCarousel() {
    var section = document.getElementById("saas-carousel");
    if (!section) return;

    // The data-* attrs live on the inner div[data-saas-carousel]
    var dataEl = section.querySelector("[data-saas-carousel]");
    var autoplay = !dataEl || dataEl.getAttribute("data-autoplay") !== "false";
    var autoplaySpeed = dataEl ? parseInt(dataEl.getAttribute("data-autoplay-speed") || "3000", 10) : 3000;
    var infiniteLoop = !dataEl || dataEl.getAttribute("data-infinite-loop") !== "false";
    var pauseOnHover = !dataEl || dataEl.getAttribute("data-pause-on-hover") !== "false";
    var desktopCards = dataEl ? parseInt(dataEl.getAttribute("data-desktop-cards") || "3", 10) : 3;
    var tabletCards = dataEl ? parseInt(dataEl.getAttribute("data-tablet-cards") || "2", 10) : 2;
    var mobileCards = dataEl ? parseInt(dataEl.getAttribute("data-mobile-cards") || "1", 10) : 1;

    // Find the slider track: the flex container with inline display:flex style
    var track = section.querySelector('[style*="display: flex"], [style*="display:flex"]');
    if (!track) return;

    var slides = Array.from(track.children);
    if (slides.length === 0) return;
    var totalCards = slides.length;

    var currentIndex = 0;
    var cardsToShow = desktopCards;
    var isHovered = false;
    var timerRef = null;
    var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#4f46e5";

    function getCardsToShow() {
      var w = window.innerWidth;
      if (w < 768) return mobileCards;
      if (w < 1024) return tabletCards;
      return desktopCards;
    }

    function getMaxIndex() {
      return Math.max(0, totalCards - cardsToShow);
    }

    function updateTrack() {
      var pct = totalCards > 0 ? (currentIndex * 100) / totalCards : 0;
      track.style.transform = "translate3d(-" + pct + "%, 0, 0)";
      track.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    }

    // Find dots container
    var dotsContainer = section.querySelector(".mt-10.flex.items-center.justify-center, .mt-8.flex.items-center.justify-center");

    function updateDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      var maxIdx = getMaxIndex();
      for (var i = 0; i <= maxIdx; i++) {
        (function(idx) {
          var dot = document.createElement("button");
          dot.className = "h-2.5 rounded-full transition-all duration-300";
          if (idx === currentIndex) {
            dot.style.width = "24px";
            dot.style.backgroundColor = primaryColor;
          } else {
            dot.style.width = "10px";
            dot.style.backgroundColor = "rgba(0,0,0,0.12)";
          }
          dot.addEventListener("click", function() { currentIndex = idx; updateTrack(); updateDots(); });
          dotsContainer.appendChild(dot);
        })(i);
      }
    }

    function updateLayout() {
      cardsToShow = getCardsToShow();
      track.style.width = ((totalCards * 100) / cardsToShow) + "%";
      slides.forEach(function(slide) {
        slide.style.width = (100 / totalCards) + "%";
      });
      var maxIdx = getMaxIndex();
      if (currentIndex > maxIdx) currentIndex = maxIdx;
      updateTrack();
      updateDots();
    }

    function nextSlide() {
      var maxIdx = getMaxIndex();
      if (totalCards <= cardsToShow) return;
      if (currentIndex >= maxIdx) {
        if (infiniteLoop) currentIndex = 0; else return;
      } else {
        currentIndex++;
      }
      updateTrack(); updateDots();
    }

    function prevSlide() {
      var maxIdx = getMaxIndex();
      if (totalCards <= cardsToShow) return;
      if (currentIndex <= 0) {
        if (infiniteLoop) currentIndex = maxIdx; else return;
      } else {
        currentIndex--;
      }
      updateTrack(); updateDots();
    }

    // Arrow buttons: look for left/right arrow buttons in the section
    var allBtns = Array.from(section.querySelectorAll("button"));
    var prevBtn = null, nextBtn2 = null;
    allBtns.forEach(function(b) {
      var cls = b.className || "";
      if (cls.indexOf("left-2") !== -1 || cls.indexOf("-left-") !== -1) prevBtn = b;
      if (cls.indexOf("right-2") !== -1 || cls.indexOf("-right-") !== -1) nextBtn2 = b;
    });
    if (prevBtn) prevBtn.addEventListener("click", function() { prevSlide(); });
    if (nextBtn2) nextBtn2.addEventListener("click", function() { nextSlide(); });

    // Hover pause
    if (pauseOnHover) {
      section.addEventListener("mouseenter", function() { isHovered = true; });
      section.addEventListener("mouseleave", function() { isHovered = false; });
    }

    // Autoplay
    function startAutoplay() {
      if (!autoplay) return;
      if (timerRef) clearInterval(timerRef);
      timerRef = setInterval(function() { if (!isHovered) nextSlide(); }, autoplaySpeed);
    }

    // Touch / swipe
    var touchStartX = null;
    track.addEventListener("touchstart", function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function(e) {
      if (touchStartX === null) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 50) nextSlide();
      else if (diff < -50) prevSlide();
      touchStartX = null;
    });

    window.addEventListener("resize", updateLayout);
    updateLayout();
    startAutoplay();
  }

  // ============================================================
  // 12. RESTAURANT DRAWER & MENU TABS INTERACTIVITY
  // ============================================================
  function initRestaurantFeatures() {
    // A. Restaurant Header Slide-over Drawer
    var drawer = document.querySelector(".fixed.inset-y-0.left-0.w-full.sm\\:max-w-md");
    if (drawer) {
      var menuButtons = document.querySelectorAll("header button");
      menuButtons.forEach(function(btn) {
        if (btn.textContent && btn.textContent.indexOf("Menu") !== -1) {
          btn.addEventListener("click", function(e) {
            e.stopPropagation();
            drawer.classList.remove("-translate-x-full");
            drawer.classList.add("translate-x-0");
          });
        }
      });

      var backBtn = drawer.querySelector("button");
      if (backBtn) {
        backBtn.addEventListener("click", function() {
          drawer.classList.remove("translate-x-0");
          drawer.classList.add("-translate-x-full");
        });
      }

      var drawerLinks = drawer.querySelectorAll("nav a");
      drawerLinks.forEach(function(link) {
        link.addEventListener("click", function() {
          drawer.classList.remove("translate-x-0");
          drawer.classList.add("-translate-x-full");
        });
      });
    }

    // B. Restaurant Gourmet Menu Tabs
    var menuSection = document.getElementById("restaurant-menu");
    if (menuSection) {
      var tabButtons = menuSection.querySelectorAll("button[data-menu-tab]");
      var dishItems = menuSection.querySelectorAll("[data-menu-category]");

      tabButtons.forEach(function(tabBtn) {
        tabBtn.addEventListener("click", function() {
          var targetCat = tabBtn.getAttribute("data-menu-tab");

          tabButtons.forEach(function(b) {
            b.classList.remove("text-[#c5a880]", "border-[#c5a880]");
            b.classList.add("text-stone-400", "border-transparent");
          });
          tabBtn.classList.remove("text-stone-400", "border-transparent");
          tabBtn.classList.add("text-[#c5a880]", "border-[#c5a880]");

          dishItems.forEach(function(dish) {
            var dishCat = dish.getAttribute("data-menu-category");
            if (dishCat === targetCat) {
              dish.style.display = "flex";
            } else {
              dish.style.display = "none";
            }
          });
        });
      });
    }
  }

  // ── Initialize everything ──
  initReviewsCarousel();
  initSaaSProductCarousel();
  initFaqAccordion();
  initTeamCarousel();
  initGallery();
  initHospitalHeroSlider();
  initSaaSCarousel();
  initRestaurantFeatures();
});