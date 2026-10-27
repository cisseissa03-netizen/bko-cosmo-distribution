// Client-side Application for BKO Cosmo Distribution (Bamako Wholesale)
// Mobile-First Premium Overhaul & PWA
import { isQuantityAllowed, getInitialQuantity, getNextQuantity, getPrevQuantity, formatFCFA } from './rules.js';

// Application State
const state = {
  products: [],
  filteredProducts: [],
  cart: [],
  currentTab: 'home', // 'home' | 'catalog' | 'quick-order' | 'arrivages' | 'track' | 'account'
  catalogSubView: 'categories', // 'categories' | 'products'
  currentCategory: 'all',
  currentSubcategory: 'all',
  currentBrand: 'all',
  searchQuery: '',
  selectedProduct: null,
  localQuantities: {},
  recentOrders: [],
  settings: {
    companyName: 'BKO COSMO DISTRIBUTION',
    whatsappNumber: '+22370000000',
    currency: 'FCFA'
  }
};

const CART_STORAGE_KEY = 'bko_cosmo_cart_v2';
const ORDERS_STORAGE_KEY = 'bko_cosmo_orders_history';

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

/* Helper: Escape HTML strings */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Helper: Escape JS strings */
function escapeJs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ========================================================
   REGISTER PUBLIC WINDOW.APP INTERFACE
======================================================== */
window.app = {
  switchTab,
  toggleMobileMenu,
  closeAllDrawers,
  openCategoryFromHome,
  openCategoryDetails,
  backToCategoriesList,
  filterSubcategory,
  clearSearch,
  focusSearch,
  showCatalogCategoriesView,
  showCatalogBrandsView,
  filterByBrand,
  resetActiveFilters,
  stepQuantity,
  addToCart,
  openCartDrawer,
  closeCartDrawer,
  updateCartItemQty,
  removeCartItem,
  openProductModal,
  closeProductModal,
  openCheckoutModal,
  closeCheckoutModal,
  handleOrderSubmit,
  trackOrderDirect,
  shareArrivagesOnWhatsApp,
  promptPwaInstall,
  dismissPwaBanner,
  closeIosModal
};

/* ========================================================
   ROUTER & TABS SWITCHING (CLEAN VIEW ISOLATION)
======================================================== */
function switchTab(tabName, pushHistory = true) {
  if (!tabName) return;
  state.currentTab = tabName;

  // 1. Hide all views & show target view
  document.querySelectorAll('.app-tab-view').forEach(view => {
    view.classList.remove('active-view');
    view.style.display = 'none';
  });

  const targetView = document.getElementById(`tab-view-${tabName}`);
  if (targetView) {
    targetView.style.display = 'block';
    // Trigger subtle reflow for transition
    setTimeout(() => targetView.classList.add('active-view'), 10);
  }

  // 2. Update navigation active states
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.main-nav .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.mobile-nav-links .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 3. Close mobile menu drawer & backdrop
  closeMobileMenu();

  // 4. Scroll smoothly to top
  window.scrollTo({ top: 0, behavior: 'instant' });

  // 5. Special tab initializations
  if (tabName === 'catalog') {
    if (state.catalogSubView === 'products' && state.currentCategory !== 'all') {
      showCatalogProductsView();
    } else {
      showCatalogCategoriesView();
    }
  } else if (tabName === 'track') {
    renderRecentOrdersList();
  }

  // 6. History handling
  if (pushHistory && window.history) {
    try {
      history.pushState({ tab: tabName }, '', '#' + tabName);
    } catch (e) {}
  }
}

// Support browser Back/Forward buttons
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.tab) {
    switchTab(e.state.tab, false);
  } else if (window.location.hash) {
    const hashTab = window.location.hash.replace('#', '');
    if (['home', 'catalog', 'quick-order', 'arrivages', 'track', 'account'].includes(hashTab)) {
      switchTab(hashTab, false);
    }
  } else {
    switchTab('home', false);
  }
});

function toggleMobileMenu() {
  const panel = document.getElementById('mobile-nav-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (!panel) return;

  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    panel.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }
}

function closeMobileMenu() {
  const panel = document.getElementById('mobile-nav-panel');
  const backdrop = document.getElementById('drawer-backdrop');
  if (panel) panel.classList.remove('open');
  if (backdrop && !state.isCartDrawerOpen) backdrop.classList.remove('active');
}

function closeAllDrawers() {
  closeMobileMenu();
  closeCartDrawer();
}

