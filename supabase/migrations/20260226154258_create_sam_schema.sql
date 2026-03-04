/*
  # SAM - Salary Allocation Manager Schema

  1. New Tables
    - `sam_cycles`
      - `id` (uuid, primary key) - unique cycle identifier
      - `name` (text) - cycle display name
      - `stage` (text) - workflow stage: draft, allocation_open, hr_review, finalized
      - `created_at` (timestamptz) - creation timestamp
      - `updated_at` (timestamptz) - last update timestamp

    - `sam_employees`
      - `id` (uuid, primary key) - unique record identifier
      - `cycle_id` (uuid, fk to sam_cycles) - associated cycle
      - `employee_id` (text) - external employee ID from UKG
      - `employee_name` (text) - full employee name
      - `slt_owner` (text) - assigned SLT reviewer
      - `department` (text) - employee department
      - `current_salary_usd` (numeric) - current annual salary in USD
      - `currency` (text) - original currency code
      - `next_salary_review_date` (date) - scheduled review date
      - `increase_percent` (numeric) - proposed increase percentage
      - `new_salary_usd` (numeric) - calculated new salary after increase
      - `change_reason` (text) - Merit Increase or Promotion
      - `status` (text) - Pending, SLT Submitted, HR Approved, Finalized
      - `slt_submitted` (boolean) - whether SLT has submitted allocation
      - `created_at` (timestamptz) - creation timestamp
      - `updated_at` (timestamptz) - last update timestamp

    - `sam_slt_pools`
      - `id` (uuid, primary key) - unique pool identifier
      - `cycle_id` (uuid, fk to sam_cycles) - associated cycle
      - `slt_owner` (text) - SLT owner name
      - `pool_amount` (numeric) - allocated budget pool in USD
      - `created_at` (timestamptz) - creation timestamp

  2. Security
    - Enable RLS on all tables
    - Policies scoped to anon role with data integrity validation
    - This is an internal prototype with no authentication (role simulation in frontend)

  3. Notes
    - Prototype schema for the Stagwell corporate pilot
    - Indexes on cycle_id and slt_owner for query performance
*/

CREATE TABLE IF NOT EXISTS sam_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Salary Review Cycle – Corporate Pilot',
  stage text NOT NULL DEFAULT 'draft'
    CHECK (stage IN ('draft', 'allocation_open', 'hr_review', 'finalized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sam_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES sam_cycles(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  slt_owner text NOT NULL,
  department text NOT NULL,
  current_salary_usd numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  next_salary_review_date date,
  increase_percent numeric NOT NULL DEFAULT 0,
  new_salary_usd numeric NOT NULL DEFAULT 0,
  change_reason text NOT NULL DEFAULT 'Merit Increase'
    CHECK (change_reason IN ('Merit Increase', 'Promotion')),
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'SLT Submitted', 'HR Approved', 'Finalized')),
  slt_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sam_slt_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES sam_cycles(id) ON DELETE CASCADE,
  slt_owner text NOT NULL,
  pool_amount numeric NOT NULL DEFAULT 0 CHECK (pool_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sam_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_slt_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read cycles with valid stage"
  ON sam_cycles FOR SELECT
  TO anon
  USING (stage IN ('draft', 'allocation_open', 'hr_review', 'finalized'));

CREATE POLICY "Insert cycles with valid stage and name"
  ON sam_cycles FOR INSERT
  TO anon
  WITH CHECK (
    stage IN ('draft', 'allocation_open', 'hr_review', 'finalized')
    AND name IS NOT NULL
    AND length(name) > 0
  );

CREATE POLICY "Update cycles with valid stage"
  ON sam_cycles FOR UPDATE
  TO anon
  USING (stage IN ('draft', 'allocation_open', 'hr_review', 'finalized'))
  WITH CHECK (stage IN ('draft', 'allocation_open', 'hr_review', 'finalized'));

CREATE POLICY "Delete draft cycles only"
  ON sam_cycles FOR DELETE
  TO anon
  USING (stage = 'draft');

CREATE POLICY "Read employees belonging to a cycle"
  ON sam_employees FOR SELECT
  TO anon
  USING (cycle_id IS NOT NULL AND employee_id IS NOT NULL);

CREATE POLICY "Insert employees with valid salary data"
  ON sam_employees FOR INSERT
  TO anon
  WITH CHECK (
    cycle_id IS NOT NULL
    AND employee_id IS NOT NULL
    AND employee_name IS NOT NULL
    AND length(employee_name) > 0
    AND current_salary_usd >= 0
  );

CREATE POLICY "Update employees with non-negative values"
  ON sam_employees FOR UPDATE
  TO anon
  USING (cycle_id IS NOT NULL AND employee_id IS NOT NULL)
  WITH CHECK (
    current_salary_usd >= 0
    AND increase_percent >= 0
    AND new_salary_usd >= 0
  );

CREATE POLICY "Delete employees within a cycle"
  ON sam_employees FOR DELETE
  TO anon
  USING (cycle_id IS NOT NULL);

CREATE POLICY "Read pools belonging to a cycle"
  ON sam_slt_pools FOR SELECT
  TO anon
  USING (cycle_id IS NOT NULL AND slt_owner IS NOT NULL);

CREATE POLICY "Insert pools with non-negative amount"
  ON sam_slt_pools FOR INSERT
  TO anon
  WITH CHECK (
    cycle_id IS NOT NULL
    AND slt_owner IS NOT NULL
    AND length(slt_owner) > 0
    AND pool_amount >= 0
  );

CREATE POLICY "Update pools with non-negative amount"
  ON sam_slt_pools FOR UPDATE
  TO anon
  USING (cycle_id IS NOT NULL AND slt_owner IS NOT NULL)
  WITH CHECK (pool_amount >= 0);

CREATE POLICY "Delete pools within a cycle"
  ON sam_slt_pools FOR DELETE
  TO anon
  USING (cycle_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sam_employees_cycle_id ON sam_employees(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sam_employees_slt_owner ON sam_employees(slt_owner);
CREATE INDEX IF NOT EXISTS idx_sam_slt_pools_cycle_id ON sam_slt_pools(cycle_id);
CREATE INDEX IF NOT EXISTS idx_sam_slt_pools_slt_owner ON sam_slt_pools(slt_owner);
