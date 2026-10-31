-- Drop the existing constraint
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;

-- Add the updated constraint with all required statuses
ALTER TABLE visits 
ADD CONSTRAINT visits_status_check 
CHECK (status IN ('pending', 'approved', 'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled'));
