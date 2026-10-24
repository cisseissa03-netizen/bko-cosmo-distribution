// Admin & CEO Space Management Script
import { formatFCFA } from './rules.js';

const ADMIN_TOKEN_KEY = 'bko_admin_token';

const adminState = {
  token: sessionStorage.getItem(ADMIN_TOKEN_KEY) || null,
  user: null,
  currentTab: 'dashboard',
  orders: [],
  products: [],
  stats: null,
  selectedOrder: null,
  selectedProductForEdit: null,
  orderSearchQuery: '',
  orderStatusFilter: 'all',
  orderPaymentFilter: 'all'
};

/* ========================================================
   REGISTER PUBLIC WINDOW.ADMIN IMMEDIATELY
======================================================== */
window.admin = {
  openOrderDetailModal,
  closeOrderDetailModal,
  updateOrderStatus,
  updateOrderPayment,
  saveInternalNote,
  saveDeliveredQuantities,
  toggleProductSetting,
  openAddProductModal,
  openProductEditModal,
  closeProductEditModal,
  handlePhotoFileSelected,
  setProductPhoto,
  clearProductPhoto,
  selectPresetPhoto,
  applyManualUrl,
  downloadExcelTemplate,
  exportCatalogToExcel,
  openImportExcelModal,
  closeImportExcelModal,
  handleExcelFileSelected,
  confirmExcelImport,
  openPinterestSearch,
  downloadPinterestPhoto,
  filterProductsTable
};

