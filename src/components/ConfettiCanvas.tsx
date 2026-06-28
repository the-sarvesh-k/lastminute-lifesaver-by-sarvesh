import React, { useEffect, useRef } from "react";

type ConfettiListener = (x?: number, y?: number) => void;
const listeners = new Set<ConfettiListener>();

export const triggerConfetti = (x?: number, y?: number) => {
  listeners.forEach((l) => l(x, y));
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export const ConfettiCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#3B82F6", "#8B5CF6"];

    const addConfetti = (x?: number, y?: number) => {
      const spawnX = x !== undefined ? x : canvas.width / 2;
      const spawnY = y !== undefined ? y : canvas.height / 2;

      const newParticles: Particle[] = [];
      const count = x !== undefined ? 50 : 150; // more particles for full screen triggers

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        newParticles.push({
          x: spawnX,
          y: spawnY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (x !== undefined ? 2 : 4), // extra upward boost
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 10 - 5,
          opacity: 1,
        });
      }

      particlesRef.current = [...particlesRef.current, ...newParticles];
    };

    listeners.add(addConfetti);

    let animationId: number;
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const nextParticles: Particle[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.vx *= 0.98; // friction
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.015;

        if (p.opacity > 0 && p.y < canvas.height) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          nextParticles.push(p);
        }
      }

      particlesRef.current = nextParticles;
      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("resize", handleResize);
      listeners.delete(addConfetti);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
      id="confetti-canvas-overlay"
    />
  );
};
export default ConfettiCanvas;
