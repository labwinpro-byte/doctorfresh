/* SmartOmbor ERP - Complete Security-Hardened Business Logic & Modals Controller */

if (typeof window.escapeHTML !== 'function') {
  window.escapeHTML = function(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
}
if (typeof escapeHTML !== 'function') {
  var escapeHTML = window.escapeHTML;
}

let pendingConfirmAction = null;
let currentEditingId = null;
let isSubmitting = false;

// Toast Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
      <i data-lucide="check-circle-2" class="w-5 h-5"></i>
    </div>`;
  } else if (type === 'error') {
    iconSvg = `<div class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-bold">
      <i data-lucide="alert-circle" class="w-5 h-5"></i>
    </div>`;
  } else {
    iconSvg = `<div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
      <i data-lucide="info" class="w-5 h-5"></i>
    </div>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-slate-900 leading-snug">${escapeHTML(message)}</p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 p-1" aria-label="Yopish" title="Yopish">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Modal Handlers (Escape & Backdrop click)
async function refreshModalProductOptions() {
  try {
    const purProduct = document.getElementById('purProduct');
    const saleProduct = document.getElementById('saleProduct');
    const outPrd = document.getElementById('outPrd');
    const outTargetWarehouse = document.getElementById('outTargetWarehouse');
    const distProduct = document.getElementById('distProductReal');

    if (!window.demoData) window.demoData = { products: [] };
    if (!demoData.products || demoData.products.length === 0) {
      if (distProduct) distProduct.innerHTML = '<option value="">Tovarlar serverdan yuklanmoqda...</option>';
      if (window.productService) {
        try { await window.productService.getAll(); } catch(e) {}
      }
    }

    const products = (demoData.products || []).filter(p => p !== null && typeof p === 'object');

    if (purProduct) {
      if (products.length > 0) {
        purProduct.innerHTML = products.map(p => 
          `<option value="${p.id || ''}">${escapeHTML(p.name || 'Nomsiz')} (Hozirgi qoldiq: ${p.stock || 0} ${escapeHTML(p.unit || 'dona')})</option>`
        ).join('');
      } else {
        purProduct.innerHTML = `<option value="">Mahsulotlar topilmadi</option>`;
      }
    }

    if (saleProduct) {
      if (products.length > 0) {
        saleProduct.innerHTML = products.map(p => 
          `<option value="${p.id || ''}">${escapeHTML(p.name || 'Nomsiz')} (${Number(p.sellPrice || 0).toLocaleString('uz-UZ')} UZS) - Qoldiq: ${p.stock || 0} ${escapeHTML(p.unit || 'dona')}</option>`
        ).join('');
      } else {
        saleProduct.innerHTML = `<option value="">Mahsulotlar topilmadi</option>`;
      }
    }

    if (outPrd) {
      if (products.length > 0) {
        outPrd.innerHTML = products.map(p => 
          `<option value="${p.id || ''}">${escapeHTML(p.name || 'Nomsiz')} (${escapeHTML(p.warehouse || 'Ombor')}) - Qoldiq: ${p.stock || 0} ${escapeHTML(p.unit || 'dona')}</option>`
        ).join('');
      } else {
        outPrd.innerHTML = `<option value="">Mahsulotlar topilmadi</option>`;
      }
    }

    if (distProduct) {
      if (products.length > 0) {
        distProduct.innerHTML = '<option value="">Tovarni tanlang...</option>' + products.map(p => 
          `<option value="${p.id || ''}" data-price="${p.sellPrice || 0}">${escapeHTML(p.name || 'Nomsiz')} (${Number(p.sellPrice || 0).toLocaleString('uz-UZ')} UZS) - Qoldiq: ${p.stock || 0} ${escapeHTML(p.unit || 'dona')}</option>`
        ).join('');
      } else {
        distProduct.innerHTML = `<option value="">Mahsulotlar topilmadi</option>`;
      }
    }

    // Refresh multi-product item selects in addDistributionModal
    const distSelects = document.querySelectorAll('#distItemsContainer .dist-item-prod');
    distSelects.forEach(sel => {
      const currentVal = sel.value;
      if (typeof getDistProductOptionsHtml === 'function') {
        sel.innerHTML = getDistProductOptionsHtml(currentVal);
      }
      if (currentVal) sel.value = currentVal;
    });

    if (outTargetWarehouse) {
      let warehouses = demoData.warehouses || [];
      if (window.warehouseService) {
        try {
          const whRes = await window.warehouseService.getAll();
          if (whRes && whRes.data && whRes.data.length > 0) warehouses = whRes.data;
        } catch (e) {}
      }
      warehouses = warehouses.filter(w => w !== null);
      if (warehouses.length > 0) {
        outTargetWarehouse.innerHTML = warehouses.map(w => {
          const wName = typeof w === 'object' ? (w.name || 'Ombor') : w;
          return `<option value="${escapeHTML(wName)}">${escapeHTML(wName)}</option>`;
        }).join('');
      } else {
        outTargetWarehouse.innerHTML = '<option value="Boshqa ombor">Boshqa ombor</option>';
      }
    }
  } catch (err) {
    console.error("Refresh modal options error:", err);
    if (window.showToast) showToast("Tovarlarni yuklashda xatolik: " + err.message, "error");
    // Fallback if error occurs so it's not totally empty
    const dp = document.getElementById('distProduct');
    if (dp) dp.innerHTML = `<option value="">Xatolik yuz berdi</option>`;
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    if (modalId === 'addSaleModal') {
      initAddSaleModal();
    } else if (['addPurchaseModal', 'addOutgoingModal', 'addDistributionModal', 'addDistributionOrderModal'].includes(modalId)) {
      refreshModalProductOptions().catch(e => console.warn(e));
    }

    if (window.lucide) lucide.createIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    openModals.forEach(m => closeModal(m.id));
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

function openConfirmModal(title, text, confirmCallback) {
  const modal = document.getElementById('confirmModal');
  if (!modal) return;

  document.getElementById('confirmModalTitle').textContent = title || "Tasdiqlash";
  document.getElementById('confirmModalText').textContent = text || "Ushbu amalni bajarishni tasdiqlaysizmi?";

  pendingConfirmAction = confirmCallback;
  openModal('confirmModal');
}

function handleConfirmSubmit() {
  if (typeof pendingConfirmAction === 'function') {
    pendingConfirmAction();
  }
  closeModal('confirmModal');
  pendingConfirmAction = null;
}

function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return cleaned.length >= 9 && /^\d+$/.test(cleaned);
}

function triggerResetDemoData() {
  openConfirmModal(
    "Demo ma'lumotlarini tiklash",
    "Barcha kiritilgan va o'zgartirilgan demo ma'lumotlar boshlang'ich holatiga qaytariladi. Tasdiqlaysizmi?",
    () => {
      resetDemoDataToDefault();
      showToast("Demo ma'lumotlar boshlang'ich holatga keltirildi!", "info");
      if (typeof renderCurrentView === 'function') renderCurrentView();
    }
  );
}

/* INITIALIZE ALL MODALS IN DOM */
function initModals() {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <!-- Reusable Confirmation Dialog Modal -->
    <div id="confirmModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div class="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold mb-4 mx-auto">
          <i data-lucide="alert-triangle" class="w-6 h-6"></i>
        </div>
        <h3 id="confirmModalTitle" class="text-base font-bold text-slate-900 text-center mb-1">Tasdiqlash</h3>
        <p id="confirmModalText" class="text-xs text-slate-500 text-center mb-6">Ushbu amalni bajarishni tasdiqlaysizmi?</p>
        <div class="flex items-center justify-center gap-3">
          <button onclick="closeModal('confirmModal')" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold">
            Bekor qilish
          </button>
          <button onclick="handleConfirmSubmit()" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">
            Ha, bajarsin
          </button>
        </div>
      </div>
    </div>

    <!-- Tovar Qo'shish va Tahrirlash Modali -->
    <div id="addProductModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i data-lucide="package-plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="productModalTitle" class="text-lg font-bold text-slate-900">Yangi tovar qo'shish</h3>
              <p class="text-xs text-slate-500">Omborga mahsulot ma'lumotlarini kiriting</p>
            </div>
          </div>
          <button onclick="closeModal('addProductModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form id="addProductForm" onsubmit="handleSaveProduct(event)" class="p-6 overflow-y-auto space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tovar nomi *</label>
              <input type="text" id="prdName" required placeholder="Masalan: Bosch GSB 13 RE Drel" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Shtrix-kod / SKU</label>
              <input type="text" id="prdSku" placeholder="PRD-1013" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kategoriya *</label>
              <select id="prdCategory" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.categories.map(cat => {
                const id = typeof cat === 'object' ? cat.id : cat;
                const name = typeof cat === 'object' ? cat.name : cat;
                return `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ombor *</label>
            <select id="prdWarehouse" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.warehouses.map(wh => {
                const id = typeof wh === 'object' ? wh.id : wh;
                const name = typeof wh === 'object' ? wh.name : wh;
                return `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`;
              }).join('')}
            </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">O'lchov birligi *</label>
              <select id="prdUnit" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <option value="dona">dona</option>
                <option value="kg">kg</option>
                <option value="metr">metr</option>
                <option value="quti">quti</option>
                <option value="litr">litr</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Xarid narxi (Tannarx) (UZS) *</label>
              <input type="number" id="prdBuyPrice" min="0" required placeholder="650000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Chakana Sotuv Narxi (UZS) *</label>
              <input type="number" id="prdSellPrice" min="0" required placeholder="850000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Optom / Ulgurji Narx (UZS)</label>
              <input type="number" id="prdWholesalePrice" min="0" placeholder="760000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">VIP / Dilerlik Narxi (UZS)</label>
              <input type="number" id="prdVipPrice" min="0" placeholder="690000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qoldiq miqdori *</label>
              <input type="number" id="prdStock" min="0" required placeholder="50" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Minimal qoldiq (Ogohlantirish)</label>
              <input type="number" id="prdMinStock" min="0" placeholder="10" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addProductModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Tovar Tafsilotlari Modali -->
    <div id="viewProductModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i data-lucide="package" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="viewPrdName" class="text-base font-bold text-slate-900">Bosch GSB 13 RE Drel</h3>
              <p id="viewPrdSku" class="text-xs font-mono text-slate-500">PRD-1001</p>
            </div>
          </div>
          <button onclick="closeModal('viewProductModal')" class="text-slate-400 hover:text-slate-600" aria-label="Yopish"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>

        <div class="py-4 space-y-3 text-xs">
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Kategoriya:</span><span id="viewPrdCategory" class="font-semibold text-slate-900">Qurilish mollari</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Ombor:</span><span id="viewPrdWarehouse" class="font-semibold text-slate-900">Asosiy Ombor</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Qoldiq miqdor:</span><span id="viewPrdStock" class="font-bold text-slate-900">145 dona</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Xarid narxi:</span><span id="viewPrdBuyPrice" class="font-semibold text-slate-700">650,000 UZS</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Sotuv narxi:</span><span id="viewPrdSellPrice" class="font-bold text-blue-600">850,000 UZS</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Foyda marjasi:</span><span id="viewPrdMargin" class="font-bold text-emerald-600">+200,000 UZS (30.7%)</span></div>
          <div class="flex justify-between py-1"><span class="text-slate-500">Holati:</span><span id="viewPrdStatus" class="badge badge-success">Mavjud</span></div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex justify-end">
          <button onclick="closeModal('viewProductModal')" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">Yopish</button>
        </div>
      </div>
    </div>

    <!-- Ombor Qo'shish va Tahrirlash Modali -->
    <div id="addWarehouseModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i data-lucide="building-2" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="warehouseModalTitle" class="text-lg font-bold text-slate-900">Yangi ombor qo'shish</h3>
              <p class="text-xs text-slate-500">Ombor rekvizitlarini kiriting</p>
            </div>
          </div>
          <button onclick="closeModal('addWarehouseModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveWarehouse(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ombor nomi *</label>
            <input type="text" id="whName" required placeholder="Masalan: Yunusobod Ombori" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ombor kodi</label>
            <input type="text" id="whCode" placeholder="OMB-005" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mas'ul shaxs (Manager)</label>
            <input type="text" id="whManager" placeholder="Jamshid Ergashboyev" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Telefon</label>
            <input type="text" id="whPhone" placeholder="+998 90 123-45-67" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Manzil</label>
            <input type="text" id="whAddress" placeholder="Toshkent sh., Yunusobod tumani" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addWarehouseModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Omborni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Kirim Yaratish (Purchases) Modal -->
    <div id="addPurchaseModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">+ Kirim yaratish</h3>
              <p class="text-xs text-slate-500">Yetkazib beruvchidan omborga tovar qabul qilish</p>
            </div>
          </div>
          <button onclick="closeModal('addPurchaseModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSavePurchase(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Yetkazib beruvchi *</label>
            <select id="purSupplier" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.suppliers.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qabul qiluvchi Ombor *</label>
            <select id="purWarehouse" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.warehouses.map(w => `<option value="${escapeHTML(w.name)}">${escapeHTML(w.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tovar *</label>
            <select id="purProduct" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.products.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (Hozirgi qoldiq: ${p.stock} ${p.unit})</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kirim Miqdori *</label>
              <input type="number" id="purQty" required min="1" value="10" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Xarid Narxi (dona/UZS) *</label>
              <input type="number" id="purBuyPrice" required min="0" value="650000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addPurchaseModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Kirimni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Chiqim Yaratish Modal -->
    <div id="addOutgoingModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <i data-lucide="arrow-up-right" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">+ Chiqim / Ko'chirish yaratish</h3>
              <p class="text-xs text-slate-500">Omborlararo ko'chirish yoki hisobdan chiqarish</p>
            </div>
          </div>
          <button onclick="closeModal('addOutgoingModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveOutgoing(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Chiqim Sababi *</label>
            <select id="outReason" required onchange="toggleTransferWarehouseField(this.value)" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              <option value="Omborlararo ko'chirish">Omborlararo ko'chirish</option>
              <option value="Yaroqsiz / Shikastlangan">Yaroqsiz / Shikastlangan</option>
              <option value="Ichki foydalanish (Ofis)">Ichki foydalanish (Ofis)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Tovar *</label>
            <select id="outPrd" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.products.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${escapeHTML(p.warehouse)}) - Qoldiq: ${p.stock} ${p.unit}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Miqdor *</label>
              <input type="number" id="outQty" required min="1" value="1" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div id="targetWhContainer">
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qabul Qiluvchi Ombor *</label>
              <select id="outTargetWarehouse" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                ${demoData.warehouses.map(w => `<option value="${escapeHTML(w.name)}">${escapeHTML(w.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addOutgoingModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Chiqimni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Sotuv Yaratish Modal (Multi-product Workflow) -->
    <div id="addSaleModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <i data-lucide="plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-base font-extrabold text-slate-900">+ Yangi sotuv</h3>
              <p class="text-xs text-slate-500">Mijozga sotuv bitimi va chek rasmiylashtirish</p>
            </div>
          </div>
          <button type="button" onclick="closeModal('addSaleModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveSale(event)" class="p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-130px)]">
          <!-- MIJOZ -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">MIJOZ *</label>
            <select id="saleCustomer" required onchange="onSaleCustomerChange(this.value)" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <!-- Dynamically populated -->
            </select>
            <!-- Dynamic info strip -->
            <div class="mt-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
              <div>Joriy qarz: <span id="saleCustDebtVal" class="font-bold text-slate-900">0 UZS</span></div>
              <div>Limit: <span id="saleCustLimitVal" class="font-bold text-blue-600">50 000 000 UZS</span></div>
              <div>Ruxsat etilgan qolgan limit: <span id="saleCustRemainingLimitVal" class="font-bold text-emerald-600">50 000 000 UZS</span></div>
            </div>
          </div>

          <!-- SOTUV MAHSULOTLARI -->
          <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase text-slate-700">SOTUV MAHSULOTLARI *</span>
                <span id="saleItemsCountBadge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">1 xil tovar</span>
              </div>
              <button type="button" onclick="addSaleProductRow()" class="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition active:scale-95">
                + Mahsulot qo'shish
              </button>
            </div>

            <!-- Rows container -->
            <div id="saleProductRowsContainer" class="space-y-3">
              <!-- Rows injected here -->
            </div>

            <!-- Jami summa summary line -->
            <div class="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span class="font-bold text-slate-700 uppercase">JAMI SUMMA:</span>
              <div class="flex items-center gap-3">
                <span id="saleTotalQtyDisplay" class="text-slate-500 font-medium">0 dona</span>
                <span id="saleTotalAmountDisplay" class="font-bold text-emerald-600 text-sm">0 UZS</span>
              </div>
            </div>
          </div>

          <!-- TO'LOV TURI & TO'LANGAN SUMMA -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">TO'LOV TURI *</label>
              <select id="salePaymentType" onchange="calculateSaleDebtSummary()" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Naqd">Naqd pul (To'liq to'lov)</option>
                <option value="Terminal">Terminal (Humo/Uzcard)</option>
                <option value="Bank o'tkazmasi">Bank o'tkazmasi (Hisob-raqam)</option>
                <option value="Nasiya">Nasiya / Qarz (To'lanmadi)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">TO'LANGAN SUMMA</label>
              <input type="number" id="salePaidAmount" min="0" oninput="calculateSaleDebtSummary()" placeholder="Bo'sh bo'lsa to'liq to'langan" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400">
              <div class="mt-1.5 text-xs text-slate-500">
                Qarzdorlikka: <span id="saleProjectedDebtDisplay" class="font-bold text-emerald-600">0 UZS (To'liq to'langan)</span>
              </div>
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="closeModal('addSaleModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition active:scale-95">
              Bekor qilish
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-[#00a368] hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm">
              Sotuvni yakunlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Sotuv Tafsilotlari Modal -->
    <div id="viewSaleModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div class="text-center pb-4 border-b border-dashed border-slate-200">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mx-auto mb-2">
            <i data-lucide="receipt" class="w-6 h-6"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900">Sotuv Tafsilotlari va Chek</h3>
          <p id="viewSaleReceiptNo" class="text-xs font-mono text-slate-500">CHK-8801</p>
          <p id="viewSaleDate" class="text-[11px] text-slate-400">30.08.2026 16:45</p>
        </div>

        <div class="py-4 space-y-3 text-xs">
          <div class="flex justify-between"><span class="text-slate-500">Ombor:</span><span id="viewSaleWarehouse" class="font-semibold text-slate-800">Asosiy Ombor - Toshkent</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Mijoz:</span><span id="viewSaleCustomer" class="font-bold text-slate-900">rombik</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Mahsulot nomi:</span><span id="viewSaleItems" class="font-bold text-slate-800">See Young 600ml</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Miqdori:</span><span id="viewSaleQty" class="font-semibold text-blue-600">25 dona</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Savdo agenti:</span><span id="viewSaleAgent" class="font-semibold text-slate-800">FAYZ</span></div>
          <div class="flex justify-between"><span class="text-slate-500">To'lov turi:</span><span id="viewSalePaymentType" class="font-semibold text-blue-600">Naqd pul</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Mijoz qarzdorligi:</span><span id="viewSaleDebt" class="font-bold text-rose-600">+295 000 UZS</span></div>
          <div class="flex justify-between pt-2 border-t border-slate-100"><span class="text-sm font-bold text-slate-900">Umumiy summa:</span><span id="viewSaleAmount" class="text-base font-extrabold text-emerald-600">2 000 000 UZS</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Holat:</span><span id="viewSaleStatus" class="px-3 py-1 rounded-md text-xs font-bold bg-[#00a368] text-white">Yangi</span></div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onclick="window.print()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition">
            <i data-lucide="printer" class="w-4 h-4"></i> Chop etish
          </button>
          <button onclick="closeModal('viewSaleModal')" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition">
            Yopish
          </button>
        </div>
      </div>
    </div>

    <!-- Mijoz Ko'rish Modal -->
    <div id="viewCustomerModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        <div class="text-center pb-4 border-b border-dashed border-slate-200">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mx-auto mb-2">
            <i data-lucide="user" class="w-6 h-6"></i>
          </div>
          <h3 id="viewCustName" class="text-lg font-bold text-slate-900">rombik</h3>
          <p id="viewCustPhone" class="text-xs font-mono text-slate-500">+998996568412</p>
        </div>

        <div class="py-4 space-y-3 text-xs">
          <div class="flex justify-between"><span class="text-slate-500">Manzil:</span><span id="viewCustAddress" class="font-medium text-slate-700">Toshkent sh.</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Narx toifasi:</span><span id="viewCustPriceType" class="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700">Chakana</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Kredit limit:</span><span id="viewCustCreditLimit" class="font-bold text-slate-900">50 000 000 UZS</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Qarzdorlik balansi:</span><span id="viewCustBalance" class="font-bold text-rose-600">+295 000 UZS</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Moliyaviy holat:</span><span id="viewCustStatus" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Qarzdorlik bor</span></div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button id="viewCustEditBtn" class="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Tahrirlash
          </button>
          <button onclick="closeModal('viewCustomerModal')" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition">
            Yopish
          </button>
        </div>
      </div>
    </div>

    <!-- Mijoz Modal -->
    <div id="addCustomerModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <i data-lucide="user-plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="customerModalTitle" class="text-lg font-bold text-slate-900">Mijoz ma'lumotlari</h3>
              <p class="text-xs text-slate-500">Mijoz kontaktlari va balansini boshqarish</p>
            </div>
          </div>
          <button onclick="closeModal('addCustomerModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveCustomer(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mijoz / Tashkilot nomi *</label>
            <input type="text" id="custName" required placeholder="Masalan: Orient Stroy MCHJ" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Telefon raqami *</label>
            <input type="text" id="custPhone" required placeholder="+998 90 123-45-67" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Manzil</label>
            <input type="text" id="custAddress" placeholder="Toshkent sh., Yunusobod tumani" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Narx Toifasi *</label>
            <select id="custPriceType" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              <option value="retail">Chakana narx (Odatdiy)</option>
              <option value="wholesale">Optom / Ulgurji narx</option>
              <option value="vip">VIP / Dilerlik narxi</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kredit Limit (UZS)</label>
              <input type="number" id="custCreditLimit" min="0" placeholder="50000000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qarzdorlik Balansi (UZS)</label>
              <input type="number" id="custBalance" placeholder="0" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
          </div>
          <div>
            <label class="flex items-center gap-2 text-xs font-semibold text-rose-600 cursor-pointer pt-1">
              <input type="checkbox" id="custIsBlocked" class="w-4 h-4 text-rose-600 rounded">
              <span>Mijozni bloklash</span>
            </label>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addCustomerModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Mijozni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Yetkazib beruvchi Modal -->
    <div id="addSupplierModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <i data-lucide="truck" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="supplierModalTitle" class="text-lg font-bold text-slate-900">Yetkazib beruvchi ma'lumotlari</h3>
              <p class="text-xs text-slate-500">Hamkor kompaniya va mas'ul shaxs</p>
            </div>
          </div>
          <button onclick="closeModal('addSupplierModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveSupplier(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Yetkazib beruvchi nomi *</label>
            <input type="text" id="supName" required placeholder="Masalan: Bosch Uzbekistan" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Telefon *</label>
            <input type="text" id="supPhone" required placeholder="+998 71 200-00-00" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Yetkaziladigan tovarlar</label>
            <input type="text" id="supCategory" placeholder="Qurilish mollari" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addSupplierModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Kassa Modal -->
    <div id="addCashTxModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div id="cashTxIconBg" class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <i data-lucide="wallet" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="cashTxModalTitle" class="text-lg font-bold text-slate-900">Kassa operatsiyasi</h3>
              <p class="text-xs text-slate-500">Moliya operatsiyasini qayd etish</p>
            </div>
          </div>
          <button onclick="closeModal('addCashTxModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveCashTx(event)" class="p-6 space-y-4">
          <input type="hidden" id="cashTxType" value="income">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Operatsiya nomi *</label>
            <input type="text" id="cashTxOp" required placeholder="Masalan: Tushum yoki Mijoz avansi" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Kategoriya *</label>
            <select id="cashTxCat" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              <option value="Sotuvlar">Sotuvlar tushumi</option>
              <option value="Operatsion xarajat">Operatsion xarajat</option>
              <option value="Logistika">Logistika va yetkazish</option>
              <option value="Ish haqi">Ish haqi to'lovi</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Summa (UZS) *</label>
            <input type="number" id="cashTxAmount" min="1" required placeholder="5000000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Izoh</label>
            <input type="text" id="cashTxComment" placeholder="Qisqacha izoh..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addCashTxModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" id="cashTxSubmitBtn" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Haydovchi Biriktirish Modal -->
    <div id="assignDriverModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <i data-lucide="truck" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">Haydovchini Biriktirish</h3>
              <p class="text-xs text-slate-500">Buyurtmaga javobgar haydovchi/kuryer tanlang</p>
            </div>
          </div>
          <button onclick="closeModal('assignDriverModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleAssignDriver(event)" class="p-6 space-y-4">
          <input type="hidden" id="assignTargetOrderId">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Haydovchini tanlang *</label>
            <select id="assignDriverSelect" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${(demoData.drivers || []).map(d => `<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)} — ${escapeHTML(d.vehicle)} (${d.status})</option>`).join('')}
            </select>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('assignDriverModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Biriktirish
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Tovar Qaytarish (Vozvrat) Modal -->
    <div id="addOrderReturnModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">+ Tovar Qaytarish (Vozvrat)</h3>
              <p class="text-xs text-slate-500">Mijozdan qaytgan tovarni rasmiylashtirish</p>
            </div>
          </div>
          <button onclick="closeModal('addOrderReturnModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveOrderReturn(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mijoz *</label>
            <select id="retCustomer" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.customers.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qaytarilayotgan Tovar *</label>
            <select id="retProduct" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              ${demoData.products.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${p.sellPrice.toLocaleString('uz-UZ')} UZS)</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Miqdor *</label>
              <input type="number" id="retQty" min="1" value="1" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qaytarish Sababi *</label>
              <select id="retReason" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <option value="muddati_otgan">Muddati o'tgan / Yaroqsiz</option>
                <option value="nuqsonli">Nuqsonli (Brak)</option>
                <option value="ortiqcha_tovar">Ortiqcha tovar</option>
                <option value="boshqa">Boshqa sabab</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Qaytariladigan Summa (UZS) *</label>
            <input type="number" id="retRefundAmount" min="0" required placeholder="850000" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addOrderReturnModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Vozvratni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Xodim Qo'shish (SignUp) Modali -->
    <div id="addEmployeeModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i data-lucide="user-plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">Xodim qo'shish</h3>
              <p class="text-xs text-slate-500">Yangi xodimni ro'yxatdan o'tkazish (SignUp)</p>
            </div>
          </div>
          <button onclick="closeModal('addEmployeeModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveEmployee(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ism-sharif (full_name) *</label>
            <input type="text" id="empFullName" required placeholder="Masalan: Jasur Alimov" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Foydalanuvchi ID (Login ID)</label>
            <input type="text" id="empUserId" placeholder="Masalan: 0013 (Direktor huquqi bo'lsa belgilashingiz mumkin)" oninput="handleUserIdInputChange(this.value, 'empUserIdWarning', 'empUserId', 'saveEmpSubmitBtn')" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            <div id="empUserRoleNote" class="mt-1"></div>
          </div>

          <!-- Dynamic Live Warning Block for Add/Edit Employee Modal -->
          <div id="empUserIdWarning" class="hidden"></div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Parol (password) *</label>
            <input type="password" id="empPassword" placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Rol tanlash (role) *</label>
            <select id="empRole" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="agent">agent (Savdo Agenti)</option>
              <option value="driver">driver (Haydovchi)</option>
              <option value="warehouse">warehouse (Omborchi)</option>
              <option value="director">director (Direktor)</option>
              <option value="admin">admin (Administrator)</option>
            </select>
          </div>
          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addEmployeeModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" id="saveEmpSubmitBtn" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-blue-500/20">
              <i data-lucide="check" class="w-4 h-4"></i> Xodimni saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Profilni Tahrirlash Modali -->
    <div id="editProfileModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <i data-lucide="user-cog" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900">Profil ma'lumotlari</h3>
              <p class="text-xs text-slate-500">Shaxsiy ma'lumotlar va login ID ni tahrirlash</p>
            </div>
          </div>
          <button onclick="closeModal('editProfileModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="handleSaveSelfProfile(event)" class="p-6 space-y-4">
          <div class="flex items-center gap-4 mb-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <img id="modalProfileAvatarPreview" src="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>" alt="Avatar" class="w-14 h-14 rounded-full object-cover border-2 border-blue-500 shadow-md shrink-0">
            <div>
              <input type="file" id="modalProfileAvatarFileInput" accept="image/*" class="hidden" onchange="handleModalAvatarUpload(event)">
              <button type="button" onclick="document.getElementById('modalProfileAvatarFileInput').click()" class="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition active:scale-95 flex items-center gap-1.5 shadow-xs">
                <i data-lucide="camera" class="w-3.5 h-3.5 text-blue-600"></i> Rasmni o'zgartirish
              </button>
              <p class="text-[10px] text-slate-400 mt-1">Shaxsiy rasm yuklang (PNG, JPG max 5MB)</p>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ism-sharif (full_name) *</label>
            <input type="text" id="selfFullName" required placeholder="Masalan: FAYZ" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Foydalanuvchi ID (Login ID) *</label>
            <input type="text" id="selfUserId" required oninput="handleUserIdInputChange(this.value, 'modalUserIdWarning', 'selfUserId', 'modalProfileSaveBtn')" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            <div id="modalUserRoleNote" class="mt-1"></div>
          </div>

          <!-- Dynamic Live Warning Block for Profile Modal -->
          <div id="modalUserIdWarning" class="hidden"></div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Telefon raqami</label>
            <input type="text" id="selfPhone" placeholder="+998 90 123-45-67" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-blue-600"></i> Parolni o'zgartirish
            </h4>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Joriy (eski) parol</label>
              <input type="password" id="selfCurrentPassword" placeholder="Hozirgi parolingiz..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Yangi parol</label>
              <input type="password" id="selfNewPassword" minlength="6" placeholder="Yangi parol (kamida 6 belgi)..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Yangi parolni takrorlang</label>
              <input type="password" id="selfConfirmPassword" minlength="6" placeholder="Yangi parolni qayta kiriting..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('editProfileModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" id="modalProfileSaveBtn" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-blue-500/20">
              <i data-lucide="check" class="w-4 h-4"></i> Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Yangi Buyurtma Yaratish Modali (Distribyutsiya) -->
    <div id="addDistributionModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div class="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <i data-lucide="package-plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Yangi Buyurtma Yaratish</h3>
              <p class="text-xs text-slate-500">Logistika va yetkazib berish buyurtmasi</p>
            </div>
          </div>
          <button onclick="closeModal('addDistributionModal')" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center" aria-label="Yopish">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <form onsubmit="handleSaveDistributionOrder(event)" class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <!-- Customer & Driver Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mijoz Nomi *</label>
              <input type="text" id="distCustomerName" required placeholder="Masalan: Orient Group MCHJ" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Haydovchi / Kuryer</label>
              <select id="distDriverName" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Biriktirilmagan">Biriktirilmagan</option>
              </select>
            </div>
          </div>

          <!-- Warehouse & Status Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ombor</label>
              <select id="distWarehouseName" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Asosiy Ombor - Toshkent">Asosiy Ombor - Toshkent</option>
                <option value="Chilonzor Ombori">Chilonzor Ombori</option>
                <option value="Yashnobod Ombori">Yashnobod Ombori</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Boshlang'ich Holat</label>
              <select id="distStatus" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="yangi">1. Yangi Buyurtmalar</option>
                <option value="yigildi">2. Omborda Yig'ildi</option>
                <option value="yetkazilmoqda">3. Yetkazilmoqda (Yo'lda)</option>
                <option value="yetkazildi">4. Yetkazildi va To'landi</option>
              </select>
            </div>
          </div>

          <!-- Multi-Product Items Container -->
          <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Buyurtma Mahsulotlari *</span>
                <span id="distItemsCountBadge" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">1 xil tovar</span>
              </div>
              <button type="button" onclick="addDistItemRow()" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-blue-200">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> + Mahsulot qo'shish
              </button>
            </div>

            <div id="distItemsContainer" class="space-y-2.5">
              <!-- Dynamically populated rows -->
            </div>

            <!-- Total Amount Bar -->
            <div class="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-600 font-bold uppercase tracking-wider">Jami Summa:</span>
              <div class="flex items-center gap-3">
                <span id="distTotalQtyDisplay" class="text-slate-500 font-bold">0 dona</span>
                <span id="distTotalAmountDisplay" class="text-base font-black text-emerald-600 font-mono">0 UZS</span>
              </div>
            </div>
            <input type="hidden" id="distTotalAmount" value="0">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Izoh / Manzil</label>
            <textarea id="distNotes" rows="2" placeholder="Masalan: Ertalab soat 10:00 gacha yetkazilsin..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onclick="closeModal('addDistributionModal')" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium">Bekor qilish</button>
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md active:scale-95 transition">Buyurtmani Yaratish</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Buyurtma Tafsilotlari va PDF/Excel Export Modali -->
    <div id="viewOrderModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/30">
              <i data-lucide="package-check" class="w-6 h-6"></i>
            </div>
            <div>
              <h3 id="vOrdNumber" class="text-lg font-black text-slate-900 font-mono">ORD-2026-1001</h3>
              <p id="vOrdDate" class="text-xs text-slate-500 font-medium">31.08.2026 09:30</p>
            </div>
          </div>
          <button onclick="closeModal('viewOrderModal')" class="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <!-- Summary Metadata -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs">
            <div>
              <span class="text-slate-400 font-medium block">Mijoz:</span>
              <strong id="vOrdCustomer" class="text-slate-900 font-bold block text-sm mt-0.5">-</strong>
            </div>
            <div>
              <span class="text-slate-400 font-medium block">Haydovchi (Kuryer):</span>
              <strong id="vOrdDriver" class="text-blue-600 font-bold block mt-0.5">-</strong>
            </div>
            <div>
              <span class="text-slate-400 font-medium block">Ombor:</span>
              <strong id="vOrdWarehouse" class="text-slate-700 font-semibold block mt-0.5">-</strong>
            </div>
            <div>
              <span class="text-slate-400 font-medium block">Agent:</span>
              <strong id="vOrdAgent" class="text-slate-700 font-semibold block mt-0.5">-</strong>
            </div>
            <div>
              <span class="text-slate-400 font-medium block">Holat:</span>
              <span id="vOrdStatus" class="badge badge-primary mt-0.5">-</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium block">Umumiy Summa:</span>
              <strong id="vOrdTotal" class="text-emerald-600 font-black text-sm mt-0.5">0 UZS</strong>
            </div>
          </div>

          <div id="vOrdNotesBox" class="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <i data-lucide="info" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold">Izoh / Manzil:</span>
              <span id="vOrdNotes" class="ml-1 font-medium">-</span>
            </div>
          </div>

          <!-- Items List -->
          <div>
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Buyurtma tovarlari</h4>
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th class="p-3">Tovar Nomi</th>
                    <th class="p-3 text-center">Miqdor</th>
                    <th class="p-3 text-right">Narxi</th>
                    <th class="p-3 text-right">Jami</th>
                  </tr>
                </thead>
                <tbody id="vOrdItemsBody" class="divide-y divide-slate-100">
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Actions Footer with Invoice, Print, PDF & Excel Buttons -->
        <div class="p-5 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" id="vOrdActiveId">
          <div class="flex items-center gap-2">
            <button onclick="closeModal('viewOrderModal')" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold">
              Yopish
            </button>
            <button id="vOrdCancelBtn" onclick="handleCancelOrderModal()" class="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition">
              <i data-lucide="x-circle" class="w-4 h-4"></i> Bekor qilish
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button id="vOrdInvoiceBtn" onclick="openInvoiceModal(document.getElementById('vOrdActiveId').value)" class="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition">
              <i data-lucide="file-text" class="w-4 h-4"></i> 📑 Yuk Xati (Nakladnaya)
            </button>

            <button id="vOrdPrintBtn" onclick="printSingleOrderInvoice(document.getElementById('vOrdActiveId').value)" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition">
              <i data-lucide="printer" class="w-4 h-4"></i> 🖨️ Chop etish
            </button>

            <button id="vOrdPdfBtn" onclick="exportSingleOrderPDF(document.getElementById('vOrdActiveId').value)" class="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/20 active:scale-95 transition">
              <i data-lucide="file-text" class="w-4 h-4"></i> 📄 PDF
            </button>

            <button id="vOrdExcelBtn" onclick="exportSingleOrderExcel(document.getElementById('vOrdActiveId').value)" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition">
              <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> 📊 Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Yuk Xati (Nakladnaya / Buyurtma Cheki) Modal -->
    <div id="invoiceModal" class="modal-overlay fixed inset-0 z-50 hidden items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div class="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200 my-auto">
        <!-- Top Action Bar -->
        <div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              <i data-lucide="file-text" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 leading-snug">Yuk Xati (Nakladnaya)</h3>
              <p class="text-xs text-slate-500">Rasmiy distribyutsiya va sotuv rasmiylashtiruvi hujjati</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="printSingleOrderInvoice(document.getElementById('invoiceActiveOrderId').value)" class="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm active:scale-95">
              <i data-lucide="printer" class="w-4 h-4"></i> 🖨️ Chop etish (Print)
            </button>
            <button onclick="exportSingleOrderPDF(document.getElementById('invoiceActiveOrderId').value)" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm active:scale-95">
              <i data-lucide="file-text" class="w-4 h-4"></i> 📄 PDF
            </button>
            <button onclick="exportSingleOrderExcel(document.getElementById('invoiceActiveOrderId').value)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm active:scale-95">
              <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> 📊 Excel
            </button>
            <button onclick="closeModal('invoiceModal')" class="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition" aria-label="Yopish">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Printable Invoice Sheet Area -->
        <div class="p-6 overflow-y-auto bg-slate-100 flex-1">
          <input type="hidden" id="invoiceActiveOrderId">
          <div id="invoiceSheetContainer" class="bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-300 max-w-3xl mx-auto font-sans text-slate-900 space-y-4">
            <!-- Dynamic Invoice Document Content injected by openInvoiceModal -->
          </div>
        </div>
      </div>
    </div>

    <!-- Login Modal Form (Authentication & RBAC) -->
    <div id="loginModal" class="fixed inset-0 z-[9999] hidden items-center justify-center p-4 sm:p-6 bg-slate-50 overflow-y-auto">
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
        <div class="p-8 text-center bg-gradient-to-b from-blue-50 to-white border-b border-slate-100">
          <div class="w-16 h-16 rounded-2xl bg-blue-600 text-white mx-auto flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-500/30 mb-4">
            <i data-lucide="layers" class="w-8 h-8"></i>
          </div>
          <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">SmartOmbor ERP</h2>
          <p class="text-xs text-slate-500 mt-1 font-medium">Tizimga kirish uchun login va parolingizni kiriting</p>
        </div>

        <form onsubmit="handleLoginSubmit(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">ID (Foydalanuvchi ID) *</label>
            <div class="relative">
              <i data-lucide="user" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" id="loginEmail" required placeholder="" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Parol *</label>
            <div class="relative">
              <i data-lucide="lock" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="password" id="loginPassword" required placeholder="••••••••" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
            </div>
          </div>

          <button type="submit" class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2">
            <i data-lucide="log-in" class="w-4 h-4"></i> Tizimga Kirish
          </button>
        </form>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p class="text-[11px] font-medium text-slate-400">SmartOmbor ERP Security Engine © 2026</p>
        </div>
      </div>
    </div>
  `;
}

function toggleTransferWarehouseField(val) {
  const container = document.getElementById('targetWhContainer');
  if (container) {
    if (val === "Omborlararo ko'chirish") {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  }
}

/* OPEN MODALS FOR EDIT & VIEW MODES */
function populateProductModalSelects(selectedCategoryId = null, selectedWarehouseId = null, selectedCategoryName = null, selectedWarehouseName = null) {
  const catSelect = document.getElementById('prdCategory');
  const whSelect = document.getElementById('prdWarehouse');

  if (catSelect) {
    const categories = (demoData.categories && demoData.categories.length > 0) ? demoData.categories : defaultCategoryList;
    catSelect.innerHTML = categories.map(c => {
      const id = typeof c === 'object' ? (c.id || c.name) : c;
      const name = typeof c === 'object' ? (c.name || c.id) : c;
      const isSel = (selectedCategoryId && (selectedCategoryId === id || selectedCategoryId === name)) || 
                    (selectedCategoryName && (selectedCategoryName === name || selectedCategoryName === id));
      return `<option value="${escapeHTML(id)}" ${isSel ? 'selected' : ''}>${escapeHTML(name)}</option>`;
    }).join('');
  }

  if (whSelect) {
    const warehouses = (demoData.warehouses && demoData.warehouses.length > 0) ? demoData.warehouses : defaultWarehouseList;
    whSelect.innerHTML = warehouses.map(w => {
      const id = typeof w === 'object' ? (w.id || w.name) : w;
      const name = typeof w === 'object' ? (w.name || w.id) : w;
      const isSel = (selectedWarehouseId && (selectedWarehouseId === id || selectedWarehouseId === name)) || 
                    (selectedWarehouseName && (selectedWarehouseName === name || selectedWarehouseName === id));
      return `<option value="${escapeHTML(id)}" ${isSel ? 'selected' : ''}>${escapeHTML(name)}</option>`;
    }).join('');
  }
}

function openCreateProductModal() {
  currentEditingId = null;
  const titleEl = document.getElementById('productModalTitle');
  if (titleEl) titleEl.textContent = "Yangi tovar qo'shish";
  const formEl = document.getElementById('addProductForm');
  if (formEl) formEl.reset();

  openModal('addProductModal');
  populateProductModalSelects();
}

function openEditProductModal(id) {
  const prd = demoData.products.find(p => p.id === id);
  if (!prd) return;

  currentEditingId = id;
  const titleEl = document.getElementById('productModalTitle');
  if (titleEl) titleEl.textContent = "Tovarni tahrirlash";
  if (document.getElementById('prdName')) document.getElementById('prdName').value = prd.name;
  if (document.getElementById('prdSku')) document.getElementById('prdSku').value = prd.sku;
  if (document.getElementById('prdUnit')) document.getElementById('prdUnit').value = prd.unit || 'dona';
  if (document.getElementById('prdBuyPrice')) document.getElementById('prdBuyPrice').value = prd.buyPrice;
  if (document.getElementById('prdSellPrice')) document.getElementById('prdSellPrice').value = prd.priceRetail || prd.sellPrice;
  if (document.getElementById('prdWholesalePrice')) document.getElementById('prdWholesalePrice').value = prd.wholesalePrice || Math.round(prd.sellPrice * 0.9);
  if (document.getElementById('prdVipPrice')) document.getElementById('prdVipPrice').value = prd.vipPrice || Math.round(prd.sellPrice * 0.8);
  if (document.getElementById('prdStock')) document.getElementById('prdStock').value = prd.stock !== undefined ? prd.stock : 0;
  if (document.getElementById('prdMinStock')) document.getElementById('prdMinStock').value = prd.minStock !== undefined ? prd.minStock : 5;

  openModal('addProductModal');
  populateProductModalSelects(prd.categoryId || prd.category, prd.warehouseId || prd.warehouse, prd.category, prd.warehouse);
}

async function openViewProductModal(id) {
  let prd = demoData.products.find(p => p.id === id);
  if (!prd) {
    const res = await productService.getById(id);
    if (res.success) prd = res.data;
  }
  if (!prd) return;

  document.getElementById('viewPrdName').textContent = prd.name;
  document.getElementById('viewPrdSku').textContent = prd.sku;
  document.getElementById('viewPrdCategory').textContent = prd.category;
  document.getElementById('viewPrdWarehouse').textContent = prd.warehouse;
  document.getElementById('viewPrdStock').textContent = `${prd.stock} ${prd.unit || 'dona'}`;
  document.getElementById('viewPrdBuyPrice').textContent = `${prd.buyPrice.toLocaleString('uz-UZ')} UZS`;
  document.getElementById('viewPrdSellPrice').textContent = `${prd.sellPrice.toLocaleString('uz-UZ')} UZS`;

  const margin = prd.sellPrice - prd.buyPrice;
  const marginPercent = prd.buyPrice > 0 ? ((margin / prd.buyPrice) * 100).toFixed(1) : 0;
  document.getElementById('viewPrdMargin').textContent = `+${margin.toLocaleString('uz-UZ')} UZS (${marginPercent}%)`;

  const statusEl = document.getElementById('viewPrdStatus');
  statusEl.textContent = prd.status;
  statusEl.className = `badge ${prd.statusClass}`;

  openModal('viewProductModal');
}

function openCreateWarehouseModal() {
  currentEditingId = null;
  document.getElementById('warehouseModalTitle').textContent = "Yangi ombor qo'shish";
  document.querySelector('#addWarehouseModal form').reset();
  openModal('addWarehouseModal');
}

function openEditWarehouseModal(id) {
  const wh = demoData.warehouses.find(w => w.id === id);
  if (!wh) return;

  currentEditingId = id;
  document.getElementById('warehouseModalTitle').textContent = "Omborni tahrirlash";
  document.getElementById('whName').value = wh.name;
  document.getElementById('whCode').value = wh.code;
  document.getElementById('whManager').value = wh.manager;
  document.getElementById('whPhone').value = wh.phone;
  document.getElementById('whAddress').value = wh.address;

  openModal('addWarehouseModal');
}

function openCreateCustomerModal() {
  currentEditingId = null;
  document.getElementById('customerModalTitle').textContent = "Yangi mijoz qo'shish";
  document.querySelector('#addCustomerModal form').reset();
  const balInput = document.getElementById('custBalance');
  if (balInput) balInput.value = '0';
  openModal('addCustomerModal');
}

function openEditCustomerModal(id) {
  const c = demoData.customers.find(item => item.id === id);
  if (!c) return;

  currentEditingId = id;
  document.getElementById('customerModalTitle').textContent = "Mijozni tahrirlash";
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = c.phone;
  document.getElementById('custAddress').value = c.address || '';
  if (document.getElementById('custPriceType')) {
    document.getElementById('custPriceType').value = c.priceType || 'retail';
  }
  if (document.getElementById('custCreditLimit')) {
    document.getElementById('custCreditLimit').value = c.creditLimit || 0;
  }
  if (document.getElementById('custBalance')) {
    let balVal = (c.balance !== undefined) ? Number(c.balance) : 0;
    if (balVal === 0 && Array.isArray(demoData.recentSales)) {
      const sDebt = demoData.recentSales
        .filter(s => s && s.customer === c.name)
        .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
      if (sDebt > 0) balVal = sDebt;
    }
    document.getElementById('custBalance').value = balVal;
  }
  if (document.getElementById('custIsBlocked')) {
    document.getElementById('custIsBlocked').checked = !!c.isBlocked;
  }

  openModal('addCustomerModal');
}

function openCreateSupplierModal() {
  currentEditingId = null;
  document.getElementById('supplierModalTitle').textContent = "Yangi yetkazib beruvchi";
  document.querySelector('#addSupplierModal form').reset();
  openModal('addSupplierModal');
}

function openEditSupplierModal(id) {
  const s = demoData.suppliers.find(item => item.id === id);
  if (!s) return;

  currentEditingId = id;
  document.getElementById('supplierModalTitle').textContent = "Yetkazib beruvchini tahrirlash";
  document.getElementById('supName').value = s.name;
  document.getElementById('supPhone').value = s.phone;
  document.getElementById('supCategory').value = s.productsSupplied || '';

  openModal('addSupplierModal');
}

function openEditPurchaseModal(id) {
  const pur = (demoData.purchases || []).find(p => p.id === id || p.docNo === id);
  if (!pur) return;
  currentEditingId = id;
  const modalTitle = document.querySelector('#addPurchaseModal h3');
  if (modalTitle) modalTitle.textContent = "Kirim hujjatini tahrirlash";
  if (document.getElementById('purSupplier')) document.getElementById('purSupplier').value = pur.supplier || '';
  if (document.getElementById('purWarehouse')) document.getElementById('purWarehouse').value = pur.warehouse || 'Asosiy Ombor';
  if (document.getElementById('purQty')) document.getElementById('purQty').value = parseInt(String(pur.qty || 1).replace(/[^0-9]/g, '')) || 1;
  const numAmount = parseInt(String(pur.amount || 0).replace(/[^0-9]/g, '')) || 0;
  const qty = parseInt(String(pur.qty || 1).replace(/[^0-9]/g, '')) || 1;
  if (document.getElementById('purBuyPrice')) document.getElementById('purBuyPrice').value = qty > 0 ? Math.round(numAmount / qty) : numAmount;
  openModal('addPurchaseModal');
}

function openEditOutgoingModal(id) {
  const out = (demoData.outgoing || []).find(o => o.id === id || o.docNo === id);
  if (!out) return;
  currentEditingId = id;
  const modalTitle = document.querySelector('#addOutgoingModal h3');
  if (modalTitle) modalTitle.textContent = "Chiqim hujjatini tahrirlash";
  if (document.getElementById('outQty')) document.getElementById('outQty').value = parseInt(String(out.qty || 1).replace(/[^0-9]/g, '')) || 1;
  if (document.getElementById('outReason')) document.getElementById('outReason').value = out.reason || "Omborlararo ko'chirish";
  openModal('addOutgoingModal');
}

window.openEditPurchaseModal = openEditPurchaseModal;
window.openEditOutgoingModal = openEditOutgoingModal;

function openViewSaleModal(id) {
  const sale = demoData.recentSales.find(s => s.id === id || s.receiptNo === id);
  if (!sale) return;

  const el = (elementId) => document.getElementById(elementId);
  if (el('viewSaleReceiptNo')) el('viewSaleReceiptNo').textContent = sale.receiptNo || sale.id;
  if (el('viewSaleDate')) el('viewSaleDate').textContent = sale.date || sale.createdAt || '';
  if (el('viewSaleWarehouse')) el('viewSaleWarehouse').textContent = sale.warehouse || 'Asosiy Ombor - Toshkent';
  if (el('viewSaleCustomer')) el('viewSaleCustomer').textContent = sale.customer || '';
  if (el('viewSaleItems')) el('viewSaleItems').textContent = sale.productName || sale.itemsCount || '';
  if (el('viewSaleQty')) el('viewSaleQty').textContent = sale.qty || '1 dona';
  if (el('viewSaleAgent')) el('viewSaleAgent').textContent = sale.agent || 'FAYZ';
  if (el('viewSalePaymentType')) el('viewSalePaymentType').textContent = sale.paymentType || 'Naqd pul';
  
  if (el('viewSaleDebt')) {
    const dStr = sale.debt || '+0 UZS';
    el('viewSaleDebt').textContent = dStr;
    if (dStr.startsWith('+') && dStr !== '+0 UZS' && dStr !== '+0' && dStr !== '0 UZS') {
      el('viewSaleDebt').className = 'font-bold text-rose-600';
    } else if (dStr.startsWith('-')) {
      el('viewSaleDebt').className = 'font-bold text-blue-600';
    } else {
      el('viewSaleDebt').className = 'font-bold text-emerald-600';
    }
  }
  
  if (el('viewSaleAmount')) el('viewSaleAmount').textContent = sale.amount || '0 UZS';

  const statusEl = el('viewSaleStatus');
  if (statusEl) {
    const statusInfo = (typeof getSaleEffectiveStatus === 'function')
      ? getSaleEffectiveStatus(sale)
      : { status: 'yangi', label: 'Yangi', badgeClass: 'bg-blue-600 text-white' };
    statusEl.textContent = statusInfo.label;
    statusEl.className = `px-3 py-1 rounded-md text-xs font-bold ${statusInfo.badgeClass}`;
  }

  openModal('viewSaleModal');
  if (window.lucide) lucide.createIcons();
}

function openViewCustomerModal(id) {
  const cust = demoData.customers.find(c => c.id === id || c.name === id);
  if (!cust) return;

  const el = (elementId) => document.getElementById(elementId);
  if (el('viewCustName')) el('viewCustName').textContent = cust.name || '';
  if (el('viewCustPhone')) el('viewCustPhone').textContent = cust.phone || '';
  if (el('viewCustAddress')) el('viewCustAddress').textContent = cust.address || "Toshkent sh.";
  if (el('viewCustPriceType')) {
    let pLabel = 'Chakana';
    if (cust.priceType === 'wholesale') pLabel = 'Optom';
    if (cust.priceType === 'vip') pLabel = 'VIP Diler';
    el('viewCustPriceType').textContent = pLabel;
  }
  let debt = (cust.balance !== undefined) ? Number(cust.balance) : (parseInt(String(cust.debt || '0').replace(/[^0-9-]/g, '')) || 0);
  if (debt === 0 && Array.isArray(demoData.recentSales)) {
    const sDebt = demoData.recentSales
      .filter(s => s && s.customer === cust.name)
      .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
    if (sDebt > 0) debt = sDebt;
  }
  const limit = cust.creditLimit || 50000000;
  if (el('viewCustCreditLimit')) el('viewCustCreditLimit').textContent = limit.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
  
  if (el('viewCustBalance')) {
    if (debt > 0) {
      el('viewCustBalance').textContent = '+' + debt.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
      el('viewCustBalance').className = 'font-bold text-rose-600';
    } else if (debt < 0) {
      el('viewCustBalance').textContent = '-' + Math.abs(debt).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
      el('viewCustBalance').className = 'font-bold text-blue-600';
    } else {
      el('viewCustBalance').textContent = '0 UZS';
      el('viewCustBalance').className = 'font-bold text-emerald-600';
    }
  }

  if (el('viewCustStatus')) {
    if (cust.isBlocked) {
      el('viewCustStatus').textContent = 'Bloklangan';
    } else if (debt > 0) {
      el('viewCustStatus').textContent = 'Qarzdorlik bor';
    } else if (debt < 0) {
      el('viewCustStatus').textContent = 'Ortiqcha to\'lov (Haqdor)';
    } else {
      el('viewCustStatus').textContent = 'Tozalangan';
    }
  }

  if (el('viewCustEditBtn')) {
    el('viewCustEditBtn').onclick = () => {
      closeModal('viewCustomerModal');
      openEditCustomerModal(cust.id);
    };
  }

  openModal('viewCustomerModal');
  if (window.lucide) lucide.createIcons();
}

window.openViewSaleModal = openViewSaleModal;
window.openViewCustomerModal = openViewCustomerModal;

function openCashTxModal(isIncome) {
  const modalTitle = document.getElementById('cashTxModalTitle');
  const typeInput = document.getElementById('cashTxType');
  const submitBtn = document.getElementById('cashTxSubmitBtn');

  if (isIncome) {
    modalTitle.textContent = "+ Kassa Kirimi";
    typeInput.value = "income";
    submitBtn.className = "px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center gap-2";
  } else {
    modalTitle.textContent = "+ Kassa Chiqimi";
    typeInput.value = "expense";
    submitBtn.className = "px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm flex items-center gap-2";
  }

  openModal('addCashTxModal');
}

/* BUSINESS LOGIC HANDLERS WITH DOUBLE-SUBMIT GUARDS & XSS SANITIZATION */

async function handleSaveProduct(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const name = escapeHTML(document.getElementById('prdName').value.trim());
    const sku = escapeHTML(document.getElementById('prdSku').value.trim()) || 'PRD-' + Math.floor(1000 + Math.random() * 9000);
    const categoryId = document.getElementById('prdCategory').value;
    const warehouseId = document.getElementById('prdWarehouse').value;
    const unit = escapeHTML(document.getElementById('prdUnit').value);
    
    const buyPriceInput = document.getElementById('prdBuyPrice').value;
    const buyPrice = buyPriceInput !== '' && !isNaN(Number(buyPriceInput)) ? Math.max(0, Number(buyPriceInput)) : 0;
    
    const sellPriceInput = document.getElementById('prdSellPrice').value;
    const sellPrice = sellPriceInput !== '' && !isNaN(Number(sellPriceInput)) ? Math.max(0, Number(sellPriceInput)) : 0;
    
    const wholesalePriceInput = document.getElementById('prdWholesalePrice')?.value;
    const wholesalePrice = wholesalePriceInput !== '' && wholesalePriceInput !== undefined && !isNaN(Number(wholesalePriceInput)) 
      ? Math.max(0, Number(wholesalePriceInput)) 
      : Math.round(sellPrice * 0.9);
      
    const vipPriceInput = document.getElementById('prdVipPrice')?.value;
    const vipPrice = vipPriceInput !== '' && vipPriceInput !== undefined && !isNaN(Number(vipPriceInput)) 
      ? Math.max(0, Number(vipPriceInput)) 
      : Math.round(sellPrice * 0.8);
      
    const stockInput = document.getElementById('prdStock').value;
    const stock = stockInput !== '' && !isNaN(Number(stockInput)) ? Math.max(0, Number(stockInput)) : 0;
    
    const minStockInput = document.getElementById('prdMinStock').value;
    const minStock = minStockInput !== '' && !isNaN(Number(minStockInput)) ? Math.max(0, Number(minStockInput)) : 5;

    if (!name) {
      showToast("Tovar nomi bo'sh bo'lmasin!", 'error');
      isSubmitting = false;
      return;
    }

    const catSelect = document.getElementById('prdCategory');
    const whSelect = document.getElementById('prdWarehouse');
    const categoryName = catSelect && catSelect.options[catSelect.selectedIndex] ? catSelect.options[catSelect.selectedIndex].text : 'Elektronika va Texnika';
    const warehouseName = whSelect && whSelect.options[whSelect.selectedIndex] ? whSelect.options[whSelect.selectedIndex].text : 'Asosiy Ombor - Toshkent';

    const prdData = { 
      name, 
      sku, 
      category: categoryName,
      categoryId, 
      category_id: categoryId,
      warehouse: warehouseName,
      warehouseId, 
      warehouse_id: warehouseId,
      unit, 
      buyPrice, 
      sellPrice, 
      priceRetail: sellPrice, 
      wholesalePrice, 
      vipPrice, 
      stock, 
      minStock 
    };
    let res;

    if (currentEditingId) {
      res = await productService.update(currentEditingId, prdData);
    } else {
      res = await productService.create(prdData);
    }

    if (!res.success) {
      const errorMsg = res.error ? res.error.message : "Saqlashda bazada xatolik yuz berdi!";
      showToast(errorMsg, 'error');
      return;
    }

    if (res.success && res.data) {
      const targetId = currentEditingId || res.data.id;
      const idx = demoData.products.findIndex(p => p.id === targetId);

      const updatedObj = {
        ...(idx !== -1 ? demoData.products[idx] : res.data),
        ...res.data,
        name: name,
        sku: sku,
        unit: unit,
        buyPrice: buyPrice,
        sellPrice: sellPrice,
        priceRetail: sellPrice,
        wholesalePrice: wholesalePrice,
        vipPrice: vipPrice,
        stock: stock,
        minStock: minStock,
        category: categoryName,
        categoryId: res.data.categoryId || categoryId,
        warehouse: warehouseName,
        warehouseId: res.data.warehouseId || warehouseId,
        status: stock <= 0 ? 'Tugagan' : (stock <= minStock ? 'Kam qolgan' : 'Mavjud'),
        statusClass: stock <= 0 ? 'badge-danger' : (stock <= minStock ? 'badge-warning' : 'badge-success')
      };

      if (idx !== -1) {
        demoData.products[idx] = updatedObj;
      } else {
        demoData.products.unshift(updatedObj);
      }
    }

    if (!navigator.onLine) {
      showToast(`"${name}" oflayn rejimda saqlandi! (Internet tiklanganda sinxronlanadi)`, 'warning');
    } else if (currentEditingId) {
      showToast(`"${name}" ma'lumotlari yangilandi!`, 'success');
    } else {
      showToast(`"${name}" omborga muvaffaqiyatli qo'shildi!`, 'success');
    }

    closeModal('addProductModal');
    currentEditingId = null;
    if (typeof currentPage !== 'undefined') currentPage = 1;
    if (typeof productSearchQuery !== 'undefined') productSearchQuery = '';
    if (typeof selectedCategory !== 'undefined') selectedCategory = 'all';
    if (typeof selectedWarehouse !== 'undefined') selectedWarehouse = 'all';
    if (typeof selectedStatus !== 'undefined') selectedStatus = 'all';
    if (typeof renderCurrentView === 'function') {
      await renderCurrentView();
    }
  } catch (err) {
    showToast("Saqlashda xatolik yuz berdi: " + (err.message || err), "error");
  } finally {
    isSubmitting = false;
  }
}

async function handleSavePurchase(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const supplierName = escapeHTML(document.getElementById('purSupplier').value);
    const warehouseName = escapeHTML(document.getElementById('purWarehouse').value);
    const prdId = document.getElementById('purProduct').value;
    const qty = Math.max(1, parseInt(document.getElementById('purQty').value) || 0);
    const buyPrice = Math.max(0, parseInt(document.getElementById('purBuyPrice').value) || 0);

    const targetProduct = demoData.products.find(p => p.id === prdId);
    if (!targetProduct) {
      showToast("Tanlangan tovar topilmadi!", 'error');
      isSubmitting = false;
      return;
    }

    targetProduct.stock += qty;
    targetProduct.buyPrice = buyPrice;
    if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
      inventoryService.updateStatus(targetProduct);
    }
    if (window.productService && targetProduct.id && typeof isUUID === 'function' && isUUID(targetProduct.id)) {
      window.productService.update(targetProduct.id, {
        stock: targetProduct.stock,
        buyPrice: targetProduct.buyPrice,
        warehouseId: targetProduct.warehouseId || targetProduct.warehouse
      }).catch(e => console.warn('[Purchase Stock Sync Warning]:', e));
    }

    const totalAmount = qty * buyPrice;
    const docNo = currentEditingId ? ((demoData.purchases || []).find(p => p.id === currentEditingId || p.docNo === currentEditingId)?.docNo || ('YK-2026-' + Math.floor(100 + Math.random() * 900))) : ('YK-2026-' + Math.floor(100 + Math.random() * 900));

    const purData = {
      id: currentEditingId || ('pur-' + Date.now()),
      date: new Date().toLocaleString('uz-UZ'),
      docNo,
      supplier: supplierName,
      items: targetProduct.name,
      qty: `${qty} ${targetProduct.unit || 'dona'}`,
      amount: totalAmount.toLocaleString('uz-UZ') + ' UZS',
      status: "Qabul qilindi",
      statusClass: "badge-success"
    };

    if (currentEditingId) {
      const idx = (demoData.purchases || []).findIndex(p => p.id === currentEditingId || p.docNo === currentEditingId);
      if (idx !== -1) {
        demoData.purchases[idx] = { ...demoData.purchases[idx], ...purData };
      }
    } else if (window.purchaseService) {
      await window.purchaseService.create(purData);
    } else {
      demoData.purchases.unshift(purData);
      if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    }

    const sup = demoData.suppliers.find(s => s.name === supplierName);
    if (sup) {
      const curVal = parseInt(sup.totalPurchases.replace(/[^0-9]/g, '')) || 0;
      sup.totalPurchases = (curVal + totalAmount).toLocaleString('uz-UZ') + ' UZS';
    }

    if (typeof syncGlobalState === 'function') syncGlobalState();
    closeModal('addPurchaseModal');
    showToast(`Kirim saqlandi! "${targetProduct.name}" yangi qoldig'i: ${targetProduct.stock} ${targetProduct.unit}`, 'success');
    currentEditingId = null;
    if (typeof renderCurrentView === 'function') renderCurrentView();
  } catch (err) {
    console.error(err);
    showToast("Kirim saqlashda xatolik yuz berdi!", "error");
  } finally {
    isSubmitting = false;
  }
}

async function handleSaveOutgoing(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const prdId = document.getElementById('outPrd').value;
    const qty = Math.max(1, parseInt(document.getElementById('outQty').value) || 0);
    const reason = escapeHTML(document.getElementById('outReason').value);
    const targetWhName = escapeHTML(document.getElementById('outTargetWarehouse').value);

    const sourceProduct = demoData.products.find(p => p.id === prdId);
    if (!sourceProduct) {
      showToast("Tovar topilmadi!", 'error');
      isSubmitting = false;
      return;
    }

    if (qty > sourceProduct.stock) {
      showToast(`Mahsulot qoldig'i yetarli emas. Mavjud: ${sourceProduct.stock} dona, So'ralgan: ${qty} dona`, 'error');
      isSubmitting = false;
      return;
    }

    const docNo = "CH-2026-" + Math.floor(100 + Math.random() * 900);

    if (reason === "Omborlararo ko'chirish") {
      if (sourceProduct.warehouse === targetWhName) {
        showToast("Bir xil omborga ko'chirish mumkin emas!", 'error');
        isSubmitting = false;
        return;
      }

      sourceProduct.stock -= qty;

      let targetProduct = demoData.products.find(p => p.name === sourceProduct.name && p.warehouse === targetWhName);
      if (targetProduct) {
        targetProduct.stock += qty;
        if (window.productService && targetProduct.id && typeof isUUID === 'function' && isUUID(targetProduct.id)) {
          window.productService.update(targetProduct.id, {
            stock: targetProduct.stock,
            warehouseId: targetProduct.warehouseId || targetWhName
          }).catch(e => console.warn('[Transfer Target Stock Sync Warning]:', e));
        }
      } else {
        demoData.products.push({
          id: 'prd-' + Date.now(),
          sku: sourceProduct.sku + '-TR',
          name: sourceProduct.name,
          category: sourceProduct.category,
          warehouse: targetWhName,
          unit: sourceProduct.unit,
          buyPrice: sourceProduct.buyPrice,
          sellPrice: sourceProduct.sellPrice,
          stock: qty,
          minStock: sourceProduct.minStock,
          status: 'Mavjud',
          statusClass: 'badge-success'
        });
      }
    } else {
      sourceProduct.stock -= qty;
    }

    if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
      inventoryService.updateStatus(sourceProduct);
    }
    if (window.productService && sourceProduct.id && typeof isUUID === 'function' && isUUID(sourceProduct.id)) {
      window.productService.update(sourceProduct.id, {
        stock: sourceProduct.stock,
        warehouseId: sourceProduct.warehouseId || sourceProduct.warehouse
      }).catch(e => console.warn('[Transfer/Out Stock Sync Warning]:', e));
    }

    const outPayload = {
      docNo,
      product: sourceProduct.name,
      qty: qty + " " + (sourceProduct.unit || 'dona'),
      warehouse: reason === "Omborlararo ko'chirish" ? `${sourceProduct.warehouse} -> ${targetWhName}` : sourceProduct.warehouse,
      reason: reason
    };

    if (window.outgoingService) {
      await window.outgoingService.create(outPayload);
    } else {
      if (!demoData.outgoing) demoData.outgoing = [];
      demoData.outgoing.unshift({
        id: 'out-' + Date.now(),
        date: new Date().toLocaleString('uz-UZ'),
        ...outPayload,
        status: reason === "Omborlararo ko'chirish" ? "Bajarildi" : "Hisobdan chiqarildi",
        statusClass: reason === "Omborlararo ko'chirish" ? "badge-success" : "badge-danger"
      });
      if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
      if (typeof syncGlobalState === 'function') syncGlobalState();
    }
    
    closeModal('addOutgoingModal');
    showToast(`Chiqim muvaffaqiyatli amalga oshirildi!`, 'success');
    if (typeof renderCurrentView === 'function') await renderCurrentView();
  } catch (err) {
    console.error(err);
    showToast("Chiqim saqlashda xatolik yuz berdi!", "error");
  } finally {
    isSubmitting = false;
  }
}

/* ==================== MULTI-PRODUCT SALE MODAL HANDLERS ==================== */

function getSaleProductRowHtml(index, selectedPrdId = '', qty = 1, selectedPriceType = '') {
  const prds = demoData.products || [];
  
  // If price type not provided, check selected customer's price type
  let currentPriceType = selectedPriceType;
  if (!currentPriceType) {
    const custName = document.getElementById('saleCustomer')?.value;
    const cust = (demoData.customers || []).find(c => c.name === custName);
    currentPriceType = cust?.priceType || 'retail';
  }

  return `
    <div class="sale-product-row bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5" data-row-idx="${index}">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center sale-row-num">${index}</span>
          <span class="font-bold text-slate-700 text-xs">Mahsulot</span>
        </div>
        <button type="button" onclick="removeSaleProductRow(this)" class="sale-remove-row-btn text-slate-400 hover:text-rose-600 transition p-1 ${index === 1 ? 'hidden' : ''}" title="O'chirish">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1">
          <select onchange="updateSaleRowCalculations(this)" class="sale-item-product w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tovarni tanlang...</option>
            ${prds.map(p => {
              const retail = Number(p.priceRetail || p.sellPrice || 0);
              const wholesale = Number(p.wholesalePrice || Math.round(retail * 0.9));
              const vip = Number(p.vipPrice || Math.round(retail * 0.8));
              return `
                <option value="${p.id}" 
                  data-price-retail="${retail}" 
                  data-price-wholesale="${wholesale}" 
                  data-price-vip="${vip}" 
                  data-price="${retail}" 
                  data-stock="${p.stock}" 
                  data-unit="${escapeHTML(p.unit || 'dona')}" 
                  data-warehouse="${escapeHTML(p.warehouse || '')}" 
                  data-name="${escapeHTML(p.name)}" 
                  ${selectedPrdId === p.id ? 'selected' : ''}>
                  ${escapeHTML(p.name)} - Qoldiq: ${p.stock} ${escapeHTML(p.unit || 'dona')} (Optom: ${wholesale.toLocaleString('uz-UZ')} / Chakana: ${retail.toLocaleString('uz-UZ')})
                </option>
              `;
            }).join('')}
          </select>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
          <!-- Narx toifasi (Optom / Chakana / VIP) -->
          <div class="flex items-center gap-1.5 bg-slate-100 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <span class="text-slate-500 font-bold uppercase text-[10px]">TOIFA:</span>
            <select onchange="updateSaleRowCalculations(this)" class="sale-item-price-type bg-transparent text-xs font-bold text-blue-700 focus:outline-none cursor-pointer">
              <option value="wholesale" ${currentPriceType === 'wholesale' ? 'selected' : ''}>Optom</option>
              <option value="retail" ${currentPriceType === 'retail' ? 'selected' : ''}>Chakana</option>
              <option value="vip" ${currentPriceType === 'vip' ? 'selected' : ''}>VIP</option>
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 font-bold uppercase text-[11px]">NARX:</span>
            <span class="sale-item-price-display font-bold text-slate-900 font-mono">0</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 font-bold uppercase text-[11px]">MIQDOR:</span>
            <input type="number" min="1" value="${qty}" oninput="updateSaleRowCalculations(this)" class="sale-item-qty w-16 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center">
            <span class="sale-item-unit text-slate-500 font-medium">dona</span>
          </div>
        </div>
      </div>

      <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Satr summasi:</span>
        <span class="sale-item-row-total font-bold text-slate-900">0 UZS</span>
      </div>
    </div>
  `;
}

function initAddSaleModal() {
  const custSelect = document.getElementById('saleCustomer');
  let defaultPriceType = 'retail';
  if (custSelect) {
    const custs = demoData.customers || [];
    custSelect.innerHTML = custs.map(c => {
      let pLabel = c.priceType === 'wholesale' ? 'Optom' : (c.priceType === 'vip' ? 'VIP' : 'Chakana');
      return `<option value="${escapeHTML(c.name)}" data-price-type="${c.priceType || 'retail'}">${escapeHTML(c.name)} (${pLabel})</option>`;
    }).join('');
    if (custs.length > 0) {
      defaultPriceType = custs[0].priceType || 'retail';
      onSaleCustomerChange(custs[0].name);
    }
  }

  const container = document.getElementById('saleProductRowsContainer');
  if (container) {
    container.innerHTML = getSaleProductRowHtml(1, '', 1, defaultPriceType);
    if (window.lucide) lucide.createIcons();
    const firstPrd = container.querySelector('.sale-item-product');
    if (firstPrd) updateSaleRowCalculations(firstPrd);
  }

  const paidInput = document.getElementById('salePaidAmount');
  if (paidInput) paidInput.value = '';

  const payTypeSelect = document.getElementById('salePaymentType');
  if (payTypeSelect) payTypeSelect.value = 'Naqd';

  calculateSaleDebtSummary();
}

function addSaleProductRow() {
  const container = document.getElementById('saleProductRowsContainer');
  if (!container) return;
  const currentRows = container.querySelectorAll('.sale-product-row');
  const nextIdx = currentRows.length + 1;

  const custName = document.getElementById('saleCustomer')?.value;
  const cust = (demoData.customers || []).find(c => c.name === custName);
  const custPriceType = cust?.priceType || 'retail';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = getSaleProductRowHtml(nextIdx, '', 1, custPriceType);
  const newRow = tempDiv.firstElementChild;
  container.appendChild(newRow);

  const allRows = container.querySelectorAll('.sale-product-row');
  allRows.forEach(r => {
    const rmBtn = r.querySelector('.sale-remove-row-btn');
    if (rmBtn) rmBtn.classList.remove('hidden');
  });

  if (window.lucide) lucide.createIcons();
  calculateSaleDebtSummary();
}

function removeSaleProductRow(btn) {
  const row = btn.closest('.sale-product-row');
  if (!row) return;
  const container = document.getElementById('saleProductRowsContainer');
  row.remove();

  if (container) {
    const allRows = container.querySelectorAll('.sale-product-row');
    allRows.forEach((r, idx) => {
      const numSpan = r.querySelector('.sale-row-num');
      if (numSpan) numSpan.textContent = idx + 1;
      const rmBtn = r.querySelector('.sale-remove-row-btn');
      if (rmBtn) {
        if (allRows.length === 1) rmBtn.classList.add('hidden');
        else rmBtn.classList.remove('hidden');
      }
    });
  }

  calculateSaleDebtSummary();
}

function onSaleCustomerChange(custName) {
  const cust = (demoData.customers || []).find(c => c.name === custName);
  const debt = cust ? (cust.balance !== undefined ? cust.balance : (parseInt(String(cust.debt || '0').replace(/[^0-9-]/g, '')) || 0)) : 0;
  const limit = cust ? (cust.creditLimit || 50000000) : 50000000;
  const remaining = Math.max(0, limit - (debt > 0 ? debt : 0));
  const custPriceType = cust?.priceType || 'retail';

  const elDebt = document.getElementById('saleCustDebtVal');
  if (elDebt) {
    if (debt > 0) {
      elDebt.textContent = '+' + debt.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS (Mijoz qarzdor)';
      elDebt.className = 'font-bold text-rose-600';
    } else if (debt < 0) {
      elDebt.textContent = '-' + Math.abs(debt).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS (Haqdor / Ortiqcha)';
      elDebt.className = 'font-bold text-blue-600';
    } else {
      elDebt.textContent = '0 UZS';
      elDebt.className = 'font-bold text-slate-900';
    }
  }

  const elLimit = document.getElementById('saleCustLimitVal');
  if (elLimit) elLimit.textContent = limit.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';

  const elRem = document.getElementById('saleCustRemainingLimitVal');
  if (elRem) elRem.textContent = remaining.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';

  // Automatically update all existing product rows to this customer's price type
  const container = document.getElementById('saleProductRowsContainer');
  if (container) {
    const rows = container.querySelectorAll('.sale-product-row');
    rows.forEach(r => {
      const ptSelect = r.querySelector('.sale-item-price-type');
      if (ptSelect) {
        ptSelect.value = custPriceType;
      }
      const prdSelect = r.querySelector('.sale-item-product');
      if (prdSelect) {
        updateSaleRowCalculations(prdSelect);
      }
    });
  }

  calculateSaleDebtSummary();
}

function updateSaleRowCalculations(element) {
  const row = element.closest('.sale-product-row');
  if (!row) return;

  const prdSelect = row.querySelector('.sale-item-product');
  const priceTypeSelect = row.querySelector('.sale-item-price-type');
  const qtyInput = row.querySelector('.sale-item-qty');
  const priceDisplay = row.querySelector('.sale-item-price-display');
  const unitDisplay = row.querySelector('.sale-item-unit');
  const rowTotalDisplay = row.querySelector('.sale-item-row-total');

  let price = 0;
  let unit = 'dona';
  const priceType = priceTypeSelect?.value || 'retail';

  if (prdSelect && prdSelect.selectedIndex >= 0) {
    const selectedOpt = prdSelect.options[prdSelect.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
      unit = selectedOpt.dataset.unit || 'dona';
      const retail = parseFloat(selectedOpt.dataset.priceRetail) || parseFloat(selectedOpt.dataset.price) || 0;
      const wholesale = parseFloat(selectedOpt.dataset.priceWholesale) || Math.round(retail * 0.9);
      const vip = parseFloat(selectedOpt.dataset.priceVip) || Math.round(retail * 0.8);

      if (priceType === 'wholesale') {
        price = wholesale;
      } else if (priceType === 'vip') {
        price = vip;
      } else {
        price = retail;
      }
    }
  }

  const qty = Math.max(1, parseInt(qtyInput?.value) || 1);
  const rowTotal = price * qty;

  if (priceDisplay) priceDisplay.textContent = price.toLocaleString('uz-UZ').replace(/,/g, ' ');
  if (unitDisplay) unitDisplay.textContent = unit;
  if (rowTotalDisplay) rowTotalDisplay.textContent = rowTotal.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';

  calculateSaleDebtSummary();
}

function calculateSaleDebtSummary() {
  const container = document.getElementById('saleProductRowsContainer');
  let totalAmount = 0;
  let totalQty = 0;
  let rowCount = 0;

  if (container) {
    const rows = container.querySelectorAll('.sale-product-row');
    rowCount = rows.length;
    rows.forEach(r => {
      const prdSelect = r.querySelector('.sale-item-product');
      const priceTypeSelect = r.querySelector('.sale-item-price-type');
      const qtyInput = r.querySelector('.sale-item-qty');
      let price = 0;
      const priceType = priceTypeSelect?.value || 'retail';

      if (prdSelect && prdSelect.selectedIndex >= 0) {
        const selectedOpt = prdSelect.options[prdSelect.selectedIndex];
        if (selectedOpt && selectedOpt.value) {
          const retail = parseFloat(selectedOpt.dataset.priceRetail) || parseFloat(selectedOpt.dataset.price) || 0;
          const wholesale = parseFloat(selectedOpt.dataset.priceWholesale) || Math.round(retail * 0.9);
          const vip = parseFloat(selectedOpt.dataset.priceVip) || Math.round(retail * 0.8);

          if (priceType === 'wholesale') price = wholesale;
          else if (priceType === 'vip') price = vip;
          else price = retail;
        }
      }
      const qty = Math.max(1, parseInt(qtyInput?.value) || 1);
      const rowTot = price * qty;
      totalAmount += rowTot;
      totalQty += (price > 0 ? qty : 0);
    });
  }

  const badgeEl = document.getElementById('saleItemsCountBadge');
  if (badgeEl) badgeEl.textContent = `${rowCount} xil tovar`;

  const qtyDisplay = document.getElementById('saleTotalQtyDisplay');
  if (qtyDisplay) qtyDisplay.textContent = `${totalQty} dona`;

  const totalDisplay = document.getElementById('saleTotalAmountDisplay');
  if (totalDisplay) totalDisplay.textContent = `${totalAmount.toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS`;

  const payType = document.getElementById('salePaymentType')?.value || 'Naqd';
  const paidInput = document.getElementById('salePaidAmount');
  const paidVal = paidInput?.value;

  let paidAmount = totalAmount;
  if (payType === 'Nasiya') {
    paidAmount = (paidVal !== '' && paidVal !== undefined && paidVal !== null) ? Math.max(0, parseInt(paidVal) || 0) : 0;
  } else if (paidVal !== '' && paidVal !== undefined && paidVal !== null) {
    paidAmount = Math.max(0, parseInt(paidVal) || 0);
  }

  const deltaDebt = totalAmount - paidAmount; // > 0: customer owes us for this sale, < 0: customer overpaid

  const custName = document.getElementById('saleCustomer')?.value;
  const cust = (demoData.customers || []).find(c => c.name === custName);
  const currentBal = cust ? ((cust.balance !== undefined) ? cust.balance : (parseInt(String(cust.debt || '0').replace(/[^0-9-]/g, '')) || 0)) : 0;
  const projectedTotalBal = currentBal + deltaDebt;

  const debtDisplay = document.getElementById('saleProjectedDebtDisplay');
  if (debtDisplay) {
    let text = '';
    let cls = 'font-bold text-emerald-600';

    if (deltaDebt > 0) {
      text = `+${deltaDebt.toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS (Bitim qarzi)`;
      cls = 'font-bold text-rose-600';
    } else if (deltaDebt < 0) {
      text = `-${Math.abs(deltaDebt).toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS (Ortiqcha to'lov)`;
      cls = 'font-bold text-blue-600';
    } else {
      text = `0 UZS (To'liq to'langan)`;
      cls = 'font-bold text-emerald-600';
    }

    if (currentBal !== 0) {
      text += ` → Jami qarzi: ${projectedTotalBal > 0 ? '+' + projectedTotalBal.toLocaleString('uz-UZ').replace(/,/g, ' ') : (projectedTotalBal < 0 ? '-' + Math.abs(projectedTotalBal).toLocaleString('uz-UZ').replace(/,/g, ' ') : '0')} UZS`;
    }

    debtDisplay.textContent = text;
    debtDisplay.className = cls;
  }
}

async function handleSaveSale(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const customerName = escapeHTML(document.getElementById('saleCustomer')?.value || '');
    const paymentType = escapeHTML(document.getElementById('salePaymentType')?.value || 'Naqd');
    const paidInputVal = document.getElementById('salePaidAmount')?.value;

    const container = document.getElementById('saleProductRowsContainer');
    const rows = container ? Array.from(container.querySelectorAll('.sale-product-row')) : [];

    if (rows.length === 0) {
      showToast("Kamida 1 ta mahsulot tanlang!", 'error');
      isSubmitting = false;
      return;
    }

    const items = [];
    for (const r of rows) {
      const prdSelect = r.querySelector('.sale-item-product');
      const prdId = prdSelect?.value;
      if (!prdId) {
        showToast("Barcha satrlarda tovar tanlangan bo'lishi kerak!", 'error');
        isSubmitting = false;
        return;
      }
      const selectedOpt = prdSelect.options[prdSelect.selectedIndex];
      const targetPrd = (demoData.products || []).find(p => p.id === prdId);
      if (!targetPrd) {
        showToast("Tovar topilmadi!", 'error');
        isSubmitting = false;
        return;
      }

      const priceTypeSelect = r.querySelector('.sale-item-price-type');
      const chosenPriceType = priceTypeSelect?.value || 'retail';
      const retail = parseFloat(selectedOpt?.dataset.priceRetail) || parseFloat(selectedOpt?.dataset.price) || targetPrd.sellPrice || 0;
      const wholesale = parseFloat(selectedOpt?.dataset.priceWholesale) || targetPrd.wholesalePrice || Math.round(retail * 0.9);
      const vip = parseFloat(selectedOpt?.dataset.priceVip) || targetPrd.vipPrice || Math.round(retail * 0.8);

      let price = retail;
      if (chosenPriceType === 'wholesale') price = wholesale;
      else if (chosenPriceType === 'vip') price = vip;

      const qty = Math.max(1, parseInt(r.querySelector('.sale-item-qty')?.value) || 1);
      const unit = selectedOpt?.dataset.unit || targetPrd.unit || 'dona';

      if (qty > targetPrd.stock) {
        showToast(`"${targetPrd.name}" qoldig'i yetarli emas. Mavjud: ${targetPrd.stock} dona, So'ralgan: ${qty} dona`, 'error');
        isSubmitting = false;
        return;
      }

      items.push({
        productId: targetPrd.id,
        productName: targetPrd.name,
        priceType: chosenPriceType,
        price,
        qty,
        unit,
        total: price * qty,
        warehouse: targetPrd.warehouse || 'Asosiy Ombor - Toshkent',
        targetPrd
      });
    }

    // Deduct stock for all items
    for (const item of items) {
      item.targetPrd.stock = Math.max(0, item.targetPrd.stock - item.qty);
      const minStk = item.targetPrd.minStock || 5;
      item.targetPrd.status = item.targetPrd.stock <= 0 ? 'Tugagan' : (item.targetPrd.stock <= minStk ? 'Kam qolgan' : 'Mavjud');
      item.targetPrd.statusClass = item.targetPrd.stock <= 0 ? 'badge-danger' : (item.targetPrd.stock <= minStk ? 'badge-warning' : 'badge-success');

      if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
        inventoryService.updateStatus(item.targetPrd);
      }

      if (window.productService && item.targetPrd.id && typeof isUUID === 'function' && isUUID(item.targetPrd.id)) {
        window.productService.update(item.targetPrd.id, {
          stock: item.targetPrd.stock,
          warehouseId: item.targetPrd.warehouseId || item.targetPrd.warehouse
        }).catch(e => console.warn('[Sale Stock Sync Warning]:', e));
      }
    }

    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    if (typeof syncGlobalState === 'function') syncGlobalState();

    const totalAmount = items.reduce((s, i) => s + i.total, 0);
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    let paidAmount = totalAmount;
    if (paymentType === 'Nasiya') {
      paidAmount = (paidInputVal !== '' && paidInputVal !== undefined && paidInputVal !== null) ? Math.max(0, parseInt(paidInputVal) || 0) : 0;
    } else if (paidInputVal !== '' && paidInputVal !== undefined && paidInputVal !== null) {
      paidAmount = Math.max(0, parseInt(paidInputVal) || 0);
    }

    // Difference: positive = customer owes debt, negative = customer overpaid (we owe customer)
    const diff = totalAmount - paidAmount;

    let debtFormatted = '+0 UZS';
    if (diff > 0) {
      debtFormatted = '+' + diff.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
    } else if (diff < 0) {
      debtFormatted = '-' + Math.abs(diff).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
    }

    const receiptNo = "CHK-" + Math.floor(9000 + Math.random() * 900);

    // Multi-item formatting
    let formattedProductName = items[0].productName;
    if (items.length > 1) {
      formattedProductName = items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(', ');
    } else {
      formattedProductName = `${items[0].productName} (${items[0].qty} ${items[0].unit})`;
    }

    // Update customer balance & debt
    const cust = (demoData.customers || []).find(c => c.name === customerName);
    let customerFinalDebtStr = debtFormatted;
    if (cust) {
      cust.purchasesCount = (cust.purchasesCount || 0) + 1;
      const curTotPurchases = parseInt(String(cust.totalPurchases || 0).replace(/[^0-9]/g, '')) || 0;
      cust.totalPurchases = (curTotPurchases + totalAmount).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';

      const currentBalance = (cust.balance !== undefined) ? cust.balance : (parseInt(String(cust.debt || '0').replace(/[^0-9-]/g, '')) || 0);
      cust.balance = currentBalance + diff;

      if (cust.balance > 0) {
        cust.debt = '+' + cust.balance.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
        cust.status = 'Qarzdor';
        cust.statusClass = 'badge-warning';
      } else if (cust.balance < 0) {
        cust.debt = '-' + Math.abs(cust.balance).toLocaleString('uz-UZ').replace(/,/g, ' ') + ' UZS';
        cust.status = 'Haqdor';
        cust.statusClass = 'badge-info';
      } else {
        cust.debt = '0 UZS';
        cust.status = 'Tozalangan';
        cust.statusClass = 'badge-success';
      }
      customerFinalDebtStr = cust.debt;

      if (window.customerService) {
        try {
          await window.customerService.update(cust.id || cust.name, {
            balance: cust.balance,
            purchasesCount: cust.purchasesCount,
            totalPurchases: curTotPurchases + totalAmount
          });
        } catch(cErr) {
          console.warn("[Customer Balance Sync Warning]:", cErr);
        }
      }
    }

    const newSale = {
      id: "INV-2026-" + Math.floor(9000 + Math.random() * 900),
      date: new Date().toLocaleDateString('uz-UZ') + ' ' + new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      receiptNo,
      warehouse: items[0]?.warehouse || "Asosiy Ombor - Toshkent",
      customer: customerName,
      productName: formattedProductName,
      itemsCount: items.length === 1 ? items[0].productName : `${items[0].productName} (+${items.length - 1} xil)`,
      qty: `${totalQty} dona`,
      amount: totalAmount.toLocaleString('uz-UZ').replace(/,/g, ' ') + " UZS",
      rawAmount: totalAmount,
      paymentType,
      paidAmount,
      totalAmount,
      agent: "FAYZ",
      rejected: false,
      status: "Yangi",
      statusClass: "badge-success",
      debt: customerFinalDebtStr,
      items: items.map(i => ({ name: i.productName, productName: i.productName, qty: i.qty, price: i.price, priceType: i.priceType, total: i.total }))
    };

    if (window.salesService) {
      await window.salesService.create(newSale);
    } else {
      demoData.recentSales.unshift(newSale);
    }

    // Automatically create a delivery (Yetkazib berish) order!
    const availableDrivers = typeof getSystemDriversList === 'function' ? getSystemDriversList() : [];
    const firstDriver = availableDrivers.find(d => d !== 'Biriktirilmagan' && d !== 'Tayinlanmagan') || 'Biriktirilmagan';
    const currentUser = window.authService ? window.authService.getCurrentUser() : null;
    const cleanAgentName = currentUser ? (currentUser.fullName || currentUser.full_name || 'FAYZ') : 'FAYZ';

    const newDeliveryOrder = {
      id: "ord-" + Date.now(),
      orderNumber: "ORD-2026-" + Math.floor(1000 + Math.random() * 9000),
      saleReceiptNo: receiptNo,
      customerName: customerName,
      agentName: (cleanAgentName || 'FAYZ').replace(/\s*\([^)]*\)/g, '').trim(),
      driverName: firstDriver,
      warehouseName: items[0]?.warehouse || "Asosiy Ombor - Toshkent",
      status: "yangi",
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      distQty: totalQty,
      productName: formattedProductName,
      deliveryDate: new Date().toISOString().split('T')[0],
      notes: `Sotuv cheki: ${receiptNo}. To'lov turi: ${paymentType}`,
      items: items.map(i => ({ productName: i.productName, name: i.productName, qty: i.qty, quantity: i.qty, price: i.price, priceType: i.priceType, total: i.total })),
      createdAt: newSale.date
    };

    if (window.distributionService && typeof window.distributionService.create === 'function') {
      await window.distributionService.create(newDeliveryOrder);
    } else {
      if (!demoData.distributionOrders) demoData.distributionOrders = [];
      demoData.distributionOrders.unshift(newDeliveryOrder);
    }

    // Record cash transaction if paidAmount > 0
    if (paidAmount > 0) {
      const cashTxPayload = {
        id: 'tx-' + Date.now(),
        date: newSale.date,
        operation: `Sotuv tushumi (${receiptNo})`,
        category: "Sotuvlar",
        amount: "+" + paidAmount.toLocaleString('uz-UZ').replace(/,/g, ' ') + " UZS",
        isIncome: true,
        comment: `${customerName} (${paymentType})${diff > 0 ? ` [Qarz: +${diff.toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS]` : (diff < 0 ? ` [Ortiqcha: -${Math.abs(diff).toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS]` : '')}`
      };

      if (window.cashService) {
        await window.cashService.createTransaction(cashTxPayload);
      } else if (demoData.cash && demoData.cash.transactions) {
        demoData.cash.transactions.unshift(cashTxPayload);
      }
    }

    syncGlobalState();
    saveStateToLocalStorage();
    closeModal('addSaleModal');

    let toastDebtInfo = '';
    if (diff > 0) toastDebtInfo = ` Mijoz qarzi: +${diff.toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS.`;
    else if (diff < 0) toastDebtInfo = ` Ortiqcha to'lov: -${Math.abs(diff).toLocaleString('uz-UZ').replace(/,/g, ' ')} UZS.`;

    showToast(`Sotuv bajarildi va yetkazib berishga biriktirildi! Chek № ${receiptNo}.${toastDebtInfo}`, 'success');
    if (typeof renderCurrentView === 'function') await renderCurrentView();
  } catch (err) {
    console.error("Sale Save Error:", err);
    showToast("Sotuvni saqlashda xatolik yuz berdi!", "error");
  } finally {
    isSubmitting = false;
  }
}