function initAdmin() {
  setupAdminEventListeners();
  checkAuth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

/* ========================================================
   AUTHENTICATION
======================================================== */
function checkAuth() {
  const loginSection = document.getElementById('admin-login-section');
  const appSection = document.getElementById('admin-app-section');

  if (!adminState.token) {
    if (loginSection) loginSection.style.display = 'flex';
    if (appSection) appSection.style.display = 'none';
  } else {
    if (loginSection) loginSection.style.display = 'none';
    if (appSection) appSection.style.display = 'block';
    loadAdminDashboard();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const passwordInput = document.getElementById('admin-password-input');
  const errorEl = document.getElementById('login-error-msg');
  if (!passwordInput) return;

  const password = passwordInput.value;
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Identifiants invalides');
    }

    adminState.token = data.token;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    adminState.user = data.user;

    checkAuth();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  adminState.token = null;
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  checkAuth();
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminState.token}`
  };
}

/* ========================================================
   DASHBOARD & STATS
======================================================== */
async function loadAdminDashboard() {
  await Promise.all([
    fetchStats(),
    fetchOrders(),
    fetchProducts()
  ]);

  renderKPIs();
  renderOrdersTable();
  renderProductsTable();
}

async function fetchStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      return;
    }
    adminState.stats = await res.json();
  } catch (e) {
    console.error('Stats error:', e);
  }
}

async function fetchOrders() {
  try {
    const res = await fetch('/api/admin/orders', { headers: getAuthHeaders() });
    if (res.ok) {
      adminState.orders = await res.json();
    }
  } catch (e) {
    console.error('Orders fetch error:', e);
  }
}

async function fetchProducts() {
  try {
    const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
    if (res.ok) {
      adminState.products = await res.json();
    }
  } catch (e) {
    console.error('Products fetch error:', e);
  }
}

function renderKPIs() {
  if (!adminState.stats) return;

  const s = adminState.stats;
  document.getElementById('kpi-pending-count').textContent = s.pendingOrders;
  document.getElementById('kpi-confirmed-count').textContent = s.confirmedOrders;
  document.getElementById('kpi-revenue-total').textContent = s.formattedPotentialRevenue;
  document.getElementById('kpi-low-stock').textContent = s.lowStockCount;
}

/* ========================================================
   ORDERS MANAGEMENT
======================================================== */
function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  let list = [...adminState.orders];

  if (adminState.orderStatusFilter !== 'all') {
    list = list.filter(o => o.status === adminState.orderStatusFilter);
  }

  if (adminState.orderPaymentFilter !== 'all') {
    list = list.filter(o => o.paymentStatus === adminState.orderPaymentFilter);
  }

  if (adminState.orderSearchQuery.trim()) {
    const q = adminState.orderSearchQuery.trim().toLowerCase();
    list = list.filter(o =>
      o.orderRef.toLowerCase().includes(q) ||
      o.establishmentName.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      o.contactName.toLowerCase().includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-light);">Aucune demande correspondante.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(o => {
    let statusClass = 'status-received';
    if (o.status === 'En vérification') statusClass = 'status-verif';
    if (o.status === 'Confirmée') statusClass = 'status-confirmed';
    if (o.status === 'En préparation') statusClass = 'status-prep';
    if (o.status === 'En livraison') statusClass = 'status-delivering';
    if (o.status === 'Livrée') statusClass = 'status-delivered';
    if (o.status === 'Annulée') statusClass = 'status-cancelled';

    const cleanPhone = o.phone.replace(/[^0-9]/g, '');

    return `
      <tr>
        <td style="font-family:monospace; font-weight:800; color:var(--primary);">${o.orderRef}</td>
        <td>
          <strong>${o.establishmentName}</strong>
          <div style="font-size:0.75rem; color:var(--text-light);">${o.establishmentType} • ${o.neighborhood}</div>
        </td>
        <td>
          <div>${o.contactName}</div>
          <a href="https://wa.me/${cleanPhone}" target="_blank" style="font-size:0.78rem; color:#16a34a; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
            <span>${o.phone}</span>
          </a>
        </td>
        <td><strong>${formatFCFA(o.totalAmount)}</strong></td>
        <td><span class="status-pill ${statusClass}">${o.status}</span></td>
        <td><span style="font-size:0.8125rem; font-weight:600;">${o.paymentStatus || 'Non payé'}</span></td>
        <td>
          <button class="btn-secondary-large" style="padding:6px 12px; font-size:0.8125rem; min-height:36px;" onclick="window.admin.openOrderDetailModal('${o.id}')">
            Détails & Traiter
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openOrderDetailModal(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  adminState.selectedOrder = order;
  const modal = document.getElementById('order-detail-modal');
  const body = document.getElementById('order-modal-body');
  if (!modal || !body) return;

  const cleanPhone = order.phone.replace(/[^0-9]/g, '');

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
      <div>
        <span style="font-family:monospace; font-size:1.25rem; font-weight:900; color:var(--primary);">${order.orderRef}</span>
        <div style="font-size:0.8125rem; color:var(--text-light);">Reçue le ${new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <a href="/print-proforma.html?id=${order.id}" target="_blank" class="btn-secondary-large" style="font-size:0.8125rem; padding:6px 12px; min-height:36px;">
          📄 Imprimer Devis Proforma
        </a>
        <a href="/print-delivery.html?id=${order.id}" target="_blank" class="btn-primary-large" style="font-size:0.8125rem; padding:6px 12px; min-height:36px;">
          🚚 Bon de Livraison (BL)
        </a>
      </div>
    </div>

    <!-- Client Info Box -->
    <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; margin-bottom:20px;">
      <h4 style="font-size:0.9rem; font-weight:800; margin-bottom:10px;">Coordonnées Établissement</h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:0.85rem;">
        <div><strong>Établissement :</strong> ${order.establishmentName} (${order.establishmentType})</div>
        <div><strong>Contact :</strong> ${order.contactName}</div>
        <div>
          <strong>Téléphone :</strong> 
          <a href="https://wa.me/${cleanPhone}" target="_blank" style="color:#16a34a; font-weight:700;">${order.phone} (WhatsApp)</a>
        </div>
        <div><strong>Quartier Bamako :</strong> ${order.neighborhood}</div>
        <div><strong>Adresse / Repère :</strong> ${order.address || 'Non spécifié'}</div>
        <div><strong>Consignes :</strong> ${order.deliveryNotes || 'Aucune'}</div>
      </div>
      ${order.observation ? `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); font-size:0.8125rem;"><strong>Note client :</strong> ${order.observation}</div>` : ''}
    </div>

    <!-- Products Ordered Table -->
    <h4 style="font-size:0.9rem; font-weight:800; margin-bottom:8px;">Articles commandés (Prix gelés à la commande)</h4>
    <div style="overflow-x:auto; margin-bottom:20px;">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg-main); text-align:left; border-bottom:2px solid var(--border);">
            <th style="padding:8px;">Réf</th>
            <th style="padding:8px;">Produit</th>
            <th style="padding:8px;">Prix Unitaire</th>
            <th style="padding:8px; text-align:center;">Quantité Demandée</th>
            <th style="padding:8px; text-align:center;">Quantité Livrée</th>
            <th style="padding:8px; text-align:right;">Total Ligne</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item, index) => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px; font-family:monospace;">${item.ref}</td>
              <td style="padding:8px;"><strong>${item.name}</strong> (${item.format})</td>
              <td style="padding:8px;">${formatFCFA(item.unitPrice)}</td>
              <td style="padding:8px; text-align:center;"><strong>${item.qty}</strong></td>
              <td style="padding:8px; text-align:center;">
                <input type="number" id="delivered-qty-${index}" value="${item.deliveredQty !== undefined ? item.deliveredQty : item.qty}" min="0" style="width:60px; text-align:center; padding:4px; border:1px solid var(--border); border-radius:4px;">
              </td>
              <td style="padding:8px; text-align:right; font-weight:700;">${formatFCFA(item.lineTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:900; font-size:0.95rem; background:var(--bg-main);">
            <td colspan="5" style="padding:10px; text-align:right;">TOTAL DE LA DEMANDE :</td>
            <td style="padding:10px; text-align:right; color:var(--primary);">${formatFCFA(order.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Management Controls -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div class="form-group">
        <label class="form-label">Statut de la demande commerciale</label>
        <select id="modal-order-status" class="form-control" onchange="window.admin.updateOrderStatus('${order.id}', this.value)">
          <option value="Demande reçue" ${order.status === 'Demande reçue' ? 'selected' : ''}>Demande reçue</option>
          <option value="En vérification" ${order.status === 'En vérification' ? 'selected' : ''}>En vérification</option>
          <option value="En attente du client" ${order.status === 'En attente du client' ? 'selected' : ''}>En attente du client</option>
          <option value="Confirmée" ${order.status === 'Confirmée' ? 'selected' : ''}>Confirmée</option>
          <option value="En préparation" ${order.status === 'En préparation' ? 'selected' : ''}>En préparation</option>
          <option value="En livraison" ${order.status === 'En livraison' ? 'selected' : ''}>En livraison</option>
          <option value="Livrée" ${order.status === 'Livrée' ? 'selected' : ''}>Livrée</option>
          <option value="Annulée" ${order.status === 'Annulée' ? 'selected' : ''}>Annulée</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Statut de paiement (Indépendant de la livraison)</label>
        <select id="modal-payment-status" class="form-control" onchange="window.admin.updateOrderPayment('${order.id}', this.value)">
          <option value="Non payé" ${order.paymentStatus === 'Non payé' ? 'selected' : ''}>Non payé</option>
          <option value="Acompte versé" ${order.paymentStatus === 'Acompte versé' ? 'selected' : ''}>Acompte versé</option>
          <option value="Payé à la livraison" ${order.paymentStatus === 'Payé à la livraison' ? 'selected' : ''}>Payé à la livraison</option>
          <option value="Payé" ${order.paymentStatus === 'Payé' ? 'selected' : ''}>Payé</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Note interne commerciale (privée pour le gérant/CEO)</label>
      <div style="display:flex; gap:10px;">
        <input type="text" id="internal-note-input" class="form-control" value="${order.internalNotes || ''}" placeholder="ex: Contacté par tél, livraison convenue pour jeudi 10h">
        <button type="button" class="btn-primary-large" style="white-space:nowrap; min-height:44px;" onclick="window.admin.saveInternalNote('${order.id}')">
          Enregistrer Note
        </button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border); padding-top:14px; margin-top:20px; display:flex; justify-content:space-between;">
      <button type="button" class="btn-secondary-large" onclick="window.admin.saveDeliveredQuantities('${order.id}')">
        Mettre à jour les quantités livrées
      </button>
      <button type="button" class="btn-secondary-large" onclick="window.admin.closeOrderDetailModal()">
        Fermer
      </button>
    </div>
  `;

  modal.classList.add('active');
}

function closeOrderDetailModal() {
  const modal = document.getElementById('order-detail-modal');
  if (modal) modal.classList.remove('active');
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      const updated = await res.json();
      const index = adminState.orders.findIndex(o => o.id === orderId);
      if (index > -1) adminState.orders[index] = updated;
      fetchStats();
      renderKPIs();
      renderOrdersTable();
    }
  } catch (e) {
    alert('Erreur lors de la mise à jour du statut.');
  }
}

async function updateOrderPayment(orderId, paymentStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ paymentStatus })
    });

    if (res.ok) {
      const updated = await res.json();
      const index = adminState.orders.findIndex(o => o.id === orderId);
      if (index > -1) adminState.orders[index] = updated;
      renderOrdersTable();
    }
  } catch (e) {
    alert('Erreur lors de la mise à jour du statut de paiement.');
  }
}

async function saveInternalNote(orderId) {
  const input = document.getElementById('internal-note-input');
  if (!input) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/note`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ internalNotes: input.value })
    });

    if (res.ok) {
      alert('Note interne enregistrée avec succès.');
      const updated = await res.json();
      const index = adminState.orders.findIndex(o => o.id === orderId);
      if (index > -1) adminState.orders[index] = updated;
    }
  } catch (e) {
    alert('Erreur d\'enregistrement de la note.');
  }
}

