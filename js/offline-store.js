/**
 * SmartOmbor ERP — Offline-First & Automatic Sync Queue Manager
 * Powered by IndexedDB (SmartOmborDB) and Supabase REST Synchronization
 */

(function () {
  'use strict';

  const DB_NAME = 'SmartOmborDB';
  const DB_VERSION = 1;
  const CACHE_STORE = 'cache_store';
  const SYNC_QUEUE_STORE = 'sync_queue';

  let dbPromise = null;
  let isSyncing = false;

  /**
   * Open IndexedDB Database connection
   */
  function getDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn("[offlineStore] IndexedDB ushbu brauzerda qo'llab-quvvatlanmaydi.");
        resolve(null);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = function (e) {
        resolve(e.target.result);
      };

      request.onerror = function (e) {
        console.error("[offlineStore] IndexedDB ochishda xatolik:", e.target.error);
        resolve(null);
      };
    });

    return dbPromise;
  }

  const offlineStore = {
    /**
     * Initialize DB & Network listeners
     */
    async init() {
      await getDB();
      this.updateNetworkStatusUI();

      window.addEventListener('online', () => {
        console.log("[offlineStore] Internet ulandi! Sinxronizatsiya boshlanmoqda...");
        this.updateNetworkStatusUI();
        this.flushSyncQueue();
      });

      window.addEventListener('offline', () => {
        console.warn("[offlineStore] Internet uzildi! Oflayn rejimga o'tildi.");
        this.updateNetworkStatusUI();
      });

      // Periodic queue check every 30 seconds if online
      setInterval(() => {
        if (navigator.onLine && !isSyncing) {
          this.flushSyncQueue();
        }
      }, 30000);

      // Initial flush attempt if online
      if (navigator.onLine) {
        setTimeout(() => this.flushSyncQueue(), 2000);
      }
    },

    /**
     * Cache data in IndexedDB
     */
    async cacheData(key, data) {
      try {
        const db = await getDB();
        if (!db) return false;
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        store.put({ key, data, updatedAt: Date.now() });
        return true;
      } catch (err) {
        console.error(`[offlineStore] Cache save error (${key}):`, err);
        return false;
      }
    },

    /**
     * Retrieve cached data from IndexedDB
     */
    async getCachedData(key) {
      try {
        const db = await getDB();
        if (!db) return null;
        return new Promise((resolve) => {
          const tx = db.transaction(CACHE_STORE, 'readonly');
          const store = tx.objectStore(CACHE_STORE);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        });
      } catch (err) {
        console.error(`[offlineStore] Cache read error (${key}):`, err);
        return null;
      }
    },

    /**
     * Enqueue mutation when offline or network fails
     */
    async enqueueMutation(actionType, payload) {
      try {
        const db = await getDB();
        if (!db) return false;

        const queueItem = {
          actionType,
          payload,
          createdAt: new Date().toISOString(),
          status: 'pending'
        };

        const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(SYNC_QUEUE_STORE);
        store.add(queueItem);

        console.log(`[offlineStore] Sync Queue ga saqlandi (${actionType}):`, payload);
        this.updateNetworkStatusUI();
        return true;
      } catch (err) {
        console.error("[offlineStore] Enqueue error:", err);
        return false;
      }
    },

    /**
     * Get all pending items in sync queue
     */
    async getQueue() {
      try {
        const db = await getDB();
        if (!db) return [];
        return new Promise((resolve) => {
          const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
          const store = tx.objectStore(SYNC_QUEUE_STORE);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      } catch (err) {
        return [];
      }
    },

    /**
     * Get count of pending items in queue
     */
    async getQueueCount() {
      const list = await this.getQueue();
      return list.length;
    },

    /**
     * Remove item from queue by ID
     */
    async removeQueueItem(id) {
      try {
        const db = await getDB();
        if (!db) return false;
        const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(SYNC_QUEUE_STORE);
        store.delete(id);
        return true;
      } catch (err) {
        return false;
      }
    },

    /**
     * Flush queue to Supabase
     */
    async flushSyncQueue() {
      if (isSyncing || !navigator.onLine) return;

      const queue = await this.getQueue();
      if (queue.length === 0) {
        this.updateNetworkStatusUI();
        return;
      }

      isSyncing = true;
      this.updateNetworkStatusUI(true);

      console.log(`[offlineStore] Sync Queue yuborilmoqda (${queue.length} ta)...`);

      let processedCount = 0;
      for (const item of queue) {
        try {
          let success = false;
          const { actionType, payload } = item;

          if (actionType === 'create_product' && window.productService) {
            // Ensure unique SKU for sync - clone payload to avoid mutation
            const dataToSend = { ...payload };
            if (!dataToSend.sku) dataToSend.sku = 'PRD-' + Math.floor(100000 + Math.random() * 900000);
            const res = await window.productService.create(dataToSend, true);
            success = res.success || (res.error && res.error.code === '23505');
          } else if (actionType === 'update_product' && window.productService) {
            const res = await window.productService.update(payload.id, payload, true);
            success = res.success;
          } else if (actionType === 'create_customer' && window.customerService) {
            const res = await window.customerService.create(payload, true);
            success = res.success || (res.error && res.error.code === '23505');
          } else if (actionType === 'update_customer' && window.customerService) {
            const res = await window.customerService.update(payload.id, payload.data, true);
            success = res.success;
          } else if (actionType === 'create_distribution_order' && window.distributionService) {
            const res = await window.distributionService.create(payload, true);
            success = res.success;
          } else if (actionType === 'update_order_status' && window.distributionService) {
            const res = await window.distributionService.updateStatus(payload.id, payload.status, true);
            success = res.success;
          } else if (actionType === 'assign_driver' && window.distributionService) {
            const res = await window.distributionService.assignDriver(payload.id, payload.driverName, true);
            success = res.success;
          } else if (actionType === 'create_return' && window.returnService) {
            const res = await window.returnService.create(payload, true);
            success = res.success;
          } else if (actionType === 'create_sale' && window.salesService) {
            const res = await window.salesService.create(payload, true);
            success = res.success;
          } else if (actionType === 'create_cash_tx' && window.cashService) {
            const res = await window.cashService.createTransaction(payload, true);
            success = res.success;
          } else if (actionType === 'create_purchase' && window.purchaseService) {
            const res = await window.purchaseService.create(payload, true);
            success = res.success;
          } else {
            success = true;
          }

          if (success) {
            await this.removeQueueItem(item.id);
            processedCount++;
            console.log(`[offlineStore] Queue item #${item.id} (${actionType}) sinxronlandi va o'chirildi.`);
          }
        } catch (err) {
          console.error(`[offlineStore] Sync error for item #${item.id}:`, err);
        }
      }

      isSyncing = false;

      // Re-fetch all fresh products from Supabase to sync full state
      if (processedCount > 0 && window.productService) {
        try {
          await window.productService.getAll();
        } catch (e) {
          console.warn("Post-sync fetch notice:", e);
        }
      }

      this.updateNetworkStatusUI();

      if (processedCount > 0 && window.showToast) {
        window.showToast(`${processedCount} ta oflayn amal Supabase bilan sinxronlandi!`, "success");
      }

      if (typeof window.renderCurrentView === 'function') {
        window.renderCurrentView();
      }
    },

    /**
     * Update Header Network Status Badge UI
     */
    async updateNetworkStatusUI(syncing = false) {
      const container = document.getElementById('networkStatusBadge');
      if (!container) return;

      const queueCount = await this.getQueueCount();
      const isOnline = navigator.onLine;

      if (syncing || isSyncing) {
        container.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold transition-all';
        container.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>Sinxronlanmoqda...</span>
          ${queueCount > 0 ? `<span class="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold">${queueCount}</span>` : ''}
        `;
      } else if (!isOnline) {
        container.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold transition-all';
        container.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Oflayn rejim</span>
          ${queueCount > 0 ? `<button onclick="window.offlineStore.flushSyncQueue()" class="px-1.5 py-0.5 rounded bg-rose-200 hover:bg-rose-300 text-rose-900 text-[10px] font-extrabold cursor-pointer">⚡ ${queueCount} ta kutilmoqda</button>` : ''}
        `;
      } else {
        if (queueCount > 0) {
          container.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold transition-all';
          container.innerHTML = `<button onclick="window.offlineStore.flushSyncQueue()" class="px-1.5 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-extrabold cursor-pointer animate-bounce">⚡ ${queueCount} ta sinxronlash</button>`;
        } else {
          container.className = 'hidden';
          container.innerHTML = '';
        }
      }
    }
  };

  // Export module globally
  window.offlineStore = offlineStore;

  document.addEventListener('DOMContentLoaded', () => {
    offlineStore.init();
  });
})();
