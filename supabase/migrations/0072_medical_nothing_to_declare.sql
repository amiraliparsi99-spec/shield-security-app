-- Explicit "nothing to declare" on medical section
ALTER TABLE staff_portal_declarations
  ADD COLUMN IF NOT EXISTS medical_nothing_to_declare boolean NOT NULL DEFAULT false;