async function saveDeliveredQuantities(orderId) {
  const order = adminState.selectedOrder;
  if (!order) return;

  const updatedItems = order.items.map((item, index) => {
    const input = document.getElementById(`delivered-qty-${index}`);
    const delivered = input ? Number(input.value) : item.qty;
    return { ...item, deliveredQty: delivered };
  });

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/items`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: updatedItems })
    });

    if (res.ok) {
      alert('Quantités livrées mises à jour pour le Bon de Livraison.');
      const updated = await res.json();
      const index = adminState.orders.findIndex(o => o.id === orderId);
      if (index > -1) adminState.orders[index] = updated;
      adminState.selectedOrder = updated;
      renderOrdersTable();
    }
  } catch (e) {
    alert('Erreur de mise à jour des quantités.');
  }
}

/* ========================================================
   PRODUCTS / CATALOG MANAGEMENT
======================================================== */
function renderProductsTable(filteredList) {
  const tbody = document.getElementById('admin-products-tbody');
  const countEl = document.getElementById('admin-catalog-count');
  if (!tbody) return;

  const list = filteredList || adminState.products;
  if (countEl) {
    countEl.textContent = `${list.length} référence${list.length > 1 ? 's' : ''}`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-light);">Aucun produit ne correspond à la recherche.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td style="font-family:monospace; font-weight:700;">${p.ref}</td>
      <td>
        <strong>${p.name}</strong>
        <div style="font-size:0.75rem; color:var(--text-light);">${p.brand} • ${p.category} • ${p.format}</div>
      </td>
      <td><strong>${formatFCFA(p.unitPrice)}</strong></td>
      <td>
        <span style="font-weight:700; color:${p.stock <= 24 ? 'var(--warning)' : 'var(--success)'};">${p.stock}</span>
      </td>
      <td>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
          <input type="checkbox" ${p.allow3UnitsPermanent ? 'checked' : ''} onchange="window.admin.toggleProductSetting('${p.id}', 'allow3UnitsPermanent', this.checked)">
          3 un. Permanent (Technique)
        </label>
        <br>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer; color:#b45309;">
          <input type="checkbox" ${p.allow3UnitsSpecial ? 'checked' : ''} onchange="window.admin.toggleProductSetting('${p.id}', 'allow3UnitsSpecial', this.checked)">
          3 un. Ponctuel (Stock)
        </label>
      </td>
      <td>
        <label style="cursor:pointer; font-weight:600; color:${p.active ? 'var(--success)' : 'var(--danger)'};">
          <input type="checkbox" ${p.active ? 'checked' : ''} onchange="window.admin.toggleProductSetting('${p.id}', 'active', this.checked)">
          ${p.active ? 'Actif' : 'Désactivé'}
        </label>
      </td>
      <td>
        <button class="btn-secondary-large" style="padding:4px 8px; font-size:0.75rem; min-height:30px;" onclick="window.admin.openProductEditModal('${p.id}')">
          Modifier
        </button>
      </td>
    </tr>
  `).join('');
}

