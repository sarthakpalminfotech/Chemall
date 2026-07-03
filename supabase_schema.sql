-- ============================================================
-- ChemPack Operations Hub — Supabase PostgreSQL Schema
-- Copy and paste this entire file into the Supabase SQL Editor
-- (Database → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('finished_good', 'raw_material')),
  alert_threshold NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  is_container    BOOLEAN NOT NULL DEFAULT FALSE,
  capacity        NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Many-to-many: which container types belong to a finished good
CREATE TABLE IF NOT EXISTS product_container_types (
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  container_type_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, container_type_id)
);

-- ============================================================
-- 3. EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  phone_number  TEXT NOT NULL UNIQUE,   -- login username
  address       TEXT,
  designation   TEXT NOT NULL DEFAULT 'worker',
  is_owner      BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,          -- bcrypt hash, never plaintext
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-module access permissions
CREATE TABLE IF NOT EXISTS employee_permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,            -- 'Dashboard','Orders','Inventory','Masters','Notes','Leads'
  can_read    BOOLEAN NOT NULL DEFAULT FALSE,
  can_write   BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT employee_permissions_unique UNIQUE (employee_id, module_name)
);

-- ============================================================
-- 4. SUPPLIERS / CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  address        TEXT,
  contact_number TEXT,                  -- nullable (inline-add from Orders)
  lead_source    TEXT,
  type           TEXT NOT NULL DEFAULT 'customer',  -- customer | agent | raw_material_supplier | custom
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number        TEXT UNIQUE,              -- ORD-YYYYMMDD-### (set on Mark in Production)
  supplier_id         UUID NOT NULL REFERENCES suppliers(id),
  supplier_name       TEXT NOT NULL,            -- denormalised for display speed
  currency            TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','USD','EUR')),
  total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_production')),
  priority            SMALLINT CHECK (priority BETWEEN 1 AND 10),   -- NULL = no priority
  notes               TEXT,
  dispatch_note       TEXT,
  qr_data_url         TEXT,                     -- base64 PNG stored after Mark-in-Production
  -- Repeat order config (NULL when repeat is disabled)
  repeat_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_start_date   DATE,
  recurrence_type     TEXT CHECK (recurrence_type IN ('monthly','weekly')),
  recurrence_weekdays SMALLINT[],               -- e.g. {0,2,4} for Mon/Wed/Fri
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Line items per order
CREATE TABLE IF NOT EXISTS order_products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  product_name  TEXT NOT NULL,          -- denormalised
  quantity      INTEGER NOT NULL CHECK (quantity > 0),   -- kg, integers only
  rate_per_kg   NUMERIC(10,2) NOT NULL,
  previous_rate NUMERIC(10,2),          -- most recent past rate from same supplier+product
  currency      TEXT NOT NULL DEFAULT 'INR'
);

-- Preferred containers selected at order creation time
CREATE TABLE IF NOT EXISTS order_preferred_containers (
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  container_type_id UUID NOT NULL REFERENCES products(id),
  PRIMARY KEY (order_id, container_type_id)
);

-- Dispatch containers chosen at Mark-in-Production time
CREATE TABLE IF NOT EXISTS order_dispatch_containers (
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  container_type_id UUID NOT NULL REFERENCES products(id),
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  PRIMARY KEY (order_id, product_id, container_type_id)
);

CREATE INDEX IF NOT EXISTS idx_order_dispatch_containers_order ON order_dispatch_containers(order_id);

