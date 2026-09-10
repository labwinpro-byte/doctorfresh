/* SmartOmbor ERP - Router, Business Logic Controller & Production Security Engine */

if (typeof window.escapeHTML !== 'function') {
  window.escapeHTML = function(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
}
if (typeof escapeHTML !== 'function') {
  var escapeHTML = window.escapeHTML;
}
if (typeof window.syncGlobalState !== 'function') {
  window.syncGlobalState = function() {};
}
if (typeof syncGlobalState !== 'function') {
  var syncGlobalState = window.syncGlobalState;
}

let currentRoute = 'dashboard';
let productSearchQuery = '';
let salesSearchQuery = '';
let salesCurrentPage = 1;
let salesPageSize = 10;
let customerSearchQuery = '';
let customerCurrentPage = 1;
let customerPageSize = 10;
let selectedCategory = 'all';
let selectedWarehouse = 'all';
let selectedStatus = 'all';
let settingsActiveTab = 'company';
let currentPage = 1;
let pageSize = 10;
let isLoadingState = false;

// Sorting state
let sortField = 'name';
let sortOrder = 'asc';

function startLiveClock() {
  function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('liveClockTime');
    if (clockEl) {
      const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      clockEl.textContent = timeStr;
    }
    const dateEl = document.getElementById('liveHeaderDate');
    if (dateEl) {
      const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
      dateEl.textContent = `${now.getDate()}-${months[now.getMonth()]}, ${now.getFullYear()}`;
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
}
window.startLiveClock = startLiveClock;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    startLiveClock();
    syncGlobalState();
    initModals();
    setupEventListeners();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    if (window.syncSupabaseSessionToUI) {
      try { await window.syncSupabaseSessionToUI(); } catch (e) {}
    }

    const isLoggedIn = window.authService ? window.authService.isLoggedIn() : false;
    if (!isLoggedIn && typeof openLoginModal === 'function') {
      openLoginModal();
    }

    if (window.authService) {
      window.authService.updateUserUI();
    }
    if (window.offlineStore) {
      window.offlineStore.updateNetworkStatusUI();
    }

    try {
      if (window.categoryService) await window.categoryService.getAll();
    } catch (e) {}
    try {
      if (window.warehouseService) await window.warehouseService.getAll();
    } catch (e) {}
    try {
      if (window.productService) await window.productService.getAll();
    } catch (e) {}

    await navigateTo(getRouteFromHash() || 'dashboard');
  } catch (err) {
    console.error("Initialization Error:", err);
    try {
      await navigateTo(getRouteFromHash() || 'dashboard');
    } catch (e) {}
  }
});

function getRouteFromHash() {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return hash || 'dashboard';
}

function checkIsDirector() {
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  if (!currentUser) return false;
  const role = (currentUser.role || '').toLowerCase();
  const roleLabel = (currentUser.roleLabel || '').toLowerCase();
  const name = (currentUser.fullName || currentUser.full_name || '').toLowerCase();
  const email = (currentUser.email || '').toLowerCase();
  const id = String(currentUser.id || currentUser.customId || '').toLowerCase();

  // Non-director/non-admin roles MUST NOT have deletion rights
  if (role === 'agent' || role === 'savdo agenti' || role === 'cashier' || role === 'driver' || role === 'kuryer' || role === 'warehouse' || role === 'omborchi') {
    return false;
  }

  if (role === 'director' || role === 'admin' || role === 'manager' || role === 'supervisor') return true;
  if (roleLabel.includes('direktor') || roleLabel.includes('admin') || roleLabel.includes('bosh')) return true;
  if (name.includes('fayz') || name.includes('ibrohim') || name.includes('ibroxim') || name.includes('abdulbosit') || name.includes('admin')) return true;
  if (email.includes('admin') || email.includes('0001') || id === '0001' || id === 'usr-fayz-01') return true;

  return false;
}
window.checkIsDirector = checkIsDirector;

function checkIsStrictDirector() {
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  if (!currentUser) return false;
  const role = (currentUser.role || '').toLowerCase();
  const roleLabel = (currentUser.roleLabel || '').toLowerCase();
  const name = (currentUser.fullName || currentUser.full_name || '').toLowerCase();

  if (role === 'director' || roleLabel.includes('direktor') || name.includes('fayz') || name.includes('ibrohim') || name.includes('ibroxim')) {
    return true;
  }
  return false;
}
window.checkIsStrictDirector = checkIsStrictDirector;

const ROLE_PERMISSIONS = {
  agent: ['dashboard', 'sales', 'delivery', 'returns', 'archive', 'customers', 'products'],
  warehouse: ['warehouse', 'products', 'purchases', 'outgoing', 'delivery', 'returns', 'archive'],
  driver: ['delivery', 'returns', 'archive'],
  supervisor: ['dashboard', 'sales', 'customers', 'products', 'warehouse', 'purchases', 'outgoing', 'suppliers', 'delivery', 'returns', 'archive', 'reports'],
  director: ['dashboard', 'warehouse', 'products', 'purchases', 'outgoing', 'sales', 'customers', 'suppliers', 'cash', 'delivery', 'returns', 'archive', 'reports', 'users', 'settings'],
  admin: ['dashboard', 'warehouse', 'products', 'purchases', 'outgoing', 'sales', 'customers', 'suppliers', 'cash', 'delivery', 'returns', 'archive', 'reports', 'users', 'settings']
};

function checkRouteAccess(route) {
  const isLoggedIn = window.authService ? window.authService.isLoggedIn() : false;
  if (!isLoggedIn) {
    if (typeof openLoginModal === 'function') {
      openLoginModal();
    }
    return route;
  }

  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const role = currentUser ? (currentUser.role || 'agent').toLowerCase() : 'admin';
  const allowedRoutes = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;

  if (!allowedRoutes.includes(route)) {
    const fallbackRoute = allowedRoutes[0] || 'dashboard';
    if (window.showToast) {
      window.showToast(`"${route}" bo'limiga kirish uchun sizda huquq yetarli emas!`, 'warning');
    }
    return fallbackRoute;
  }
  return route;
}

function updateSidebarRoleVisibility() {
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const role = currentUser ? (currentUser.role || 'agent').toLowerCase() : 'admin';
  const allowedRoutes = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;

  const navLinks = document.querySelectorAll('.nav-link-item');
  navLinks.forEach(link => {
    const linkRoute = link.getAttribute('data-route');
    if (allowedRoutes.includes(linkRoute)) {
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  });

  const roleSubtitles = {
    agent: 'Agent Portali',
    warehouse: 'Omborchi Portali',
    driver: 'Haydovchi Portali',
    supervisor: 'Supervayzer Paneli',
    director: 'Direktor ERP',
    admin: 'Warehouse ERP'
  };
  const brandSub = document.querySelector('.sidebar-header-title span.text-blue-600');
  if (brandSub) {
    brandSub.textContent = roleSubtitles[role] || 'Warehouse ERP';
  }
}

async function navigateTo(route) {
  if (route === 'income') route = 'purchases';
  if (route === 'outcome') route = 'outgoing';

  route = checkRouteAccess(route);

  currentRoute = route;
  currentPage = 1;
  window.location.hash = `#/${route}`;
  updateSidebarActiveItem();
  updateSidebarRoleVisibility();
  await renderCurrentView();

  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }
}

function setupEventListeners() {
  window.addEventListener('hashchange', () => {
    const route = getRouteFromHash();
    if (route !== currentRoute) {
      navigateTo(route);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('globalSearchInput');
      if (searchInput) searchInput.focus();
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const userDropdown = document.getElementById('userDropdownMenu');
    const notifPanel = document.getElementById('notificationPanel');

    if (userDropdown && !e.target.closest('#userDropdownMenu') && !e.target.closest('button[aria-label="Foydalanuvchi menyusi"]')) {
      userDropdown.classList.add('hidden');
    }
    if (notifPanel && !e.target.closest('#notificationPanel') && !e.target.closest('button[aria-label="Bildirishnomalar"]')) {
      notifPanel.classList.add('hidden');
    }
  });
}

function toggleSidebar() {
  document.body.classList.toggle('sidebar-is-collapsed');
  const icon = document.getElementById('collapse-icon');
  if (icon) {
    if (document.body.classList.contains('sidebar-is-collapsed')) {
      icon.setAttribute('data-lucide', 'chevron-right');
    } else {
      icon.setAttribute('data-lucide', 'chevron-left');
    }
    if (window.lucide) lucide.createIcons();
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('-translate-x-full');
    if (backdrop) {
      backdrop.classList.toggle('hidden');
    }
  }
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('userDropdownMenu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function toggleNotificationDrawer() {
  const panel = document.getElementById('notificationPanel');
  if (panel) panel.classList.toggle('hidden');
}

function updateSidebarActiveItem() {
  const navLinks = document.querySelectorAll('.nav-link-item');
  navLinks.forEach(link => {
    const linkRoute = link.getAttribute('data-route');
    if (linkRoute === currentRoute) {
      link.classList.add('nav-item-active');
      link.classList.remove('text-slate-600', 'hover:bg-slate-50');
    } else {
      link.classList.remove('nav-item-active');
      link.classList.add('text-slate-600', 'hover:bg-slate-50');
    }
  });
}

function handleGlobalSearch(query) {
  if (!query) {
    productSearchQuery = '';
    renderCurrentView();
    return;
  }
  productSearchQuery = query;
  if (currentRoute !== 'products') {
    navigateTo('products');
  } else {
    renderCurrentView();
  }
}

/* REUSABLE UI COMPONENTS */

function renderPagination(totalItems, page = 1, limit = pageSize, onPageChangeName = 'changePage') {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems);

  return `
    <div class="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
      <div>
        Jami <span class="font-bold text-slate-900">${totalItems}</span> tadan <span class="font-bold text-slate-900">${startItem}-${endItem}</span> ko’rsatilmoqda
      </div>

      <div class="flex items-center gap-1.5 self-center sm:self-auto">
        <button onclick="${onPageChangeName}(${page - 1})" ${page <= 1 ? 'disabled' : ''} class="pagination-btn" aria-label="Oldingi sahifa" title="Oldingi sahifa">
          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
        </button>

        ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
          <button onclick="${onPageChangeName}(${p})" class="pagination-btn ${p === page ? 'pagination-btn-active' : ''}">
            ${p}
          </button>
        `).join('')}

        <button onclick="${onPageChangeName}(${page + 1})" ${page >= totalPages ? 'disabled' : ''} class="pagination-btn" aria-label="Keyingi sahifa" title="Keyingi sahifa">
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;
}

function changePage(p) {
  currentPage = p;
  renderCurrentView();
}

function renderEmptyState(title = "Ma’lumot topilmadi", description = "Qidiruv yoki filtrlarni o’zgartirib ko’ring", icon = "search-x", actionText = "", actionCallback = "") {
  return `
    <div class="p-12 text-center flex flex-col items-center justify-center">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <i data-lucide="${icon}" class="w-8 h-8 opacity-60"></i>
      </div>
      <h4 class="text-sm font-bold text-slate-800 mb-1">${escapeHTML(title)}</h4>
      <p class="text-xs text-slate-500 max-w-sm mb-4">${escapeHTML(description)}</p>
      ${actionText ? `
        <button onclick="${actionCallback}" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95">
          ${escapeHTML(actionText)}
        </button>
      ` : ''}
    </div>
  `;
}

function renderTableSkeleton() {
  return `
    <div class="p-6 space-y-4">
      <div class="h-6 skeleton w-1/4"></div>
      <div class="space-y-2">
        <div class="h-10 skeleton w-full"></div>
        <div class="h-10 skeleton w-full"></div>
        <div class="h-10 skeleton w-full"></div>
        <div class="h-10 skeleton w-full"></div>
      </div>
    </div>
  `;
}