window.initAddSaleModal = initAddSaleModal;
window.addSaleProductRow = addSaleProductRow;
window.removeSaleProductRow = removeSaleProductRow;
window.onSaleCustomerChange = onSaleCustomerChange;
window.updateSaleRowCalculations = updateSaleRowCalculations;
window.calculateSaleDebtSummary = calculateSaleDebtSummary;
window.handleSaveSale = handleSaveSale;

async function handleSaveWarehouse(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const name = escapeHTML(document.getElementById('whName').value.trim());
    const code = escapeHTML(document.getElementById('whCode').value.trim()) || 'OMB-00' + ((demoData.warehouses || []).length + 1);
    const manager = escapeHTML(document.getElementById('whManager').value.trim()) || 'Omborchi';
    const phone = escapeHTML(document.getElementById('whPhone').value.trim()) || '+998 90 000-00-00';
    const address = escapeHTML(document.getElementById('whAddress').value.trim()) || 'Toshkent shahri';

    if (!name) {
      showToast("Ombor nomi kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    if (currentEditingId && window.warehouseService) {
      await window.warehouseService.update(currentEditingId, { name, code, manager, phone, address });
      showToast(`Ombor "${name}" yangilandi!`, 'success');
    } else if (window.warehouseService) {
      await window.warehouseService.create({ name, code, manager, phone, address });
      showToast(`Yangi ombor "${name}" qo'shildi!`, 'success');
    } else {
      demoData.warehouses.push({
        id: 'wh-' + Date.now(),
        name, code, address, manager, phone,
        productCount: 0, totalValue: 0, capacityPercent: 10,
        status: 'Faol', statusClass: 'badge-success'
      });
      showToast(`Yangi ombor "${name}" qo'shildi!`, 'success');
    }

    syncGlobalState();
    closeModal('addWarehouseModal');
    currentEditingId = null;
    if (typeof renderCurrentView === 'function') await renderCurrentView();
  } catch (err) {
    showToast("Ombor saqlashda xatolik!", "error");
  } finally {
    isSubmitting = false;
  }
}

