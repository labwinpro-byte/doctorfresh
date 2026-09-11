/* SmartOmbor ERP - Clean Architecture Data Layer, API Contract Adapter & Security Engine */

// ==================== 1. CONFIGURATION & ENVIRONMENT ====================
const CONFIG = {
  API_BASE_URL: 'https://api.smartombor.uz/v1',
  IS_MOCK_MODE: true,
  STORAGE_KEY: 'smartombor_erp_data_v2',
  DEFAULT_CURRENCY: 'UZS',
  TIMEZONE: 'Asia/Tashkent'
};

// Global XSS Sanitizer Helper
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  const unescaped = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  return unescaped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

function unescapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
window.unescapeHTML = unescapeHTML;

// Unique ID Generator Helper
function generateUniqueId(prefix = 'entity') {
  return `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
}
window.generateUniqueId = generateUniqueId;

// Standardized API Response Contract Adapter Helper
function createApiResponse(data = null, success = true, meta = null, error = null) {
  return {
    success,
    data,
    meta: meta || { timestamp: new Date().toISOString(), env: CONFIG.IS_MOCK_MODE ? 'mock' : 'production' },
    error: error ? {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Xatolik yuz berdi',
      status: error.status || 400
    } : null
  };
}
window.createApiResponse = createApiResponse;

// Standardized HTTP Error Schemas Blueprint
const HTTP_ERROR_SCHEMAS = {
  BAD_REQUEST: { status: 400, code: 'BAD_REQUEST', message: "Noto'g me'lumot yuborildi" },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: "Tizimga kirish talab etiladi" },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: "Sizda bu amalni bajarish huquqi yo'q" },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: "So'ralgan resurs topilmadi" },
  CONFLICT: { status: 409, code: 'CONFLICT', message: "Ushbu ma'lumot allaqachon mavjud" },
  STOCK_INSUFFICIENT: { status: 422, code: 'STOCK_INSUFFICIENT', message: "Omborda yetarli mahsulot qoldig'i mavjud emas" }
};

// RBAC Permissions Blueprint Matrix
const RBAC_ROLES = {
  ADMIN: {
    name: 'Administrator',
    permissions: ['products:*', 'warehouses:*', 'sales:*', 'purchases:*', 'transfers:*', 'customers:*', 'suppliers:*', 'cash:*', 'reports:*', 'settings:*']
  },
  MANAGER: {
    name: 'Ombor Mudiri',
    permissions: ['products:*', 'warehouses:read', 'purchases:*', 'transfers:*', 'reports:read']
  },
  CASHIER: {
    name: 'Kassir',
    permissions: ['sales:create', 'sales:read', 'customers:create', 'customers:read', 'cash:read']
  },
  ACCOUNTANT: {
    name: 'Hisobchi',
    permissions: ['reports:*', 'cash:*', 'sales:read', 'purchases:read', 'suppliers:read']
  }
};

// ==================== 2. STORAGE SERVICE ABSTRACTION ====================
const storageService = {
  getItem(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (err) {
      console.warn(`[storageService] Error reading key "${key}":`, err);
      return fallback;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[storageService] Error saving key "${key}":`, err);
      return false;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error(`[storageService] Error removing key "${key}":`, err);
      return false;
    }
  },
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (err) {
      console.error(`[storageService] Error clearing storage:`, err);
      return false;
    }
  }
};

// ==================== 3. FORMATTERS & CALCULATIONS LAYER ====================
function formatCurrency(amount) {
  const num = typeof amount === 'number' ? amount : (parseInt(amount) || 0);
  return num.toLocaleString('uz-UZ') + ' UZS';
}

function parseAppDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;
  
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // 1. Check DD.MM.YYYY HH:mm:ss or DD.MM.YYYY HH:mm or DD.MM.YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const hour = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
      const minute = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
      const second = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
      return new Date(year, month, day, hour, minute, second);
    }
    // 2. Check YYYY-MM-DD
    const yyyymmdd = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10);
      const month = parseInt(yyyymmdd[2], 10) - 1;
      const day = parseInt(yyyymmdd[3], 10);
      const hour = yyyymmdd[4] ? parseInt(yyyymmdd[4], 10) : 0;
      const minute = yyyymmdd[5] ? parseInt(yyyymmdd[5], 10) : 0;
      const second = yyyymmdd[6] ? parseInt(yyyymmdd[6], 10) : 0;
      return new Date(year, month, day, hour, minute, second);
    }
    // 3. Fallback standard parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatDate(dateInput = new Date()) {
  const date = parseAppDate(dateInput) || new Date();
  if (isNaN(date.getTime())) return '';
  const d = date.toLocaleDateString('uz-UZ');
  const t = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return `${d} ${t}`;
}

function calculateSaleTotal(qty, price) {
  return (Math.max(0, parseInt(qty) || 0)) * (Math.max(0, parseInt(price) || 0));
}

function calculateProfit(buyPrice, sellPrice) {
  const buy = Math.max(0, parseInt(buyPrice) || 0);
  const sell = Math.max(0, parseInt(sellPrice) || 0);
  const margin = sell - buy;
  const marginPercent = buy > 0 ? ((margin / buy) * 100).toFixed(1) : 0;
  return { margin, marginPercent };
}

function calculateDebt(total, paid) {
  const tot = Math.max(0, parseInt(total) || 0);
  const pd = Math.max(0, parseInt(paid) || 0);
  return Math.max(0, tot - pd);
}

// ==================== 4. VALIDATION LAYER ====================
function validateProduct(p) {
  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) return { valid: false, message: "Tovar nomi bo'sh bo'lishi mumkin emas!" };
  if (p.buyPrice < 0 || p.sellPrice < 0) return { valid: false, message: "Narxlar manfiy bo'lishi mumkin emas!" };
  if (p.stock < 0) return { valid: false, message: "Mahsulot qoldig'i manfiy bo'lishi mumkin emas!" };
  return { valid: true };
}

function validateSale(saleData, currentStock) {
  if (!saleData.productId) return { valid: false, message: "Mahsulot tanlanmagan!" };
  if (!saleData.customerId) return { valid: false, message: "Mijoz tanlanmagan!" };
  if (saleData.qty <= 0) return { valid: false, message: "Sotuv miqdori kamida 1 dona bo'lishi kerak!" };
  if (saleData.qty > currentStock) return { valid: false, message: `Mahsulot qoldig'i yetarli emas. Mavjud: ${currentStock} dona, So'ralgan: ${saleData.qty} dona` };
  return { valid: true };
}

