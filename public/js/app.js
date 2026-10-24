// Client-side Application for BKO Cosmo Distribution (Bamako Wholesale)
import { isQuantityAllowed, getInitialQuantity, getNextQuantity, getPrevQuantity, formatFCFA } from './rules.js';
import { animateHeroEntrance, animateProductCards, animateAddToCartFeedback, animateQuantityChange, animateDrawerOpen, animateSearchFocus, animateBrandPillClick } from './gsap-animations.js';
import { initHeroThree } from './three-hero.js';

// Application State
const state = {
  products: [],
  filteredProducts: [],
  cart: [],
  currentTab: 'home', // 'home' | 'catalog' | 'quick-order' | 'arrivages' | 'track'
  currentCategory: 'all',
  currentBrand: 'all',
  searchQuery: '',
  arrivageFilter: 'all',
  selectedProduct: null,
  isCartDrawerOpen: false,
  isCheckoutModalOpen: false,
  isSubmittingOrder: false,
  lastOrderResult: null,
  localQuantities: {},
  settings: {
    companyName: 'BKO COSMO DISTRIBUTION (Démonstration)',
    whatsappNumber: '+22370000000',
    currency: 'FCFA'
  }
};

const CART_STORAGE_KEY = 'bko_cosmo_cart_v1';

const BAMAKO_QUARTIERS = [
  'ACI 2000',
  'Hamdallaye',
  'Badalabougou',
  'Faladié',
  'Korofina',
  'Niaréla',
  'Quinzambougou',
  'Bacodjicoroni Golf',
  'Kalaban Coura',
  'Sotuba / Zone Industrielle',
  'Magnambougou',
  'Dravela / Bolibana',
  'Missira',
  'Hippodrome',
  'Yirimadio',
  'Sébénicoro',
  'Djélibougou',
  'Autre quartier de Bamako'
];

/* Safe JS String escaping helper */
function escapeJs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ========================================================
   REGISTER PUBLIC WINDOW.APP IMMEDIATELY
   (Prevents any "window.app is undefined" on button clicks)
======================================================== */
window.app = {
  switchTab,
  stepQuantity,
  addToCart,
  updateCartItemQty,
  removeCartItem,
  openCartDrawer,
  closeCartDrawer,
  openProductModal,
  closeProductModal,
  openCheckoutModal,
  closeCheckoutModal,
  handleNeighborhoodChange,
  handleOrderSubmit,
  trackOrderDirect,
  shareArrivagesOnWhatsApp,
  filterByBrand,
  filterByCategory,
  clearSearch,
  resetAllFilters,
  selectBrandFromSearch,
  toggleHeroMode,
  promptPwaInstall,
  closeIosModal
};