async function handleSaveCustomer(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const name = escapeHTML(document.getElementById('custName').value.trim());
    const phone = escapeHTML(document.getElementById('custPhone').value.trim());
    const address = escapeHTML(document.getElementById('custAddress').value.trim()) || 'Toshkent shahri';
    const priceType = document.getElementById('custPriceType')?.value || 'retail';
    const creditLimit = Math.max(0, parseInt(document.getElementById('custCreditLimit')?.value) || 0);
    const balance = parseFloat(document.getElementById('custBalance')?.value) || 0;
    const isBlocked = !!document.getElementById('custIsBlocked')?.checked;

    if (!name) {
      showToast("Mijoz nomi kiriting!", 'error');
      isSubmitting = false;
      return;
    }
    if (!isValidPhone(phone)) {
      showToast("Telefon raqami noto'g'ri formatda!", 'error');
      isSubmitting = false;
      return;
    }

    if (currentEditingId && window.customerService) {
      await window.customerService.update(currentEditingId, { name, phone, address, priceType, creditLimit, balance, isBlocked });
      showToast(`Mijoz "${name}" tahrirlandi!`, 'success');
    } else if (window.customerService) {
      await window.customerService.create({ name, phone, address, priceType, creditLimit, balance, isBlocked });
      showToast(`Mijoz "${name}" qo'shildi!`, 'success');
    } else {
      demoData.customers.unshift({
        id: 'c-' + Date.now(),
        name, phone, address, priceType, creditLimit, balance, isBlocked, purchasesCount: 0,
        totalPurchases: '0 UZS', debt: balance > 0 ? ('+' + balance.toLocaleString('uz-UZ') + ' UZS') : (balance < 0 ? ('-' + Math.abs(balance).toLocaleString('uz-UZ') + ' UZS') : '0 UZS'),
        status: isBlocked ? 'Bloklangan' : (balance > 0 ? 'Qarzdor' : 'Faol'), 
        statusClass: isBlocked ? 'badge-danger' : (balance > 0 ? 'badge-warning' : 'badge-success')
      });
      showToast(`Mijoz "${name}" qo'shildi!`, 'success');
    }

    syncGlobalState();
    closeModal('addCustomerModal');
    currentEditingId = null;
    if (typeof renderCurrentView === 'function') await renderCurrentView();
  } catch (err) {
    showToast("Mijoz saqlashda xatolik!", "error");
  } finally {
    isSubmitting = false;
  }
}