/* ========================================================
   INITIALIZATION
======================================================== */
function init() {
  loadCartFromStorage();
  loadOrdersFromStorage();
  updateCartBadge();
  setupEventListeners();
  initPwa();

  fetchSettings();
  fetchProducts();

  // Handle direct hash navigation
  if (window.location.hash) {
    const initialTab = window.location.hash.replace('#', '');
    if (['home', 'catalog', 'quick-order', 'arrivages', 'track', 'account'].includes(initialTab)) {
      switchTab(initialTab, false);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ========================================================
   EVENT LISTENERS
======================================================== */
function setupEventListeners() {
  // Catalog search input
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const clearBtn = document.getElementById('clear-search-btn');
      if (clearBtn) clearBtn.style.display = state.searchQuery ? 'flex' : 'none';
      checkBrandMatch(state.searchQuery);
      
      // If typing in search, automatically open the product listing view
      if (state.searchQuery.trim().length > 0) {
        showCatalogProductsView();
        state.currentCategory = 'all';
        const titleEl = document.getElementById('category-listing-title');
        if (titleEl) titleEl.textContent = `Recherche : "${state.searchQuery}"`;
      }
      applyFilters();
    });
  }
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
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Erreur réseau');
    state.products = await res.json();

    state.products.forEach(p => {
      state.localQuantities[p.id] = getInitialQuantity(p);
    });

    updateCategoryCounts();
    renderBrandPills();
    renderHomeFeatured();
    renderProductsGrid();
    renderQuickOrderList();
    renderArrivagesList();
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

function updateHeaderWhatsApp() {
  const waBtn = document.getElementById('header-whatsapp-btn');
  if (waBtn && state.settings.whatsappNumber) {
    const cleanNum = state.settings.whatsappNumber.replace(/[^0-9]/g, '');
    waBtn.href = `https://wa.me/${cleanNum}?text=${encodeURIComponent('Bonjour BKO Cosmo, je souhaite passer commande sur votre catalogue.')}`;
  }
}

function updateCategoryCounts() {
  const counts = {
    'Dermo-Cosmétique': 0,
    'Hygiène & Corps': 0,
    'Capillaire': 0,
    'Soins Bébé & Maternité': 0,
    'Protection Solaire': 0
  };

  state.products.forEach(p => {
    if (counts[p.category] !== undefined) {
      counts[p.category]++;
    }
  });

  const dermoEl = document.getElementById('cat-count-dermo');
  if (dermoEl) dermoEl.textContent = `${counts['Dermo-Cosmétique']} référence${counts['Dermo-Cosmétique'] > 1 ? 's' : ''}`;

  const hygieneEl = document.getElementById('cat-count-hygiene');
  if (hygieneEl) hygieneEl.textContent = `${counts['Hygiène & Corps']} référence${counts['Hygiène & Corps'] > 1 ? 's' : ''}`;

  const capEl = document.getElementById('cat-count-capillaire');
  if (capEl) capEl.textContent = `${counts['Capillaire']} référence${counts['Capillaire'] > 1 ? 's' : ''}`;

  const pharmaEl = document.getElementById('cat-count-pharma');
  if (pharmaEl) pharmaEl.textContent = `${counts['Soins Bébé & Maternité']} référence${counts['Soins Bébé & Maternité'] > 1 ? 's' : ''}`;

  const solEl = document.getElementById('cat-count-solaire');
  if (solEl) solEl.textContent = `${counts['Protection Solaire']} référence${counts['Protection Solaire'] > 1 ? 's' : ''}`;
}

/* ========================================================
   SCREEN 1: ACCUEIL - PRODUITS PHARES & QUICK CATEGORIES
======================================================== */
function renderHomeFeatured() {
  const container = document.getElementById('home-featured-grid');
  if (!container) return;

  // Select 4 bestsellers or new products
  const featured = state.products.filter(p => p.isNewProduct || p.allow3UnitsPermanent || p.isNewArrival).slice(0, 4);
  const displayList = featured.length >= 2 ? featured : state.products.slice(0, 4);

  let html = '';
  displayList.forEach(p => {
    html += generateProductCardHtml(p);
  });
  container.innerHTML = html;
}

function openCategoryFromHome(catName) {
  switchTab('catalog');
  openCategoryDetails(catName);
}

/* ========================================================
   SCREEN 2 & 3: CATALOG NAVIGATION
======================================================== */
function showCatalogCategoriesView() {
  state.catalogSubView = 'categories';
  const catScreen = document.getElementById('catalog-categories-screen');
  const prodScreen = document.getElementById('catalog-products-screen');
  const toggleCatBtn = document.getElementById('toggle-cat-btn');
  const toggleBrandBtn = document.getElementById('toggle-brand-btn');
  const brandPills = document.getElementById('catalog-brand-pills-container');

  if (catScreen) catScreen.style.display = 'block';
  if (prodScreen) prodScreen.style.display = 'none';
  if (toggleCatBtn) toggleCatBtn.classList.add('active');
  if (toggleBrandBtn) toggleBrandBtn.classList.remove('active');
  if (brandPills) brandPills.style.display = 'none';

  const rowsList = document.getElementById('mockup-cat-rows-list');
  if (rowsList) rowsList.style.display = 'flex';
}

function showCatalogBrandsView() {
  const toggleCatBtn = document.getElementById('toggle-cat-btn');
  const toggleBrandBtn = document.getElementById('toggle-brand-btn');
  const brandPills = document.getElementById('catalog-brand-pills-container');
  const rowsList = document.getElementById('mockup-cat-rows-list');

  if (toggleCatBtn) toggleCatBtn.classList.remove('active');
  if (toggleBrandBtn) toggleBrandBtn.classList.add('active');
  if (brandPills) brandPills.style.display = 'block';
  if (rowsList) rowsList.style.display = 'none';
}

function openCategoryDetails(catName) {
  state.currentCategory = catName;
  state.currentSubcategory = 'all';
  state.searchQuery = '';

  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';

  showCatalogProductsView();
  applyFilters();
}

function showCatalogProductsView() {
  state.catalogSubView = 'products';
  const catScreen = document.getElementById('catalog-categories-screen');
  const prodScreen = document.getElementById('catalog-products-screen');

  if (catScreen) catScreen.style.display = 'none';
  if (prodScreen) prodScreen.style.display = 'block';

  // Category title update
  const titleEl = document.getElementById('category-listing-title');
  if (titleEl) {
    if (state.currentCategory === 'all') {
      titleEl.textContent = 'Tous les produits';
    } else {
      titleEl.textContent = state.currentCategory;
    }
  }

  // Reset subcategory pills
  document.querySelectorAll('.subcat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.sub === 'all');
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function backToCategoriesList() {
  state.currentCategory = 'all';
  state.currentSubcategory = 'all';
  state.searchQuery = '';
  showCatalogCategoriesView();
}

function filterSubcategory(sub) {
  state.currentSubcategory = sub;
  document.querySelectorAll('.subcat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.sub === sub);
  });
  applyFilters();
}

function focusSearch() {
  switchTab('catalog');
  showCatalogCategoriesView();
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) {
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (suggestionsBox) suggestionsBox.style.display = 'none';

  applyFilters();
}

function resetActiveFilters() {
  state.currentCategory = 'all';
  state.currentBrand = 'all';
  state.currentSubcategory = 'all';
  state.searchQuery = '';
  clearSearch();
  backToCategoriesList();
}

/* ========================================================
   BRAND PILLS & BRAND MATCHING
======================================================== */
function renderBrandPills() {
  const brandPillsRow = document.getElementById('brand-pills-row');
  if (!brandPillsRow) return;

  const brandCounts = {};
  state.products.forEach(p => {
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  });

  const brands = Object.keys(brandCounts).sort((a, b) => a.localeCompare(b, 'fr'));

  let html = `
    <button type="button" class="brand-pill-btn ${state.currentBrand === 'all' ? 'active' : ''}" onclick="window.app.filterByBrand('all')">
      <span>🌟 Toutes les marques (${state.products.length})</span>
    </button>
  `;

  brands.forEach(b => {
    const isActive = state.currentBrand.toLowerCase() === b.toLowerCase();
    html += `
      <button type="button" class="brand-pill-btn ${isActive ? 'active' : ''}" onclick="window.app.filterByBrand('${escapeJs(b)}')">
        <span>🏷️ ${escapeHtml(b)} (${brandCounts[b]})</span>
      </button>
    `;
  });

  brandPillsRow.innerHTML = html;
}

function filterByBrand(brandName) {
  state.currentBrand = brandName;
  state.currentCategory = 'all';
  renderBrandPills();
  showCatalogProductsView();

  const titleEl = document.getElementById('category-listing-title');
  if (titleEl) {
    titleEl.textContent = brandName === 'all' ? 'Toutes les marques' : `Marque : ${brandName}`;
  }

  applyFilters();
}

function checkBrandMatch(query) {
  const suggestionsBox = document.getElementById('brand-search-suggestions');
  if (!suggestionsBox) return;

  const trimmed = (query || '').trim().toLowerCase();
  if (trimmed.length < 2) {
    suggestionsBox.style.display = 'none';
    return;
  }

  const brands = Array.from(new Set(state.products.map(p => p.brand).filter(Boolean)));
  const matches = brands.filter(b => b.toLowerCase().includes(trimmed));

  if (matches.length === 0) {
    suggestionsBox.style.display = 'none';
    return;
  }

  suggestionsBox.style.display = 'flex';
  suggestionsBox.innerHTML = `
    <span class="suggestion-label">🏷️ Marque correspondante :</span>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      ${matches.map(b => `
        <button type="button" class="brand-quick-match-pill" onclick="window.app.filterByBrand('${escapeJs(b)}')">
          <strong>${escapeHtml(b)}</strong> ➔
        </button>
      `).join('')}
    </div>
  `;
}

/* ========================================================
   FILTER APPLICATION & GRID RENDERING
======================================================== */
function applyFilters() {
  state.filteredProducts = state.products.filter(p => {
    // Category match
    if (state.currentCategory !== 'all') {
      if (p.category !== state.currentCategory) return false;
    }

    // Subcategory match
    if (state.currentSubcategory !== 'all') {
      const pText = (p.name + ' ' + p.description + ' ' + p.category).toLowerCase();
      if (state.currentSubcategory === 'visage' && !pText.includes('visage') && !pText.includes('crème') && !pText.includes('sérum')) return false;
      if (state.currentSubcategory === 'corps' && !pText.includes('corps') && !pText.includes('lait') && !pText.includes('pain') && !pText.includes('savon')) return false;
      if (state.currentSubcategory === 'solaire' && !pText.includes('solaire') && !pText.includes('spf')) return false;
    }

    // Brand match
    if (state.currentBrand !== 'all') {
      if ((p.brand || '').toLowerCase() !== state.currentBrand.toLowerCase()) return false;
    }

    // Search query match
    if (state.searchQuery && state.searchQuery.trim().length > 0) {
      const q = state.searchQuery.trim().toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchRef = (p.ref || '').toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchDesc && !matchRef) return false;
    }

    return true;
  });

  renderProductsGrid();
}

function renderProductsGrid() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('category-listing-count');
  if (!grid) return;

  const count = state.filteredProducts.length;
  if (countEl) countEl.textContent = `${count} produit${count > 1 ? 's' : ''}`;

  if (count === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 8px;">🔍</span>
        <strong style="font-size: 1.1rem; color: var(--navy-deep); display: block;">Aucun produit trouvé</strong>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Essayez d'effacer les filtres ou modifier votre recherche.</p>
        <button type="button" class="mockup-btn-primary" style="margin-top: 14px;" onclick="window.app.resetActiveFilters()">Réinitialiser les filtres</button>
      </div>
    `;
    return;
  }

  let html = '';
  state.filteredProducts.forEach(p => {
    html += generateProductCardHtml(p);
  });
  grid.innerHTML = html;
}

/* ========================================================
   PRODUCT CARD HTML GENERATOR (SCREEN 3 MOCKUP FIDELITY)
======================================================== */
function generateProductCardHtml(p) {
  const currentQty = state.localQuantities[p.id] || getInitialQuantity(p);
  const allows3 = Boolean(p.allow3UnitsPermanent || p.allow3UnitsSpecial);
  const tagText = allows3 ? 'Palier 3' : 'Palier 6';
  const tagClass = allows3 ? 'mockup-card-special-tag' : 'mockup-card-tag';

  return `
    <div class="mockup-product-card" id="card-${p.id}">
      <div class="mockup-card-img-wrap" onclick="window.app.openProductModal('${p.id}')">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" class="mockup-card-img" loading="lazy">
        <span class="${tagClass}">${tagText}</span>
      </div>
      <div class="mockup-card-content">
        <span class="mockup-card-brand">${escapeHtml(p.brand || 'BKO')}</span>
        <h3 class="mockup-card-name" onclick="window.app.openProductModal('${p.id}')" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
        <span class="mockup-card-format">${escapeHtml(p.format || 'Standard')}</span>

        <div class="mockup-card-price-row">
          <span class="mockup-card-price">${formatFCFA(p.unitPrice)}</span>
          <span class="mockup-card-unit-label">/ unité</span>
        </div>

        <div class="mockup-stepper-wrap">
          <button type="button" class="mockup-stepper-btn" onclick="window.app.stepQuantity('${p.id}', -1, this)" aria-label="Diminuer quantité">−</button>
          <span class="mockup-stepper-val" id="qty-${p.id}">${currentQty}</span>
          <button type="button" class="mockup-stepper-btn" onclick="window.app.stepQuantity('${p.id}', 1, this)" aria-label="Augmenter quantité">+</button>
        </div>

        <button type="button" class="mockup-btn-add-cart" onclick="window.app.addToCart('${p.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <span>Ajouter</span>
        </button>
      </div>
    </div>
  `;
}

/* ========================================================
   QUANTITY STEPPING & STRICT PACKAGING RULES
======================================================== */
function stepQuantity(productId, direction, btnEl = null) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const current = state.localQuantities[productId] || getInitialQuantity(product);
  let next;

  if (direction > 0) {
    next = getNextQuantity(current, product);
  } else {
    next = getPrevQuantity(current, product);
  }

  const check = isQuantityAllowed(next, product);
  if (!check.valid) {
    showToastNotification(check.message, 'warning');
    return;
  }

  state.localQuantities[productId] = next;

  // Update in UI everywhere
  const qtySpan = document.getElementById(`qty-${productId}`);
  if (qtySpan) qtySpan.textContent = next;

  const detailQty = document.getElementById('modal-product-qty');
  if (detailQty && state.selectedProduct && state.selectedProduct.id === productId) {
    detailQty.textContent = next;
    const totalBtn = document.getElementById('modal-add-cart-text');
    if (totalBtn) {
      const totalAmount = next * product.unitPrice;
      totalBtn.textContent = `Ajouter au panier (${formatFCFA(totalAmount)})`;
    }
  }
}

/* ========================================================
   CART PERSISTENCE & ACTIONS
======================================================== */
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) state.cart = JSON.parse(saved);
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

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const qtyToAdd = state.localQuantities[productId] || getInitialQuantity(product);
  const check = isQuantityAllowed(qtyToAdd, product);

  if (!check.valid) {
    showToastNotification(check.message, 'warning');
    return;
  }

  const existingIndex = state.cart.findIndex(item => item.id === productId);

  if (existingIndex > -1) {
    const newQty = state.cart[existingIndex].qty + qtyToAdd;
    const checkCombined = isQuantityAllowed(newQty, product);
    if (!checkCombined.valid) {
      showToastNotification(checkCombined.message, 'warning');
      return;
    }
    state.cart[existingIndex].qty = newQty;
  } else {
    state.cart.push({
      id: product.id,
      ref: product.ref,
      name: product.name,
      brand: product.brand,
      category: product.category,
      format: product.format,
      image: product.image,
      unitPrice: product.unitPrice,
      qty: qtyToAdd,
      allow3UnitsPermanent: product.allow3UnitsPermanent,
      allow3UnitsSpecial: product.allow3UnitsSpecial,
      stock: product.stock
    });
  }

  saveCartToStorage();
  updateCartBadge();
  showToastNotification(`✓ ${qtyToAdd} × ${product.name} ajouté au panier !`, 'online');

  // If cart drawer is open, re-render it
  if (state.isCartDrawerOpen) {
    renderCartDrawer();
  }
}

function updateCartBadge() {
  const totalUnits = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

  // Update top header badges
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = totalUnits;
  });

  // Update bottom navigation cart badge
  const bottomBadge = document.getElementById('bottom-cart-badge');
  if (bottomBadge) {
    bottomBadge.textContent = totalUnits;
    bottomBadge.style.display = totalUnits > 0 ? 'flex' : 'none';
  }

  const stickyUnits = document.getElementById('sticky-cart-units');
  const stickyTotal = document.getElementById('sticky-cart-total');
  if (stickyUnits) stickyUnits.textContent = `${totalUnits} unité${totalUnits > 1 ? 's' : ''}`;
  if (stickyTotal) stickyTotal.textContent = formatFCFA(totalAmount);
}

function openCartDrawer() {
  state.isCartDrawerOpen = true;
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  renderCartDrawer();

  if (drawer) drawer.classList.add('active');
  if (backdrop) backdrop.classList.add('active');
}

function closeCartDrawer() {
  state.isCartDrawerOpen = false;
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  if (drawer) drawer.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function renderCartDrawer() {
  const body = document.getElementById('cart-drawer-body');
  const footerTotal = document.getElementById('cart-footer-total');
  const countText = document.getElementById('cart-items-count-text');
  const btnCheckout = document.getElementById('btn-proceed-checkout');
  if (!body) return;

  const totalUnits = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

  if (countText) countText.textContent = `${totalUnits} article${totalUnits > 1 ? 's' : ''}`;
  if (footerTotal) footerTotal.textContent = formatFCFA(totalAmount);

  if (state.cart.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 48px 16px;">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">🛒</span>
        <strong style="font-size: 1.15rem; color: var(--navy-deep); display: block;">Votre panier est vide</strong>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">
          Parcourez notre catalogue et sélectionnez des lots de produits cosmétiques en gros.
        </p>
        <button type="button" class="mockup-btn-primary" style="margin-top: 20px; width: 100%;" onclick="window.app.closeCartDrawer(); window.app.switchTab('catalog');">
          Découvrir le catalogue
        </button>
      </div>
    `;
    if (btnCheckout) btnCheckout.style.display = 'none';
    return;
  }

  if (btnCheckout) btnCheckout.style.display = 'flex';

  let html = '';
  state.cart.forEach(item => {
    const lineTotal = item.unitPrice * item.qty;
    html += `
      <div class="cart-item-row">
        <div class="cart-item-thumb">
          <img src="${item.image}" alt="${escapeHtml(item.name)}">
        </div>
        <div class="cart-item-info">
          <h4 class="cart-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
          <div class="cart-item-unit-price">${formatFCFA(item.unitPrice)} / u</div>
          <div class="cart-item-stepper-wrap">
            <button type="button" class="btn-cart-qty" onclick="window.app.updateCartItemQty('${item.id}', -1)">−</button>
            <span class="cart-qty-val">${item.qty}</span>
            <button type="button" class="btn-cart-qty" onclick="window.app.updateCartItemQty('${item.id}', 1)">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-total">${formatFCFA(lineTotal)}</span>
          <button type="button" class="btn-delete-cart-item" onclick="window.app.removeCartItem('${item.id}')" aria-label="Supprimer">🗑️</button>
        </div>
      </div>
    `;
  });

  body.innerHTML = html;
}

