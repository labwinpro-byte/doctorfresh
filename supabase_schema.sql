-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- SmartOmbor ERP - Complete Supabase PostgreSQL Schema Script
-- Includes Products, Categories, Warehouses, Inventory, Distribution Orders, Order Items & Returns (Vozvrat)

-- ==================== 1. ENUM TYPES ====================
DO $$ BEGIN
    CREATE TYPE public.order_status_enum AS ENUM ('yangi', 'yigildi', 'yetkazilmoqda', 'yetkazildi', 'bekor_qilindi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.return_reason_enum AS ENUM ('muddati_otgan', 'nuqsonli', 'ortiqcha_tovar', 'boshqa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==================== 2. AUTOMATIC UPDATED_AT TRIGGER FUNCTION ====================
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== 3. BASE TABLES (If not exist) ====================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    unit TEXT DEFAULT 'dona',
    purchase_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    price_retail NUMERIC DEFAULT 0,
    price_wholesale NUMERIC DEFAULT 0,
    price_vip NUMERIC DEFAULT 0,
    minimum_stock INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration Statements for Existing Database Tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_retail NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_wholesale NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_vip NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    price_type TEXT DEFAULT 'retail',
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    balance NUMERIC(15, 2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    purchases_count INTEGER DEFAULT 0,
    total_purchases NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'retail';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS purchases_count INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(15, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    contact_person TEXT,
    products_supplied TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outgoing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_no TEXT NOT NULL UNIQUE,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    warehouse_name TEXT,
    product_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    recipient_name TEXT,
    reason TEXT,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Bajarildi',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outgoing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outgoing_id UUID NOT NULL REFERENCES public.outgoing(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_product_warehouse_unique UNIQUE (product_id, warehouse_id)
);

-- ==================== 4. DISTRIBUTION & RETURNS TABLES ====================
CREATE TABLE IF NOT EXISTS public.distribution_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    customer_id UUID,
    customer_name TEXT,
    agent_id UUID,
    agent_name TEXT,
    driver_id UUID,
    driver_name TEXT,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    status public.order_status_enum NOT NULL DEFAULT 'yangi',
    total_amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    delivery_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.distribution_orders ADD CONSTRAINT fk_dist_orders_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.distribution_orders ADD CONSTRAINT fk_dist_orders_agent FOREIGN KEY (agent_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.distribution_orders ADD CONSTRAINT fk_dist_orders_driver FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.distribution_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.distribution_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    customer_id UUID,
    customer_name TEXT,
    order_id UUID REFERENCES public.distribution_orders(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    refund_amount NUMERIC NOT NULL DEFAULT 0,
    reason public.return_reason_enum NOT NULL DEFAULT 'nuqsonli',
    status TEXT NOT NULL DEFAULT 'qabul_qilindi',
    driver_id UUID,
    driver_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.order_returns ADD CONSTRAINT fk_returns_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.order_returns ADD CONSTRAINT fk_returns_driver FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== 5. INDEXES FOR PERFORMANCE ====================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dist_orders_status ON public.distribution_orders(status);
CREATE INDEX IF NOT EXISTS idx_dist_orders_warehouse ON public.distribution_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dist_items_order ON public.distribution_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_dist_items_product ON public.distribution_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_returns_order ON public.order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_product ON public.order_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_dist_orders_customer ON public.distribution_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_dist_orders_agent ON public.distribution_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_dist_orders_driver ON public.distribution_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON public.order_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_driver ON public.order_returns(driver_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- ==================== 6. TRIGGERS ====================
DROP TRIGGER IF EXISTS tr_products_updated_at ON public.products;
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER tr_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_inventory_updated_at ON public.inventory;
CREATE TRIGGER tr_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_dist_orders_updated_at ON public.distribution_orders;
CREATE TRIGGER tr_dist_orders_updated_at BEFORE UPDATE ON public.distribution_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_customers_updated_at ON public.customers;
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER tr_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_outgoing_updated_at ON public.outgoing;
CREATE TRIGGER tr_outgoing_updated_at BEFORE UPDATE ON public.outgoing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

-- ==================== 7. ROW LEVEL SECURITY (RLS) POLICIES & RBAC ====================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

-- ==================== 8. USER PROFILES & ROLE BASED ACCESS CONTROL (RBAC) ====================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'agent', -- 'admin', 'director', 'manager', 'supervisor', 'agent', 'warehouse', 'cashier', 'driver'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Migration Statement: Ensure Foreign Key from profiles.id to auth.users(id) with ON DELETE CASCADE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
    
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RPC Function to create new user in auth.users and public.profiles (Bypasses email rate limits)
CREATE OR REPLACE FUNCTION public.create_new_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID := gen_random_uuid();
    encrypted_pw TEXT;
    caller_role TEXT;
BEGIN
    -- Authorization: Only admin or director can create users
    SELECT public.get_user_role(auth.uid()) INTO caller_role;
    IF caller_role IS NULL OR caller_role NOT IN ('admin', 'director') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sizda foydalanuvchi yaratish huquqi yo''q. Faqat admin yoki direktor yaratishi mumkin.');
    END IF;

    -- Encrypt password using pgcrypto
    encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insert into auth.users directly
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        aud,
        role,
        created_at,
        updated_at
    ) VALUES (
        new_id,
        '00000000-0000-0000-0000-000000000000',
        LOWER(p_email),
        encrypted_pw,
        NOW(),
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (new_id, p_full_name, p_role, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    RETURN jsonb_build_object('success', true, 'id', new_id, 'email', p_email, 'full_name', p_full_name, 'role', p_role);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Trigger for Automatic Profile Creation on Supabase Auth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security Definer helper function to get current user's role without causing RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = user_uuid;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------
-- A. PROFILES TABLE POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Allow public full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can insert profiles" ON public.profiles;

CREATE POLICY "Allow public full access on profiles" ON public.profiles
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------
-- B. PRODUCTS & CATEGORIES POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "RBAC select on products" ON public.products;
DROP POLICY IF EXISTS "RBAC insert on products" ON public.products;
DROP POLICY IF EXISTS "RBAC update on products" ON public.products;
DROP POLICY IF EXISTS "RBAC delete on products" ON public.products;

CREATE POLICY "Allow full access on products" ON public.products
    FOR ALL USING (true) WITH CHECK (true);

-- Categories policies
DROP POLICY IF EXISTS "RBAC select on categories" ON public.categories;
DROP POLICY IF EXISTS "RBAC insert on categories" ON public.categories;
DROP POLICY IF EXISTS "RBAC update on categories" ON public.categories;
DROP POLICY IF EXISTS "RBAC delete on categories" ON public.categories;

CREATE POLICY "Allow full access on categories" ON public.categories
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------
-- C. WAREHOUSES & INVENTORY POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "RBAC select on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "RBAC insert on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "RBAC update on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "RBAC delete on warehouses" ON public.warehouses;

CREATE POLICY "Allow full access on warehouses" ON public.warehouses
    FOR ALL USING (true) WITH CHECK (true);

-- Inventory policies
DROP POLICY IF EXISTS "RBAC select on inventory" ON public.inventory;
DROP POLICY IF EXISTS "RBAC insert on inventory" ON public.inventory;
DROP POLICY IF EXISTS "RBAC update on inventory" ON public.inventory;
DROP POLICY IF EXISTS "RBAC delete on inventory" ON public.inventory;

CREATE POLICY "Allow full access on inventory" ON public.inventory
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------
-- D. CUSTOMERS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "RBAC select on customers" ON public.customers;
DROP POLICY IF EXISTS "RBAC insert on customers" ON public.customers;
DROP POLICY IF EXISTS "RBAC update on customers" ON public.customers;
DROP POLICY IF EXISTS "RBAC delete on customers" ON public.customers;

CREATE POLICY "Allow full access on customers" ON public.customers
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------
-- E. DISTRIBUTION ORDERS, ITEMS & RETURNS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "RBAC select on distribution_orders" ON public.distribution_orders;
DROP POLICY IF EXISTS "RBAC insert on distribution_orders" ON public.distribution_orders;
DROP POLICY IF EXISTS "RBAC update on distribution_orders" ON public.distribution_orders;
DROP POLICY IF EXISTS "RBAC delete on distribution_orders" ON public.distribution_orders;

CREATE POLICY "Allow full access on distribution_orders" ON public.distribution_orders
    FOR ALL USING (true) WITH CHECK (true);

-- Items
DROP POLICY IF EXISTS "RBAC select on distribution_order_items" ON public.distribution_order_items;
DROP POLICY IF EXISTS "RBAC insert on distribution_order_items" ON public.distribution_order_items;
DROP POLICY IF EXISTS "RBAC update on distribution_order_items" ON public.distribution_order_items;
DROP POLICY IF EXISTS "RBAC delete on distribution_order_items" ON public.distribution_order_items;

CREATE POLICY "Allow full access on distribution_order_items" ON public.distribution_order_items
    FOR ALL USING (true) WITH CHECK (true);

-- Returns
DROP POLICY IF EXISTS "RBAC select on order_returns" ON public.order_returns;
DROP POLICY IF EXISTS "RBAC insert on order_returns" ON public.order_returns;
DROP POLICY IF EXISTS "RBAC update on order_returns" ON public.order_returns;
DROP POLICY IF EXISTS "RBAC delete on order_returns" ON public.order_returns;

CREATE POLICY "Allow full access on order_returns" ON public.order_returns
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------
-- F. SALES, PURCHASES, CASH & OUTGOING POLICIES
-- ----------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RBAC select on sales" ON public.sales;
DROP POLICY IF EXISTS "RBAC insert on sales" ON public.sales;
DROP POLICY IF EXISTS "RBAC update on sales" ON public.sales;
DROP POLICY IF EXISTS "RBAC delete on sales" ON public.sales;
CREATE POLICY "Allow full access on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "RBAC select on sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "RBAC insert on sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "RBAC update on sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "RBAC delete on sale_items" ON public.sale_items;
CREATE POLICY "Allow full access on sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "RBAC select on purchases" ON public.purchases;
DROP POLICY IF EXISTS "RBAC insert on purchases" ON public.purchases;
DROP POLICY IF EXISTS "RBAC update on purchases" ON public.purchases;
DROP POLICY IF EXISTS "RBAC delete on purchases" ON public.purchases;
CREATE POLICY "Allow full access on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "RBAC select on purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "RBAC insert on purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "RBAC update on purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "RBAC delete on purchase_items" ON public.purchase_items;
CREATE POLICY "Allow full access on purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "RBAC select on cash_transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "RBAC insert on cash_transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "RBAC update on cash_transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "RBAC delete on cash_transactions" ON public.cash_transactions;
CREATE POLICY "Allow full access on cash_transactions" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RBAC select on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "RBAC insert on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "RBAC update on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "RBAC delete on suppliers" ON public.suppliers;
CREATE POLICY "Allow full access on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.outgoing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RBAC select on outgoing" ON public.outgoing;
DROP POLICY IF EXISTS "RBAC insert on outgoing" ON public.outgoing;
DROP POLICY IF EXISTS "RBAC update on outgoing" ON public.outgoing;
DROP POLICY IF EXISTS "RBAC delete on outgoing" ON public.outgoing;
CREATE POLICY "Allow full access on outgoing" ON public.outgoing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "RBAC select on outgoing_items" ON public.outgoing_items;
DROP POLICY IF EXISTS "RBAC insert on outgoing_items" ON public.outgoing_items;
DROP POLICY IF EXISTS "RBAC update on outgoing_items" ON public.outgoing_items;
DROP POLICY IF EXISTS "RBAC delete on outgoing_items" ON public.outgoing_items;
CREATE POLICY "Allow full access on outgoing_items" ON public.outgoing_items FOR ALL USING (true) WITH CHECK (true);

-- CHECK CONSTRAINTS
DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT chk_purchase_price CHECK (purchase_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT chk_sale_price CHECK (sale_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT chk_price_retail CHECK (price_retail >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT chk_price_wholesale CHECK (price_wholesale >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT chk_price_vip CHECK (price_vip >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.inventory ADD CONSTRAINT chk_inventory_quantity CHECK (quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== 14. SUPABASE REALTIME WEBSOCKET PUBLICATION ====================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products, public.inventory, public.sales, public.purchases, public.cash_transactions, public.profiles, public.categories, public.warehouses, public.customers, public.distribution_orders, public.distribution_order_items, public.order_returns, public.suppliers, public.outgoing;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

