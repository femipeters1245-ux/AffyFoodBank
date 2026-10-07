-- backend/migrations/001_initial_schema.sql
-- Initial schema for the FoodBank application
-- Compatible with PostgreSQL 15+

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- Users, Roles, Permissions
-- ================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    description TEXT,
    UNIQUE (action, resource),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Customer specific data
-- ================================================================
CREATE TABLE customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Product catalogue
-- ================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    price_cents BIGINT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Packages (pre-defined bundles)
-- ================================================================
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (package_id, product_id, unit_id)
);

-- ================================================================
-- Wallet & Financial Ledger
-- ================================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID UNIQUE REFERENCES customer_profiles(id) ON DELETE CASCADE,
    total_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_balance_cents >= 0),
    allocated_to_savings_cents BIGINT NOT NULL DEFAULT 0 CHECK (allocated_to_savings_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TYPE transaction_type AS ENUM (
    'DEPOSIT',
    'WITHDRAWAL',
    'SAVINGS_ALLOCATION',
    'SAVINGS_RELEASE',
    'PURCHASE',
    'REFUND',
    'ADJUSTMENT'
);

CREATE TYPE transaction_direction AS ENUM ('IN', 'OUT');

CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'SUCCESSFUL',
    'FAILED',
    'REVERSED'
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,  -- FIX: was "customers_profiles"
    reference VARCHAR(100) NOT NULL UNIQUE,
    type transaction_type NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    direction transaction_direction NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PENDING',
    description TEXT,
    payment_reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Savings Plans (custom & predefined)
-- ================================================================
CREATE TYPE savings_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'TARGET_REACHED',
    'PURCHASE_CONFIRMED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE savings_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    target_amount_cents BIGINT NOT NULL CHECK (target_amount_cents > 0),
    amount_saved_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_saved_cents >= 0),
    target_date DATE NOT NULL,
    status savings_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE savings_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (savings_plan_id, product_id, unit_id)
);

CREATE TABLE savings_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Orders & Order Items
-- ================================================================
CREATE TYPE order_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status order_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    price_at_purchase_cents BIGINT NOT NULL CHECK (price_at_purchase_cents >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Logistics (Deliveries)
-- ================================================================
CREATE TYPE delivery_status AS ENUM (
    'PENDING',
    'ASSIGNED',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED'
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    status delivery_status NOT NULL DEFAULT 'PENDING',
    proof_of_delivery_url TEXT,
    notes TEXT,
    estimated_delivery_at TIMESTAMP WITH TIME ZONE,
    actual_delivery_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Notifications
-- ================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID UNIQUE REFERENCES customer_profiles(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- EMAIL, SMS, PUSH
    frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Audit Logs (sensitive actions)
-- ================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(200) NOT NULL,
    target_table VARCHAR(100),
    target_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Lookup data: units
-- ================================================================
INSERT INTO units (id, name, symbol) VALUES
    (uuid_generate_v4(), 'kilogram', 'kg'),
    (uuid_generate_v4(), 'congo', 'cg'),
    (uuid_generate_v4(), 'bag', 'bag'),
    (uuid_generate_v4(), 'bottle', 'btl'),
    (uuid_generate_v4(), 'keg', 'keg'),
    (uuid_generate_v4(), 'piece', 'pc'),
    (uuid_generate_v4(), 'litre', 'L')
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- Indexes for fast look-ups
-- ================================================================
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_customer_id ON wallet_transactions(customer_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_profile_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_notifications_customer_id ON notifications(customer_profile_id);
CREATE INDEX idx_savings_plans_customer_id ON savings_plans(customer_profile_id);
CREATE INDEX idx_products_category_id ON products(category_id);
