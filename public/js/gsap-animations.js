// GSAP discreet micro-animations for Wholesale Platform
// Non-blocking, respect reduced-motion, smooth tactile feedback

export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function animateHeroEntrance() {
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;

  const tl = window.gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.6 } });

  tl.from('.search-hero-card', { opacity: 0, y: -10, duration: 0.45 })
    .from('.gammes-card', { opacity: 0, y: 12, duration: 0.45 }, '-=0.2')
    .from('.hero-badge-tag', { opacity: 0, y: -12, duration: 0.4 }, '-=0.2')
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
    { opacity: 1, y: 0, stagger: 0.035, duration: 0.35, ease: 'power2.out' }
  );
}

export function animateAddToCartFeedback(buttonElement) {
  if (!buttonElement) return;

  if (isReducedMotion() || typeof window.gsap === 'undefined') {
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
  animateCartPulse();
}

export function animateCartPulse() {
  const badges = document.querySelectorAll('.cart-badge, .bottom-nav-badge');
  const cartBtn = document.getElementById('cart-toggle-btn');
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;

  if (cartBtn) {
    window.gsap.timeline()
      .to(cartBtn, { scale: 1.08, duration: 0.12, ease: 'back.out(2)' })
      .to(cartBtn, { scale: 1, duration: 0.15, ease: 'power1.out' });
  }

  if (badges.length) {
    window.gsap.timeline()
      .to(badges, { scale: 1.45, duration: 0.15, ease: 'back.out(2.5)' })
      .to(badges, { scale: 1, duration: 0.15, ease: 'power1.out' });
  }
}

export function animateSearchFocus(inputElement) {
  if (!inputElement) return;
  inputElement.focus();
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;

  const wrapper = inputElement.parentElement || inputElement;
  window.gsap.fromTo(wrapper,
    { scale: 0.98, boxShadow: '0 0 0 5px rgba(13, 92, 117, 0.4)' },
    { scale: 1, boxShadow: '0 0 0 3px rgba(13, 92, 117, 0.15)', duration: 0.35, ease: 'back.out(2)' }
  );
}

export function animateBrandPillClick(pillElement) {
  if (!pillElement || isReducedMotion() || typeof window.gsap === 'undefined') return;

  window.gsap.timeline()
    .to(pillElement, { scale: 0.92, duration: 0.08, ease: 'power1.in' })
    .to(pillElement, { scale: 1.05, duration: 0.12, ease: 'back.out(2)' })
    .to(pillElement, { scale: 1, duration: 0.1, ease: 'power1.out' });
}

export function animateGammeCardSelect(cardElement) {
  if (!cardElement || isReducedMotion() || typeof window.gsap === 'undefined') return;

  window.gsap.timeline()
    .to(cardElement, { scale: 0.96, duration: 0.1, ease: 'power1.in' })
    .to(cardElement, { scale: 1.03, duration: 0.16, ease: 'back.out(2.5)' })
    .to(cardElement, { scale: 1, duration: 0.12, ease: 'power1.out' });
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


export function animateThreeEntrance() {
  if (isReducedMotion() || typeof window.gsap === 'undefined') return;
  const card = document.getElementById('hero-visual-card');
  if (!card) return;

  window.gsap.fromTo(card,
    { opacity: 0, scale: 0.94, y: 16 },
    { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' }
  );
}


export function animateDrawerClose(drawerElement, onComplete) {
  if (!drawerElement) {
    if (onComplete) onComplete();
    return;
  }

  if (isReducedMotion() || typeof window.gsap === 'undefined') {
    drawerElement.style.transform = '';
    if (onComplete) onComplete();
    return;
  }

  window.gsap.to(drawerElement, {
    x: '100%',
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      drawerElement.style.transform = '';
      if (onComplete) onComplete();
    }
  });
}