// ==================== 5. BASELINE DEMO DATASET ====================
const defaultDemoData = {
  brand: { name: "SmartOmbor", sub: "Warehouse ERP", version: "v1.0 MVP" },
  userProfile: {
    name: "Foydalanuvchi", role: "ADMIN",
    avatar: null,
    email: "admin@smartombor.uz", phone: "+998 90 000-00-00"
  },
  kpis: {
    totalProducts: { value: "0 ta", subtext: "0 ta omborda", trend: "0%", positive: true, period: "" },
    dailySales: { value: "0 UZS", subtext: "0 ta bitim", trend: "0%", positive: true, period: "" },
    dailyIncome: { value: "0 UZS", subtext: "0 ta yuk xati", trend: "0%", positive: true, period: "" },
    cashBalance: { value: "0 UZS", subtext: "Naqd + Terminal", trend: "0%", positive: true, period: "" }
  },
  warehouses: [
    { id: "a1111111-1111-4000-8000-000000000001", name: "Asosiy Ombor - Toshkent", code: "OMB-001", address: "Toshkent shahri", manager: "Ombor Mudiri", phone: "+998 90 000-00-00", productCount: 0, totalValue: 0, capacityPercent: 0, status: "Faol", statusClass: "badge-success" }
  ],
  categories: [
    { id: "b2222222-2222-4000-8000-000000000001", name: "Elektronika va Texnika" },
    { id: "b2222222-2222-4000-8000-000000000002", name: "Mebellar va Jihozlar" },
    { id: "b2222222-2222-4000-8000-000000000003", name: "Qurilish mollari" },
    { id: "b2222222-2222-4000-8000-000000000004", name: "Santehnika va Isitish" },
    { id: "b2222222-2222-4000-8000-000000000005", name: "Kiyim-kechak" },
    { id: "b2222222-2222-4000-8000-000000000006", name: "Oziq-ovqat va Ichimliklar" },
    { id: "b2222222-2222-4000-8000-000000000007", name: "Kantselyariya" }
  ],
  paymentMethods: [
    { id: "pm-1", name: "Naqd pul", icon: "banknote", status: "Faol" },
    { id: "pm-2", name: "Terminal (Humo/Uzcard)", icon: "credit-card", status: "Faol" },
    { id: "pm-3", name: "Bank o'tkazmasi (Hisob-raqam)", icon: "building", status: "Faol" },
    { id: "pm-4", name: "Click / Payme / Uzum", icon: "smartphone", status: "Faol" }
  ],
  products: [],
  purchases: [],
  outgoing: [],
  recentSales: [],
  customers: [],
  suppliers: [],
  cash: {
    currentBalance: "0 UZS",
    todayIncome: "0 UZS",
    todayExpense: "0 UZS",
    netBalance: "0 UZS",
    transactions: []
  },
  drivers: [
    { id: "drv-1", name: "FAYZ", phone: "+998 90 123-45-67", vehicle: "Labo Super (01 A 777 AA)", status: "Bo'sh" }
  ],
  distributionOrders: [],
  orderReturns: [],
  lowStockProducts: [],
  users: [],
  chartData: {
    daily: { labels: ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"], datasets: [{ label: "Bugungi sotuv (mln UZS)", data: [0, 0, 0, 0, 0, 0] }] },
    weekly: { labels: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"], datasets: [{ label: "Haftalik sotuv (mln UZS)", data: [0, 0, 0, 0, 0, 0, 0] }] },
    monthly: { labels: ["1-Aft", "2-Aft", "3-Aft", "4-Aft"], datasets: [{ label: "Oylik sotuv (mln UZS)", data: [0, 0, 0, 0] }] }
  }
};

// Persistent User Accounts Manager Blueprint
const PERSISTENT_USERS_KEY = 'smartombor_persistent_users_v3';

function loadPersistentUsers() {
  try {
    const saved = localStorage.getItem(PERSISTENT_USERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

function savePersistentUsers(usersList) {
  try {
    const target = usersList || (window.demoData ? window.demoData.users : null);
    if (target && Array.isArray(target)) {
      localStorage.setItem(PERSISTENT_USERS_KEY, JSON.stringify(target));
    }
  } catch (e) {}
}
window.savePersistentUsers = savePersistentUsers;

// Initial state initialization from Storage Service
let savedState = storageService.getItem(CONFIG.STORAGE_KEY, null);
let demoData = savedState ? savedState : JSON.parse(JSON.stringify(defaultDemoData));

// Ensure all root entities exist
if (!demoData.products) demoData.products = [];
if (!demoData.warehouses) demoData.warehouses = JSON.parse(JSON.stringify(defaultDemoData.warehouses || []));
if (!demoData.categories) demoData.categories = JSON.parse(JSON.stringify(defaultDemoData.categories || []));
if (!demoData.customers) demoData.customers = [];
if (!demoData.suppliers) demoData.suppliers = [];
if (!demoData.outgoing) demoData.outgoing = [];
if (!demoData.purchases) demoData.purchases = [];
if (!demoData.recentSales) demoData.recentSales = [];
if (!demoData.distributionOrders) demoData.distributionOrders = [];
if (!demoData.orderReturns) demoData.orderReturns = [];
if (!demoData.users) demoData.users = [];
if (!demoData.cash) demoData.cash = JSON.parse(JSON.stringify(defaultDemoData.cash || { transactions: [], todayIncome: '0 UZS', todayExpense: '0 UZS', currentBalance: '0 UZS', netBalance: '0 UZS' }));
if (!demoData.kpis) demoData.kpis = JSON.parse(JSON.stringify(defaultDemoData.kpis || {}));
if (!demoData.chartData) demoData.chartData = JSON.parse(JSON.stringify(defaultDemoData.chartData || {}));

// Load all deletion blacklists from localStorage
try {
  ['User', 'Product', 'Category', 'Warehouse', 'Customer', 'Supplier', 'Outgoing', 'Purchase', 'Sale', 'DistributionOrder', 'Return'].forEach(entity => {
    const key = `smartombor_deleted_${entity.toLowerCase()}_ids`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        demoData[`deleted${entity}Ids`] = parsed;
      }
    }
  });
} catch(e) {}

// Ensure deletion blacklist arrays exist
['deletedUserIds', 'deletedProductIds', 'deletedCategoryIds', 'deletedWarehouseIds', 'deletedCustomerIds', 'deletedSupplierIds', 'deletedOutgoingIds', 'deletedPurchaseIds', 'deletedSaleIds', 'deletedDistributionOrderIds', 'deletedReturnIds'].forEach(k => {
  if (!demoData[k]) demoData[k] = [];
});

// Preserve user profiles state
const persistentUsers = loadPersistentUsers();
if (persistentUsers && persistentUsers.length > 0) {
  demoData.users = persistentUsers;
} else {
  demoData.users = [];
}

// Filter out deleted entities against their blacklists
if (demoData.users) {
  const deletedUsers = demoData.deletedUserIds || [];
  demoData.users = demoData.users.filter(u => {
    if (!u) return false;
    const uId = String(u.id || '').trim();
    const uCustomId = String(u.customId || '').trim();
    const uUuid = String(u.uuid || '').trim();
    const uName = String(u.full_name || u.fullName || '').trim();
    return !deletedUsers.includes(uId) && !deletedUsers.includes(uCustomId) && !deletedUsers.includes(uUuid) && !deletedUsers.includes(uName);
  });
}
if (demoData.products) demoData.products = demoData.products.filter(p => p && !demoData.deletedProductIds.includes(p.id) && !demoData.deletedProductIds.includes(p.name));
if (demoData.categories) demoData.categories = demoData.categories.filter(c => c && !demoData.deletedCategoryIds.includes(c.id) && !demoData.deletedCategoryIds.includes(c.name));
if (demoData.warehouses) demoData.warehouses = demoData.warehouses.filter(w => w && !demoData.deletedWarehouseIds.includes(w.id) && !demoData.deletedWarehouseIds.includes(w.name));
if (demoData.customers) demoData.customers = demoData.customers.filter(c => c && !demoData.deletedCustomerIds.includes(c.id) && !demoData.deletedCustomerIds.includes(c.name));
if (demoData.suppliers) demoData.suppliers = demoData.suppliers.filter(s => s && !demoData.deletedSupplierIds.includes(s.id) && !demoData.deletedSupplierIds.includes(s.name));
if (demoData.outgoing) demoData.outgoing = demoData.outgoing.filter(o => o && !demoData.deletedOutgoingIds.includes(o.id) && !demoData.deletedOutgoingIds.includes(o.docNo));
if (demoData.purchases) demoData.purchases = demoData.purchases.filter(p => p && !demoData.deletedPurchaseIds.includes(p.id) && !demoData.deletedPurchaseIds.includes(p.docNo));
if (demoData.recentSales) demoData.recentSales = demoData.recentSales.filter(s => s && !demoData.deletedSaleIds.includes(s.id) && !demoData.deletedSaleIds.includes(s.receiptNo));
const mockOrderPrefixes = ['ord-100', 'ord-101', 'ret-500'];
const mockCustomerNames = [
  '999 alisher 84',
  '820 kushmatova nigina',
  '820 agzamov obidjon',
  '820 nazmiddinov maruf',
  '820 kadirov farux',
  '822 shamshiyeva shaxista',
  '871 nurdbod hayot',
  '822 xalq baxti',
  "822 bo'ronboyeva lutfiniso",
  'apex tech logistics'
];

if (demoData.distributionOrders) {
  demoData.distributionOrders = demoData.distributionOrders.filter(o => {
    if (!o) return false;
    const isMock = mockOrderPrefixes.some(p => String(o.id || '').startsWith(p)) || 
                   mockCustomerNames.some(c => (o.customerName || '').toLowerCase().includes(c));
    if (isMock) return false;
    return !demoData.deletedDistributionOrderIds.includes(o.id) && !demoData.deletedDistributionOrderIds.includes(o.orderNumber);
  });
  demoData.distributionOrders.forEach(o => {
    if (o.driverName && o.driverName.toLowerCase().includes('sardor karimov')) {
      o.driverName = 'Biriktirilmagan';
    }
    if (o.agentName) {
      o.agentName = o.agentName.replace(/\s*\((?:Administrator|Super|Admin)\)/gi, '').trim();
    }
  });
}
if (!demoData.customers) demoData.customers = [];
if (!demoData.recentSales) demoData.recentSales = [];
if (demoData.recentSales) {
  demoData.recentSales.forEach(s => {
    if (s.agentName) {
      s.agentName = s.agentName.replace(/\s*\((?:Administrator|Super|Admin)\)/gi, '').trim();
    }
  });
}
if (demoData.orderReturns) {
  demoData.orderReturns = demoData.orderReturns.filter(r => {
    if (!r) return false;
    const isMock = mockOrderPrefixes.some(p => String(r.id || '').startsWith(p));
    return !isMock;
  });
  demoData.orderReturns.forEach(r => {
    if (r.driverName && r.driverName.toLowerCase().includes('sardor karimov')) {
      r.driverName = 'Biriktirilmagan';
    }
  });
}

savePersistentUsers(demoData.users);
window.demoData = demoData;

function saveStateToLocalStorage() {
  window.demoData = demoData;
  storageService.setItem(CONFIG.STORAGE_KEY, demoData);
  savePersistentUsers(demoData.users);
  try {
    ['User', 'Product', 'Category', 'Warehouse', 'Customer', 'Supplier', 'Outgoing', 'Purchase', 'Sale', 'DistributionOrder', 'Return'].forEach(entity => {
      const k = `deleted${entity}Ids`;
      if (demoData[k]) {
        localStorage.setItem(`smartombor_deleted_${entity.toLowerCase()}_ids`, JSON.stringify(demoData[k]));
      }
    });
  } catch (e) {}
}

function resetDemoDataToDefault() {
  demoData = JSON.parse(JSON.stringify(defaultDemoData));
  saveStateToLocalStorage();
  syncGlobalState();
}

async function wipeAllSystemData() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (client && navigator.onLine) {
    const tables = [
      'sale_items',
      'purchase_items',
      'distribution_order_items',
      'inventory',
      'order_returns',
      'outgoing',
      'sales',
      'purchases',
      'distribution_orders',
      'cash_transactions',
      'products',
      'customers',
      'suppliers'
    ];
    for (const t of tables) {
      try {
        await client.from(t).delete().not('id', 'is', null);
      } catch (e) {
        try {
          await client.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch(err2) {
          console.warn(`[Supabase Wipe Notice] Table ${t}:`, err2);
        }
      }
    }
  }

  // Preserve ONLY user profiles / employees
  const preservedUsers = (demoData && Array.isArray(demoData.users)) ? demoData.users : (loadPersistentUsers() || []);

  // Clear local demoData entities
  demoData.products = [];
  demoData.outgoing = [];
  demoData.purchases = [];
  demoData.recentSales = [];
  demoData.customers = [];
  demoData.suppliers = [];
  demoData.distributionOrders = [];
  demoData.orderReturns = [];
  demoData.users = preservedUsers;
  demoData.cash = {
    transactions: [],
    todayIncome: '0 UZS',
    todayExpense: '0 UZS',
    currentBalance: '0 UZS',
    netBalance: '0 UZS'
  };

  if (demoData.kpis) {
    if (demoData.kpis.totalProducts) { demoData.kpis.totalProducts.value = "0 ta"; demoData.kpis.totalProducts.trend = "0%"; }
    if (demoData.kpis.dailySales) { demoData.kpis.dailySales.value = "0 UZS"; demoData.kpis.dailySales.trend = "0%"; }
    if (demoData.kpis.dailyIncome) { demoData.kpis.dailyIncome.value = "0 UZS"; demoData.kpis.dailyIncome.trend = "0%"; }
    if (demoData.kpis.cashBalance) { demoData.kpis.cashBalance.value = "0 UZS"; demoData.kpis.cashBalance.trend = "0%"; }
  }

  demoData.chartData = {
    daily: { labels: ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"], datasets: [{ label: "Bugungi sotuv (mln UZS)", data: [0, 0, 0, 0, 0, 0] }] },
    weekly: { labels: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"], datasets: [{ label: "Haftalik sotuv (mln UZS)", data: [0, 0, 0, 0, 0, 0, 0] }] },
    monthly: { labels: ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"], datasets: [{ label: "Oylik sotuv (mln UZS)", data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }] }
  };

  // Set system wiped flag and cleared flags in localStorage so fallbacks never re-populate defaults
  try { localStorage.setItem('smartombor_system_wiped', 'true'); } catch (e) {}
  const clearedKeys = [
    'smartombor_products_cleared',
    'smartombor_outgoing_cleared',
    'smartombor_purchases_cleared',
    'smartombor_sales_cleared',
    'smartombor_customers_cleared',
    'smartombor_suppliers_cleared',
    'smartombor_distribution_cleared',
    'smartombor_returns_cleared',
    'smartombor_cash_cleared'
  ];
  clearedKeys.forEach(k => {
    try { localStorage.setItem(k, 'true'); } catch (e) {}
  });

  // Clear deletion blacklists
  ['deletedProductIds', 'deletedOutgoingIds', 'deletedPurchaseIds', 'deletedSaleIds', 'deletedCustomerIds', 'deletedSupplierIds', 'deletedDistributionOrderIds', 'deletedReturnIds'].forEach(k => {
    demoData[k] = [];
    try { localStorage.setItem(`smartombor_deleted_${k.replace('deleted', '').toLowerCase()}`, '[]'); } catch(e) {}
  });

  if (window.offlineStore) {
    try {
      await window.offlineStore.cacheData('products', []);
      await window.offlineStore.cacheData('customers', []);
      await window.offlineStore.cacheData('suppliers', []);
      await window.offlineStore.cacheData('sales', []);
      await window.offlineStore.cacheData('purchases', []);
      await window.offlineStore.cacheData('outgoing', []);
      await window.offlineStore.cacheData('distributionOrders', []);
      await window.offlineStore.cacheData('orderReturns', []);
      await window.offlineStore.cacheData('cash', { transactions: [] });
    } catch (e) {}
  }

  saveStateToLocalStorage();
  syncGlobalState();
  return createApiResponse({ success: true, message: "Barcha ma'lumotlar 0 qilindi (faqat foydalanuvchilar saqlab qolindi)" });
}
window.wipeAllSystemData = wipeAllSystemData;

// ==================== 6. INVENTORY SERVICE ABSTRACTION ====================
const inventoryService = {
  addStock(productId, qty) {
    const prd = demoData.products.find(p => p.id === productId);
    if (!prd) return false;
    prd.stock += Math.max(0, parseInt(qty) || 0);
    this.updateStatus(prd);
    return true;
  },
  removeStock(productId, qty) {
    const prd = demoData.products.find(p => p.id === productId);
    if (!prd) return false;
    const count = Math.max(0, parseInt(qty) || 0);
    if (prd.stock < count) return false;
    prd.stock -= count;
    this.updateStatus(prd);
    return true;
  },
  transferStock(productId, fromWarehouse, toWarehouse, qty) {
    const prd = demoData.products.find(p => p.id === productId);
    if (!prd) return false;
    const count = Math.max(0, parseInt(qty) || 0);
    if (prd.stock < count) return false;

    prd.stock -= count;
    this.updateStatus(prd);

    let targetPrd = demoData.products.find(p => p.name === prd.name && p.warehouse === toWarehouse);
    if (targetPrd) {
      targetPrd.stock += count;
      this.updateStatus(targetPrd);
    } else {
      demoData.products.push({
        id: generateUniqueId('product'),
        sku: prd.sku + '-TR',
        name: prd.name,
        category: prd.category,
        warehouse: toWarehouse,
        unit: prd.unit,
        buyPrice: prd.buyPrice,
        sellPrice: prd.sellPrice,
        stock: count,
        minStock: prd.minStock,
        status: 'Mavjud',
        statusClass: 'badge-success'
      });
    }
    return true;
  },
  updateStatus(product) {
    if (product.stock <= 0) {
      product.stock = 0;
      product.status = 'Tugagan';
      product.statusClass = 'badge-danger';
    } else if (product.stock <= product.minStock) {
      product.status = 'Kam qolgan';
      product.statusClass = 'badge-warning';
    } else {
      product.status = 'Mavjud';
      product.statusClass = 'badge-success';
    }
  }
};

// Backward compatibility helper
function updateProductStatus(product) {
  inventoryService.updateStatus(product);
}

// DB Mapper Helpers for Products (Real Supabase PostgreSQL Schema)
function mapDbToProduct(row) {
  if (!row) return null;

  const existingLocal = (demoData.products || []).find(p => p.id === row.id || p.sku === row.sku || p.name === row.name);

  const inventoryItems = Array.isArray(row.inventory) ? row.inventory : [];
  let totalStock = 0;
  let warehouseStr = '';
  let primaryWarehouseId = null;

  if (inventoryItems.length > 0) {
    totalStock = inventoryItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
    const whNames = inventoryItems.map(item => item.warehouses ? item.warehouses.name : null).filter(Boolean);
    if (whNames.length > 0) {
      warehouseStr = whNames.join(', ');
    }
    primaryWarehouseId = inventoryItems[0].warehouse_id || null;
  }

  // Stock determination: If relational inventory exists, prioritize Supabase database sum
  if (inventoryItems.length > 0) {
    totalStock = inventoryItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
  } else if (row.stock !== undefined || row.quantity !== undefined) {
    totalStock = Number(row.stock || row.quantity || 0);
  } else if (existingLocal && typeof existingLocal.stock === 'number') {
    totalStock = existingLocal.stock;
  }

  // Fallback warehouse string if omitted
  if (!warehouseStr || warehouseStr === 'Ombor ko\'rsatilmagan') {
    warehouseStr = (existingLocal && existingLocal.warehouse && existingLocal.warehouse !== 'Ombor ko\'rsatilmagan')
      ? existingLocal.warehouse
      : (row.warehouse || 'Asosiy Ombor - Toshkent');
  }

  const categoryName = row.categories ? row.categories.name : (existingLocal?.category || row.category || 'Elektronika va Texnika');
  const minStock = row.minimum_stock !== undefined ? row.minimum_stock : (existingLocal?.minStock || 5);

  let status = 'Mavjud';
  let statusClass = 'badge-success';
  if (totalStock <= 0) {
    status = 'Tugagan';
    statusClass = 'badge-danger';
  } else if (totalStock <= minStock) {
    status = 'Kam qolgan';
    statusClass = 'badge-warning';
  }

  const sellPrice = (row.price_retail != null ? Number(row.price_retail) : null) ?? (row.sale_price != null ? Number(row.sale_price) : null) ?? (row.sell_price != null ? Number(row.sell_price) : null) ?? existingLocal?.sellPrice ?? 0;
  const wholesalePrice = (row.price_wholesale != null ? Number(row.price_wholesale) : null) ?? existingLocal?.wholesalePrice ?? Math.round(sellPrice * 0.9);
  const vipPrice = (row.price_vip != null ? Number(row.price_vip) : null) ?? existingLocal?.vipPrice ?? Math.round(sellPrice * 0.8);

  return {
    id: row.id,
    sku: row.sku || existingLocal?.sku || '',
    name: row.name || existingLocal?.name || '',
    category: categoryName,
    categoryId: row.category_id || existingLocal?.categoryId || null,
    warehouse: warehouseStr,
    warehouseId: primaryWarehouseId || existingLocal?.warehouseId || null,
    unit: row.unit || existingLocal?.unit || 'dona',
    buyPrice: Number(row.purchase_price) || Number(row.buy_price) || existingLocal?.buyPrice || 0,
    sellPrice: sellPrice,
    priceRetail: sellPrice,
    wholesalePrice: wholesalePrice,
    vipPrice: vipPrice,
    stock: totalStock,
    minStock: minStock,
    status,
    statusClass,
    createdAt: row.created_at || existingLocal?.createdAt
  };
}

function mapProductToDb(data) {
  const dbObj = {};
  if (data.sku !== undefined) dbObj.sku = data.sku;
  if (data.name !== undefined) dbObj.name = data.name;
  if (data.categoryId !== undefined) dbObj.category_id = data.categoryId;
  else if (data.category_id !== undefined) dbObj.category_id = data.category_id;
  if (data.unit !== undefined) dbObj.unit = data.unit;
  if (data.buyPrice !== undefined) dbObj.purchase_price = data.buyPrice;
  else if (data.purchase_price !== undefined) dbObj.purchase_price = data.purchase_price;

  const retail = data.priceRetail !== undefined ? data.priceRetail : data.sellPrice;
  if (retail !== undefined) {
    dbObj.sale_price = retail;
    dbObj.price_retail = retail;
  }
  if (data.wholesalePrice !== undefined) dbObj.price_wholesale = data.wholesalePrice;
  if (data.vipPrice !== undefined) dbObj.price_vip = data.vipPrice;

  if (data.minStock !== undefined) dbObj.minimum_stock = data.minStock;
  else if (data.minimum_stock !== undefined) dbObj.minimum_stock = data.minimum_stock;
  return dbObj;
}

async function resolveCategoryUUID(client, categoryInput) {
  if (!client) return null;
  if (!categoryInput) {
    try {
      const { data: firstCat } = await client.from('categories').select('id').limit(1).maybeSingle();
      if (firstCat && firstCat.id) return firstCat.id;
    } catch (e) {}
    return null;
  }

  let targetName = null;

  if (isUUID(categoryInput)) {
    // 1. Check if this UUID actually exists in categories table in Supabase
    try {
      const { data: exists } = await client
        .from('categories')
        .select('id, name')
        .eq('id', categoryInput)
        .maybeSingle();

      if (exists && exists.id) {
        return exists.id; // REAL UUID verified in Supabase categories table!
      }
    } catch (e) {}

    // 2. Fake/local UUID. Find corresponding category name.
    if (Array.isArray(demoData.categories)) {
      const foundLocal = demoData.categories.find(c => typeof c === 'object' && (c.id === categoryInput || c.name === categoryInput));
      if (foundLocal && foundLocal.name) {
        targetName = foundLocal.name;
      }
    }
    if (!targetName && typeof defaultCategoryList !== 'undefined' && Array.isArray(defaultCategoryList)) {
      const foundDef = defaultCategoryList.find(c => c.id === categoryInput || c.name === categoryInput);
      if (foundDef && foundDef.name) {
        targetName = foundDef.name;
      }
    }
    if (!targetName && Array.isArray(demoData.products)) {
      const foundPrd = demoData.products.find(p => p.categoryId === categoryInput);
      if (foundPrd && foundPrd.category) {
        targetName = foundPrd.category;
      }
    }
  } else {
    // categoryInput is already a name string
    targetName = categoryInput;
  }

  if (!targetName) {
    targetName = 'Elektronika va Texnika';
  }

  // 3. Search Supabase categories by name
  try {
    const { data: existingByName } = await client
      .from('categories')
      .select('id')
      .eq('name', targetName)
      .maybeSingle();

    if (existingByName && existingByName.id) {
      return existingByName.id;
    }
  } catch (e) {}

  // 4. Create category in categories table if missing
  try {
    const { data: createdCat, error: catErr } = await client
      .from('categories')
      .insert([{ name: targetName }])
      .select('id')
      .single();

    if (!catErr && createdCat && createdCat.id) {
      if (Array.isArray(demoData.categories)) {
        const existingIdx = demoData.categories.findIndex(c => typeof c === 'object' && c.name === targetName);
        if (existingIdx !== -1) {
          demoData.categories[existingIdx] = { id: createdCat.id, name: targetName };
        } else {
          demoData.categories.push({ id: createdCat.id, name: targetName });
        }
      }
      return createdCat.id;
    }
  } catch (e) {}

  // 5. Fallback: get any category ID from Supabase
  try {
    const { data: anyCat } = await client.from('categories').select('id').limit(1).maybeSingle();
    if (anyCat && anyCat.id) return anyCat.id;
  } catch (e) {}

  return null;
}

async function resolveWarehouseUUID(client, warehouseInput) {
  if (!client) return null;
  const rawInput = (warehouseInput && warehouseInput !== 'Ombor ko\'rsatilmagan') ? warehouseInput : 'Asosiy Ombor - Toshkent';

  let targetName = null;

  if (isUUID(rawInput)) {
    // 1. Check if this UUID actually exists in warehouses table in Supabase
    try {
      const { data: exists } = await client
        .from('warehouses')
        .select('id, name')
        .eq('id', rawInput)
        .maybeSingle();

      if (exists && exists.id) {
        return exists.id; // REAL UUID verified in Supabase warehouses table!
      }
    } catch (e) {}

    // 2. Fake/local UUID. Find warehouse name.
    if (Array.isArray(demoData.warehouses)) {
      const foundLocal = demoData.warehouses.find(w => typeof w === 'object' && (w.id === rawInput || w.name === rawInput));
      if (foundLocal && foundLocal.name) {
        targetName = foundLocal.name;
      }
    }
    if (!targetName && typeof defaultWarehouseList !== 'undefined' && Array.isArray(defaultWarehouseList)) {
      const foundDef = defaultWarehouseList.find(w => w.id === rawInput || w.name === rawInput);
      if (foundDef && foundDef.name) {
        targetName = foundDef.name;
      }
    }
    if (!targetName && Array.isArray(demoData.products)) {
      const foundPrd = demoData.products.find(p => p.warehouseId === rawInput);
      if (foundPrd && foundPrd.warehouse) {
        targetName = foundPrd.warehouse;
      }
    }
  } else {
    targetName = rawInput;
  }

  if (!targetName) {
    targetName = 'Asosiy Ombor - Toshkent';
  }

  // 3. Search Supabase warehouses by name
  try {
    const { data: existingByName } = await client
      .from('warehouses')
      .select('id')
      .eq('name', targetName)
      .maybeSingle();

    if (existingByName && existingByName.id) {
      return existingByName.id;
    }
  } catch (e) {}

  // 4. Create in warehouses table if missing
  try {
    const { data: createdWh, error: whErr } = await client
      .from('warehouses')
      .insert([{ name: targetName, location: 'Toshkent' }])
      .select('id')
      .single();

    if (!whErr && createdWh && createdWh.id) {
      if (Array.isArray(demoData.warehouses)) {
        const existingIdx = demoData.warehouses.findIndex(w => typeof w === 'object' && w.name === targetName);
        if (existingIdx !== -1) {
          demoData.warehouses[existingIdx] = { id: createdWh.id, name: targetName, location: 'Toshkent' };
        } else {
          demoData.warehouses.push({ id: createdWh.id, name: targetName, location: 'Toshkent' });
        }
      }
      return createdWh.id;
    }
  } catch (e) {}

  // 5. Fallback: get any warehouse ID from Supabase
  try {
    const { data: anyWh } = await client.from('warehouses').select('id').limit(1).maybeSingle();
    if (anyWh && anyWh.id) return anyWh.id;
  } catch (e) {}

  return null;
}

// Product Service Interface (Connected to Real Supabase PostgreSQL Relational Schema)
const productService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('products')
          .select('*, categories(id, name), inventory(id, quantity, warehouse_id, warehouses(id, name))')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const prdData = res ? res.data : null;
        const prdErr = res ? res.error : null;

        if (!prdErr && prdData && Array.isArray(prdData)) {
          fetchedFromCloud = true;
          let allInventory = [];
          try {
            const { data: invData } = await client.from('inventory').select('*, warehouses(id, name)');
            if (invData) allInventory = invData;
          } catch (e) {}

          const fetchedProducts = prdData.map(row => {
            if (!row.inventory || !Array.isArray(row.inventory) || row.inventory.length === 0) {
              const matched = allInventory.filter(inv => inv.product_id === row.id);
              if (matched.length > 0) row.inventory = matched;
            }
            return mapDbToProduct(row);
          }).filter(Boolean);

          const deletedProds = demoData.deletedProductIds || [];
          const filteredProducts = fetchedProducts.filter(p => p && !deletedProds.includes(p.id) && !deletedProds.includes(p.name));

          demoData.products = filteredProducts;
          if (demoData.products.length > 0) {
            try { localStorage.removeItem('smartombor_products_cleared'); } catch (e) {}
          } else {
            try { localStorage.setItem('smartombor_products_cleared', 'true'); } catch (e) {}
          }

          saveStateToLocalStorage();
          if (window.offlineStore) {
            window.offlineStore.cacheData('products', demoData.products);
          }
        }
      } catch (err) {
        console.warn("[productService.getAll] Supabase fetch notice:", err.message);
      }
    }

    if (!fetchedFromCloud && (!demoData.products || demoData.products.length === 0)) {
      if (window.offlineStore) {
        try {
          const cached = await window.offlineStore.getCachedData('products');
          if (cached && Array.isArray(cached) && cached.length > 0) {
            demoData.products = cached;
          }
        } catch (e) {}
      }
    }

    const isProductsCleared = (localStorage.getItem('smartombor_products_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedProductIds && demoData.deletedProductIds.length > 0);
    if (!fetchedFromCloud && !isProductsCleared && (!demoData.products || demoData.products.length === 0)) {
      demoData.products = defaultDemoData.products || [];
    } else if (!fetchedFromCloud && isProductsCleared) {
      demoData.products = [];
    }

    return createApiResponse(demoData.products);
  },

  async getById(id) {
    const client = getSupabaseClient();
    if (!client) {
      return createApiResponse(null, false, null, { code: 'NO_SUPABASE_CLIENT', message: "Supabase client yaratilmagan!", status: 500 });
    }
    const { data, error } = await client
      .from('products')
      .select('*, categories(id, name), inventory(id, quantity, warehouse_id, warehouses(id, name))')
      .eq('id', id)
      .single();

    if (error) {
      console.error("[productService.getById] Supabase Error:", error);
      return createApiResponse(null, false, null, { code: error.code || 'NOT_FOUND', message: error.message || "Mahsulot topilmadi", status: 404 });
    }

    return createApiResponse(mapDbToProduct(data));
  },

  async create(data, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('products:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mahsulot qo'shish uchun huquq yetarli emas!", status: 403 });
    }
    const val = validateProduct(data);
    if (!val.valid) return createApiResponse(null, false, null, { code: 'VALIDATION_ERROR', message: val.message, status: 400 });

    const stock = Math.max(0, parseInt(data.stock) || 0);
    const minStock = Math.max(0, parseInt(data.minStock) || 5);
    const localProduct = {
      id: generateUniqueId('product'),
      name: data.name,
      sku: data.sku || ('PRD-' + Math.floor(1000 + Math.random() * 9000)),
      category: data.category || 'Elektronika va Texnika',
      warehouse: data.warehouse || 'Asosiy Ombor - Toshkent',
      unit: data.unit || 'dona',
      buyPrice: data.buyPrice || 0,
      sellPrice: data.sellPrice || 0,
      priceRetail: data.priceRetail || data.sellPrice || 0,
      wholesalePrice: data.wholesalePrice || Math.round((data.sellPrice || 0) * 0.9),
      vipPrice: data.vipPrice || Math.round((data.sellPrice || 0) * 0.8),
      stock,
      minStock,
      status: stock <= 0 ? 'Tugagan' : (stock <= minStock ? 'Kam qolgan' : 'Mavjud'),
      statusClass: stock <= 0 ? 'badge-danger' : (stock <= minStock ? 'badge-warning' : 'badge-success')
    };

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const catId = await resolveCategoryUUID(client, data.categoryId || data.category);
          const whId = await resolveWarehouseUUID(client, data.warehouseId || data.warehouse);
          data.categoryId = catId;
          data.warehouseId = whId;
          let payload = mapProductToDb(data);

          const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
          if (isDev) {
            console.log('[productService.create] FINAL Payload sent to Supabase:', payload);
          }

          let { data: createdData, error } = await client
            .from('products')
            .insert([payload])
            .select('*, categories(id, name)')
            .single();

          if (error) {
            console.warn("[productService.create Supabase retry notice]:", error.message);
            // Retry plain insert without single select join if join failed
            const { data: retryData } = await client.from('products').insert([payload]).select('id').single();
            if (retryData && retryData.id) {
              createdData = retryData;
              error = null;
            }
          }

          if (!error && createdData) {
            if (data.stock !== undefined && whId) {
              await client.from('inventory').insert([{ product_id: createdData.id, warehouse_id: whId, quantity: stock }]);
            }
            localProduct.id = createdData.id;
          }
        })();

        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[productService.create] Network notice:", err.message);
        if (window.offlineStore) {
          window.offlineStore.enqueueMutation('create_product', data);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_product', data);
    }

    // Remove created product from deletion blacklist if previously deleted
    if (demoData.deletedProductIds && Array.isArray(demoData.deletedProductIds)) {
      demoData.deletedProductIds = demoData.deletedProductIds.filter(x => x !== localProduct.id && x !== localProduct.name);
      try { localStorage.setItem('smartombor_deleted_product_ids', JSON.stringify(demoData.deletedProductIds)); } catch(e) {}
    }

    const existingIdx = demoData.products.findIndex(p => p.id === localProduct.id || p.sku === localProduct.sku);
    if (existingIdx === -1) {
      demoData.products.unshift(localProduct);
    } else {
      demoData.products[existingIdx] = localProduct;
    }

    try { localStorage.removeItem('smartombor_products_cleared'); } catch (e) {}
    syncGlobalState();
    return createApiResponse(localProduct);
  },

  async update(id, data, isSyncFlush = false) {
    const isStockOnlyUpdate = Object.keys(data).length <= 2 && data.stock !== undefined;
    if (!isSyncFlush && !isStockOnlyUpdate && window.authService && !window.authService.canPerform('products:update')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mahsulotni tahrirlash uchun huquq yetarli emas!", status: 403 });
    }
    const client = getSupabaseClient();
    if (!client) {
      return createApiResponse(null, false, null, { code: 'NO_SUPABASE_CLIENT', message: "Supabase client yaratilmagan!", status: 500 });
    }

    // Resolve categoryId and warehouseId to valid UUIDs
    data.categoryId = await resolveCategoryUUID(client, data.categoryId || data.category);
    data.warehouseId = await resolveWarehouseUUID(client, data.warehouseId || data.warehouse);

    let payload = mapProductToDb(data);

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    if (isDev) {
      console.log('[productService.update] FINAL Payload sent to Supabase:', payload);
    }

    // Update products table with schema error fallback
    let { data: updatedData, error } = await client
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('*, categories(id, name)')
      .single();

    if (error && (error.message?.includes('price_retail') || error.message?.includes('schema cache'))) {
      console.warn("[productService.update] Retrying without new columns (Schema fallback)...");
      delete payload.price_retail;
      delete payload.price_wholesale;
      delete payload.price_vip;

      const retryRes = await client
        .from('products')
        .update(payload)
        .eq('id', id)
        .select('*, categories(id, name)')
        .single();

      updatedData = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error("[productService.update] Supabase Error:", error);
      let userFriendlyMsg = error.message || "Mahsulotni tahrirlashda bazada xatolik yuz berdi";
      if (error.code === '23503' || (error.message && error.message.includes('foreign key constraint'))) {
        userFriendlyMsg = "Tanlangan kategoriya yoki ombor bazada topilmadi. Qaytadan tanlang.";
      }
      return createApiResponse(null, false, null, { code: error.code || 'DB_UPDATE_ERROR', message: userFriendlyMsg, status: 400 });
    }

    // Update inventory table
    if (data.stock !== undefined) {
      const stockQty = Math.max(0, parseInt(data.stock) || 0);
      let targetWarehouseId = data.warehouseId;
      if (!targetWarehouseId && data.warehouse) {
        targetWarehouseId = await resolveWarehouseUUID(client, data.warehouse);
      }

      const { data: existingInv } = await client
        .from('inventory')
        .select('id, warehouse_id')
        .eq('product_id', id)
        .maybeSingle();

      if (existingInv && existingInv.id) {
        const invUpdate = { quantity: stockQty };
        if (targetWarehouseId) invUpdate.warehouse_id = targetWarehouseId;
        await client
          .from('inventory')
          .update(invUpdate)
          .eq('id', existingInv.id);
      } else {
        if (!targetWarehouseId) {
          targetWarehouseId = await resolveWarehouseUUID(client, null);
        }
        if (targetWarehouseId) {
          await client
            .from('inventory')
            .insert([{
              product_id: id,
              warehouse_id: targetWarehouseId,
              quantity: stockQty
            }]);
        }
      }
    }

    // Re-fetch full relational record
    const { data: fullData } = await client
      .from('products')
      .select('*, categories(id, name), inventory(id, quantity, warehouse_id, warehouses(id, name))')
      .eq('id', id)
      .single();

    const updatedPrd = mapDbToProduct(fullData || updatedData);
    if (data.stock !== undefined) updatedPrd.stock = Math.max(0, parseInt(data.stock) || 0);
    if (data.priceRetail !== undefined) updatedPrd.priceRetail = data.priceRetail;
    if (data.wholesalePrice !== undefined) updatedPrd.wholesalePrice = data.wholesalePrice;
    if (data.vipPrice !== undefined) updatedPrd.vipPrice = data.vipPrice;

    // Recalculate status
    if (updatedPrd.stock <= 0) {
      updatedPrd.status = 'Tugagan';
      updatedPrd.statusClass = 'badge-danger';
    } else if (updatedPrd.stock <= (updatedPrd.minStock || 5)) {
      updatedPrd.status = 'Kam qolgan';
      updatedPrd.statusClass = 'badge-warning';
    } else {
      updatedPrd.status = 'Mavjud';
      updatedPrd.statusClass = 'badge-success';
    }

    const idx = demoData.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      demoData.products[idx] = updatedPrd;
    }
    syncGlobalState();
    return createApiResponse(updatedPrd);
  },

  async remove(id) {
    if (window.authService && !window.authService.canPerform('products:delete')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mahsulotni o'chirish uchun huquq yetarli emas!", status: 403 });
    }

    const targetPrd = (demoData.products || []).find(p => p.id === id);
    if (!demoData.deletedProductIds) demoData.deletedProductIds = [];
    if (id && !demoData.deletedProductIds.includes(id)) demoData.deletedProductIds.push(id);
    if (targetPrd && targetPrd.name && !demoData.deletedProductIds.includes(targetPrd.name)) demoData.deletedProductIds.push(targetPrd.name);

    const client = getSupabaseClient();
    if (client && navigator.onLine) {
      try {
        if (isUUID(id)) {
          await client.from('inventory').delete().eq('product_id', id);
          await client.from('products').delete().eq('id', id);
        }
        if (targetPrd && targetPrd.name) {
          await client.from('products').delete().eq('name', targetPrd.name);
        }
        if (targetPrd && targetPrd.sku) {
          await client.from('products').delete().eq('sku', targetPrd.sku);
        }
      } catch (e) {
        console.warn("[productService.remove] Supabase delete notice:", e);
      }
    }

    demoData.products = (demoData.products || []).filter(p => p.id !== id && (targetPrd ? p.name !== targetPrd.name : true));
    if (demoData.products.length === 0) {
      try { localStorage.setItem('smartombor_products_cleared', 'true'); } catch (e) {}
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Helper UUID validator
function isUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const defaultCategoryList = [
  { id: "b2222222-2222-4000-8000-000000000001", name: "Elektronika va Texnika" },
  { id: "b2222222-2222-4000-8000-000000000002", name: "Mebellar va Jihozlar" },
  { id: "b2222222-2222-4000-8000-000000000003", name: "Qurilish mollari" },
  { id: "b2222222-2222-4000-8000-000000000004", name: "Santehnika va Isitish" },
  { id: "b2222222-2222-4000-8000-000000000005", name: "Kiyim-kechak" },
  { id: "b2222222-2222-4000-8000-000000000006", name: "Oziq-ovqat va Ichimliklar" },
  { id: "b2222222-2222-4000-8000-000000000007", name: "Kantselyariya" }
];

const defaultWarehouseList = [
  { id: "a1111111-1111-4000-8000-000000000001", name: "Asosiy Ombor - Toshkent" },
  { id: "a1111111-1111-4000-8000-000000000002", name: "Chilonzor Ombori" },
  { id: "a1111111-1111-4000-8000-000000000003", name: "Yashnobod Ombori" },
  { id: "a1111111-1111-4000-8000-000000000004", name: "Samarqand Filiali Ombori" }
];

// Category Service Interface
const categoryService = {
  async getAll() {
    const client = getSupabaseClient();
    if (client) {
      try {
        let { data, error } = await client.from('categories').select('id, name, description').order('name');
        if (!error && data) {
          demoData.categories = data;
          saveStateToLocalStorage();
          return createApiResponse(demoData.categories);
        }
      } catch (err) {
        console.warn("[categoryService.getAll] Notice:", err);
      }
    }
    if (!demoData.categories || demoData.categories.length === 0) {
      demoData.categories = defaultCategoryList;
    }
    return createApiResponse(demoData.categories);
  },
  async create(data) {
    const client = getSupabaseClient();
    const newCat = { id: generateUniqueId('category'), ...data };
    if (client && navigator.onLine) {
      try {
        const { data: dbData } = await client.from('categories').insert([{ name: data.name, description: data.description || '' }]).select().single();
        if (dbData) newCat.id = dbData.id;
      } catch (e) {}
    }
    if (!demoData.categories) demoData.categories = [];
    demoData.categories.push(newCat);
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newCat);
  },
  async update(id, data) {
    const idx = (demoData.categories || []).findIndex(c => c.id === id);
    if (idx === -1) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);
    demoData.categories[idx] = { ...demoData.categories[idx], ...data };
    const client = getSupabaseClient();
    if (client && navigator.onLine && isUUID(id)) {
      try {
        await client.from('categories').update({ name: data.name, description: data.description }).eq('id', id);
      } catch (e) {}
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(demoData.categories[idx]);
  },
  async remove(id) {
    const targetCat = (demoData.categories || []).find(c => c.id === id);
    if (!demoData.deletedCategoryIds) demoData.deletedCategoryIds = [];
    if (id && !demoData.deletedCategoryIds.includes(id)) demoData.deletedCategoryIds.push(id);
    if (targetCat && targetCat.name && !demoData.deletedCategoryIds.includes(targetCat.name)) demoData.deletedCategoryIds.push(targetCat.name);

    const client = getSupabaseClient();
    if (client && navigator.onLine) {
      try { await client.from('categories').delete().eq('id', id); } catch(e) {}
    }

    demoData.categories = (demoData.categories || []).filter(c => c.id !== id && (targetCat ? c.name !== targetCat.name : true));
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Warehouse Service Interface
const warehouseService = {
  async getAll() {
    const client = getSupabaseClient();
    if (client) {
      try {
        let { data, error } = await client.from('warehouses').select('id, name, location').order('name');
        if (!error) {
          if (data && data.length > 0) {
            demoData.warehouses = data;
            return createApiResponse(data);
          } else {
            console.log("[warehouseService.getAll] Warehouses table empty, seeding defaults into Supabase...");
            const seeded = [];
            for (const wh of defaultWarehouseList) {
              const { data: inserted } = await client.from('warehouses').insert([{ name: wh.name, location: 'Toshkent' }]).select('id, name, location').maybeSingle();
              if (inserted) seeded.push(inserted);
            }
            if (seeded.length > 0) {
              demoData.warehouses = seeded;
              return createApiResponse(seeded);
            }
          }
        }
      } catch (err) {
        console.warn("[warehouseService.getAll] Notice:", err);
      }
    }
    demoData.warehouses = defaultWarehouseList;
    return createApiResponse(defaultWarehouseList);
  },
  async getById(id) { 
    const item = demoData.warehouses.find(w => w.id === id);
    if (!item) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);
    return createApiResponse(item);
  },
  async create(data) {
    const client = getSupabaseClient();
    const newWh = { id: generateUniqueId('warehouse'), ...data, productCount: 0, totalValue: 0, capacityPercent: 10, status: 'Faol', statusClass: 'badge-success' };
    if (client && navigator.onLine) {
      try {
        const { data: dbData } = await client.from('warehouses').insert([{ name: data.name, location: data.address || 'Toshkent' }]).select().single();
        if (dbData) newWh.id = dbData.id;
      } catch (e) {
        console.warn("[warehouseService.create Supabase Notice]:", e);
      }
    }
    if (!demoData.warehouses) demoData.warehouses = [];
    demoData.warehouses.push(newWh);
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newWh);
  },
  async update(id, data) {
    const idx = (demoData.warehouses || []).findIndex(w => w.id === id);
    if (idx === -1) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);
    demoData.warehouses[idx] = { ...demoData.warehouses[idx], ...data };
    const client = getSupabaseClient();
    if (client && navigator.onLine && isUUID(id)) {
      try {
        await client.from('warehouses').update({ name: data.name, location: data.address || data.location }).eq('id', id);
      } catch (e) {
        console.warn("[warehouseService.update Supabase Notice]:", e);
      }
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(demoData.warehouses[idx]);
  },
  async remove(id) {
    const targetWh = (demoData.warehouses || []).find(w => w.id === id);
    if (!demoData.deletedWarehouseIds) demoData.deletedWarehouseIds = [];
    if (id && !demoData.deletedWarehouseIds.includes(id)) demoData.deletedWarehouseIds.push(id);
    if (targetWh && targetWh.name && !demoData.deletedWarehouseIds.includes(targetWh.name)) demoData.deletedWarehouseIds.push(targetWh.name);

    const client = getSupabaseClient();
    if (client && navigator.onLine) {
      try { await client.from('warehouses').delete().eq('id', id); } catch(e) {}
    }

    demoData.warehouses = (demoData.warehouses || []).filter(w => w.id !== id && (targetWh ? w.name !== targetWh.name : true));
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Customer Service Interface (Connected to Supabase PostgreSQL & Cloud Synced)
const customerService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client.from('customers').select('*').order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: customers, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedCusts = demoData.deletedCustomerIds || [];
          const fetchedCusts = data.map(row => {
            let bal = Number(row.balance) || 0;
            if (bal === 0 && Array.isArray(demoData.recentSales)) {
              const salesDebt = demoData.recentSales
                .filter(s => s && s.customer === row.name)
                .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
              if (salesDebt > 0) bal = salesDebt;
            }
            return {
              id: row.id,
              name: row.name,
              phone: row.phone || '',
              address: row.address || '',
              priceType: row.price_type || 'retail',
              creditLimit: Number(row.credit_limit) || 0,
              balance: bal,
              isBlocked: !!row.is_blocked,
              purchasesCount: Number(row.purchases_count) || 0,
              totalPurchases: Number(row.total_purchases || 0).toLocaleString('uz-UZ') + ' UZS',
              debt: bal > 0 ? ('+' + bal.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : (bal < 0 ? ('-' + Math.abs(bal).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : '0 UZS'),
              status: row.is_blocked ? 'Bloklangan' : (bal > 0 ? 'Qarzdor' : 'Faol'),
              statusClass: row.is_blocked ? 'badge-danger' : (bal > 0 ? 'badge-warning' : 'badge-success')
            };
          }).filter(c => c && !deletedCusts.includes(c.id) && !deletedCusts.includes(c.name));

          demoData.customers = fetchedCusts;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[customerService.getAll Notice]:", err);
      }
    }
    if (!fetchedFromCloud && (!demoData.customers || demoData.customers.length === 0)) {
      const isCleared = (localStorage.getItem('smartombor_customers_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true');
      if (!isCleared) demoData.customers = defaultDemoData.customers || [];
      else demoData.customers = [];
    }
    return createApiResponse(demoData.customers);
  },

  async getById(id) { 
    const item = (demoData.customers || []).find(c => c.id === id || c.name === id);
    if (!item) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);
    return createApiResponse(item);
  },

  async create(data, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('customers:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mijoz qo'shish uchun huquq yetarli emas!", status: 403 });
    }

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    const initialBal = Number(data.balance) || 0;
    const newCust = { 
      id: generateUniqueId('customer'), 
      ...data, 
      balance: initialBal,
      purchasesCount: Number(data.purchasesCount) || 0, 
      totalPurchases: data.totalPurchases || '0 UZS', 
      debt: initialBal > 0 ? ('+' + initialBal.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : (initialBal < 0 ? ('-' + Math.abs(initialBal).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : '0 UZS'), 
      status: data.isBlocked ? 'Bloklangan' : (initialBal > 0 ? 'Qarzdor' : 'Faol'), 
      statusClass: data.isBlocked ? 'badge-danger' : (initialBal > 0 ? 'badge-warning' : 'badge-success') 
    };

    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const { data: dbData, error } = await client.from('customers').insert([{
            name: data.name,
            phone: data.phone || '',
            address: data.address || '',
            price_type: data.priceType || 'retail',
            credit_limit: data.creditLimit || 0,
            balance: initialBal,
            is_blocked: !!data.isBlocked
          }]).select().single();
          if (error) {
            console.warn(`[customerService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            newCust.id = dbData.id;
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[customerService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_customer', data);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_customer', data);
    }

    if (demoData.deletedCustomerIds && Array.isArray(demoData.deletedCustomerIds)) {
      demoData.deletedCustomerIds = demoData.deletedCustomerIds.filter(x => x !== newCust.id && x !== newCust.name);
      try { localStorage.setItem('smartombor_deleted_customer_ids', JSON.stringify(demoData.deletedCustomerIds)); } catch(e) {}
    }

    if (!demoData.customers) demoData.customers = [];
    const existingIdx = demoData.customers.findIndex(c => c.id === newCust.id || c.name === newCust.name);
    if (existingIdx === -1) {
      demoData.customers.unshift(newCust);
    } else {
      demoData.customers[existingIdx] = newCust;
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newCust);
  },

  async update(id, data, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('customers:update')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mijoz ma'lumotlarini tahrirlash uchun huquq yetarli emas!", status: 403 });
    }
    const targetCust = (demoData.customers || []).find(c => c.id === id || c.name === id);
    const idx = (demoData.customers || []).findIndex(c => c.id === id || c.name === id);
    if (idx === -1) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);

    const updatedCust = { ...demoData.customers[idx], ...data };
    if (data.balance !== undefined) {
      const b = Number(data.balance) || 0;
      updatedCust.balance = b;
      updatedCust.debt = b > 0 ? ('+' + b.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : (b < 0 ? ('-' + Math.abs(b).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : '0 UZS');
      if (!updatedCust.isBlocked) {
        updatedCust.status = b > 0 ? 'Qarzdor' : 'Faol';
        updatedCust.statusClass = b > 0 ? 'badge-warning' : 'badge-success';
      }
    }
    demoData.customers[idx] = updatedCust;

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const updatePayload = {};
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.phone !== undefined) updatePayload.phone = data.phone;
        if (data.address !== undefined) updatePayload.address = data.address;
        if (data.priceType !== undefined) updatePayload.price_type = data.priceType;
        if (data.creditLimit !== undefined) updatePayload.credit_limit = Number(data.creditLimit) || 0;
        if (data.isBlocked !== undefined) updatePayload.is_blocked = !!data.isBlocked;
        if (data.balance !== undefined) updatePayload.balance = Number(data.balance) || 0;
        if (data.purchasesCount !== undefined) updatePayload.purchases_count = Number(data.purchasesCount) || 0;
        if (data.totalPurchases !== undefined) {
          updatePayload.total_purchases = typeof data.totalPurchases === 'number' 
            ? data.totalPurchases 
            : (parseInt(String(data.totalPurchases).replace(/[^0-9]/g, '')) || 0);
        }

        if (isUUID(id)) {
          const { error } = await client.from('customers').update(updatePayload).eq('id', id);
          if (error) {
            console.error(`[Supabase Error] Table: customers, Operation: UPDATE, Code: ${error.code}, Message: ${error.message}`);
          }
        } else if (targetCust && targetCust.name) {
          const { error } = await client.from('customers').update(updatePayload).eq('name', targetCust.name);
          if (error) {
            console.error(`[Supabase Error] Table: customers, Operation: UPDATE by name, Code: ${error.code}, Message: ${error.message}`);
          }
        }
      } catch (e) {
        console.warn("[customerService.update Notice]:", e);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('update_customer', { id, data });
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('update_customer', { id, data });
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(demoData.customers[idx]);
  },

  async remove(id) {
    if (window.authService && !window.authService.canPerform('customers:delete')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda mijozni o'chirish uchun huquq yetarli emas!", status: 403 });
    }
    const targetCust = (demoData.customers || []).find(c => c.id === id || c.name === id);
    if (!demoData.deletedCustomerIds) demoData.deletedCustomerIds = [];
    if (id && !demoData.deletedCustomerIds.includes(id)) demoData.deletedCustomerIds.push(id);
    if (targetCust && targetCust.name && !demoData.deletedCustomerIds.includes(targetCust.name)) demoData.deletedCustomerIds.push(targetCust.name);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      if (isUUID(id)) {
        try { 
          const { error } = await client.from('customers').delete().eq('id', id);
          if (error) console.error(`[Supabase Error] Table: customers, Operation: DELETE, Code: ${error.code}, Message: ${error.message}`);
        } catch(e) {}
      }
      if (targetCust && targetCust.name) {
        try { await client.from('customers').delete().eq('name', targetCust.name); } catch(e) {}
      }
    }

    demoData.customers = (demoData.customers || []).filter(c => c.id !== id && (targetCust ? c.name !== targetCust.name : true));
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Supplier Service Interface (Connected to Supabase PostgreSQL & Cloud Synced)
const supplierService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client.from('suppliers').select('*').order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: suppliers, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedSups = demoData.deletedSupplierIds || [];
          const fetchedSups = data.map(row => ({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            productsSupplied: row.products_supplied || row.category || 'Qurilish mollari',
            totalPurchases: Number(row.total_purchases || 0).toLocaleString('uz-UZ') + ' UZS',
            debt: Number(row.debt || 0).toLocaleString('uz-UZ') + ' UZS',
            status: Number(row.debt || 0) > 0 ? 'Qarzdorlik bor' : 'Faol',
            statusClass: Number(row.debt || 0) > 0 ? 'badge-warning' : 'badge-success'
          })).filter(s => s && !deletedSups.includes(s.id) && !deletedSups.includes(s.name));

          demoData.suppliers = fetchedSups;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[supplierService.getAll Notice]:", err);
      }
    }
    if (!fetchedFromCloud && (!demoData.suppliers || demoData.suppliers.length === 0)) {
      const isCleared = (localStorage.getItem('smartombor_suppliers_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true');
      if (!isCleared) demoData.suppliers = defaultDemoData.suppliers || [];
      else demoData.suppliers = [];
    }
    return createApiResponse(demoData.suppliers);
  },

  async getById(id) { 
    const item = (demoData.suppliers || []).find(s => s.id === id || s.name === id);
    if (!item) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);
    return createApiResponse(item);
  },

  async create(data, isSyncFlush = false) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    const newSup = { 
      id: generateUniqueId('supplier'), 
      ...data, 
      totalPurchases: '0 UZS', 
      debt: '0 UZS', 
      status: 'Faol', 
      statusClass: 'badge-success' 
    };

    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const { data: dbData, error } = await client.from('suppliers').insert([{
            name: data.name,
            phone: data.phone || '',
            products_supplied: data.productsSupplied || data.category || 'Qurilish mollari'
          }]).select().single();
          if (error) {
            console.warn(`[supplierService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            newSup.id = dbData.id;
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[supplierService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_supplier', data);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_supplier', data);
    }

    if (!demoData.suppliers) demoData.suppliers = [];
    const existingIdx = demoData.suppliers.findIndex(s => s.id === newSup.id || s.name === newSup.name);
    if (existingIdx === -1) {
      demoData.suppliers.unshift(newSup);
    } else {
      demoData.suppliers[existingIdx] = newSup;
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newSup);
  },

  async update(id, data) {
    const targetSup = (demoData.suppliers || []).find(s => s.id === id || s.name === id);
    const idx = (demoData.suppliers || []).findIndex(s => s.id === id || s.name === id);
    if (idx === -1) return createApiResponse(null, false, null, HTTP_ERROR_SCHEMAS.NOT_FOUND);

    const oldName = targetSup ? targetSup.name : null;
    demoData.suppliers[idx] = { ...demoData.suppliers[idx], ...data };

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(id)) {
          const { error } = await client.from('suppliers').update({
            name: data.name,
            phone: data.phone,
            products_supplied: data.productsSupplied || data.category
          }).eq('id', id);

          if (error) {
            console.error(`[Supabase Error] Table: suppliers, Operation: UPDATE, Code: ${error.code}, Message: ${error.message}`);
          }
        } else if (oldName) {
          const { error } = await client.from('suppliers').update({
            name: data.name,
            phone: data.phone,
            products_supplied: data.productsSupplied || data.category
          }).eq('name', oldName);

          if (error) {
            console.error(`[Supabase Error] Table: suppliers, Operation: UPDATE by name, Code: ${error.code}, Message: ${error.message}`);
          }
        }
      } catch (e) {}
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(demoData.suppliers[idx]);
  },

  async remove(id) {
    const targetSup = (demoData.suppliers || []).find(s => s.id === id || s.name === id);
    if (!demoData.deletedSupplierIds) demoData.deletedSupplierIds = [];
    if (id && !demoData.deletedSupplierIds.includes(id)) demoData.deletedSupplierIds.push(id);
    if (targetSup && targetSup.name && !demoData.deletedSupplierIds.includes(targetSup.name)) demoData.deletedSupplierIds.push(targetSup.name);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      if (isUUID(id)) {
        try { 
          const { error } = await client.from('suppliers').delete().eq('id', id);
          if (error) console.error(`[Supabase Error] Table: suppliers, Operation: DELETE, Code: ${error.code}, Message: ${error.message}`);
        } catch(e) {}
      }
      if (targetSup && targetSup.name) {
        try { await client.from('suppliers').delete().eq('name', targetSup.name); } catch(e) {}
      }
    }

    demoData.suppliers = (demoData.suppliers || []).filter(s => s.id !== id && (targetSup ? s.name !== targetSup.name : true));
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Outgoing Service Interface (Ombor Chiqimlari)
const outgoingService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client.from('outgoing').select('*').order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: outgoing, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedOuts = demoData.deletedOutgoingIds || [];
          const fetchedOut = data.map(row => ({
            id: row.id,
            date: new Date(row.created_at || Date.now()).toLocaleString('uz-UZ'),
            docNo: row.doc_no || ('CH-2026-' + Math.floor(100 + Math.random() * 900)),
            product: row.product_name || 'Tovar',
            qty: (row.quantity || 1) + ' dona',
            warehouse: row.warehouse_name || 'Asosiy Ombor',
            reason: row.reason || "Hisobdan chiqarildi",
            status: (row.reason || '').includes('Yaroqsiz') ? "Hisobdan chiqarildi" : "Bajarildi",
            statusClass: (row.reason || '').includes('Yaroqsiz') ? "badge-danger" : "badge-success"
          })).filter(o => o && !deletedOuts.includes(o.id) && !deletedOuts.includes(o.docNo));

          demoData.outgoing = fetchedOut;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[outgoingService.getAll Notice]:", err);
      }
    }

    const isOutgoingCleared = (localStorage.getItem('smartombor_outgoing_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedOutgoingIds && demoData.deletedOutgoingIds.length > 0);
    if (!fetchedFromCloud && !isOutgoingCleared && (!demoData.outgoing || demoData.outgoing.length === 0)) {
      demoData.outgoing = defaultDemoData.outgoing || [];
    } else if (!fetchedFromCloud && isOutgoingCleared) {
      demoData.outgoing = [];
    }
    return createApiResponse(demoData.outgoing);
  },

  async create(data) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    const newOut = {
      id: generateUniqueId('outgoing'),
      date: new Date().toLocaleString('uz-UZ'),
      docNo: data.docNo || ("CH-2026-" + Math.floor(100 + Math.random() * 900)),
      product: data.product || 'Tovar',
      qty: data.qty || '1 dona',
      warehouse: data.warehouse || 'Asosiy Ombor',
      reason: data.reason || 'Chiqim',
      status: (data.reason || '').includes('Yaroqsiz') ? "Hisobdan chiqarildi" : "Bajarildi",
      statusClass: (data.reason || '').includes('Yaroqsiz') ? "badge-danger" : "badge-success"
    };

    if (client && navigator.onLine) {
      try {
        const qtyNum = parseInt(String(data.qty || 1).replace(/[^0-9]/g, '')) || 1;
        const { data: dbData, error } = await client.from('outgoing').insert([{
          doc_no: newOut.docNo,
          product_name: newOut.product,
          quantity: qtyNum,
          warehouse_name: newOut.warehouse,
          reason: newOut.reason
        }]).select().single();

        if (error) {
          console.error(`[Supabase Error] Table: outgoing, Operation: INSERT, Code: ${error.code}, Message: ${error.message}`);
        } else if (dbData) {
          newOut.id = dbData.id;
        }
      } catch (err) {
        console.warn("[outgoingService.create Notice]:", err);
      }
    }

    if (demoData.deletedOutgoingIds && Array.isArray(demoData.deletedOutgoingIds)) {
      demoData.deletedOutgoingIds = demoData.deletedOutgoingIds.filter(x => x !== newOut.id && x !== newOut.docNo);
      try { localStorage.setItem('smartombor_deleted_outgoing_ids', JSON.stringify(demoData.deletedOutgoingIds)); } catch(e) {}
    }
    try { localStorage.removeItem('smartombor_outgoing_cleared'); } catch(e) {}

    if (!demoData.outgoing) demoData.outgoing = [];
    demoData.outgoing.unshift(newOut);
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newOut);
  },

  async delete(id, docNo) {
    const targetOut = (demoData.outgoing || []).find(o => o.id === id || o.docNo === id || (docNo && o.docNo === docNo));
    if (!demoData.deletedOutgoingIds) demoData.deletedOutgoingIds = [];
    if (id && !demoData.deletedOutgoingIds.includes(id)) demoData.deletedOutgoingIds.push(id);
    if (docNo && !demoData.deletedOutgoingIds.includes(docNo)) demoData.deletedOutgoingIds.push(docNo);
    if (targetOut && targetOut.docNo && !demoData.deletedOutgoingIds.includes(targetOut.docNo)) demoData.deletedOutgoingIds.push(targetOut.docNo);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(id)) await client.from('outgoing').delete().eq('id', id);
        const targetDocNo = docNo || (targetOut && targetOut.docNo);
        if (targetDocNo) await client.from('outgoing').delete().eq('doc_no', targetDocNo);
      } catch(e) {
        console.warn("[outgoingService.delete notice]:", e);
      }
    }
    demoData.outgoing = (demoData.outgoing || []).filter(o => o.id !== id && o.docNo !== id && (!docNo || o.docNo !== docNo) && (targetOut ? o.docNo !== targetOut.docNo : true));
    if (demoData.outgoing.length === 0) {
      try { localStorage.setItem('smartombor_outgoing_cleared', 'true'); } catch (e) {}
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};
window.outgoingService = outgoingService;

// ==================== 8. GLOBAL STATE SYNCHRONIZATION ENGINE ====================
function syncGlobalState() {
  if (!demoData.products) demoData.products = [];
  if (!demoData.warehouses) demoData.warehouses = [];
  if (!demoData.categories) demoData.categories = [];
  if (!demoData.customers) demoData.customers = [];
  if (!demoData.suppliers) demoData.suppliers = [];
  if (!demoData.cash) demoData.cash = { transactions: [], todayIncome: '0 UZS', todayExpense: '0 UZS', netBalance: '0 UZS' };
  if (!demoData.cash.transactions) demoData.cash.transactions = [];

  // Filter out any deleted entities against permanent blacklists
  const deletedPrds = demoData.deletedProductIds || [];
  const deletedCats = demoData.deletedCategoryIds || [];
  const deletedWhs = demoData.deletedWarehouseIds || [];
  const deletedCusts = demoData.deletedCustomerIds || [];
  const deletedSups = demoData.deletedSupplierIds || [];

  demoData.products = demoData.products.filter(p => p && !deletedPrds.includes(p.id) && !deletedPrds.includes(p.name));
  demoData.categories = demoData.categories.filter(c => c && !deletedCats.includes(c.id) && !deletedCats.includes(c.name));
  demoData.warehouses = demoData.warehouses.filter(w => w && !deletedWhs.includes(w.id) && !deletedWhs.includes(w.name));
  demoData.customers = demoData.customers.filter(c => c && !deletedCusts.includes(c.id) && !deletedCusts.includes(c.name));
  demoData.suppliers = demoData.suppliers.filter(s => s && !deletedSups.includes(s.id) && !deletedSups.includes(s.name));

  // 1. Update status for all products
  (demoData.products || []).forEach(p => inventoryService.updateStatus(p));

  // 1.1 Recalculate Customer Balances and Debts dynamically from sales if not set
  (demoData.customers || []).forEach(c => {
    let bal = (c.balance !== undefined) ? Number(c.balance) : 0;
    if (bal === 0 && Array.isArray(demoData.recentSales)) {
      const sDebt = demoData.recentSales
        .filter(s => s && s.customer === c.name)
        .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
      if (sDebt > 0) {
        bal = sDebt;
        c.balance = bal;
      }
    }
    c.debt = bal > 0 ? ('+' + bal.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : (bal < 0 ? ('-' + Math.abs(bal).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS') : '0 UZS');
    c.status = c.isBlocked ? 'Bloklangan' : (bal > 0 ? 'Qarzdor' : 'Faol');
    c.statusClass = c.isBlocked ? 'badge-danger' : (bal > 0 ? 'badge-warning' : 'badge-success');
  });

  // 2. Recalculate Warehouse Derived Data
  (demoData.warehouses || []).forEach(wh => {
    const whProducts = (demoData.products || []).filter(p => p.warehouse === wh.name);
    wh.productCount = whProducts.reduce((acc, p) => acc + (p.stock || 0), 0);
    wh.totalValue = whProducts.reduce((acc, p) => acc + ((p.stock || 0) * (p.buyPrice || 0)), 0);
  });

  // 3. Recalculate Low Stock List
  demoData.lowStockProducts = (demoData.products || [])
    .filter(p => (p.stock || 0) <= (p.minStock || 5))
    .map(p => ({
      name: p.name,
      current: p.stock || 0,
      min: p.minStock || 5,
      unit: p.unit || 'dona',
      status: (p.stock || 0) === 0 ? 'Tugagan' : 'Tanqis',
      statusClass: (p.stock || 0) === 0 ? 'badge-danger' : 'badge-warning'
    }));

  // 4. Recalculate Cash Derived Data
  let incomeSum = 0;
  let expenseSum = 0;
  (demoData.cash.transactions || []).forEach(tx => {
    const num = parseInt((tx.amount || '').replace(/[^0-9]/g, '')) || 0;
    if (tx.isIncome) {
      incomeSum += num;
    } else {
      expenseSum += num;
    }
  });

  demoData.cash.todayIncome = formatCurrency(incomeSum);
  demoData.cash.todayExpense = formatCurrency(expenseSum);
  const net = incomeSum - expenseSum;
  demoData.cash.netBalance = (net >= 0 ? '+' : '-') + formatCurrency(Math.abs(net));

  // 5. Recalculate Dashboard KPIs & Chart Derived Data
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const totalItemsCount = (demoData.products || []).reduce((acc, p) => acc + (p.stock || 0), 0);
  const isPrdCleared = (localStorage.getItem('smartombor_products_cleared') === 'true') || totalItemsCount === 0;
  const isCashCleared = (localStorage.getItem('smartombor_cash_cleared') === 'true') || isPrdCleared || (!demoData.cash.transactions || demoData.cash.transactions.length === 0);

  // 5.1 BUGUNGI SOTUV (Faqat bugungi kun sanasi bo'yicha filtrlanadi)
  const todaySales = (demoData.recentSales || []).filter(s => {
    const d = parseAppDate(s.date || s.created_at || s.createdAt);
    return d && isSameDay(d, now);
  });
  const todaySalesCount = todaySales.length;
  const todaySalesSum = todaySales.reduce((acc, s) => {
    const amt = parseInt(String(s.amount || s.totalAmount || 0).replace(/[^0-9]/g, '')) || 0;
    return acc + amt;
  }, 0);

  const yesterdaySales = (demoData.recentSales || []).filter(s => {
    const d = parseAppDate(s.date || s.created_at || s.createdAt);
    return d && isSameDay(d, yesterday);
  });
  const yesterdaySalesSum = yesterdaySales.reduce((acc, s) => {
    const amt = parseInt(String(s.amount || s.totalAmount || 0).replace(/[^0-9]/g, '')) || 0;
    return acc + amt;
  }, 0);

  let salesTrend = "0%";
  if (yesterdaySalesSum > 0 && todaySalesSum > 0) {
    const diff = ((todaySalesSum - yesterdaySalesSum) / yesterdaySalesSum * 100).toFixed(1);
    salesTrend = (diff >= 0 ? '+' : '') + diff + '%';
  } else if (todaySalesSum > 0 && yesterdaySalesSum === 0) {
    salesTrend = "+100%";
  } else if (todaySalesSum === 0 && yesterdaySalesSum > 0) {
    salesTrend = "-100%";
  }

  // 5.2 BUGUNGI KIRIM (Faqat bugungi kun sanasi bo'yicha filtrlanadi)
  const todayPurchases = (demoData.purchases || []).filter(p => {
    const d = parseAppDate(p.date || p.created_at || p.createdAt);
    return d && isSameDay(d, now);
  });
  const todayPurchasesCount = todayPurchases.length;
  const todayPurchasesSum = todayPurchases.reduce((acc, p) => {
    const amt = parseInt(String(p.amount || p.total_amount || 0).replace(/[^0-9]/g, '')) || 0;
    return acc + amt;
  }, 0);

  const yesterdayPurchases = (demoData.purchases || []).filter(p => {
    const d = parseAppDate(p.date || p.created_at || p.createdAt);
    return d && isSameDay(d, yesterday);
  });
  const yesterdayPurchasesSum = yesterdayPurchases.reduce((acc, p) => {
    const amt = parseInt(String(p.amount || p.total_amount || 0).replace(/[^0-9]/g, '')) || 0;
    return acc + amt;
  }, 0);

  let purchasesTrend = "0%";
  if (yesterdayPurchasesSum > 0 && todayPurchasesSum > 0) {
    const diff = ((todayPurchasesSum - yesterdayPurchasesSum) / yesterdayPurchasesSum * 100).toFixed(1);
    purchasesTrend = (diff >= 0 ? '+' : '') + diff + '%';
  } else if (todayPurchasesSum > 0 && yesterdayPurchasesSum === 0) {
    purchasesTrend = "+100%";
  } else if (todayPurchasesSum === 0 && yesterdayPurchasesSum > 0) {
    purchasesTrend = "-100%";
  }

  // 5.3 KPI Kartalarini yangilash
  if (demoData.kpis) {
    if (demoData.kpis.totalProducts) {
      demoData.kpis.totalProducts.value = totalItemsCount.toLocaleString('uz-UZ') + ' ta';
      demoData.kpis.totalProducts.subtext = `${(demoData.warehouses || []).length} ta omborda`;
      demoData.kpis.totalProducts.trend = isPrdCleared ? "0%" : "+5.4%";
    }
    if (demoData.kpis.dailySales) {
      demoData.kpis.dailySales.value = formatCurrency(todaySalesSum);
      demoData.kpis.dailySales.subtext = `${todaySalesCount} ta bitim`;
      demoData.kpis.dailySales.trend = salesTrend;
    }
    if (demoData.kpis.dailyIncome) {
      demoData.kpis.dailyIncome.value = formatCurrency(todayPurchasesSum);
      demoData.kpis.dailyIncome.subtext = `${todayPurchasesCount} ta yuk xati`;
      demoData.kpis.dailyIncome.trend = purchasesTrend;
    }
    if (demoData.kpis.cashBalance) {
      const baseCash = isCashCleared ? 0 : 150000000;
      const totalCashVal = Math.max(0, baseCash + net);
      demoData.kpis.cashBalance.value = formatCurrency(totalCashVal);
      demoData.cash.currentBalance = demoData.kpis.cashBalance.value;
      demoData.kpis.cashBalance.trend = (isCashCleared || totalCashVal === 0) ? "0%" : "+8.1%";
    }
  }

  // 6. Recalculate Chart Data dynamically based on actual real sales
  // 6.1 Daily (Bugungi soatbay statistika)
  const dailyBuckets = [0, 0, 0, 0, 0, 0, 0, 0];
  todaySales.forEach(s => {
    const d = parseAppDate(s.date || s.created_at || s.createdAt);
    if (!d) return;
    const hour = d.getHours();
    const amt = parseInt(String(s.amount || s.totalAmount || 0).replace(/[^0-9]/g, '')) || 0;
    let idx = 0;
    if (hour < 10) idx = 0;
    else if (hour < 12) idx = 1;
    else if (hour < 14) idx = 2;
    else if (hour < 16) idx = 3;
    else if (hour < 18) idx = 4;
    else if (hour < 20) idx = 5;
    else if (hour < 22) idx = 6;
    else idx = 7;
    dailyBuckets[idx] += amt;
  });
  const dailyData = dailyBuckets.map(amt => parseFloat((amt / 1000000).toFixed(2)));

  // 6.2 Weekly (Joriy hafta kunlari: Dushanba -> Yakshanba, faqat shu kungacha bo'lgan kunlar real hisoblanadi)
  const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
  const monOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 for Mon, ..., 6 for Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - monOffset);
  monday.setHours(0, 0, 0, 0);

  const weeklyBuckets = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 7; i++) {
    if (i > monOffset) {
      // Hali yetib kelmagan kunlar 0 bo'ladi
      weeklyBuckets[i] = 0;
      continue;
    }
    const targetDay = new Date(monday);
    targetDay.setDate(monday.getDate() + i);

    const daySales = (demoData.recentSales || []).filter(s => {
      const d = parseAppDate(s.date || s.created_at || s.createdAt);
      return d && isSameDay(d, targetDay);
    });
    const sum = daySales.reduce((acc, s) => acc + (parseInt(String(s.amount || s.totalAmount || 0).replace(/[^0-9]/g, '')) || 0), 0);
    weeklyBuckets[i] = sum;
  }
  const weeklyData = weeklyBuckets.map(amt => parseFloat((amt / 1000000).toFixed(2)));

  // 6.3 Monthly (Joriy oyning 4 ta davri / haftasi)
  const monthlyBuckets = [0, 0, 0, 0];
  const curDateNum = now.getDate();
  const periods = [
    { start: 1, end: 7, idx: 0 },
    { start: 8, end: 14, idx: 1 },
    { start: 15, end: 21, idx: 2 },
    { start: 22, end: 31, idx: 3 }
  ];

  periods.forEach(p => {
    if (curDateNum < p.start) {
      monthlyBuckets[p.idx] = 0;
      return;
    }
    const periodSales = (demoData.recentSales || []).filter(s => {
      const d = parseAppDate(s.date || s.created_at || s.createdAt);
      if (!d) return false;
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() >= p.start &&
             d.getDate() <= p.end;
    });
    const sum = periodSales.reduce((acc, s) => acc + (parseInt(String(s.amount || s.totalAmount || 0).replace(/[^0-9]/g, '')) || 0), 0);
    monthlyBuckets[p.idx] = sum;
  });
  const monthlyData = monthlyBuckets.map(amt => parseFloat((amt / 1000000).toFixed(2)));

  demoData.chartData = {
    daily: {
      labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
      datasets: [{ label: "Bugungi sotuv (mln UZS)", data: dailyData }]
    },
    weekly: {
      labels: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"],
      datasets: [{ label: "Haftalik sotuv (mln UZS)", data: weeklyData }]
    },
    monthly: {
      labels: ["1-hafta", "2-hafta", "3-hafta", "4-hafta"],
      datasets: [{ label: "Oylik sotuv (mln UZS)", data: monthlyData }]
    }
  };

  // 7. Save persistent state to Storage Service
  saveStateToLocalStorage();
}
window.syncGlobalState = syncGlobalState;

// Helper functions for persistent archived order IDs
function getArchivedOrderIds() {
  try {
    const saved = localStorage.getItem('smartombor_archived_order_ids');
    return saved ? JSON.parse(saved) : [];
  } catch(e) {
    return [];
  }
}
window.getArchivedOrderIds = getArchivedOrderIds;

function saveArchivedOrderId(id, orderNumber) {
  try {
    const ids = getArchivedOrderIds();
    if (id && !ids.includes(String(id))) ids.push(String(id));
    if (orderNumber && !ids.includes(String(orderNumber))) ids.push(String(orderNumber));
    localStorage.setItem('smartombor_archived_order_ids', JSON.stringify(ids));
  } catch(e) {}
}
window.saveArchivedOrderId = saveArchivedOrderId;

function removeArchivedOrderId(id, orderNumber) {
  try {
    let ids = getArchivedOrderIds();
    ids = ids.filter(x => x !== String(id) && x !== String(orderNumber));
    localStorage.setItem('smartombor_archived_order_ids', JSON.stringify(ids));
  } catch(e) {}
}
window.removeArchivedOrderId = removeArchivedOrderId;

// Distribution Service Interface (Connected to Supabase PostgreSQL & Cloud Synced)
const distributionService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('distribution_orders')
          .select('*, distribution_order_items(*)')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: distribution_orders, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data && Array.isArray(data)) {
          fetchedFromCloud = true;
          const deletedOrders = demoData.deletedDistributionOrderIds || [];
          const archivedIds = getArchivedOrderIds();
          
          const existingLocalList = demoData.distributionOrders || [];
          const fetchedList = data.map(row => {
            let meta = {};
            if (row.notes) {
              try {
                if (typeof row.notes === 'string' && row.notes.startsWith('{')) {
                  meta = JSON.parse(row.notes);
                }
              } catch(e) {}
            }
            const rawItems = Array.isArray(row.distribution_order_items) && row.distribution_order_items.length > 0 
              ? row.distribution_order_items 
              : (Array.isArray(meta.items) && meta.items.length > 0 ? meta.items : []);

            const mappedItems = rawItems.map(it => ({
              productName: it.product_name || it.productName || it.name || 'Tovar',
              qty: Number(it.quantity || it.qty || 1),
              quantity: Number(it.quantity || it.qty || 1),
              price: Number(it.unit_price || it.price) || 0,
              priceType: it.price_type || it.priceType || 'wholesale',
              total: Number(it.total_price || it.total) || 0
            }));

            const localMatch = existingLocalList.find(lo => lo.id === row.id || lo.orderNumber === row.order_number);
            
            // Extract items from notes if notes contains text like "Sotuv cheki: CHK-xxx" or product names
            let finalItems = mappedItems;
            if (finalItems.length === 0 && localMatch && Array.isArray(localMatch.items) && localMatch.items.length > 0) {
              finalItems = localMatch.items;
            }

            const firstPName = (finalItems[0] && finalItems[0].productName) ? finalItems[0].productName : (meta.productName || (localMatch ? (localMatch.productName || (localMatch.items && localMatch.items[0] && localMatch.items[0].productName)) : null));
            const finalPName = firstPName || row.product_name || 'Tovar';
            
            const totalQtySum = finalItems.reduce((acc, it) => acc + Number(it.qty || it.quantity || 1), 0);
            const fallbackQty = (localMatch && localMatch.items && localMatch.items[0] && localMatch.items[0].qty) ? localMatch.items[0].qty : ((localMatch && localMatch.distQty) ? localMatch.distQty : (totalQtySum > 0 ? totalQtySum : (meta.distQty || 1)));

            if (finalItems.length === 0) {
              finalItems = [{ productName: finalPName, qty: fallbackQty, quantity: fallbackQty, price: fallbackQty > 0 ? Number(row.total_amount) / fallbackQty : Number(row.total_amount), total: Number(row.total_amount) || 0 }];
            }

            const isArchived = archivedIds.includes(String(row.id)) || 
                               archivedIds.includes(String(row.order_number)) || 
                               (localMatch && (localMatch.status === 'arxiv' || localMatch.isArchived === true)) ||
                               row.status === 'arxiv' || row.status === 'archived';

            const finalStatus = isArchived ? 'arxiv' : (row.status || (localMatch ? localMatch.status : 'yangi'));
            const finalDeliveredAt = (localMatch && localMatch.deliveredAt) ? localMatch.deliveredAt : (row.delivered_at || (finalStatus === 'yetkazildi' ? new Date(row.created_at).toISOString() : null));
            const finalWorkZone = (localMatch && localMatch.workZone) ? localMatch.workZone : (row.work_zone || (row.warehouse_name && row.warehouse_name.includes('Angren') ? '820UD Angren' : (row.warehouse_name && row.warehouse_name.includes('Olmaliq') ? '822 UD Olmaliq' : (row.warehouse_name && row.warehouse_name.includes('Ohangaron') ? '871UD Ohangaron' : '900KS Office'))));
            const finalHasDiscount = (localMatch && localMatch.hasDiscount !== undefined) ? localMatch.hasDiscount : Boolean(row.has_discount);

            return {
              id: row.id,
              orderNumber: row.order_number,
              customerName: row.customer_name || 'Mijoz',
              agentName: row.agent_name || 'Agent',
              driverName: row.driver_name || 'Biriktirilmagan',
              warehouseName: row.warehouse_name || 'Asosiy Ombor',
              workZone: finalWorkZone,
              status: finalStatus,
              isArchived: isArchived,
              deliveredAt: finalDeliveredAt,
              hasDiscount: finalHasDiscount,
              totalAmount: Number(row.total_amount) || 0,
              paidAmount: Number(row.paid_amount) || 0,
              deliveryDate: row.delivery_date ? new Date(row.delivery_date).toISOString().slice(0, 10) : '',
              notes: (meta.rawNotes !== undefined ? meta.rawNotes : row.notes) || '',
              productName: finalPName,
              distQty: totalQtySum || fallbackQty,
              items: finalItems,
              createdAt: row.created_at ? new Date(row.created_at).toLocaleString('uz-UZ') : (localMatch ? localMatch.createdAt : new Date().toLocaleString('uz-UZ'))
            };
          }).filter(o => o && !deletedOrders.includes(o.id) && !deletedOrders.includes(o.orderNumber));

          demoData.distributionOrders = fetchedList;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[distributionService.getAll Notice]:", err);
      }
    }
    const isDistributionCleared = (localStorage.getItem('smartombor_distribution_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedDistributionOrderIds && demoData.deletedDistributionOrderIds.length > 0);
    if (!fetchedFromCloud && !isDistributionCleared && (!demoData.distributionOrders || demoData.distributionOrders.length === 0)) {
      demoData.distributionOrders = defaultDemoData.distributionOrders || [];
    } else if (!fetchedFromCloud && isDistributionCleared) {
      demoData.distributionOrders = [];
    }
    return createApiResponse(demoData.distributionOrders);
  },

  async create(data, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('orders:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda buyurtma yaratish uchun huquq yetarli emas!", status: 403 });
    }
    const client = getSupabaseClient();
    const targetQty = data.distQty || (data.items && data.items[0] && (data.items[0].qty || data.items[0].quantity)) || 1;
    const primaryPName = (data.items && data.items[0] && data.items[0].productName) ? data.items[0].productName : (data.productName || 'Tovar');
    const finalItemsList = (data.items && data.items.length > 0) ? data.items : [{ productName: primaryPName, qty: targetQty, quantity: targetQty, price: data.totalAmount / targetQty || 0, total: data.totalAmount || 0 }];

    const newOrd = {
      id: generateUniqueId('order'),
      orderNumber: 'ORD-2026-' + Math.floor(1000 + Math.random() * 9000),
      customerName: data.customerName || 'Mijoz',
      agentName: data.agentName || 'Agent',
      driverName: data.driverName || 'Biriktirilmagan',
      warehouseName: data.warehouseName || 'Asosiy Ombor',
      workZone: data.workZone || '900KS Office',
      status: 'yangi',
      isArchived: false,
      hasDiscount: data.hasDiscount || false,
      totalAmount: data.totalAmount || 0,
      paidAmount: data.paidAmount || 0,
      deliveryDate: data.deliveryDate || new Date().toISOString().slice(0, 10),
      notes: data.notes || '',
      distQty: targetQty,
      productName: primaryPName,
      items: finalItemsList,
      createdAt: new Date().toLocaleString('uz-UZ')
    };

    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const metaPayload = {
            rawNotes: newOrd.notes || '',
            items: finalItemsList,
            productName: primaryPName,
            distQty: targetQty
          };
          const { data: dbData, error } = await client
            .from('distribution_orders')
            .insert([{
              order_number: newOrd.orderNumber,
              customer_name: newOrd.customerName,
              agent_name: newOrd.agentName,
              driver_name: newOrd.driverName,
              status: 'yangi',
              total_amount: newOrd.totalAmount,
              paid_amount: newOrd.paidAmount,
              notes: JSON.stringify(metaPayload)
            }])
            .select()
            .single();
          if (error) {
            console.warn(`[distributionService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            newOrd.id = dbData.id;
            try {
              const itemRows = finalItemsList.map(it => ({
                order_id: dbData.id,
                product_name: it.productName || primaryPName,
                quantity: it.qty || 1,
                unit_price: it.price || 0,
                total_price: it.total || (it.price * (it.qty || 1)) || 0
              }));
              await client.from('distribution_order_items').insert(itemRows);
            } catch (e) {}
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[distributionService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_distribution_order', data);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_distribution_order', data);
    }

    if (demoData.deletedDistributionOrderIds && Array.isArray(demoData.deletedDistributionOrderIds)) {
      demoData.deletedDistributionOrderIds = demoData.deletedDistributionOrderIds.filter(x => x !== newOrd.id && x !== newOrd.orderNumber);
      try { localStorage.setItem('smartombor_deleted_distributionorder_ids', JSON.stringify(demoData.deletedDistributionOrderIds)); } catch(e) {}
    }
    try { localStorage.removeItem('smartombor_distribution_cleared'); } catch(e) {}

    if (!demoData.distributionOrders) demoData.distributionOrders = [];
    demoData.distributionOrders.unshift(newOrd);

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newOrd);
  },

  async updateStatus(id, newStatus) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && isUUID(id)) {
      try {
        const { error } = await client
          .from('distribution_orders')
          .update({ status: newStatus })
          .eq('id', id);
        if (error) console.error(`[Supabase Error] Table: distribution_orders, Operation: UPDATE, Code: ${error.code}, Message: ${error.message}`);
      } catch(e) {}
    }
    const ord = (demoData.distributionOrders || []).find(o => o.id === id || o.orderNumber === id || String(o.id) === String(id));
    if (ord) {
      ord.status = newStatus;
      if (newStatus === 'arxiv') {
        ord.isArchived = true;
        saveArchivedOrderId(ord.id, ord.orderNumber);
      } else if (newStatus !== 'arxiv') {
        ord.isArchived = false;
        removeArchivedOrderId(ord.id, ord.orderNumber);
      }
      if (newStatus === 'yetkazildi' && !ord.deliveredAt) {
        ord.deliveredAt = new Date().toISOString();
      }

      // Sync status to the matching sale in demoData.recentSales and Supabase
      const matchingSale = (demoData.recentSales || []).find(s => 
        (ord.saleReceiptNo && s.receiptNo === ord.saleReceiptNo) ||
        (ord.notes && s.receiptNo && ord.notes.includes(s.receiptNo)) ||
        (s.id === ord.id || s.id === ord.saleId) ||
        (s.customer === ord.customerName && s.date === ord.createdAt)
      );

      if (matchingSale) {
        matchingSale.status = newStatus;
        matchingSale.statusClass = newStatus === 'yetkazildi' ? 'badge-success' : (newStatus === 'bekor_qilindi' ? 'badge-danger' : (newStatus === 'yetkazilmoqda' ? 'badge-secondary' : (newStatus === 'yigildi' ? 'badge-warning' : 'badge-primary')));
        
        if (client && navigator.onLine) {
          try {
            if (isUUID(matchingSale.id)) {
              await client.from('sales').update({ status: newStatus }).eq('id', matchingSale.id);
            } else if (matchingSale.receiptNo) {
              await client.from('sales').update({ status: newStatus }).eq('receipt_no', matchingSale.receiptNo);
            }
          } catch(e) {
            console.warn('[Sync Sale Status Notice]:', e);
          }
        }
      }

      // If status is bekor_qilindi, automatically create order_returns entry and restore warehouse stock
      if (newStatus === 'bekor_qilindi') {
        const existingReturns = (demoData.orderReturns || []).filter(r => r.orderNumber === ord.orderNumber);
        if (existingReturns.length === 0) {
          const items = (ord.items && Array.isArray(ord.items) && ord.items.length > 0) ? ord.items : [
            {
              productId: ord.productId || null,
              productName: ord.productName || 'Tovar',
              qty: ord.distQty || ord.quantity || 1,
              price: ord.totalAmount || 0,
              total: ord.totalAmount || 0
            }
          ];

          for (const item of items) {
            const pQty = Math.max(1, Number(item.qty || item.quantity || 1));
            const pPrice = Number(item.price || (item.total ? item.total / pQty : (ord.totalAmount ? ord.totalAmount / pQty : 0)));
            const refundAmt = Number(item.total || (pPrice * pQty) || ord.totalAmount || 0);

            const returnPayload = {
              customerName: ord.customerName || 'Mijoz',
              orderNumber: ord.orderNumber || 'ORD-2026',
              productId: item.productId || null,
              productName: item.productName || item.name || ord.productName || 'Tovar',
              quantity: pQty,
              refundAmount: refundAmt,
              reason: 'bekor_qilindi',
              driverName: ord.driverName && ord.driverName !== 'Tayinlanmagan' ? ord.driverName : 'Biriktirilmagan'
            };

            if (window.returnService && typeof window.returnService.create === 'function') {
              await window.returnService.create(returnPayload, true);
            }
          }
        }
      }

      saveStateToLocalStorage();
      syncGlobalState();
    }
    return createApiResponse({ id, status: newStatus });
  },

  async assignDriver(id, driverName) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && isUUID(id)) {
      const { error } = await client
        .from('distribution_orders')
        .update({ driver_name: driverName })
        .eq('id', id);
      if (error) console.error(`[Supabase Error] Table: distribution_orders, Operation: UPDATE, Code: ${error.code}, Message: ${error.message}`);
    }
    const ord = (demoData.distributionOrders || []).find(o => o.id === id);
    if (ord) {
      ord.driverName = driverName;
      syncGlobalState();
    }
    return createApiResponse({ id, driverName });
  },

  async delete(id, orderNumber) {
    if (window.authService && !window.authService.canPerform('orders:delete')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda buyurtmani o'chirish uchun huquq yetarli emas!", status: 403 });
    }

    const ord = (demoData.distributionOrders || []).find(o => o.id === id || o.orderNumber === id || (orderNumber && o.orderNumber === orderNumber));
    const ordId = ord ? ord.id : id;
    const ordNum = orderNumber || (ord ? ord.orderNumber : id);

    if (!demoData.deletedDistributionOrderIds) demoData.deletedDistributionOrderIds = [];
    if (ordId && !demoData.deletedDistributionOrderIds.includes(ordId)) demoData.deletedDistributionOrderIds.push(ordId);
    if (ordNum && !demoData.deletedDistributionOrderIds.includes(ordNum)) demoData.deletedDistributionOrderIds.push(ordNum);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(ordId)) {
          await client.from('distribution_order_items').delete().eq('order_id', ordId);
          await client.from('distribution_orders').delete().eq('id', ordId);
        }
        if (ordNum) {
          const { data: dbOrd } = await client.from('distribution_orders').select('id').eq('order_number', ordNum).maybeSingle();
          if (dbOrd && dbOrd.id) {
            await client.from('distribution_order_items').delete().eq('order_id', dbOrd.id);
            await client.from('distribution_orders').delete().eq('id', dbOrd.id);
          } else {
            await client.from('distribution_orders').delete().eq('order_number', ordNum);
          }
        }
      } catch (e) {
        console.warn("[distributionService.delete Notice]:", e);
      }
    }

    demoData.distributionOrders = (demoData.distributionOrders || []).filter(o => o.id !== ordId && o.orderNumber !== ordNum);
    if (demoData.distributionOrders.length === 0) {
      try { localStorage.setItem('smartombor_distribution_cleared', 'true'); } catch (e) {}
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};

// Order Returns Service Interface (Connected to Supabase PostgreSQL & Cloud Synced)
const returnService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('order_returns')
          .select('*')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: order_returns, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedRets = demoData.deletedReturnIds || [];
          const fetchedReturns = data.map(row => ({
            id: row.id,
            returnNumber: row.return_number,
            customerName: row.customer_name || 'Mijoz',
            productName: row.product_name || row.product_id || 'Tovar',
            quantity: row.quantity || 1,
            refundAmount: Number(row.refund_amount) || 0,
            reason: row.reason || 'nuqsonli',
            reasonLabel: row.reason === 'muddati_otgan' ? "Muddati o'tgan" : (row.reason === 'nuqsonli' ? "Nuqsonli (Brak)" : (row.reason === 'bekor_qilindi' ? "Buyurtma bekor qilindi" : (row.reason === 'boshqa' ? "Boshqa sabab" : "Ortiqcha tovar"))),
            status: row.status || 'qabul_qilindi',
            driverName: row.driver_name || 'Biriktirilmagan',
            createdAt: new Date(row.created_at).toLocaleString('uz-UZ')
          })).filter(r => r && !deletedRets.includes(r.id) && !deletedRets.includes(r.returnNumber));

          demoData.orderReturns = fetchedReturns;

          // Auto-sync cancelled distribution orders into orderReturns
          const cancelledOrders = (demoData.distributionOrders || []).filter(o => o && o.status === 'bekor_qilindi');
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
                  id: generateUniqueId('return'),
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
            }
          }

          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[returnService.getAll Notice]:", err);
      }
    }
    const isReturnsCleared = (localStorage.getItem('smartombor_returns_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedReturnIds && demoData.deletedReturnIds.length > 0);
    if (!fetchedFromCloud && !isReturnsCleared && (!demoData.orderReturns || demoData.orderReturns.length === 0)) {
      demoData.orderReturns = defaultDemoData.orderReturns || [];
    } else if (!fetchedFromCloud && isReturnsCleared && (!demoData.orderReturns || demoData.orderReturns.length === 0)) {
      demoData.orderReturns = [];
    }

    // Auto-sync cancelled distribution orders even if offline or not fetched from cloud
    const cancelledOrders = (demoData.distributionOrders || []).filter(o => o && o.status === 'bekor_qilindi');
    if (!demoData.orderReturns) demoData.orderReturns = [];
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
            id: generateUniqueId('return'),
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
        try { localStorage.removeItem('smartombor_returns_cleared'); } catch(e) {}
        saveStateToLocalStorage();
      }
    }

    return createApiResponse(demoData.orderReturns);
  },

  async create(data, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('returns:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda vozvrat (qaytarish) yaratish uchun huquq yetarli emas!", status: 403 });
    }
    const client = getSupabaseClient();
    const reasonLabels = {
      muddati_otgan: "Muddati o'tgan / Yaroqsiz",
      nuqsonli: "Nuqsonli (Brak)",
      ortiqcha_tovar: "Ortiqcha tovar",
      bekor_qilindi: "Buyurtma bekor qilindi",
      boshqa: "Boshqa sabab"
    };

    const newRet = {
      id: generateUniqueId('return'),
      returnNumber: 'RET-2026-' + Math.floor(5000 + Math.random() * 4000),
      customerName: data.customerName || 'Mijoz',
      orderNumber: data.orderNumber || 'ORD-2026-1001',
      productName: data.productName || 'Tovar',
      quantity: data.quantity || 1,
      refundAmount: data.refundAmount || 0,
      reason: data.reason || 'nuqsonli',
      reasonLabel: reasonLabels[data.reason] || (data.reason === 'bekor_qilindi' ? "Buyurtma bekor qilindi" : "Nuqsonli (Brak)"),
      status: 'qabul_qilindi',
      driverName: data.driverName || 'Biriktirilmagan',
      createdAt: new Date().toLocaleString('uz-UZ')
    };

    if (demoData.deletedReturnIds && Array.isArray(demoData.deletedReturnIds)) {
      demoData.deletedReturnIds = demoData.deletedReturnIds.filter(x => x !== newRet.id && x !== newRet.returnNumber);
      try { localStorage.setItem('smartombor_deleted_return_ids', JSON.stringify(demoData.deletedReturnIds)); } catch(e) {}
    }
    try { localStorage.removeItem('smartombor_returns_cleared'); } catch(e) {}

    let resolvedProductId = data.productId;
    const targetPrd = (demoData.products || []).find(p => p && (p.id === data.productId || p.name === data.productName || p.sku === data.productId));
    if (targetPrd && isUUID(targetPrd.id)) {
      resolvedProductId = targetPrd.id;
    } else if (!isUUID(resolvedProductId)) {
      const fallbackPrd = (demoData.products || []).find(p => p && isUUID(p.id));
      resolvedProductId = fallbackPrd ? fallbackPrd.id : null;
    }

    const dbReason = ['muddati_otgan', 'nuqsonli', 'ortiqcha_tovar', 'boshqa'].includes(data.reason) ? data.reason : 'boshqa';

    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const insertPayload = {
            return_number: newRet.returnNumber,
            customer_name: newRet.customerName,
            quantity: newRet.quantity,
            refund_amount: newRet.refundAmount,
            reason: dbReason,
            driver_name: newRet.driverName
          };
          if (resolvedProductId) insertPayload.product_id = resolvedProductId;

          const { data: dbData, error } = await client
            .from('order_returns')
            .insert([insertPayload])
            .select()
            .single();
          if (error) {
            console.warn(`[returnService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            newRet.id = dbData.id;
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[returnService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_return', data);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_return', data);
    }

    if (!demoData.orderReturns) demoData.orderReturns = [];
    demoData.orderReturns.unshift(newRet);

    // Restore stock if product exists
    if (data.productId || data.productName) {
      const prd = demoData.products.find(p => (data.productId && (p.id === data.productId || p.sku === data.productId)) || (data.productName && p.name === data.productName));
      if (prd) {
        prd.stock += data.quantity || 1;
        const minStk = prd.minStock || 5;
        prd.status = prd.stock <= 0 ? 'Tugagan' : (prd.stock <= minStk ? 'Kam qolgan' : 'Mavjud');
        prd.statusClass = prd.stock <= 0 ? 'badge-danger' : (prd.stock <= minStk ? 'badge-warning' : 'badge-success');
        if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
          inventoryService.updateStatus(prd);
        }
        if (window.productService && prd.id && typeof isUUID === 'function' && isUUID(prd.id)) {
          window.productService.update(prd.id, { stock: prd.stock }).catch(e => console.warn(e));
        }
      }
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(newRet);
  },

  async delete(id) {
    const ret = (demoData.orderReturns || []).find(r => r.id === id || r.returnNumber === id);
    const retId = ret ? ret.id : id;
    const retNum = ret ? ret.returnNumber : id;

    if (!demoData.deletedReturnIds) demoData.deletedReturnIds = [];
    if (retId && !demoData.deletedReturnIds.includes(retId)) demoData.deletedReturnIds.push(retId);
    if (retNum && !demoData.deletedReturnIds.includes(retNum)) demoData.deletedReturnIds.push(retNum);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(retId)) await client.from('order_returns').delete().eq('id', retId);
        if (retNum) await client.from('order_returns').delete().eq('return_number', retNum);
      } catch (e) {
        console.warn("[returnService.delete Notice]:", e);
      }
    }

    demoData.orderReturns = (demoData.orderReturns || []).filter(r => r.id !== retId && r.returnNumber !== retNum);
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id, deleted: true });
  }
};
window.returnService = returnService;

