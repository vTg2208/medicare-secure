-- Migration: Create pharmacy_inventory table
-- Run this to enable the Pharmacist Inventory page

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255)    NOT NULL,
    generic_name     VARCHAR(255),
    category         VARCHAR(100),
    location         VARCHAR(100),
    stock_quantity   INTEGER         NOT NULL DEFAULT 0,
    reorder_level    INTEGER         NOT NULL DEFAULT 10,
    unit             VARCHAR(50)     DEFAULT 'units',
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed with sample data so the Inventory page shows something immediately
INSERT INTO pharmacy_inventory (name, generic_name, category, location, stock_quantity, reorder_level)
VALUES
    ('Paracetamol 500mg',     'Acetaminophen',   'Analgesic',     'Shelf A1', 250, 50),
    ('Amoxicillin 250mg',     'Amoxicillin',     'Antibiotic',    'Shelf B2', 80,  20),
    ('Metformin 500mg',       'Metformin HCl',   'Antidiabetic',  'Shelf C3', 5,   30),
    ('Atorvastatin 10mg',     'Atorvastatin',    'Statin',        'Shelf D1', 0,   25),
    ('Omeprazole 20mg',       'Omeprazole',      'PPI',           'Shelf A3', 120, 30),
    ('Lisinopril 5mg',        'Lisinopril',      'ACE Inhibitor', 'Shelf B1', 15,  20),
    ('Salbutamol Inhaler',    'Salbutamol',      'Bronchodilator','Shelf E2', 40,  10)
ON CONFLICT DO NOTHING;