function updateCartItemQty(productId, direction) {
  const itemIndex = state.cart.findIndex(i => i.id === productId);
  if (itemIndex === -1) return;

  const item = state.cart[itemIndex];
  let next;

  if (direction > 0) {
    next = getNextQuantity(item.qty, item);
  } else {
    next = getPrevQuantity(item.qty, item);
  }

  // If decremented below minimum initial quantity, remove it
  const minAllowed = (item.allow3UnitsPermanent || item.allow3UnitsSpecial) ? 3 : 6;
  if (next < minAllowed) {
    removeCartItem(productId);
    return;
  }

  const check = isQuantityAllowed(next, item);
  if (!check.valid) {
    showToastNotification(check.message, 'warning');
    return;
  }

  state.cart[itemIndex].qty = next;
  saveCartToStorage();
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter(i => i.id !== productId);
  saveCartToStorage();
  updateCartBadge();
  renderCartDrawer();
  showToastNotification('Article retiré du panier.', 'online');
}

/* ========================================================
   SCREEN 4: FICHE PRODUIT MODAL
======================================================== */
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.selectedProduct = product;
  const modal = document.getElementById('product-detail-modal');
  const body = document.getElementById('product-modal-body');
  if (!modal || !body) return;

  const currentQty = state.localQuantities[product.id] || getInitialQuantity(product);
  const totalAmount = currentQty * product.unitPrice;
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
  const packInfo = allows3 ? 'Paliers autorisés : 3, 6, 12, 18, 24...' : 'Colisage standard de 6 en 6 (6, 12, 18...)';

  body.innerHTML = `
    <div class="product-detail-img-box">
      <img src="${product.image}" alt="${escapeHtml(product.name)}">
    </div>

    <span class="product-detail-brand">${escapeHtml(product.brand || 'BKO Cosmo')}</span>
    <h2 class="product-detail-title">${escapeHtml(product.name)}</h2>

    <div class="product-detail-rating">
      <span>★★★★★</span>
      <strong style="color:var(--navy-deep);">4.8</strong>
      <span class="product-detail-rating-text">(124 avis professionnels)</span>
    </div>

    <div class="product-detail-price-box">
      <div>
        <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Prix unitaire de gros :</span>
        <strong class="product-detail-price">${formatFCFA(product.unitPrice)}</strong>
      </div>
      <span class="product-detail-pack-tag">${allows3 ? '⚡ Exception 3 unités' : '📦 Colisage standard 6'}</span>
    </div>

    <div class="product-detail-stepper-row">
      <div class="product-detail-stepper-box">
        <button type="button" class="btn-detail-step" onclick="window.app.stepQuantity('${product.id}', -1, this)">−</button>
        <div style="text-align:center;">
          <span class="detail-step-val" id="modal-product-qty">${currentQty}</span>
          <span style="font-size:0.65rem; color:var(--text-muted); display:block;">unités</span>
        </div>
        <button type="button" class="btn-detail-step" onclick="window.app.stepQuantity('${product.id}', 1, this)">+</button>
      </div>
    </div>

    <button type="button" class="btn-detail-add-cart" onclick="window.app.addToCart('${product.id}'); window.app.closeProductModal();">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      <span id="modal-add-cart-text">Ajouter au panier (${formatFCFA(totalAmount)})</span>
    </button>

    <div style="margin-top:16px;">
      <h4 style="font-size:0.9rem; font-weight:800; color:var(--navy-deep); margin-bottom:6px;">Description &amp; Caractéristiques</h4>
      <p style="font-size:0.8125rem; color:var(--text-muted); line-height:1.5;">
        ${escapeHtml(product.description || 'Produit cosmétique de haute qualité certifié pour la distribution en pharmacie et supermarché à Bamako.')}
      </p>
      <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-top:8px;">
        ℹ️ ${packInfo}
      </div>
    </div>

    <div class="product-detail-badges-grid">
      <div class="detail-badge-item">
        <span>🛡️</span>
        <strong>Stock Bamako Garanti</strong>
      </div>
      <div class="detail-badge-item">
        <span>✓</span>
        <strong>100% Authentique</strong>
      </div>
      <div class="detail-badge-item">
        <span>🚚</span>
        <strong>Livraison Express 24-48h</strong>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeProductModal() {
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.remove('active');
  state.selectedProduct = null;
}

/* ========================================================
   SCREEN 6: COMMANDE (CHECKOUT - 4 STEPS)
======================================================== */
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToastNotification('Votre panier est vide.', 'warning');
    return;
  }

  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  const body = document.getElementById('checkout-modal-body');
  if (!modal || !body) return;

  const totalUnits = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);

  body.innerHTML = `
    <form id="mobile-checkout-form" onsubmit="window.app.handleOrderSubmit(event)">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
          <span>Nombre d'articles :</span>
          <strong>${totalUnits} unités</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:1rem; color:var(--navy-deep);">
          <strong>Total de la commande :</strong>
          <strong style="color:var(--primary);">${formatFCFA(totalAmount)}</strong>
        </div>
      </div>

      <div class="form-group-mobile">
        <label for="co-pharmacy">Nom de votre Pharmacie ou Établissement *</label>
        <input type="text" id="co-pharmacy" class="form-input-mobile" placeholder="ex: Grande Pharmacie du Pont" required>
      </div>

      <div class="form-group-mobile">
        <label for="co-contact">Nom du responsable ou gérant *</label>
        <input type="text" id="co-contact" class="form-input-mobile" placeholder="ex: Dr. Traoré" required>
      </div>

      <div class="form-group-mobile">
        <label for="co-phone">Numéro Téléphone / WhatsApp Bamako *</label>
        <input type="tel" id="co-phone" class="form-input-mobile" placeholder="+223 70 00 00 00" required>
      </div>

      <div class="form-group-mobile">
        <label for="co-quartier">Quartier à Bamako *</label>
        <select id="co-quartier" class="form-input-mobile" required>
          ${BAMAKO_QUARTIERS.map(q => `<option value="${q}">${q}</option>`).join('')}
        </select>
      </div>

      <div class="form-group-mobile">
        <label for="co-address">Précision d'adresse / Repère de livraison</label>
        <input type="text" id="co-address" class="form-input-mobile" placeholder="ex: Rue 14, en face du marché">
      </div>

      <div class="form-group-mobile">
        <label for="co-payment">Mode de règlement B2B *</label>
        <select id="co-payment" class="form-input-mobile">
          <option value="delivery_cash">Paiement en espèces à la livraison</option>
          <option value="cheque">Chèque certifié à réception</option>
          <option value="transfer">Virement bancaire professionnel</option>
        </select>
      </div>

      <button type="submit" class="mockup-btn-checkout-gold" id="btn-submit-order" style="margin-top:18px;">
        <span>Confirmer &amp; Transmettre la Demande</span>
        <span>➔</span>
      </button>

      <p style="font-size:0.75rem; color:var(--text-muted); text-align:center; margin-top:10px;">
        Aucun paiement en ligne requis. Votre commande sera vérifiée et préparée immédiatement par notre entrepôt.
      </p>
    </form>
  `;

  modal.classList.add('active');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('active');
}

async function handleOrderSubmit(e) {
  e.preventDefault();

  const pharmacyInput = document.getElementById('co-pharmacy');
  const contactInput = document.getElementById('co-contact');
  const phoneInput = document.getElementById('co-phone');
  const quartierInput = document.getElementById('co-quartier');
  const addressInput = document.getElementById('co-address');
  const paymentInput = document.getElementById('co-payment');
  const btnSubmit = document.getElementById('btn-submit-order');

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Transmission en cours...</span>';
  }

  const orderPayload = {
    customerName: contactInput.value.trim(),
    businessName: pharmacyInput.value.trim(),
    phone: phoneInput.value.trim(),
    neighborhood: quartierInput.value,
    address: addressInput.value.trim(),
    paymentMethod: paymentInput.value,
    items: state.cart.map(i => ({
      productId: i.id,
      name: i.name,
      qty: i.qty,
      unitPrice: i.unitPrice
    }))
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Erreur lors de la transmission de la commande');
    }

    // Save order in local history
    const savedOrder = {
      orderId: result.orderId,
      date: new Date().toLocaleDateString('fr-FR'),
      businessName: orderPayload.businessName,
      totalAmount: result.totalAmount || state.cart.reduce((s, i) => s + (i.unitPrice * i.qty), 0),
      itemsCount: state.cart.reduce((s, i) => s + i.qty, 0),
      status: 'pending'
    };
    saveOrderToLocalHistory(savedOrder);

    // Save pharmacy name in profile
    const nameEl = document.getElementById('account-disp-name');
    if (nameEl) nameEl.textContent = orderPayload.businessName;
    const locEl = document.getElementById('account-disp-location');
    if (locEl) locEl.textContent = orderPayload.neighborhood + ', Bamako';

    // Clear cart
    state.cart = [];
    saveCartToStorage();
    updateCartBadge();

    // Render Confirmation Step 4
    renderOrderConfirmationScreen(result.orderId, orderPayload, savedOrder.totalAmount);
  } catch (err) {
    alert('Erreur : ' + err.message);
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>Confirmer &amp; Transmettre</span>';
    }
  }
}

function renderOrderConfirmationScreen(orderId, orderData, totalAmount) {
  const body = document.getElementById('checkout-modal-body');
  const step4 = document.getElementById('checkout-step-4');
  if (step4) step4.classList.add('active');

  const cleanWaNumber = (state.settings.whatsappNumber || '+22370000000').replace(/[^0-9]/g, '');
  const waMessage = encodeURIComponent(
    `Bonjour BKO Cosmo Distribution, je viens de valider la commande N° ${orderId} pour l'établissement "${orderData.businessName}" (${orderData.neighborhood}, Bamako). Merci de me confirmer le créneau de livraison.`
  );

  body.innerHTML = `
    <div style="text-align:center; padding:16px 8px;">
      <div style="width:64px; height:64px; background:#ecfdf5; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto; font-size:2rem; color:#059669;">
        ✓
      </div>
      <h3 style="font-size:1.3rem; font-weight:900; color:var(--navy-deep); margin-bottom:6px;">Demande Transmise avec Succès !</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">
        Votre commande est enregistrée et transmise à l'entrepôt pour vérification et colisage.
      </p>

      <div style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:12px; padding:14px; margin-bottom:20px;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Référence de votre commande :</span>
        <strong style="font-size:1.25rem; font-family:monospace; color:var(--navy-deep); letter-spacing:0.04em;">${orderId}</strong>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <a href="https://wa.me/${cleanWaNumber}?text=${waMessage}" target="_blank" class="mockup-btn-checkout-gold" style="text-decoration:none;">
          <span>💬 Notifier le Commercial sur WhatsApp</span>
        </a>
        <button type="button" class="mockup-btn-primary" onclick="window.app.closeCheckoutModal(); window.app.switchTab('track');">
          Suivre ma commande
        </button>
      </div>
    </div>
  `;
}