function filterProductsTable(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderProductsTable();
    return;
  }
  const filtered = adminState.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.ref.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q)
  );
  renderProductsTable(filtered);
}

async function toggleProductSetting(productId, field, value) {
  try {
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ [field]: value })
    });

    if (res.ok) {
      const updated = await res.json();
      const index = adminState.products.findIndex(p => p.id === productId);
      if (index > -1) adminState.products[index] = updated;
    }
  } catch (e) {
    alert('Erreur lors de la mise à jour du produit.');
  }
}

/* ========================================================
   PRODUCT PHOTO MANAGEMENT & UPLOADS
======================================================== */
function setProductPhoto(url, label) {
  const hiddenInput = document.getElementById('product-photo-url-val');
  const previewBox = document.getElementById('photo-preview-box');
  const dropzone = document.getElementById('photo-dropzone');
  const previewImg = document.getElementById('product-photo-preview');
  const previewTitle = document.getElementById('photo-preview-title');
  const previewPath = document.getElementById('photo-preview-path');
  const statusIndicator = document.getElementById('upload-status-indicator');

  if (hiddenInput) hiddenInput.value = url;
  if (previewImg) previewImg.src = url;
  if (previewTitle) previewTitle.textContent = label || 'Photo du produit';
  if (previewPath) previewPath.textContent = url.startsWith('data:') ? 'Image importée (locale)' : url;
  if (statusIndicator) statusIndicator.textContent = '';

  if (previewBox) previewBox.style.display = 'flex';
  if (dropzone) dropzone.style.display = 'none';
}

