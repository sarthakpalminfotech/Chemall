-- =========================================================================
-- DATABASE UPDATE QUERY FOR CONTAINER CAPACITY & DISPATCH QUANTITIES
-- Run this in the Supabase SQL Editor to update your database schema.
-- =========================================================================

-- 1. Add capacity column to container_types
ALTER TABLE container_types ADD COLUMN IF NOT EXISTS capacity NUMERIC NOT NULL DEFAULT 0.00;

-- 2. Update default capacity values for seeded containers
UPDATE container_types SET capacity = 20.00 WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE container_types SET capacity = 50.00 WHERE id = 'c0000000-0000-0000-0000-000000000002';
UPDATE container_types SET capacity = 1.00  WHERE id = 'c0000000-0000-0000-0000-000000000003';
UPDATE container_types SET capacity = 0.50  WHERE id = 'c0000000-0000-0000-0000-000000000004';
UPDATE container_types SET capacity = 5.00  WHERE id = 'c0000000-0000-0000-0000-000000000005';
UPDATE container_types SET capacity = 25.00 WHERE id = 'c0000000-0000-0000-0000-000000000006';

-- 3. Recreate the order_dispatch_containers table to support quantities per product
DROP TABLE IF EXISTS order_dispatch_containers CASCADE;

CREATE TABLE order_dispatch_containers (
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  container_type_id UUID NOT NULL REFERENCES container_types(id),
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  PRIMARY KEY (order_id, product_id, container_type_id)
);

CREATE INDEX IF NOT EXISTS idx_order_dispatch_containers_order ON order_dispatch_containers(order_id);

-- 4. Recreate the mark_in_production RPC function to parse JSON dispatch container records
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

  RETURN jsonb_build_object(
    'batch_number', v_batch,
    'warnings',     to_jsonb(v_warnings)
  );
END;
$$ LANGUAGE plpgsql;
