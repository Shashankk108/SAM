/*
  # Fix column_type CHECK constraint to allow formula type

  1. Modified Tables
    - `sam_custom_columns`
      - Updated CHECK constraint on `column_type` to allow 'text', 'number', and 'formula'

  2. Notes
    - Previous constraint only allowed 'text' and 'number'
    - Formula columns were being silently rejected by the database
*/

ALTER TABLE sam_custom_columns DROP CONSTRAINT IF EXISTS sam_custom_columns_column_type_check;
ALTER TABLE sam_custom_columns ADD CONSTRAINT sam_custom_columns_column_type_check
  CHECK (column_type IN ('text', 'number', 'formula'));
