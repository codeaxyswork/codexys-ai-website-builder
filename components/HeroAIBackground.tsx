"use client";

import React, { useEffect, useRef } from "react";

export function HeroAIBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Mouse tracking with smooth lerp interpolation
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const tx = e.clientX - rect.left;
      const ty = e.clientY - rect.top;

      // Snap mouse position on first enter to prevent trailing from offscreen
      if (mouse.targetX < -500) {
        mouse.x = tx;
        mouse.y = ty;
      }
      mouse.targetX = tx;
      mouse.targetY = ty;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      if (!canvas) return;
      const parent = canvas.parentElement;
      const w = Math.max(window.innerWidth, parent?.offsetWidth || 0, canvas.offsetWidth || 0);
      const h = Math.max(680, parent?.offsetHeight || 0, canvas.offsetHeight || 0);
      width = canvas.width = w;
      height = canvas.height = h;
    };

    handleResize();
    const timer = setTimeout(handleResize, 100);

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const gridSpacing = 20; // Fixed 20px grid spacing
    const spotlightRadius = 150; // Exact 150px circular spotlight area
    const baseOpacity = 0.25; // Base subtle opacity outside spotlight

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Fast, responsive & silky mouse tracking
      if (mouse.x > -500 && mouse.targetX > -500) {
        mouse.x += (mouse.targetX - mouse.x) * 0.22;
        mouse.y += (mouse.targetY - mouse.y) * 0.22;
      }

      const cols = Math.ceil(width / gridSpacing);
      const rows = Math.ceil(height / gridSpacing);

      // Render fixed grid dots with 150px smooth spotlight effect
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gridSpacing + 10;
          const y = r * gridSpacing + 10;

          // Mask fade matching hero central ellipse
          const maskCenterX = width / 2;
          const maskCenterY = height * 0.4;
          const maskDx = (x - maskCenterX) / (width * 0.65);
          const maskDy = (y - maskCenterY) / (height * 0.55);
          const maskDist = Math.sqrt(maskDx * maskDx + maskDy * maskDy);
          if (maskDist > 1.0) continue; // Fade beyond bounds

          const edgeFade = Math.max(0, 1 - Math.pow(maskDist, 2));
          const currentBaseAlpha = baseOpacity * edgeFade;

          let alpha = currentBaseAlpha;
          let falloff = 0;

          // 150px radial spotlight calculation - 100% FULLY OPAQUE VIVID PURPLE DOTS under mouse
          if (mouse.x > -500 && mouse.y > -500) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < spotlightRadius) {
              const normDist = dist / spotlightRadius;
              // Smooth cosine falloff from center (1.0) to 150px edge (0.0)
              falloff = 0.5 * (Math.cos(normDist * Math.PI) + 1);

              // Smoothly increase opacity up to 100% solid purple (1.0) under cursor
              const spotlightAlpha = currentBaseAlpha + falloff * (1.0 - currentBaseAlpha);
              alpha = Math.max(alpha, spotlightAlpha);
            }
          }

          if (alpha <= 0.01) continue;

          // Keep dots crisp vivid purple (147, 51, 234) so they NEVER turn white or wash out
          // Radius smoothly expands from 1.0px -> 1.4px under spotlight for maximum visual clarity
          const rRadius = 1.0 + falloff * 0.4;

          // Draw fixed grid dot
          ctx.beginPath();
          ctx.arc(x, y, rRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    />
  );
}