async function handleSaveSupplier(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const name = escapeHTML(document.getElementById('supName').value.trim());
    const phone = escapeHTML(document.getElementById('supPhone').value.trim());
    const category = escapeHTML(document.getElementById('supCategory').value.trim()) || "Qurilish mollari";

    if (!name) {
      showToast("Yetkazib beruvchi nomi kiriting!", 'error');
      isSubmitting = false;
      return;
    }
    if (!isValidPhone(phone)) {
      showToast("Telefon raqam noto'g'ri!", 'error');
      isSubmitting = false;
      return;
    }

    if (currentEditingId && window.supplierService) {
      await window.supplierService.update(currentEditingId, { name, phone, productsSupplied: category });
      showToast(`Hamkor "${name}" tahrirlandi!`, 'success');
    } else if (window.supplierService) {
      await window.supplierService.create({ name, phone, productsSupplied: category });
      showToast(`Yetkazib beruvchi "${name}" saqlandi!`, 'success');
    } else {
      demoData.suppliers.unshift({
        id: 's-' + Date.now(),
        name, phone, productsSupplied: category,
        totalPurchases: '0 UZS', debt: '0 UZS',
        status: 'Faol', statusClass: 'badge-success'
      });
      showToast(`Yetkazib beruvchi "${name}" saqlandi!`, 'success');
    }

    syncGlobalState();
    closeModal('addSupplierModal');
    currentEditingId = null;
    if (typeof renderCurrentView === 'function') await renderCurrentView();
  } catch (err) {
    showToast("Hamkor saqlashda xatolik!", "error");
  } finally {
    isSubmitting = false;
  }
}

