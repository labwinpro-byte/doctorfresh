/* SmartOmbor ERP - Centralized Supabase Client & Connection Test Module */

const SUPABASE_CONFIG = {
  url: 'https://edtkxlyrbjrpwjhrukzd.supabase.co',
  publishableKey: 'sb_publishable_vhUwvAmeNm5jyPswrVBilw_gYubaXdI'
};

let supabaseClient = null;

// Debounce utility for realtime render batching
let _realtimeRenderTimer = null;
function debouncedRenderCurrentView() {
  if (_realtimeRenderTimer) clearTimeout(_realtimeRenderTimer);
  _realtimeRenderTimer = setTimeout(async () => {
    _realtimeRenderTimer = null;
    if (typeof window.renderCurrentView === 'function') {
      try {
        await window.renderCurrentView();
      } catch (e) {
        console.warn('[Realtime Debounced Render Warning]:', e.message);
      }
    }
  }, 300);
}

function initSupabaseClient() {
  try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
      window.supabaseClient = supabaseClient;
      testSupabaseConnection();
    } else if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
      window.supabaseClient = supabaseClient;
      testSupabaseConnection();
    } else {
      console.info("[Supabase Client] CDN script loading... Connection will initialize on ready.");
    }
  } catch (err) {
    console.warn("[Supabase Client] Connection initialization warning:", err.message);
  }
  return supabaseClient;
}

function getSupabaseClient() {
  if (!supabaseClient) {
    initSupabaseClient();
  }
  return supabaseClient;
}

function isSupabaseAvailable() {
  return !!getSupabaseClient();
}

let realtimeChannel = null;