/* ========================================================
   ROUTER & TABS SWITCHING
======================================================== */
function switchTab(tabName) {
  if (!tabName) return;
  state.currentTab = tabName;

  // Nav link active classes
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });

  // Mobile bottom bar active classes
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Toggle view panels
  const tabs = ['home', 'catalog', 'quick-order', 'arrivages', 'track'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-view-${t}`);
    if (el) el.style.display = (t === tabName) ? 'block' : 'none';
  });

  // Render & scroll behavior
  if (tabName === 'catalog') {
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'quick-order') {
    renderQuickOrderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'arrivages') {
    renderArrivagesList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Close mobile nav if open
  const mobileNav = document.getElementById('mobile-nav-panel');
  if (mobileNav) mobileNav.classList.remove('open');
}

/* ========================================================
   INITIALIZATION FUNCTION
======================================================== */
function init() {
  loadCartFromStorage();
  updateCartBadge();
  setupEventListeners();
  initPwa();

  fetchSettings();
  fetchProducts();

  // Non-blocking visual initializations
  try { initHeroThree(); } catch (e) { console.warn('Three init non-critical error:', e); }
  try { animateHeroEntrance(); } catch (e) { console.warn('GSAP init non-critical error:', e); }
}

// Support both already-loaded and loading states
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ========================================================
   PWA INSTALLATION & SERVICE WORKER
======================================================== */
let deferredPrompt = null;

function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('PWA ServiceWorker ready, scope:', reg.scope))
        .catch(err => console.warn('PWA ServiceWorker registration issue:', err));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwa-install-header-btn');
    if (btn) btn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('pwa-install-header-btn');
    if (btn) btn.style.display = 'none';
    showToastNotification('✓ BKO Cosmo installée avec succès sur votre appareil !', 'online');
  });

  window.addEventListener('online', () => {
    showToastNotification('✓ Connexion Internet rétablie.', 'online');
  });
  window.addEventListener('offline', () => {
    showToastNotification('📶 Mode Hors-Ligne : vous pouvez continuer à préparer votre demande.', 'warning');
  });
}

function promptPwaInstall() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isStandalone) {
    alert('✓ L\'application BKO Cosmo est déjà installée et active sur votre appareil.');
    return;
  }

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const btn = document.getElementById('pwa-install-header-btn');
        if (btn) btn.style.display = 'none';
      }
      deferredPrompt = null;
    });
    return;
  }

  if (isIos) {
    openIosModal();
    return;
  }

  alert('Pour installer l\'application sur votre écran d\'accueil :\n\n1. Cliquez sur le menu de votre navigateur (les 3 points ou l\'icône Installer dans la barre d\'adresse).\n2. Cliquez sur « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».\n3. L\'icône BKO Cosmo apparaîtra instantanément avec vos applications !');
}

function openIosModal() {
  const modal = document.getElementById('pwa-ios-modal');
  if (modal) modal.classList.add('active');
}

function closeIosModal() {
  const modal = document.getElementById('pwa-ios-modal');
  if (modal) modal.classList.remove('active');
}

function showToastNotification(message, type = 'online') {
  const toast = document.getElementById('offline-status-toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `offline-status-toast ${type}`;
  toast.style.display = 'flex';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

/* ========================================================
   API DATA FETCHING
======================================================== */
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      state.settings = await res.json();
      updateHeaderWhatsApp();
      applyHeroVisualSettings();
    }
  } catch (e) {
    console.warn('Could not fetch settings, using defaults.', e);
  }
}

function applyHeroVisualSettings() {
  if (!state.settings) return;
  const mainPhoto = document.getElementById('hero-main-photo');
  if (mainPhoto && state.settings.heroImage) {
    mainPhoto.src = state.settings.heroImage;
  }

  const is3DDefault = state.settings.heroDisplayMode === '3d';
  const photoWrapper = document.getElementById('hero-photo-wrapper');
  const canvas = document.getElementById('hero-three-canvas');
  const toggleModeBtn = document.getElementById('toggle-hero-mode-btn');
  const togglePauseBtn = document.getElementById('toggle-3d-btn');
  const captionText = document.getElementById('hero-visual-caption-text');

  if (is3DDefault) {
    if (photoWrapper) photoWrapper.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    if (toggleModeBtn) toggleModeBtn.textContent = '📸 Voir la Photo';
    if (togglePauseBtn) togglePauseBtn.style.display = 'inline-block';
    if (captionText) captionText.textContent = 'Composition 3D stylisée (Three.js)';
  } else {
    if (photoWrapper) photoWrapper.style.display = 'flex';
    if (canvas) canvas.style.display = 'none';
    if (toggleModeBtn) toggleModeBtn.textContent = '🧊 Voir en 3D';
    if (togglePauseBtn) togglePauseBtn.style.display = 'none';
    if (captionText) captionText.textContent = '📸 Présentation visuelle des gammes';
  }
}

function toggleHeroMode() {
  const photoWrapper = document.getElementById('hero-photo-wrapper');
  const canvas = document.getElementById('hero-three-canvas');
  const toggleModeBtn = document.getElementById('toggle-hero-mode-btn');
  const togglePauseBtn = document.getElementById('toggle-3d-btn');
  const captionText = document.getElementById('hero-visual-caption-text');

  if (!photoWrapper || !canvas) return;

  const isPhotoCurrentlyShown = photoWrapper.style.display !== 'none';

  if (isPhotoCurrentlyShown) {
    // Switch to 3D
    photoWrapper.style.display = 'none';
    canvas.style.display = 'block';
    if (toggleModeBtn) toggleModeBtn.textContent = '📸 Voir la Photo';
    if (togglePauseBtn) togglePauseBtn.style.display = 'inline-block';
    if (captionText) captionText.textContent = 'Composition 3D stylisée (Three.js)';
  } else {
    // Switch to Photo
    photoWrapper.style.display = 'flex';
    canvas.style.display = 'none';
    if (toggleModeBtn) toggleModeBtn.textContent = '🧊 Voir en 3D';
    if (togglePauseBtn) togglePauseBtn.style.display = 'none';
    if (captionText) captionText.textContent = '📸 Présentation visuelle des gammes';
  }
}

async function fetchProducts() {
  const gridEl = document.getElementById('products-grid');
  if (gridEl) {
    gridEl.innerHTML = '<div class="state-feedback-box"><p>Chargement du catalogue en gros...</p></div>';
  }

  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Erreur réseau');
    state.products = await res.json();
    
    state.products.forEach(p => {
      state.localQuantities[p.id] = getInitialQuantity(p);
    });

    renderBrandPills();
    applyFilters();
    renderQuickOrderList();
    renderArrivagesList();
    renderHomeFeatured();
  } catch (err) {
    console.error('Error fetching products:', err);
    if (gridEl) {
      gridEl.innerHTML = `
        <div class="state-feedback-box">
          <p style="color:var(--danger)">Impossible de charger les produits. Veuillez vérifier votre connexion.</p>
          <button class="btn-primary-large" style="margin-top:12px;" onclick="window.location.reload()">Réessayer</button>
        </div>`;
    }
  }
}

function updateHeaderWhatsApp() {
  const waBtn = document.getElementById('header-whatsapp-btn');
  if (waBtn && state.settings.whatsappNumber) {
    const cleanNum = state.settings.whatsappNumber.replace(/[^0-9]/g, '');
    waBtn.href = `https://wa.me/${cleanNum}?text=${encodeURIComponent('Bonjour, je souhaite me renseigner sur votre catalogue cosmétique en gros à Bamako.')}`;
  }
}

