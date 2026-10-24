// Client-side Application for BKO Cosmo Distribution (Bamako Wholesale)
import { isQuantityAllowed, getInitialQuantity, getNextQuantity, getPrevQuantity, formatFCFA } from './rules.js';
import { animateHeroEntrance, animateProductCards, animateAddToCartFeedback, animateQuantityChange, animateDrawerOpen } from './gsap-animations.js';
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
  selectBrandFromSearch
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
   API DATA FETCHING
======================================================== */
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      state.settings = await res.json();
      updateHeaderWhatsApp();
    }
  } catch (e) {
    console.warn('Could not fetch settings, using defaults.', e);
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
                <span class="stepper-qty" id="qty-val-${product.id}">${currentQty}</span>
                <span class="stepper-unit-label">unités</span>
                <div class="stepper-subtotal" id="line-tot-${product.id}">${formatFCFA(lineTotal)}</div>
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

  // Catalog card updates
  const qtyEl = document.getElementById(`qty-val-${productId}`);
  const totEl = document.getElementById(`line-tot-${productId}`);
  if (qtyEl) {
    qtyEl.textContent = next;
    animateQuantityChange(qtyEl);
  }
  if (totEl) totEl.textContent = formatFCFA(lineTotal);

  // Home card updates
  const homeQtyEl = document.getElementById(`home-qty-${productId}`);
  const homeTotEl = document.getElementById(`home-tot-${productId}`);
  if (homeQtyEl) {
    homeQtyEl.textContent = next;
    animateQuantityChange(homeQtyEl);
  }
  if (homeTotEl) homeTotEl.textContent = formatFCFA(lineTotal);

  // Quick order updates
  const quickQtyEl = document.getElementById(`quick-qty-${productId}`);
  const quickTotEl = document.getElementById(`quick-tot-${productId}`);
  if (quickQtyEl) quickQtyEl.textContent = next;
  if (quickTotEl) quickTotEl.textContent = formatFCFA(lineTotal);

  // Arrivages card updates
  const arrivQtyEl = document.getElementById(`arriv-qty-${productId}`);
  const arrivTotEl = document.getElementById(`arriv-tot-${productId}`);
  if (arrivQtyEl) arrivQtyEl.textContent = next;
  if (arrivTotEl) arrivTotEl.textContent = formatFCFA(lineTotal);

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

/* ========================================================
   CART INTERACTIONS
======================================================== */
function addToCart(productId, buttonElement) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const qty = state.localQuantities[productId] || getInitialQuantity(product);

  const validation = isQuantityAllowed(qty, product);
  if (!validation.valid) {
    alert(`Règle de colisage : ${validation.message}`);
    return;
  }

  const existingIndex = state.cart.findIndex(i => i.productId === productId);
  if (existingIndex > -1) {
    let combinedQty = state.cart[existingIndex].qty + qty;
    if (!isQuantityAllowed(combinedQty, product).valid) {
      combinedQty = getNextQuantity(state.cart[existingIndex].qty, product);
    }
    state.cart[existingIndex].qty = combinedQty;
  } else {
    state.cart.push({
      productId: product.id,
      ref: product.ref,
      name: product.name,
      brand: product.brand,
      format: product.format,
      image: product.image,
      unitPrice: product.unitPrice,
      qty: qty
    });
  }

  saveCartToStorage();
  updateCartBadge();
  animateAddToCartFeedback(buttonElement);
  renderCartDrawer();
}

function updateCartItemQty(productId, direction) {
  const item = state.cart.find(i => i.productId === productId);
  const product = state.products.find(p => p.id === productId);
  if (!item || !product) return;

  let newQty;
  if (direction > 0) {
    newQty = getNextQuantity(item.qty, product);
  } else {
    newQty = getPrevQuantity(item.qty, product);
  }

  item.qty = newQty;
  saveCartToStorage();
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  saveCartToStorage();
  updateCartBadge();
  renderCartDrawer();
}

