/*
  # Add insert_after field to custom columns

  1. Modified Tables
    - `sam_custom_columns`
      - Added `insert_after` (text) - key of the standard column this custom column should appear after
      - Default empty string means append at end of table

  2. Notes
    - Enables custom columns to be positioned between standard columns in the employee table
    - When insert_after is set to a standard column key (e.g. 'location'), the custom column
      renders immediately after that standard column instead of at the end
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_custom_columns' AND column_name = 'insert_after'
  ) THEN
    ALTER TABLE sam_custom_columns ADD COLUMN insert_after text NOT NULL DEFAULT '';
  END IF;
END $$;
