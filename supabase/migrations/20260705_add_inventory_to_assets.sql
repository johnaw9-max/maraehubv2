-- Add Inventory category and inventory-specific columns to the assets table

-- Extend the category check constraint to include 'Inventory'
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE assets ADD CONSTRAINT assets_category_check
  CHECK (category IN ('Building','Equipment','Vehicle','Technology','Grounds','Other','Inventory'));

-- Inventory-specific columns (NULL on non-inventory rows)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS inventory_category text
  CHECK (inventory_category IS NULL OR inventory_category IN ('Linen','Crockery','Kitchen','Other'));
ALTER TABLE assets ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_stocktake date;