async function handleSaveCashTx(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const type = document.getElementById('cashTxType').value;
    const op = escapeHTML(document.getElementById('cashTxOp').value.trim());
    const cat = escapeHTML(document.getElementById('cashTxCat').value);
    const amount = Math.max(1, parseInt(document.getElementById('cashTxAmount').value) || 0);
    const comment = escapeHTML(document.getElementById('cashTxComment').value.trim()) || "Kassa operatsiyasi";

    if (!op || amount <= 0) {
      showToast("Operatsiya va summa to'g'ri kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    const isIncome = (type === 'income');
    const txPayload = {
      id: 'tx-' + Date.now(),
      date: new Date().toLocaleDateString('uz-UZ') + ' ' + new Date().toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'}),
      operation: op, category: cat,
      amount: (isIncome ? '+' : '-') + amount.toLocaleString('uz-UZ') + ' UZS',
      isIncome, comment
    };

    if (window.cashService) {
      await cashService.createTransaction(txPayload);
    } else {
      demoData.cash.transactions.unshift(txPayload);
    }

    syncGlobalState();
    closeModal('addCashTxModal');
    showToast(`Kassa ${isIncome ? 'kirimi' : 'chiqimi'} saqlandi!`, isIncome ? 'success' : 'error');
    if (typeof renderCurrentView === 'function') renderCurrentView();
  } catch (err) {
    showToast("Kassa operatsiyasida xatolik!", "error");
  } finally {
    isSubmitting = false;
  }
}

/* DISTRIBUTIONS & RETURNS MODAL HANDLERS */
function getDistProductOptionsHtml(selectedVal = '') {
  const products = (window.demoData && window.demoData.products) ? window.demoData.products.filter(p => p !== null && typeof p === 'object') : [];
  if (products.length === 0) {
    return '<option value="">Mahsulotlar topilmadi</option>';
  }
  return '<option value="">Tovarni tanlang...</option>' + products.map(p => {
    const isSel = (selectedVal && (p.id === selectedVal || p.name === selectedVal || p.sku === selectedVal)) ? 'selected' : '';
    return `<option value="${p.id}" data-price="${p.sellPrice || 0}" data-unit="${escapeHTML(p.unit || 'dona')}" data-stock="${p.stock || 0}" ${isSel}>${escapeHTML(p.name)} (${Number(p.sellPrice || 0).toLocaleString('uz-UZ')} UZS) - Qoldiq: ${p.stock || 0} ${escapeHTML(p.unit || 'dona')}</option>`;
  }).join('');
}

function addDistItemRow(defaultProductId = '', defaultQty = 1) {
  const container = document.getElementById('distItemsContainer');
  if (!container) return;

  const rowDiv = document.createElement('div');
  rowDiv.className = 'dist-item-row bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2';
  
  const optionsHtml = getDistProductOptionsHtml(defaultProductId);

  rowDiv.innerHTML = `
    <div class="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
      <div class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-md bg-blue-50 text-blue-600 font-bold text-[11px] flex items-center justify-center dist-row-num">1</span>
        <span class="text-[11px] font-bold text-slate-700 dist-row-title">Mahsulot</span>
        <span class="text-[10px] text-blue-600 font-semibold dist-item-stock-hint"></span>
      </div>
      <button type="button" onclick="removeDistItemRow(this)" class="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition dist-remove-btn" title="O'chirish">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
      <div class="sm:col-span-6">
        <select class="dist-item-prod w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500" onchange="onDistItemProductChange(this)" required>
          ${optionsHtml}
        </select>
      </div>
      <div class="sm:col-span-3">
        <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <label class="text-[10px] text-slate-400 font-bold uppercase">Miqdor:</label>
          <input type="number" class="dist-item-qty w-full bg-transparent text-xs font-bold text-slate-800 text-center focus:outline-none" min="1" value="${defaultQty}" oninput="calculateDistTotal()" required>
          <span class="text-[10px] text-slate-500 font-semibold dist-item-unit">dona</span>
        </div>
      </div>
      <div class="sm:col-span-3 text-right">
        <span class="text-[10px] text-slate-400 block leading-tight">Summa</span>
        <span class="dist-item-subtotal text-xs font-black text-slate-900 font-mono">0 UZS</span>
        <input type="hidden" class="dist-item-price" value="0">
      </div>
    </div>
  `;

  container.appendChild(rowDiv);

  if (defaultProductId) {
    const sel = rowDiv.querySelector('.dist-item-prod');
    if (sel) onDistItemProductChange(sel);
  }

  updateDistRowNumbers();
  calculateDistTotal();

  if (window.lucide) lucide.createIcons();
}

function removeDistItemRow(btn) {
  const row = btn.closest('.dist-item-row');
  if (row) {
    row.remove();
    const container = document.getElementById('distItemsContainer');
    if (container && container.children.length === 0) {
      addDistItemRow();
    } else {
      updateDistRowNumbers();
      calculateDistTotal();
    }
  }
}

function updateDistRowNumbers() {
  const rows = document.querySelectorAll('#distItemsContainer .dist-item-row');
  const countBadge = document.getElementById('distItemsCountBadge');
  if (countBadge) countBadge.textContent = `${rows.length} xil tovar`;

  rows.forEach((row, idx) => {
    const numEl = row.querySelector('.dist-row-num');
    if (numEl) numEl.textContent = idx + 1;
    const remBtn = row.querySelector('.dist-remove-btn');
    if (remBtn) {
      remBtn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    }
  });
}

function onDistItemProductChange(select) {
  const row = select.closest('.dist-item-row');
  if (!row) return;

  const opt = select.options[select.selectedIndex];
  const priceInput = row.querySelector('.dist-item-price');
  const unitSpan = row.querySelector('.dist-item-unit');
  const stockHint = row.querySelector('.dist-item-stock-hint');
  const titleSpan = row.querySelector('.dist-row-title');
  const qtyInput = row.querySelector('.dist-item-qty');

  if (opt && opt.value) {
    const price = parseFloat(opt.getAttribute('data-price')) || 0;
    const unit = opt.getAttribute('data-unit') || 'dona';
    const stock = parseInt(opt.getAttribute('data-stock')) || 0;
    const pName = opt.text.split('(')[0].trim();

    if (priceInput) priceInput.value = price;
    if (unitSpan) unitSpan.textContent = unit;
    if (stockHint) stockHint.textContent = `(Qoldiq: ${stock} ${unit})`;
    if (titleSpan) titleSpan.textContent = pName;
    if (qtyInput) qtyInput.max = stock > 0 ? stock : 99999;
  } else {
    if (priceInput) priceInput.value = 0;
    if (stockHint) stockHint.textContent = '';
    if (titleSpan) titleSpan.textContent = 'Mahsulot';
  }

  calculateDistTotal();
}

function calculateDistTotal() {
  const rows = document.querySelectorAll('#distItemsContainer .dist-item-row');
  let totalAmount = 0;
  let totalQty = 0;

  rows.forEach(row => {
    const sel = row.querySelector('.dist-item-prod');
    const qtyInput = row.querySelector('.dist-item-qty');
    const subtotalEl = row.querySelector('.dist-item-subtotal');
    const priceInput = row.querySelector('.dist-item-price');

    const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);
    let price = parseFloat(priceInput ? priceInput.value : 0) || 0;
    if (price === 0 && sel && sel.selectedIndex >= 0) {
      price = parseFloat(sel.options[sel.selectedIndex].getAttribute('data-price')) || 0;
    }

    const lineTotal = price * qty;
    if (subtotalEl) {
      subtotalEl.textContent = lineTotal > 0 ? `${Number(lineTotal).toLocaleString('uz-UZ')} UZS` : '0 UZS';
    }

    if (sel && sel.value) {
      totalQty += qty;
      totalAmount += lineTotal;
    }
  });

  const hiddenTotalInput = document.getElementById('distTotalAmount');
  if (hiddenTotalInput) hiddenTotalInput.value = totalAmount;

  const totalAmountDisplay = document.getElementById('distTotalAmountDisplay');
  if (totalAmountDisplay) {
    totalAmountDisplay.textContent = `${Number(totalAmount).toLocaleString('uz-UZ')} UZS`;
  }

  const totalQtyDisplay = document.getElementById('distTotalQtyDisplay');
  if (totalQtyDisplay) {
    totalQtyDisplay.textContent = `${totalQty} dona`;
  }
}

async function openCreateDistributionModal() {
  currentEditingId = null;
  const form = document.querySelector('#addDistributionModal form');
  if (form) form.reset();

  const container = document.getElementById('distItemsContainer');
  if (container) {
    container.innerHTML = '';
    addDistItemRow();
  }

  const driverSelect = document.getElementById('distDriverName');
  if (driverSelect && typeof getSystemDriversList === 'function') {
    const drivers = getSystemDriversList();
    driverSelect.innerHTML = drivers.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');
  }

  openModal('addDistributionModal');
  await refreshModalProductOptions();
}

function openAssignDriverModal(orderId) {
  document.getElementById('assignTargetOrderId').value = orderId;
  const select = document.getElementById('assignDriverSelect');
  if (select) {
    const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
    const driverUsers = users.filter(u => u.role === 'driver' || u.role === 'kuryer').map(u => u.full_name || u.fullName).filter(Boolean);
    const demoDrivers = (window.demoData && window.demoData.drivers) ? window.demoData.drivers.map(d => d.name).filter(Boolean) : [];
    const allNames = Array.from(new Set([...driverUsers, ...demoDrivers]));
    if (allNames.length === 0) {
      const fallbackNames = users.map(u => u.full_name || u.fullName).filter(Boolean);
      allNames.push(...Array.from(new Set(fallbackNames)));
    }
    if (allNames.length > 0) {
      select.innerHTML = allNames.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
    }
  }
  openModal('assignDriverModal');
}

function openCreateReturnModal() {
  currentEditingId = null;
  openModal('addOrderReturnModal');
}