/* ========================================================
   CART PERSISTENCE & HELPERS
======================================================== */
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      state.cart = JSON.parse(saved);
    }
  } catch (e) {
    state.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
  } catch (e) {
    console.error('Failed to save cart to localStorage', e);
  }
}

function updateCartBadge() {
  const badgeEl = document.querySelector('.cart-badge');
  const sumEl = document.querySelector('.cart-price-sum');
  const totalUnits = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

  if (badgeEl) badgeEl.textContent = totalUnits;
  if (sumEl) sumEl.textContent = formatFCFA(totalAmount);

  const stickyUnits = document.getElementById('sticky-cart-units');
  const stickyTotal = document.getElementById('sticky-cart-total');
  if (stickyUnits) stickyUnits.textContent = `${totalUnits} unité${totalUnits > 1 ? 's' : ''}`;
  if (stickyTotal) stickyTotal.textContent = formatFCFA(totalAmount);

  const bottomBadge = document.getElementById('bottom-cart-badge');
  if (bottomBadge) {
    bottomBadge.textContent = totalUnits;
    bottomBadge.style.display = totalUnits > 0 ? 'inline-block' : 'none';
  }
}

/* ========================================================
   CATALOG FILTERING, BRAND 1-CLICK & RENDERING
======================================================== */
function renderBrandPills() {
  const brandPillsRow = document.getElementById('brand-pills-row');
  const quickPillsRow = document.getElementById('quick-order-brand-pills');
  const brandSelect = document.getElementById('brand-select');

  const brandCounts = {};
  state.products.forEach(p => {
    if (p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    }
  });

  const brands = Object.keys(brandCounts).sort((a, b) => a.localeCompare(b, 'fr'));

  if (brandSelect) {
    brandSelect.innerHTML = `<option value="all">Toutes les marques (${state.products.length})</option>`;
    brands.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = `${b} (${brandCounts[b]})`;
      if (state.currentBrand.toLowerCase() === b.toLowerCase()) opt.selected = true;
      brandSelect.appendChild(opt);
    });
  }

  if (brandPillsRow) {
    const isAllActive = state.currentBrand === 'all';
    let html = `
      <button type="button" class="brand-pill-btn ${isAllActive ? 'active' : ''}" data-brand="all" onclick="window.app.filterByBrand('all')">
        <span>🌟 Toutes</span>
        <span class="brand-pill-count">${state.products.length}</span>
      </button>
    `;

    brands.forEach(b => {
      const isActive = state.currentBrand.toLowerCase() === b.toLowerCase();
      html += `
        <button type="button" class="brand-pill-btn ${isActive ? 'active' : ''}" data-brand="${b}" onclick="window.app.filterByBrand('${escapeJs(b)}')">
          <span>🏷️ ${b}</span>
          <span class="brand-pill-count">${brandCounts[b]}</span>
        </button>
      `;
    });

    brandPillsRow.innerHTML = html;
  }

  if (quickPillsRow) {
    const isAllActive = state.currentBrand === 'all';
    let quickHtml = `
      <button type="button" class="brand-pill-btn ${isAllActive ? 'active' : ''}" onclick="window.app.filterByBrand('all')">
        <span>🌟 Toutes</span>
        <span class="brand-pill-count">${state.products.length}</span>
      </button>
    `;

    brands.forEach(b => {
      const isActive = state.currentBrand.toLowerCase() === b.toLowerCase();
      quickHtml += `
        <button type="button" class="brand-pill-btn ${isActive ? 'active' : ''}" onclick="window.app.filterByBrand('${escapeJs(b)}')">
          <span>🏷️ ${b}</span>
          <span class="brand-pill-count">${brandCounts[b]}</span>
        </button>
      `;
    });

    quickPillsRow.innerHTML = quickHtml;
  }
}