function clearProductPhoto() {
  const hiddenInput = document.getElementById('product-photo-url-val');
  const previewBox = document.getElementById('photo-preview-box');
  const dropzone = document.getElementById('photo-dropzone');
  const previewImg = document.getElementById('product-photo-preview');
  const fileInput = document.getElementById('product-photo-file-input');
  const statusIndicator = document.getElementById('upload-status-indicator');

  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (statusIndicator) statusIndicator.textContent = '';

  if (previewBox) previewBox.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';
}

function selectPresetPhoto(url, label) {
  setProductPhoto(url, label);
}

function applyManualUrl() {
  const input = document.getElementById('manual-url-input');
  if (input && input.value.trim()) {
    setProductPhoto(input.value.trim(), 'Image personnalisée (URL)');
  }
}

function openPinterestSearch() {
  const form = document.getElementById('product-edit-form');
  const name = form ? form.elements['name']?.value?.trim() : '';
  const brand = form ? form.elements['brand']?.value?.trim() : '';
  const category = form ? form.elements['category']?.value : '';
  const format = form ? form.elements['format']?.value?.trim() : '';

  let query = '';
  const parts = [];

  if (brand) parts.push(brand);
  if (name) parts.push(name);
  if (format) parts.push(format);

  if (parts.length > 0) {
    parts.push('packaging');
    query = parts.join(' ').replace(/\s+/g, ' ').trim();
  } else if (category) {
    if (category.includes('Solaire')) query = `sunscreen ${format || 'bottle'} spf cosmetic packaging`;
    else if (category.includes('Bébé')) query = `baby skincare ${format || 'lotion bottle'} packaging`;
    else if (category.includes('Capillaire')) query = `haircare shampoo ${format || 'bottle'} cosmetic packaging`;
    else if (category.includes('Hygiène')) query = `body wash shower gel ${format || 'bottle'} packaging`;
    else query = `dermatology skincare serum cream ${format || ''} cosmetic packaging`;
  } else {
    query = `cosmetic product ${format || ''} packaging bottle`.trim();
  }

  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
  window.open(url, '_blank');
}