async function handleSaveDistributionOrder(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const customerName = escapeHTML((document.getElementById('distCustomerName').value || '').trim());
    const driverName = escapeHTML((document.getElementById('distDriverName').value || '').trim());
    const warehouseName = escapeHTML(document.getElementById('distWarehouseName').value);
    const statusVal = document.getElementById('distStatus') ? document.getElementById('distStatus').value : 'yangi';
    const notes = escapeHTML((document.getElementById('distNotes').value || '').trim());

    const rows = document.querySelectorAll('#distItemsContainer .dist-item-row');
    const items = [];
    let totalAmount = 0;
    let totalQty = 0;

    rows.forEach(row => {
      const select = row.querySelector('.dist-item-prod');
      const qtyInput = row.querySelector('.dist-item-qty');
      if (!select || !select.value) return;

      const pId = select.value;
      const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);
      const targetProduct = (demoData.products || []).find(p => p && (p.id === pId || p.sku === pId || p.name === pId));
      const pName = targetProduct ? targetProduct.name : select.options[select.selectedIndex].text.split('(')[0].trim();
      const unitPrice = targetProduct ? (targetProduct.sellPrice || 0) : (parseFloat(select.options[select.selectedIndex].getAttribute('data-price')) || 0);
      const lineTotal = unitPrice * qty;

      items.push({
        productId: pId,
        productName: pName,
        sku: (targetProduct && targetProduct.sku) || ('KS' + Math.floor(100000 + Math.random() * 900000)),
        qty: qty,
        quantity: qty,
        price: unitPrice,
        total: lineTotal
      });

      totalQty += qty;
      totalAmount += lineTotal;
    });

    if (!customerName) {
      showToast("Iltimos, mijoz nomini kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    if (items.length === 0 || totalAmount <= 0) {
      showToast("Iltimos, kamida bitta tovar tanlang va miqdorini to'g'ri kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    // Deduct stock for each product
    items.forEach(it => {
      const targetProduct = (demoData.products || []).find(p => p && (p.id === it.productId || p.sku === it.productId || p.name === it.productName));
      if (targetProduct) {
        if (targetProduct.stock < it.qty) {
          showToast(`Ogohlantirish: "${targetProduct.name}" qoldig'i faqat ${targetProduct.stock} ta mavjud!`, 'warning');
        }
        targetProduct.stock = Math.max(0, targetProduct.stock - it.qty);
        const minStk = targetProduct.minStock || 5;
        targetProduct.status = targetProduct.stock <= 0 ? 'Tugagan' : (targetProduct.stock <= minStk ? 'Kam qolgan' : 'Mavjud');
        targetProduct.statusClass = targetProduct.stock <= 0 ? 'badge-danger' : (targetProduct.stock <= minStk ? 'badge-warning' : 'badge-success');

        if (typeof inventoryService !== 'undefined' && inventoryService.updateStatus) {
          inventoryService.updateStatus(targetProduct);
        }
        if (window.productService && targetProduct.id && typeof isUUID === 'function' && isUUID(targetProduct.id)) {
          window.productService.update(targetProduct.id, { stock: targetProduct.stock }).catch(e => console.warn(e));
        }
      }
    });

    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    if (typeof syncGlobalState === 'function') syncGlobalState();

    const currentUser = window.authService ? window.authService.getCurrentUser() : null;
    const cleanAgent = currentUser ? (currentUser.fullName || currentUser.full_name || 'FAYZ') : 'FAYZ';
    const agentName = (cleanAgent || 'FAYZ').replace(/\s*\([^)]*\)/g, '').trim();

    const payload = {
      customerName,
      agentName,
      driverName: driverName || 'Biriktirilmagan',
      warehouseName: warehouseName || 'Asosiy Ombor - Toshkent',
      status: statusVal || 'yangi',
      totalAmount,
      paidAmount: totalAmount,
      distQty: totalQty,
      productName: items.map(it => `${it.productName} (${it.qty})`).join(', '),
      notes: notes || "Yangi buyurtma rasmiylashtirildi",
      items: items
    };

    if (window.distributionService) {
      const res = await window.distributionService.create(payload);
      if (res.success) {
        showToast(`Buyurtma "${res.data.orderNumber}" (${items.length} xil tovar) muvaffaqiyatli saqlandi!`, 'success');
        closeModal('addDistributionModal');
        const form = document.querySelector('#addDistributionModal form');
        if (form) form.reset();

        if (typeof window.renderCurrentView === 'function') {
          await window.renderCurrentView();
        }
      } else {
        showToast(res.error ? res.error.message : "Buyurtma saqlashda xatolik!", 'error');
      }
    } else {
      showToast("Distribution Service topilmadi!", 'error');
    }
  } catch (err) {
    console.error("handleSaveDistributionOrder Error:", err);
    showToast("Buyurtma saqlashda kutilmagan xatolik!", 'error');
  } finally {
    isSubmitting = false;
  }
}

async function handleAssignDriver(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const orderId = document.getElementById('assignTargetOrderId').value;
    const driverName = escapeHTML(document.getElementById('assignDriverSelect').value);

    if (!orderId || !driverName) {
      showToast("Buyurtma yoki haydovchi tanlanmadi!", 'error');
      isSubmitting = false;
      return;
    }

    const res = await distributionService.assignDriver(orderId, driverName);
    if (res.success) {
      showToast(`Haydovchi "${driverName}" biriktirildi!`, 'success');
      closeModal('assignDriverModal');
      if (typeof renderCurrentView === 'function') await renderCurrentView();
    } else {
      showToast("Haydovchi biriktirishda xatolik!", 'error');
    }
  } catch (err) {
    console.error("handleAssignDriver Error:", err);
    showToast("Xatolik yuz berdi!", 'error');
  } finally {
    isSubmitting = false;
  }
}

async function handleSaveOrderReturn(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const customerName = escapeHTML(document.getElementById('retCustomer').value);
    const prdId = document.getElementById('retProduct').value;
    const qty = Math.max(1, parseInt(document.getElementById('retQty').value) || 1);
    const reason = escapeHTML(document.getElementById('retReason').value);
    const refundAmount = Math.max(0, parseInt(document.getElementById('retRefundAmount').value) || 0);

    const prd = demoData.products.find(p => p.id === prdId);
    const prdName = prd ? prd.name : 'Tovar';

    const payload = {
      customerName,
      productId: prdId,
      productName: prdName,
      quantity: qty,
      reason,
      refundAmount: refundAmount || (prd ? prd.sellPrice * qty : 0),
      driverName: 'Biriktirilmagan'
    };

    const res = await returnService.create(payload);
    if (res.success) {
      showToast(`Vozvrat "${res.data.returnNumber}" qayd etildi! (Qoldiq qaytarildi)`, 'success');
      closeModal('addOrderReturnModal');
      if (typeof renderCurrentView === 'function') await renderCurrentView();
    } else {
      showToast(res.error ? res.error.message : "Vozvrat saqlashda xatolik!", 'error');
    }
  } catch (err) {
    console.error("handleSaveOrderReturn Error:", err);
    showToast("Vozvrat saqlashda kutilmagan xatolik!", 'error');
  } finally {
    isSubmitting = false;
  }
}

/* DYNAMIC AUTO PRICE RESOLVER FOR CUSTOMER PRICE TYPES */
function resolveProductPriceForCustomer(productId, customerName) {
  const cust = (demoData.customers || []).find(c => c.name === customerName);
  const prd = (demoData.products || []).find(p => p.id === productId || p.name === productId);
  
  const priceType = cust ? (cust.priceType || 'retail') : 'retail';
  
  let unitPrice = 0;
  let label = 'Chakana';
  let badgeClass = 'bg-blue-100 text-blue-800';

  if (prd) {
    if (priceType === 'wholesale') {
      unitPrice = prd.wholesalePrice || Math.round(prd.sellPrice * 0.9);
      label = 'Optom';
      badgeClass = 'bg-amber-100 text-amber-800';
    } else if (priceType === 'vip') {
      unitPrice = prd.vipPrice || Math.round(prd.sellPrice * 0.8);
      label = 'VIP Diler';
      badgeClass = 'bg-purple-100 text-purple-800';
    } else {
      unitPrice = prd.priceRetail || prd.sellPrice || 0;
      label = 'Chakana';
      badgeClass = 'bg-blue-100 text-blue-800';
    }
  }

  return { unitPrice, priceType, label, badgeClass };
}

function updateSaleAutoPrice() {
  const custName = document.getElementById('saleCustomer')?.value;
  const prdId = document.getElementById('saleProduct')?.value;
  const priceInput = document.getElementById('saleUnitPrice');
  const badgeEl = document.getElementById('salePriceBadge');

  if (custName && prdId) {
    const info = resolveProductPriceForCustomer(prdId, custName);
    if (priceInput) priceInput.value = info.unitPrice;
    if (badgeEl) {
      badgeEl.className = `px-2 py-0.5 rounded text-xs font-bold ${info.badgeClass}`;
      badgeEl.textContent = info.label;
    }
  }
}

function updateDistAutoPrice() {
  const custName = document.getElementById('distCustomer')?.value;
  const prdId = document.getElementById('distProduct')?.value;
  const priceInput = document.getElementById('distUnitPrice');
  const badgeEl = document.getElementById('distPriceBadge');

  if (custName && prdId) {
    const info = resolveProductPriceForCustomer(prdId, custName);
    if (priceInput) priceInput.value = info.unitPrice;
    if (badgeEl) {
      badgeEl.className = `px-2 py-0.5 rounded text-xs font-bold ${info.badgeClass}`;
      badgeEl.textContent = info.label;
    }
  }
}

/* REAL-TIME CREDIT LIMIT & DEBT VALIDATION */
function checkSaleCreditLimitValidation() {
  const custName = document.getElementById('saleCustomer')?.value;
  const prdId = document.getElementById('saleProduct')?.value;
  const unitPrice = Math.max(0, parseInt(document.getElementById('saleUnitPrice')?.value) || 0);
  const qty = Math.max(1, parseInt(document.getElementById('saleQty')?.value) || 1);
  const paidInputVal = document.getElementById('salePaidAmount')?.value;

  const totalAmount = unitPrice * qty;
  const paidAmount = paidInputVal !== '' ? Math.max(0, parseInt(paidInputVal) || 0) : totalAmount;
  const newDebt = Math.max(0, totalAmount - paidAmount);

  const cust = (demoData.customers || []).find(c => c.name === custName);
  const alertBox = document.getElementById('saleCreditLimitAlertContainer');

  if (!cust || !alertBox) return;

  const currentDebt = cust.balance || 0;
  const limit = cust.creditLimit || 0;
  const projectedTotalDebt = currentDebt + newDebt;

  let alertHTML = '';

  if (cust.isBlocked) {
    alertHTML = `
      <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
        <i data-lucide="shield-alert" class="w-4 h-4 text-rose-600 shrink-0"></i>
        <div>
          <span class="font-bold">⛔ USHBU MIJOZ BLOKLANGAN!</span> Qarzga sotish taqiqlangan. Faqat 100% to'lov bilan ruxsat beriladi.
        </div>
      </div>
    `;
  } else if (limit > 0 && projectedTotalDebt > limit && newDebt > 0) {
    const overflow = projectedTotalDebt - limit;
    alertHTML = `
      <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0"></i>
        <div>
          <span class="font-bold">⚠️ KREDIT LIMITDAN OSHIB KETDI!</span><br>
          Joriy qarz: <span class="font-mono font-bold">${currentDebt.toLocaleString()} UZS</span> | Limit: <span class="font-mono font-bold">${limit.toLocaleString()} UZS</span> | Oshgan: <span class="font-bold text-rose-700">${overflow.toLocaleString()} UZS</span>
        </div>
      </div>
    `;
  } else if (limit > 0) {
    const remainingLimit = Math.max(0, limit - currentDebt);
    alertHTML = `
      <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center justify-between">
        <span>Joriy qarz: <strong class="text-slate-900">${currentDebt.toLocaleString()} UZS</strong></span>
        <span>Limit: <strong class="text-blue-600">${limit.toLocaleString()} UZS</strong></span>
        <span>Ruxsat etilgan qolgan limit: <strong class="${remainingLimit < newDebt ? 'text-rose-600' : 'text-emerald-600'}">${remainingLimit.toLocaleString()} UZS</strong></span>
      </div>
    `;
  }

  if (alertHTML) {
    alertBox.className = 'block';
    alertBox.innerHTML = alertHTML;
    if (window.lucide) lucide.createIcons();
  } else {
    alertBox.className = 'hidden';
    alertBox.innerHTML = '';
  }
}

/* XODIM QO'SHISH (SIGNUP) VA LOGIN HANDLERS */
function openCreateEmployeeModal() {
  currentEditingId = null;
  const title = document.getElementById('employeeModalTitle') || document.querySelector('#addEmployeeModal h3');
  if (title) title.textContent = "Yangi xodim qo'shish";
  const form = document.querySelector('#addEmployeeModal form');
  if (form) form.reset();

  const userIdInput = document.getElementById('empUserId');
  const roleNoteEl = document.getElementById('empUserRoleNote');
  const warningEl = document.getElementById('empUserIdWarning');
  const passInput = document.getElementById('empPassword');
  if (passInput) passInput.required = true;

  if (warningEl) {
    warningEl.innerHTML = '';
    warningEl.classList.add('hidden');
  }

  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const isDirector = currentUser && (currentUser.role === 'director' || currentUser.role === 'admin');

  if (userIdInput) {
    if (isDirector) {
      userIdInput.disabled = false;
      userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500';
      if (roleNoteEl) roleNoteEl.innerHTML = '<span class="text-[11px] text-blue-600 font-semibold">👑 Direktor huquqi: Yangi foydalanuvchiga istalgan o\'zingiz tanlagan ID ni biriktirishingiz mumkin.</span>';
    } else {
      userIdInput.disabled = true;
      userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed';
      if (roleNoteEl) roleNoteEl.innerHTML = '<span class="text-[11px] text-slate-400">🔒 ID ni faqat Direktor huquqiga ega foydalanuvchilar belgilay oladi.</span>';
    }
  }

  openModal('addEmployeeModal');
}

function openEditEmployeeModal(id) {
  const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
  const u = users.find(item => item.id === id || item.full_name === id || item.customId === id);
  if (!u) return;

  currentEditingId = id;
  const title = document.getElementById('employeeModalTitle') || document.querySelector('#addEmployeeModal h3');
  if (title) title.textContent = "Xodim ma'lumotlarini tahrirlash";

  const fullNameInput = document.getElementById('empFullName');
  const userIdInput = document.getElementById('empUserId');
  const roleInput = document.getElementById('empRole');
  const passInput = document.getElementById('empPassword');
  const roleNoteEl = document.getElementById('empUserRoleNote');
  const warningEl = document.getElementById('empUserIdWarning');

  if (warningEl) {
    warningEl.innerHTML = '';
    warningEl.classList.add('hidden');
  }

  if (fullNameInput) fullNameInput.value = u.full_name || u.fullName || '';
  if (userIdInput) userIdInput.value = u.customId || u.id || '';
  if (roleInput) roleInput.value = u.role || 'agent';
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
  }

  const currentUser = window.authService ? window.authService.getCurrentUser() : null;
  const isDirector = currentUser && (currentUser.role === 'director' || currentUser.role === 'admin');

  if (userIdInput) {
    if (isDirector) {
      userIdInput.disabled = false;
      userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500';
      if (roleNoteEl) roleNoteEl.innerHTML = '<span class="text-[11px] text-blue-600 font-semibold">👑 Direktor huquqi: Xodimning ID va parolini o\'zgartirishingiz mumkin.</span>';
    } else {
      userIdInput.disabled = true;
      userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed';
      if (roleNoteEl) roleNoteEl.innerHTML = '<span class="text-[11px] text-slate-400">🔒 ID ni faqat Direktor huquqiga ega foydalanuvchilar belgilay oladi.</span>';
    }
  }

  openModal('addEmployeeModal');
}

async function handleSaveEmployee(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const currentUser = window.authService ? window.authService.getCurrentUser() : null;
    const currentUserRole = currentUser ? (currentUser.role || 'agent').toLowerCase() : 'agent';
    const isDirector = currentUserRole === 'admin' || currentUserRole === 'director';

    if (!isDirector) {
      showToast("Xodim boshqaruvi va ID belgilash faqat Direktor / Admin tomonidan bajariladi!", 'error');
      isSubmitting = false;
      return;
    }

    const full_name = escapeHTML(document.getElementById('empFullName').value.trim());
    const newUserIdInput = document.getElementById('empUserId') ? escapeHTML(document.getElementById('empUserId').value.trim()) : '';
    const password = document.getElementById('empPassword').value.trim();
    const role = document.getElementById('empRole').value;

    if (!full_name || !role) {
      showToast("Iltimos, ism-sharif va rolni kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    if (!currentEditingId && !password) {
      showToast("Yangi xodim uchun parol kiriting (kamida 6 ta belgi)!", 'error');
      isSubmitting = false;
      return;
    }

    if (password && password.length < 6) {
      showToast("Parol kamida 6 ta belgidan iborat bo'lishi kerak!", 'error');
      isSubmitting = false;
      return;
    }

    const roleLabels = { agent: 'Savdo Agenti', driver: 'Haydovchi', warehouse: 'Omborchi', supervisor: 'Supervayzer', director: 'Direktor', admin: 'Administrator' };
    const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];

    if (currentEditingId) {
      // Edit existing employee
      const uIdx = users.findIndex(u => u.id === currentEditingId || u.full_name === currentEditingId || u.customId === currentEditingId);
      const targetUser = uIdx !== -1 ? users[uIdx] : null;
      const oldId = targetUser ? (targetUser.id || currentEditingId) : currentEditingId;
      const oldFn = targetUser ? targetUser.full_name : '';

      // ID change validation
      if (newUserIdInput && newUserIdInput.toLowerCase() !== String(oldId).toLowerCase()) {
        if (window.isUserIdTakenByOther && window.isUserIdTakenByOther(newUserIdInput, oldId)) {
          showToast(`⚠️ Ushbu ID (login) "${newUserIdInput}" boshqa foydalanuvchida mavjud! Boshqa ID kiriting.`, 'error');
          isSubmitting = false;
          return;
        }

        // Migrate ID mapping
        try {
          const customMap = JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}');
          if (oldId) delete customMap[oldId];
          if (targetUser && targetUser.uuid) customMap[targetUser.uuid] = newUserIdInput;
          if (full_name) customMap[full_name.toLowerCase().trim()] = newUserIdInput;
          if (oldFn) customMap[oldFn.toLowerCase().trim()] = newUserIdInput;
          customMap[newUserIdInput] = newUserIdInput;
          localStorage.setItem('smartombor_custom_user_ids', JSON.stringify(customMap));
        } catch (e) {}

        // Migrate password
        if (window.userPasswordStore) {
          const activePass = password || window.userPasswordStore.getPasswordForUser(oldId) || '123456';
          window.userPasswordStore.setPasswordForUser(newUserIdInput, activePass);
          try {
            const passStore = window.userPasswordStore.getPasswords();
            if (oldId && passStore[String(oldId).toLowerCase().trim()]) {
              delete passStore[String(oldId).toLowerCase().trim()];
              localStorage.setItem('smartombor_user_passwords_v2', JSON.stringify(passStore));
            }
          } catch(e) {}
        }
      }

      if (targetUser) {
        if (!targetUser.previousNames) targetUser.previousNames = [];
        if (oldFn && oldFn !== full_name && !targetUser.previousNames.includes(oldFn)) {
          targetUser.previousNames.push(oldFn);
        }
        targetUser.full_name = full_name;
        targetUser.fullName = full_name;
        targetUser.role = role;
        targetUser.roleLabel = roleLabels[role] || role;
        if (newUserIdInput) {
          targetUser.id = newUserIdInput;
          targetUser.customId = newUserIdInput;
        }
        if (password) targetUser.password = password;
      }

      if (window.userPasswordStore && password) {
        const finalIdKey = newUserIdInput || oldId;
        window.userPasswordStore.setPasswordForUser(finalIdKey, password);
        window.userPasswordStore.setPasswordForUser(full_name, password);
      }

      // Update Supabase profiles table if online
      const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
      if (client && navigator.onLine) {
        try {
          const isUuid = val => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
          const targetUuid = (targetUser && targetUser.uuid) || (isUuid(currentEditingId) ? currentEditingId : null);
          if (targetUuid && isUuid(targetUuid)) {
            await client.from('profiles').update({ full_name, role }).eq('id', targetUuid);
          } else if (oldFn) {
            await client.from('profiles').update({ full_name, role }).eq('full_name', oldFn);
          } else if (targetUser && targetUser.id) {
            await client.from('profiles').update({ full_name, role }).eq('full_name', targetUser.id);
          }
        } catch (e) {
          console.warn("[handleSaveEmployee Supabase Update Warning]:", e);
        }
      }

      // Sync active session user if editing self
      if (window.authService && window.authService.currentUser) {
        const curUser = window.authService.currentUser;
        if (curUser.id === currentEditingId || curUser.fullName === full_name || curUser.full_name === full_name) {
          if (newUserIdInput) {
            curUser.id = newUserIdInput;
            curUser.customId = newUserIdInput;
          }
          curUser.role = role;
          curUser.roleLabel = roleLabels[role] || role;
          curUser.fullName = full_name;
          curUser.full_name = full_name;
          localStorage.setItem('smartombor_user', JSON.stringify(curUser));
          if (typeof window.authService.updateUserUI === 'function') window.authService.updateUserUI();
        }
      }

      saveStateToLocalStorage();
      syncGlobalState();
      closeModal('addEmployeeModal');
      currentEditingId = null;
      showToast(`Xodim "${full_name}" (ID: ${newUserIdInput || oldId}) ma'lumotlari muvaffaqiyatli yangilandi!`, 'success');
      if (typeof window.renderCurrentView === 'function') await window.renderCurrentView();
      return;
    }

    // Creating new employee
    if (newUserIdInput) {
      if (window.isUserIdTakenByOther && window.isUserIdTakenByOther(newUserIdInput, null)) {
        showToast(`⚠️ Ushbu ID (login) "${newUserIdInput}" boshqa foydalanuvchida mavjud! Boshqa ID kiriting.`, 'error');
        isSubmitting = false;
        return;
      }
    }

    const deletedIds = (window.demoData && window.demoData.deletedUserIds) ? window.demoData.deletedUserIds : [];
    let finalUserId = newUserIdInput;
    if (!finalUserId) {
      let maxNum = 10;
      users.forEach(u => {
        const num = parseInt(String(u.id || u.customId || '').replace(/[^0-9]/g, '')) || 0;
        if (num > maxNum) maxNum = num;
      });
      let candNum = maxNum + 1;
      while (true) {
        const cand = String(candNum).padStart(4, '0');
        const isTaken = users.some(u => String(u.id) === cand || String(u.customId) === cand) || deletedIds.includes(cand);
        if (!isTaken) {
          finalUserId = cand;
          break;
        }
        candNum++;
      }
    }

    // Ensure finalUserId is purged from deletedUserIds blacklist
    if (window.demoData && window.demoData.deletedUserIds) {
      window.demoData.deletedUserIds = window.demoData.deletedUserIds.filter(id => 
        String(id).toLowerCase().trim() !== String(finalUserId).toLowerCase().trim()
      );
      try {
        localStorage.setItem('smartombor_deleted_user_ids', JSON.stringify(window.demoData.deletedUserIds));
      } catch (e) {}
    }

    const cleanSlug = full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const generatedEmail = `${cleanSlug || 'xodim' + Date.now()}@smartup.uz`;

    let res;
    if (typeof window.signUpEmployee === 'function') {
      res = await window.signUpEmployee({ full_name, email: generatedEmail, password, role });
    } else if (window.authService && typeof window.authService.signUpEmployee === 'function') {
      res = await window.authService.signUpEmployee({ full_name, email: generatedEmail, password, role });
    }

    const createdUser = users.find(u => u.full_name === full_name || u.email === generatedEmail);
    if (createdUser) {
      createdUser.id = finalUserId;
      createdUser.customId = finalUserId;
    } else {
      users.push({
        id: finalUserId,
        customId: finalUserId,
        full_name: full_name,
        fullName: full_name,
        email: generatedEmail,
        role: role,
        roleLabel: roleLabels[role] || role,
        status: 'Faol',
        statusClass: 'badge-success',
        createdAt: new Date().toLocaleDateString('uz-UZ')
      });
    }

    // Save custom ID mapping & password store
    try {
      const customMap = JSON.parse(localStorage.getItem('smartombor_custom_user_ids') || '{}');
      customMap[finalUserId] = finalUserId;
      customMap[full_name.toLowerCase().trim()] = finalUserId;
      if (createdUser && createdUser.uuid) customMap[createdUser.uuid] = finalUserId;
      localStorage.setItem('smartombor_custom_user_ids', JSON.stringify(customMap));
    } catch(e) {}

    if (window.userPasswordStore && password) {
      window.userPasswordStore.setPasswordForUser(finalUserId, password);
      window.userPasswordStore.setPasswordForUser(full_name, password);
    }

    saveStateToLocalStorage();
    syncGlobalState();
    closeModal('addEmployeeModal');

    const form = document.querySelector('#addEmployeeModal form');
    if (form) form.reset();

    showToast(`Yangi xodim "${full_name}" (ID: ${finalUserId}) muvaffaqiyatli qo'shildi!`, 'success');
    if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }
  } catch (err) {
    console.error("[handleSaveEmployee Error]:", err);
    showToast("Xodim saqlashda kutilmagan xatolik: " + (err.message || err), 'error');
  } finally {
    isSubmitting = false;
  }
}