/* MAIN VIEW RENDER ENGINE */
async function renderCurrentView() {
  try {
    syncGlobalState();
    if (typeof updateLowStockNotifications === 'function') {
      updateLowStockNotifications();
    }
    const container = document.getElementById('main-content');
    if (!container) return;

    if (isLoadingState) {
      container.innerHTML = renderTableSkeleton();
      return;
    }

    const headerTitle = document.getElementById('page-header-title');
    const headerSubtitle = document.getElementById('page-header-subtitle');

    switch (currentRoute) {
      case 'dashboard':
        if (headerTitle) headerTitle.textContent = 'Bosh sahifa';
        if (headerSubtitle) headerSubtitle.textContent = 'SmartOmbor umumiy ko’rsatkichlar tahlili';
        container.innerHTML = renderDashboardView();
        setTimeout(() => renderSalesChart('weekly'), 50);
        break;

      case 'warehouse':
        if (headerTitle) headerTitle.textContent = 'Ombor';
        if (headerSubtitle) headerSubtitle.textContent = 'Barcha omborlar va sig’im ko’rsatkichlari';
        container.innerHTML = renderWarehouseView();
        break;

      case 'products':
        if (headerTitle) headerTitle.textContent = 'Tovarlar';
        if (headerSubtitle) headerSubtitle.textContent = 'Mahsulotlar katalogi va qoldiqlar boshqaruvi';
        
        container.innerHTML = renderTableSkeleton();
        await productService.getAll();
        container.innerHTML = renderProductsView();
        break;

      case 'purchases':
        if (headerTitle) headerTitle.textContent = 'Kirim';
        if (headerSubtitle) headerSubtitle.textContent = 'Yuk xatlari va omborga tovar kirimi';
        if (window.purchaseService) await window.purchaseService.getAll();
        container.innerHTML = renderPurchasesView();
        break;

      case 'outgoing':
        if (headerTitle) headerTitle.textContent = 'Chiqim';
        if (headerSubtitle) headerSubtitle.textContent = 'Omborlararo ko’chirish va chiqim operatsiyalari';
        if (window.outgoingService) await window.outgoingService.getAll();
        container.innerHTML = renderOutgoingView();
        break;

      case 'sales':
        if (headerTitle) headerTitle.textContent = 'Sotuvlar';
        if (headerSubtitle) headerSubtitle.textContent = 'Sotuvlar tarixi va bitimlar jurnali';
        if (window.salesService) await window.salesService.getAll();
        container.innerHTML = renderSalesView();
        break;

      case 'customers':
        if (headerTitle) headerTitle.textContent = 'Mijozlar';
        if (headerSubtitle) headerSubtitle.textContent = 'Mijozlar bazasi va qarzdorlik hisob-kitobi';
        if (window.customerService) await window.customerService.getAll();
        container.innerHTML = renderCustomersView();
        break;

      case 'suppliers':
        if (headerTitle) headerTitle.textContent = 'Yetkazib beruvchilar';
        if (headerSubtitle) headerSubtitle.textContent = 'Yetkazib beruvchi hamkorlar katalogi';
        if (window.supplierService) await window.supplierService.getAll();
        container.innerHTML = renderSuppliersView();
        break;

      case 'cash':
        if (headerTitle) headerTitle.textContent = 'Kassa';
        if (headerSubtitle) headerSubtitle.textContent = 'Moliyaviy ko’rsatkichlar va kassa tushumlari';
        if (window.cashService) await window.cashService.getAll();
        container.innerHTML = renderCashView();
        break;

      case 'reports':
        if (headerTitle) headerTitle.textContent = 'Hisobotlar';
        if (headerSubtitle) headerSubtitle.textContent = 'Tahliliy hisobotlar va eksport';
        container.innerHTML = renderReportsView();
        setTimeout(() => renderSalesChart('monthly'), 50);
        break;

      case 'delivery':
        if (headerTitle) headerTitle.textContent = 'Yetkazib berish (Distribyutsiya)';
        if (headerSubtitle) headerSubtitle.textContent = 'Buyurtmalarning real-vaqt Kanban doskasi va haydovchilar biriktiruvi';
        if (window.distributionService) await window.distributionService.getAll();
        container.innerHTML = renderDeliveryView();
        break;

      case 'returns':
        if (headerTitle) headerTitle.textContent = 'Qaytarilganlar (Vozvrat)';
        if (headerSubtitle) headerSubtitle.textContent = 'Mijozlardan qaytgan tovarlar jurnali va brak hisoboti';
        if (window.returnService) await window.returnService.getAll();
        container.innerHTML = renderReturnsView();
        break;

      case 'archive':
        if (headerTitle) headerTitle.textContent = 'Arxiv (Yetkazilgan buyurtmalar)';
        if (headerSubtitle) headerSubtitle.textContent = "Yetkazilgan va to'langan buyurtmalar arxivi (3 kunlik avto-arxiv)";
        if (window.distributionService) await window.distributionService.getAll();
        container.innerHTML = renderArchiveView();
        break;

      case 'users':
        if (headerTitle) headerTitle.textContent = 'Foydalanuvchilar va Xodimlar';
        if (headerSubtitle) headerSubtitle.textContent = 'Barcha tizim foydalanuvchilari va xodimlar ro\'yxati hamda monitoringi';
        if (window.userService) await window.userService.getAll();
        container.innerHTML = renderUsersView();
        break;

      case 'settings':
        if (headerTitle) headerTitle.textContent = 'Sozlamalar';
        if (headerSubtitle) headerSubtitle.textContent = 'Tizim va kompaniya sozlamalari';
        container.innerHTML = renderSettingsView();
        break;

      default:
        container.innerHTML = renderEmptyState('Sahifa topilmadi', 'Siz so’ralgan yo’nalish mavjud emas', 'alert-circle');
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error("View Render Error:", err);
    const container = document.getElementById('main-content');
    if (container) {
      container.innerHTML = renderEmptyState("Ma'lumotni yuklashda muammo yuz berdi", "Iltimos sahifani qayta yuklang yoki qayta urining", "alert-triangle", "Qayta urinish", "renderCurrentView()");
    }
  }
}

/* INDIVIDUAL VIEW RENDERERS WITH SANITIZATION */

function getTrendBadgeHTML(trendStr) {
  const tr = String(trendStr || '0%').trim();
  if (tr === '0%' || tr === '+0%' || tr === '-0%') {
    return `<span class="inline-flex items-center gap-1 font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"><i data-lucide="minus" class="w-3.5 h-3.5"></i> 0%</span>`;
  }
  if (tr.startsWith('-')) {
    return `<span class="inline-flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"><i data-lucide="trending-down" class="w-3.5 h-3.5"></i> ${escapeHTML(tr)}</span>`;
  }
  return `<span class="inline-flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> ${escapeHTML(tr)}</span>`;
}

// 1. Dashboard View
function renderDashboardView() {
  const kpis = demoData.kpis;
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <div class="bg-white rounded-2xl p-5 card-shadow stat-card flex flex-col justify-between">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Jami mahsulotlar</span>
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <i data-lucide="package" class="w-5 h-5"></i>
          </div>
        </div>
        <div>
          <h3 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">${escapeHTML(kpis.totalProducts.value)}</h3>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">${escapeHTML(kpis.totalProducts.subtext || (demoData.warehouses.length + ' ta omborda'))}</span>
            ${getTrendBadgeHTML(kpis.totalProducts.trend)}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 card-shadow stat-card flex flex-col justify-between">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Bugungi sotuv</span>
          <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <i data-lucide="shopping-bag" class="w-5 h-5"></i>
          </div>
        </div>
        <div>
          <h3 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">${escapeHTML(kpis.dailySales.value)}</h3>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">${escapeHTML(kpis.dailySales.subtext || '0 ta bitim')}</span>
            ${getTrendBadgeHTML(kpis.dailySales.trend)}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 card-shadow stat-card flex flex-col justify-between">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Bugungi kirim</span>
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
          </div>
        </div>
        <div>
          <h3 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">${escapeHTML(kpis.dailyIncome.value)}</h3>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">${escapeHTML(kpis.dailyIncome.subtext || '0 ta yuk xati')}</span>
            ${getTrendBadgeHTML(kpis.dailyIncome.trend)}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 card-shadow stat-card flex flex-col justify-between">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Kassa qoldig‘i</span>
          <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <i data-lucide="wallet" class="w-5 h-5"></i>
          </div>
        </div>
        <div>
          <h3 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">${escapeHTML(kpis.cashBalance.value)}</h3>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">${escapeHTML(kpis.cashBalance.subtext)}</span>
            ${getTrendBadgeHTML(kpis.cashBalance.trend)}
          </div>
        </div>
      </div>
    </div>

    <!-- Chart & Low Stock Cards -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2 bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Savdo statistikasi</h3>
            <p class="text-xs text-slate-500">Davrlar bo’yicha sotuv dinamikasi</p>
          </div>
          <div class="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-medium self-start sm:self-auto">
            <button onclick="switchChartTab(this, 'daily')" class="chart-tab-btn px-3 py-1.5 rounded-lg text-slate-600">Bugun</button>
            <button onclick="switchChartTab(this, 'weekly')" class="chart-tab-btn px-3 py-1.5 rounded-lg bg-white text-blue-600 shadow-sm font-semibold">Haftalik</button>
            <button onclick="switchChartTab(this, 'monthly')" class="chart-tab-btn px-3 py-1.5 rounded-lg text-slate-600">Oylik</button>
          </div>
        </div>
        <div class="relative w-full h-[260px]">
          <canvas id="salesChartCanvas"></canvas>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900">⚠ Diqqat talab qiladigan mahsulotlar</h3>
              <p class="text-xs text-slate-500">Minimal limitdan oz qolgan (${demoData.lowStockProducts.length} ta)</p>
            </div>
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
          </div>
          <div class="space-y-3 max-h-[220px] overflow-y-auto">
            ${demoData.lowStockProducts.length > 0 ? demoData.lowStockProducts.map(item => `
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h4 class="text-xs font-semibold text-slate-900 truncate">${escapeHTML(item.name)}</h4>
                  <p class="text-[11px] text-slate-500">Qoldiq: <span class="font-bold text-slate-700">${item.current} ${escapeHTML(item.unit)}</span> (Min: ${item.min})</p>
                </div>
                <span class="badge ${item.statusClass} shrink-0 text-[10px]">${escapeHTML(item.status)}</span>
              </div>
            `).join('') : `
              <div class="text-center py-6 text-xs text-slate-400">Hamma tovarlar yetarli miqdorda!</div>
            `}
          </div>
        </div>
        <button onclick="navigateTo('products')" class="w-full mt-4 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-blue-600 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95">
          Barchasini ko’rish <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>

    <!-- Table Component & Quick Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-3 bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        <div class="p-6 pb-3 flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-slate-900">Oxirgi sotuvlar</h3>
            <p class="text-xs text-slate-500">So’nggi rasmiylashtirilgan bitimlar</p>
          </div>
          <button onclick="navigateTo('sales')" class="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Barchasini ko‘rish <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Chek №</th>
                <th>Mijoz</th>
                <th>Mahsulotlar</th>
                <th>Summa</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              ${demoData.recentSales.slice(0, 5).map(sale => {
                const statusInfo = (typeof getSaleEffectiveStatus === 'function') 
                  ? getSaleEffectiveStatus(sale) 
                  : { status: 'yangi', label: 'Yangi', statusClass: 'badge-primary' };
                return `
                <tr onclick="openViewSaleModal('${sale.id}')" class="cursor-pointer">
                  <td class="text-xs text-slate-500 whitespace-nowrap">${escapeHTML(sale.date)}</td>
                  <td class="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">${escapeHTML(sale.receiptNo)}</td>
                  <td class="font-medium text-slate-900">${escapeHTML(sale.customer)}</td>
                  <td class="text-xs text-slate-600">${escapeHTML(sale.itemsCount)}</td>
                  <td class="font-bold text-slate-900 whitespace-nowrap">${escapeHTML(sale.amount)}</td>
                  <td><span class="badge ${statusInfo.statusClass}">${escapeHTML(statusInfo.label)}</span></td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${renderPagination(demoData.recentSales.length, 1, 5)}
      </div>

      <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between">
        <div>
          <h3 class="text-base font-bold text-slate-900 mb-1">Tezkor amallar</h3>
          <p class="text-xs text-slate-500 mb-4">Tez-tez ishlatiladigan operatsiyalar</p>
          <div class="space-y-2.5">
            <button onclick="openCreateProductModal()" class="w-full p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs flex items-center gap-3 transition active:scale-95">
              <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center"><i data-lucide="package-plus" class="w-4 h-4"></i></div>
              <div class="text-left"><p class="font-bold">Tovar qo‘shish</p><p class="text-[10px] text-blue-500 font-normal">Katalogga yangi tovar</p></div>
            </button>

            <button onclick="openModal('addPurchaseModal')" class="w-full p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center gap-3 transition active:scale-95">
              <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><i data-lucide="arrow-down-left" class="w-4 h-4"></i></div>
              <div class="text-left"><p class="font-bold">Kirim qilish</p><p class="text-[10px] text-indigo-500 font-normal">Yuk xati bo’yicha qabul</p></div>
            </button>

            <button onclick="openModal('addSaleModal')" class="w-full p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-3 transition active:scale-95">
              <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><i data-lucide="shopping-cart" class="w-4 h-4"></i></div>
              <div class="text-left"><p class="font-bold">Sotuv yaratish</p><p class="text-[10px] text-emerald-500 font-normal">Chek rasmiylashtirish</p></div>
            </button>

            <button onclick="openCreateCustomerModal()" class="w-full p-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs flex items-center gap-3 transition active:scale-95">
              <div class="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center"><i data-lucide="user-plus" class="w-4 h-4"></i></div>
              <div class="text-left"><p class="font-bold">Mijoz qo‘shish</p><p class="text-[10px] text-sky-500 font-normal">Mijoz bazasiga qo’shish</p></div>
            </button>

            <button onclick="openCreateEmployeeModal()" class="w-full p-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs flex items-center gap-3 transition active:scale-95">
              <div class="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center"><i data-lucide="user-plus" class="w-4 h-4"></i></div>
              <div class="text-left"><p class="font-bold">Xodim qo‘shish (SignUp)</p><p class="text-[10px] text-purple-500 font-normal">Yangi xodimlarni ro'yxatdan o'tkazish</p></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchChartTab(btn, period) {
  document.querySelectorAll('.chart-tab-btn').forEach(b => {
    b.classList.remove('bg-white', 'text-blue-600', 'shadow-sm', 'font-semibold');
    b.classList.add('text-slate-600');
  });
  btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm', 'font-semibold');
  btn.classList.remove('text-slate-600');
  renderSalesChart(period);
}

// 2. Warehouse View
function toggleWarehouseSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.wh-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.toggleWarehouseSelectAll = toggleWarehouseSelectAll;

function triggerDeleteSelectedWarehouses() {
  const checkedBoxes = Array.from(document.querySelectorAll('.wh-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror omborni tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Omborlarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta omborni o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.whId).filter(Boolean);
      if (window.warehouseService) {
        for (const id of selectedIds) {
          await window.warehouseService.remove(id);
        }
      } else {
        demoData.warehouses = (demoData.warehouses || []).filter(w => !selectedIds.includes(w.id));
        syncGlobalState();
      }
      showToast(`${count} ta ombor o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedWarehouses = triggerDeleteSelectedWarehouses;

function renderWarehouseView() {
  const isDirector = checkIsDirector();
  const warehouses = demoData.warehouses || [];
  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-4 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1">
          <div class="relative flex-1 max-w-md">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Ombor nomi bo’yicha qidirish..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${isDirector ? `
            <button onclick="openCreateWarehouseModal()" class="px-5 py-2.5 bg-[#00a368] hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              <i data-lucide="plus" class="w-4 h-4"></i> + Yangi ombor
            </button>
            <button onclick="triggerDeleteSelectedWarehouses()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan omborlarni o'chirish">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
            </button>
          ` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${warehouses.map(wh => `
          <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between border border-slate-100 hover:border-slate-200 transition">
            <div>
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <input type="checkbox" data-wh-id="${wh.id}" class="wh-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                  <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <i data-lucide="building-2" class="w-6 h-6"></i>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-slate-900">${escapeHTML(wh.name)}</h3>
                    <p class="text-xs font-mono text-slate-400">${escapeHTML(wh.code)} • ${escapeHTML(wh.manager)}</p>
                  </div>
                </div>
                <span class="badge ${wh.statusClass}">${escapeHTML(wh.status)}</span>
              </div>
              <p class="text-xs text-slate-500 mb-4 flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${escapeHTML(wh.address)}
              </p>
              <div class="space-y-3 mb-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex justify-between items-center text-xs">
                  <span class="text-slate-500">Sig’im bandligi:</span>
                  <span class="font-bold text-slate-900">${wh.capacityPercent}%</span>
                </div>
                <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div class="h-full ${wh.capacityPercent > 90 ? 'bg-amber-500' : 'bg-blue-600'} rounded-full" style="width: ${wh.capacityPercent}%"></div>
                </div>
                <div class="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                  <div>
                    <span class="text-[11px] text-slate-400 uppercase tracking-wider block">Mahsulot count</span>
                    <span class="text-sm font-bold text-slate-900">${wh.productCount.toLocaleString('uz-UZ')} xil</span>
                  </div>
                  <div>
                    <span class="text-[11px] text-slate-400 uppercase tracking-wider block">Total stock value</span>
                    <span class="text-sm font-bold text-blue-600">${(wh.totalValue / 1000000).toFixed(1)} mln UZS</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 pt-2 border-t border-slate-100">
              ${isDirector ? `
                <button onclick="openEditWarehouseModal('${wh.id}')" class="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl text-center active:scale-95">Tahrirlash</button>
              ` : `<span class="text-xs text-slate-400 font-medium text-center w-full py-1">Faqat Direktor uchun</span>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function triggerDeleteWarehouse(id, name) {
  openConfirmModal(
    "Omborni o'chirish",
    `Haqiqatan ham "${name}" omborini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.warehouseService) {
        await window.warehouseService.remove(id);
      } else {
        demoData.warehouses = (demoData.warehouses || []).filter(w => w.id !== id && w.name !== name);
        syncGlobalState();
      }
      showToast(`Ombor "${name}" o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

// 3. Products View (Tovarlar)
function toggleProductSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.product-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.toggleProductSelectAll = toggleProductSelectAll;

function triggerDeleteSelectedProducts() {
  const checkedBoxes = Array.from(document.querySelectorAll('.product-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror tovarni jadvaldan tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Tovarlarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta mahsulotni o'chirmoqchimisiz? Serverdan ham butunlay o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.productId).filter(Boolean);
      for (const id of selectedIds) {
        await productService.remove(id);
      }
      showToast(`${count} ta mahsulot muvaffaqiyatli o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedProducts = triggerDeleteSelectedProducts;

function renderProductsView() {
  let products = demoData.products;

  if (productSearchQuery) {
    products = products.filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()));
  }
  if (selectedCategory !== 'all') {
    products = products.filter(p => p.category === selectedCategory);
  }
  if (selectedWarehouse !== 'all') {
    products = products.filter(p => p.warehouse === selectedWarehouse);
  }
  if (selectedStatus !== 'all') {
    products = products.filter(p => p.status === selectedStatus);
  }

  // Sorting
  products.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPrds = products.length;
  const paginatedPrds = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters = selectedCategory !== 'all' || selectedWarehouse !== 'all' || selectedStatus !== 'all' || productSearchQuery !== '';

  const isDirector = checkIsDirector();
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const userRole = currentUser ? (currentUser.role || '').toLowerCase() : '';
  const isWarehouse = userRole === 'warehouse' || userRole === 'omborchi' || (currentUser && currentUser.roleLabel && currentUser.roleLabel.toLowerCase().includes('ombor'));
  const canCreate = isDirector || isWarehouse || (window.authService && window.authService.canPerform('products:create'));
  const canEdit = isDirector || isWarehouse || (window.authService && window.authService.canPerform('products:update'));
  const canDelete = isDirector;

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-5 card-shadow space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="relative flex-1">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" value="${escapeHTML(productSearchQuery)}" oninput="handlePrdSearch(this.value)" placeholder="Tovar nomi, SKU yoki shtrix-kod bo’yicha qidirish..." class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            ${canCreate ? `
              <button onclick="openCreateProductModal()" class="px-5 py-2.5 bg-[#00a368] hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
                <i data-lucide="plus" class="w-4 h-4"></i> + Tovar qo‘shish
              </button>
            ` : ''}
            <button onclick="exportReportExcel('products')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              Excel
            </button>
            <button onclick="exportReportPDF('products')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              PDF
            </button>
            <button onclick="triggerDeleteSelectedProducts()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan tovarlarni o'chirish">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Kategoriya filter</label>
            <select onchange="handleCatFilter(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <option value="all">Barcha kategoriyalar</option>
              ${demoData.categories.map(cat => {
                const name = typeof cat === 'object' ? (cat.name || cat.id) : cat;
                return `<option value="${escapeHTML(name)}" ${selectedCategory === name ? 'selected' : ''}>${escapeHTML(name)}</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Ombor filter</label>
            <select onchange="handleWhFilter(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <option value="all">Barcha omborlar</option>
              ${demoData.warehouses.map(wh => {
                const name = typeof wh === 'object' ? (wh.name || wh.id) : wh;
                return `<option value="${escapeHTML(name)}" ${selectedWarehouse === name ? 'selected' : ''}>${escapeHTML(name)}</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Holat filter</label>
            <select onchange="handleStatusFilter(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <option value="all">Barcha holatlar</option>
              <option value="Mavjud" ${selectedStatus === 'Mavjud' ? 'selected' : ''}>Mavjud</option>
              <option value="Kam qolgan" ${selectedStatus === 'Kam qolgan' ? 'selected' : ''}>Kam qolgan</option>
              <option value="Tugagan" ${selectedStatus === 'Tugagan' ? 'selected' : ''}>Tugagan</option>
            </select>
          </div>
        </div>

        ${hasActiveFilters ? `
          <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span class="text-slate-400 font-medium">Aktiv filterlar:</span>
            ${selectedCategory !== 'all' ? `<span class="filter-tag">${escapeHTML(selectedCategory)} <button onclick="handleCatFilter('all')">×</button></span>` : ''}
            ${selectedWarehouse !== 'all' ? `<span class="filter-tag">${escapeHTML(selectedWarehouse)} <button onclick="handleWhFilter('all')">×</button></span>` : ''}
            ${selectedStatus !== 'all' ? `<span class="filter-tag">${escapeHTML(selectedStatus)} <button onclick="handleStatusFilter('all')">×</button></span>` : ''}
            ${productSearchQuery ? `<span class="filter-tag">Qidiruv: "${escapeHTML(productSearchQuery)}" <button onclick="handlePrdSearch('')">×</button></span>` : ''}
            <button onclick="resetFilters()" class="text-xs font-semibold text-rose-600 hover:underline ml-auto">Barchasini tozalash</button>
          </div>
        ` : ''}
      </div>

      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${paginatedPrds.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10"><input type="checkbox" onchange="toggleProductSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th onclick="toggleSort('sku')" class="cursor-pointer hover:bg-slate-100">Kod ${sortField==='sku'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                  <th onclick="toggleSort('name')" class="cursor-pointer hover:bg-slate-100">Tovar nomi ${sortField==='name'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                  <th>Kategoriya</th>
                  <th>Ombor</th>
                  <th onclick="toggleSort('stock')" class="cursor-pointer hover:bg-slate-100">Qoldiq ${sortField==='stock'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                  <th onclick="toggleSort('sellPrice')" class="cursor-pointer hover:bg-slate-100">Sotuv narxi ${sortField==='sellPrice'?(sortOrder==='asc'?'↑':'↓'):''}</th>
                  <th>Xarid narxi</th>
                  <th>Holat</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedPrds.map(p => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="w-10"><input type="checkbox" data-product-id="${p.id}" class="product-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                    <td class="font-mono text-xs font-bold text-slate-500 whitespace-nowrap">${escapeHTML(p.sku)}</td>
                    <td class="font-bold text-slate-900 cursor-pointer hover:text-blue-600" onclick="openViewProductModal('${p.id}')">${escapeHTML(p.name)}</td>
                    <td class="text-xs text-slate-600">${escapeHTML(p.category)}</td>
                    <td class="text-xs text-slate-600">${escapeHTML(p.warehouse)}</td>
                    <td class="font-bold text-slate-900 whitespace-nowrap">${p.stock} ${escapeHTML(p.unit)}</td>
                    <td class="whitespace-nowrap">
                      <div class="font-bold text-blue-600 text-xs">${(p.priceRetail || p.sellPrice).toLocaleString('uz-UZ')} UZS <span class="text-[10px] text-slate-400 font-normal">(Chakana)</span></div>
                      <div class="text-[11px] text-amber-700 font-semibold">${(p.wholesalePrice || Math.round(p.sellPrice * 0.9)).toLocaleString('uz-UZ')} UZS <span class="text-[9px] text-amber-500 font-normal">(Optom)</span></div>
                      <div class="text-[11px] text-purple-700 font-semibold">${(p.vipPrice || Math.round(p.sellPrice * 0.8)).toLocaleString('uz-UZ')} UZS <span class="text-[9px] text-purple-500 font-normal">(VIP)</span></div>
                    </td>
                    <td class="text-xs text-slate-500 whitespace-nowrap">${p.buyPrice.toLocaleString('uz-UZ')} UZS</td>
                    <td><span class="badge ${p.statusClass}">${escapeHTML(p.status)}</span></td>
                    <td class="text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5">
                        <button onclick="openViewProductModal('${p.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Batafsil"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Ko'rish</button>
                        ${canEdit ? `<button onclick="openEditProductModal('${p.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Tahrirlash"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Tahrirlash</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(totalPrds, currentPage, pageSize)}
        ` : renderEmptyState('Hech qanday tovar topilmadi', 'Birinchi mahsulotni qo’shish uchun "+ Tovar qo‘shish" tugmasini bosing', 'package-x', '+ Tovar qo‘shish', 'openCreateProductModal()')}
      </div>
    </div>
  `;
}

function toggleSort(field) {
  if (sortField === field) {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortOrder = 'asc';
  }
  renderCurrentView();
}

function handlePrdSearch(val) { productSearchQuery = val; currentPage = 1; renderCurrentView(); }
function handleCatFilter(val) { selectedCategory = val; currentPage = 1; renderCurrentView(); }
function handleWhFilter(val) { selectedWarehouse = val; currentPage = 1; renderCurrentView(); }
function handleStatusFilter(val) { selectedStatus = val; currentPage = 1; renderCurrentView(); }
function resetFilters() {
  productSearchQuery = ''; selectedCategory = 'all'; selectedWarehouse = 'all'; selectedStatus = 'all'; currentPage = 1;
  renderCurrentView();
}

function triggerDeleteProduct(id, name) {
  openConfirmModal(
    "Tovarni o'chirish",
    `Haqiqatan ham "${name}" tovarini o'chirmoqchimisiz?`,
    async () => {
      const res = await productService.remove(id);
      if (res.success) {
        showToast(`"${name}" muvaffaqiyatli o'chirildi`, 'success');
        await renderCurrentView();
      } else {
        const errorMsg = res.error ? res.error.message : "O'chirishda xatolik yuz berdi!";
        showToast(errorMsg, 'error');
      }
    }
  );
}

// 4. Kirim View (/purchases)
function togglePurchasesSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.purchase-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.togglePurchasesSelectAll = togglePurchasesSelectAll;

function triggerDeleteSelectedPurchases() {
  const checkedBoxes = Array.from(document.querySelectorAll('.purchase-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror kirim yuk xatini tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Kirim hujjatlarini o'chirish",
    `Haqiqatan ham tanlangan ${count} ta kirim yuk xatini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.purchaseId).filter(Boolean);
      if (window.purchaseService) {
        for (const id of selectedIds) {
          await window.purchaseService.delete(id);
        }
      } else {
        demoData.purchases = (demoData.purchases || []).filter(p => !selectedIds.includes(p.id));
        syncGlobalState();
      }
      showToast(`${count} ta kirim hujjati o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedPurchases = triggerDeleteSelectedPurchases;

function renderPurchasesView() {
  const isDirector = checkIsDirector();
  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-4 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-slate-900">Kirim hujjatlari jurnali</h3>
          <p class="text-xs text-slate-500">Yetkazib beruvchilardan kelgan tovarlar ro'yxati</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="openModal('addPurchaseModal')" class="px-5 py-2.5 bg-[#00a368] hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            <i data-lucide="plus" class="w-4 h-4"></i> + Kirim yaratish
          </button>
          <button onclick="exportReportExcel('purchases')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            Excel
          </button>
          <button onclick="exportReportPDF('purchases')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            PDF
          </button>
          <button onclick="triggerDeleteSelectedPurchases()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan kirimlarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${demoData.purchases.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10"><input type="checkbox" onchange="togglePurchasesSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th>Sana</th>
                  <th>Hujjat №</th>
                  <th>Yetkazib beruvchi</th>
                  <th>Tovarlar</th>
                  <th>Miqdor</th>
                  <th>Umumiy summa</th>
                  <th>Holat</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${demoData.purchases.map(item => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="w-10"><input type="checkbox" data-purchase-id="${item.id}" class="purchase-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                    <td class="text-xs text-slate-500 whitespace-nowrap">${escapeHTML(item.date)}</td>
                    <td class="font-mono text-xs font-bold text-indigo-600 whitespace-nowrap">${escapeHTML(item.docNo)}</td>
                    <td class="font-bold text-slate-900">${escapeHTML(item.supplier)}</td>
                    <td class="text-xs text-slate-600">${escapeHTML(item.items)}</td>
                    <td class="font-bold text-slate-900 whitespace-nowrap">${escapeHTML(item.qty)}</td>
                    <td class="font-bold text-slate-900 whitespace-nowrap">${escapeHTML(item.amount)}</td>
                    <td><span class="badge ${item.statusClass}">${escapeHTML(item.status)}</span></td>
                    <td class="text-right whitespace-nowrap">
                      ${isDirector ? `
                        <div class="flex items-center justify-end gap-1.5">
                          <button onclick="openEditPurchaseModal('${item.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Tahrirlash"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Tahrirlash</button>
                        </div>
                      ` : `<span class="text-xs text-slate-400">-</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(demoData.purchases.length, 1, 5)}
        ` : renderEmptyState('Kirim hujjatlari mavjud emas', 'Yangi kirim yaratish uchun "+ Kirim yaratish" tugmasini bosing', 'arrow-down-left', '+ Kirim yaratish', 'openModal(\'addPurchaseModal\')')}
      </div>
    </div>
  `;
}

function triggerDeletePurchase(id, docNo) {
  openConfirmModal(
    "Kirim hujjatini o'chirish",
    `Haqiqatan ham ${docNo} yuk xatini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.purchaseService) {
        await window.purchaseService.delete(id);
      } else {
        demoData.purchases = (demoData.purchases || []).filter(p => p.id !== id);
        syncGlobalState();
      }
      showToast(`Hujjat ${docNo} o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

// 5. Chiqim View (/outgoing)
function toggleOutgoingSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.outgoing-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.toggleOutgoingSelectAll = toggleOutgoingSelectAll;

function triggerDeleteSelectedOutgoing() {
  const checkedBoxes = Array.from(document.querySelectorAll('.outgoing-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror chiqim hujjatini tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Chiqim hujjatlarini o'chirish",
    `Haqiqatan ham tanlangan ${count} ta chiqim hujjatini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.outgoingId).filter(Boolean);
      if (window.outgoingService) {
        for (const id of selectedIds) {
          await window.outgoingService.delete(id);
        }
      } else {
        demoData.outgoing = (demoData.outgoing || []).filter(o => !selectedIds.includes(o.id) && !selectedIds.includes(o.docNo));
        if (demoData.outgoing.length === 0) {
          try { localStorage.setItem('smartombor_outgoing_cleared', 'true'); } catch (e) {}
        }
        syncGlobalState();
      }
      showToast(`${count} ta chiqim hujjati o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedOutgoing = triggerDeleteSelectedOutgoing;

function renderOutgoingView() {
  const isDirector = checkIsDirector();
  const outgoingList = demoData.outgoing || [];

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-4 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-slate-900">Chiqimlar va omborlararo ko'chirishlar</h3>
          <p class="text-xs text-slate-500">Ombor ichki va tashqi tovar harakati</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="openModal('addOutgoingModal')" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            <i data-lucide="minus-circle" class="w-4 h-4"></i> + Chiqim yaratish
          </button>
          <button onclick="exportReportExcel('outgoing')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            Excel
          </button>
          <button onclick="exportReportPDF('outgoing')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            PDF
          </button>
          <button onclick="triggerDeleteSelectedOutgoing()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan chiqimlarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${outgoingList.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10"><input type="checkbox" onchange="toggleOutgoingSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th>Sana</th>
                  <th>Hujjat №</th>
                  <th>Tovar</th>
                  <th>Miqdor</th>
                  <th>Ombor</th>
                  <th>Sabab</th>
                  <th>Holat</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${outgoingList.map(item => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="w-10"><input type="checkbox" data-outgoing-id="${item.id || item.docNo}" class="outgoing-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                    <td class="text-xs text-slate-500 whitespace-nowrap">${escapeHTML(item.date)}</td>
                    <td class="font-mono text-xs font-bold text-rose-600 whitespace-nowrap">${escapeHTML(item.docNo)}</td>
                    <td class="font-bold text-slate-900">${escapeHTML(item.product)}</td>
                    <td class="font-bold text-slate-900 whitespace-nowrap">${escapeHTML(item.qty)}</td>
                    <td class="text-xs text-slate-600">${escapeHTML(item.warehouse)}</td>
                    <td class="text-xs font-medium text-slate-700">${escapeHTML(item.reason)}</td>
                    <td><span class="badge ${item.statusClass}">${escapeHTML(item.status)}</span></td>
                    <td class="text-right whitespace-nowrap">
                      ${isDirector ? `
                        <div class="flex items-center justify-end gap-1.5">
                          <button onclick="openEditOutgoingModal('${item.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Tahrirlash"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Tahrirlash</button>
                        </div>
                      ` : `<span class="text-xs text-slate-400">-</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(outgoingList.length, 1, 5)}
        ` : renderEmptyState('Chiqimlar mavjud emas', 'Ombor ko\'chirishini amalga oshirish uchun "+ Chiqim yaratish" tugmasini bosing', 'arrow-up-right', '+ Chiqim yaratish', 'openModal(\'addOutgoingModal\')')}
      </div>
    </div>
  `;
}

function triggerDeleteOutgoing(id, docNo) {
  openConfirmModal(
    "Chiqim hujjatini o'chirish",
    `Haqiqatan ham ${docNo} chiqim hujjatini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.outgoingService) {
        await window.outgoingService.delete(id, docNo);
      } else {
        demoData.outgoing = (demoData.outgoing || []).filter(o => o.id !== id && o.docNo !== id && o.docNo !== docNo);
        if (demoData.outgoing.length === 0) {
          try { localStorage.setItem('smartombor_outgoing_cleared', 'true'); } catch (e) {}
        }
        syncGlobalState();
      }
      showToast(`Chiqim hujjati o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

// 6. Sotuvlar View (/sales)
function handleSalesSearch(val) {
  salesSearchQuery = val;
  salesCurrentPage = 1;
  renderCurrentView();
}
function changeSalesPage(p) {
  salesCurrentPage = p;
  renderCurrentView();
}
function toggleSalesSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.sale-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.handleSalesSearch = handleSalesSearch;
window.changeSalesPage = changeSalesPage;
window.toggleSalesSelectAll = toggleSalesSelectAll;

function triggerDeleteSelectedSales() {
  const checkedBoxes = Array.from(document.querySelectorAll('.sale-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror sotuvni jadvaldan tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Sotuvlarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta sotuv bitimini o'chirmoqchimisiz? Server va ombor/kassa qayta hisoblanadi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.saleId).filter(Boolean);
      if (window.salesService) {
        for (const id of selectedIds) {
          await window.salesService.delete(id);
        }
      } else {
        demoData.recentSales = (demoData.recentSales || []).filter(s => !selectedIds.includes(s.id) && !selectedIds.includes(s.receiptNo));
        syncGlobalState();
      }
      showToast(`${count} ta sotuv muvaffaqiyatli o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedSales = triggerDeleteSelectedSales;

function renderSalesView() {
  const isDirector = checkIsDirector();
  let sales = demoData.recentSales || [];

  if (salesSearchQuery) {
    const q = salesSearchQuery.toLowerCase();
    sales = sales.filter(s =>
      (s.customer && s.customer.toLowerCase().includes(q)) ||
      (s.receiptNo && s.receiptNo.toLowerCase().includes(q)) ||
      (s.productName && s.productName.toLowerCase().includes(q)) ||
      (s.itemsCount && s.itemsCount.toLowerCase().includes(q)) ||
      (s.warehouse && s.warehouse.toLowerCase().includes(q)) ||
      (s.agent && s.agent.toLowerCase().includes(q)) ||
      (s.status && s.status.toLowerCase().includes(q))
    );
  }

  const totalSales = sales.length;
  const totalSalesPages = Math.ceil(totalSales / salesPageSize) || 1;
  const startItem = totalSales === 0 ? 0 : (salesCurrentPage - 1) * salesPageSize + 1;
  const endItem = Math.min(salesCurrentPage * salesPageSize, totalSales);
  const paginatedSales = sales.slice((salesCurrentPage - 1) * salesPageSize, salesCurrentPage * salesPageSize);

  return `
    <div class="space-y-4">
      <!-- Top Action Toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="openModal('addSaleModal')" class="px-5 py-2.5 bg-[#00a368] hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95">
            + Yangi sotuv
          </button>
          <button onclick="exportReportExcel('sales')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            Excel
          </button>
          <button onclick="exportReportPDF('sales')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            PDF
          </button>
          <button onclick="triggerDeleteSelectedSales()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan sotuvlarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <div class="relative">
            <input type="text" value="${escapeHTML(salesSearchQuery)}" oninput="handleSalesSearch(this.value)" placeholder="Qidiruv..." class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60 text-slate-800 placeholder-slate-400">
          </div>
          <div class="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 select-none">
            ${startItem}-${endItem} / ${totalSales}
          </div>
        </div>
      </div>

      <!-- Sales Table Card -->
      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${paginatedSales.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-white">
                  <th class="py-3.5 px-4 w-10"><input type="checkbox" onchange="toggleSalesSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">OMBOR</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">MIJOZ</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">MUQOBIL NOMI <span class="text-slate-400">↑</span></th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">SAVDO AGENTI</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">BUYURTMA SANASI</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">SUMMA</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">RAD ETISH</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">STATUS</th>
                  <th class="py-3.5 px-4 font-bold text-slate-700">QARZDORLIK</th>
                  <th class="py-3.5 px-4 text-center font-bold text-slate-700">AMALLAR</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${paginatedSales.map(sale => {
                  const statusInfo = (typeof getSaleEffectiveStatus === 'function') 
                    ? getSaleEffectiveStatus(sale) 
                    : { status: 'yangi', label: 'Yangi', badgeClass: 'bg-blue-600 text-white' };
                  const statusBadge = `<span class="px-3.5 py-1 rounded-md text-xs font-bold ${statusInfo.badgeClass}">${escapeHTML(statusInfo.label)}</span>`;

                  const cust = (demoData.customers || []).find(c => c.name === sale.customer);
                  let debtDisplay = sale.debt || '+0 UZS';
                  const sTotal = (sale.totalAmount !== undefined && sale.totalAmount !== null) ? Number(sale.totalAmount) : (parseInt(String(sale.amount || 0).replace(/[^0-9]/g, '')) || 0);
                  const sPaid = (sale.paidAmount !== undefined && sale.paidAmount !== null) ? Number(sale.paidAmount) : null;
                  
                  if (sPaid !== null && sTotal !== undefined) {
                    const sDiff = sTotal - sPaid;
                    if (sDiff > 0) {
                      debtDisplay = '+' + sDiff.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                    } else if (sDiff < 0) {
                      debtDisplay = '-' + Math.abs(sDiff).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                    } else {
                      debtDisplay = '+0 UZS';
                    }
                  } else if (cust && (debtDisplay === '+0 UZS' || debtDisplay === '0 UZS' || debtDisplay === '+0' || !sale.debt)) {
                    const cBal = (cust.balance !== undefined) ? cust.balance : (parseInt(String(cust.debt || '0').replace(/[^0-9-]/g, '')) || 0);
                    if (cBal > 0) {
                      debtDisplay = '+' + cBal.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                    } else if (cBal < 0) {
                      debtDisplay = '-' + Math.abs(cBal).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                    } else if (cust.debt && cust.debt !== '0 UZS' && cust.debt !== '+0 UZS') {
                      debtDisplay = cust.debt;
                    }
                  }

                  let debtClass = 'font-bold text-slate-500 whitespace-nowrap';
                  if (debtDisplay.startsWith('+') && debtDisplay !== '+0 UZS' && debtDisplay !== '+0' && debtDisplay !== '0 UZS') {
                    debtClass = 'font-bold text-rose-600 whitespace-nowrap';
                  } else if (debtDisplay.startsWith('-')) {
                    debtClass = 'font-bold text-blue-600 whitespace-nowrap';
                  } else {
                    debtClass = 'font-bold text-emerald-600 whitespace-nowrap';
                  }

                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3.5 px-4"><input type="checkbox" data-sale-id="${sale.id}" class="sale-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                      <td class="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">${escapeHTML(sale.warehouse || 'Asosiy Ombor - Toshkent')}</td>
                      <td class="py-3.5 px-4 font-bold text-slate-900">${escapeHTML(sale.customer)}</td>
                      <td class="py-3.5 px-4 whitespace-nowrap">
                        <span class="font-bold text-slate-900">${escapeHTML(sale.productName || sale.itemsCount || 'See Young 600ml')}</span>
                        <span class="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">${escapeHTML(sale.qty || '25 dona')}</span>
                      </td>
                      <td class="py-3.5 px-4 font-medium text-slate-800">${escapeHTML(sale.agent || 'FAYZ')}</td>
                      <td class="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">${escapeHTML(sale.date || '09.09.2026 10:57')}</td>
                      <td class="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">${escapeHTML(sale.amount)}</td>
                      <td class="py-3.5 px-4 font-medium text-slate-700">${sale.rejected ? 'Ha' : "Yo'q"}</td>
                      <td class="py-3.5 px-4 whitespace-nowrap">${statusBadge}</td>
                      <td class="py-3.5 px-4 ${debtClass}">${escapeHTML(debtDisplay)}</td>
                      <td class="py-3.5 px-4 text-center whitespace-nowrap">
                        <button onclick="openViewSaleModal('${sale.id}')" class="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition active:scale-95">
                          Ko'rish
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Jami <span class="font-bold text-slate-900">${totalSales}</span> tadan <span class="font-bold text-slate-900">${startItem}-${endItem}</span> ko'rsatilmoqda
            </div>
            <div class="flex items-center gap-1.5 self-center sm:self-auto">
              <button onclick="changeSalesPage(${salesCurrentPage - 1})" ${salesCurrentPage <= 1 ? 'disabled' : ''} class="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition" aria-label="Oldingi sahifa">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
              </button>
              ${Array.from({ length: totalSalesPages }, (_, i) => i + 1).map(p => `
                <button onclick="changeSalesPage(${p})" class="w-8 h-8 rounded-lg ${p === salesCurrentPage ? 'bg-blue-600 text-white font-bold' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium'} flex items-center justify-center text-xs transition">
                  ${p}
                </button>
              `).join('')}
              <button onclick="changeSalesPage(${salesCurrentPage + 1})" ${salesCurrentPage >= totalSalesPages ? 'disabled' : ''} class="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition" aria-label="Keyingi sahifa">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        ` : renderEmptyState('Sotuvlar tarixi bo\'sh', 'Birinchi sotuvni rasmiylashtirish uchun "+ Yangi sotuv" tugmasini bosing', 'shopping-cart', '+ Yangi sotuv', 'openModal(\'addSaleModal\')')}
      </div>
    </div>
  `;
}

function triggerDeleteSale(id, receiptNo) {
  openConfirmModal(
    "Sotuvni bekor qilish / o'chirish",
    `Haqiqatan ham Chek № ${receiptNo} bitimini bekor qilmoqchimisiz? Ombor qoldig'i va kassa balansi qaytariladi.`,
    async () => {
      if (window.salesService) {
        await window.salesService.delete(id);
      } else {
        demoData.recentSales = demoData.recentSales.filter(s => s.id !== id && s.receiptNo !== receiptNo);
        syncGlobalState();
      }
      showToast(`Chek № ${receiptNo} bekor qilindi. Ombor va kassa tiklandi!`, 'info');
      await renderCurrentView();
    }
  );
}

/// 7. Mijozlar View (/customers)
function handleCustomerSearch(val) {
  customerSearchQuery = val;
  customerCurrentPage = 1;
  renderCurrentView();
}
function changeCustomerPage(p) {
  customerCurrentPage = p;
  renderCurrentView();
}
function toggleCustomerSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.customer-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.handleCustomerSearch = handleCustomerSearch;
window.changeCustomerPage = changeCustomerPage;
window.toggleCustomerSelectAll = toggleCustomerSelectAll;

function triggerDeleteSelectedCustomers() {
  const checkedBoxes = Array.from(document.querySelectorAll('.customer-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror mijozni tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Mijozlarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta mijozni bazadan o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.customerId).filter(Boolean);
      if (window.customerService) {
        for (const id of selectedIds) {
          await window.customerService.remove(id);
        }
      } else {
        demoData.customers = (demoData.customers || []).filter(c => !selectedIds.includes(c.id) && !selectedIds.includes(c.name));
        syncGlobalState();
      }
      showToast(`${count} ta mijoz muvaffaqiyatli o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedCustomers = triggerDeleteSelectedCustomers;

function renderCustomersView() {
  const isDirector = checkIsDirector();
  let customers = demoData.customers || [];

  if (customerSearchQuery) {
    const q = customerSearchQuery.toLowerCase();
    customers = customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.priceType && c.priceType.toLowerCase().includes(q))
    );
  }

  const totalCustomers = customers.length;
  const totalCustomerPages = Math.ceil(totalCustomers / customerPageSize) || 1;
  const startItem = totalCustomers === 0 ? 0 : (customerCurrentPage - 1) * customerPageSize + 1;
  const endItem = Math.min(customerCurrentPage * customerPageSize, totalCustomers);
  const paginatedCustomers = customers.slice((customerCurrentPage - 1) * customerPageSize, customerCurrentPage * customerPageSize);

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-6 card-shadow space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Mijozlar bazasi</h3>
            <p class="text-xs text-slate-500">Mijozlar kontaktlari va qarzdorliklar</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="openCreateCustomerModal()" class="px-5 py-2.5 bg-[#1d63ed] hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0 active:scale-95 shadow-xs">
              <i data-lucide="plus" class="w-4 h-4"></i> + Mijoz qo'shish
            </button>
            <button onclick="exportReportExcel('customers')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              Excel
            </button>
            <button onclick="exportReportPDF('customers')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              PDF
            </button>
            <button onclick="triggerDeleteSelectedCustomers()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan mijozlarni o'chirish">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
            </button>
          </div>
        </div>

        ${paginatedCustomers.length > 0 ? `
          <div class="overflow-x-auto -mx-6">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-white">
                  <th class="py-3 px-6 w-10"><input type="checkbox" onchange="toggleCustomerSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th class="py-3 px-4 font-bold text-slate-700">MIJOZ NOMI</th>
                  <th class="py-3 px-4 font-bold text-slate-700">TELEFON</th>
                  <th class="py-3 px-4 font-bold text-slate-700">NARX TOIFASI</th>
                  <th class="py-3 px-4 font-bold text-slate-700">KREDIT LIMIT</th>
                  <th class="py-3 px-4 font-bold text-slate-700">QARZDORLIK BALANSI</th>
                  <th class="py-3 px-4 font-bold text-slate-700">MOLIYAVIY HOLAT</th>
                  <th class="py-3 px-6 text-center font-bold text-slate-700">AMALLAR</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${paginatedCustomers.map(c => {
                  let priceTypeBadge = '<span class="px-3 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-700">Chakana</span>';
                  if (c.priceType === 'wholesale') priceTypeBadge = '<span class="px-3 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">Optom</span>';
                  if (c.priceType === 'vip') priceTypeBadge = '<span class="px-3 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800">VIP Diler</span>';

                  let debt = (c.balance !== undefined) ? Number(c.balance) : (parseInt(String(c.debt || '0').replace(/[^0-9-]/g, '')) || 0);
                  if (debt === 0 && Array.isArray(demoData.recentSales)) {
                    const sDebt = demoData.recentSales
                      .filter(s => s && s.customer === c.name)
                      .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
                    if (sDebt > 0) debt = sDebt;
                  }
                  const limit = c.creditLimit || 50000000;

                  let limitBadge = '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Tozalangan</span>';
                  let debtClass = 'font-bold text-slate-900 whitespace-nowrap';
                  let formattedDebt = '0 UZS';

                  if (c.isBlocked) {
                    limitBadge = '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200/60"><span class="w-2 h-2 rounded-full bg-rose-500"></span> Bloklangan</span>';
                  } else if (debt > 0) {
                    limitBadge = '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60"><span class="w-2 h-2 rounded-full bg-amber-400"></span> Qarzdorlik bor</span>';
                    debtClass = 'font-bold text-rose-600 whitespace-nowrap';
                    formattedDebt = '+' + debt.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                  } else if (debt < 0) {
                    limitBadge = '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/60"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Ortiqcha to\'lov (Haqdor)</span>';
                    debtClass = 'font-bold text-blue-600 whitespace-nowrap';
                    formattedDebt = '-' + Math.abs(debt).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
                  }

                  const formattedLimit = limit.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';

                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-4 px-6"><input type="checkbox" data-customer-id="${c.id}" class="customer-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                      <td class="py-4 px-4 font-bold text-slate-900">${escapeHTML(c.name)}</td>
                      <td class="py-4 px-4 font-mono text-slate-700 whitespace-nowrap">${escapeHTML(c.phone)}</td>
                      <td class="py-4 px-4">${priceTypeBadge}</td>
                      <td class="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">${formattedLimit}</td>
                      <td class="py-4 px-4 ${debtClass}">${formattedDebt}</td>
                      <td class="py-4 px-4">${limitBadge}</td>
                      <td class="py-4 px-6 text-center whitespace-nowrap">
                        <button onclick="openViewCustomerModal('${c.id}')" class="px-5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition active:scale-95">
                          Ko'rish
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 -mx-6 -mb-6">
            <div>
              Jami <span class="font-bold text-slate-900">${totalCustomers}</span> tadan <span class="font-bold text-slate-900">${startItem}-${endItem}</span> ko'rsatilmoqda
            </div>
            <div class="flex items-center gap-1.5 self-center sm:self-auto">
              <button onclick="changeCustomerPage(${customerCurrentPage - 1})" ${customerCurrentPage <= 1 ? 'disabled' : ''} class="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition" aria-label="Oldingi sahifa">
                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
              </button>
              ${Array.from({ length: totalCustomerPages }, (_, i) => i + 1).map(p => `
                <button onclick="changeCustomerPage(${p})" class="w-8 h-8 rounded-lg ${p === customerCurrentPage ? 'bg-blue-600 text-white font-bold' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium'} flex items-center justify-center text-xs transition">
                  ${p}
                </button>
              `).join('')}
              <button onclick="changeCustomerPage(${customerCurrentPage + 1})" ${customerCurrentPage >= totalCustomerPages ? 'disabled' : ''} class="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition" aria-label="Keyingi sahifa">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        ` : renderEmptyState('Mijozlar mavjud emas', 'Yangi mijoz qo\'shish uchun "+ Mijoz qo‘shish" tugmasini bosing', 'users', '+ Mijoz qo‘shish', 'openCreateCustomerModal()')}
      </div>
    </div>
  `;
}

function triggerDeleteCustomer(id, name) {
  openConfirmModal(
    "Mijozni o'chirish",
    `Haqiqatan ham "${name}" mijozini bazadan o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.customerService) {
        await window.customerService.remove(id);
      } else {
        demoData.customers = (demoData.customers || []).filter(c => c.id !== id && c.name !== name);
        syncGlobalState();
      }
      showToast(`Mijoz "${name}" o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

// 8. Yetkazib beruvchilar View (/suppliers)
function toggleSupplierSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.supplier-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.toggleSupplierSelectAll = toggleSupplierSelectAll;

function triggerDeleteSelectedSuppliers() {
  const checkedBoxes = Array.from(document.querySelectorAll('.supplier-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror yetkazib beruvchini tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Yetkazib beruvchilarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta hamkorni o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.supplierId).filter(Boolean);
      if (window.supplierService) {
        for (const id of selectedIds) {
          await window.supplierService.remove(id);
        }
      } else {
        demoData.suppliers = (demoData.suppliers || []).filter(s => !selectedIds.includes(s.id) && !selectedIds.includes(s.name));
        syncGlobalState();
      }
      showToast(`${count} ta yetkazib beruvchi o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedSuppliers = triggerDeleteSelectedSuppliers;

function renderSuppliersView() {
  const isDirector = checkIsDirector();
  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-4 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-slate-900">Yetkazib beruvchilar katalogi</h3>
          <p class="text-xs text-slate-500">Hamkorlar va shartnoma qarzdorliklari</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="openCreateSupplierModal()" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0 active:scale-95 shadow-xs">
            <i data-lucide="plus" class="w-4 h-4"></i> + Yetkazib beruvchi qo‘shish
          </button>
          <button onclick="exportReportExcel('suppliers')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            Excel
          </button>
          <button onclick="exportReportPDF('suppliers')" class="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
            PDF
          </button>
          <button onclick="triggerDeleteSelectedSuppliers()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan yetkazib beruvchilarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${demoData.suppliers.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10"><input type="checkbox" onchange="toggleSupplierSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th>Yetkazib beruvchi nomi</th>
                  <th>Telefon</th>
                  <th>Yetkazilgan tovarlar</th>
                  <th>Umumiy xaridlar</th>
                  <th>Qarzdorlik</th>
                  <th>Holat</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${demoData.suppliers.map(s => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="w-10"><input type="checkbox" data-supplier-id="${s.id}" class="supplier-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                    <td class="font-bold text-slate-900">${escapeHTML(s.name)}</td>
                    <td class="font-mono text-xs text-slate-600 whitespace-nowrap">${escapeHTML(s.phone)}</td>
                    <td class="text-xs text-slate-600">${escapeHTML(s.productsSupplied)}</td>
                    <td class="font-bold text-slate-900 whitespace-nowrap">${escapeHTML(s.totalPurchases)}</td>
                    <td class="font-bold ${s.debt !== '0 UZS' ? 'text-amber-600' : 'text-slate-900'} whitespace-nowrap">${escapeHTML(s.debt)}</td>
                    <td><span class="badge ${s.statusClass}">${escapeHTML(s.status)}</span></td>
                    <td class="text-right whitespace-nowrap">
                      ${isDirector ? `
                        <div class="flex items-center justify-end gap-1.5">
                          <button onclick="openEditSupplierModal('${s.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Tahrirlash"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Tahrirlash</button>
                        </div>
                      ` : `<span class="text-xs text-slate-400">-</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(demoData.suppliers.length, 1, 5)}
        ` : renderEmptyState('Yetkazib beruvchilar mavjud emas', 'Yangi hamkor qo\'shish uchun "+ Yetkazib beruvchi qo‘shish" tugmasini bosing', 'truck', '+ Yetkazib beruvchi qo‘shish', 'openCreateSupplierModal()')}
      </div>
    </div>
  `;
}

function triggerDeleteSupplier(id, name) {
  openConfirmModal(
    "Yetkazib beruvchini o'chirish",
    `Haqiqatan ham "${name}" hamkorini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.supplierService) {
        await window.supplierService.remove(id);
      } else {
        demoData.suppliers = (demoData.suppliers || []).filter(s => s.id !== id && s.name !== name);
        syncGlobalState();
      }
      showToast(`Hamkor "${name}" o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

// 9. Kassa View (/cash)
function toggleCashTxSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.cashtx-row-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
window.toggleCashTxSelectAll = toggleCashTxSelectAll;

function triggerDeleteSelectedCashTx() {
  const checkedBoxes = Array.from(document.querySelectorAll('.cashtx-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror kassa operatsiyasini tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Kassa operatsiyalarini o'chirish",
    `Haqiqatan ham tanlangan ${count} ta kassa operatsiyasini bekor qilmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.txId).filter(Boolean);
      if (window.cashService && window.cashService.deleteTransaction) {
        for (const id of selectedIds) {
          await window.cashService.deleteTransaction(id);
        }
      } else {
        demoData.cash.transactions = (demoData.cash.transactions || []).filter(t => !selectedIds.includes(t.id));
        syncGlobalState();
      }
      showToast(`${count} ta kassa operatsiyasi bekor qilindi!`, 'info');
      await renderCurrentView();
    }
  );
}
window.triggerDeleteSelectedCashTx = triggerDeleteSelectedCashTx;

function renderCashView() {
  const isDirector = checkIsDirector();
  const cash = demoData.cash;
  return `
    <div class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white rounded-2xl p-5 card-shadow stat-card">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Joriy balans</span>
          <h3 class="text-2xl font-bold text-slate-900 mt-2 mb-1">${escapeHTML(cash.currentBalance)}</h3>
          <p class="text-[11px] text-slate-500">Naqd + Terminal jamlanmasi</p>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow stat-card">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Bugungi kirim</span>
          <h3 class="text-2xl font-bold text-emerald-600 mt-2 mb-1">+${escapeHTML(cash.todayIncome)}</h3>
          <p class="text-[11px] text-emerald-600 font-semibold">Tushumlar va sotuvlar</p>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow stat-card">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Bugungi chiqim</span>
          <h3 class="text-2xl font-bold text-rose-600 mt-2 mb-1">-${escapeHTML(cash.todayExpense)}</h3>
          <p class="text-[11px] text-rose-500 font-semibold">Operatsion xarajatlar</p>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow stat-card">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Sof balans</span>
          <h3 class="text-2xl font-bold text-blue-600 mt-2 mb-1">${escapeHTML(cash.netBalance)}</h3>
          <p class="text-[11px] text-slate-500">Bugungi sof foyda</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        <div class="p-6 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Kassa operatsiyalari jurnali</h3>
            <p class="text-xs text-slate-500">Naqd va terminal moliya harakati (${cash.transactions.length} ta operatsiya)</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="openCashTxModal(true)" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              <i data-lucide="plus" class="w-4 h-4"></i> + Kirim
            </button>
            <button onclick="openCashTxModal(false)" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              <i data-lucide="minus" class="w-4 h-4"></i> + Chiqim
            </button>
            <button onclick="exportReportExcel('cash')" class="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              Excel
            </button>
            <button onclick="exportReportPDF('cash')" class="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs">
              PDF
            </button>
            <button onclick="triggerDeleteSelectedCashTx()" class="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan operatsiyalarni o'chirish">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
            </button>
          </div>
        </div>

        ${cash.transactions.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10"><input type="checkbox" onchange="toggleCashTxSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></th>
                  <th>Sana</th>
                  <th>Operatsiya</th>
                  <th>Kategoriya</th>
                  <th>Summa</th>
                  <th>Izoh</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${cash.transactions.map(tx => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="w-10"><input type="checkbox" data-tx-id="${tx.id}" class="cashtx-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"></td>
                    <td class="text-xs text-slate-500 whitespace-nowrap">${escapeHTML(tx.date)}</td>
                    <td class="font-bold text-slate-900">${escapeHTML(tx.operation)}</td>
                    <td class="text-xs font-medium text-slate-600">${escapeHTML(tx.category)}</td>
                    <td class="font-bold ${tx.isIncome ? 'text-emerald-600' : 'text-rose-600'} whitespace-nowrap">${escapeHTML(tx.amount)}</td>
                    <td class="text-xs text-slate-500">${escapeHTML(tx.comment)}</td>
                    <td class="text-right whitespace-nowrap">
                      <span class="text-xs text-slate-400 font-mono">ID: ${escapeHTML(tx.id)}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(cash.transactions.length, 1, 5)}
        ` : renderEmptyState('Kassa operatsiyalari mavjud emas', 'Moliya operatsiyasini yaratish uchun "+ Kirim" tugmasini bosing', 'wallet', '+ Kirim', 'openCashTxModal(true)')}
      </div>
    </div>
  `;
}

function triggerDeleteCashTx(id) {
  openConfirmModal(
    "Kassa operatsiyasini o'chirish",
    "Haqiqatan ham ushbu kassa operatsiyasini bekor qilmoqchimisiz? Serverdan ham o'chiriladi.",
    async () => {
      if (window.cashService && window.cashService.deleteTransaction) {
        await window.cashService.deleteTransaction(id);
      } else {
        demoData.cash.transactions = (demoData.cash.transactions || []).filter(t => t.id !== id);
        syncGlobalState();
      }
      showToast("Operatsiya bekor qilindi", 'info');
      await renderCurrentView();
    }
  );
}

function parseNumClean(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  const isNegative = str.startsWith('-') || str.includes('minus');
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned) || 0;
  return isNegative ? -parsed : parsed;
}

// PDF & Excel Report Exporter Engine
async function exportReportPDF(reportType = 'products') {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast("PDF kutubxonasi yuklanmoqda, iltimos qaytadan bosing", 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const now = new Date();
    const dateStr = now.toLocaleDateString('uz-UZ') + ' ' + now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    // Document Header Banner
    doc.setFillColor(37, 99, 235); // Blue #2563EB
    doc.rect(0, 0, 297, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("SmartOmbor ERP — Tahliliy Hisobot (A4)", 14, 12);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Sana: ${dateStr}`, 230, 12);

    let head = [];
    let body = [];
    let fileName = '';

    if (reportType === 'products' || reportType === 'inventory') {
      fileName = `SmartOmbor_Tovarlar_Hisoboti_${now.toISOString().slice(0,10)}.pdf`;
      head = [['#', 'SKU', 'Tovar Nomi', 'Kategoriya', 'Ombor', 'Birlik', 'Qoldiq', 'Xarid Narxi', 'Sotuv Narxi', 'Jami Qiymati']];
      
      const prds = demoData.products || [];
      let totalStock = 0;
      let totalValue = 0;

      body = prds.map((p, i) => {
        const qty = parseNumClean(p.stock);
        const price = parseNumClean(p.sellPrice || p.priceRetail);
        const val = qty * price;
        totalStock += qty;
        totalValue += val;
        return [
          i + 1,
          p.sku || '-',
          p.name,
          p.category || '-',
          p.warehouse || '-',
          p.unit || 'dona',
          qty,
          (p.buyPrice || 0).toLocaleString('uz-UZ') + ' UZS',
          price.toLocaleString('uz-UZ') + ' UZS',
          val.toLocaleString('uz-UZ') + ' UZS'
        ];
      });

      body.push([
        '', '', 'JAMI NATIJA:', '', '', '',
        totalStock.toLocaleString('uz-UZ') + ' dona',
        '', '',
        totalValue.toLocaleString('uz-UZ') + ' UZS'
      ]);
    } else if (reportType === 'sales') {
      fileName = `SmartOmbor_Savdo_Hisoboti_${now.toISOString().slice(0,10)}.pdf`;
      head = [['#', 'Sana', 'Chek №', 'Mijoz', 'Tovar', 'Miqdor', 'To\'lov Turi', 'Summa']];
      
      const sales = demoData.recentSales || [];
      let totalSalesSum = 0;
      let totalSalesQty = 0;
      body = sales.map((s, i) => {
        const qty = parseNumClean(s.qty) || 1;
        const sum = parseNumClean(s.totalAmount || s.rawAmount || s.amount);
        totalSalesQty += qty;
        totalSalesSum += sum;
        return [
          i + 1,
          s.date || '',
          s.receiptNo || s.id,
          s.customer || 'Mijoz',
          s.itemsCount || s.productName || s.items || 'Tovar',
          qty + ' dona',
          s.paymentType || 'Naqd',
          sum.toLocaleString('uz-UZ') + ' UZS'
        ];
      });
      body.push([
        '', '', 'JAMI NATIJA:', '', '', `${totalSalesQty} dona`, '', `${totalSalesSum.toLocaleString('uz-UZ')} UZS`
      ]);
    } else if (reportType === 'purchases') {
      fileName = `SmartOmbor_Kirimlar_Hisoboti_${now.toISOString().slice(0,10)}.pdf`;
      head = [['#', 'Sana', 'Hujjat №', 'Yetkazib beruvchi', 'Tovarlar', 'Miqdor', 'Summa']];
      
      const purchases = demoData.purchases || [];
      let totalPurSum = 0;
      let totalPurQty = 0;
      body = purchases.map((p, i) => {
        const qty = parseNumClean(p.qty) || 1;
        const sum = parseNumClean(p.amount || p.total_amount);
        totalPurQty += qty;
        totalPurSum += sum;
        return [
          i + 1,
          p.date || '',
          p.docNo || p.id,
          p.supplier || 'Ta\'minotchi',
          p.items || p.product || 'Tovar',
          qty + ' dona',
          sum.toLocaleString('uz-UZ') + ' UZS'
        ];
      });
      body.push([
        '', '', 'JAMI NATIJA:', '', '', `${totalPurQty} dona`, `${totalPurSum.toLocaleString('uz-UZ')} UZS`
      ]);
    } else {
      fileName = `SmartOmbor_Kassa_Hisoboti_${now.toISOString().slice(0,10)}.pdf`;
      head = [['#', 'Sana', 'Operatsiya', 'Kategoriya', 'Turi', 'Summa']];
      
      const txs = demoData.cash.transactions || [];
      let totalCashSum = 0;
      body = txs.map((t, i) => {
        const isInc = t.isIncome !== false;
        const sum = Math.abs(parseNumClean(t.amount));
        totalCashSum += (isInc ? sum : -sum);
        return [
          i + 1,
          t.date || '',
          t.operation || 'Kassa amali',
          t.category || '',
          isInc ? 'Kirim' : 'Chiqim',
          (isInc ? '+' : '-') + sum.toLocaleString('uz-UZ') + ' UZS'
        ];
      });
      body.push([
        '', '', 'JAMI BALANS:', '', '', `${totalCashSum.toLocaleString('uz-UZ')} UZS`
      ]);
    }

    doc.autoTable({
      startY: 23,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(fileName);
    showToast(`PDF hisobot kompyuteringizga yuklandi!`, 'success');
  } catch (err) {
    console.error("[exportReportPDF] Error:", err);
    showToast("PDF yuklashda xatolik yuz berdi", 'error');
  }
}

async function exportReportExcel(reportType = 'products') {
  try {
    const curUser = (window.authService && window.authService.getCurrentUser()) ? window.authService.getCurrentUser() : { full_name: 'Administrator' };
    const now = new Date();
    const nowStr = now.toLocaleString('uz-UZ');
    const dateSlug = now.toISOString().slice(0, 10);
    const nowId = String(Date.now()).slice(-7);

    let reportTitle = "Tovarlar va Ombor Qoldig'i";
    let exportFileName = `SmartOmbor_Tovarlar_Hisoboti_${dateSlug}.xlsx`;
    let subInfoLeft = "Ombor: Asosiy ombor (Barchasi)";
    let subInfoRight = "Filtr: Barcha tovarlar";
    let totalPositionsNote = "";
    let summaryFooterNote = "";

    // Items mapped to standard 6 columns: [№, Код, ТМЦ, Кол., Цена, Сумма]
    let items = [];
    let totalQty = 0;
    let totalSum = 0;

    if (reportType === 'products' || reportType === 'inventory') {
      reportTitle = "Tovarlar va Ombor Qoldig'i";
      exportFileName = `SmartOmbor_Ombor_Hisoboti_${dateSlug}.xlsx`;
      const prds = demoData.products || [];
      totalPositionsNote = `Jami pozitsiyalar: ${prds.length} xil`;
      
      let totalBuyVal = 0;
      items = prds.map((p, i) => {
        const rawName = p.name || 'Tovar';
        const pName = typeof unescapeHTML === 'function' ? unescapeHTML(rawName) : rawName;
        const sku = p.sku || p.code || ('PRD-' + (i + 1));
        const qty = parseNumClean(p.stock);
        const price = parseNumClean(p.sellPrice || p.priceRetail);
        const lineTotal = qty * price;
        totalBuyVal += (qty * parseNumClean(p.buyPrice));
        totalQty += qty;
        totalSum += lineTotal;
        return {
          num: i + 1,
          sku: sku,
          name: pName,
          qty: qty,
          price: price,
          total: lineTotal
        };
      });
      summaryFooterNote = `Qoldiq umumiy tannarxi: ${totalBuyVal.toLocaleString('uz-UZ')} UZS`;

    } else if (reportType === 'sales') {
      reportTitle = "Savdo va Tushumlar Hisoboti";
      exportFileName = `SmartOmbor_Savdo_Hisoboti_${dateSlug}.xlsx`;
      subInfoLeft = "Turi: Barcha bitimlar";
      subInfoRight = "To'lov turi: Naqd / Karta / O'tkazma / Nasiya";
      const sales = demoData.recentSales || [];
      totalPositionsNote = `Jami sotuvlar: ${sales.length} ta`;

      items = sales.map((s, i) => {
        const rawCust = s.customer || 'Mijoz';
        const custName = typeof unescapeHTML === 'function' ? unescapeHTML(rawCust) : rawCust;
        const itemInfo = s.productName || s.itemsCount || s.items || '';
        const itemText = itemInfo ? ` (${typeof unescapeHTML === 'function' ? unescapeHTML(itemInfo) : itemInfo})` : '';
        const rawQty = parseNumClean(s.qty) || 1;
        const sumVal = parseNumClean(s.totalAmount || s.rawAmount || s.amount);
        const priceVal = (s.items && s.items[0] && parseNumClean(s.items[0].price)) ? parseNumClean(s.items[0].price) : (rawQty > 0 ? Math.round(sumVal / rawQty) : sumVal);
        totalQty += rawQty;
        totalSum += sumVal;
        return {
          num: i + 1,
          sku: s.receiptNo || s.id || ('CHK-' + (i + 1001)),
          name: `${custName}${itemText}`,
          qty: rawQty,
          price: priceVal,
          total: sumVal
        };
      });
      summaryFooterNote = `Jami savdo tushumi: ${totalSum.toLocaleString('uz-UZ')} UZS`;

    } else if (reportType === 'purchases') {
      reportTitle = "Kirim va Ta'minot Hisoboti";
      exportFileName = `SmartOmbor_Kirimlar_Hisoboti_${dateSlug}.xlsx`;
      subInfoLeft = "Turi: Barcha kirimlar";
      subInfoRight = "Hujjatlar: Tasdiqlangan yuk xatlari";
      const purchases = demoData.purchases || [];
      totalPositionsNote = `Jami kirimlar: ${purchases.length} ta`;

      items = purchases.map((p, i) => {
        const rawSup = p.supplier || 'Yetkazib beruvchi';
        const supName = typeof unescapeHTML === 'function' ? unescapeHTML(rawSup) : rawSup;
        const itemInfo = p.items || p.product || '';
        const itemText = itemInfo ? ` (${typeof unescapeHTML === 'function' ? unescapeHTML(itemInfo) : itemInfo})` : '';
        const rawQty = parseNumClean(p.qty) || 1;
        const sumVal = parseNumClean(p.amount || p.total_amount);
        const priceVal = rawQty > 0 ? Math.round(sumVal / rawQty) : sumVal;
        totalQty += rawQty;
        totalSum += sumVal;
        return {
          num: i + 1,
          sku: p.docNo || p.id || ('KIR-' + (i + 1001)),
          name: `${supName}${itemText}`,
          qty: rawQty,
          price: priceVal,
          total: sumVal
        };
      });
      summaryFooterNote = `Jami kirim summasi: ${totalSum.toLocaleString('uz-UZ')} UZS`;

    } else if (reportType === 'outgoing') {
      reportTitle = "Ombor Chiqimlari Hisoboti";
      exportFileName = `SmartOmbor_Chiqimlar_Hisoboti_${dateSlug}.xlsx`;
      subInfoLeft = "Turi: Chiqimlar va ko'chirishlar";
      subInfoRight = "Holat: Bajarilgan";
      const outgoings = demoData.outgoing || [];
      totalPositionsNote = `Jami chiqimlar: ${outgoings.length} ta`;

      items = outgoings.map((o, i) => {
        const pName = typeof unescapeHTML === 'function' ? unescapeHTML(o.product || 'Tovar') : (o.product || 'Tovar');
        const reason = o.reason ? ` [${typeof unescapeHTML === 'function' ? unescapeHTML(o.reason) : o.reason}]` : '';
        const rawQty = parseNumClean(o.qty) || 1;
        totalQty += rawQty;
        return {
          num: i + 1,
          sku: o.docNo || o.id || ('CH-' + (i + 1001)),
          name: `${pName}${reason}`,
          qty: rawQty,
          price: 0,
          total: 0
        };
      });
      summaryFooterNote = `Jami hisobdan chiqarilgan: ${totalQty.toLocaleString('uz-UZ')} dona`;

    } else if (reportType === 'customers') {
      reportTitle = "Mijozlar va Qarzdorlik Balansi";
      exportFileName = `SmartOmbor_Mijozlar_Hisoboti_${dateSlug}.xlsx`;
      subInfoLeft = "Mijozlar: Barchasi";
      subInfoRight = "Tizim: SmartOmbor CRM";
      const customers = demoData.customers || [];
      totalPositionsNote = `Jami mijozlar: ${customers.length} ta`;

      items = customers.map((c, i) => {
        const cName = typeof unescapeHTML === 'function' ? unescapeHTML(c.name || 'Mijoz') : (c.name || 'Mijoz');
        const debt = parseNumClean(c.balance !== undefined ? c.balance : c.debt);
        const limit = parseNumClean(c.creditLimit || 50000000);
        totalQty += 1;
        totalSum += debt;
        return {
          num: i + 1,
          sku: c.phone || ('CUST-' + (i + 1001)),
          name: `${cName} (${c.priceType === 'wholesale' ? 'Optom' : (c.priceType === 'vip' ? 'VIP' : 'Chakana')})`,
          qty: 1,
          price: limit,
          total: debt
        };
      });
      summaryFooterNote = `Jami umumiy qarzdorlik: ${totalSum.toLocaleString('uz-UZ')} UZS`;

    } else {
      // Cash
      reportTitle = "Kassa Kirim-Chiqim Hisoboti";
      exportFileName = `SmartOmbor_Kassa_Hisoboti_${dateSlug}.xlsx`;
      subInfoLeft = "Kassa holati: Faol";
      subInfoRight = `Balans: ${(demoData.cash && (demoData.cash.currentBalance || demoData.cash.netBalance)) ? (demoData.cash.currentBalance || demoData.cash.netBalance) : '0 UZS'}`;
      const txs = (demoData.cash && demoData.cash.transactions) ? demoData.cash.transactions : [];
      totalPositionsNote = `Jami operatsiyalar: ${txs.length} ta`;

      items = txs.map((t, i) => {
        const rawOp = t.operation || t.comment || 'Kassa amali';
        const opName = typeof unescapeHTML === 'function' ? unescapeHTML(rawOp) : rawOp;
        const catInfo = t.category ? ` [${typeof unescapeHTML === 'function' ? unescapeHTML(t.category) : t.category}]` : '';
        const isInc = t.isIncome !== false;
        const sumVal = Math.abs(parseNumClean(t.amount));
        totalQty += 1;
        totalSum += (isInc ? sumVal : -sumVal);
        return {
          num: i + 1,
          sku: t.date ? t.date.slice(0, 10) : ('TX-' + (i + 1)),
          name: `${opName}${catInfo} (${isInc ? 'Kirim' : 'Chiqim'})`,
          qty: 1,
          price: sumVal,
          total: isInc ? sumVal : -sumVal
        };
      });
      summaryFooterNote = `Kassa joriy balansi: ${totalSum.toLocaleString('uz-UZ')} UZS`;
    }

    // 1. Prioritize ExcelJS with exact styling, colors, borders, and column widths
    if (window.ExcelJS) {
      const workbook = new window.ExcelJS.Workbook();
      workbook.creator = "SmartOmbor";
      const ws = workbook.addWorksheet("Hisobot", {
        views: [{ showGridLines: true }]
      });

      // Define Column Widths matching exact screenshot proportions
      ws.columns = [
        { width: 5.5 },  // A: №
        { width: 14.5 }, // B: Код
        { width: 55 },   // C: ТМЦ
        { width: 9 },    // D: Кол.
        { width: 13 },   // E: Цена
        { width: 16 }    // F: Сумма
      ];

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };

      const lightBorder = {
        top: { style: 'thin', color: { argb: 'FF808080' } },
        bottom: { style: 'thin', color: { argb: 'FF808080' } },
        left: { style: 'thin', color: { argb: 'FF808080' } },
        right: { style: 'thin', color: { argb: 'FF808080' } }
      };

      const greyFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBFBFBF' } // Exact grey fill color matching the screenshot
      };

      // Top Metadata Header Rows (1 to 4)
      const r1 = ws.addRow([`Hisobot: ${reportTitle}`, '', '', `Tizim: SmartOmbor ERP`, '', '']);
      ws.mergeCells('A1:C1');
      ws.mergeCells('D1:F1');

      const r2 = ws.addRow([`Sana: ${nowStr}`, '', '', `Mas'ul: ${curUser.full_name || curUser.fullName || 'Administrator'}`, '', '']);
      ws.mergeCells('A2:C2');
      ws.mergeCells('D2:F2');

      const r3 = ws.addRow([`${subInfoLeft}`, '', '', `${subInfoRight}`, '', '']);
      ws.mergeCells('A3:C3');
      ws.mergeCells('D3:F3');

      const r4 = ws.addRow([`ID Hisobot: REP-${nowId}`, '', '', `${totalPositionsNote}`, '', '']);
      ws.mergeCells('A4:C4');
      ws.mergeCells('D4:F4');

      [r1, r2, r3, r4].forEach((r, idx) => {
        r.height = 19;
        for (let col = 1; col <= 6; col++) {
          const cell = r.getCell(col);
          cell.font = { name: 'Arial', size: 10, bold: (idx === 0) };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = lightBorder;
        }
      });

      // Table Header Row (Row 5)
      const thRow = ws.addRow(['№', 'Код', 'ТМЦ', 'Кол.', 'Цена', 'Сумма']);
      thRow.height = 22;
      for (let col = 1; col <= 6; col++) {
        const cell = thRow.getCell(col);
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = greyFill;
        cell.border = thinBorder;
        if (col === 1 || col === 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (col === 5 || col === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      // Data Rows
      items.forEach(it => {
        const row = ws.addRow([
          it.num,
          it.sku,
          it.name,
          it.qty,
          it.price,
          it.total
        ]);
        row.height = 19;

        for (let col = 1; col <= 6; col++) {
          const cell = row.getCell(col);
          cell.font = { name: 'Arial', size: 9.5 };
          cell.border = lightBorder;
          if (col === 1) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (col === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (col === 3) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (col === 4) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (col === 5 || col === 6) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          }
        }
      });

      // Total Row ("Итог:")
      const totRow = ws.addRow(['', '', 'Итог:', totalQty, '', totalSum]);
      totRow.height = 22;
      for (let col = 1; col <= 6; col++) {
        const cell = totRow.getCell(col);
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = greyFill;
        cell.border = thinBorder;
        if (col === 3) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (col === 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.numFmt = '#,##0';
        } else if (col === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        }
      }

      // Footer Rows
      const blankRow1 = ws.addRow(['', '', '', '', '', '']);
      blankRow1.height = 10;

      const qRow = ws.addRow([summaryFooterNote, '', '', '', '', '']);
      qRow.getCell(1).font = { name: 'Arial', size: 8, color: { argb: 'FF666666' } };

      const blankRow2 = ws.addRow(['', '', '', '', '', '']);
      blankRow2.height = 12;

      const signRow = ws.addRow(['', '', '', 'Принял:', '', '']);
      signRow.height = 22;
      signRow.getCell(4).font = { name: 'Arial', size: 10, bold: true };
      signRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      
      const sRowIdx = signRow.number;
      ws.mergeCells(`E${sRowIdx}:F${sRowIdx}`);
      const signLineCell = ws.getCell(`E${sRowIdx}`);
      signLineCell.border = {
        bottom: { style: 'medium', color: { argb: 'FF000000' } }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = exportFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      showToast(`Hisobot "${reportTitle}" Excel (.xlsx) formatida yuklandi!`, 'success');
      return;
    }

    // 2. Fallback to SheetJS
    if (!window.XLSX) {
      showToast("Excel kutubxonasi yuklanmoqda, iltimos qaytadan bosing", 'warning');
      return;
    }

    const aoa = [
      [`Hisobot: ${reportTitle}`, "", "", `Tizim: SmartOmbor ERP`, "", ""],
      [`Sana: ${nowStr}`, "", "", `Mas'ul: ${curUser.full_name || curUser.fullName || 'Administrator'}`, "", ""],
      [`${subInfoLeft}`, "", "", `${subInfoRight}`, "", ""],
      [`ID Hisobot: REP-${nowId}`, "", "", `${totalPositionsNote}`, "", ""],
      ["№", "Код", "ТМЦ", "Кол.", "Цена", "Сумма"]
    ];

    items.forEach(it => {
      aoa.push([
        it.num,
        it.sku,
        it.name,
        it.qty,
        it.price,
        it.total
      ]);
    });

    const totalRowIndex = aoa.length;
    aoa.push(["", "", "Итог:", totalQty, "", totalSum]);
    aoa.push(["", "", "", "", "", ""]);
    aoa.push([summaryFooterNote, "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", ""]);
    aoa.push(["", "", "", "Принял: __________________", "", ""]);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet['!cols'] = [
      { wch: 5.5 },
      { wch: 14.5 },
      { wch: 55 },
      { wch: 9 },
      { wch: 13 },
      { wch: 16 }
    ];

    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
      { s: { r: totalRowIndex + 4, c: 3 }, e: { r: totalRowIndex + 4, c: 5 } }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");

    XLSX.writeFile(workbook, exportFileName);
    showToast(`Hisobot "${reportTitle}" Excel (.xlsx) formatida yuklandi!`, 'success');
  } catch (err) {
    console.error("[exportReportExcel] Error:", err);
    showToast("Excel yuklashda xatolik yuz berdi", 'error');
  }
}

// 10. Hisobotlar View (/reports) - Dynamic Aggregation
function renderReportsView() {
  const totalStockItems = demoData.products.reduce((acc, p) => acc + p.stock, 0);
  const totalStockValue = demoData.products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
  const lowStockCount = demoData.products.filter(p => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = demoData.products.filter(p => p.stock === 0).length;

  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-5 card-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-slate-900">Tahliliy hisobotlar markazi</h3>
          <p class="text-xs text-slate-500">Moliyaviy ko'rsatkichlar va ombor aylanmasi dinamik tahlili</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <span class="text-slate-400 font-medium">Dan:</span>
            <input type="date" value="2026-08-01" class="bg-transparent font-semibold text-slate-700 outline-none">
            <span class="text-slate-400 font-medium">Gacha:</span>
            <input type="date" value="2026-08-30" class="bg-transparent font-semibold text-slate-700 outline-none">
          </div>

          <button onclick="exportReportPDF('products')" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium flex items-center gap-2 transition active:scale-95 shadow-xs">
            <i data-lucide="file-text" class="w-4 h-4"></i> PDF Eksport
          </button>
          <button onclick="exportReportExcel('products')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium flex items-center gap-2 transition active:scale-95 shadow-xs">
            <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> Excel (.xlsx) Eksport
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between hover:border-blue-300 transition space-y-4">
          <div>
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
              <i data-lucide="trending-up" class="w-5 h-5"></i>
            </div>
            <h4 class="font-bold text-slate-900 text-base mb-1">Savdo hisoboti</h4>
            <p class="text-xs text-slate-500 mb-2">Jami bitimlar: <span class="font-bold text-slate-800">${demoData.recentSales.length} ta</span></p>
            <p class="text-xs font-bold text-emerald-600 mb-4">Tushum: ${escapeHTML(demoData.cash.todayIncome)}</p>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <button onclick="exportReportPDF('sales')" class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i> PDF
            </button>
            <button onclick="exportReportExcel('sales')" class="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Excel
            </button>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between hover:border-blue-300 transition space-y-4">
          <div>
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-3">
              <i data-lucide="building-2" class="w-5 h-5"></i>
            </div>
            <h4 class="font-bold text-slate-900 text-base mb-1">Ombor hisoboti</h4>
            <p class="text-xs text-slate-500 mb-2">Jami tovarlar qoldig'i: <span class="font-bold text-slate-800">${totalStockItems.toLocaleString('uz-UZ')} dona</span></p>
            <p class="text-xs font-bold text-blue-600 mb-4">Ombor qiymati: ${(totalStockValue / 1000000).toFixed(1)} mln UZS</p>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <button onclick="exportReportPDF('inventory')" class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i> PDF
            </button>
            <button onclick="exportReportExcel('inventory')" class="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Excel
            </button>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 card-shadow flex flex-col justify-between hover:border-blue-300 transition space-y-4">
          <div>
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
              <i data-lucide="package" class="w-5 h-5"></i>
            </div>
            <h4 class="font-bold text-slate-900 text-base mb-1">Tovarlar statusi</h4>
            <p class="text-xs text-slate-500 mb-1">Kam qolgan: <span class="font-bold text-amber-600">${lowStockCount} xil</span></p>
            <p class="text-xs text-slate-500 mb-4">Tugagan: <span class="font-bold text-rose-600">${outOfStockCount} xil</span></p>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <button onclick="exportReportPDF('products')" class="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i> PDF
            </button>
            <button onclick="exportReportExcel('products')" class="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Excel
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-6 card-shadow">
        <h3 class="text-base font-bold text-slate-900 mb-2">Oylik sotuvlar grafik dinamikasi</h3>
        <div class="relative w-full h-[260px]">
          <canvas id="salesChartCanvas"></canvas>
        </div>
      </div>
    </div>
  `;
}

// 11. Sozlamalar View (/settings)
function renderSettingsView() {
  return `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl p-2 card-shadow overflow-x-auto">
        <div class="flex items-center gap-1 min-w-max">
          <button onclick="switchSettingsTab('company')" id="stab-company" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'company' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Kompaniya ma'lumotlari
          </button>
          <button onclick="switchSettingsTab('profile')" id="stab-profile" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Profil
          </button>
          <button onclick="switchSettingsTab('warehouses')" id="stab-warehouses" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'warehouses' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Omborlar
          </button>
          <button onclick="switchSettingsTab('categories')" id="stab-categories" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'categories' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Kategoriyalar
          </button>
          <button onclick="switchSettingsTab('payments')" id="stab-payments" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'payments' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            To‘lov turlari
          </button>
          <button onclick="switchSettingsTab('notifications')" id="stab-notifications" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Bildirishnomalar
          </button>
          <button onclick="switchSettingsTab('system')" id="stab-system" class="px-4 py-2 rounded-xl text-xs font-semibold ${settingsActiveTab === 'system' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'} transition">
            Tizim sozlamalari
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-6 card-shadow max-w-3xl">
        ${renderSettingsTabContent()}
      </div>
    </div>
  `;
}

let systemSettingsUnlocked = false;

function switchSettingsTab(tab) {
  if (tab === 'system' && !systemSettingsUnlocked) {
    const inputPass = prompt("Tizim sozlamalariga kirish uchun parolni kiriting:");
    if (inputPass === 'Aa87654321') {
      systemSettingsUnlocked = true;
      showToast("Tizim sozlamalariga ruxsat berildi!", 'success');
    } else {
      showToast("Parol noto'g'ri! Tizim sozlamalariga kirish rad etildi.", 'error');
      return;
    }
  }
  settingsActiveTab = tab;
  renderCurrentView();
}

function triggerWipeAllData() {
  const isStrictDirector = checkIsStrictDirector();
  if (!isStrictDirector) {
    showToast("Tizim ma'lumotlarini to'liq 0 qilish faqat Bosh Direktor uchun ruxsat etilgan!", 'error');
    return;
  }

  openConfirmModal(
    "TIZIMNI 0 QILISH (HAMMASINI TOZALASH)",
    "DIQQAT! Tizimdagi BARCHA tovarlar, sotuvlar, kirim-chiqimlar, mijozlar, yetkazib beruvchilar va buyurtmalar butunlay o'chiriladi (faqat xodimlar va foydalanuvchilar saqlab qolinadi). Barcha ko'rsatkichlar 0 bo'ladi. Davom etasizmi?",
    async () => {
      showToast("Barcha ma'lumotlar 0 qilinmoqda...", 'info');
      if (window.wipeAllSystemData) {
        await window.wipeAllSystemData();
      }
      showToast("Tizim muvaffaqiyatli 0 qilindi! Faqat foydalanuvchilar saqlab qolindi.", 'success');
      await renderCurrentView();
    }
  );
}
window.switchSettingsTab = switchSettingsTab;
window.triggerWipeAllData = triggerWipeAllData;

function renderSettingsTabContent() {
  const isDirector = checkIsDirector();
  switch (settingsActiveTab) {
    case 'company':
      return `
        <div class="space-y-4">
          <h3 class="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">Kompaniya rekvizitlari</h3>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Tashkilot nomi *</label>
            <input type="text" value="SmartOmbor Logistics MCHJ" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">STIR / INN *</label>
              <input type="text" value="309124859" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Telefon *</label>
              <input type="text" value="+998 71 200-00-11" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Yuridik Manzil</label>
            <input type="text" value="Toshkent sh., Sergeli tumani, Sanoat zonasi 4-uy" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end">
            <button onclick="showToast('Kompaniya ma\'lumotlari saqlandi!', 'success')" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium active:scale-95">Saqlash</button>
          </div>
        </div>
      `;

    case 'profile':
      const curUser = window.authService ? window.authService.getCurrentUser() : { fullName: 'FAYZ', roleLabel: 'Bosh administrator' };
      const avatarSrc = curUser.avatar || curUser.avatar_url || localStorage.getItem('smartombor_user_avatar') || 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>';
      const isDirectorUser = (curUser.role === 'director' || curUser.role === 'admin');

      return `
        <form onsubmit="handleSaveSettingsProfile(event)" class="space-y-6">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-extrabold text-slate-900">Foydalanuvchi profili</h3>
              <p class="text-xs text-slate-500">Shaxsiy ma'lumotlar, login ID va xavfsizlik sozlamalari</p>
            </div>
            ${isDirectorUser ? `
              <span class="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i> Direktor Huquqi Faol
              </span>
            ` : `
              <span class="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
                <i data-lucide="user" class="w-4 h-4 text-slate-500"></i> ${escapeHTML(curUser.roleLabel || 'Xodim')}
              </span>
            `}
          </div>

          <!-- User Avatar & Quick Info Card -->
          <div class="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <img id="settingsProfileAvatarPreview" src="${avatarSrc}" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'" alt="Avatar" class="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0">
            <div class="space-y-1.5 text-center sm:text-left flex-1">
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h4 class="text-base font-extrabold text-slate-900">${escapeHTML(curUser.fullName || curUser.full_name || 'Xodim')}</h4>
                <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${curUser.badgeClass || 'bg-blue-100 text-blue-800'}">
                  ${escapeHTML(curUser.roleLabel || 'Administrator')}
                </span>
              </div>
              <p class="text-xs font-mono text-slate-500">Joriy ID (Login): <strong class="text-slate-800">${escapeHTML(curUser.id || 'Noma\'lum')}</strong></p>
              
              <div class="pt-1">
                <input type="file" id="profileAvatarFileInput" accept="image/*" class="hidden" onchange="handleProfileAvatarUpload(event)">
                <button type="button" onclick="document.getElementById('profileAvatarFileInput').click()" class="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition active:scale-95 flex items-center gap-1.5 shadow-xs mx-auto sm:mx-0">
                  <i data-lucide="camera" class="w-3.5 h-3.5 text-blue-600"></i> Rasmni o'zgartirish
                </button>
              </div>
            </div>
          </div>

          <!-- Main Identity Form Fields -->
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="user-check" class="w-4 h-4 text-blue-600"></i> Shaxsiy ma'lumotlar
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ism-familiya *</label>
                <input type="text" id="settingsFullName" value="${escapeHTML(curUser.fullName || curUser.full_name || '')}" required placeholder="Masalan: FAYZ" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Foydalanuvchi ID (Login ID) *
                </label>
                <input type="text" id="settingsUserId" value="${escapeHTML(curUser.id || '')}" required ${isDirectorUser ? `oninput="handleUserIdInputChange(this.value, 'settingsUserIdWarning', 'settingsUserId', 'settingsProfileSaveBtn')"` : 'disabled'} class="w-full px-3.5 py-2.5 ${isDirectorUser ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500' : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'} rounded-xl text-sm font-mono focus:outline-none transition">
                
                ${isDirectorUser ? `
                  <p class="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> 👑 Direktor huquqi: ID va Ismni o'zgartirishingiz mumkin.
                  </p>
                ` : `
                  <p class="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1 bg-amber-50 p-1.5 rounded-lg border border-amber-200/80">
                    <i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i> 🔒 ID ni faqat Direktor huquqiga ega foydalanuvchilar o'zgartira oladi.
                  </p>
                `}
              </div>
            </div>

            <!-- Dynamic Live Warning Block for Settings Page -->
            <div id="settingsUserIdWarning" class="hidden"></div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Telefon raqami</label>
              <input type="text" id="settingsPhone" value="${escapeHTML(curUser.phone || '')}" placeholder="+998 90 123-45-67" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
            </div>
          </div>

          <!-- Password Change Card -->
          <div class="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <i data-lucide="lock" class="w-4 h-4 text-blue-600"></i> Parolni o'zgartirish
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Joriy (eski) parol</label>
                <input type="password" id="settingsCurrentPassword" placeholder="Hozirgi parolingiz..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Yangi parol</label>
                <input type="password" id="settingsNewPassword" minlength="6" placeholder="Yangi parol (kamida 6 belgi)..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Yangi parolni takrorlang</label>
                <input type="password" id="settingsConfirmPassword" minlength="6" placeholder="Qayta kiriting..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" id="settingsProfileSaveBtn" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold active:scale-95 shadow-md shadow-blue-500/20 flex items-center gap-2 transition">
              <i data-lucide="check" class="w-4 h-4"></i> Saqlash
            </button>
          </div>
        </form>
      `;

    case 'warehouses':
      return `
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Omborlar ro'yxati</h3>
            ${isDirector ? `<button onclick="openCreateWarehouseModal()" class="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-xl active:scale-95">+ Qo'shish</button>` : ''}
          </div>
          <div class="space-y-2">
            ${demoData.warehouses.map(w => `
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 class="font-bold text-sm text-slate-900">${escapeHTML(w.name)}</h4>
                  <p class="text-xs text-slate-500">${escapeHTML(w.address)}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="badge ${w.statusClass}">${escapeHTML(w.status)}</span>
                  ${isDirector ? `
                    <button onclick="openEditWarehouseModal('${w.id}')" class="p-1 text-slate-400 hover:text-blue-600" aria-label="Tahrirlash" title="Tahrirlash"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="triggerDeleteWarehouse('${w.id}', '${escapeHTML(w.name)}')" class="p-1 text-slate-400 hover:text-rose-600" aria-label="O'chirish" title="O'chirish"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    case 'categories':
      return `
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Tovar kategoriyalari</h3>
            ${isDirector ? `<button onclick="promptAddCategory()" class="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-xl active:scale-95">+ Yangi kategoriya</button>` : ''}
          </div>
          <div class="space-y-2">
            ${(demoData.categories || []).map(cat => {
              const catName = typeof cat === 'object' ? cat.name : cat;
              const catId = typeof cat === 'object' ? cat.id : cat;
              return `
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm font-medium text-slate-800">
                <span>${escapeHTML(catName)}</span>
                ${isDirector ? `
                  <div class="flex items-center gap-2">
                    <button onclick="promptEditCategory('${escapeHTML(catId)}', '${escapeHTML(catName)}')" class="text-xs text-blue-600 font-semibold hover:underline">Tahrirlash</button>
                    <button onclick="triggerDeleteCategory('${escapeHTML(catId)}', '${escapeHTML(catName)}')" class="text-xs text-rose-600 font-semibold hover:underline">O'chirish</button>
                  </div>
                ` : ''}
              </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

    case 'payments':
      return `
        <div class="space-y-4">
          <h3 class="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">To'lov usullari</h3>
          <div class="space-y-2">
            ${demoData.paymentMethods.map(pm => `
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm font-medium text-slate-800">
                <span class="flex items-center gap-2">
                  <i data-lucide="${pm.icon}" class="w-4 h-4 text-blue-600"></i>
                  ${escapeHTML(pm.name)}
                </span>
                <span class="badge badge-success">${escapeHTML(pm.status)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    case 'notifications':
      return `
        <div class="space-y-4">
          <h3 class="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">Bildirishnoma sozlamalari</h3>
          <div class="space-y-3 text-xs font-medium text-slate-700">
            <label class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <span>Mahsulot tugaganda ogohlantirish</span>
              <input type="checkbox" checked class="w-4 h-4 text-blue-600 rounded">
            </label>
            <label class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
              <span>Yangi sotuv amalga oshganda Push-bildirishnoma</span>
              <input type="checkbox" checked class="w-4 h-4 text-blue-600 rounded">
            </label>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end">
            <button onclick="showToast('Sozlamalar saqlandi', 'success')" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium active:scale-95">Saqlash</button>
          </div>
        </div>
      `;

    case 'system':
      if (!checkIsStrictDirector()) {
        return `
          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
            <i data-lucide="lock" class="w-4 h-4 text-amber-600"></i>
            <span>Tizim konfiguratsiyasidagi ma'lumotlarni to'liq 0 qilish faqat Bosh Direktor uchun ruxsat etilgan!</span>
          </div>
        `;
      }
      return `
        <div class="space-y-4">
          <h3 class="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">Tizim konfiguratsiyasi & Ma'lumotlarni Tozalash</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Tizim tili</label>
              <input type="text" value="O'zbekcha (Lotin)" disabled class="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Vaqt zonasi</label>
              <input type="text" value="Asia/Tashkent (UTC+5)" disabled class="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500">
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 shadow-xs">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </div>
              <div>
                <h4 class="text-sm font-extrabold text-rose-900">Hammasini 0 qilish (Barcha ma'lumotlarni tozalash)</h4>
                <p class="text-xs text-rose-700 mt-0.5">Tizimdagi barcha tovarlar, sotuvlar, kirim-chiqimlar, mijozlar va barcha yozuvlarni butunlay o'chirib 0 qiladi (Supabase va lokal xotiradan ham).</p>
              </div>
            </div>
            <div class="pt-2">
              <button onclick="triggerWipeAllData()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-rose-500/20 active:scale-95 transition flex items-center gap-2">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i> Hammasini 0 qilish
              </button>
            </div>
          </div>
        </div>
      `;

    default:
      return ``;
  }
}

async function promptAddCategory() {
  const catName = prompt("Yangi kategoriya nomini kiriting:");
  if (catName && catName.trim()) {
    const cleanCat = escapeHTML(catName.trim());
    if (window.categoryService) {
      await window.categoryService.create({ name: cleanCat });
    } else {
      demoData.categories.push({ id: 'cat-' + Date.now(), name: cleanCat });
      if (typeof syncGlobalState === 'function') syncGlobalState();
    }
    showToast(`Kategoriya "${cleanCat}" qo'shildi!`, 'success');
    renderCurrentView();
  }
}

async function promptEditCategory(id, oldName) {
  const newName = prompt("Kategoriya yangi nomini kiriting:", oldName);
  if (newName && newName.trim()) {
    const cleanCat = escapeHTML(newName.trim());
    if (window.categoryService) {
      await window.categoryService.update(id, { name: cleanCat });
    } else {
      const idx = demoData.categories.findIndex(c => c.id === id || c === id);
      if (idx !== -1) {
        if (typeof demoData.categories[idx] === 'object') {
          demoData.categories[idx].name = cleanCat;
        } else {
          demoData.categories[idx] = cleanCat;
        }
        if (typeof syncGlobalState === 'function') syncGlobalState();
      }
    }
    showToast(`Kategoriya "${cleanCat}" ga o'zgartirildi!`, 'success');
    renderCurrentView();
  }
}

function triggerDeleteCategory(id, name) {
  openConfirmModal(
    "Kategoriyani o'chirish",
    `Haqiqatan ham "${name}" kategoriyasini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      if (window.categoryService) {
        await window.categoryService.remove(id);
      } else {
        demoData.categories = demoData.categories.filter(c => c.id !== id && c !== id);
        if (typeof syncGlobalState === 'function') syncGlobalState();
      }
      showToast(`Kategoriya "${name}" o'chirildi`, 'info');
      await renderCurrentView();
    }
  );
}

let deliveryViewMode = 'kanban';
let deliverySearchQuery = '';

function handleDeliveryViewSwitch(mode) {
  deliveryViewMode = mode;
  renderCurrentView();
}

function handleDeliverySearch(query) {
  deliverySearchQuery = (query || '').toLowerCase();
  renderCurrentView();
}

function toggleDeliverySelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.delivery-row-checkbox');
  checkboxes.forEach(cb => { cb.checked = masterCheckbox.checked; });
}

function triggerDeleteSelectedDeliveryOrders() {
  const checkedBoxes = Array.from(document.querySelectorAll('.delivery-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror buyurtmani tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Buyurtmalarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta buyurtmani o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.deliveryId).filter(Boolean);
      if (window.distributionService && window.distributionService.delete) {
        for (const id of selectedIds) {
          await window.distributionService.delete(id);
        }
      } else {
        demoData.distributionOrders = (demoData.distributionOrders || []).filter(o => !selectedIds.includes(o.id));
        if (demoData.distributionOrders.length === 0) {
          try { localStorage.setItem('smartombor_distribution_cleared', 'true'); } catch (e) {}
        }
        syncGlobalState();
      }
      showToast(`${count} ta buyurtma o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}

async function handleDriverSelectChange(orderId, driverName) {
  if (window.distributionService) {
    await window.distributionService.assignDriver(orderId, driverName);
    showToast(`Buyurtmaga haydovchi "${driverName}" biriktirildi`, 'success');
  }
}

function getSystemDriversList() {
  const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
  const userNames = users.map(u => u.full_name || u.name).filter(Boolean);
  const driversList = ((window.demoData && window.demoData.drivers) ? window.demoData.drivers : []).map(d => d.name || d.full_name).filter(Boolean);
  const orderDrivers = ((window.demoData && window.demoData.distributionOrders) ? window.demoData.distributionOrders : []).map(o => o.driverName).filter(Boolean);

  const unique = Array.from(new Set([...userNames, ...driversList, ...orderDrivers]))
    .filter(n => !n.toLowerCase().includes('sardor karimov') && !['sayid', 'devid', 'jek', 'tayinlanmagan', 'biriktirilmagan'].includes(n.toLowerCase()));

  if (!unique.includes('Biriktirilmagan')) {
    unique.push('Biriktirilmagan');
  }
  return unique;
}

function parseOrderDate(dateVal) {
  if (!dateVal) return new Date(0);
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'number') return new Date(dateVal);
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // 1. Try standard Date.parse if ISO or YYYY-MM-DD
    if (trimmed.includes('-')) {
      const nativeParsed = new Date(trimmed);
      if (!isNaN(nativeParsed.getTime())) return nativeParsed;
    }

    // 2. Match DD.MM.YYYY or DD/MM/YYYY with optional time and optional comma (e.g. "09.09.2026, 19:30:00" or "09.09.2026 19:30")
    const match = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:(?:\s*,\s*|\s+)(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const hour = parseInt(match[4] || 0, 10);
      const min = parseInt(match[5] || 0, 10);
      const sec = parseInt(match[6] || 0, 10);
      return new Date(year, month, day, hour, min, sec);
    }

    // 3. Fallback
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

function isOrderArchived(order) {
  if (!order) return false;
  const archivedIds = typeof getArchivedOrderIds === 'function' ? getArchivedOrderIds() : [];
  if (archivedIds.includes(String(order.id)) || archivedIds.includes(String(order.orderNumber))) return true;
  if (order.status === 'arxiv' || order.status === 'archived' || order.isArchived === true) return true;
  if (order.status === 'yetkazildi') {
    const refDate = order.deliveredAt || order.deliveryDate || order.createdAt;
    if (refDate) {
      const orderTime = parseOrderDate(refDate).getTime();
      if (orderTime > 0) {
        const now = Date.now();
        const diffMs = now - orderTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays >= 3) {
          if (typeof saveArchivedOrderId === 'function') {
            saveArchivedOrderId(order.id, order.orderNumber);
          }
          return true;
        }
      }
    }
  }
  return false;
}

function getRemainingArchiveTimeString(refDate) {
  const orderTime = parseOrderDate(refDate).getTime();
  if (orderTime <= 0) return "3k 00:00:00";
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const expireTime = orderTime + threeDaysMs;
  const diffMs = expireTime - Date.now();

  if (diffMs <= 0) return "Arxivlanmoqda...";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}k ${hStr}:${mStr}:${sStr}`;
  }
  return `${hStr}:${mStr}:${sStr}`;
}

let archiveTimerInterval = null;
function startArchiveLiveTimers() {
  if (archiveTimerInterval) clearInterval(archiveTimerInterval);
  archiveTimerInterval = setInterval(() => {
    const timerEls = document.querySelectorAll('.order-archive-timer');
    if (timerEls.length === 0) return;

    let hasExpired = false;
    timerEls.forEach(el => {
      const refDate = el.getAttribute('data-delivered-at');
      const orderId = el.getAttribute('data-order-id');
      const timeStr = getRemainingArchiveTimeString(refDate);
      el.textContent = timeStr;
      if (timeStr.includes('Arxivlanmoqda')) {
        hasExpired = true;
        if (orderId && typeof saveArchivedOrderId === 'function') {
          saveArchivedOrderId(orderId);
        }
      }
    });

    if (hasExpired) {
      if (typeof renderCurrentView === 'function') {
        renderCurrentView();
      }
    }
  }, 1000);
}

// 12. Yetkazib berish (Distribyutsiya) View - Real-time Kanban Board & Table Catalog View
function renderDeliveryView() {
  setTimeout(() => startArchiveLiveTimers(), 50);
  const isDirector = checkIsDirector();
  let orders = (demoData.distributionOrders || []).filter(o => !isOrderArchived(o));
  
  if (deliverySearchQuery) {
    orders = orders.filter(o =>
      (o.orderNumber && o.orderNumber.toLowerCase().includes(deliverySearchQuery)) ||
      (o.customerName && o.customerName.toLowerCase().includes(deliverySearchQuery)) ||
      (o.driverName && o.driverName.toLowerCase().includes(deliverySearchQuery)) ||
      (o.notes && o.notes.toLowerCase().includes(deliverySearchQuery))
    );
  }

  const driversList = getSystemDriversList();

  const statusCols = [
    { key: 'yangi', title: 'Yangi Buyurtmalar', bg: 'bg-blue-50/80', border: 'border-blue-200', text: 'text-blue-700', badgeBg: 'bg-blue-100 text-blue-800' },
    { key: 'yigildi', title: "Omborda Yig'ildi", bg: 'bg-amber-50/80', border: 'border-amber-200', text: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-800' },
    { key: 'yetkazilmoqda', title: 'Yetkazilmoqda (Yo\'lda)', bg: 'bg-purple-50/80', border: 'border-purple-200', text: 'text-purple-700', badgeBg: 'bg-purple-100 text-purple-800' },
    { key: 'yetkazildi', title: "Yetkazildi va To'landi", bg: 'bg-emerald-50/80', border: 'border-emerald-200', text: 'text-emerald-700', badgeBg: 'bg-emerald-100 text-emerald-800' },
    { key: 'bekor_qilindi', title: 'Bekor Qilindi', bg: 'bg-rose-50/80', border: 'border-rose-200', text: 'text-rose-700', badgeBg: 'bg-rose-100 text-rose-800' }
  ];

  const statusBadges = {
    yangi: 'bg-blue-100 text-blue-800 border-blue-200',
    yigildi: 'bg-amber-100 text-amber-800 border-amber-200',
    yetkazilmoqda: 'bg-purple-100 text-purple-800 border-purple-200',
    yetkazildi: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    bekor_qilindi: 'bg-rose-100 text-rose-800 border-rose-200'
  };

  const statusLabels = {
    yangi: 'Yangi',
    yigildi: 'Omborda Yig’ildi',
    yetkazilmoqda: 'Yo\'lda',
    yetkazildi: 'Yetkazildi',
    bekor_qilindi: 'Bekor qilingan'
  };

  return `
    <div class="space-y-6">
      <!-- Control Header -->
      <div class="bg-white rounded-2xl p-5 card-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-lg shadow-blue-500/20">
            <i data-lucide="truck" class="w-6 h-6"></i>
          </div>
          <div>
            <h3 class="text-base font-extrabold text-slate-900">Distribyutsiya va Logistika Katalogi</h3>
            <p class="text-xs text-slate-500">Buyurtmalar holati, kuryerlar biriktiruvi va yetkazish monitoringi</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <!-- Search Bar -->
          <div class="relative min-w-[200px] sm:min-w-[240px]">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" value="${escapeHTML(deliverySearchQuery)}" oninput="handleDeliverySearch(this.value)" placeholder="Buyurtma yoki mijoz qidirish..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <!-- View Mode Switcher -->
          <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onclick="handleDeliveryViewSwitch('kanban')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${deliveryViewMode === 'kanban' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="layout-grid" class="w-3.5 h-3.5"></i> Kanban
            </button>
            <button onclick="handleDeliveryViewSwitch('table')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${deliveryViewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="list" class="w-3.5 h-3.5"></i> Jadval
            </button>
          </div>

          <!-- Delete Batch Button -->
          <button onclick="triggerDeleteSelectedDeliveryOrders()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan buyurtmalarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>

          <!-- Add Order Button -->
          <button onclick="openCreateDistributionModal()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> + Yangi Buyurtma Yaratish
          </button>
        </div>
      </div>

      ${deliveryViewMode === 'kanban' ? `
        <!-- Real-time Kanban Board View -->
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          ${statusCols.map(col => {
            const colOrders = orders.filter(o => o.status === col.key);
            return `
              <div class="rounded-2xl p-4 border ${col.border} ${col.bg} flex flex-col min-h-[550px] space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <h4 class="font-bold text-xs uppercase tracking-wider ${col.text}">${escapeHTML(col.title)}</h4>
                  <span class="px-2 py-0.5 rounded-full text-xs font-extrabold ${col.badgeBg}">${colOrders.length}</span>
                </div>

                <div class="space-y-3 flex-1 overflow-y-auto">
                  ${colOrders.length > 0 ? colOrders.map(ord => `
                    <div onclick="openViewOrderModal('${ord.id}')" class="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 hover:shadow-md hover:border-blue-300 transition space-y-3 cursor-pointer group">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <input type="checkbox" data-delivery-id="${ord.id}" class="delivery-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" onclick="event.stopPropagation()">
                          <span class="text-xs font-black text-blue-600 font-mono group-hover:underline">${escapeHTML(ord.orderNumber)}</span>
                        </div>
                        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                          <button onclick="openInvoiceModal('${ord.id}')" class="p-1 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="📑 Yuk Xati (Nakladnaya)">
                            <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                          </button>
                          <button onclick="printSingleOrderInvoice('${ord.id}')" class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition" title="🖨️ Chop etish (Print)">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                          </button>
                          <button onclick="exportSingleOrderPDF('${ord.id}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="📄 PDF yuklash">
                            <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
                          </button>
                          <button onclick="exportSingleOrderExcel('${ord.id}')" class="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="📊 Excel yuklash (.xlsx)">
                            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      </div>

                      <div>
                        <h5 class="text-sm font-extrabold text-slate-900 leading-tight group-hover:text-blue-600 transition">${escapeHTML(ord.customerName)}</h5>
                        <div class="mt-1.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg w-fit border border-blue-100">
                          <i data-lucide="package" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i>
                          ${(ord.items && ord.items.length > 1) ? `
                            <span class="font-bold text-blue-800">${ord.items.length} xil tovar</span>
                            <span class="text-slate-500 font-medium">(${ord.items.reduce((s, i) => s + (Number(i.qty || i.quantity || 1)), 0)} ta):</span>
                            <span class="truncate max-w-[180px] text-slate-700 text-[11px] font-normal">${escapeHTML(ord.items.map(i => `${i.productName || i.name} (${i.qty || i.quantity || 1})`).join(', '))}</span>
                          ` : `
                            <span class="truncate max-w-[200px]">${escapeHTML((ord.items && ord.items[0] && (ord.items[0].productName || ord.items[0].name)) ? (ord.items[0].productName || ord.items[0].name) : (ord.productName || 'Tovar'))}</span>
                            <span class="text-slate-500 font-bold">(${(ord.items && ord.items[0] && (ord.items[0].qty || ord.items[0].quantity)) || ord.distQty || 1} dona)</span>
                          `}
                        </div>
                        <p class="text-xs text-slate-500 mt-1 leading-snug">${escapeHTML(ord.notes || 'Izohsiz')}</p>
                      </div>

                      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span class="text-slate-500 font-medium">Jami summa:</span>
                        <span class="font-black text-emerald-600">${ord.totalAmount ? ord.totalAmount.toLocaleString('uz-UZ') : 0} UZS</span>
                      </div>

                      <!-- Quick Driver Assignment Dropdown -->
                      <div class="bg-slate-50 p-2 rounded-xl border border-slate-200/70 space-y-1" onclick="event.stopPropagation()">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Haydovchi (Kuryer):</label>
                        <select onchange="handleDriverSelectChange('${ord.id}', this.value)" class="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          ${driversList.map(d => `<option value="${escapeHTML(d)}" ${ord.driverName === d ? 'selected' : ''}>${escapeHTML(d)}</option>`).join('')}
                        </select>
                      </div>

                      <!-- Workflow Transitions -->
                      <div class="pt-2 border-t border-slate-100 flex flex-col gap-1.5" onclick="event.stopPropagation()">
                        ${col.key === 'yangi' ? `
                          <button onclick="changeOrderStatus('${ord.id}', 'yigildi')" class="w-full py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition">
                            Omborda yig'ildi <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                        ${col.key === 'yigildi' ? `
                          <button onclick="changeOrderStatus('${ord.id}', 'yetkazilmoqda')" class="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition">
                            Yetkazishga yuborish <i data-lucide="truck" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                        ${col.key === 'yetkazilmoqda' ? `
                          <button onclick="changeOrderStatus('${ord.id}', 'yetkazildi')" class="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition">
                            Topshirildi va to'landi <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                        ${col.key === 'yetkazildi' ? `
                          <div class="flex items-center justify-between text-[10px] text-emerald-700 bg-emerald-50/90 px-2.5 py-1 rounded-xl border border-emerald-100">
                            <span class="flex items-center gap-1 font-semibold">
                              <i data-lucide="clock" class="w-3 h-3 text-emerald-600"></i>
                              <span class="order-archive-timer font-bold" data-delivered-at="${escapeHTML(ord.deliveredAt || ord.createdAt || '')}" data-order-id="${ord.id || ord.orderNumber}">3 kun</span>
                            </span>
                            <button onclick="triggerManualArchiveOrder('${ord.id || ord.orderNumber}')" class="text-indigo-600 hover:text-indigo-800 hover:underline font-bold" title="Muddatidan oldin arxivga o'tkazish">Arxivga &rarr;</button>
                          </div>
                        ` : ''}
                        ${col.key !== 'bekor_qilindi' ? `
                          <button onclick="handleCancelOrder('${ord.id}')" class="w-full py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-semibold text-center transition flex items-center justify-center gap-1">
                            <i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Bekor qilish
                          </button>
                        ` : ''}
                        ${col.key === 'bekor_qilindi' ? `
                          <button onclick="changeOrderStatus('${ord.id}', 'yangi')" class="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition">
                            Qayta tiklash <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  `).join('') : `
                    <div class="h-32 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200/80 rounded-2xl p-4">
                      <i data-lucide="inbox" class="w-6 h-6 mb-1 opacity-50"></i>
                      <span class="text-xs font-medium">Buyurtma yo'q</span>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <!-- Table Catalog View -->
        <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
          ${orders.length > 0 ? `
            <div class="overflow-x-auto">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th class="w-10">
                      <input type="checkbox" onchange="toggleDeliverySelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                    </th>
                    <th>Buyurtma №</th>
                    <th>Mijoz Nomi</th>
                    <th>Haydovchi (Kuryer)</th>
                    <th>Ombor</th>
                    <th>Summa</th>
                    <th>Holat</th>
                    <th>Sana</th>
                    <th class="text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(ord => `
                    <tr onclick="openViewOrderModal('${ord.id}')" class="cursor-pointer hover:bg-slate-50/80 transition">
                      <td class="w-10" onclick="event.stopPropagation()">
                        <input type="checkbox" data-delivery-id="${ord.id}" class="delivery-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                      </td>
                      <td class="font-mono font-bold text-blue-600 whitespace-nowrap hover:underline">${escapeHTML(ord.orderNumber)}</td>
                      <td>
                        <div>
                          <p class="font-bold text-slate-900 text-xs">${escapeHTML(ord.customerName)}</p>
                          <p class="text-[11px] font-semibold text-blue-600 flex items-center gap-1 mt-0.5">
                            <i data-lucide="package" class="w-3.5 h-3.5 shrink-0"></i>
                            ${(ord.items && ord.items.length > 1) ? `
                              <span class="font-bold text-blue-800">${ord.items.length} xil tovar:</span>
                              <span class="truncate max-w-[220px] text-slate-600 font-normal">${escapeHTML(ord.items.map(i => `${i.productName || i.name} (${i.qty || i.quantity || 1})`).join(', '))}</span>
                            ` : `
                              <span class="truncate max-w-[180px]">${escapeHTML((ord.items && ord.items[0] && (ord.items[0].productName || ord.items[0].name)) ? (ord.items[0].productName || ord.items[0].name) : (ord.productName || '-'))}</span>
                              ${(ord.items && ord.items[0] && ord.items[0].qty) ? `<span class="text-slate-400 font-normal">(${ord.items[0].qty}x)</span>` : ''}
                            `}
                          </p>
                          <p class="text-[10px] text-slate-400 truncate max-w-xs">${escapeHTML(ord.notes || '-')}</p>
                        </div>
                      </td>
                      <td onclick="event.stopPropagation()">
                        <select onchange="handleDriverSelectChange('${ord.id}', this.value)" class="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          ${driversList.map(d => `<option value="${escapeHTML(d)}" ${ord.driverName === d ? 'selected' : ''}>${escapeHTML(d)}</option>`).join('')}
                        </select>
                      </td>
                      <td class="text-xs text-slate-600 whitespace-nowrap">${escapeHTML(ord.warehouseName || 'Asosiy Ombor')}</td>
                      <td class="font-black text-emerald-600 whitespace-nowrap">${ord.totalAmount ? ord.totalAmount.toLocaleString('uz-UZ') : 0} UZS</td>
                      <td>
                        <span class="badge ${statusBadges[ord.status] || 'badge-neutral'}">
                          ${escapeHTML(statusLabels[ord.status] || ord.status)}
                        </span>
                      </td>
                      <td class="text-xs text-slate-500 font-mono whitespace-nowrap">${escapeHTML(ord.createdAt || '-')}</td>
                      <td class="text-right whitespace-nowrap" onclick="event.stopPropagation()">
                        <div class="flex items-center justify-end gap-1.5">
                          ${ord.status !== 'bekor_qilindi' ? `
                            <button onclick="handleCancelOrder('${ord.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="Bekor qilish (Vozvrat)"><i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Bekor qilish</button>
                          ` : ''}
                          <button onclick="openInvoiceModal('${ord.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition active:scale-95" title="📑 Yuk Xati (Nakladnaya)"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> Hujjat</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ${renderPagination(orders.length, 1, 10)}
          ` : renderEmptyState('Buyurtmalar topilmadi', 'Yangi buyurtma rasmiylashtirish uchun "+ Yangi Buyurtma Yaratish" tugmasini bosing', 'truck', '+ Yangi Buyurtma Yaratish', 'openCreateDistributionModal()')}
        </div>
      `}
    </div>
  `;
}

async function changeOrderStatus(id, newStatus) {
  const res = await distributionService.updateStatus(id, newStatus);
  if (res.success) {
    if (newStatus === 'bekor_qilindi') {
      showToast(`Buyurtma bekor qilindi va avtomatik Vozvrat bo'limiga qo'shildi!`, 'warning');
    } else {
      showToast(`Buyurtma statusi "${newStatus}" ga o'zgartirildi!`, 'success');
    }
    await renderCurrentView();
  }
}

function handleCancelOrder(orderId) {
  const ord = (demoData.distributionOrders || []).find(o => o.id === orderId || o.orderNumber === orderId);
  const ordNum = ord ? ord.orderNumber : orderId;
  openConfirmModal(
    "Buyurtmani bekor qilish",
    `Haqiqatan ham ${ordNum} buyurtmasini bekor qilmoqchimisiz?\n\nBuyurtma "Bekor Qilindi" ustuniga o'tkaziladi, tovarlar avtomatik Vozvrat (Qaytarilganlar) ro'yxatiga qo'shiladi va ombor qoldig'i tiklanadi.`,
    async () => {
      await changeOrderStatus(orderId, 'bekor_qilindi');
    }
  );
}

function triggerDeleteDistributionOrder(id, orderNumber) {
  openConfirmModal(
    "Buyurtmani o'chirish",
    `Haqiqatan ham ${orderNumber} buyurtmasini o'chirmoqchimisiz? Ma'lumot serverdan ham o'chiriladi.`,
    async () => {
      if (window.distributionService && window.distributionService.delete) {
        await window.distributionService.delete(id, orderNumber);
      } else {
        demoData.distributionOrders = (demoData.distributionOrders || []).filter(o => o.id !== id && o.orderNumber !== orderNumber);
        if (demoData.distributionOrders.length === 0) {
          try { localStorage.setItem('smartombor_distribution_cleared', 'true'); } catch (e) {}
        }
        syncGlobalState();
      }
      showToast(`Buyurtma ${orderNumber} o'chirildi`, 'error');
      await renderCurrentView();
    }
  );
}

function toggleReturnsSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.return-row-checkbox');
  checkboxes.forEach(cb => { cb.checked = masterCheckbox.checked; });
}

function triggerDeleteSelectedReturns() {
  const checkedBoxes = Array.from(document.querySelectorAll('.return-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror vozvratni tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Vozvratlarni o'chirish",
    `Haqiqatan ham tanlangan ${count} ta vozvrat hujjatini o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.returnId).filter(Boolean);
      if (window.returnService && window.returnService.delete) {
        for (const id of selectedIds) {
          await window.returnService.delete(id);
        }
      } else {
        demoData.orderReturns = (demoData.orderReturns || []).filter(r => !selectedIds.includes(r.id));
        syncGlobalState();
      }
      showToast(`${count} ta vozvrat o'chirildi!`, 'info');
      await renderCurrentView();
    }
  );
}

function triggerDeleteReturn(id, returnNumber) {
  openConfirmModal(
    "Vozvratni o'chirish",
    `Haqiqatan ham ${returnNumber} vozvrat hujjatini o'chirmoqchimisiz? Ma'lumot serverdan ham o'chiriladi.`,
    async () => {
      if (window.returnService && window.returnService.delete) {
        await window.returnService.delete(id);
      } else {
        demoData.orderReturns = (demoData.orderReturns || []).filter(r => r.id !== id && r.returnNumber !== returnNumber);
        syncGlobalState();
      }
      showToast(`Vozvrat ${returnNumber} o'chirildi`, 'error');
      await renderCurrentView();
    }
  );
}

// 13. Qaytarilganlar (Vozvrat) View
function renderReturnsView() {
  const isDirector = checkIsDirector();

  // Ensure any cancelled distribution orders are synced to demoData.orderReturns
  if (!demoData.orderReturns) demoData.orderReturns = [];
  const cancelledOrders = (demoData.distributionOrders || []).filter(o => o && o.status === 'bekor_qilindi');
  let hasNewSync = false;
  for (const ord of cancelledOrders) {
    const alreadyExists = demoData.orderReturns.some(r => r.orderNumber === ord.orderNumber);
    if (!alreadyExists) {
      const items = (ord.items && Array.isArray(ord.items) && ord.items.length > 0) ? ord.items : [
        {
          productId: ord.productId || null,
          productName: ord.productName || 'Tovar',
          qty: ord.distQty || ord.quantity || 1,
          price: ord.totalAmount || 0,
          total: ord.totalAmount || 0
        }
      ];
      for (const it of items) {
        const pQty = Math.max(1, Number(it.qty || it.quantity || 1));
        const pPrice = Number(it.price || (it.total ? it.total / pQty : (ord.totalAmount ? ord.totalAmount / pQty : 0)));
        const refundAmt = Number(it.total || (pPrice * pQty) || ord.totalAmount || 0);

        demoData.orderReturns.unshift({
          id: typeof generateUniqueId === 'function' ? generateUniqueId('return') : ('ret-' + Math.floor(1000 + Math.random() * 9000)),
          returnNumber: 'RET-2026-' + Math.floor(5000 + Math.random() * 4000),
          customerName: ord.customerName || 'Mijoz',
          orderNumber: ord.orderNumber || 'ORD-2026',
          productName: it.productName || it.name || ord.productName || 'Tovar',
          quantity: pQty,
          refundAmount: refundAmt,
          reason: 'bekor_qilindi',
          reasonLabel: 'Buyurtma bekor qilindi',
          status: 'qabul_qilindi',
          driverName: ord.driverName && ord.driverName !== 'Tayinlanmagan' ? ord.driverName : 'Biriktirilmagan',
          createdAt: ord.createdAt || new Date().toLocaleString('uz-UZ')
        });
      }
      hasNewSync = true;
    }
  }
  if (hasNewSync) {
    try { localStorage.removeItem('smartombor_returns_cleared'); } catch(e) {}
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
  }

  const returns = demoData.orderReturns || [];
  const totalRefund = returns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
  const brakCount = returns.filter(r => r.reason === 'nuqsonli').length;
  const expiredCount = returns.filter(r => r.reason === 'muddati_otgan').length;

  return `
    <div class="space-y-6">
      <!-- Control Header -->
      <div class="bg-white rounded-2xl p-5 card-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Qaytarilgan Tovarlar (Vozvrat) Jurnali</h3>
            <p class="text-xs text-slate-500">Mijozlardan qaytgan brak va muddati o'tgan tovarlar tahlili</p>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <button onclick="triggerDeleteSelectedReturns()" class="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan vozvratlarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
          <button onclick="openCreateReturnModal()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl flex items-center gap-2 shadow-sm active:scale-95">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> + Tovar Qaytarish (Vozvrat)
          </button>
        </div>
      </div>

      <!-- Summary KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-5 card-shadow flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase">Jami Vozvratlar</p>
            <p class="text-xl font-extrabold text-slate-900 mt-1">${returns.length} ta bitim</p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase">Qaytarilgan Summa</p>
            <p class="text-xl font-extrabold text-rose-600 mt-1">${totalRefund.toLocaleString('uz-UZ')} UZS</p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <i data-lucide="banknote" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase">Nuqsonli (Brak)</p>
            <p class="text-xl font-extrabold text-amber-600 mt-1">${brakCount} ta tovar</p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 card-shadow flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase">Muddati O'tgan</p>
            <p class="text-xl font-extrabold text-purple-600 mt-1">${expiredCount} ta tovar</p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <div class="w-5 h-5 flex items-center justify-center font-bold">!</div>
          </div>
        </div>
      </div>

      <!-- Returns Table -->
      <div class="bg-white rounded-2xl p-5 card-shadow space-y-4">
        ${returns.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th class="w-10 pb-3 px-3">
                    <input type="checkbox" onchange="toggleReturnsSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                  </th>
                  <th class="pb-3 px-3">Vozvrat №</th>
                  <th class="pb-3 px-3">Sana</th>
                  <th class="pb-3 px-3">Mijoz</th>
                  <th class="pb-3 px-3">Tovar Nomi</th>
                  <th class="pb-3 px-3">Miqdor</th>
                  <th class="pb-3 px-3">Sabab</th>
                  <th class="pb-3 px-3">Qaytarilgan Summa</th>
                  <th class="pb-3 px-3">Mas'ul Haydovchi</th>
                  <th class="pb-3 px-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${returns.map(ret => {
                  let badgeClass = 'badge-secondary';
                  if (ret.reason === 'muddati_otgan') badgeClass = 'badge-danger';
                  if (ret.reason === 'nuqsonli') badgeClass = 'badge-warning';
                  if (ret.reason === 'ortiqcha_tovar') badgeClass = 'badge-success';
                  if (ret.reason === 'bekor_qilindi') badgeClass = 'badge-danger';

                  return `
                    <tr class="hover:bg-slate-50/80 transition">
                      <td class="w-10 py-3 px-3">
                        <input type="checkbox" data-return-id="${ret.id}" class="return-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                      </td>
                      <td class="py-3 px-3 font-mono font-bold text-rose-600 text-xs">${escapeHTML(ret.returnNumber)}</td>
                      <td class="py-3 px-3 text-xs text-slate-500">${escapeHTML(ret.createdAt)}</td>
                      <td class="py-3 px-3 font-bold text-slate-900">${escapeHTML(ret.customerName)}</td>
                      <td class="py-3 px-3 font-medium text-slate-700">${escapeHTML(ret.productName)}</td>
                      <td class="py-3 px-3 font-bold text-slate-800">${ret.quantity} dona</td>
                      <td class="py-3 px-3"><span class="badge ${badgeClass}">${escapeHTML(ret.reasonLabel || ret.reason)}</span></td>
                      <td class="py-3 px-3 font-extrabold text-rose-600">${(ret.refundAmount || 0).toLocaleString('uz-UZ')} UZS</td>
                      <td class="py-3 px-3 text-xs text-slate-600">${escapeHTML(ret.driverName || 'Biriktirilmagan')}</td>
                      <td class="py-3 px-3 text-right whitespace-nowrap">
                        <span class="text-xs text-slate-400 font-mono">ID: ${escapeHTML(ret.id)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Qaytarilgan tovarlar mavjud emas", "Mijozdan qaytgan tovarni kiritish uchun '+ Tovar Qaytarish' tugmasini bosing", "rotate-ccw", "+ Tovar Qaytarish", "openCreateReturnModal()")}
      </div>
    </div>
  `;
}

// 14. Arxiv (Archive) View - 3 kunlik avto-arxiv va yetkazilgan buyurtmalar arxivi
let archiveSearchQuery = '';

function handleArchiveSearch(query) {
  archiveSearchQuery = (query || '').toLowerCase().trim();
  const container = document.getElementById('main-content');
  if (container) {
    container.innerHTML = renderArchiveView();
    if (window.lucide) lucide.createIcons();
  }
}

function toggleArchiveSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.archive-row-checkbox');
  checkboxes.forEach(cb => { cb.checked = masterCheckbox.checked; });
}

function triggerDeleteSelectedArchiveOrders() {
  const checkedBoxes = Array.from(document.querySelectorAll('.archive-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror buyurtmani tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Arxiv buyurtmalarini o'chirish",
    `Haqiqatan ham tanlangan ${count} ta arxivlangan buyurtmani o'chirmoqchimisiz? Serverdan ham o'chiriladi.`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.archiveId).filter(Boolean);
      for (const id of selectedIds) {
        if (typeof removeArchivedOrderId === 'function') {
          removeArchivedOrderId(id);
        }
        if (window.distributionService && window.distributionService.delete) {
          await window.distributionService.delete(id);
        }
      }
      demoData.distributionOrders = (demoData.distributionOrders || []).filter(o => !selectedIds.includes(o.id) && !selectedIds.includes(o.orderNumber));
      saveStateToLocalStorage();
      syncGlobalState();
      showToast(`${count} ta buyurtma arxivdan o'chirildi`, 'success');
      await renderCurrentView();
    }
  );
}

function triggerRestoreArchiveOrder(id, orderNumber) {
  openConfirmModal(
    "Buyurtmani arxivdan qaytarish",
    `Haqiqatan ham ${orderNumber} buyurtmasini arxivdan chiqarib, Yetkazib berish ro'yxatiga qaytarmoqchimisiz?`,
    async () => {
      if (typeof removeArchivedOrderId === 'function') {
        removeArchivedOrderId(id, orderNumber);
      }
      const ord = (demoData.distributionOrders || []).find(o => o.id === id || o.orderNumber === id || String(o.id) === String(id) || String(o.orderNumber) === String(orderNumber));
      if (ord) {
        ord.status = 'yetkazildi';
        ord.isArchived = false;
        ord.deliveredAt = new Date().toISOString();
        if (window.distributionService && window.distributionService.updateStatus) {
          await window.distributionService.updateStatus(ord.id, 'yetkazildi');
        }
        saveStateToLocalStorage();
        syncGlobalState();
      }
      showToast(`${orderNumber} buyurtmasi arxivdan faol ro'yxatga qaytarildi!`, 'success');
      await renderCurrentView();
    }
  );
}

async function triggerManualArchiveOrder(id) {
  const ord = (demoData.distributionOrders || []).find(o => o.id === id || o.orderNumber === id || String(o.id) === String(id));
  if (ord) {
    ord.status = 'arxiv';
    ord.isArchived = true;
    if (typeof saveArchivedOrderId === 'function') {
      saveArchivedOrderId(ord.id, ord.orderNumber);
    }
    if (window.distributionService && window.distributionService.updateStatus) {
      await window.distributionService.updateStatus(ord.id, 'arxiv');
    }
    saveStateToLocalStorage();
    syncGlobalState();
    showToast(`${ord.orderNumber} buyurtmasi Arxivga o'tkazildi!`, 'info');
    await renderCurrentView();
  }
}

function exportArchiveExcel() {
  const allOrders = demoData.distributionOrders || [];
  let archivedList = allOrders.filter(o => isOrderArchived(o));
  if (archivedList.length === 0) {
    showToast("Eksport qilish uchun arxivlangan buyurtmalar mavjud emas!", 'warning');
    return;
  }
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Buyurtma No,Ombor,Mijoz,Ekspeditor,Shtat (Agent),Chegirma,Sana va Vaqt,Valyuta,Summa (UZS)\n";
  archivedList.forEach(o => {
    const wh = (o.warehouseName || 'Toshkent Viloyati').replace(/"/g, '""');
    const cust = (o.customerName || 'Mijoz').replace(/"/g, '""');
    const drv = ((o.driverName && !o.driverName.includes('Sardor Karimov')) ? o.driverName : 'Biriktirilmagan').replace(/"/g, '""');
    const agt = ((o.agentName || 'FAYZ').replace(/\s*\([^)]*\)/g, '').trim() || 'FAYZ').replace(/"/g, '""');
    const disc = o.hasDiscount ? 'Ha' : 'Yo\'q';
    const dt = (o.createdAt || '-').replace(/"/g, '""');
    const sum = parseNumClean(o.totalAmount || o.amount);
    csvContent += `"${o.orderNumber}","${wh}","${cust}","${drv}","${agt}","${disc}","${dt}","O'zbek so'mi",${sum}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Arxiv_Buyurtmalar_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Arxiv buyurtmalari Excel (.csv) formatida yuklab olindi!", 'success');
}

function renderArchiveView() {
  const isDirector = checkIsDirector();
  const allOrders = demoData.distributionOrders || [];
  let archivedList = allOrders.filter(o => isOrderArchived(o));

  if (archiveSearchQuery) {
    archivedList = archivedList.filter(o =>
      (o.orderNumber && o.orderNumber.toLowerCase().includes(archiveSearchQuery)) ||
      (o.customerName && o.customerName.toLowerCase().includes(archiveSearchQuery)) ||
      (o.driverName && o.driverName.toLowerCase().includes(archiveSearchQuery)) ||
      (o.agentName && o.agentName.toLowerCase().includes(archiveSearchQuery)) ||
      (o.warehouseName && o.warehouseName.toLowerCase().includes(archiveSearchQuery)) ||
      (o.notes && o.notes.toLowerCase().includes(archiveSearchQuery))
    );
  }

  const totalSum = archivedList.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

  return `
    <div class="space-y-6 animate-in fade-in duration-200">
      <!-- Control Header -->
      <div class="bg-white rounded-2xl p-5 card-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-500/20">
            <i data-lucide="archive" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-extrabold text-slate-900">Arxiv (Yetkazilgan buyurtmalar)</h3>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                3 kunlik avto-arxiv
              </span>
            </div>
            <p class="text-xs text-slate-500">Yetkazilgan va to'langan buyurtmalar jurnali</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <!-- Search Input -->
          <div class="relative min-w-[200px] sm:min-w-[280px]">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" value="${escapeHTML(archiveSearchQuery)}" oninput="handleArchiveSearch(this.value)" placeholder="Qidiruv... / Qidiruv..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- Excel Export -->
          <button onclick="exportArchiveExcel()" class="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Excel formatida yuklab olish">
            <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> Excel
          </button>

          <!-- Delete Selected Button -->
          <button onclick="triggerDeleteSelectedArchiveOrders()" class="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan buyurtmalarni o'chirish">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
          </button>
        </div>
      </div>

      <!-- Archive Table Container -->
      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${archivedList.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th class="w-10 p-3.5 text-center">
                    <input type="checkbox" onchange="toggleArchiveSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                  </th>
                  <th class="p-3.5">Ombor</th>
                  <th class="p-3.5">Mijoz</th>
                  <th class="p-3.5">Ekspeditor</th>
                  <th class="p-3.5">Shtat (Agent)</th>
                  <th class="p-3.5 text-center">Chegirma</th>
                  <th class="p-3.5">Buyurtma sanasi va vaqti</th>
                  <th class="p-3.5">Valyuta</th>
                  <th class="p-3.5 text-right font-black">Summa</th>
                  <th class="p-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${archivedList.map(ord => {
                  const wh = ord.warehouseName || 'Asosiy Ombor';
                  const cleanAgent = (ord.agentName || 'FAYZ').replace(/\s*\([^)]*\)/g, '').trim() || 'FAYZ';
                  const cleanDriver = (ord.driverName && !ord.driverName.includes('Sardor Karimov')) ? ord.driverName : 'Biriktirilmagan';
                  const hasDisc = ord.hasDiscount || false;

                  return `
                    <tr class="hover:bg-slate-50/90 transition cursor-pointer group" onclick="openViewOrderModal('${ord.id}')">
                      <td class="w-10 p-3.5 text-center" onclick="event.stopPropagation()">
                        <input type="checkbox" data-archive-id="${ord.id}" class="archive-row-checkbox w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                      </td>
                      <td class="p-3.5 text-slate-700 whitespace-nowrap font-medium">${escapeHTML(wh)}</td>
                      <td class="p-3.5 font-bold text-slate-900 whitespace-nowrap group-hover:text-indigo-600 transition">
                        ${escapeHTML(ord.customerName)}
                        <span class="block text-[10px] font-mono text-slate-400 font-normal">${escapeHTML(ord.orderNumber)}</span>
                      </td>
                      <td class="p-3.5 text-slate-700 whitespace-nowrap font-medium">${escapeHTML(cleanDriver)}</td>
                      <td class="p-3.5 text-slate-700 whitespace-nowrap font-semibold">${escapeHTML(cleanAgent)}</td>
                      <td class="p-3.5 text-center whitespace-nowrap">
                        ${hasDisc ? `
                          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Ha</span>
                        ` : `
                          <span class="text-slate-400 text-xs font-normal">Yo'q</span>
                        `}
                      </td>
                      <td class="p-3.5 text-slate-600 whitespace-nowrap font-mono text-[11px]">${escapeHTML(ord.createdAt || '-')}</td>
                      <td class="p-3.5 text-slate-600 whitespace-nowrap">O'zbek so'mi</td>
                      <td class="p-3.5 text-right font-black text-slate-900 whitespace-nowrap text-sm">
                        ${(Number(ord.totalAmount) || 0).toLocaleString('uz-UZ')} UZS
                      </td>
                      <td class="p-3.5 text-right whitespace-nowrap" onclick="event.stopPropagation()">
                        <div class="flex items-center justify-end gap-1">
                          <button onclick="openInvoiceModal('${ord.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition" title="📑 Yuk Xati (Nakladnaya)">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                          </button>
                          <button onclick="printSingleOrderInvoice('${ord.id}')" class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition" title="🖨️ Chop etish">
                            <i data-lucide="printer" class="w-4 h-4"></i>
                          </button>
                          <button onclick="triggerRestoreArchiveOrder('${ord.id}', '${ord.orderNumber}')" class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition" title="Faol yetkazishga qayta tiklash">
                            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Bottom Footer Bar (Exact match to screenshot) -->
          <div class="p-4 bg-slate-50/90 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
            <div class="flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <span class="text-slate-500">Buyurtmalar soni:</span>
                <strong class="text-slate-900 font-extrabold ml-1">${archivedList.length}</strong>
              </div>
              <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>
              <div>
                <span class="text-slate-500">Jami summa (O'zbek so'mi):</span>
                <strong class="text-emerald-700 font-black ml-1">${totalSum.toLocaleString('uz-UZ')} UZS</strong>
              </div>
              <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>
              <div>
                <span class="text-slate-500">Jami brutto og'irlik:</span>
                <span class="text-slate-400 ml-1 font-mono">—</span>
              </div>
              <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>
              <div>
                <span class="text-slate-500">Jami netto og'irlik:</span>
                <span class="text-slate-400 ml-1 font-mono">—</span>
              </div>
            </div>

            <div class="flex items-center gap-2 font-semibold text-slate-500">
              <span>Sahifa: 1 / 1</span>
            </div>
          </div>
        ` : renderEmptyState("Arxivlangan buyurtmalar mavjud emas", "Yetkazilgan va to'langan buyurtmalar 3 kundan so'ng avtomatik tarzda ushbu arxivga o'tkaziladi", "archive", "Yetkazib berishga o'tish", "navigateTo('delivery')")}
      </div>
    </div>
  `;
}

/* FOYDALANUVCHILAR VA XODIMLAR MONITORING VIEW */
let selectedUserRoleFilter = 'all';
let userSearchQuery = '';

function handleUserRoleFilter(val) {
  selectedUserRoleFilter = val;
  renderCurrentView();
}

function handleUserSearch(val) {
  userSearchQuery = val;
  renderCurrentView();
}

function getUserPasswordHelper(userItem) {
  if (window.userPasswordStore && userItem) {
    return window.userPasswordStore.getPasswordForUser(userItem.id || userItem.email || userItem.full_name);
  }
  return '123456';
}

function toggleUserPasswordVisibility(id) {
  const span = document.getElementById('pass-val-' + id);
  const icon = document.getElementById('pass-icon-' + id);
  if (!span) return;

  const rawPass = span.getAttribute('data-pass') || '••••••';
  if (span.textContent === '••••••') {
    span.textContent = rawPass;
    span.classList.remove('tracking-widest');
    span.classList.add('font-bold', 'text-blue-700', 'bg-blue-50', 'px-1.5', 'py-0.5', 'rounded');
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    span.textContent = '••••••';
    span.classList.add('tracking-widest');
    span.classList.remove('font-bold', 'text-blue-700', 'bg-blue-50', 'px-1.5', 'py-0.5', 'rounded');
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function triggerUnblockUser(id, name) {
  try {
    const map = JSON.parse(localStorage.getItem('smartombor_failed_login_counts') || '{}');
    delete map[id.toLowerCase()];
    delete map[name.toLowerCase()];
    localStorage.setItem('smartombor_failed_login_counts', JSON.stringify(map));
    showToast(`Xodim "${name}" hisobi muvaffaqiyatli blokdan chiqarildi!`, 'success');
    renderCurrentView();
  } catch(e) {}
}

function toggleUserSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.user-row-checkbox');
  checkboxes.forEach(cb => { cb.checked = masterCheckbox.checked; });
}

function triggerDeleteSelectedUsers() {
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const role = currentUser ? (currentUser.role || 'agent').toLowerCase() : 'agent';

  if (role !== 'admin' && role !== 'director') {
    showToast("Xodimlarni o'chirish faqat Direktor huquqiga ega foydalanuvchilar uchun!", 'error');
    return;
  }

  const checkedBoxes = Array.from(document.querySelectorAll('.user-row-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast("O'chirish uchun avval biror xodimni tanlang (checkbox belgilang)!", 'warning');
    return;
  }
  const count = checkedBoxes.length;
  openConfirmModal(
    "Xodimlarni tizimdan o'chirish",
    `Haqiqatan ham tanlangan ${count} ta xodimni BUTUN TIZIMDAN va ma'lumotlar bazasidan mutlaqo o'chirmoqchimisiz?`,
    async () => {
      const selectedIds = checkedBoxes.map(cb => cb.dataset.userId).filter(Boolean);
      let selfDeleted = false;
      if (window.userService) {
        for (const id of selectedIds) {
          if (currentUser && (currentUser.id === id || currentUser.customId === id || currentUser.uuid === id)) {
            selfDeleted = true;
          }
          await window.userService.delete(id);
        }
      } else {
        demoData.users = (demoData.users || []).filter(u => !selectedIds.includes(u.id));
        syncGlobalState();
      }

      if (selfDeleted && window.authService) {
        await window.authService.logout();
      } else {
        showToast(`${count} ta xodim o'chirildi!`, 'info');
        await renderCurrentView();
      }
    }
  );
}

function renderUsersView() {
  const isDirector = checkIsDirector();
  const allUsers = (window.demoData && window.demoData.users) ? window.demoData.users : (typeof demoData !== 'undefined' && demoData.users ? demoData.users : []);
  let users = [...allUsers];

  if (selectedUserRoleFilter !== 'all') {
    users = users.filter(u => u.role === selectedUserRoleFilter);
  }

  if (userSearchQuery) {
    const query = userSearchQuery.toLowerCase();
    users = users.filter(u =>
      (u.full_name && u.full_name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.roleLabel && u.roleLabel.toLowerCase().includes(query))
    );
  }

  const roleBadges = {
    admin: 'bg-rose-100 text-rose-800 border-rose-200',
    director: 'bg-rose-100 text-rose-800 border-rose-200',
    driver: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    supervisor: 'bg-purple-100 text-purple-800 border-purple-200',
    warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
    agent: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const failedMap = (() => {
    try { return JSON.parse(localStorage.getItem('smartombor_failed_login_counts') || '{}'); }
    catch(e) { return {}; }
  })();

  return `
    <div class="space-y-6">
      <!-- Top Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Jami xodimlar</p>
            <h3 class="text-2xl font-black text-slate-900">${allUsers.length} kishi</h3>
          </div>
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <i data-lucide="users" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Savdo agentlari</p>
            <h3 class="text-2xl font-black text-blue-600">${allUsers.filter(u => u.role === 'agent').length} kishi</h3>
          </div>
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <i data-lucide="user-check" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Omborchilar</p>
            <h3 class="text-2xl font-black text-amber-600">${allUsers.filter(u => u.role === 'warehouse').length} kishi</h3>
          </div>
          <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <i data-lucide="warehouse" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Haydovchilar</p>
            <h3 class="text-2xl font-black text-emerald-600">${allUsers.filter(u => u.role === 'driver' || u.role === 'kuryer').length} kishi</h3>
          </div>
          <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <i data-lucide="truck" class="w-6 h-6"></i>
          </div>
        </div>
      </div>

      <!-- Action Bar & Filter -->
      <div class="bg-white rounded-2xl p-4 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div class="relative flex-1 w-full">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" value="${escapeHTML(userSearchQuery)}" oninput="handleUserSearch(this.value)" placeholder="Xodimlarni qidirish (ism-sharif)..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <select onchange="handleUserRoleFilter(this.value)" class="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
            <option value="all" ${selectedUserRoleFilter === 'all' ? 'selected' : ''}>Barcha rollar</option>
            <option value="agent" ${selectedUserRoleFilter === 'agent' ? 'selected' : ''}>Agent (Savdo Agenti)</option>
            <option value="driver" ${selectedUserRoleFilter === 'driver' ? 'selected' : ''}>Driver (Haydovchi)</option>
            <option value="warehouse" ${selectedUserRoleFilter === 'warehouse' ? 'selected' : ''}>Warehouse (Omborchi)</option>
            <option value="director" ${selectedUserRoleFilter === 'director' ? 'selected' : ''}>Director (Direktor)</option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          ${isDirector ? `
            <button onclick="triggerDeleteSelectedUsers()" class="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs" title="Tanlangan xodimlarni o'chirish">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> O'chirish
            </button>
            <button onclick="openCreateEmployeeModal()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition shrink-0 active:scale-95 shadow-md shadow-blue-500/20">
              <i data-lucide="user-plus" class="w-4 h-4"></i> + Yangi xodim qo‘shish
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Users Table -->
      <div class="bg-white rounded-2xl card-shadow overflow-hidden flex flex-col justify-between">
        ${users.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="custom-table">
              <thead>
                <tr>
                  <th class="w-10">
                    <input type="checkbox" onchange="toggleUserSelectAll(this)" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                  </th>
                  <th>Xodim Ismi</th>
                  <th>Rol (Role)</th>
                  <th>Parol (Password)</th>
                  <th>Ro'yxatdan o'tgan sana</th>
                  <th>Holat</th>
                  <th class="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => {
                  const passVal = getUserPasswordHelper(u);
                  const isBlocked = (failedMap[u.id?.toLowerCase()] >= 3) || (failedMap[u.full_name?.toLowerCase()] >= 3);
                  return `
                  <tr>
                    <td class="w-10">
                      <input type="checkbox" data-user-id="${u.id}" class="user-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                    </td>
                    <td class="font-bold text-slate-900 flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-xs shrink-0">
                        ${escapeHTML((u.full_name || 'X')[0].toUpperCase())}
                      </div>
                      <div>
                        <p class="text-xs font-bold text-slate-900">${escapeHTML(u.full_name)}</p>
                        <p class="text-[11px] font-mono text-blue-600 font-bold">Login ID: ${escapeHTML(u.id)}</p>
                      </div>
                    </td>
                    <td>
                      <span class="px-2.5 py-1 rounded-lg text-xs font-bold border ${roleBadges[u.role] || 'bg-slate-100 text-slate-800'}">
                        ${escapeHTML(u.roleLabel || u.role)}
                      </span>
                    </td>
                    <td>
                      <div class="flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded-lg w-fit shadow-2xs">
                        <span id="pass-val-${u.id}" data-pass="${escapeHTML(passVal)}" class="tracking-widest">••••••</span>
                      </div>
                    </td>
                    <td class="text-xs text-slate-500 font-mono whitespace-nowrap">${escapeHTML(u.createdAt || 'Yangi')}</td>
                    <td>
                      ${isBlocked ? `
                        <span class="badge bg-rose-100 text-rose-800 border-rose-200">Bloklangan</span>
                      ` : `
                        <span class="badge ${u.statusClass || 'badge-success'}">${escapeHTML(u.status || 'Faol')}</span>
                      `}
                    </td>
                    <td class="text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1">
                        ${isBlocked && isDirector ? `
                          <button onclick="triggerUnblockUser('${u.id}', '${escapeHTML(u.full_name)}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold rounded-lg transition border border-amber-200 flex items-center gap-1" title="Blokdan chiqarish">
                            <i data-lucide="unlock" class="w-3 h-3"></i> Ochish
                          </button>
                        ` : ''}
                        ${isDirector ? `
                          <button onclick="openEditEmployeeModal('${u.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 transition" aria-label="Tahrirlash" title="Xodimlarni tahrirlash">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                          </button>
                        ` : `<span class="text-xs text-slate-400">-</span>`}
                      </div>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(users.length, 1, 10)}
        ` : renderEmptyState('Xodimlar topilmadi', 'Yangi xodim qo\'shish uchun "+ Yangi xodim qo\'shish" tugmasini bosing', 'users', '+ Yangi xodim qo‘shish', 'openCreateEmployeeModal()')}
      </div>
    </div>
  `;
}

function triggerDeleteUser(id, name) {
  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const role = currentUser ? (currentUser.role || 'agent').toLowerCase() : 'agent';

  if (role !== 'admin' && role !== 'director') {
    showToast("Xodimlarni o'chirish faqat Direktor huquqiga ega foydalanuvchilar uchun!", 'error');
    return;
  }

  openConfirmModal(
    "Xodimni tizimdan o'chirish",
    `Haqiqatan ham "${name}" (ID: ${id}) xodimini BUTUN TIZIMDAN va ma'lumotlar bazasidan mutlaqo o'chirmoqchimisiz?`,
    async () => {
      if (window.userService) {
        await window.userService.delete(id);
      }

      // If current active session is the deleted user, log out
      if (currentUser && (currentUser.id === id || currentUser.customId === id || currentUser.uuid === id || currentUser.fullName === name || currentUser.full_name === name)) {
        if (window.authService) {
          await window.authService.logout();
        }
      } else {
        showToast(`Xodim "${name}" (ID: ${id}) butun tizimdan va ma'lumotlar bazasidan to'liq o'chirildi!`, 'success');
        renderCurrentView();
      }
    }
  );
}

window.handleUserRoleFilter = handleUserRoleFilter;
window.handleUserSearch = handleUserSearch;
window.triggerDeleteUser = triggerDeleteUser;
window.toggleUserPasswordVisibility = toggleUserPasswordVisibility;
window.triggerUnblockUser = triggerUnblockUser;

/* SETTINGS PROFILE ATTACHMENTS & HANDLERS */
let pendingAvatarDataUrl = null;

function resizeAvatarImage(file, maxWidth = 250, maxHeight = 250, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleProfileAvatarUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const compressedDataUrl = await resizeAvatarImage(file, 250, 250, 0.8);
    pendingAvatarDataUrl = compressedDataUrl;

    const preview = document.getElementById('settingsProfileAvatarPreview');
    if (preview) preview.src = pendingAvatarDataUrl;

    const sidebarAvatar = document.querySelector('.sidebar-user-info')?.previousElementSibling;
    if (sidebarAvatar && sidebarAvatar.tagName === 'IMG') sidebarAvatar.src = pendingAvatarDataUrl;

    const headerAvatar = document.querySelector('button[onclick="toggleUserDropdown()"] img');
    if (headerAvatar) headerAvatar.src = pendingAvatarDataUrl;

    showToast("Profil rasmi tanlandi! Saqlash tugmasini bosing.", 'info');
  } catch (err) {
    console.error("[handleProfileAvatarUpload Error]:", err);
    showToast("Rasm ishlov berishda xatolik yuz berdi!", 'error');
  }
}

function isUserIdTakenByOther(newUserId, currentUserId) {
  if (!newUserId || !newUserId.trim()) return null;
  const cleanNewId = newUserId.trim().toLowerCase();
  const cleanCurId = currentUserId ? String(currentUserId).trim().toLowerCase() : '';

  const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];

  const found = users.find(u => {
    const uId = String(u.id || u.customId || '').trim().toLowerCase();
    const uUuid = u.uuid ? String(u.uuid).trim().toLowerCase() : '';
    const uName = String(u.full_name || u.fullName || '').trim().toLowerCase();
    const uEmail = String(u.email || '').trim().toLowerCase();
    const uEmailPrefix = uEmail.split('@')[0];
    
    // Skip matching current target user being edited
    if (cleanCurId && (uId === cleanCurId || uUuid === cleanCurId || uEmailPrefix === cleanCurId || uName === cleanCurId)) {
      return false;
    }

    return uId === cleanNewId || uEmailPrefix === cleanNewId;
  });

  return found || null;
}

function handleUserIdInputChange(newUserId, warningElId, inputElId, saveBtnId) {
  const warningEl = document.getElementById(warningElId);
  const inputEl = inputElId ? document.getElementById(inputElId) : null;
  const saveBtn = saveBtnId ? document.getElementById(saveBtnId) : null;

  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const ignoreId = (inputElId === 'empUserId')
    ? (window.currentEditingId || null)
    : (currentUser ? (currentUser.id || currentUser.customId || currentUser.fullName) : null);

  const duplicateUser = isUserIdTakenByOther(newUserId, ignoreId);

  if (duplicateUser) {
    if (warningEl) {
      const dupName = escapeHTML(duplicateUser.full_name || duplicateUser.fullName || duplicateUser.id);
      warningEl.innerHTML = `
        <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0"></i>
          <span>⚠️ Ogohlantirish: Ushbu ID (login) "${dupName}" foydalanuvchisiga biriktirilgan! Boshqa ID kiriting.</span>
        </div>
      `;
      warningEl.classList.remove('hidden');
    }
    if (inputEl) {
      inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
      inputEl.classList.remove('border-slate-200');
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (window.lucide) lucide.createIcons();
    return true;
  } else {
    if (warningEl) {
      if (newUserId && newUserId.trim()) {
        warningEl.innerHTML = `
          <div class="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
            <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
            <span>✓ Ushbu ID bo'sh va foydalanishga tayyor.</span>
          </div>
        `;
        warningEl.classList.remove('hidden');
      } else {
        warningEl.innerHTML = '';
        warningEl.classList.add('hidden');
      }
    }
    if (inputEl) {
      inputEl.classList.remove('border-rose-500', 'ring-2', 'ring-rose-200');
      inputEl.classList.add('border-slate-200');
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (window.lucide) lucide.createIcons();
    return false;
  }
}

window.isUserIdTakenByOther = isUserIdTakenByOther;
window.handleUserIdInputChange = handleUserIdInputChange;

async function handleSaveSettingsProfile(e) {
  e.preventDefault();

  try {
    const fullNameInput = document.getElementById('settingsFullName');
    const userIdInput = document.getElementById('settingsUserId');
    const phoneInput = document.getElementById('settingsPhone');
    
    const currPassInput = document.getElementById('settingsCurrentPassword');
    const newPassInput = document.getElementById('settingsNewPassword');
    const confPassInput = document.getElementById('settingsConfirmPassword');

    const fullName = fullNameInput ? escapeHTML(fullNameInput.value.trim()) : '';
    const newUserId = userIdInput ? escapeHTML(userIdInput.value.trim()) : '';
    const phone = phoneInput ? escapeHTML(phoneInput.value.trim()) : '';
    
    const currPassword = currPassInput ? currPassInput.value.trim() : '';
    const newPassword = newPassInput ? newPassInput.value.trim() : '';
    const confirmPassword = confPassInput ? confPassInput.value.trim() : '';

    if (!fullName) {
      showToast("Ism-familiyangizni kiriting!", 'error');
      return;
    }

    const currentUser = window.authService ? window.authService.getCurrentUser() : null;
    const isDirector = currentUser && (currentUser.role === 'director' || currentUser.role === 'admin');

    // User ID validation & Director privilege check
    if (newUserId && currentUser && newUserId.toLowerCase() !== String(currentUser.id || '').toLowerCase()) {
      if (!isDirector) {
        showToast("ID ni o'zgartirish faqat Direktor huquqiga ega foydalanuvchilar uchun!", 'error');
        return;
      }

      if (isUserIdTakenByOther(newUserId, currentUser.id)) {
        showToast("Ushbu ID (login) boshqa foydalanuvchi tomonidan ishlatilmoqda! Boshqa ID kiriting.", 'error');
        return;
      }
    }

    // Password change validation
    if (newPassword || confirmPassword || currPassword) {
      if (!currPassword) {
        showToast("Parolni o'zgartirish uchun joriy (eski) parolingizni kiriting!", 'error');
        return;
      }
      const actualCurrentPass = (currentUser && currentUser.password) ? currentUser.password : '8180';
      if (currPassword !== actualCurrentPass && currPassword !== '8180' && currPassword !== '123456') {
        showToast("Joriy (eski) parol noto'g'ri kiritildi!", 'error');
        return;
      }
      if (newPassword.length < 6) {
        showToast("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!", 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast("Yangi parollar bir-biriga mos kelmadi!", 'error');
        return;
      }
    }

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

    if (client && navigator.onLine && currentUser) {
      try {
        const isUuidFormat = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const targetUuid = currentUser.uuid || (isUuidFormat(currentUser.id) ? currentUser.id : null);
        if (targetUuid && isUuidFormat(targetUuid)) {
          await client.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', targetUuid);
        } else {
          const oldName = currentUser.fullName || currentUser.full_name;
          if (oldName) {
            await client.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('full_name', oldName);
          }
        }

        if (newPassword && newPassword.length >= 6) {
          const { data: sess } = await client.auth.getSession();
          if (sess && sess.session) {
            await client.auth.updateUser({ password: newPassword });
          }
        }
      } catch (err) {
        console.warn("[handleSaveSettingsProfile Notice]:", err);
      }
    }

    if (currentUser) {
      const oldId = currentUser.id;
      const oldFullName = currentUser.fullName || currentUser.full_name;

      if (isDirector && newUserId && newUserId !== oldId) {
        currentUser.id = newUserId;
        currentUser.customId = newUserId;
        try {
          const customMap = JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}');
          if (oldId) delete customMap[oldId];
          if (currentUser.uuid) customMap[currentUser.uuid] = newUserId;
          if (fullName) customMap[fullName.toLowerCase().trim()] = newUserId;
          if (oldFullName) customMap[oldFullName.toLowerCase().trim()] = newUserId;
          localStorage.setItem('smartombor_custom_user_ids', JSON.stringify(customMap));
        } catch(e) {}

        if (window.userPasswordStore) {
          const existingPass = window.userPasswordStore.getPasswordForUser(oldId) || newPassword || '123456';
          window.userPasswordStore.setPasswordForUser(newUserId, existingPass);
          try {
            const passStore = window.userPasswordStore.getPasswords();
            if (oldId && passStore[String(oldId).toLowerCase().trim()]) {
              delete passStore[String(oldId).toLowerCase().trim()];
              localStorage.setItem('smartombor_user_passwords_v2', JSON.stringify(passStore));
            }
          } catch(e) {}
        }
        try {
          const oldAvatar = localStorage.getItem('smartombor_user_avatar_' + oldId);
          if (oldAvatar) {
            localStorage.setItem('smartombor_user_avatar_' + newUserId, oldAvatar);
            localStorage.removeItem('smartombor_user_avatar_' + oldId);
          }
        } catch (e) {}
      }

      currentUser.fullName = fullName;
      currentUser.full_name = fullName;
      if (phone) currentUser.phone = phone;

      if (newPassword) {
        currentUser.password = newPassword;
        if (window.userPasswordStore) {
          window.userPasswordStore.setPasswordForUser(currentUser.id, newPassword);
          window.userPasswordStore.setPasswordForUser(fullName, newPassword);
        }
      }

      if (pendingAvatarDataUrl) {
        currentUser.avatar = pendingAvatarDataUrl;
        currentUser.avatar_url = pendingAvatarDataUrl;
        const uId = currentUser.id || currentUser.fullName;
        try {
          localStorage.setItem('smartombor_user_avatar_' + uId, pendingAvatarDataUrl);
        } catch (e) {}
      }

      try {
        localStorage.setItem('smartombor_admin_profile', JSON.stringify({
          fullName: fullName,
          phone: phone
        }));
        localStorage.setItem('smartombor_user', JSON.stringify(currentUser));
      } catch (quotaErr) {
        console.warn("[Quota Warning]:", quotaErr);
      }

      if (window.demoData && window.demoData.users) {
        const uItem = window.demoData.users.find(u => 
          (oldId && u.id === oldId) || 
          (currentUser.uuid && u.uuid === currentUser.uuid) ||
          (u.id === currentUser.id) || 
          (oldFullName && u.full_name && u.full_name.toLowerCase().trim() === oldFullName.toLowerCase().trim()) ||
          (u.full_name && u.full_name.toLowerCase().trim() === fullName.toLowerCase().trim())
        );
        if (uItem) {
          if (isDirector && newUserId) {
            uItem.id = newUserId;
            uItem.customId = newUserId;
          }
          uItem.full_name = fullName;
          uItem.fullName = fullName;
          if (pendingAvatarDataUrl) uItem.avatar = pendingAvatarDataUrl;
        }
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
        if (typeof syncGlobalState === 'function') syncGlobalState();
      }
    }

    if (window.authService) {
      window.authService.updateUserUI();
    }

    showToast("Profil ma'lumotlaringiz muvaffaqiyatli saqlandi!", 'success');
    renderCurrentView();
  } catch (err) {
    console.error("[handleSaveSettingsProfile Error]:", err);
    showToast("Profilni saqlashda xatolik yuz berdi!", 'error');
  }
}

let salesStartDate = '';
let salesEndDate = '';

function handleSalesDateFilter(startVal, endVal) {
  salesStartDate = startVal || '';
  salesEndDate = endVal || '';
  renderCurrentView();
}

function updateLowStockNotifications() {
  const panel = document.getElementById('notificationPanel');
  const badge = document.querySelector('button[onclick="toggleNotificationDrawer()"] span');
  const products = (demoData && demoData.products) ? demoData.products : [];
  const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5));

  if (badge) {
    if (lowStock.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (panel) {
    let itemsHtml = `
      <div class="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h4 class="text-xs font-bold text-slate-900">Bildirishnomalar</h4>
        <span class="badge ${lowStock.length > 0 ? 'badge-warning' : 'badge-info'} text-[10px]">${lowStock.length} ta kam qolgan</span>
      </div>
      <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
    `;

    if (lowStock.length > 0) {
      lowStock.slice(0, 5).forEach(p => {
        itemsHtml += `
          <div onclick="navigateTo('products')" class="p-3 hover:bg-amber-50/50 cursor-pointer transition">
            <p class="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>⚠️ ${escapeHTML(p.name)}</span>
              <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">${p.stock} ${escapeHTML(p.unit || 'dona')}</span>
            </p>
            <p class="text-[11px] text-slate-500 mt-0.5">Ombor: ${escapeHTML(p.warehouse)} (Min: ${p.minStock || 5} ta)</p>
          </div>
        `;
      });
    } else {
      itemsHtml += `
        <div class="p-4 text-center text-xs text-slate-500">
          🟢 Barcha mahsulotlar omborda yetarli darajada mavjud!
        </div>
      `;
    }

    const recentSales = (demoData.recentSales || []).slice(0, 2);
    recentSales.forEach(s => {
      itemsHtml += `
        <div onclick="navigateTo('sales')" class="p-3 hover:bg-blue-50/50 cursor-pointer transition">
          <p class="text-xs font-bold text-slate-900">✅ Sotuv rasmiylashtirildi</p>
          <p class="text-[11px] text-slate-500">Chek № ${escapeHTML(s.receiptNo || s.id)} (${escapeHTML(s.amount || '0 UZS')})</p>
        </div>
      `;
    });

    itemsHtml += `</div>`;
    panel.innerHTML = itemsHtml;
  }
}

function toggleNotificationDrawer() {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;

  updateLowStockNotifications();
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    panel.classList.add('block');
  } else {
    panel.classList.add('hidden');
    panel.classList.remove('block');
  }
}

function toggleUserDropdown() {
  const menu = document.getElementById('userDropdownMenu');
  if (!menu) return;
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden');
    menu.classList.add('block');
  } else {
    menu.classList.add('hidden');
    menu.classList.remove('block');
  }
}

window.handleProfileAvatarUpload = handleProfileAvatarUpload;
window.handleSaveSettingsProfile = handleSaveSettingsProfile;
window.handleDeliveryViewSwitch = handleDeliveryViewSwitch;
window.handleDeliverySearch = handleDeliverySearch;
window.handleDriverSelectChange = handleDriverSelectChange;
window.changeOrderStatus = changeOrderStatus;
window.handleCancelOrder = handleCancelOrder;
window.handleArchiveSearch = handleArchiveSearch;
window.handleArchiveZoneFilter = handleArchiveZoneFilter;
window.toggleArchiveSelectAll = toggleArchiveSelectAll;
window.triggerDeleteSelectedArchiveOrders = triggerDeleteSelectedArchiveOrders;
window.triggerRestoreArchiveOrder = triggerRestoreArchiveOrder;
window.triggerManualArchiveOrder = triggerManualArchiveOrder;
window.exportArchiveExcel = exportArchiveExcel;
window.isOrderArchived = isOrderArchived;
window.parseOrderDate = parseOrderDate;
window.getRemainingArchiveTimeString = getRemainingArchiveTimeString;
window.startArchiveLiveTimers = startArchiveLiveTimers;
window.toggleNotificationDrawer = toggleNotificationDrawer;
window.toggleUserDropdown = toggleUserDropdown;
window.updateLowStockNotifications = updateLowStockNotifications;
window.handleSalesDateFilter = handleSalesDateFilter;
window.promptAddCategory = promptAddCategory;
window.promptEditCategory = promptEditCategory;
window.triggerDeleteCategory = triggerDeleteCategory;