function renderCartDrawer() {
  const bodyEl = document.getElementById('cart-drawer-body');
  const footerEl = document.getElementById('cart-drawer-footer');
  if (!bodyEl || !footerEl) return;

  if (state.cart.length === 0) {
    bodyEl.innerHTML = `
      <div class="state-feedback-box" style="margin:auto;">
        <span class="state-feedback-icon">🛒</span>
        <h3>Votre demande est vide</h3>
        <p style="color:var(--text-light); margin-top:6px;">Sélectionnez vos références au catalogue pour constituer votre commande en gros.</p>
        <button class="btn-primary-large" style="margin-top:16px;" onclick="window.app.switchTab('catalog'); window.app.closeCartDrawer();">
          Consulter le catalogue
        </button>
      </div>`;
    footerEl.style.display = 'none';
    return;
  }

  footerEl.style.display = 'flex';

  const totalUnits = state.cart.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = state.cart.reduce((sum, i) => sum + (i.unitPrice * i.qty), 0);

  bodyEl.innerHTML = `
    <div class="commercial-verification-banner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <div>
        <strong>Demande de commande en gros</strong><br>
        Votre demande sera vérifiée par le commercial avant confirmation. Aucun paiement en ligne n'est débité.
      </div>
    </div>

    ${state.cart.map(item => {
      const lineTotal = item.qty * item.unitPrice;

      return `
        <div class="cart-item-card">
          <button class="btn-remove-item" onclick="window.app.removeCartItem('${item.productId}')" title="Supprimer cet article">✕</button>
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-info">
            <span class="cart-item-ref">${item.ref}</span>
            <h4 class="cart-item-title">${item.name}</h4>
            <span style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">
              ${item.brand} • ${formatFCFA(item.unitPrice)} / unité
            </span>
            <div class="cart-item-price-row">
              <div class="quantity-stepper-row" style="padding:2px; max-width:130px;">
                <button type="button" class="stepper-btn" style="width:28px; height:28px;" onclick="window.app.updateCartItemQty('${item.productId}', -1)">−</button>
                <div class="stepper-value-col">
                  <span class="stepper-qty" style="font-size:0.9rem;">${item.qty}</span>
                </div>
                <button type="button" class="stepper-btn" style="width:28px; height:28px;" onclick="window.app.updateCartItemQty('${item.productId}', 1)">+</button>
              </div>
              <strong style="font-size:0.95rem; color:var(--primary);">${formatFCFA(lineTotal)}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  footerEl.innerHTML = `
    <div class="cart-totals-summary">
      <div class="total-line-item">
        <span>Articles sélectionnés :</span>
        <strong>${state.cart.length} référence${state.cart.length > 1 ? 's' : ''} (${totalUnits} unités)</strong>
      </div>
      <div class="total-line-item">
        <span>Frais de livraison à Bamako :</span>
        <span style="color:var(--text-muted);">Confirmés par le commercial selon quartier</span>
      </div>
      <div class="total-line-grand">
        <span>Total estimatif :</span>
        <span style="color:var(--primary);">${formatFCFA(totalAmount)}</span>
      </div>
    </div>
    <button class="btn-primary-large" style="width:100%; justify-content:center;" onclick="window.app.openCheckoutModal()">
      Transmettre ma demande
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
    </button>
  `;
}

function openCartDrawer() {
  state.isCartDrawerOpen = true;
  const backdrop = document.getElementById('drawer-backdrop');
  const drawer = document.getElementById('cart-drawer');
  if (backdrop && drawer) {
    backdrop.classList.add('active');
    drawer.classList.add('active');
    animateDrawerOpen(drawer);
  }
  renderCartDrawer();
}

function closeCartDrawer() {
  state.isCartDrawerOpen = false;
  const backdrop = document.getElementById('drawer-backdrop');
  const drawer = document.getElementById('cart-drawer');
  if (backdrop && drawer) {
    backdrop.classList.remove('active');
    drawer.classList.remove('active');
  }
}