async function downloadPinterestPhoto() {
  const input = document.getElementById('pinterest-url-input');
  const statusIndicator = document.getElementById('upload-status-indicator');
  if (!input || !input.value.trim()) {
    alert('Veuillez coller le lien d\'une image Pinterest (ex: https://i.pinimg.com/... ou URL web).');
    return;
  }

  const imageUrl = input.value.trim();
  if (statusIndicator) statusIndicator.textContent = 'Téléchargement de l\'image depuis Pinterest...';

  try {
    const res = await fetch('/api/admin/fetch-image-url', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ imageUrl })
    });

    const data = await res.json();
    if (data.url) {
      setProductPhoto(data.url, 'Photo Pinterest importée');
      if (statusIndicator) statusIndicator.textContent = '✓ Photo Pinterest enregistrée sur le serveur';
      input.value = '';
    } else {
      throw new Error(data.error || 'Erreur lors du téléchargement');
    }
  } catch (err) {
    setProductPhoto(imageUrl, 'Photo Pinterest');
    if (statusIndicator) statusIndicator.textContent = '✓ Photo liée';
  }
}

async function handlePhotoFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusIndicator = document.getElementById('upload-status-indicator');
  if (statusIndicator) statusIndicator.textContent = 'Chargement de la photo...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    
    // Immediate preview for smooth user feedback
    setProductPhoto(dataUrl, file.name);

    if (statusIndicator) statusIndicator.textContent = 'Enregistrement sur le serveur...';

    // Upload to server
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dataUrl, filename: file.name })
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setProductPhoto(data.url, file.name);
        if (statusIndicator) statusIndicator.textContent = '✓ Photo enregistrée';
      } else {
        console.warn('Server upload fallback, keeping base64 dataUrl', data.error);
        if (statusIndicator) statusIndicator.textContent = '✓ Photo prête (local)';
      }
    } catch (err) {
      console.warn('Upload network error, keeping base64', err);
      if (statusIndicator) statusIndicator.textContent = '✓ Photo prête (local)';
    }
  };

  reader.readAsDataURL(file);
}

function openAddProductModal() {
  const modal = document.getElementById('product-edit-modal');
  const titleEl = document.getElementById('product-edit-modal-title');
  const form = document.getElementById('product-edit-form');
  if (!modal || !form) return;

  titleEl.textContent = 'Ajouter une nouvelle référence au catalogue';
  form.reset();
  form.elements['productId'].value = '';
  clearProductPhoto();
  modal.classList.add('active');
}

