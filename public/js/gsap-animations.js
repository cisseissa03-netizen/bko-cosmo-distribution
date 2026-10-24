// GSAP discreet micro-animations for Wholesale Platform
// Non-blocking, respect reduced-motion, smooth tactile feedback

export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function animateHeroEntrance() {
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;

  const tl = window.gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.6 } });

  tl.from('.hero-badge-tag', { opacity: 0, y: -12, duration: 0.4 })
    .from('.hero-title', { opacity: 0, y: 16, duration: 0.5 }, '-=0.2')
    .from('.hero-description', { opacity: 0, y: 14, duration: 0.5 }, '-=0.3')
    .from('.hero-ctas > *', { opacity: 0, y: 12, stagger: 0.1, duration: 0.4 }, '-=0.2')
    .from('.hero-visual-card', { opacity: 0, scale: 0.98, duration: 0.6 }, '-=0.4')
    .from('.hero-rules-highlights .rule-highlight-item', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4 }, '-=0.2');
}

export function animateProductCards(containerSelector = '.products-grid') {
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;

  const cards = document.querySelectorAll(`${containerSelector} .product-card`);
  if (!cards.length) return;

  window.gsap.fromTo(cards,
    { opacity: 0, y: 18 },
    { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' }
  );
}

export function animateAddToCartFeedback(buttonElement) {
  if (!buttonElement) return;

  if (isReducedMotion() || typeof window.gsap === 'undefined') {
    // Basic fallback visual pulse
    buttonElement.style.transform = 'scale(0.96)';
    setTimeout(() => { buttonElement.style.transform = 'none'; }, 150);
    return;
  }

  // Tactile GSAP bounce
  window.gsap.timeline()
    .to(buttonElement, { scale: 0.94, duration: 0.1, ease: 'power1.in' })
    .to(buttonElement, { scale: 1.05, duration: 0.15, ease: 'back.out(2)' })
    .to(buttonElement, { scale: 1, duration: 0.15, ease: 'power1.out' });

  // Animate cart badge indicator
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    window.gsap.timeline()
      .to(badge, { scale: 1.35, duration: 0.15, ease: 'back.out(2)' })
      .to(badge, { scale: 1, duration: 0.15, ease: 'power1.out' });
  }
}

export function animateQuantityChange(numberElement) {
  if (!numberElement || isReducedMotion() || typeof window.gsap === 'undefined') return;

  window.gsap.fromTo(numberElement,
    { scale: 1.25, color: '#0d5c75' },
    { scale: 1, color: '#0f172a', duration: 0.25, ease: 'power2.out' }
  );
}

export function animateDrawerOpen(drawerElement) {
  if (!drawerElement || isReducedMotion() || typeof window.gsap === 'undefined') return;

  window.gsap.fromTo(drawerElement,
    { x: '100%' },
    { x: '0%', duration: 0.35, ease: 'power3.out' }
  );
}