function checkBrandMatch(query) {
  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (!suggestionsBox) return;

  const trimmed = (query || '').trim().toLowerCase();
  if (trimmed.length < 2) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
    return;
  }

  const brandCounts = {};
  state.products.forEach(p => {
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  });

  const matchingBrands = Object.keys(brandCounts).filter(b => 
    b.toLowerCase().includes(trimmed)
  );

  if (matchingBrands.length === 0) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
    return;
  }

  // Exact match auto-selects brand in 1 click
  const exactMatch = matchingBrands.find(b => b.toLowerCase() === trimmed);
  if (exactMatch && state.currentBrand.toLowerCase() !== exactMatch.toLowerCase()) {
    state.currentBrand = exactMatch;
    renderBrandPills();
  }

  suggestionsBox.style.display = 'flex';
  suggestionsBox.innerHTML = `
    <span class="suggestion-label">⚡ Marque détectée en recherche :</span>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      ${matchingBrands.map(b => `
        <button type="button" class="brand-quick-match-pill" onclick="window.app.selectBrandFromSearch('${escapeJs(b)}')">
          <span>🏷️ Filtrer sur <strong>${b}</strong> (${brandCounts[b]} réf.)</span>
          <span style="font-size:0.7rem; background:rgba(13,92,117,0.12); padding:1px 6px; border-radius:10px;">1 clic ➔</span>
        </button>
      `).join('')}
    </div>
  `;
}

function selectBrandFromSearch(brandName) {
  state.searchQuery = '';
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
  }

  filterByBrand(brandName);
}

function filterByBrand(brandName) {
  state.currentBrand = brandName;
  renderBrandPills();

  if (state.searchQuery && state.searchQuery.trim().toLowerCase() === brandName.toLowerCase()) {
    state.searchQuery = '';
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.style.display = 'none';
  }

  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
  }

  applyFilters();
  renderQuickOrderList();

  if (state.currentTab !== 'catalog' && state.currentTab !== 'quick-order') {
    switchTab('catalog');
  }

  const catalogGrid = document.getElementById('products-grid');
  if (catalogGrid && state.currentTab === 'catalog') {
    catalogGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function filterByCategory(categoryName) {
  state.currentCategory = categoryName;
  document.querySelectorAll('.pill-filter').forEach(pill => {
    pill.classList.toggle('active', (pill.dataset.category || 'all') === categoryName);
  });
  applyFilters();
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
  }
  applyFilters();
}

function resetAllFilters() {
  state.currentCategory = 'all';
  state.currentBrand = 'all';
  state.searchQuery = '';

  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
  }

  document.querySelectorAll('.pill-filter').forEach(p => {
    p.classList.toggle('active', p.dataset.category === 'all');
  });

  renderBrandPills();
  applyFilters();
  renderQuickOrderList();
}