/* ========================================================
   PRODUCT DETAIL MODAL
======================================================== */
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.selectedProduct = product;
  const modal = document.getElementById('product-detail-modal');
  const body = document.getElementById('product-modal-body');
  if (!modal || !body) return;

  const currentQty = state.localQuantities[product.id] || getInitialQuantity(product);
  const lineTotal = currentQty * product.unitPrice;
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);

  const pinterestQuery = [product.brand, product.name, product.format, 'packaging']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  body.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr; gap:20px;">
      <div style="border-radius:var(--radius-md); overflow:hidden; background:var(--bg-main); text-align:center; padding:10px;">
        <img src="${product.image}" alt="${product.name}" style="max-height:260px; margin:0 auto; object-fit:contain; border-radius:var(--radius-sm);">
        <div style="display:flex; justify-content:center; gap:8px; margin-top:10px; flex-wrap:wrap;">
          <a href="${product.image}" target="_blank" download="photo-${product.ref}.jpg" class="btn-secondary-large" style="padding:4px 10px; font-size:0.75rem; min-height:28px;">
            📥 Télécharger la photo
          </a>
          <a href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(pinterestQuery)}" target="_blank" class="btn-secondary-large" style="padding:4px 10px; font-size:0.75rem; min-height:28px; color:#e60023; border-color:#fecaca; background:#fff;" title="Rechercher ${product.name} ${product.format} sur Pinterest">
            📌 Voir sur Pinterest (${product.format}) ↗
          </a>
        </div>
      </div>
      <div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          <span class="badge-tag ${allows3 ? 'badge-rule-exception' : 'badge-rule-standard'}">
            ${allows3 ? '⚡ Exception 3 unités autorisée' : '📦 Colisage standard min. 6 unités'}
          </span>
          ${product.isNewArrival ? '<span class="badge-tag badge-new">Arrivage</span>' : ''}
          ${product.isRestock ? '<span class="badge-tag badge-restock">Retour stock</span>' : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <button type="button" class="product-brand-chip" style="font-size:0.82rem; padding:4px 10px;" onclick="window.app.closeProductModal(); window.app.filterByBrand('${escapeJs(product.brand)}');" title="Filtrer par la marque ${escapeJs(product.brand)} en 1 clic">
            🏷️ Marque : <strong>${product.brand}</strong> (Voir toute la gamme)
          </button>
          <span style="font-family:monospace; color:var(--text-light); font-size:0.82rem;">${product.ref}</span>
        </div>
        <h2 style="font-size:1.35rem; font-weight:800; color:var(--text-main); margin:6px 0 10px 0;">${product.name}</h2>
        <p style="color:var(--text-muted); font-size:0.9rem; line-height:1.55; margin-bottom:14px;">${product.description || 'Produit dermo-cosmétique professionnel pour distribution en gros.'}</p>
        
        <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="font-size:0.85rem; color:var(--text-muted);">Format / Contenance :</span>
            <strong>${product.format}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="font-size:0.85rem; color:var(--text-muted);">Prix unitaire HT/TTC :</span>
            <strong style="color:var(--text-main); font-size:1.1rem;">${formatFCFA(product.unitPrice)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:0.85rem; color:var(--text-muted);">Stock disponible :</span>
            <strong style="color:${product.stock <= 24 ? 'var(--warning)' : 'var(--success)'};">${product.stock} unités</strong>
          </div>
        </div>

        <div style="background:#ffffff; border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
          <label style="display:block; font-size:0.8125rem; font-weight:700; margin-bottom:8px;">Sélectionner les unités :</label>
          <div style="display:flex; align-items:center; gap:14px;">
            <div class="quantity-stepper-row" style="flex:1;">
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${product.id}', -1)">−</button>
              <div class="stepper-value-col">
                <span class="stepper-qty" id="modal-product-qty">${currentQty}</span>
                <span class="stepper-unit-label">unités</span>
              </div>
              <button type="button" class="stepper-btn" onclick="window.app.stepQuantity('${product.id}', 1)">+</button>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.75rem; color:var(--text-light); display:block;">Total estimé :</span>
              <strong style="font-size:1.15rem; color:var(--primary);" id="modal-product-total">${formatFCFA(lineTotal)}</strong>
            </div>
          </div>
        </div>

        <button type="button" class="btn-primary-large" style="width:100%; margin-top:16px;" onclick="window.app.addToCart('${product.id}', this); window.app.closeProductModal();">
          Ajouter à ma demande
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeProductModal() {
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.remove('active');
}

/* ========================================================
   TRANSMISSION DE LA DEMANDE
======================================================== */
function openCheckoutModal() {
  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  const body = document.getElementById('checkout-modal-body');
  if (!modal || !body) return;

  const totalAmount = state.cart.reduce((sum, i) => sum + (i.unitPrice * i.qty), 0);
  const totalUnits = state.cart.reduce((sum, i) => sum + i.qty, 0);

  body.innerHTML = `
    <form id="order-transmission-form" onsubmit="window.app.handleOrderSubmit(event)">
      <div style="background:var(--primary-light); border-left:4px solid var(--primary); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:18px; font-size:0.84rem; color:var(--text-main);">
        <strong>Récapitulatif :</strong> ${state.cart.length} références (${totalUnits} unités) pour un total estimé de <strong>${formatFCFA(totalAmount)}</strong>.
      </div>

      <div style="display:none;" aria-hidden="true">
        <input type="text" name="_hp" tabindex="-1" autocomplete="off">
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Nom de l'établissement <span class="req">*</span></label>
          <input type="text" name="establishmentName" class="form-control" placeholder="ex: Pharmacie du Fleuve" required>
        </div>
        <div class="form-group">
          <label class="form-label">Type d'établissement <span class="req">*</span></label>
          <select name="establishmentType" class="form-control" required>
            <option value="Pharmacie">Pharmacie / Officine</option>
            <option value="Supermarché">Supermarché / Supérette</option>
            <option value="Institut">Institut de beauté / Parapharmacie</option>
            <option value="Autre">Autre distributeur / Détaillant</option>
          </select>
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Nom du responsable ou acheteur <span class="req">*</span></label>
          <input type="text" name="contactName" class="form-control" placeholder="ex: Dr. Coulibaly ou M. Traoré" required>
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone WhatsApp <span class="req">*</span></label>
          <input type="tel" name="phone" class="form-control" placeholder="+223 7X XX XX XX" required>
          <span class="form-helper">Utilisé pour la confirmation et la coordination de livraison.</span>
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Quartier à Bamako <span class="req">*</span></label>
          <select name="neighborhoodSelect" id="neighborhood-select" class="form-control" onchange="window.app.handleNeighborhoodChange(this)" required>
            <option value="">Sélectionnez un quartier...</option>
            ${BAMAKO_QUARTIERS.map(q => `<option value="${q}">${q}</option>`).join('')}
          </select>
          <input type="text" name="neighborhoodCustom" id="neighborhood-custom" class="form-control" style="margin-top:8px; display:none;" placeholder="Précisez le quartier">
        </div>
        <div class="form-group">
          <label class="form-label">Adresse précise / Repère</label>
          <input type="text" name="address" class="form-control" placeholder="ex: Face station Shell, Rue 14">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Indications de livraison</label>
        <input type="text" name="deliveryNotes" class="form-control" placeholder="ex: Réception possible entre 9h et 14h, demander le gérant">
      </div>

      <div class="form-group">
        <label class="form-label">Observation particulière (facultative)</label>
        <textarea name="observation" class="form-control" rows="2" placeholder="Précisions de colisage, facture proforma spécifique, etc."></textarea>
      </div>

      <div style="border-top:1px solid var(--border); padding-top:16px; margin-top:20px; display:flex; justify-content:flex-end; gap:12px;">
        <button type="button" class="btn-secondary-large" onclick="window.app.closeCheckoutModal()">Annuler</button>
        <button type="submit" class="btn-primary-large" id="submit-order-btn">
          <span>Confirmer et Transmettre</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </form>
  `;

  modal.classList.add('active');
}

function handleNeighborhoodChange(select) {
  const customInput = document.getElementById('neighborhood-custom');
  if (customInput) {
    if (select.value === 'Autre quartier de Bamako') {
      customInput.style.display = 'block';
      customInput.required = true;
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.required = false;
    }
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  if (state.isSubmittingOrder) return;

  const form = event.target;
  const submitBtn = document.getElementById('submit-order-btn');

  const formData = new FormData(form);
  const hp = formData.get('_hp');
  if (hp) return;

  const neighborhoodSelect = formData.get('neighborhoodSelect');
  const neighborhoodCustom = formData.get('neighborhoodCustom');
  const finalNeighborhood = neighborhoodSelect === 'Autre quartier de Bamako' ? neighborhoodCustom : neighborhoodSelect;

  const payload = {
    establishmentName: formData.get('establishmentName'),
    establishmentType: formData.get('establishmentType'),
    contactName: formData.get('contactName'),
    phone: formData.get('phone'),
    neighborhood: finalNeighborhood,
    address: formData.get('address'),
    deliveryNotes: formData.get('deliveryNotes'),
    observation: formData.get('observation'),
    items: state.cart.map(i => ({ productId: i.productId, qty: i.qty }))
  };

  state.isSubmittingOrder = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Enregistrement en cours...</span>';
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de l\'enregistrement de votre demande.');
    }

    state.lastOrderResult = data;
    state.cart = [];
    saveCartToStorage();
    updateCartBadge();

    renderOrderConfirmation(data);
  } catch (err) {
    alert(`Erreur : ${err.message}`);
    state.isSubmittingOrder = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Réessayer de transmettre</span>';
    }
  }
}

