import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

const ParticleBackground = ({ className = "fixed top-0 left-0 w-full h-full pointer-events-none z-0" }) => {
    const canvasRef = useRef(null);
    const { theme } = useTheme();

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return; // Exit if context is not available (e.g. in tests)
        let animationFrameId;

        // Configuration based on theme
        const isDark = theme === 'dark';
        // Increased opacity for better visibility
        const particleColor = isDark ? 'rgba(99, 102, 241, 0.8)' : 'rgba(60, 35, 215, 0.8)';
        const lineColor = isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(60, 35, 215, 0.2)';
        const particleCount = 40; // Significantly reduced count for less clutter
        const connectionDistance = 150;
        const mouseDistance = 200;

        let width = canvas.width = canvas.offsetWidth || window.innerWidth;
        let height = canvas.height = canvas.offsetHeight || window.innerHeight;

        const particles = [];

        // Mouse state
        const mouse = { x: null, y: null };

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 1; // Velocity X
                this.vy = (Math.random() - 0.5) * 1; // Velocity Y
                // Increased size: Random between 4 and 8
                this.size = Math.random() * 4 + 4;
                // Randomly assign a type: 0 = Plus, 1 = Heart, 2 = Circle (fewer circles)
                this.type = Math.floor(Math.random() * 3);
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse interaction
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouseDistance) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouseDistance - distance) / mouseDistance;

                    const pushForce = force * 2;
                    this.vx -= forceDirectionX * 0.05 * pushForce;
                    this.vy -= forceDirectionY * 0.05 * pushForce;
                }
            }

            draw() {
                // Drawing handled per type below

                if (this.type === 0) {
                    // Red Circle with White Plus
                    // Draw Red Circle
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(220, 38, 38, 0.9)';
                    ctx.fill();

                    // Draw White Plus
                    ctx.fillStyle = '#ffffff';
                    const armWidth = this.size * 0.5;
                    const size = this.size * 0.8;
                    ctx.beginPath();
                    ctx.rect(this.x - armWidth / 2, this.y - size, armWidth, size * 2);
                    ctx.rect(this.x - size, this.y - armWidth / 2, size * 2, armWidth);
                    ctx.fill();
                } else if (this.type === 1) {
                    // Heart Shape (<3)
                    ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(220, 38, 38, 0.9)'; // Red for heart
                    ctx.beginPath();
                    const size = this.size;
                    const x = this.x;
                    const y = this.y - size / 2; // Offset to center
                    ctx.moveTo(x, y + size / 2);
                    ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size / 2);
                    ctx.bezierCurveTo(x - size, y + size * 1.5, x, y + size * 1.8, x, y + size * 2.2);
                    ctx.bezierCurveTo(x, y + size * 1.8, x + size, y + size * 1.5, x + size, y + size / 2);
                    ctx.bezierCurveTo(x + size, y, x, y, x, y + size / 2);
                    ctx.fill();
                } else {
                    // Small Circle (Node)
                    ctx.fillStyle = particleColor;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        const init = () => {
            particles.length = 0;
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            // Draw connections
            connectParticles();

            animationFrameId = requestAnimationFrame(animate);
        };

        const connectParticles = () => {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < connectionDistance) {
                        ctx.beginPath();
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }

                // Connect to mouse
                if (mouse.x != null) {
                    const dx = particles[i].x - mouse.x;
                    const dy = particles[i].y - mouse.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < mouseDistance) {
                        ctx.beginPath();
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }
        };

        const handleResize = () => {
            width = canvas.width = canvas.offsetWidth || window.innerWidth;
            height = canvas.height = canvas.offsetHeight || window.innerHeight;
            init();
        };

        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.x = null;
            mouse.y = null;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseLeave);

        init();
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, [theme]);

    if (process.env.NODE_ENV === 'test') {
        return null;
    }

    return (
        <canvas
            ref={canvasRef}
            className={className}
        />
    );
};

export default ParticleBackground;
