// frontend/src/lib/supabase.ts
// Supabase client — single source of truth for all product data

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Affy] Supabase credentials not found in environment. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// ─── Type helpers ──────────────────────────────────────────────────────────────

export interface SupabaseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseUnit {
  id: string;
  name: string;
  symbol: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseInventory {
  id: string;
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SupabaseProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  unit_id: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  unit?: SupabaseUnit | null;
  category?: SupabaseCategory | null;
  inventory?: SupabaseInventory[] | null;
}

// ─── Products API ──────────────────────────────────────────────────────────────

export const supabaseProducts = {
  /** List all active products with unit, category, and inventory */
  async list(): Promise<SupabaseProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        unit:units(*),
        category:categories(*),
        inventory:inventories(*)
      `
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Get all products (including inactive) for admin */
  async listAll(): Promise<SupabaseProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        unit:units(*),
        category:categories(*),
        inventory:inventories(*)
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /** Get a single product */
  async getById(id: string): Promise<SupabaseProduct | null> {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        unit:units(*),
        category:categories(*),
        inventory:inventories(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /** Create a new product (admin) */
  async create(payload: {
    name: string;
    description?: string;
    price_cents: number;
    image_url?: string;
    category_id?: string;
    unit_id?: string;
    stock?: number;
    is_active?: boolean;
  }): Promise<SupabaseProduct> {
    const { name, description, price_cents, image_url, category_id, unit_id, stock = 0, is_active = true } = payload;

    // Create the product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        description: description ?? null,
        price_cents,
        image_url: image_url ?? null,
        category_id: category_id ?? null,
        unit_id: unit_id ?? null,
        currency: 'NGN',
        is_active,
      })
      .select('*')
      .single();

    if (productError) throw productError;

    // Create inventory record
    const { error: invError } = await supabase.from('inventories').insert({
      product_id: product.id,
      quantity: stock,
      low_stock_threshold: 10,
    });

    if (invError) throw invError;

    return product;
  },

  /** Update an existing product (admin) */
  async update(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      price_cents: number;
      image_url: string;
      category_id: string;
      unit_id: string;
      is_active: boolean;
      stock: number;
    }>
  ): Promise<SupabaseProduct> {
    const { stock, ...productFields } = payload;

    // Update product fields
    if (Object.keys(productFields).length > 0) {
      const { error } = await supabase.from('products').update(productFields).eq('id', id);
      if (error) throw error;
    }

    // Update inventory if stock provided
    if (stock !== undefined) {
      const { error } = await supabase
        .from('inventories')
        .upsert({ product_id: id, quantity: stock, low_stock_threshold: 10 }, { onConflict: 'product_id' });
      if (error) throw error;
    }

    // Return fresh product
    const updated = await this.getById(id);
    if (!updated) throw new Error('Product not found after update');
    return updated;
  },

  /** Soft-delete a product */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  },

  /** Hard-delete a product (removes all data permanently) */
  async delete(id: string): Promise<void> {
    // Remove inventory first (FK constraint)
    await supabase.from('inventories').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  /** Increment stock */
  async restock(id: string, additionalQty: number): Promise<void> {
    const { data: inv } = await supabase.from('inventories').select('quantity').eq('product_id', id).single();
    const current = inv?.quantity ?? 0;
    const { error } = await supabase
      .from('inventories')
      .upsert(
        { product_id: id, quantity: current + additionalQty, low_stock_threshold: 10 },
        { onConflict: 'product_id' }
      );
    if (error) throw error;
  },
};

// ─── Categories & Units ────────────────────────────────────────────────────────

export const supabaseCategories = {
  async list(): Promise<SupabaseCategory[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async findOrCreate(name: string): Promise<SupabaseCategory> {
    const { data: existing } = await supabase.from('categories').select('*').eq('name', name).single();
    if (existing) return existing;

    const { data, error } = await supabase.from('categories').insert({ name, is_active: true }).select('*').single();
    if (error) throw error;
    return data;
  },
};

export const supabaseUnits = {
  async list(): Promise<SupabaseUnit[]> {
    const { data, error } = await supabase.from('units').select('*').order('name');
    if (error) throw error;
    return data ?? [];
  },

  async findOrCreate(name: string, symbol?: string): Promise<SupabaseUnit> {
    const { data: existing } = await supabase.from('units').select('*').eq('name', name).single();
    if (existing) return existing;

    const { data, error } = await supabase
      .from('units')
      .insert({ name, symbol: symbol ?? null })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
};