function renderOrderConfirmation(orderData) {
  const body = document.getElementById('checkout-modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="confirmation-box">
      <div class="confirmation-check-icon">✓</div>
      <h2 style="font-size:1.5rem; font-weight:800; color:var(--text-main);">Demande reçue avec succès</h2>
      <p style="color:var(--text-muted); margin-top:6px; max-width:440px; margin-left:auto; margin-right:auto;">
        Votre demande a bien été enregistrée dans notre système sous la référence :
      </p>
      
      <div class="demand-ref-badge">${orderData.orderRef}</div>

      <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; margin:16px 0; text-align:left; font-size:0.875rem;">
        <p style="margin-bottom:6px;"><strong>Montant estimatif :</strong> ${orderData.formattedTotal}</p>
        <p style="margin-bottom:6px; color:var(--primary); font-weight:600;">Statut : En attente de vérification par le commercial</p>
        <p style="color:var(--text-light); font-size:0.8125rem;">
          Votre demande est conservée sur nos serveurs. Vous pouvez transmettre la copie directement par WhatsApp pour un traitement accéléré.
        </p>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
        <a href="${orderData.whatsappUrl}" target="_blank" class="btn-primary-large" style="background:#25d366; box-shadow:0 4px 12px rgba(37,211,102,0.35); text-align:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Envoyer le récapitulatif par WhatsApp au Commercial
        </a>

        <div style="display:flex; gap:10px; justify-content:center;">
          <button type="button" class="btn-secondary-large" onclick="window.app.trackOrderDirect('${orderData.orderRef}'); window.app.closeCheckoutModal();">
            Suivre cette demande
          </button>
          <button type="button" class="btn-secondary-large" onclick="window.app.closeCheckoutModal(); window.app.switchTab('catalog');">
            Retour au catalogue
          </button>
        </div>
      </div>
    </div>
  `;

  state.isSubmittingOrder = false;
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('active');
  state.isSubmittingOrder = false;
}

/* ========================================================
   TRACKING DE DEMANDE
======================================================== */
async function trackOrder(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('track-order-input');
  const resultContainer = document.getElementById('tracking-result-box');
  if (!input || !resultContainer) return;

  const ref = input.value.trim();
  if (!ref) return;

  resultContainer.innerHTML = '<p style="color:var(--text-light);">Recherche de la demande...</p>';

  try {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(ref)}`);
    const data = await res.json();

    if (!res.ok) {
      resultContainer.innerHTML = `
        <div style="background:var(--danger-bg); color:var(--danger); padding:12px; border-radius:var(--radius-md); font-size:0.875rem;">
          ${data.error || 'Aucune demande trouvée avec cette référence.'}
        </div>`;
      return;
    }

    let statusClass = 'status-received';
    if (data.status === 'En vérification') statusClass = 'status-verif';
    if (data.status === 'Confirmée') statusClass = 'status-confirmed';
    if (data.status === 'En préparation') statusClass = 'status-prep';
    if (data.status === 'En livraison') statusClass = 'status-delivering';
    if (data.status === 'Livrée') statusClass = 'status-delivered';
    if (data.status === 'Annulée') statusClass = 'status-cancelled';

    resultContainer.innerHTML = `
      <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-md); padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-family:monospace; font-weight:800; font-size:1.1rem; color:var(--primary);">${data.orderRef}</span>
          <span class="status-pill ${statusClass}">${data.status}</span>
        </div>
        <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:8px;">
          Date de transmission : ${new Date(data.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:8px;">
          Volume commandé : <strong>${data.itemCount} unités</strong>
        </p>
        <p style="font-size:1rem; font-weight:800; color:var(--text-main);">
          Total estimatif : ${data.formattedTotal}
        </p>
        <div style="margin-top:14px; padding-top:12px; border-top:1px dashed var(--border); font-size:0.8125rem; color:var(--text-light);">
          ℹ️ Pour toute question ou ajustement, contactez directement le gérant sur WhatsApp en précisant ce numéro de référence.
        </div>
      </div>
    `;
  } catch (err) {
    resultContainer.innerHTML = '<p style="color:var(--danger)">Erreur de connexion au serveur.</p>';
  }
}

