-- Migration script to convert Container Types into Products (Raw Materials)

-- 1. Add new columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_container BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS capacity NUMERIC(10,2);

-- 2. Update foreign keys in referencing tables to point to products instead of container_types
-- Drop old foreign keys
ALTER TABLE product_container_types DROP CONSTRAINT IF EXISTS product_container_types_container_type_id_fkey;
ALTER TABLE order_preferred_containers DROP CONSTRAINT IF EXISTS order_preferred_containers_container_type_id_fkey;
ALTER TABLE order_dispatch_containers DROP CONSTRAINT IF EXISTS order_dispatch_containers_container_type_id_fkey;

-- Add new foreign keys pointing to products(id)
ALTER TABLE product_container_types ADD CONSTRAINT product_container_types_container_type_id_fkey FOREIGN KEY (container_type_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE order_preferred_containers ADD CONSTRAINT order_preferred_containers_container_type_id_fkey FOREIGN KEY (container_type_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE order_dispatch_containers ADD CONSTRAINT order_dispatch_containers_container_type_id_fkey FOREIGN KEY (container_type_id) REFERENCES products(id) ON DELETE CASCADE;

-- 3. Drop the old container_types table
DROP TABLE IF EXISTS container_types CASCADE;