function openProductEditModal(productId) {
  const p = adminState.products.find(x => x.id === productId);
  if (!p) return;

  const modal = document.getElementById('product-edit-modal');
  const titleEl = document.getElementById('product-edit-modal-title');
  const form = document.getElementById('product-edit-form');
  if (!modal || !form) return;

  titleEl.textContent = `Modifier ${p.name}`;
  form.elements['productId'].value = p.id;
  form.elements['ref'].value = p.ref;
  form.elements['name'].value = p.name;
  form.elements['brand'].value = p.brand;
  form.elements['category'].value = p.category;
  form.elements['format'].value = p.format;
  form.elements['unitPrice'].value = p.unitPrice;
  form.elements['stock'].value = p.stock;
  form.elements['description'].value = p.description || '';
  
  if (p.image) {
    setProductPhoto(p.image, p.name);
  } else {
    clearProductPhoto();
  }

  form.elements['allow3UnitsPermanent'].checked = Boolean(p.allow3UnitsPermanent);
  form.elements['allow3UnitsSpecial'].checked = Boolean(p.allow3UnitsSpecial);
  form.elements['isNewProduct'].checked = Boolean(p.isNewProduct);
  form.elements['isNewArrival'].checked = Boolean(p.isNewArrival);
  form.elements['isRestock'].checked = Boolean(p.isRestock);
  form.elements['active'].checked = Boolean(p.active);

  modal.classList.add('active');
}

function closeProductEditModal() {
  const modal = document.getElementById('product-edit-modal');
  if (modal) modal.classList.remove('active');
}

async function handleProductSave(event) {
  event.preventDefault();
  const form = event.target;
  const productId = form.elements['productId'].value;

  const payload = {
    ref: form.elements['ref'].value,
    name: form.elements['name'].value,
    brand: form.elements['brand'].value,
    category: form.elements['category'].value,
    format: form.elements['format'].value,
    unitPrice: Number(form.elements['unitPrice'].value),
    stock: Number(form.elements['stock'].value),
    description: form.elements['description'].value,
    image: form.elements['image'].value,
    allow3UnitsPermanent: form.elements['allow3UnitsPermanent'].checked,
    allow3UnitsSpecial: form.elements['allow3UnitsSpecial'].checked,
    isNewProduct: form.elements['isNewProduct'].checked,
    isNewArrival: form.elements['isNewArrival'].checked,
    isRestock: form.elements['isRestock'].checked,
    active: form.elements['active'].checked
  };

  try {
    let res;
    if (productId) {
      res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur d\'enregistrement');
    }

    closeProductEditModal();
    await fetchProducts();
    renderProductsTable();
    alert('Produit enregistré avec succès.');
  } catch (e) {
    alert(`Erreur : ${e.message}`);
  }
}

/* ========================================================
   EVENT LISTENERS SETUP
======================================================== */
function setupAdminEventListeners() {
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.admintab;
      document.querySelectorAll('.admin-view-panel').forEach(p => p.style.display = 'none');
      const targetPanel = document.getElementById(`admin-panel-${tab}`);
      if (targetPanel) targetPanel.style.display = 'block';
    });
  });

  const searchInput = document.getElementById('admin-orders-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      adminState.orderSearchQuery = e.target.value;
      renderOrdersTable();
    });
  }

  const statusSelect = document.getElementById('admin-status-filter');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      adminState.orderStatusFilter = e.target.value;
      renderOrdersTable();
    });
  }

  const paymentSelect = document.getElementById('admin-payment-filter');
  if (paymentSelect) {
    paymentSelect.addEventListener('change', (e) => {
      adminState.orderPaymentFilter = e.target.value;
      renderOrdersTable();
    });
  }

  const productForm = document.getElementById('product-edit-form');
  if (productForm) productForm.addEventListener('submit', handleProductSave);
}

/* ========================================================
   EXCEL IMPORT & EXPORT FUNCTIONS
======================================================== */
function downloadExcelTemplate() {
  window.open(`/api/admin/catalog/template?token=${adminState.token}`, '_blank');
}

