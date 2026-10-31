ALTER TABLE medication_orders DROP CONSTRAINT IF EXISTS medication_orders_status_check;
ALTER TABLE medication_orders ADD CONSTRAINT medication_orders_status_check CHECK(status IN ('ordered','dispensed','administered','discontinued','refused'));
ALTER TABLE medication_orders ADD COLUMN IF NOT EXISTS refused_by UUID REFERENCES users(id);
ALTER TABLE medication_orders ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ;
ALTER TABLE medication_orders ADD COLUMN IF NOT EXISTS refusal_reason TEXT;
