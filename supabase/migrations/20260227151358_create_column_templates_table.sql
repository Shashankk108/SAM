/*
  # Create column templates table

  1. New Tables
    - `sam_column_templates`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Template display name
      - `description` (text) - Optional description
      - `columns` (jsonb) - Array of column definitions: [{ key, label, isCustom, type }]
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `sam_column_templates` table
    - Add policies for authenticated and anon access (prototype app)
*/

CREATE TABLE IF NOT EXISTS sam_column_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  columns jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sam_column_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on column templates"
  ON sam_column_templates
  FOR SELECT
  TO anon
  USING (id IS NOT NULL);

CREATE POLICY "Allow anon insert on column templates"
  ON sam_column_templates
  FOR INSERT
  TO anon
  WITH CHECK (name IS NOT NULL AND name != '');

CREATE POLICY "Allow anon update on column templates"
  ON sam_column_templates
  FOR UPDATE
  TO anon
  USING (id IS NOT NULL)
  WITH CHECK (name IS NOT NULL AND name != '');

CREATE POLICY "Allow anon delete on column templates"
  ON sam_column_templates
  FOR DELETE
  TO anon
  USING (id IS NOT NULL);
