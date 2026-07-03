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