-- Per-day batch counter (atomic increment, never reused)
CREATE TABLE IF NOT EXISTS batch_counters (
  date_key TEXT PRIMARY KEY,    -- 'YYYYMMDD'
  counter  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 6. INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) UNIQUE,
  product_name TEXT NOT NULL,       -- denormalised
  product_type TEXT NOT NULL CHECK (product_type IN ('finished_good','raw_material')),
  quantity     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- kg; can go negative (warn, not block)
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full IN/OUT audit log
CREATE TABLE IF NOT EXISTS inventory_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity     NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  type         TEXT NOT NULL CHECK (type IN ('IN','OUT')),
  reference    TEXT,             -- batch number for OUT entries; NULL for IN
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type              TEXT NOT NULL CHECK (type IN (
                      'low_stock','order_unattended','no_dispatch',
                      'priority_unattended','repeat_customer_order','other'
                    )),
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  related_order_id  UUID REFERENCES orders(id) ON DELETE SET NULL,
  related_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. INDEXES (for common query patterns)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id     ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date      ON orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_priority        ON orders(priority) WHERE priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_products_order   ON order_products(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type    ON inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_date    ON inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_read            ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created         ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_employee         ON notes(employee_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_type         ON suppliers(type);

-- ============================================================
-- 10. UPDATED_AT TRIGGER (auto-update on row change)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 11. ATOMIC BATCH NUMBER FUNCTION
-- Called from a Supabase Edge Function or RPC to guarantee
-- no two orders get the same batch number on the same day.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TEXT AS $$
DECLARE
  today_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  new_count INTEGER;
BEGIN
  INSERT INTO batch_counters (date_key, counter)
  VALUES (today_key, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET counter = batch_counters.counter + 1
  RETURNING counter INTO new_count;

  RETURN 'ORD-' || today_key || '-' || LPAD(new_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. MARK IN PRODUCTION — ATOMIC TRANSACTION FUNCTION
-- Call via Supabase RPC: supabase.rpc('mark_in_production', {...})
-- Wraps: batch gen + status change + inventory deduction + log creation
-- Full rollback on any failure (standard PG transaction behaviour).
-- ============================================================
CREATE OR REPLACE FUNCTION mark_in_production(
  p_order_id                 UUID,
  p_dispatch_containers_json JSONB,  -- Array of {product_id, container_type_id, quantity}
  p_dispatch_note            TEXT,
  p_qr_data_url              TEXT,
  p_employee_id              UUID
)
RETURNS JSONB AS $$
DECLARE
  v_batch      TEXT;
  v_warnings   TEXT[] := '{}';
  v_product    RECORD;
  v_container  RECORD;
  v_current_qty NUMERIC;
  v_order_status TEXT;
BEGIN
  -- 1. Check employee write permission on Orders
  IF NOT EXISTS (
    SELECT 1 FROM employee_permissions
    WHERE employee_id = p_employee_id
      AND module_name = 'Orders'
      AND can_write = TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id AND is_owner = TRUE
  ) THEN
    RAISE EXCEPTION 'Permission denied: employee does not have write access to Orders';
  END IF;

  -- 2. Verify order is still Pending
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order_status <> 'pending' THEN
    RAISE EXCEPTION 'Order is already in production';
  END IF;

  -- 3. Generate unique batch number (atomic)
  v_batch := generate_batch_number();

  -- 4. Update order
  UPDATE orders SET
    status              = 'in_production',
    batch_number        = v_batch,
    dispatch_note       = p_dispatch_note,
    qr_data_url         = p_qr_data_url,
    updated_at          = NOW()
  WHERE id = p_order_id;

  -- 5. Save dispatch containers with quantities
  DELETE FROM order_dispatch_containers WHERE order_id = p_order_id;
  
  INSERT INTO order_dispatch_containers (order_id, product_id, container_type_id, quantity)
  SELECT 
    p_order_id, 
    (elem->>'product_id')::UUID, 
    (elem->>'container_type_id')::UUID, 
    (elem->>'quantity')::INTEGER
  FROM jsonb_array_elements(p_dispatch_containers_json) AS elem;

  -- 6. Deduct finished goods inventory + create OUT logs
  FOR v_product IN
    SELECT op.product_id, op.product_name, op.quantity
    FROM order_products op WHERE op.order_id = p_order_id
  LOOP
    -- Get or create inventory row
    INSERT INTO inventory (product_id, product_name, product_type, quantity)
    VALUES (v_product.product_id, v_product.product_name, 'finished_good', 0)
    ON CONFLICT (product_id) DO NOTHING;

    -- Deduct
    UPDATE inventory
    SET quantity     = quantity - v_product.quantity,
        last_updated = NOW()
    WHERE product_id = v_product.product_id
    RETURNING quantity INTO v_current_qty;

    -- Warn if negative (do NOT hard-block per spec)
    IF v_current_qty < 0 THEN
      v_warnings := v_warnings || (v_product.product_name || ' stock is now ' || v_current_qty || ' kg');
    END IF;

    -- Create OUT log
    INSERT INTO inventory_logs (product_id, product_name, quantity, type, reference)
    VALUES (v_product.product_id, v_product.product_name, v_product.quantity, 'OUT', v_batch);
  END LOOP;

  -- 7. Deduct container inventory (raw material) + create OUT logs
  FOR v_container IN
    SELECT 
      (elem->>'container_type_id')::UUID AS container_id, 
      SUM((elem->>'quantity')::INTEGER) AS total_qty
    FROM jsonb_array_elements(p_dispatch_containers_json) AS elem
    GROUP BY (elem->>'container_type_id')::UUID
  LOOP
    DECLARE
      v_c_name TEXT;
      v_c_unit TEXT;
    BEGIN
      -- Lookup the product name and unit for the container
      SELECT name, unit INTO v_c_name, v_c_unit FROM products WHERE id = v_container.container_id;
      
      -- Get or create inventory row for the container
      INSERT INTO inventory (product_id, product_name, product_type, quantity)
      VALUES (v_container.container_id, v_c_name, 'raw_material', 0)
      ON CONFLICT (product_id) DO NOTHING;

      -- Deduct
      UPDATE inventory
      SET quantity     = quantity - v_container.total_qty,
          last_updated = NOW()
      WHERE product_id = v_container.container_id
      RETURNING quantity INTO v_current_qty;

      -- Warn if negative
      IF v_current_qty < 0 THEN
        v_warnings := v_warnings || (v_c_name || ' stock is now ' || v_current_qty || ' ' || COALESCE(v_c_unit, 'kg'));
      END IF;

      -- Create OUT log
      INSERT INTO inventory_logs (product_id, product_name, quantity, type, reference)
      VALUES (v_container.container_id, v_c_name, v_container.total_qty, 'OUT', v_batch || ' (Container)');
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'batch_number', v_batch,
    'warnings',     to_jsonb(v_warnings)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. SEED DATA — default owner employee
-- Change the phone and password hash before going live.
-- Password below is bcrypt hash of "admin1234" (for dev only).
-- ============================================================
INSERT INTO employees (id, name, phone_number, designation, is_owner, password_hash)
VALUES ('00000000-0000-0000-0000-000000000001', 'Owner', '9999999999', 'owner', TRUE, '$2b$10$examplehashchangethisbeforegoinglivenow000000000000000')
ON CONFLICT (phone_number) DO NOTHING;

-- Give owner full access to all modules
INSERT INTO employee_permissions (employee_id, module_name, can_read, can_write)
SELECT '00000000-0000-0000-0000-000000000001', m.module_name, TRUE, TRUE
FROM (VALUES ('Dashboard'),('Orders'),('Inventory'),('Masters'),('Notes'),('Leads')) AS m(module_name)
ON CONFLICT (employee_id, module_name) DO NOTHING;

-- Seed container types
INSERT INTO container_types (id, name, capacity, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'Plastic Barrel (20L)', 20.00, '2025-01-15 00:00:00+00'),
('c0000000-0000-0000-0000-000000000002', 'HDPE Drum (50kg)', 50.00, '2025-01-16 00:00:00+00'),
('c0000000-0000-0000-0000-000000000003', 'Glass Bottle (1L)', 1.00, '2025-01-17 00:00:00+00'),
('c0000000-0000-0000-0000-000000000004', 'Metal Can (500ml)', 0.50, '2025-01-18 00:00:00+00'),
('c0000000-0000-0000-0000-000000000005', 'Plastic Pouch (5kg)', 5.00, '2025-01-19 00:00:00+00'),
('c0000000-0000-0000-0000-000000000006', 'Cardboard Box (25kg)', 25.00, '2025-01-20 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Seed products
INSERT INTO products (id, name, type, created_at) VALUES
('a0000000-0000-0000-0000-000000000001', 'Sulfuric Acid 98%', 'finished_good', '2025-01-10 00:00:00+00'),
('a0000000-0000-0000-0000-000000000002', 'Sodium Chloride Solution', 'finished_good', '2025-01-11 00:00:00+00'),
('a0000000-0000-0000-0000-000000000003', 'Industrial Detergent Concentrate', 'finished_good', '2025-01-12 00:00:00+00'),
('a0000000-0000-0000-0000-000000000004', 'Raw Sulfur Powder', 'raw_material', '2025-01-13 00:00:00+00'),
('a0000000-0000-0000-0000-000000000005', 'Sodium Carbonate Crystals', 'raw_material', '2025-01-14 00:00:00+00'),
('a0000000-0000-0000-0000-000000000006', 'Polyethylene Pellets', 'raw_material', '2025-01-15 00:00:00+00'),
('a0000000-0000-0000-0000-000000000007', 'Phosphoric Acid Solution', 'finished_good', '2025-01-16 00:00:00+00'),
('a0000000-0000-0000-0000-000000000008', 'Cleaning Tablets Pack', 'finished_good', '2025-01-17 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Seed product container types relation
INSERT INTO product_container_types (product_id, container_type_id) VALUES
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004'),
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002'),
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005'),
('a0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000006'),
('a0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (product_id, container_type_id) DO NOTHING;

-- Seed suppliers
INSERT INTO suppliers (id, name, address, contact_number, lead_source, type, created_at, updated_at) VALUES
('b0000000-0000-0000-0000-000000000001', 'ChemCore Industries Ltd', '123 Industrial Park, Mumbai, MH 400001', '+91-22-1234-5678', 'Direct Contact', 'customer', '2025-01-05 00:00:00+00', '2025-01-05 00:00:00+00'),
('b0000000-0000-0000-0000-000000000002', 'Pure Chemicals Pvt Ltd', '456 Business Plaza, Delhi, DL 110001', '+91-11-9876-5432', 'Referral', 'raw_material_supplier', '2025-01-06 00:00:00+00', '2025-01-06 00:00:00+00'),
('b0000000-0000-0000-0000-000000000003', 'EcoPackaging Solutions', '789 Trade Center, Bangalore, KA 560001', '+91-80-5555-1111', 'Online Search', 'customer', '2025-01-07 00:00:00+00', '2025-01-07 00:00:00+00'),
('b0000000-0000-0000-0000-000000000004', 'Global Chemical Traders', '321 Commerce Street, Ahmedabad, GJ 380001', '+91-79-2222-3333', 'Trade Show', 'agent', '2025-01-08 00:00:00+00', '2025-01-08 00:00:00+00'),
('b0000000-0000-0000-0000-000000000005', 'Apex Manufacturing Co', '654 Industrial Zone, Pune, MH 411001', '+91-20-7777-8888', 'LinkedIn', 'customer', '2025-01-09 00:00:00+00', '2025-01-09 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Seed inventory
INSERT INTO inventory (id, product_id, product_name, product_type, quantity, last_updated) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sulfuric Acid 98%', 'finished_good', 1200.00, '2025-01-20 10:00:00+00'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Sodium Chloride Solution', 'finished_good', 850.00, '2025-01-20 10:00:00+00'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Industrial Detergent Concentrate', 'finished_good', 30.00, '2025-01-20 10:00:00+00'),  -- Low Stock
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Raw Sulfur Powder', 'raw_material', 5000.00, '2025-01-20 10:00:00+00'),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'Sodium Carbonate Crystals', 'raw_material', 120.00, '2025-01-20 10:00:00+00'),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Polyethylene Pellets', 'raw_material', 45.00, '2025-01-20 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. ROW LEVEL SECURITY (RLS) — enable after wiring auth
-- Uncomment these once you connect Supabase Auth.
-- ============================================================
-- ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY notes_own_rows ON notes
--   USING (employee_id = auth.uid());

-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
-- (Add your own policies based on role/permission checks)

-- ============================================================
-- DONE. All tables, indexes, triggers, and functions created.
-- ============================================================
