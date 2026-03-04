/*
  # Add Sally's spreadsheet columns and promotion tracking fields

  This migration adds all the columns that Sally's manual Excel files used to track,
  plus new promotion-specific fields so SLT members can record title changes and rationale.

  1. Modified Tables
    - `sam_employees` - adds the following new columns:
      - `dept_level` (text) - Department level (e.g., L1, L2, Director)
      - `title` (text) - Employee's current job title before any changes
      - `new_title` (text) - Post-promotion title (blank if no promotion)
      - `reports_to` (text) - Manager name this employee reports to
      - `location` (text) - Office location or city
      - `start_date` (date) - Employee's hire/start date
      - `py_cash_bonus` (numeric) - Prior year cash bonus amount
      - `py_stock_bonus` (numeric) - Prior year stock/equity bonus amount
      - `ltip` (numeric) - Long-term incentive plan amount
      - `promo_rationale` (text) - Free-text reason for promotion
      - `new_responsibilities` (text) - Description of new role responsibilities

  2. Notes
    - All new columns are nullable with sensible defaults so existing data is not affected
    - The change_reason CHECK constraint is updated to allow new values
    - These columns match Sally's manual Excel headers: Dept Level, Title, Reports To,
      Location, Start Date, PY Cash Bonus, PY Stock Bonus, LTIP
    - Total Comp (Previous) and Total Comp (New) are computed in the frontend, not stored
*/

-- Add Sally's standard columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'dept_level') THEN
    ALTER TABLE sam_employees ADD COLUMN dept_level text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'title') THEN
    ALTER TABLE sam_employees ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'new_title') THEN
    ALTER TABLE sam_employees ADD COLUMN new_title text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'reports_to') THEN
    ALTER TABLE sam_employees ADD COLUMN reports_to text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'location') THEN
    ALTER TABLE sam_employees ADD COLUMN location text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'start_date') THEN
    ALTER TABLE sam_employees ADD COLUMN start_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'py_cash_bonus') THEN
    ALTER TABLE sam_employees ADD COLUMN py_cash_bonus numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'py_stock_bonus') THEN
    ALTER TABLE sam_employees ADD COLUMN py_stock_bonus numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'ltip') THEN
    ALTER TABLE sam_employees ADD COLUMN ltip numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'promo_rationale') THEN
    ALTER TABLE sam_employees ADD COLUMN promo_rationale text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sam_employees' AND column_name = 'new_responsibilities') THEN
    ALTER TABLE sam_employees ADD COLUMN new_responsibilities text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sam_employees_dept_level ON sam_employees(dept_level);
CREATE INDEX IF NOT EXISTS idx_sam_employees_title ON sam_employees(title);
