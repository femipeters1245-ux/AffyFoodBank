-- ============================================================
-- Affy FoodBank — Supabase SQL Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Units ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT UNIQUE NOT NULL,
  symbol     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  sku         TEXT UNIQUE,
  price_cents BIGINT NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'NGN',
  image_url   TEXT,
  unit_id     UUID REFERENCES units(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventories (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity            NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 10,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auto-update timestamps ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_categories') THEN
    CREATE TRIGGER set_updated_at_categories
      BEFORE UPDATE ON categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_units') THEN
    CREATE TRIGGER set_updated_at_units
      BEFORE UPDATE ON units
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_products') THEN
    CREATE TRIGGER set_updated_at_products
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_inventories') THEN
    CREATE TRIGGER set_updated_at_inventories
      BEFORE UPDATE ON inventories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

-- Public read on active products, categories, units, inventories
CREATE POLICY "Public can read active categories"
  ON categories FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read units"
  ON units FOR SELECT USING (true);

CREATE POLICY "Public can read active products"
  ON products FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read inventories"
  ON inventories FOR SELECT USING (true);

-- Admins can read ALL products (including inactive)
CREATE POLICY "Admins can read all products"
  ON products FOR SELECT USING (true);

-- Write access (admin CRUD — secured by your backend using service_role key)
CREATE POLICY "Admin can insert categories"   ON categories  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update categories"   ON categories  FOR UPDATE USING (true);
CREATE POLICY "Admin can delete categories"   ON categories  FOR DELETE USING (true);
CREATE POLICY "Admin can insert units"        ON units       FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update units"        ON units       FOR UPDATE USING (true);
CREATE POLICY "Admin can insert products"     ON products    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update products"     ON products    FOR UPDATE USING (true);
CREATE POLICY "Admin can delete products"     ON products    FOR DELETE USING (true);
CREATE POLICY "Admin can insert inventories"  ON inventories FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update inventories"  ON inventories FOR UPDATE USING (true);
CREATE POLICY "Admin can delete inventories"  ON inventories FOR DELETE USING (true);