/* LOGIN & RBAC MODAL HANDLERS WITH SUPABASE REDIRECT */
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const loginInput = document.getElementById('loginEmail') ? document.getElementById('loginEmail').value : '';
  const password = document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '';

  if (typeof window.loginUserAndRedirect === 'function') {
    const res = await window.loginUserAndRedirect(loginInput, password);
    if (res && res.success) {
      closeLoginModal();
      showToast(`Xush kelibsiz, ${res.user.fullName || res.user.full_name}! (${res.user.roleLabel}). Yo'naltirilmoqda...`, 'success');
      return;
    } else {
      const errMsg = (res && res.error && res.error.message) ? res.error.message : "Noto'g'ri login yoki parol.";
      showToast(errMsg, 'error');
      return;
    }
  }

  if (window.authService) {
    const res = await window.authService.login(loginInput, password);
    if (res && (res.data || res.success)) {
      closeLoginModal();
      const user = res.data || res.user;
      showToast(`Xush kelibsiz, ${user.fullName || user.full_name}!`, 'success');
      if (typeof window.navigateTo === 'function') {
        window.navigateTo(window.getRouteFromHash ? window.getRouteFromHash() : 'dashboard');
      } else if (typeof window.renderCurrentView === 'function') {
        window.renderCurrentView();
      }
    } else {
      const errMsg = (res && res.error && res.error.message) ? res.error.message : "Noto'g'ri login yoki parol.";
      showToast(errMsg, 'error');
    }
  }
}

function handleQuickLogin(roleKey) {
  if (window.authService) {
    const acc = window.authService.loginAsRole(roleKey);
    closeLoginModal();
    if (typeof window.navigateTo === 'function') {
      window.navigateTo(window.getRouteFromHash ? window.getRouteFromHash() : 'dashboard');
    } else if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }
  }
}

let pendingModalAvatarDataUrl = null;

async function handleModalAvatarUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const resizedDataUrl = await resizeAvatarImage(file, 250, 250, 0.8);
    pendingModalAvatarDataUrl = resizedDataUrl;

    const preview = document.getElementById('modalProfileAvatarPreview');
    if (preview) preview.src = pendingModalAvatarDataUrl;

    showToast("Yangi rasm tanlandi! Saqlash tugmasini bosing.", 'info');
  } catch (err) {
    console.error("[handleModalAvatarUpload Error]:", err);
    showToast("Rasm yuklashda xatolik!", 'error');
  }
}

function openEditProfileModal() {
  const user = window.authService ? window.authService.getCurrentUser() : null;
  pendingModalAvatarDataUrl = null;

  if (user) {
    const nameInput = document.getElementById('selfFullName');
    const userIdInput = document.getElementById('selfUserId');
    const phoneInput = document.getElementById('selfPhone');
    const currPassInput = document.getElementById('selfCurrentPassword');
    const newPassInput = document.getElementById('selfNewPassword');
    const confPassInput = document.getElementById('selfConfirmPassword');
    const avatarPreview = document.getElementById('modalProfileAvatarPreview');
    const roleNoteEl = document.getElementById('modalUserRoleNote');
    const warningEl = document.getElementById('modalUserIdWarning');

    if (warningEl) {
      warningEl.innerHTML = '';
      warningEl.classList.add('hidden');
    }

    if (nameInput) nameInput.value = user.fullName || user.full_name || '';
    if (userIdInput) userIdInput.value = user.id || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (currPassInput) currPassInput.value = '';
    if (newPassInput) newPassInput.value = '';
    if (confPassInput) confPassInput.value = '';

    const isDirector = (user.role === 'director' || user.role === 'admin');

    if (userIdInput) {
      if (isDirector) {
        userIdInput.disabled = false;
        userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500';
      } else {
        userIdInput.disabled = true;
        userIdInput.className = 'w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed';
      }
    }

    if (roleNoteEl) {
      if (isDirector) {
        roleNoteEl.innerHTML = `<p class="text-[11px] text-blue-600 font-medium flex items-center gap-1"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> 👑 Direktor huquqi: ID va Ismni o'zgartirishingiz mumkin.</p>`;
      } else {
        roleNoteEl.innerHTML = `<p class="text-[11px] text-amber-700 font-medium flex items-center gap-1 bg-amber-50 p-1.5 rounded-lg border border-amber-200/80"><i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i> 🔒 ID ni faqat Direktor huquqiga ega foydalanuvchilar o'zgartira oladi.</p>`;
      }
      if (window.lucide) lucide.createIcons();
    }

    const defaultAvatar = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>';
    const uId = user.id || user.fullName;
    let userAvatar = user.avatar || user.avatar_url || (uId ? localStorage.getItem('smartombor_user_avatar_' + uId) : null);
    if (userAvatar && userAvatar.includes('unsplash.com')) {
      userAvatar = null;
    }

    if (avatarPreview) {
      avatarPreview.src = userAvatar || defaultAvatar;
    }
  }
  openModal('editProfileModal');
}

async function handleSaveSelfProfile(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    const fullName = escapeHTML(document.getElementById('selfFullName').value.trim());
    const userIdInput = document.getElementById('selfUserId');
    const newUserId = userIdInput ? escapeHTML(userIdInput.value.trim()) : '';
    const phone = escapeHTML(document.getElementById('selfPhone').value.trim());
    
    const currPassword = document.getElementById('selfCurrentPassword') ? document.getElementById('selfCurrentPassword').value.trim() : '';
    const newPassword = document.getElementById('selfNewPassword') ? document.getElementById('selfNewPassword').value.trim() : '';
    const confirmPassword = document.getElementById('selfConfirmPassword') ? document.getElementById('selfConfirmPassword').value.trim() : '';

    if (!fullName) {
      showToast("Ism-sharifingizni kiriting!", 'error');
      isSubmitting = false;
      return;
    }

    const currentUser = window.authService ? window.authService.getCurrentUser() : null;
    const isDirector = currentUser && (currentUser.role === 'director' || currentUser.role === 'admin');

    // ID Change & Duplicate ID Validation
    if (newUserId && currentUser && newUserId.toLowerCase() !== String(currentUser.id || '').toLowerCase()) {
      if (!isDirector) {
        showToast("ID ni o'zgartirish faqat Direktor huquqiga ega foydalanuvchilar uchun!", 'error');
        isSubmitting = false;
        return;
      }

      if (window.isUserIdTakenByOther && window.isUserIdTakenByOther(newUserId, currentUser.id)) {
        showToast("Ushbu ID (login) boshqa foydalanuvchi tomonidan ishlatilmoqda! Boshqa ID kiriting.", 'error');
        isSubmitting = false;
        return;
      }
    }

    // Password change validation via Supabase Auth
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        showToast("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!", 'error');
        isSubmitting = false;
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast("Yangi parollar bir-biriga mos kelmadi!", 'error');
        isSubmitting = false;
        return;
      }
    }

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

    if (newPassword && newPassword.length >= 6 && window.userPasswordStore && currentUser) {
      window.userPasswordStore.setPasswordForUser(currentUser.id, newPassword);
      if (newUserId && isDirector) window.userPasswordStore.setPasswordForUser(newUserId, newPassword);
      if (currentUser.email) window.userPasswordStore.setPasswordForUser(currentUser.email, newPassword);
      if (currentUser.fullName) window.userPasswordStore.setPasswordForUser(currentUser.fullName, newPassword);
      window.userPasswordStore.setPasswordForUser(fullName, newPassword);
    }

    if (client && navigator.onLine && currentUser && currentUser.id) {
      try {
        const isUuidFormat = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const activeTargetId = (isDirector && newUserId) ? newUserId : currentUser.id;
        if (isUuidFormat(activeTargetId)) {
          const profilePayload = {
            id: activeTargetId,
            full_name: fullName,
            updated_at: new Date().toISOString()
          };
          await client.from('profiles').upsert(profilePayload);
        }

        if (newPassword && newPassword.length >= 6 && client.auth) {
          const { data: sessData } = await client.auth.getSession();
          if (sessData && sessData.session) {
            const { error: passErr } = await client.auth.updateUser({ password: newPassword });
            if (passErr) {
              console.warn("[handleSaveSelfProfile Supabase Auth Notice]:", passErr.message);
            }
          }
        }
      } catch (e) {
        console.warn("[handleSaveSelfProfile Exception]:", e);
      }
    }

    if (currentUser) {
      const oldFullName = currentUser.fullName || currentUser.full_name;
      const oldId = currentUser.id;

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
      delete currentUser.password;
      if (phone) currentUser.phone = phone;

      const uId = currentUser.id || currentUser.fullName;

      if (pendingModalAvatarDataUrl) {
        currentUser.avatar = pendingModalAvatarDataUrl;
        currentUser.avatar_url = pendingModalAvatarDataUrl;
        try {
          localStorage.setItem('smartombor_user_avatar_' + uId, pendingModalAvatarDataUrl);
        } catch (e) {}
      }

      if (currentUser.role === 'admin' || currentUser.role === 'director' || oldFullName === 'FAYZ' || fullName === 'FAYZ') {
        try {
          localStorage.setItem('smartombor_admin_profile', JSON.stringify({
            fullName: fullName,
            phone: phone
          }));
        } catch (e) {}
      }

      try {
        localStorage.setItem('smartombor_user', JSON.stringify(currentUser));
      } catch (e) {}

      if (window.demoData && window.demoData.users) {
        const uItem = window.demoData.users.find(u => 
          (oldId && u.id === oldId) || 
          (currentUser.uuid && u.uuid === currentUser.uuid) ||
          (u.id === currentUser.id) || 
          (oldFullName && u.full_name && u.full_name.toLowerCase().trim() === oldFullName.toLowerCase().trim()) ||
          (u.full_name && u.full_name.toLowerCase().trim() === fullName.toLowerCase().trim())
        );
        if (uItem) {
          if (!uItem.previousNames) uItem.previousNames = [];
          if (oldFullName && oldFullName !== fullName && !uItem.previousNames.includes(oldFullName)) {
            uItem.previousNames.push(oldFullName);
          }
          if (isDirector && newUserId) {
            uItem.id = newUserId;
            uItem.customId = newUserId;
          }
          uItem.full_name = fullName;
          uItem.fullName = fullName;
          if (pendingModalAvatarDataUrl) uItem.avatar = pendingModalAvatarDataUrl;
        } else {
          window.demoData.users.push({
            id: currentUser.id || 'usr-' + Date.now(),
            customId: currentUser.id,
            full_name: fullName,
            email: currentUser.email || 'xodim@smartup.uz',
            role: currentUser.role || 'agent',
            roleLabel: currentUser.roleLabel || 'Xodim',
            status: 'Faol',
            statusClass: 'badge-success',
            createdAt: new Date().toLocaleDateString('uz-UZ')
          });
        }
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
        if (typeof syncGlobalState === 'function') syncGlobalState();
      }
    }

    if (window.authService) {
      window.authService.updateUserUI();
    }

    closeModal('editProfileModal');
    if (newPassword) {
      showToast("Profil va yangi parolingiz muvaffaqiyatli saqlandi!", 'success');
    } else {
      showToast("Profil ma'lumotlaringiz muvaffaqiyatli saqlandi!", 'success');
    }

    if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }
  } catch (err) {
    console.error("[handleSaveSelfProfile Error]:", err);
    showToast("Profilni saqlashda xatolik yuz berdi!", 'error');
  } finally {
    isSubmitting = false;
  }
}

function openCreateDistributionModal() {
  currentEditingId = null;
  const form = document.querySelector('#addDistributionModal form');
  if (form) form.reset();

  const driverSelect = document.getElementById('distDriverName');
  if (driverSelect) {
    const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
    const driverUsers = users.filter(u => u.role === 'driver' || u.role === 'kuryer').map(u => u.full_name || u.fullName).filter(Boolean);
    const demoDrivers = (window.demoData && window.demoData.drivers) ? window.demoData.drivers.map(d => d.name).filter(Boolean) : [];
    let uniqueNames = Array.from(new Set([...driverUsers, ...demoDrivers]));
    if (uniqueNames.length === 0) {
      const userNames = users.map(u => u.full_name || u.fullName).filter(Boolean);
      uniqueNames = Array.from(new Set(userNames));
    }
    if (!uniqueNames.includes('Tayinlanmagan')) uniqueNames.unshift('Tayinlanmagan');
    
    driverSelect.innerHTML = uniqueNames.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');
  }

  openModal('addDistributionModal');
}


function openViewOrderModal(orderId) {
  const orders = (window.demoData && window.demoData.distributionOrders) ? window.demoData.distributionOrders : [];
  const ord = orders.find(o => o.id === orderId || o.orderNumber === orderId);
  if (!ord) {
    showToast("Buyurtma topilmadi!", 'error');
    return;
  }

  const activeIdInput = document.getElementById('vOrdActiveId');
  if (activeIdInput) activeIdInput.value = ord.id;

  const numEl = document.getElementById('vOrdNumber');
  if (numEl) numEl.textContent = ord.orderNumber || 'ORD-2026';

  const dateEl = document.getElementById('vOrdDate');
  if (dateEl) dateEl.textContent = ord.createdAt || new Date().toLocaleString('uz-UZ');

  const custEl = document.getElementById('vOrdCustomer');
  if (custEl) custEl.textContent = ord.customerName || '-';

  const drvEl = document.getElementById('vOrdDriver');
  if (drvEl) drvEl.textContent = ord.driverName || 'Biriktirilmagan';

  const whEl = document.getElementById('vOrdWarehouse');
  if (whEl) whEl.textContent = ord.warehouseName || 'Asosiy Ombor';

  const agtEl = document.getElementById('vOrdAgent');
  if (agtEl) agtEl.textContent = ord.agentName || 'FAYZ';

  const totalEl = document.getElementById('vOrdTotal');
  if (totalEl) totalEl.textContent = (ord.totalAmount ? Number(ord.totalAmount).toLocaleString('uz-UZ') : '0') + ' UZS';

  const notesEl = document.getElementById('vOrdNotes');
  if (notesEl) notesEl.textContent = ord.notes || 'Izohsiz';

  const statusEl = document.getElementById('vOrdStatus');
  if (statusEl) {
    const statusLabels = {
      yangi: 'Yangi Buyurtma',
      yigildi: 'Omborda Yig\'ildi',
      yetkazilmoqda: 'Yetkazilmoqda (Yo\'lda)',
      yetkazildi: 'Yetkazildi va To\'landi',
      bekor_qilindi: 'Bekor qilingan'
    };
    const statusBadges = {
      yangi: 'badge-primary',
      yigildi: 'badge-warning',
      yetkazilmoqda: 'badge-info',
      yetkazildi: 'badge-success',
      bekor_qilindi: 'badge-danger'
    };
    statusEl.textContent = statusLabels[ord.status] || ord.status;
    statusEl.className = `badge ${statusBadges[ord.status] || 'badge-secondary'}`;
  }

  const itemsBody = document.getElementById('vOrdItemsBody');
  if (itemsBody) {
    let items = (ord.items && ord.items.length > 0) ? ord.items : [];

    const getBestProductName = (candidate) => {
      if (candidate && candidate !== "Buyurtma mahsulotlari" && candidate !== "Noma'lum Tovar" && candidate !== "Tovar") {
        return candidate;
      }
      if (ord.productName && ord.productName !== "Buyurtma mahsulotlari" && ord.productName !== "Noma'lum Tovar" && ord.productName !== "Tovar") {
        return ord.productName;
      }
      const matchedByPrice = (demoData.products || []).find(p => p && (p.sellPrice === ord.totalAmount || p.buyPrice === ord.totalAmount));
      if (matchedByPrice && matchedByPrice.name) return matchedByPrice.name;
      if (demoData.products && demoData.products[0] && demoData.products[0].name) return demoData.products[0].name;
      return "Bosch GSB 13 RE Drel";
    };

    if (items.length === 0) {
      items = [{ productName: getBestProductName(), qty: 1, price: ord.totalAmount || 0, total: ord.totalAmount || 0 }];
    }

    itemsBody.innerHTML = items.map((it, idx) => {
      const pName = getBestProductName(it.productName || it.name);
      const pQty = it.qty || it.quantity || 1;
      const pPrice = it.price || it.unitPrice || (ord.totalAmount ? ord.totalAmount / pQty : 0);
      const pTotal = it.total || (pPrice * pQty) || ord.totalAmount || 0;
      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="p-3 font-bold text-slate-800">${escapeHTML(pName)}</td>
          <td class="p-3 text-center font-bold text-slate-700">${pQty} dona</td>
          <td class="p-3 text-right font-medium text-slate-600">${Number(pPrice).toLocaleString('uz-UZ')} UZS</td>
          <td class="p-3 text-right font-black text-emerald-600">${Number(pTotal).toLocaleString('uz-UZ')} UZS</td>
        </tr>
      `;
    }).join('');
  }

  const cancelBtn = document.getElementById('vOrdCancelBtn');
  if (cancelBtn) {
    if (ord.status === 'bekor_qilindi') {
      cancelBtn.classList.add('hidden');
    } else {
      cancelBtn.classList.remove('hidden');
    }
  }

  openModal('viewOrderModal');
}

function handleCancelOrderModal() {
  const activeId = document.getElementById('vOrdActiveId') ? document.getElementById('vOrdActiveId').value : null;
  if (!activeId) return;
  closeModal('viewOrderModal');
  if (typeof window.handleCancelOrder === 'function') {
    window.handleCancelOrder(activeId);
  } else if (typeof window.changeOrderStatus === 'function') {
    window.changeOrderStatus(activeId, 'bekor_qilindi');
  }
}

window.handleCancelOrderModal = handleCancelOrderModal;

function exportSingleOrderPDF(orderId) {
  try {
    const targetId = orderId || (document.getElementById('vOrdActiveId') ? document.getElementById('vOrdActiveId').value : null);
    const orders = (window.demoData && window.demoData.distributionOrders) ? window.demoData.distributionOrders : [];
    const ord = orders.find(o => o.id === targetId || o.orderNumber === targetId);
    if (!ord) {
      showToast("Buyurtma topilmadi!", 'error');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast("PDF kutubxonasi yuklanmoqda, iltimos qayta urinib ko'ring", 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header Title Banner
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text("SmartOmbor ERP — BUYURTMA VA YUK XATI", 14, 17);

    // Metadata Block Left
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Buyurtma №: ${ord.orderNumber}`, 14, 36);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mijoz: ${ord.customerName}`, 14, 43);
    doc.text(`Ombor: ${ord.warehouseName || 'Asosiy Ombor'}`, 14, 49);
    doc.text(`Agent: ${ord.agentName || 'FAYZ'}`, 14, 55);

    // Metadata Block Right
    doc.setFont('helvetica', 'bold');
    doc.text(`Sana: ${ord.createdAt || new Date().toLocaleDateString('uz-UZ')}`, 120, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`Haydovchi (Kuryer): ${ord.driverName || 'Biriktirilmagan'}`, 120, 43);
    doc.text(`Holat: ${ord.status || 'Yangi'}`, 120, 49);
    doc.text(`Izoh / Manzil: ${ord.notes || 'Izohsiz'}`, 120, 55);

    // Horizontal Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 60, 196, 60);

    // Items Table
    const items = (ord.items && ord.items.length > 0) ? ord.items : [
      { productName: "Buyurtma tovarlari", qty: 1, price: ord.totalAmount, total: ord.totalAmount }
    ];

    const tableRows = items.map((it, idx) => [
      idx + 1,
      it.productName || it.name || 'Tovar',
      `${it.qty || it.quantity || 1} dona`,
      (it.price || it.unitPrice || 0).toLocaleString('uz-UZ') + ' UZS',
      (it.total || (it.price * (it.qty || 1)) || ord.totalAmount || 0).toLocaleString('uz-UZ') + ' UZS'
    ]);

    doc.autoTable({
      startY: 65,
      head: [['№', 'Mahsulot Nomi', 'Miqdor', 'Birlik Narxi', 'Jami Summa']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 120;

    // Total Financial Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Jami Summa: ${Number(ord.totalAmount || 0).toLocaleString('uz-UZ')} UZS`, 130, finalY);
    doc.text(`To'langan Summa: ${Number(ord.paidAmount || ord.totalAmount || 0).toLocaleString('uz-UZ')} UZS`, 130, finalY + 6);

    // Signature Area
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.line(14, finalY + 25, 75, finalY + 25);
    doc.text("Topshirdi (Omborchi / Haydovchi)", 14, finalY + 30);

    doc.line(125, finalY + 25, 186, finalY + 25);
    doc.text("Qabul qildi (Mijoz / Mas'ul shaxs)", 125, finalY + 30);

    // Footer copyright
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("SmartOmbor ERP Logistics Engine © 2026", 14, 285);

    doc.save(`SmartOmbor_Buyurtma_${ord.orderNumber}.pdf`);
    showToast(`Buyurtma "${ord.orderNumber}" PDF formatida yuklandi!`, 'success');
  } catch (err) {
    console.error("[exportSingleOrderPDF Error]:", err);
    showToast("PDF yuklashda xatolik yuz berdi", 'error');
  }
}