/* ========================================================
   LOCAL ORDER HISTORY & TRACKING
======================================================== */
function loadOrdersFromStorage() {
  try {
    const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (saved) state.recentOrders = JSON.parse(saved);
  } catch (e) {
    state.recentOrders = [];
  }
}

function saveOrderToLocalHistory(order) {
  state.recentOrders.unshift(order);
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(state.recentOrders.slice(0, 10)));
  } catch (e) {}
}

function renderRecentOrdersList() {
  const container = document.getElementById('recent-orders-list');
  if (!container) return;

  if (state.recentOrders.length === 0) {
    container.innerHTML = '<p style="font-size:0.8125rem; color:var(--text-muted);">Aucune commande récente enregistrée sur cet appareil.</p>';
    return;
  }

  let html = '';
  state.recentOrders.forEach(o => {
    html += `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:0.9rem; font-family:monospace; color:var(--navy-deep); display:block;">${o.orderId}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${o.date} • ${o.itemsCount} unités • ${formatFCFA(o.totalAmount)}</span>
        </div>
        <button type="button" class="btn-clear-filter-small" onclick="document.getElementById('track-order-input').value='${o.orderId}'; window.app.trackOrderDirect(event);">
          Suivre ➔
        </button>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function trackOrderDirect(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('track-order-input');
  const resultBox = document.getElementById('tracking-result-box');
  if (!input || !resultBox) return;

  const orderId = input.value.trim().toUpperCase();
  if (!orderId) return;

  resultBox.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Vérification auprès de l\'entrepôt...</p>';

  try {
    const res = await fetch(`/api/orders/${orderId}/track`);
    const data = await res.json();

    if (!res.ok) {
      resultBox.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px; color:#dc2626; font-size:0.875rem;">
          ❌ ${data.error || 'Commande introuvable. Veuillez vérifier le code.'}
        </div>
      `;
      return;
    }

    const statusLabels = {
      pending: '🟡 En attente de validation',
      confirmed: '🔵 Validée par le gérant',
      preparing: '🟠 En préparation dans l\'entrepôt',
      in_transit: '🚚 En cours de livraison à Bamako',
      delivered: '🟢 Livrée avec succès',
      cancelled: '🔴 Annulée'
    };

    resultBox.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:1.05rem; font-family:monospace; color:var(--navy-deep);">${data.orderId}</strong>
          <span style="font-size:0.75rem; font-weight:700; background:#ffffff; border:1px solid #e2e8f0; padding:3px 8px; border-radius:6px;">
            ${statusLabels[data.status] || data.status}
          </span>
        </div>
        <div style="font-size:0.8125rem; color:var(--text-muted); margin-bottom:6px;">
          Établissement : <strong>${escapeHtml(data.businessName || 'Client Pro')}</strong>
        </div>
        <div style="font-size:0.8125rem; color:var(--text-muted);">
          Total commande : <strong>${formatFCFA(data.totalAmount)}</strong> (${data.itemsCount} unités)
        </div>
      </div>
    `;
  } catch (err) {
    resultBox.innerHTML = '<p style="color:#dc2626; font-size:0.85rem;">Impossible de joindre le serveur.</p>';
  }
}

/* ========================================================
   QUICK ORDER & ARRIVAGES RENDERING
======================================================== */
function renderQuickOrderList() {
  const container = document.getElementById('quick-order-items-list');
  if (!container) return;

  let html = '';
  state.products.forEach(p => {
    const currentQty = state.localQuantities[p.id] || getInitialQuantity(p);
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9; gap:10px;">
        <div style="flex:1; min-width:0;">
          <strong style="font-size:0.8125rem; color:var(--navy-deep); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.name)}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(p.brand)} • ${formatFCFA(p.unitPrice)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="mockup-stepper-wrap" style="margin:0;">
            <button type="button" class="mockup-stepper-btn" onclick="window.app.stepQuantity('${p.id}', -1, this)">−</button>
            <span class="mockup-stepper-val" id="quick-qty-${p.id}">${currentQty}</span>
            <button type="button" class="mockup-stepper-btn" onclick="window.app.stepQuantity('${p.id}', 1, this)">+</button>
          </div>
          <button type="button" class="mockup-btn-primary" style="padding:6px 12px; font-size:0.75rem; min-height:32px;" onclick="window.app.addToCart('${p.id}')">
            Ajouter
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderArrivagesList() {
  const container = document.getElementById('arrivages-products-grid');
  if (!container) return;

  const arrivages = state.products.filter(p => p.isNewArrival || p.isNewProduct || p.isRestock);
  let html = '';
  arrivages.forEach(p => {
    html += generateProductCardHtml(p);
  });
  container.innerHTML = html;
}

function shareArrivagesOnWhatsApp() {
  const cleanWaNumber = (state.settings.whatsappNumber || '+22370000000').replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent('Bonjour, je souhaite recevoir la liste complète des nouveaux arrivages BKO Cosmo Distribution.')}`;
  window.open(url, '_blank');
}

/* ========================================================
   SCREEN 8: PWA INSTALLATION & SERVICE WORKER
======================================================== */
let deferredPrompt = null;

function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('PWA ServiceWorker ready, scope:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch(err => console.warn('PWA ServiceWorker error:', err));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.getElementById('mobile-pwa-banner');
    if (banner && !sessionStorage.getItem('bko_pwa_dismissed')) {
      banner.style.display = 'flex';
    }

    const btnHeader = document.getElementById('pwa-install-header-btn');
    if (btnHeader) btnHeader.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const banner = document.getElementById('mobile-pwa-banner');
    if (banner) banner.style.display = 'none';
    showToastNotification('✓ Application BKO Cosmo installée avec succès !', 'online');
  });

  window.addEventListener('online', () => showToastNotification('✓ Connexion Internet active', 'online'));
  window.addEventListener('offline', () => showToastNotification('📶 Mode Hors-Ligne actif', 'warning'));
}

function promptPwaInstall() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isStandalone) {
    alert('✓ L\'application BKO Cosmo est déjà installée sur votre écran.');
    return;
  }

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
    });
    return;
  }

  if (isIos) {
    const modal = document.getElementById('pwa-ios-modal');
    if (modal) modal.classList.add('active');
    return;
  }

  alert('Pour installer BKO Cosmo sur votre écran :\n\n1. Ouvrez le menu de votre navigateur (les 3 points en haut ou en bas).\n2. Appuyez sur « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ».\n3. L\'icône BKO Cosmo apparaîtra instantanément avec vos applications !');
}

function dismissPwaBanner() {
  const banner = document.getElementById('mobile-pwa-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('bko_pwa_dismissed', 'true');
}

function closeIosModal() {
  const modal = document.getElementById('pwa-ios-modal');
  if (modal) modal.classList.remove('active');
}

function showToastNotification(message, type = 'online') {
  const toast = document.getElementById('product-added-toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `product-added-toast ${type}`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}