function updateActiveFilterBadges() {
  const container = document.getElementById('active-filters-badges');
  if (!container) return;

  const hasBrand = state.currentBrand !== 'all';
  const hasCat = state.currentCategory !== 'all';
  const hasSearch = Boolean(state.searchQuery && state.searchQuery.trim());

  if (!hasBrand && !hasCat && !hasSearch) {
    container.innerHTML = '';
    return;
  }

  let html = '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">';
  html += '<span style="font-size:0.75rem; color:var(--text-light); font-weight:700;">Filtres actifs :</span>';

  if (hasBrand) {
    html += `
      <span class="active-filter-pill">
        🏷️ Marque: <strong>${state.currentBrand}</strong>
        <button type="button" class="active-filter-remove" onclick="window.app.filterByBrand('all')" aria-label="Supprimer filtre marque">✕</button>
      </span>
    `;
  }

  if (hasCat) {
    html += `
      <span class="active-filter-pill">
        📂 Catégorie: <strong>${state.currentCategory}</strong>
        <button type="button" class="active-filter-remove" onclick="window.app.filterByCategory('all')" aria-label="Supprimer filtre catégorie">✕</button>
      </span>
    `;
  }

  if (hasSearch) {
    html += `
      <span class="active-filter-pill">
        🔍 "<strong>${state.searchQuery}</strong>"
        <button type="button" class="active-filter-remove" onclick="window.app.clearSearch()" aria-label="Effacer recherche">✕</button>
      </span>
    `;
  }

  html += `<button type="button" class="btn-clear-all-filters" onclick="window.app.resetAllFilters()">Effacer tout ✕</button>`;
  html += '</div>';

  container.innerHTML = html;
}