function exportCatalogToExcel() {
  window.open(`/api/admin/catalog/export?token=${adminState.token}`, '_blank');
}

function openImportExcelModal() {
  const modal = document.getElementById('excel-import-modal');
  const previewSection = document.getElementById('excel-preview-section');
  const dropzone = document.getElementById('excel-dropzone');
  const fileInput = document.getElementById('excel-file-input');

  if (fileInput) fileInput.value = '';
  if (previewSection) previewSection.style.display = 'none';
  if (dropzone) {
    dropzone.style.display = 'block';
    dropzone.innerHTML = `
      <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display:none;" onchange="window.admin.handleExcelFileSelected(event)">
      <div style="font-size:2.5rem; margin-bottom:8px;">📑</div>
      <strong style="color:var(--primary); font-size:1rem; display:block;">
        Cliquez pour choisir votre fichier Excel ou CSV
      </strong>
      <span style="font-size:0.8rem; color:var(--text-light); display:block; margin-top:4px;">
        Formats pris en charge : .xlsx (Microsoft Excel), .xls, .csv
      </span>
    `;
  }

  adminState.pendingImportProducts = [];
  if (modal) modal.classList.add('active');
}

function closeImportExcelModal() {
  const modal = document.getElementById('excel-import-modal');
  if (modal) modal.classList.remove('active');
  adminState.pendingImportProducts = [];
}

async function handleExcelFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const dropzone = document.getElementById('excel-dropzone');
  const previewSection = document.getElementById('excel-preview-section');
  const countEl = document.getElementById('excel-preview-count');
  const tbody = document.getElementById('excel-preview-tbody');

  dropzone.innerHTML = `
    <div style="font-size:2rem; margin-bottom:6px;">⏳</div>
    <strong style="color:var(--primary);">Lecture et analyse du fichier Excel (${file.name})...</strong>
  `;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const fileBase64 = e.target.result;

    try {
      const res = await fetch('/api/admin/catalog/import-preview', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileBase64 })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la lecture du fichier Excel.');
      }

      adminState.pendingImportProducts = data.products;
      if (countEl) countEl.textContent = data.products.length;

      if (tbody) {
        tbody.innerHTML = data.products.map(p => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 10px; font-family:monospace; font-weight:700;">${p.ref}</td>
            <td style="padding:6px 10px;"><strong>${p.name}</strong> (${p.format})</td>
            <td style="padding:6px 10px;">${p.brand}</td>
            <td style="padding:6px 10px;">${formatFCFA(p.unitPrice)}</td>
            <td style="padding:6px 10px; text-align:center;"><strong>${p.stock}</strong></td>
            <td style="padding:6px 10px; text-align:center;">${p.allow3UnitsPermanent ? '<span style="color:#b45309; font-weight:800;">OUI (3 un.)</span>' : 'Standard (6 un.)'}</td>
          </tr>
        `).join('');
      }

      dropzone.style.display = 'none';
      previewSection.style.display = 'block';
    } catch (err) {
      alert(`Erreur fichier : ${err.message}`);
      openImportExcelModal();
    }
  };

  reader.readAsDataURL(file);
}

async function confirmExcelImport() {
  if (!adminState.pendingImportProducts || adminState.pendingImportProducts.length === 0) {
    alert('Aucun produit à importer.');
    return;
  }

  const btn = document.getElementById('btn-confirm-import');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Intégration en cours...';
  }

  const updateExisting = document.getElementById('excel-update-existing')?.checked !== false;

  try {
    const res = await fetch('/api/admin/catalog/import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        products: adminState.pendingImportProducts,
        updateExisting: updateExisting
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erreur d\'importation');
    }

    alert(data.message || 'Importation terminée avec succès !');
    closeImportExcelModal();

    await fetchProducts();
    renderProductsTable();
    fetchStats();
    renderKPIs();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Valider et intégrer au catalogue';
    }
  }
}
