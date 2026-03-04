/*
  # Add formula support for custom columns and global template flag

  1. Modified Tables
    - `sam_custom_columns`
      - `formula` (text) - stores the formula expression for formula-type columns
    - `sam_column_templates`
      - `is_global` (boolean) - when true, template is visible/applied to all roles

  2. Notes
    - Formula column type allows HR admins to create computed columns
    - Global templates are applied across all roles (SLT, Finance, etc.)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_custom_columns' AND column_name = 'formula'
  ) THEN
    ALTER TABLE sam_custom_columns ADD COLUMN formula text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_column_templates' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE sam_column_templates ADD COLUMN is_global boolean DEFAULT false;
  END IF;
END $$;