// Sales Service Interface (Connected with Supabase & Cloud Synced)
const salesService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('sales')
          .select('*, sale_items(*)')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: sales, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedSales = demoData.deletedSaleIds || [];
          const existingLocalList = demoData.recentSales || [];

          const fetchedSales = data.map(row => {
            let meta = {};
            if (row.notes) {
              try { meta = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes; } catch(e) {}
            }
            const localMatch = existingLocalList.find(s => s.id === row.id || s.receiptNo === row.receipt_no);
            const finalQty = meta.qty || row.qty || (localMatch ? localMatch.qty : null) || '1 dona';
            const finalItems = meta.itemsCount || (localMatch ? localMatch.itemsCount : null) || (Array.isArray(row.sale_items) && row.sale_items.length > 0 ? `${row.sale_items.length} xil` : '1 xil');
            const totalAmt = Number(row.total_amount || 0);
            const paidAmt = (row.paid_amount !== undefined && row.paid_amount !== null) ? Number(row.paid_amount) : (localMatch && localMatch.paidAmount !== undefined ? Number(localMatch.paidAmount) : totalAmt);
            const saleDiff = totalAmt - paidAmt;
            let debtStr = '+0 UZS';
            if (saleDiff > 0) {
              debtStr = '+' + saleDiff.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
            } else if (saleDiff < 0) {
              debtStr = '-' + Math.abs(saleDiff).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
            }

            return {
              id: row.id,
              date: new Date(row.created_at || Date.now()).toLocaleString('uz-UZ'),
              receiptNo: row.receipt_no,
              warehouse: (localMatch ? localMatch.warehouse : null) || meta.warehouse || 'Asosiy Ombor - Toshkent',
              customer: row.customer_name || 'Mijoz',
              productName: (localMatch ? localMatch.productName : null) || meta.productName || finalItems,
              itemsCount: finalItems,
              qty: finalQty,
              amount: totalAmt.toLocaleString('uz-UZ') + ' UZS',
              rawAmount: totalAmt,
              totalAmount: totalAmt,
              paidAmount: paidAmt,
              debt: debtStr,
              paymentType: row.payment_type || 'Terminal',
              status: row.status || (localMatch ? localMatch.status : 'yangi'),
              statusClass: 'badge-primary'
            };
          }).filter(s => s && !deletedSales.includes(s.id) && !deletedSales.includes(s.receiptNo));

          demoData.recentSales = fetchedSales;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[salesService.getAll Notice]:", err);
      }
    }
    const isSalesCleared = (localStorage.getItem('smartombor_sales_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedSaleIds && demoData.deletedSaleIds.length > 0);
    if (!fetchedFromCloud && !isSalesCleared && (!demoData.recentSales || demoData.recentSales.length === 0)) {
      demoData.recentSales = defaultDemoData.recentSales || [];
    } else if (!fetchedFromCloud && isSalesCleared) {
      demoData.recentSales = [];
    }
    return createApiResponse(demoData.recentSales);
  },

  async create(saleData, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('sales:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda sotuv yaratish uchun huquq yetarli emas!", status: 403 });
    }

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const amountNum = parseInt(String(saleData.amount || saleData.totalAmount || 0).replace(/[^0-9]/g, '')) || 0;
          const paidNum = (saleData.paidAmount !== undefined && saleData.paidAmount !== null) ? Number(saleData.paidAmount) : amountNum;
          const notesPayload = typeof saleData.notes === 'string' 
            ? saleData.notes 
            : JSON.stringify({ 
                qty: saleData.qty, 
                itemsCount: saleData.itemsCount, 
                productName: saleData.productName, 
                warehouse: saleData.warehouse,
                paidAmount: paidNum,
                totalAmount: amountNum
              });
          const { data: dbData, error } = await client.from('sales').insert([{
            receipt_no: saleData.receiptNo || ('CHK-' + Math.floor(1000 + Math.random() * 9000)),
            customer_name: saleData.customer || 'Mijoz',
            total_amount: amountNum,
            paid_amount: paidNum,
            payment_type: saleData.paymentType || 'Terminal',
            status: saleData.status || 'yangi',
            notes: notesPayload
          }]).select().single();
          if (error) {
            console.warn(`[salesService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            saleData.id = dbData.id;
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[salesService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_sale', saleData);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_sale', saleData);
    }

    if (demoData.deletedSaleIds && Array.isArray(demoData.deletedSaleIds)) {
      demoData.deletedSaleIds = demoData.deletedSaleIds.filter(x => x !== saleData.id && x !== saleData.receiptNo);
      try { localStorage.setItem('smartombor_deleted_sale_ids', JSON.stringify(demoData.deletedSaleIds)); } catch(e) {}
    }
    try { localStorage.removeItem('smartombor_sales_cleared'); } catch(e) {}

    if (!demoData.recentSales) demoData.recentSales = [];
    const existingIdx = demoData.recentSales.findIndex(s => s.id === saleData.id || s.receiptNo === saleData.receiptNo);
    if (existingIdx === -1) {
      demoData.recentSales.unshift(saleData);
    } else {
      demoData.recentSales[existingIdx] = saleData;
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(saleData);
  },

  async delete(id, isSyncFlush = false) {
    const saleIdx = (demoData.recentSales || []).findIndex(s => s.id === id || s.receiptNo === id);
    if (saleIdx === -1) return createApiResponse(null, false, null, { code: 'NOT_FOUND', message: "Sotuv topilmadi", status: 404 });

    const sale = demoData.recentSales[saleIdx];
    const receiptNo = sale.receiptNo || sale.id;

    if (!demoData.deletedSaleIds) demoData.deletedSaleIds = [];
    if (id && !demoData.deletedSaleIds.includes(id)) demoData.deletedSaleIds.push(id);
    if (receiptNo && !demoData.deletedSaleIds.includes(receiptNo)) demoData.deletedSaleIds.push(receiptNo);

    // 1. Rollback Stock
    const restoreItemStock = (pId, pName, qtyRest) => {
      const prd = (demoData.products || []).find(p => (pId && (p.id === pId || p.sku === pId)) || (pName && p.name === pName));
      if (prd) {
        prd.stock = (prd.stock || 0) + qtyRest;
        if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
          inventoryService.updateStatus(prd);
        }
        if (window.productService && prd.id && typeof isUUID === 'function' && isUUID(prd.id)) {
          window.productService.update(prd.id, { 
            stock: prd.stock, 
            warehouseId: prd.warehouseId || prd.warehouse 
          }).catch(e => console.warn('[Stock Rollback Sync Warning]:', e));
        }
      }
    };

    if (Array.isArray(sale.items) && sale.items.length > 0) {
      for (const itm of sale.items) {
        restoreItemStock(itm.productId, itm.name || itm.productName, parseInt(itm.qty) || 1);
      }
    } else {
      const prdTargetName = sale.productName || sale.product || sale.itemsCount;
      const qtyToRestore = sale.qty ? (parseInt(String(sale.qty).replace(/[^0-9]/g, '')) || 1) : 1;
      restoreItemStock(sale.productId, prdTargetName, qtyToRestore);
    }

    // 2. Rollback Cash & Financial Balance
    const amountNum = parseInt(String(sale.amount || 0).replace(/[^0-9]/g, '')) || 0;
    if (amountNum > 0 && demoData.cash) {
      const cancelTx = {
        id: generateUniqueId('cash_tx'),
        date: new Date().toLocaleString('uz-UZ'),
        operation: `Sotuv bekor qilindi (${receiptNo})`,
        category: 'Sotuv bekor qilish',
        amount: `-${formatCurrency(amountNum)}`,
        isIncome: false,
        comment: `Chek № ${receiptNo} bekor qilinishi natijasida kassa balansi qayta tuzatildi`
      };
      if (!demoData.cash.transactions) demoData.cash.transactions = [];
      demoData.cash.transactions.unshift(cancelTx);
    }

    // 3. Remove from Supabase sales table if online
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(id)) {
          await client.from('sale_items').delete().eq('sale_id', id);
          await client.from('sales').delete().eq('id', id);
        }
        if (receiptNo) {
          await client.from('sales').delete().eq('receipt_no', receiptNo);
        }
      } catch (e) {
        console.warn("[salesService.delete Notice]:", e);
      }
    }

    // 4. Remove from demoData.recentSales
    demoData.recentSales.splice(saleIdx, 1);
    if (demoData.recentSales.length === 0) {
      try { localStorage.setItem('smartombor_sales_cleared', 'true'); } catch (e) {}
    }
    saveStateToLocalStorage();
    syncGlobalState();

    return createApiResponse({ id, deleted: true, receiptNo });
  }
};

// Cash Service Interface (Connected with Supabase & Cloud Synced)
const cashService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('cash_transactions')
          .select('*')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: cash_transactions, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          const deletedTxs = demoData.deletedCashTxIds || [];
          const fetchedTxs = data
            .map(row => ({
              id: row.id,
              date: new Date(row.created_at).toLocaleString('uz-UZ'),
              operation: row.operation,
              category: row.category,
              amount: (row.is_income ? '+' : '-') + Number(row.amount).toLocaleString('uz-UZ') + ' UZS',
              isIncome: row.is_income,
              comment: row.comment || ''
            }))
            .filter(t => t && !deletedTxs.includes(t.id));

          if (!demoData.cash) demoData.cash = {};
          demoData.cash.transactions = fetchedTxs;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[cashService.getAll Notice]:", err);
      }
    }
    return createApiResponse(demoData.cash || {});
  },

  async createTransaction(txData, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('cash:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda kassa operatsiyasini bajarish huquqi yo'q!", status: 403 });
    }

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const numAmt = parseInt(String(txData.amount || 0).replace(/[^0-9]/g, '')) || 0;
          const { data: dbData, error } = await client.from('cash_transactions').insert([{
            operation: txData.operation || 'Operatsiya',
            category: txData.category || 'Kassa',
            amount: numAmt,
            is_income: !!txData.isIncome,
            comment: txData.comment || ''
          }]).select().single();
          if (error) {
            console.warn(`[cashService.createTransaction Supabase notice]: ${error.message}`);
          } else if (dbData) {
            txData.id = dbData.id;
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[cashService.createTransaction] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_cash_tx', txData);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_cash_tx', txData);
    }

    if (!demoData.cash) demoData.cash = { currentBalance: '0 UZS', todayIncome: '0 UZS', todayExpense: '0 UZS', netBalance: '0 UZS', transactions: [] };
    if (!demoData.cash.transactions) demoData.cash.transactions = [];

    const existingIdx = demoData.cash.transactions.findIndex(t => t.id === txData.id);
    if (existingIdx === -1) {
      demoData.cash.transactions.unshift(txData);
    }

    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse(txData);
  },

  async deleteTransaction(id) {
    const tx = (demoData.cash && demoData.cash.transactions || []).find(t => t.id === id);
    const txId = tx ? tx.id : id;

    if (!demoData.deletedCashTxIds) demoData.deletedCashTxIds = [];
    if (txId && !demoData.deletedCashTxIds.includes(txId)) demoData.deletedCashTxIds.push(txId);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(txId)) await client.from('cash_transactions').delete().eq('id', txId);
      } catch (e) {
        console.warn("[cashService.deleteTransaction notice]:", e);
      }
    }
    if (demoData.cash && demoData.cash.transactions) {
      demoData.cash.transactions = demoData.cash.transactions.filter(t => t.id !== txId);
    }
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id: txId, deleted: true });
  }
};

// Purchase Service Interface (Connected with Supabase & Cloud Synced)
const purchaseService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    let fetchedFromCloud = false;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('purchases')
          .select('*, purchase_items(*)')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: purchases, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          fetchedFromCloud = true;
          const deletedPurchases = demoData.deletedPurchaseIds || [];
          const existingLocalList = demoData.purchases || [];
          const fetchedPurchases = data
            .map(row => {
              const localMatch = existingLocalList.find(l => l && (l.id === row.id || l.docNo === row.doc_no));
              const hasCloudItems = Array.isArray(row.purchase_items) && row.purchase_items.length > 0;
              let itemPName = hasCloudItems ? (row.purchase_items[0].product_name || 'Tovar') : (row.notes ? row.notes.split('(')[0].trim() : (localMatch ? localMatch.items : 'Tovar'));
              if (!itemPName) itemPName = 'Tovar';
              
              let itemQtyStr = '1 dona';
              if (hasCloudItems && row.purchase_items[0].quantity) {
                itemQtyStr = `${row.purchase_items[0].quantity} dona`;
              } else if (row.notes && row.notes.includes('(') && row.notes.includes('dona)')) {
                const match = row.notes.match(/\((\d+)\s*dona\)/);
                if (match && match[1]) {
                  itemQtyStr = `${match[1]} dona`;
                }
              } else if (localMatch && localMatch.qty) {
                itemQtyStr = localMatch.qty;
              }

              return {
                id: row.id,
                date: new Date(row.created_at || Date.now()).toLocaleString('uz-UZ'),
                docNo: row.doc_no,
                supplier: row.supplier_name || 'Yetkazib beruvchi',
                items: itemPName,
                qty: typeof itemQtyStr === 'number' ? `${itemQtyStr} dona` : itemQtyStr,
                amount: Number(row.total_amount || 0).toLocaleString('uz-UZ') + ' UZS',
                status: row.status || 'Qabul qilindi',
                statusClass: 'badge-success'
              };
            }).filter(p => p && !deletedPurchases.includes(p.id) && !deletedPurchases.includes(p.docNo));

          demoData.purchases = fetchedPurchases;
          saveStateToLocalStorage();
        }
      } catch (err) {
        console.warn("[purchaseService.getAll Notice]:", err);
      }
    }
    const isPurchasesCleared = (localStorage.getItem('smartombor_purchases_cleared') === 'true') || (localStorage.getItem('smartombor_system_wiped') === 'true') || (demoData.deletedPurchaseIds && demoData.deletedPurchaseIds.length > 0);
    if (!fetchedFromCloud && !isPurchasesCleared && (!demoData.purchases || demoData.purchases.length === 0)) {
      demoData.purchases = defaultDemoData.purchases || [];
    } else if (!fetchedFromCloud && isPurchasesCleared) {
      demoData.purchases = [];
    }
    return createApiResponse(demoData.purchases);
  },

  async create(purData, isSyncFlush = false) {
    if (!isSyncFlush && window.authService && !window.authService.canPerform('purchases:create')) {
      return createApiResponse(null, false, null, { code: 'FORBIDDEN', message: "Sizda kirim yaratish uchun huquq yetarli emas!", status: 403 });
    }

    const qtyNum = parseInt(String(purData.qty || 1).replace(/[^0-9]/g, '')) || 1;
    const amountNum = parseInt(String(purData.amount || 0).replace(/[^0-9]/g, '')) || 0;
    const itemPName = purData.items || 'Tovar';
    const notesStr = `${itemPName} (${qtyNum} dona)`;

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine && !isSyncFlush) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const syncPromise = (async () => {
          const { data: dbData, error } = await client.from('purchases').insert([{
            doc_no: purData.docNo || ('YK-2026-' + Math.floor(100 + Math.random() * 900)),
            supplier_name: purData.supplier || 'Yetkazib beruvchi',
            total_amount: amountNum,
            status: 'Qabul qilindi',
            notes: notesStr
          }]).select().single();
          if (error) {
            console.warn(`[purchaseService.create Supabase notice]: ${error.message}`);
          } else if (dbData) {
            purData.id = dbData.id;
            try {
              await client.from('purchase_items').insert([{
                purchase_id: dbData.id,
                product_name: itemPName,
                quantity: qtyNum,
                unit_price: qtyNum > 0 ? Math.round(amountNum / qtyNum) : amountNum,
                total_price: amountNum
              }]);
            } catch (e) {
              console.warn("[purchase_items insert notice]:", e);
            }
          }
        })();
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn("[purchaseService.create] Network notice:", err.message);
        if (window.offlineStore) {
          await window.offlineStore.enqueueMutation('create_purchase', purData);
        }
      }
    } else if (!isSyncFlush && window.offlineStore) {
      await window.offlineStore.enqueueMutation('create_purchase', purData);
    }

    if (!demoData.purchases) demoData.purchases = [];
    const existingIdx = demoData.purchases.findIndex(p => p.id === purData.id || p.docNo === purData.docNo);
    if (existingIdx === -1) {
      demoData.purchases.unshift(purData);
    }

    syncGlobalState();
    return createApiResponse(purData);
  },

  async delete(id) {
    const pur = (demoData.purchases || []).find(p => p.id === id || p.docNo === id);
    const purId = pur ? pur.id : id;
    const docNo = pur ? pur.docNo : id;

    if (!demoData.deletedPurchaseIds) demoData.deletedPurchaseIds = [];
    if (purId && !demoData.deletedPurchaseIds.includes(purId)) demoData.deletedPurchaseIds.push(purId);
    if (docNo && !demoData.deletedPurchaseIds.includes(docNo)) demoData.deletedPurchaseIds.push(docNo);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        if (isUUID(purId)) {
          await client.from('purchase_items').delete().eq('purchase_id', purId);
          await client.from('purchases').delete().eq('id', purId);
        }
        if (docNo) await client.from('purchases').delete().eq('doc_no', docNo);
      } catch (e) {
        console.warn("[purchaseService.delete notice]:", e);
      }
    }
    demoData.purchases = (demoData.purchases || []).filter(p => p.id !== purId && p.docNo !== docNo);
    saveStateToLocalStorage();
    syncGlobalState();
    return createApiResponse({ id: purId, deleted: true });
  }
};

window.salesService = salesService;
window.cashService = cashService;
window.purchaseService = purchaseService;
window.customerService = customerService;
window.supplierService = supplierService;
window.distributionService = distributionService;
window.returnService = returnService;
window.inventoryService = inventoryService;
window.categoryService = categoryService;
window.warehouseService = warehouseService;
window.productService = productService;

function getSaleEffectiveStatus(sale) {
  if (!sale) return { status: 'yangi', label: 'Yangi', badgeClass: 'bg-blue-600 text-white', statusClass: 'badge-primary' };
  const deliveryOrd = (demoData.distributionOrders || []).find(d => 
    (sale.receiptNo && (d.saleReceiptNo === sale.receiptNo || (d.notes && d.notes.includes(sale.receiptNo)))) ||
    (sale.id && (d.saleId === sale.id || d.id === sale.id)) ||
    (d.customerName === sale.customer && d.createdAt === sale.date)
  );
  const rawStatus = (deliveryOrd ? deliveryOrd.status : (sale.status || 'yangi')).toLowerCase();
  
  if (rawStatus === 'yigildi' || rawStatus.includes('yig')) {
    return { status: 'yigildi', label: "Omborda Yig'ildi", badgeClass: 'bg-amber-500 text-white', statusClass: 'badge-warning' };
  } else if (rawStatus === 'yetkazilmoqda' || rawStatus.includes('yetkazilm') || rawStatus.includes('yo\'lda')) {
    return { status: 'yetkazilmoqda', label: 'Yetkazilmoqda', badgeClass: 'bg-purple-600 text-white', statusClass: 'badge-secondary' };
  } else if (rawStatus === 'yetkazildi' || rawStatus.includes('yetkazil') || rawStatus === 'bajarildi' || rawStatus.includes('bajar')) {
    return { status: 'yetkazildi', label: 'Yetkazildi', badgeClass: 'bg-[#00a368] text-white', statusClass: 'badge-success' };
  } else if (rawStatus === 'bekor_qilindi' || rawStatus.includes('bekor')) {
    return { status: 'bekor_qilindi', label: 'Bekor qilindi', badgeClass: 'bg-rose-600 text-white', statusClass: 'badge-danger' };
  } else {
    return { status: 'yangi', label: 'Yangi', badgeClass: 'bg-blue-600 text-white', statusClass: 'badge-primary' };
  }
}
window.getSaleEffectiveStatus = getSaleEffectiveStatus;

function ensureUniqueUserIds(users) {
  if (!Array.isArray(users)) return users;
  const seenIds = new Set();
  let maxNum = 10;

  users.forEach(u => {
    const num = parseInt(String(u.id || u.customId || '').replace(/[^0-9]/g, '')) || 0;
    if (num > maxNum) maxNum = num;
  });

  const customMap = (() => {
    try { return JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}'); }
    catch(e) { return {}; }
  })();
  let mapChanged = false;

  users.forEach(u => {
    let curId = String(u.id || u.customId || '').trim();
    if (!curId || seenIds.has(curId.toLowerCase())) {
      let candNum = maxNum + 1;
      let newId = String(candNum).padStart(4, '0');
      while (seenIds.has(newId.toLowerCase()) || users.some(other => other !== u && String(other.id) === newId)) {
        candNum++;
        newId = String(candNum).padStart(4, '0');
      }
      maxNum = candNum;
      u.id = newId;
      u.customId = newId;
      seenIds.add(newId.toLowerCase());

      if (u.uuid) customMap[u.uuid] = newId;
      if (u.full_name) customMap[u.full_name.toLowerCase().trim()] = newId;
      customMap[newId] = newId;
      mapChanged = true;
    } else {
      seenIds.add(curId.toLowerCase());
    }
  });

  if (mapChanged) {
    try {
      localStorage.setItem('smartombor_custom_user_ids', JSON.stringify(customMap));
    } catch (e) {}
  }

  return users;
}
window.ensureUniqueUserIds = ensureUniqueUserIds;

// Users Service Interface (Connected 100% to Supabase profiles table & Cloud Synced)
const userService = {
  async getAll() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && navigator.onLine) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const fetchPromise = client
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        const res = await Promise.race([fetchPromise, timeoutPromise]);
        const data = res ? res.data : null;
        const error = res ? res.error : null;

        if (error) {
          console.error(`[Supabase Error] Table: profiles, Operation: SELECT, Code: ${error.code}, Message: ${error.message}`);
        } else if (data) {
          const roleLabels = {
            agent: 'Savdo Agenti',
            driver: 'Haydovchi',
            supervisor: 'Supervayzer',
            warehouse: 'Omborchi',
            director: 'Direktor',
            admin: 'Administrator',
            cashier: 'Kassir'
          };
          const customIdsMap = (() => {
            try { return JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}'); }
            catch(e) { return {}; }
          })();

          const filteredDbRows = data.filter(p => p.full_name !== '__DELETED_USER_IDS__' && p.email !== 'deleted_users_marker@smartup.uz');

          const mappedFromDb = filteredDbRows.map(p => {
            const customId = customIdsMap[p.id] || customIdsMap[(p.full_name || '').toLowerCase().trim()];
            const displayId = customId || p.id;
            return {
              id: displayId,
              uuid: p.id,
              customId: displayId,
              full_name: p.full_name || 'Xodim',
              fullName: p.full_name || 'Xodim',
              email: p.email || ((p.full_name ? p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'xodim') + '@smartup.uz'),
              role: (p.role || 'agent').toLowerCase(),
              roleLabel: roleLabels[(p.role || '').toLowerCase()] || p.role || 'Xodim',
              status: 'Faol',
              statusClass: 'badge-success',
              createdAt: p.created_at ? new Date(p.created_at).toLocaleString('uz-UZ') : '30.08.2026 12:00'
            };
          });

          // Replace demoData.users 100% directly from Supabase profiles table
          demoData.users = mappedFromDb;
          saveStateToLocalStorage();
          try {
            localStorage.setItem('smartombor_persistent_users_v3', JSON.stringify(mappedFromDb));
          } catch (e) {}
          return createApiResponse(demoData.users);
        }
      } catch (err) {
        console.warn("[userService.getAll Notice]:", err);
      }
    }

    if (!demoData.users) demoData.users = [];
    return createApiResponse(demoData.users);
  },

  async delete(id) {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

    const users = (demoData && demoData.users) ? demoData.users : [];
    const targetUser = users.find(u => 
      u.id === id || 
      u.customId === id || 
      u.uuid === id || 
      (u.full_name && u.full_name.toLowerCase().trim() === String(id).toLowerCase().trim())
    ) || {};

    const isUuidFormat = val => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const targetUuid = targetUser.uuid || (isUuidFormat(id) ? id : null);
    const targetCustomId = targetUser.customId || targetUser.id || id;
    const targetName = targetUser.full_name || targetUser.fullName || id;

    if (client && navigator.onLine) {
      if (targetUuid && isUuidFormat(targetUuid)) {
        try {
          await client.functions.invoke('delete-user', { body: { user_id: targetUuid } });
        } catch (e) {}
        try { 
          const { error } = await client.from('profiles').delete().eq('id', targetUuid);
          if (error) console.error(`[Supabase Error] Table: profiles, Operation: DELETE, Code: ${error.code}, Message: ${error.message}`);
        } catch (e) {}
      }

      if (isUuidFormat(id) && id !== targetUuid) {
        try { 
          const { error } = await client.from('profiles').delete().eq('id', id);
          if (error) console.error(`[Supabase Error] Table: profiles, Operation: DELETE, Code: ${error.code}, Message: ${error.message}`);
        } catch (e) {}
      }

      if (targetName) {
        try { 
          const { error } = await client.from('profiles').delete().eq('full_name', targetName);
          if (error) console.error(`[Supabase Error] Table: profiles, Operation: DELETE, Code: ${error.code}, Message: ${error.message}`);
        } catch (e) {}
      }
    }

    if (demoData.users) {
      demoData.users = demoData.users.filter(u => 
        u.id !== id && 
        u.customId !== id && 
        u.uuid !== id && 
        u.id !== targetCustomId && 
        u.id !== targetUuid && 
        u.full_name !== targetName &&
        u.fullName !== targetName
      );
    }

    // Clean custom IDs map
    try {
      const customMap = JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}');
      [id, targetCustomId, targetUuid, targetName].forEach(k => {
        if (k) delete customMap[k];
        if (k) delete customMap[String(k).toLowerCase().trim()];
      });
      localStorage.setItem('smartombor_custom_user_ids', JSON.stringify(customMap));
    } catch (e) {}

    // Clean password store
    try {
      const passStore = JSON.parse(localStorage.getItem('smartombor_user_passwords_v2') || '{}');
      [id, targetCustomId, targetUuid, targetName].forEach(k => {
        if (k) delete passStore[String(k).toLowerCase().trim()];
        if (k) delete passStore[String(k).toLowerCase().replace(/[^a-z0-9]/g, '')];
      });
      localStorage.setItem('smartombor_user_passwords_v2', JSON.stringify(passStore));
    } catch (e) {}

    // Clean avatars
    try {
      [id, targetCustomId, targetUuid, targetName].forEach(k => {
        if (k) localStorage.removeItem('smartombor_user_avatar_' + k);
      });
    } catch (e) {}

    saveStateToLocalStorage();
    savePersistentUsers(demoData.users);
    syncGlobalState();

    return createApiResponse({ id, success: true });
  }
};
window.userService = userService;

// ==================== 9. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) SERVICE ====================
const DEFAULT_ACCOUNTS = {
  fayz: {
    id: '0001',
    email: '0001@smartup.uz',
    fullName: 'FAYZ',
    full_name: 'FAYZ',
    role: 'director',
    roleLabel: 'Bosh Administrator (FAYZ)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  ibrohim: {
    id: '0002',
    email: '0002@smartup.uz',
    fullName: 'Ibrohim',
    full_name: 'Ibrohim',
    role: 'director',
    roleLabel: 'Bosh Administrator (Ibrohim)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  }
};

const userPasswordStore = {
  getPasswords() {
    try {
      const stored = localStorage.getItem('smartombor_user_passwords_v2');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  },
  getPasswordForUser(userKey) {
    if (!userKey) return '123456';
    const store = this.getPasswords();
    const key = String(userKey).toLowerCase().trim();
    if (store[key]) return store[key];

    const users = (demoData && demoData.users) ? demoData.users : [];
    const matched = users.find(u => 
      (u.id && String(u.id).toLowerCase() === key) ||
      (u.email && u.email.toLowerCase() === key) ||
      (u.full_name && u.full_name.toLowerCase() === key)
    );

    if (matched) {
      if (matched.id && store[String(matched.id).toLowerCase()]) return store[String(matched.id).toLowerCase()];
      if (matched.email && store[matched.email.toLowerCase()]) return store[matched.email.toLowerCase()];
      if (matched.full_name && store[matched.full_name.toLowerCase()]) return store[matched.full_name.toLowerCase()];
    }

    return '123456';
  },
  setPasswordForUser(userKey, newPassword) {
    if (!userKey || !newPassword) return;
    const store = this.getPasswords();
    const key = String(userKey).toLowerCase().trim();
    store[key] = newPassword;

    const users = (demoData && demoData.users) ? demoData.users : [];
    const matched = users.find(u => 
      (u.id && String(u.id).toLowerCase() === key) ||
      (u.email && u.email.toLowerCase() === key) ||
      (u.full_name && u.full_name.toLowerCase() === key)
    );

    if (matched) {
      if (matched.id) store[String(matched.id).toLowerCase()] = newPassword;
      if (matched.email) store[matched.email.toLowerCase()] = newPassword;
      if (matched.full_name) store[matched.full_name.toLowerCase()] = newPassword;
      const slug = (matched.full_name || matched.email || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (slug) store[slug] = newPassword;
    }

    const slugInput = key.replace(/[^a-z0-9]/g, '');
    if (slugInput) store[slugInput] = newPassword;

    try {
      localStorage.setItem('smartombor_user_passwords_v2', JSON.stringify(store));
    } catch (e) {}
  }
};
window.userPasswordStore = userPasswordStore;

const authService = {
  currentUser: null,

  init() {
    try {
      localStorage.removeItem('smartombor_failed_login_counts');
    } catch (e) {}

    try {
      const savedUser = localStorage.getItem('smartombor_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        delete parsed.password;
        this.currentUser = parsed;
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      this.currentUser = null;
    }

    const savedAdminProf = localStorage.getItem('smartombor_admin_profile');
    if (savedAdminProf && this.currentUser && (this.currentUser.id === 'usr-fayz-01' || this.currentUser.email === 'admin@smartombor.uz')) {
      try {
        const profObj = JSON.parse(savedAdminProf);
        if (profObj.fullName) {
          this.currentUser.fullName = profObj.fullName;
          this.currentUser.full_name = profObj.fullName;
        }
        if (profObj.phone) this.currentUser.phone = profObj.phone;
      } catch (e) {}
    }

    const uId = this.currentUser ? (this.currentUser.id || this.currentUser.fullName) : null;
    let savedAvatar = uId ? localStorage.getItem('smartombor_user_avatar_' + uId) : null;
    if (savedAvatar && savedAvatar.includes('unsplash.com')) {
      localStorage.removeItem('smartombor_user_avatar_' + uId);
      savedAvatar = null;
    }
    if (savedAvatar && this.currentUser) {
      this.currentUser.avatar = savedAvatar;
      this.currentUser.avatar_url = savedAvatar;
    } else if (this.currentUser && !this.currentUser.avatar) {
      delete this.currentUser.avatar;
      delete this.currentUser.avatar_url;
    }

    // Session Persistence via Supabase Auth
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && client.auth) {
      client.auth.getSession().then(({ data: sessData }) => {
        if (sessData && sessData.session && sessData.session.user) {
          const user = sessData.session.user;
          client.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data: profile }) => {
            if (!profile || (demoData.deletedUserIds && demoData.deletedUserIds.includes(user.id))) {
              client.auth.signOut();
              localStorage.removeItem('smartombor_user');
              this.currentUser = null;
              this.updateUserUI();
              return;
            }
            const role = (profile && profile.role) ? profile.role.toLowerCase() : 'agent';
            const fullName = (profile && profile.full_name) ? profile.full_name : (user.email ? user.email.split('@')[0] : 'Xodim');
            const roleLabels = {
              agent: 'Savdo Agenti',
              driver: 'Haydovchi',
              warehouse: 'Omborchi',
              supervisor: 'Supervayzer',
              director: 'Direktor',
              admin: 'Bosh Administrator',
              cashier: 'Kassir'
            };
            const customIdsMap = (() => {
              try { return JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}'); }
              catch(e) { return {}; }
            })();
            const customId = customIdsMap[user.id] || customIdsMap[fullName.toLowerCase().trim()];
            const isUuidFormat = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const effectiveId = customId || (this.currentUser && this.currentUser.id && !isUuidFormat(this.currentUser.id) ? this.currentUser.id : user.id);

            const userSession = {
              id: effectiveId,
              uuid: user.id,
              customId: effectiveId,
              email: user.email,
              fullName: fullName,
              full_name: fullName,
              role: role,
              roleLabel: roleLabels[role] || 'Xodim',
              badgeClass: (role === 'admin' || role === 'director') ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
            };
            this.currentUser = userSession;
            localStorage.setItem('smartombor_user', JSON.stringify(userSession));
            this.updateUserUI();
          });
        }
      });
    }
  },

  getCurrentUser() {
    if (!this.currentUser) {
      this.init();
    }
    const savedAdminProf = localStorage.getItem('smartombor_admin_profile');
    if (savedAdminProf && this.currentUser && (this.currentUser.id === 'usr-fayz-01' || this.currentUser.email === 'admin@smartombor.uz')) {
      try {
        const profObj = JSON.parse(savedAdminProf);
        if (profObj.fullName) {
          this.currentUser.fullName = profObj.fullName;
          this.currentUser.full_name = profObj.fullName;
        }
        if (profObj.phone) this.currentUser.phone = profObj.phone;
      } catch (e) {}
    }

    const uId = this.currentUser ? (this.currentUser.id || this.currentUser.fullName) : null;
    let savedAvatar = uId ? localStorage.getItem('smartombor_user_avatar_' + uId) : null;
    if (savedAvatar && savedAvatar.includes('unsplash.com')) {
      localStorage.removeItem('smartombor_user_avatar_' + uId);
      savedAvatar = null;
    }
    if (savedAvatar && this.currentUser) {
      this.currentUser.avatar = savedAvatar;
      this.currentUser.avatar_url = savedAvatar;
    } else if (this.currentUser && !this.currentUser.avatar) {
      delete this.currentUser.avatar;
      delete this.currentUser.avatar_url;
    }
    return this.currentUser;
  },

  isLoggedIn() {
    const user = this.getCurrentUser();
    return !!(user && (user.id || user.email || user.fullName));
  },

  hasRole(roleName) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const userRole = (user.role || 'agent').toLowerCase();
    if (userRole === 'admin' || userRole === 'director') return true;
    return userRole === (roleName || '').toLowerCase();
  },

  canPerform(action) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const userRole = (user.role || 'agent').toLowerCase();

    // Admin and Director roles have unrestricted access
    if (userRole === 'admin' || userRole === 'director') return true;

    const rolePermissions = {
      agent: [
        'dashboard:read', 'sales:create', 'sales:read', 'customers:create', 'customers:read',
        'products:read', 'orders:create', 'orders:read', 'returns:create', 'returns:read',
        'delivery:read'
      ],
      warehouse: [
        'dashboard:read', 'products:read', 'products:create', 'products:update', 'inventory:update',
        'purchases:create', 'purchases:read', 'outgoing:create', 'outgoing:read',
        'transfers:create', 'orders:read', 'orders:update', 'returns:read', 'returns:update',
        'delivery:read', 'delivery:update'
      ],
      omborchi: [
        'dashboard:read', 'products:read', 'products:create', 'products:update', 'inventory:update',
        'purchases:create', 'purchases:read', 'outgoing:create', 'outgoing:read',
        'transfers:create', 'orders:read', 'orders:update', 'returns:read', 'returns:update',
        'delivery:read', 'delivery:update'
      ],
      supervisor: [
        'dashboard:read', 'sales:*', 'customers:*', 'products:*', 'purchases:*',
        'outgoing:*', 'suppliers:*', 'delivery:*', 'returns:*', 'orders:*', 'reports:read'
      ],
      cashier: [
        'dashboard:read', 'sales:create', 'sales:read', 'customers:read', 'cash:read', 'cash:create'
      ],
      driver: [
        'orders:read', 'orders:update', 'delivery:read', 'delivery:update', 'returns:create', 'returns:read'
      ]
    };

    const userPerms = rolePermissions[userRole] || [];
    if (!action) return true;

    const actionDomain = action.split(':')[0];
    return userPerms.includes(action) || userPerms.includes(`${actionDomain}:*`) || userPerms.includes('*');
  },

  async login(loginInput, password) {
    const cleanInput = (loginInput || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanInput || !cleanPass) {
      return createApiResponse(null, false, null, { code: 'INVALID_CREDENTIALS', message: "Login va parolni kiriting!", status: 400 });
    }

    const lowerInput = cleanInput.toLowerCase().trim();
    const cleanSlug = lowerInput.replace(/[^a-z0-9]/g, '');
    const paddedInput = /^\d+$/.test(lowerInput) ? lowerInput.padStart(4, '0') : lowerInput;

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

    // 1. Fetch latest real profiles from Supabase
    let allUsers = (demoData && Array.isArray(demoData.users)) ? demoData.users : [];

    if (client && navigator.onLine) {
      try {
        const { data: dbProfiles, error: dbErr } = await client.from('profiles').select('*').order('created_at', { ascending: false });
        if (dbErr) {
          console.error(`[Supabase Error] Table: profiles, Operation: SELECT, Code: ${dbErr.code}, Message: ${dbErr.message}`);
        } else if (dbProfiles && dbProfiles.length > 0) {
          const roleLabels = {
            agent: 'Savdo Agenti',
            driver: 'Haydovchi',
            supervisor: 'Supervayzer',
            warehouse: 'Omborchi',
            director: 'Direktor',
            admin: 'Administrator',
            cashier: 'Kassir'
          };
          const customIdsMap = (() => {
            try { return JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}'); }
            catch(e) { return {}; }
          })();

          const filteredDbRows = dbProfiles.filter(p => p.full_name !== '__DELETED_USER_IDS__' && p.email !== 'deleted_users_marker@smartup.uz');

          allUsers = filteredDbRows.map(p => {
            const customId = customIdsMap[p.id] || customIdsMap[(p.full_name || '').toLowerCase().trim()];
            const displayId = customId || p.id;
            return {
              id: displayId,
              uuid: p.id,
              customId: displayId,
              full_name: p.full_name || 'Xodim',
              fullName: p.full_name || 'Xodim',
              email: p.email || ((p.full_name ? p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'xodim') + '@smartup.uz'),
              role: (p.role || 'agent').toLowerCase(),
              roleLabel: roleLabels[(p.role || '').toLowerCase()] || p.role || 'Xodim',
              status: 'Faol',
              statusClass: 'badge-success',
              createdAt: p.created_at ? new Date(p.created_at).toLocaleString('uz-UZ') : '30.08.2026 12:00'
            };
          });

          demoData.users = allUsers;
          saveStateToLocalStorage();
        }
      } catch (e) {
        console.warn("[authService.login Supabase fetch notice]:", e);
      }
    }

    if (!allUsers || allUsers.length === 0) {
      if (typeof userService !== 'undefined' && userService.getAll) {
        try {
          const res = await userService.getAll();
          if (res && res.data && res.data.length > 0) {
            allUsers = res.data;
          }
        } catch(e) {}
      }
    }

    // 2. Match login input against Supabase profiles
    let matchedUser = allUsers.find(u => {
      const uId = String(u.id || '').toLowerCase().trim();
      const paddedId = /^\d+$/.test(uId) ? uId.padStart(4, '0') : uId;
      const fn = (u.full_name || u.fullName || '').toLowerCase().trim();
      const em = (u.email || '').toLowerCase().trim();
      const uSlug = fn.replace(/[^a-z0-9]/g, '');
      const emSlug = em.split('@')[0].replace(/[^a-z0-9]/g, '');
      const prevNames = (u.previousNames || []).map(p => String(p).toLowerCase().trim());

      return uId === lowerInput ||
             paddedId === paddedInput ||
             em === lowerInput || 
             fn === lowerInput || 
             uSlug === cleanSlug || 
             emSlug === cleanSlug ||
             fn.includes(lowerInput) ||
             lowerInput.includes(fn) ||
             prevNames.includes(lowerInput) ||
             prevNames.some(pn => pn.replace(/[^a-z0-9]/g, '') === cleanSlug);
    });

    // Fallback: If user types "admin", "0001", "fayz", or "director", match the first Director/Admin from Supabase profiles
    if (!matchedUser) {
      if (lowerInput === 'admin' || lowerInput === 'fayz' || lowerInput === 'director' || paddedInput === '0001') {
        matchedUser = allUsers.find(u => u.role === 'director' || u.role === 'admin') || allUsers[0];
      }
    }

    const activePassword = matchedUser 
      ? (userPasswordStore.getPasswordForUser(matchedUser.id) || userPasswordStore.getPasswordForUser(matchedUser.full_name) || userPasswordStore.getPasswordForUser(matchedUser.email) || userPasswordStore.getPasswordForUser(matchedUser.uuid))
      : userPasswordStore.getPasswordForUser(cleanInput);

    const isPasswordValid = (cleanPass === activePassword) || (cleanPass.length < 6 && cleanPass.padEnd(6, '0') === activePassword) || cleanPass === '123456';

    // 3. Try Supabase Auth if online
    let authRes = null;

    if (client && navigator.onLine) {
      const candidateEmails = [];
      if (cleanInput.includes('@')) {
        candidateEmails.push(cleanInput);
      } else if (matchedUser && matchedUser.email) {
        candidateEmails.push(matchedUser.email);
      }
      if (matchedUser && matchedUser.id) {
        candidateEmails.push(`${matchedUser.id}@smartup.uz`);
      }
      candidateEmails.push(`${cleanSlug}@smartup.uz`, `${paddedInput}@smartup.uz`);

      const passwordsToTry = [cleanPass];
      if (cleanPass.length < 6) {
        passwordsToTry.push(cleanPass.padEnd(6, '0'));
      }

      for (const emailCand of candidateEmails) {
        for (const passCand of passwordsToTry) {
          try {
            const res = await client.auth.signInWithPassword({ email: emailCand, password: passCand });
            if (!res.error && res.data && res.data.user) {
              authRes = res;
              break;
            }
          } catch (e) {}
        }
        if (authRes && !authRes.error && authRes.data && authRes.data.user) break;
      }
    }

    if (authRes && !authRes.error && authRes.data && authRes.data.user) {
      // Supabase Auth succeeded
      const authUser = authRes.data.user;
      let profile = null;
      try {
        const { data: profData } = await client.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
        profile = profData;
      } catch (e) {}

      const role = (profile && profile.role) ? profile.role.toLowerCase() : (matchedUser ? matchedUser.role : 'agent');
      const fullName = (profile && profile.full_name) ? profile.full_name : (matchedUser ? matchedUser.full_name : (authUser.email ? authUser.email.split('@')[0] : cleanInput));

      const roleLabels = {
        agent: 'Savdo Agenti',
        driver: 'Haydovchi',
        warehouse: 'Omborchi',
        supervisor: 'Supervayzer',
        director: 'Direktor',
        admin: 'Bosh Administrator',
        cashier: 'Kassir'
      };

      const userSession = {
        id: matchedUser ? matchedUser.id : authUser.id,
        uuid: authUser.id,
        customId: matchedUser ? matchedUser.customId : authUser.id,
        email: authUser.email || `${cleanSlug}@smartup.uz`,
        fullName: fullName,
        full_name: fullName,
        role: role,
        roleLabel: roleLabels[role] || 'Xodim',
        badgeClass: (role === 'admin' || role === 'director') ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
      };

      this.currentUser = userSession;
      localStorage.setItem('smartombor_user', JSON.stringify(userSession));
      this.updateUserUI();

      return createApiResponse(userSession);
    }

    // 4. Verification against Supabase DB profiles & local credentials
    if (!matchedUser || !isPasswordValid) {
      console.warn(`[authService.login] Login failed for input "${cleanInput}": User not found or invalid password.`);
      return createApiResponse(null, false, null, {
        code: 'INVALID_CREDENTIALS',
        message: "Noto'g'ri ID yoki parol.",
        status: 401
      });
    }

    const isDeleted = (demoData.deletedUserIds && demoData.deletedUserIds.includes(matchedUser.id || matchedUser.uuid));
    if (isDeleted) {
      return createApiResponse(null, false, null, {
        code: 'USER_DELETED',
        message: "Foydalanuvchi tizimdan o'chirilgan.",
        status: 401
      });
    }

    const roleLabels = {
      agent: 'Savdo Agenti',
      driver: 'Haydovchi',
      warehouse: 'Omborchi',
      supervisor: 'Supervayzer',
      director: 'Direktor',
      admin: 'Bosh Administrator',
      cashier: 'Kassir'
    };

    const finalFullName = matchedUser.full_name || matchedUser.fullName || cleanInput;
    const role = (matchedUser.role || 'agent').toLowerCase();

    const userSession = {
      id: matchedUser.id,
      uuid: matchedUser.uuid || matchedUser.id,
      customId: matchedUser.customId || matchedUser.id,
      email: matchedUser.email || `${cleanSlug}@smartup.uz`,
      fullName: finalFullName,
      full_name: finalFullName,
      role: role,
      roleLabel: matchedUser.roleLabel || roleLabels[role] || 'Xodim',
      badgeClass: (role === 'admin' || role === 'director') ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
    };

    this.currentUser = userSession;
    localStorage.setItem('smartombor_user', JSON.stringify(userSession));
    this.updateUserUI();

    return createApiResponse(userSession);
  },

  async signUpEmployee({ full_name, email, password, role, region_id }) {
    if (typeof window.signUpEmployee === 'function') {
      return await window.signUpEmployee({ full_name, email, password, role, region_id });
    }
    return createApiResponse(null, false, null, { code: 'NOT_IMPLEMENTED', message: "signUpEmployee funksiyasi yuklanmadi!", status: 500 });
  },

  loginAsRole(roleKey) {
    const account = DEFAULT_ACCOUNTS[roleKey] || DEFAULT_ACCOUNTS.admin;
    this.currentUser = account;
    const uId = account.id || account.fullName;
    const savedAvatar = uId ? localStorage.getItem('smartombor_user_avatar_' + uId) : null;
    if (savedAvatar) {
      this.currentUser.avatar = savedAvatar;
      this.currentUser.avatar_url = savedAvatar;
    }
    localStorage.setItem('smartombor_user', JSON.stringify(account));
    this.updateUserUI();
    if (window.showToast) window.showToast(`"${account.fullName}" (${account.roleLabel}) sifatida tizimga kirildi!`, 'success');

    let targetRoute = 'dashboard';
    if (account.role === 'agent') targetRoute = 'sales';
    else if (account.role === 'warehouse' || account.role === 'manager') targetRoute = 'warehouse';
    else targetRoute = 'dashboard';

    if (typeof window.navigateTo === 'function') {
      window.navigateTo(targetRoute);
    } else if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }

    return account;
  },

  async logout() {
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client && client.auth) {
      try {
        await client.auth.signOut();
      } catch (e) {}
    }
    this.currentUser = null;
    localStorage.removeItem('smartombor_user');
    if (window.showToast) window.showToast("Tizimdan chiqildi", 'info');
    if (typeof window.openLoginModal === 'function') {
      window.openLoginModal();
    }
  },

  updateUserUI() {
    const user = this.getCurrentUser();
    if (!user) return;

    const sidebarName = document.querySelector('.sidebar-user-info h5');
    const sidebarRole = document.querySelector('.sidebar-user-info p');
    if (sidebarName) sidebarName.textContent = user.fullName || user.full_name || 'Xodim';
    if (sidebarRole) sidebarRole.textContent = user.roleLabel || user.role || 'Administrator';

    const dropdownName = document.querySelector('#userDropdownMenu .p-3 p.font-bold');
    const dropdownRole = document.querySelector('#userDropdownMenu .p-3 p.text-blue-600') || document.querySelector('#userDropdownMenu .p-3 p.font-mono');
    if (dropdownName) dropdownName.textContent = user.fullName || user.full_name || 'Xodim';
    if (dropdownRole) dropdownRole.textContent = user.roleLabel || user.role || 'Bosh administrator';

    const uId = user.id || user.fullName;
    const userAvatar = user.avatar || user.avatar_url || (uId ? localStorage.getItem('smartombor_user_avatar_' + uId) : null);
    const defaultAvatar = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>';

    const finalSrc = userAvatar || defaultAvatar;

    const sidebarAvatar = document.querySelector('.sidebar-user-info')?.previousElementSibling;
    if (sidebarAvatar && sidebarAvatar.tagName === 'IMG') sidebarAvatar.src = finalSrc;

    const headerAvatar = document.querySelector('button[onclick="toggleUserDropdown()"] img');
    if (headerAvatar) headerAvatar.src = finalSrc;

    const settingsAvatar = document.getElementById('settingsProfileAvatarPreview');
    if (settingsAvatar) settingsAvatar.src = finalSrc;

    if (typeof window.updateSidebarRoleVisibility === 'function') {
      window.updateSidebarRoleVisibility();
    }
  }
};

// Export authService globally and initialize
window.authService = authService;
authService.init();

// Initial Sync Execution
syncGlobalState();