function trackOrderDirect(orderRef) {
  switchTab('track');
  const input = document.getElementById('track-order-input');
  if (input) {
    input.value = orderRef;
    trackOrder();
  }
}

/* ========================================================
   GLOBAL EVENT LISTENERS WITH DELEGATION
======================================================== */
function setupEventListeners() {
  // Global Event Delegation for [data-tab] (works for any button anywhere)
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      e.preventDefault();
      const tab = tabBtn.dataset.tab;
      if (tab) {
        switchTab(tab);
      }
    }
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavPanel = document.getElementById('mobile-nav-panel');
  if (mobileMenuBtn && mobileNavPanel) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNavPanel.classList.toggle('open');
    });
  }

  // Cart button
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const stickyCartBtn = document.getElementById('sticky-open-cart-btn');
  if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCartDrawer);
  if (stickyCartBtn) stickyCartBtn.addEventListener('click', openCartDrawer);

  const closeCartBtn = document.getElementById('close-cart-btn');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeCartDrawer);

  // Search input with synchronized brand detection
  const searchInput = document.getElementById('catalog-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (clearSearchBtn) clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      checkBrandMatch(state.searchQuery);
      applyFilters();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      clearSearch();
    });
  }

  // Category filter pills
  document.querySelectorAll('.pill-filter').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill-filter').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.currentCategory = pill.dataset.category || 'all';
      applyFilters();
    });
  });

  // Brand dropdown (synchronized with brand pills & search)
  const brandSelect = document.getElementById('brand-select');
  if (brandSelect) {
    brandSelect.addEventListener('change', (e) => {
      filterByBrand(e.target.value);
    });
  }

  // Arrivages tabs
  document.querySelectorAll('.arrivage-tab-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.arrivage-tab-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.arrivageFilter = pill.dataset.filter || 'all';
      renderArrivagesList();
    });
  });

  const shareArrivagesBtn = document.getElementById('share-arrivages-btn');
  if (shareArrivagesBtn) {
    shareArrivagesBtn.addEventListener('click', shareArrivagesOnWhatsApp);
  }

  // Tracking form
  const trackForm = document.getElementById('tracking-form');
  if (trackForm) {
    trackForm.addEventListener('submit', trackOrder);
  }
}
