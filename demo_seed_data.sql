-- =========================================================================
-- DEMO SEED DATA: Predated Orders, Alerts, and Notes
-- Run this in the Supabase SQL Editor to populate your dashboard with demo data.
-- =========================================================================

-- 1. Insert predated orders
INSERT INTO orders (id, supplier_id, supplier_name, currency, total_amount, order_date, status, priority, notes, created_at, updated_at) VALUES
('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ChemCore Industries Ltd', 'INR', 42750.00, CURRENT_DATE - INTERVAL '2 days', 'pending', 1, 'Urgent month-end order', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'EcoPackaging Solutions', 'INR', 11250.00, CURRENT_DATE - INTERVAL '1 day', 'pending', NULL, 'Standard quarterly stock', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 'Apex Manufacturing Co', 'INR', 120000.00, CURRENT_DATE - INTERVAL '5 days', 'in_production', 3, 'High volume discount applied', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- Assign a mock batch number to the in_production order manually
UPDATE orders SET batch_number = 'ORD-20250925-001' WHERE id = 'e0000000-0000-0000-0000-000000000003';

-- 2. Insert order line items
INSERT INTO order_products (id, order_id, product_id, product_name, quantity, rate_per_kg, previous_rate, currency) VALUES
('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sulfuric Acid 98%', 500, 85.50, 82.00, 'INR'),
('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Sodium Chloride Solution', 250, 45.00, 45.00, 'INR'),
('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Industrial Detergent Concentrate', 1000, 120.00, 118.50, 'INR')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert some demo alerts
INSERT INTO alerts (id, type, title, message, is_read, related_order_id, related_product_id, created_at) VALUES
('a1000000-0000-0000-0000-000000000001', 'low_stock', 'Low Stock Alert', 'Industrial Detergent Concentrate stock has fallen below 50kg.', FALSE, NULL, 'a0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '2 hours'),
('a1000000-0000-0000-0000-000000000002', 'priority_unattended', 'Priority Order Pending', 'Priority 1 order for ChemCore Industries Ltd is still pending after 24 hours.', FALSE, 'e0000000-0000-0000-0000-000000000001', NULL, NOW() - INTERVAL '5 hours'),
('a1000000-0000-0000-0000-000000000003', 'repeat_customer_order', 'Repeat Customer', 'EcoPackaging Solutions placed their monthly recurring order.', TRUE, 'e0000000-0000-0000-0000-000000000002', NULL, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert some demo notes (attached to the default Owner employee)
INSERT INTO notes (id, employee_id, content, created_at, updated_at) VALUES
('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Remember to verify the HDPE drum stock before the weekend. We might run out if the Apex Manufacturing order goes through.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Follow up with Global Chemical Traders on raw material shipment delay.', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;