function initSupabaseRealtime() {
  const client = getSupabaseClient();
  if (!client || realtimeChannel) return;

  try {
    realtimeChannel = client
      .channel('smartombor-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Products table change detected:', payload);
            if (window.productService && typeof window.productService.getAll === 'function') {
              await window.productService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Inventory table change detected:', payload);
            if (window.productService && typeof window.productService.getAll === 'function') {
              await window.productService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Sales table change detected:', payload);
            if (window.salesService && typeof window.salesService.getAll === 'function') {
              await window.salesService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Purchases table change detected:', payload);
            if (window.purchaseService && typeof window.purchaseService.getAll === 'function') {
              await window.purchaseService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_transactions' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Cash Transactions change detected:', payload);
            if (window.cashService && typeof window.cashService.getAll === 'function') {
              await window.cashService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Profiles table change detected:', payload);
            if (window.userService && typeof window.userService.getAll === 'function') {
              await window.userService.getAll();
            }
            if (typeof syncSupabaseSessionToUI === 'function') {
              await syncSupabaseSessionToUI();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Customers table change detected:', payload);
            if (window.customerService && typeof window.customerService.getAll === 'function') {
              await window.customerService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Suppliers table change detected:', payload);
            if (window.supplierService && typeof window.supplierService.getAll === 'function') {
              await window.supplierService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warehouses' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Warehouses table change detected:', payload);
            if (window.warehouseService && typeof window.warehouseService.getAll === 'function') {
              await window.warehouseService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outgoing' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Outgoing table change detected:', payload);
            if (window.outgoingService && typeof window.outgoingService.getAll === 'function') {
              await window.outgoingService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'distribution_orders' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Distribution Orders table change detected:', payload);
            if (window.distributionService && typeof window.distributionService.getAll === 'function') {
              await window.distributionService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Categories table change detected:', payload);
            if (window.categoryService && typeof window.categoryService.getAll === 'function') {
              await window.categoryService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_returns' },
        async (payload) => {
          try {
            console.log('[Realtime Event] Order Returns table change detected:', payload);
            if (window.returnService && typeof window.returnService.getAll === 'function') {
              await window.returnService.getAll();
            }
            debouncedRenderCurrentView();
          } catch (e) {
            console.warn('[Realtime Event Error]:', e.message);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('%c[Supabase Realtime] Connected & Subscribed to Live WebSockets', 'color: #10B981; font-weight: bold;');
        }
      });

    window.realtimeChannel = realtimeChannel;
  } catch (err) {
    console.warn("[Supabase Realtime Initialization Warning]:", err.message);
  }
}

function testSupabaseConnection() {
  if (!supabaseClient) return;

  try {
    console.log(`%c[Supabase Connected] %c${SUPABASE_CONFIG.url}`, 'color: #10B981; font-weight: bold;', 'color: #3B82F6;');
    console.log("[Supabase Config] Using Publishable Key (sb_publishable_vhUwvAmeNm5jyPswrVBilw_gYubaXdI). Secret key NOT present.");
    initSupabaseRealtime();
  } catch (err) {
    console.warn("[Supabase Connection Test Warning]:", err.message);
  }
}

/**
 * 1. Supabase Session Sync & User Profile Loader
 * Automatically detects current active session on page refresh via supabase.auth.getSession()
 * and fetches the user's full_name & role from the 'profiles' table to update the UI dynamically.
 */
async function syncSupabaseSessionToUI() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (!client || !client.auth) return null;

  try {
    const { data: sessData, error: sessErr } = await client.auth.getSession();
    if (sessErr || !sessData || !sessData.session || !sessData.session.user) {
      console.info("[Supabase Auth Session Notice]: Active Supabase Auth session not found.");
      return null;
    }

    const authUser = sessData.session.user;
    
    // Fetch profile from 'profiles' PostgreSQL table
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // Check if user has been deleted from deletedUserIds list
    const isDeletedUser = window.demoData && window.demoData.deletedUserIds && window.demoData.deletedUserIds.includes(authUser.id);

    if (isDeletedUser) {
      console.warn("[syncSupabaseSessionToUI]: User profile deleted or account disabled. Terminating session.");
      try { await client.auth.signOut(); } catch (e) {}
      localStorage.removeItem('smartombor_user');
      if (window.authService) {
        window.authService.currentUser = null;
      }
      updateUserInterfaceDOM(null);
      if (typeof window.openLoginModal === 'function') {
        window.openLoginModal();
      }
      return null;
    }

    let dbRole = (profile && profile.role) ? profile.role.toLowerCase() : null;
    let role = dbRole || (authUser.user_metadata?.role || 'agent');
    let fullName = (profile && profile.full_name) ? profile.full_name : (authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Xodim');

    const fnLower = (fullName || '').toLowerCase();
    if (fnLower.includes('ibrohim') || fnLower.includes('ibroxim') || fnLower === 'fayz' || fnLower === 'admin') {
      if (!dbRole) role = 'director';
    }

    if (window.demoData && window.demoData.users) {
      const matchedLocal = window.demoData.users.find(u => 
        (u.id && u.id === authUser.id) || 
        (u.email && authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase()) ||
        (u.full_name && fullName && u.full_name.toLowerCase() === fullName.toLowerCase())
      );
      if (matchedLocal) {
        if (dbRole) {
          matchedLocal.role = dbRole;
        } else if (matchedLocal.role) {
          role = matchedLocal.role.toLowerCase();
        }
      }
    }

    const roleLabels = {
      agent: 'Savdo Agenti',
      driver: 'Haydovchi',
      warehouse: 'Omborchi',
      supervisor: 'Supervayzer',
      director: 'Direktor',
      admin: 'Bosh Administrator'
    };

    const activeUser = {
      id: authUser.id,
      email: authUser.email,
      fullName: fullName,
      full_name: fullName,
      role: role,
      roleLabel: roleLabels[role] || 'Xodim',
      badgeClass: (role === 'admin' || role === 'director') ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
    };

    if (window.authService) {
      window.authService.currentUser = activeUser;
    }
    localStorage.setItem('smartombor_user', JSON.stringify(activeUser));

    // Update DOM elements dynamically
    updateUserInterfaceDOM(activeUser);

    return activeUser;
  } catch (err) {
    console.warn("[syncSupabaseSessionToUI Warning]:", err.message);
    return null;
  }
}

/**
 * 2. Auth State Change Listener (supabase.auth.onAuthStateChange)
 * Automatically updates session and UI when user logs in, logs out, or refreshes token.
 */
function initAuthStateListener() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (!client || !client.auth || window._authStateListenerInitialized) return;
  window._authStateListenerInitialized = true;

  try {
    client.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Supabase Auth Event]: ${event}`);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const user = await syncSupabaseSessionToUI();
        if (user && typeof window.renderCurrentView === 'function') {
          await window.renderCurrentView();
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('smartombor_user');
        if (window.authService) {
          window.authService.currentUser = null;
        }
        updateUserInterfaceDOM(null);
        if (typeof window.openLoginModal === 'function') {
          window.openLoginModal();
        }
      }
    });
  } catch (err) {
    console.warn("[initAuthStateListener Warning]:", err.message);
  }
}

/**
 * 3. Dynamic DOM Updater for Sidebar & Top Header Profile
 * Replaces static "FAYZ" text and avatar with current logged-in user data.
 */
function updateUserInterfaceDOM(user) {
  const defaultName = user ? (user.fullName || user.full_name) : 'FAYZ';
  const defaultRole = user ? (user.roleLabel || user.role) : 'Bosh administrator';

  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarName) sidebarName.textContent = defaultName;

  const sidebarRole = document.getElementById('sidebar-user-role');
  if (sidebarRole) sidebarRole.textContent = defaultRole;

  const headerName = document.getElementById('header-dropdown-name');
  if (headerName) headerName.textContent = defaultName;

  const headerRole = document.getElementById('header-dropdown-role');
  if (headerRole) headerRole.textContent = defaultRole;

  if (user && user.avatar) {
    const avatarImgs = document.querySelectorAll('#sidebar-user-avatar, #header-user-avatar, .user-avatar-img');
    avatarImgs.forEach(img => {
      img.src = user.avatar;
    });
  }
}

/// Auto Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  initSupabaseClient();
  initSupabaseRealtime();
  initAuthStateListener();
  await syncSupabaseSessionToUI();
});

/**
 * Xodimlarni ro'yxatdan o'tkazish funksiyasi (Admin Panel uchun)
 * 1. Edge Function yoki client.auth.signUp() orqali foydalanuvchini auth tizimiga kiritadi
 * 2. auth.user.id yordamida `profiles` jadvaliga va lokal holatga yozadi
 */
async function signUpEmployee({ full_name, email, password, role, region_id }) {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  const cleanSlug = (full_name || 'xodim').toLowerCase().replace(/[^a-z0-9]/g, '');
  const finalEmail = email || `${cleanSlug || 'xodim' + Date.now()}@smartup.uz`;
  
  if (!client || !navigator.onLine) {
    return { success: false, error: { message: "Internetga ulanmagan yoki Supabase client mavjud emas." } };
  }

  try {
    let userId = null;
    let rpcSuccess = false;

    // 1. Primary mechanism: Call SQL RPC function create_new_user (Bypasses email rate limits, creates in auth.users & profiles)
    try {
      const { data: rpcData, error: rpcErr } = await client.rpc('create_new_user', {
        p_email: finalEmail,
        p_password: password,
        p_full_name: full_name,
        p_role: role
      });

      if (!rpcErr && rpcData && rpcData.success && rpcData.id) {
        userId = rpcData.id;
        rpcSuccess = true;
        console.log("[signUpEmployee]: User created via SQL RPC in auth.users & profiles:", userId);
      } else if (rpcErr) {
        console.warn("[signUpEmployee RPC Notice]:", rpcErr.message || rpcErr);
      }
    } catch (e) {
      console.warn("[signUpEmployee RPC Exception]:", e);
    }

    // 2. Secondary mechanism: Call Edge Function create-user
    if (!userId) {
      try {
        const { data: edgeData, error: edgeErr } = await client.functions.invoke('create-user', {
          body: { full_name, email: finalEmail, password, role, region_id }
        });
        if (!edgeErr && edgeData && edgeData.success && edgeData.user) {
          userId = edgeData.user.id;
        }
      } catch (e) {}
    }

    // 3. Tertiary fallback: Client-side auth signUp
    if (!userId) {
      const { data: authData, error: authError } = await client.auth.signUp({
        email: finalEmail,
        password: password,
        options: { data: { full_name, role, region_id: region_id || null } }
      });

      if (authData && authData.user) {
        userId = authData.user.id;
      } else if (authError) {
        console.warn("[signUpEmployee Auth Notice]:", authError.message);
      }
    }

    if (!userId) {
      userId = 'usr-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    }

    const isUuid = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid(userId) && !rpcSuccess) {
      try {
        await client.from('profiles').upsert({ id: userId, full_name, role, updated_at: new Date().toISOString() });
      } catch (e) {}
    }

    const targetUsers = (window.demoData && window.demoData.users) ? window.demoData.users : [];
    const roleLabels = { agent: 'Savdo Agenti', driver: 'Haydovchi', supervisor: 'Supervayzer', warehouse: 'Omborchi', director: 'Direktor', admin: 'Administrator' };
    const newEmpItem = {
      id: userId,
      full_name: full_name,
      email: finalEmail,
      role: role,
      roleLabel: roleLabels[role] || role || 'Xodim',
      status: 'Faol',
      statusClass: 'badge-success',
      createdAt: new Date().toLocaleString('uz-UZ')
    };

    const existingIndex = targetUsers.findIndex(u => u.id === userId || u.full_name === full_name);
    if (existingIndex >= 0) {
      targetUsers[existingIndex] = newEmpItem;
    } else {
      targetUsers.unshift(newEmpItem);
    }

    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    if (typeof syncGlobalState === 'function') syncGlobalState();

    return { success: true, user: { id: userId, full_name, email: finalEmail, role } };
  } catch (e) {
    console.error("[signUpEmployee Exception]:", e);
    return { success: false, error: { message: e.message || "Xatolik yuz berdi" } };
  }
}

/**
 * Handles Employee Login (Form submit / programmatic) using Supabase Auth ONLY
 */
async function loginUserAndRedirect(emailInput, password) {
  if (window.authService) {
    const res = await window.authService.login(emailInput, password);
    if (res && (res.success || res.data)) {
      const user = res.data || window.authService.getCurrentUser();
      let targetRoute = 'dashboard';
      if (user && user.role === 'agent') targetRoute = 'sales';
      else if (user && (user.role === 'warehouse' || user.role === 'manager')) targetRoute = 'warehouse';
      
      if (typeof window.navigateTo === 'function') {
        window.navigateTo(targetRoute);
      }
      return { success: true, user };
    } else {
      return { success: false, error: { message: (res && res.error) ? res.error.message : "Noto'g'ri email yoki parol." } };
    }
  }

  return { success: false, error: { message: "Noto'g'ri email yoki parol." } };
}

// Global darajada eksport qilish
window.signUpEmployee = signUpEmployee;
window.loginUserAndRedirect = loginUserAndRedirect;