function applyFilters() {
  let list = [...state.products];

  if (state.currentCategory !== 'all') {
    list = list.filter(p => p.category === state.currentCategory);
  }

  if (state.currentBrand !== 'all') {
    list = list.filter(p => p.brand.toLowerCase() === state.currentBrand.toLowerCase());
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.ref.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  state.filteredProducts = list;
  renderCatalogGrid();
  updateActiveFilterBadges();
}

function renderCatalogGrid() {
  const gridEl = document.getElementById('products-grid');
  const countEl = document.getElementById('catalog-results-count');
  if (!gridEl) return;

  if (countEl) {
    countEl.textContent = `${state.filteredProducts.length} référence${state.filteredProducts.length > 1 ? 's' : ''} disponible${state.filteredProducts.length > 1 ? 's' : ''}`;
  }

  if (state.filteredProducts.length === 0) {
    gridEl.innerHTML = `
      <div class="state-feedback-box" style="grid-column: 1 / -1;">
        <span class="state-feedback-icon">🔍</span>
        <h3>Aucun produit trouvé</h3>
        <p style="color:var(--text-light); margin-top:6px;">Essayez d'ajuster vos critères de recherche ou de marque.</p>
        <button class="btn-secondary-large" style="margin-top:16px;" onclick="window.app.resetAllFilters()">Réinitialiser les filtres</button>
      </div>`;
    return;
  }

  gridEl.innerHTML = state.filteredProducts.map(product => {
    const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
    const currentQty = state.localQuantities[product.id] || getInitialQuantity(product);
    const lineTotal = currentQty * product.unitPrice;

    let ruleBadge = allows3
      ? `<span class="badge-tag badge-rule-exception">⚡ Min. 3 unités (${product.allow3UnitsPermanent ? 'Technique' : 'Stock limité'})</span>`
      : `<span class="badge-tag badge-rule-standard">📦 Min. 6 unités (Colisage standard)</span>`;

    let arrivalBadge = product.isNewArrival
      ? `<span class="badge-tag badge-new">Nouvel Arrivage</span>`
      : product.isRestock
      ? `<span class="badge-tag badge-restock">Retour en Stock</span>`
      : '';

    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-image-container" onclick="window.app.openProductModal('${product.id}')">
          <div class="product-badges-top">
            ${ruleBadge}
            ${arrivalBadge}
          </div>
          <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
        </div>
        <div class="product-card-body">
          <div class="product-meta-row">
            <button type="button" class="product-brand-chip" onclick="window.app.filterByBrand('${escapeJs(product.brand)}')" title="Filtrer par la marque ${escapeJs(product.brand)} en 1 clic">
              🏷️ ${product.brand}
            </button>
            <span class="product-ref">${product.ref}</span>
          </div>
          <h3 class="product-title" onclick="window.app.openProductModal('${product.id}')" title="${product.name}">${product.name}</h3>
          <div class="product-format">${product.format}</div>
          
          <div class="product-pricing-box">
            <div class="price-unit-row">
              <span class="price-label">Prix de gros unitaire</span>
              <span class="price-value-highlight">${formatFCFA(product.unitPrice)}</span>
            </div>
            <div class="stock-indicator ${product.stock <= 24 ? 'low' : ''}">
              <span class="stock-dot"></span>
              <span>${product.stock > 0 ? `Stock : ${product.stock} unités` : 'Sur commande'}</span>
            </div>
          </div>

          <div class="card-actions-wrapper">
            <div class="quantity-stepper-row">
              <button type="button" class="stepper-btn btn-stepper-minus" onclick="window.app.stepQuantity('${product.id}', -1)" aria-label="Diminuer quantité">−</button>
              <div class="stepper-value-col">
                <span class="stepper-qty" data-product-id="${product.id}" id="qty-val-${product.id}">${currentQty}</span>
                <span class="stepper-unit-label">unités</span>
                <div class="stepper-subtotal" data-product-id="${product.id}" id="line-tot-${product.id}">${formatFCFA(lineTotal)}</div>
              </div>
              <button type="button" class="stepper-btn btn-stepper-plus" onclick="window.app.stepQuantity('${product.id}', 1)" aria-label="Augmenter quantité">+</button>
            </div>

            <button type="button" class="btn-add-to-cart" onclick="window.app.addToCart('${product.id}', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              <span>Ajouter à ma demande</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  animateProductCards('#products-grid');
}

/* ========================================================
   HOME FEATURED PRODUCTS
======================================================== */
function renderHomeFeatured() {
  const container = document.getElementById('home-featured-grid');
  if (!container) return;

  const featured = state.products.filter(p => p.isNewArrival || p.isNewProduct).slice(0, 4);
  if (featured.length === 0) {
    container.innerHTML = '<p style="color:var(--text-light)">Aucun arrivage récent.</p>';
    return;
  }

  container.innerHTML = featured.map(product => {
    const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
    const currentQty = state.localQuantities[product.id] || getInitialQuantity(product);
    const lineTotal = currentQty * product.unitPrice;

    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-image-container" onclick="window.app.openProductModal('${product.id}')">
          <div class="product-badges-top">
            <span class="badge-tag ${allows3 ? 'badge-rule-exception' : 'badge-rule-standard'}">
              ${allows3 ? '⚡ Min. 3 unités' : '📦 Min. 6 unités'}
            </span>
            <span class="badge-tag badge-new">Arrivage</span>
          </div>
          <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
        </div>
        <div class="product-card-body">
          <div class="product-meta-row">
            <button type="button" class="product-brand-chip" onclick="window.app.filterByBrand('${escapeJs(product.brand)}')" title="Filtrer par la marque ${escapeJs(product.brand)} en 1 clic">
              🏷️ ${product.brand}
            </button>
            <span class="product-ref">${product.ref}</span>
          </div>
          <h3 class="product-title" onclick="window.app.openProductModal('${product.id}')">${product.name}</h3>
          <div class="product-format">${product.format}</div>
          <div class="product-pricing-box">
            <div class="price-unit-row">
              <span class="price-label">Prix unitaire</span>
              <span class="price-value-highlight">${formatFCFA(product.unitPrice)}</span>
            </div>
            <div class="stock-indicator">
              <span class="stock-dot"></span>
              <span>Stock : ${product.stock} unités</span>
            </div>
          </div>
          <div class="card-actions-wrapper">
            <div class="quantity-stepper-row">
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${product.id}', -1)">−</button>
              <div class="stepper-value-col">
                <span class="stepper-qty" id="home-qty-${product.id}">${currentQty}</span>
                <span class="stepper-unit-label">unités</span>
                <div class="stepper-subtotal" id="home-tot-${product.id}">${formatFCFA(lineTotal)}</div>
              </div>
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${product.id}', 1)">+</button>
            </div>
            <button type="button" class="btn-add-to-cart" onclick="window.app.addToCart('${product.id}', this)">
              Ajouter à ma demande
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ========================================================
   COMMANDE RAPIDE (FAST TABLE VIEW)
======================================================== */
function renderQuickOrderList() {
  const container = document.getElementById('quick-order-items-list');
  const countEl = document.getElementById('quick-order-count');
  if (!container) return;

  let list = state.products;
  if (state.currentBrand !== 'all') {
    list = list.filter(p => p.brand.toLowerCase() === state.currentBrand.toLowerCase());
  }

  if (countEl) {
    countEl.textContent = `${list.length} référence${list.length > 1 ? 's' : ''}${state.currentBrand !== 'all' ? ' (' + state.currentBrand + ')' : ''}`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="state-feedback-box" style="padding:24px;">
        <p>Aucune référence pour la marque sélectionnée.</p>
        <button class="btn-secondary-large" style="margin-top:8px;" onclick="window.app.filterByBrand('all')">Voir toutes les marques</button>
      </div>`;
    return;
  }

  container.innerHTML = list.map(p => {
    const currentQty = state.localQuantities[p.id] || getInitialQuantity(p);
    const lineTotal = currentQty * p.unitPrice;
    const allows3 = Boolean(p.allow3UnitsPermanent || p.allow3UnitsSpecial);

    return `
      <div class="quick-order-item-row" data-product-id="${p.id}">
        <img src="${p.image}" alt="${p.name}" class="quick-order-thumb" loading="lazy">
        <div class="quick-order-info">
          <h4>${p.name}</h4>
          <p>
            <button type="button" class="product-brand-chip" onclick="window.app.filterByBrand('${escapeJs(p.brand)}')" style="font-size:0.72rem; padding:1px 6px;" title="Filtrer par la marque ${escapeJs(p.brand)} en 1 clic">
              🏷️ ${p.brand}
            </button>
            • <span style="font-family:monospace">${p.ref}</span> • ${p.format}
          </p>
          <span style="font-size:0.75rem; color:${allows3 ? '#b45309' : 'var(--text-light)'}">
            ${allows3 ? '⚡ Exception min 3' : '📦 Colisage standard min 6'}
          </span>
        </div>
        <div>
          <div style="font-weight:700; font-size:0.95rem;">${formatFCFA(p.unitPrice)}</div>
          <div style="font-size:0.75rem; color:var(--text-light)">Stock: ${p.stock}</div>
        </div>
        <div class="quick-order-stepper-cell">
          <div class="quantity-stepper-row" style="padding:2px;">
            <button type="button" class="stepper-btn" style="width:32px; height:32px;" onclick="window.app.stepQuantity('${p.id}', -1)">−</button>
            <div class="stepper-value-col">
              <span class="stepper-qty" id="quick-qty-${p.id}" style="font-size:0.95rem;">${currentQty}</span>
            </div>
            <button type="button" class="stepper-btn" style="width:32px; height:32px;" onclick="window.app.stepQuantity('${p.id}', 1)">+</button>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div class="quick-order-subtotal" id="quick-tot-${p.id}">${formatFCFA(lineTotal)}</div>
          <button type="button" class="btn-add-to-cart" style="padding:6px 12px; font-size:0.78rem; min-height:36px;" onclick="window.app.addToCart('${p.id}', this)">
            Ajouter
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/* ========================================================
   ARRIVAGES VIEW & WHATSAPP SHARE
======================================================== */
function renderArrivagesList() {
  const container = document.getElementById('arrivages-products-grid');
  if (!container) return;

  let arrivals = state.products.filter(p => p.isNewArrival || p.isNewProduct || p.isRestock);

  if (state.arrivageFilter === 'new-product') {
    arrivals = state.products.filter(p => p.isNewProduct);
  } else if (state.arrivageFilter === 'new-arrival') {
    arrivals = state.products.filter(p => p.isNewArrival);
  } else if (state.arrivageFilter === 'restock') {
    arrivals = state.products.filter(p => p.isRestock);
  }

  if (arrivals.length === 0) {
    container.innerHTML = '<div class="state-feedback-box"><p>Aucun arrivage dans cette catégorie pour le moment.</p></div>';
    return;
  }

  container.innerHTML = arrivals.map(p => {
    const currentQty = state.localQuantities[p.id] || getInitialQuantity(p);
    const lineTotal = currentQty * p.unitPrice;

    return `
      <div class="product-card" data-product-id="${p.id}">
        <div class="product-image-container" onclick="window.app.openProductModal('${p.id}')">
          <div class="product-badges-top">
            ${p.isNewProduct ? '<span class="badge-tag badge-new">Nouveau</span>' : ''}
            ${p.isNewArrival ? '<span class="badge-tag badge-new">Arrivage Récent</span>' : ''}
            ${p.isRestock ? '<span class="badge-tag badge-restock">Retour Stock</span>' : ''}
          </div>
          <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
        </div>
        <div class="product-card-body">
          <div class="product-meta-row">
            <button type="button" class="product-brand-chip" onclick="window.app.filterByBrand('${escapeJs(p.brand)}')" title="Filtrer par la marque ${escapeJs(p.brand)} en 1 clic">
              🏷️ ${p.brand}
            </button>
            <span class="product-ref">${p.ref}</span>
          </div>
          <h3 class="product-title" onclick="window.app.openProductModal('${p.id}')">${p.name}</h3>
          <div class="product-format">${p.format}</div>
          <div class="product-pricing-box">
            <div class="price-unit-row">
              <span class="price-label">Prix unitaire</span>
              <span class="price-value-highlight">${formatFCFA(p.unitPrice)}</span>
            </div>
            <div class="stock-indicator">
              <span class="stock-dot"></span>
              <span>Stock : ${p.stock} unités</span>
            </div>
          </div>
          <div class="card-actions-wrapper">
            <div class="quantity-stepper-row">
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${p.id}', -1)">−</button>
              <div class="stepper-value-col">
                <span class="stepper-qty" id="arriv-qty-${p.id}">${currentQty}</span>
                <span class="stepper-unit-label">unités</span>
                <div class="stepper-subtotal" id="arriv-tot-${p.id}">${formatFCFA(lineTotal)}</div>
              </div>
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${p.id}', 1)">+</button>
            </div>
            <button type="button" class="btn-add-to-cart" onclick="window.app.addToCart('${p.id}', this)">
              Ajouter à ma demande
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function shareArrivagesOnWhatsApp() {
  const arrivals = state.products.filter(p => p.isNewArrival || p.isNewProduct || p.isRestock);
  if (arrivals.length === 0) return;

  let text = `📢 *NOUVEAUX ARRIVAGES & DISPONIBILITÉS GROS - BAMAKO*\n\n`;
  text += `Voici les dernières références disponibles pour pharmacies & supermarchés :\n\n`;

  arrivals.forEach((p, idx) => {
    const tag = p.isNewProduct ? '🆕 NOUVEAU' : p.isRestock ? '🔄 RETOUR STOCK' : '✨ ARRIVAGE';
    text += `${idx + 1}. *${p.name}* (${p.ref})\n`;
    text += `   • Marque : ${p.brand} | ${p.format}\n`;
    text += `   • Prix de gros : *${formatFCFA(p.unitPrice)}*\n`;
    text += `   • Colisage : ${p.allow3UnitsPermanent || p.allow3UnitsSpecial ? 'dès 3 unités' : 'par 6 unités'}\n`;
    text += `   • Statut : ${tag} (Stock: ${p.stock} un.)\n\n`;
  });

  text += `📍 *Distribution & Entrepôt Bamako*\n`;
  text += `Pour transmettre votre demande de commande directe, consultez notre catalogue en ligne ou répondez à ce message !`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ========================================================
   QUANTITY STEPPER INTERACTIONS
======================================================== */
function stepQuantity(productId, direction) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const current = state.localQuantities[productId] || getInitialQuantity(product);
  let next;

  if (direction > 0) {
    next = getNextQuantity(current, product);
  } else {
    next = getPrevQuantity(current, product);
  }

  state.localQuantities[productId] = next;
  const lineTotal = next * product.unitPrice;

  // Universal synchronous update for all views (Home, Catalog, Quick-order, Arrivages)
  const qtySelectors = [
    `.stepper-qty[data-product-id="${productId}"]`,
    `#qty-val-${productId}`,
    `#home-qty-${productId}`,
    `#quick-qty-${productId}`,
    `#arriv-qty-${productId}`
  ].join(',');

  const totSelectors = [
    `.stepper-subtotal[data-product-id="${productId}"]`,
    `#line-tot-${productId}`,
    `#home-tot-${productId}`,
    `#quick-tot-${productId}`,
    `#arriv-tot-${productId}`
  ].join(',');

  document.querySelectorAll(qtySelectors).forEach(el => {
    el.textContent = next;
    animateQuantityChange(el);
  });

  document.querySelectorAll(totSelectors).forEach(el => {
    el.textContent = formatFCFA(lineTotal);
  });

  // Modal updates if open
  const modalQtyEl = document.getElementById('modal-product-qty');
  const modalTotEl = document.getElementById('modal-product-total');
  if (modalQtyEl && state.selectedProduct?.id === productId) {
    modalQtyEl.textContent = next;
    animateQuantityChange(modalQtyEl);
  }
  if (modalTotEl && state.selectedProduct?.id === productId) {
    modalTotEl.textContent = formatFCFA(lineTotal);
  }
}