async function exportSingleOrderExcel(orderId) {
  try {
    const targetId = orderId || (document.getElementById('invoiceActiveOrderId') ? document.getElementById('invoiceActiveOrderId').value : null) || (document.getElementById('vOrdActiveId') ? document.getElementById('vOrdActiveId').value : null);
    const orders = (window.demoData && window.demoData.distributionOrders) ? window.demoData.distributionOrders : [];
    const ord = orders.find(o => o.id === targetId || o.orderNumber === targetId) || (window.demoData && window.demoData.recentSales ? window.demoData.recentSales.find(s => s.id === targetId || s.receiptNo === targetId) : null);
    
    if (!ord) {
      showToast("Buyurtma topilmadi!", 'error');
      return;
    }

    // Lookup Customer info from demoData.customers
    const customers = (window.demoData && window.demoData.customers) ? window.demoData.customers : [];
    const custName = typeof unescapeHTML === 'function' ? unescapeHTML(ord.customerName || ord.customer || '446 TOLIPOV U YTT') : (ord.customerName || ord.customer || '446 TOLIPOV U YTT');
    const custObj = customers.find(c => c && c.name && c.name.toLowerCase() === custName.toLowerCase()) || {};
    const custPhone = ord.customerPhone || custObj.phone || '998935825533';
    const custId = ord.customerId || (custObj.id ? String(custObj.id).replace(/[^0-9]/g, '').slice(0, 7) : '') || '4114203';
    const custDebt = custObj.balance || custObj.debt || 0;

    // Lookup Agent info
    const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
    const agentName = typeof unescapeHTML === 'function' ? unescapeHTML(ord.agentName || 'LATIPOV AZAMAT') : (ord.agentName || 'LATIPOV AZAMAT');
    const agentObj = users.find(u => u && (u.full_name || u.fullName) && (u.full_name || u.fullName).toLowerCase() === agentName.toLowerCase()) || {};
    const agentPhone = agentObj.phone || '998775354713';

    // Driver & Order info
    const driverName = typeof unescapeHTML === 'function' ? unescapeHTML(ord.driverName || 'KSD Alisher 86') : (ord.driverName || 'KSD Alisher 86');
    const orderNum = ord.orderNumber || ord.receiptNo || ('ORD-2026-' + Math.floor(1000 + Math.random() * 9000));
    const orderDate = ord.createdAt || ord.date || new Date().toLocaleString('uz-UZ');
    const numericOrderId = ord.numericId || String(ord.id || orderNum).replace(/[^0-9]/g, '').slice(-9) || '269452837';

    // Items list
    const defaultItems = [
      { productName: "Kerasys HOMME SHAMPOO 550ML (DEEP CLEANSING)", sku: "KS877388", qty: 6, price: 56900, total: 341400 },
      { productName: "Kerasys HOMME SHAMPOO 550ML (SCALP CARE)", sku: "KS877395", qty: 6, price: 56900, total: 341400 },
      { productName: "Kerasys Perfume Shampoo Elegance & Sensual 400ml", sku: "KS313756", qty: 2, price: 42400, total: 84800 },
      { productName: "Kerasys Perfume Shampoo Lovely & Romantic 400ml", sku: "KS313732", qty: 3, price: 42400, total: 127200 },
      { productName: "Kerasys Perfume Shampoo Pure & Charming 400ml", sku: "KS313787", qty: 2, price: 42400, total: 84800 },
      { productName: "Kerasys Perfume Shampoo Glam & Stylish 400ml", sku: "KS426821", qty: 2, price: 42400, total: 84800 },
      { productName: "Kerasys Perfume Shampoo Blooming & Flowery 400ml", sku: "KS426814", qty: 3, price: 42400, total: 127200 },
      { productName: "Perfume Yapaloq Elegance & Sensual Shampoo 600ml", sku: "KS992715", qty: 4, price: 58400, total: 233600 },
      { productName: "Perfume Yapaloq Lovely & Romantic Shampoo 600ml", sku: "KS992708", qty: 6, price: 58400, total: 350400 },
      { productName: "Perfume Yapaloq Pure & Charming Shampoo 600ml", sku: "KS992722", qty: 2, price: 58400, total: 116800 },
      { productName: "Perfume Yapaloq Blooming & Flowery Shampoo 600ml", sku: "KS240557", qty: 6, price: 58400, total: 350400 }
    ];

    const items = (ord.items && ord.items.length > 0) ? ord.items : (ord.productName ? [{
      productName: ord.productName,
      sku: ord.sku || ('KS' + Math.floor(100000 + Math.random() * 900000)),
      qty: ord.distQty || ord.qty || 1,
      price: (ord.totalAmount && (ord.distQty || ord.qty)) ? Math.round(ord.totalAmount / (ord.distQty || ord.qty)) : ord.totalAmount,
      total: ord.totalAmount
    }] : defaultItems);

    const products = (window.demoData && window.demoData.products) ? window.demoData.products : [];
    const exportFileName = `Nakladnaya_${ord.orderNumber || numericOrderId}.xlsx`;

    // 1. Prioritize ExcelJS for exact colors, borders, and styles
    if (window.ExcelJS) {
      const workbook = new window.ExcelJS.Workbook();
      workbook.creator = "SmartOmbor";
      const ws = workbook.addWorksheet("Nakladnaya", {
        views: [{ showGridLines: true }]
      });

      // Define Column Widths
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
        fgColor: { argb: 'FFBFBFBF' } // Exact grey fill color matching 2nd screenshot
      };

      // Top Metadata Header Rows (1 to 4)
      const r1 = ws.addRow([`Клиент: ${custName}`, '', '', `ТП: ${agentName}`, '', '']);
      ws.mergeCells('A1:C1');
      ws.mergeCells('D1:F1');

      const r2 = ws.addRow([`Тел.: ${custPhone}`, '', '', `Тел. ТП:${agentPhone}`, '', '']);
      ws.mergeCells('A2:C2');
      ws.mergeCells('D2:F2');

      const r3 = ws.addRow([`Дата заказа: ${orderDate}`, '', '', `Доставщик: ${driverName}`, '', '']);
      ws.mergeCells('A3:C3');
      ws.mergeCells('D3:F3');

      const r4 = ws.addRow([`ID Клиент:${custId}`, '', '', `ИД заказа:${numericOrderId}`, '', '']);
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
        if (col === 1 || col === 3 || col === 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (col === 5 || col === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }

      // Data Rows
      let totalQty = 0;
      let totalSum = 0;

      items.forEach((it, idx) => {
        const rawName = it.productName || it.name || 'Tovar';
        const pName = typeof unescapeHTML === 'function' ? unescapeHTML(rawName) : rawName;
        const matchedProd = products.find(p => p && p.name && p.name.toLowerCase() === rawName.toLowerCase()) || {};
        const sku = it.sku || it.code || matchedProd.sku || matchedProd.code || ('KS' + Math.floor(100000 + ((idx + 1) * 38291) % 899999));
        const qty = Number(it.qty || it.quantity || 1);
        const price = Number(it.price || it.unitPrice || matchedProd.sellPrice || 0);
        const lineTotal = Number(it.total || (qty * price) || 0);

        totalQty += qty;
        totalSum += lineTotal;

        const row = ws.addRow([
          idx + 1,
          sku,
          pName,
          qty,
          price,
          lineTotal
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
          } else if (col === 5 || col === 6) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        }
      });

      if (totalSum === 0 && ord.totalAmount) {
        totalSum = Number(ord.totalAmount);
      }

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
        } else if (col === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      }

      // Footer Rows
      const blankRow1 = ws.addRow(['', '', '', '', '', '']);
      blankRow1.height = 10;

      const qarzText = custDebt ? (typeof custDebt === 'number' ? custDebt.toLocaleString('uz-UZ') : custDebt) : '';
      const qRow = ws.addRow([`Qoldiq qarz : ${qarzText}`, '', '', '', '', '']);
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

      showToast(`Yuk xati "${ord.orderNumber || numericOrderId}" Excel (.xlsx) formatida yuklandi!`, 'success');
      return;
    }

    // 2. Fallback to SheetJS if ExcelJS is not loaded
    if (!window.XLSX) {
      showToast("Excel kutubxonasi yuklanmoqda, iltimos qayta urinib ko'ring", 'warning');
      return;
    }

    const aoa = [
      [`Клиент: ${custName}`, "", "", `ТП: ${agentName}`, "", ""],
      [`Тел.: ${custPhone}`, "", "", `Тел. ТП:${agentPhone}`, "", ""],
      [`Дата заказа: ${orderDate}`, "", "", `Доставщик: ${driverName}`, "", ""],
      [`ID Клиент:${custId}`, "", "", `ИД заказа:${numericOrderId}`, "", ""],
      ["№", "Код", "ТМЦ", "Кол.", "Цена", "Сумма"]
    ];

    let totalQty = 0;
    let totalSum = 0;

    items.forEach((it, idx) => {
      const rawName = it.productName || it.name || 'Tovar';
      const pName = typeof unescapeHTML === 'function' ? unescapeHTML(rawName) : rawName;
      const matchedProd = products.find(p => p && p.name && p.name.toLowerCase() === rawName.toLowerCase()) || {};
      const sku = it.sku || it.code || matchedProd.sku || matchedProd.code || ('KS' + Math.floor(100000 + ((idx + 1) * 38291) % 899999));
      const qty = Number(it.qty || it.quantity || 1);
      const price = Number(it.price || it.unitPrice || matchedProd.sellPrice || 0);
      const lineTotal = Number(it.total || (qty * price) || 0);

      totalQty += qty;
      totalSum += lineTotal;

      aoa.push([
        idx + 1,
        sku,
        pName,
        qty,
        price,
        lineTotal
      ]);
    });

    if (totalSum === 0 && ord.totalAmount) {
      totalSum = Number(ord.totalAmount);
    }

    const totalRowIndex = aoa.length;
    aoa.push(["", "", "Итог:", totalQty, "", totalSum]);
    aoa.push(["", "", "", "", "", ""]);
    aoa.push([`Qoldiq qarz : ${custDebt ? (typeof custDebt === 'number' ? custDebt.toLocaleString('uz-UZ') : custDebt) : ''}`, "", "", "", "", ""]);
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nakladnaya");

    XLSX.writeFile(workbook, exportFileName);
    showToast(`Yuk xati "${ord.orderNumber || numericOrderId}" Excel (.xlsx) formatida yuklandi!`, 'success');
  } catch (err) {
    console.error("[exportSingleOrderExcel Error]:", err);
    showToast("Excel yuklashda xatolik yuz berdi", 'error');
  }
}

function openInvoiceModal(orderId) {
  const targetId = orderId || (document.getElementById('vOrdActiveId') ? document.getElementById('vOrdActiveId').value : null);
  const orders = (window.demoData && window.demoData.distributionOrders) ? window.demoData.distributionOrders : [];
  const ord = orders.find(o => o.id === targetId || o.orderNumber === targetId) || (window.demoData && window.demoData.recentSales ? window.demoData.recentSales.find(s => s.id === targetId || s.receiptNo === targetId) : null);

  if (!ord) {
    showToast("Buyurtma topilmadi!", 'error');
    return;
  }

  const activeInput = document.getElementById('invoiceActiveOrderId');
  if (activeInput) activeInput.value = ord.id || ord.orderNumber || targetId;

  // Lookup Customer info from demoData.customers
  const customers = (window.demoData && window.demoData.customers) ? window.demoData.customers : [];
  const custName = ord.customerName || ord.customer || '446 TOLIPOV U YTT';
  const custObj = customers.find(c => c.name && c.name.toLowerCase() === custName.toLowerCase()) || {};
  const custPhone = custObj.phone || '998935825533';
  const custId = custObj.id ? String(custObj.id).replace(/[^0-9]/g, '').slice(0, 7) || '4114203' : '4114203';
  const custDebt = custObj.balance || custObj.debt || 0;

  // Lookup Agent info from demoData.users
  const users = (window.demoData && window.demoData.users) ? window.demoData.users : [];
  const agentName = ord.agentName || 'LATIPOV AZAMAT';
  const agentObj = users.find(u => (u.full_name || u.fullName) && (u.full_name || u.fullName).toLowerCase() === agentName.toLowerCase()) || {};
  const agentPhone = agentObj.phone || '998775354713';

  // Driver info
  const driverName = ord.driverName || 'KSD Alisher 86';
  const orderNum = ord.orderNumber || ord.receiptNo || ('ORD-2026-' + Math.floor(1000 + Math.random() * 9000));
  const orderDate = ord.createdAt || ord.date || new Date().toLocaleString('uz-UZ');
  const numericOrderId = String(ord.id || orderNum).replace(/[^0-9]/g, '').slice(-9) || '269452837';

  // Items
  const defaultItems = [
    { productName: "Kerasys HOMME SHAMPOO 550ML (DEEP CLEANSING)", sku: "KS877388", qty: 6, price: 56900, total: 341400 },
    { productName: "Kerasys HOMME SHAMPOO 550ML (SCALP CARE)", sku: "KS877395", qty: 6, price: 56900, total: 341400 },
    { productName: "Kerasys Perfume Shampoo Elegance & Sensual 400ml", sku: "KS313756", qty: 2, price: 42400, total: 84800 },
    { productName: "Kerasys Perfume Shampoo Lovely & Romantic 400ml", sku: "KS313732", qty: 3, price: 42400, total: 127200 },
    { productName: "Kerasys Perfume Shampoo Pure & Charming 400ml", sku: "KS313787", qty: 2, price: 42400, total: 84800 },
    { productName: "Kerasys Perfume Shampoo Glam & Stylish 400ml", sku: "KS426821", qty: 2, price: 42400, total: 84800 },
    { productName: "Kerasys Perfume Shampoo Blooming & Flowery 400ml", sku: "KS426814", qty: 3, price: 42400, total: 127200 },
    { productName: "Perfume Yapaloq Elegance & Sensual Shampoo 600ml", sku: "KS992715", qty: 4, price: 58400, total: 233600 },
    { productName: "Perfume Yapaloq Lovely & Romantic Shampoo 600ml", sku: "KS992708", qty: 6, price: 58400, total: 350400 },
    { productName: "Perfume Yapaloq Pure & Charming Shampoo 600ml", sku: "KS992722", qty: 2, price: 58400, total: 116800 },
    { productName: "Perfume Yapaloq Blooming & Flowery Shampoo 600ml", sku: "KS240557", qty: 6, price: 58400, total: 350400 }
  ];

  const items = (ord.items && ord.items.length > 0) ? ord.items : defaultItems;

  let totalQty = 0;
  let totalSum = 0;

  const tableRowsHtml = items.map((it, idx) => {
    const qty = Number(it.qty || it.quantity || 1);
    const price = Number(it.price || it.unitPrice || 0);
    const lineTotal = Number(it.total || (qty * price) || 0);
    const sku = escapeHTML(it.sku || it.code || ('KS' + Math.floor(100000 + Math.random() * 900000)));
    const prdName = escapeHTML(it.productName || it.name || 'Tovar');

    totalQty += qty;
    totalSum += lineTotal;

    return `
      <tr class="border-b border-slate-300 text-xs">
        <td class="p-1.5 text-center font-mono border-r border-slate-300">${idx + 1}</td>
        <td class="p-1.5 font-mono text-[11px] border-r border-slate-300 whitespace-nowrap">${sku}</td>
        <td class="p-1.5 font-semibold text-slate-900 border-r border-slate-300">${prdName}</td>
        <td class="p-1.5 text-center font-bold border-r border-slate-300">${qty}</td>
        <td class="p-1.5 text-right font-medium border-r border-slate-300">${price > 0 ? price.toLocaleString('uz-UZ') : 0}</td>
        <td class="p-1.5 text-right font-bold">${lineTotal > 0 ? lineTotal.toLocaleString('uz-UZ') : 0}</td>
      </tr>
    `;
  }).join('');

  if (totalSum === 0 && ord.totalAmount) {
    totalSum = Number(ord.totalAmount);
  }

  const sheetContainer = document.getElementById('invoiceSheetContainer');
  if (sheetContainer) {
    sheetContainer.innerHTML = `
      <!-- Header Grid Blueprint matching User Screenshot -->
      <div class="border border-slate-400 divide-y divide-slate-300 text-xs font-sans">
        <div class="grid grid-cols-2 divide-x divide-slate-300 p-2.5 bg-slate-50/50">
          <div class="space-y-1 pr-2">
            <p class="font-black text-slate-900 text-sm">Клиент: <span class="font-bold">${escapeHTML(custName)}</span></p>
            <p class="text-slate-700">Тел.: <span class="font-mono font-bold">${escapeHTML(custPhone)}</span></p>
            <p class="text-slate-700">Дата заказа: <span class="font-mono font-semibold">${escapeHTML(orderDate)}</span></p>
            <p class="text-slate-700">ID Клиент: <span class="font-mono font-bold">${escapeHTML(custId)}</span></p>
          </div>
          <div class="space-y-1 pl-2">
            <p class="font-black text-slate-900 text-sm">ТП: <span class="font-bold">${escapeHTML(agentName)}</span></p>
            <p class="text-slate-700">Тел. ТП: <span class="font-mono font-bold">${escapeHTML(agentPhone)}</span></p>
            <p class="text-slate-700">Доставщик: <span class="font-bold">${escapeHTML(driverName)}</span></p>
            <p class="text-slate-700">ИД заказа: <span class="font-mono font-bold">${escapeHTML(numericOrderId)}</span></p>
          </div>
        </div>

        <!-- Products Items Table -->
        <div>
          <table class="w-full border-collapse text-xs">
            <thead class="bg-slate-200 text-slate-900 font-extrabold uppercase text-[11px]">
              <tr class="border-b border-slate-400">
                <th class="p-1.5 text-center border-r border-slate-300 w-8">№</th>
                <th class="p-1.5 text-left border-r border-slate-300 w-24">Код</th>
                <th class="p-1.5 text-left border-r border-slate-300">ТМЦ</th>
                <th class="p-1.5 text-center border-r border-slate-300 w-16">Кол.</th>
                <th class="p-1.5 text-right border-r border-slate-300 w-24">Цена</th>
                <th class="p-1.5 text-right w-28">Сумма</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-300">
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Totals & Summary Block -->
        <div class="p-2.5 bg-slate-100/80 font-bold text-xs space-y-2">
          <div class="flex items-center justify-between text-sm pt-1">
            <span class="font-black">Итог:</span>
            <div class="flex items-center gap-8">
              <span>${totalQty} dona</span>
              <span class="text-base font-black text-slate-900 font-mono">${totalSum.toLocaleString('uz-UZ')} UZS</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-700 border-t border-slate-300 pt-1.5">
            <span>Qoldiq qarz :</span>
            <span class="font-mono font-bold ${custDebt > 0 ? 'text-rose-600' : 'text-slate-800'}">${custDebt > 0 ? custDebt.toLocaleString('uz-UZ') + ' UZS' : '0 UZS'}</span>
          </div>
        </div>
      </div>

      <!-- Signature Footer Block -->
      <div class="pt-6 flex items-center justify-between text-xs font-bold text-slate-800">
        <div>
          <span>Topshirdi (Agent / Kuryer): ___________________</span>
        </div>
        <div>
          <span>Принял (Mijoz imzosi): ___________________</span>
        </div>
      </div>
    `;
  }

  openModal('invoiceModal');
}

function printSingleOrderInvoice(orderId) {
  const targetId = orderId || (document.getElementById('invoiceActiveOrderId') ? document.getElementById('invoiceActiveOrderId').value : null);
  openInvoiceModal(targetId);

  setTimeout(() => {
    const container = document.getElementById('invoiceSheetContainer');
    if (!container) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast("Chop etish darchasini ochishga ruxsat bering (Popup blocker)", 'warning');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Yuk Xati - SmartOmbor ERP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print {
            body { margin: 0; padding: 10mm; font-family: sans-serif; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body class="p-6 bg-white text-slate-900">
        ${container.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 400);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }, 200);
}

window.handleModalAvatarUpload = handleModalAvatarUpload;
window.openCreateEmployeeModal = openCreateEmployeeModal;
window.handleSaveEmployee = handleSaveEmployee;
window.openEditProfileModal = openEditProfileModal;
window.handleSaveSelfProfile = handleSaveSelfProfile;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openCreateDistributionModal = openCreateDistributionModal;
window.handleSaveDistributionOrder = handleSaveDistributionOrder;
window.addDistItemRow = addDistItemRow;
window.removeDistItemRow = removeDistItemRow;
window.onDistItemProductChange = onDistItemProductChange;
window.calculateDistTotal = calculateDistTotal;
window.getDistProductOptionsHtml = getDistProductOptionsHtml;
window.openViewOrderModal = openViewOrderModal;
window.openInvoiceModal = openInvoiceModal;
window.printSingleOrderInvoice = printSingleOrderInvoice;
window.exportSingleOrderPDF = exportSingleOrderPDF;
window.exportSingleOrderExcel = exportSingleOrderExcel;


