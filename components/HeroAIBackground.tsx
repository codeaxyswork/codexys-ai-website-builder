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

    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
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

    // 22 Very Light, Delicate & Soft Futuristic Motes
    const particleCount = 22;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      glowColor: string;
      alpha: number;
      baseAlpha: number;
      pulseSpeed: number;
      phase: number;
    }

    const palette = [
      { core: "rgba(168, 85, 247, ", glow: "rgba(168, 85, 247, " }, // Soft Violet
      { core: "rgba(99, 102, 241, ", glow: "rgba(99, 102, 241, " },  // Soft Indigo
      { core: "rgba(6, 182, 212, ", glow: "rgba(6, 182, 212, " },   // Soft Cyan
      { core: "rgba(192, 38, 211, ", glow: "rgba(192, 38, 211, " }, // Soft Fuchsia
    ];

    const particles: Particle[] = Array.from({ length: particleCount }, () => {
      const p = palette[Math.floor(Math.random() * palette.length)];
      const baseAlpha = 0.16 + Math.random() * 0.18;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.08 - Math.random() * 0.18, // Ultra-slow peaceful flow
        radius: 1.0 + Math.random() * 0.8,
        color: p.core,
        glowColor: p.glow,
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: 0.008 + Math.random() * 0.015,
        phase: Math.random() * Math.PI * 2,
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Update & Render Flowing Light Particles
      particles.forEach((p) => {
        // Continuous slow upward & drifting movement
        p.x += p.vx;
        p.y += p.vy;

        // Subtle interactive mouse curvature
        if (mouse.x > 0) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = (1 - dist / 120) * 0.25;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Smooth boundary wrapping
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Soft breathing alpha pulse
        p.phase += p.pulseSpeed;
        p.alpha = Math.max(0.10, Math.min(0.38, p.baseAlpha + Math.sin(p.phase) * 0.12));

        // Soft outer glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `${p.glowColor}${p.alpha * 0.35})`;
        ctx.fill();

        // Very light particle core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
      });

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
