CREATE TABLE public.outgoing_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cost', 'expense', 'profit', 'cash_reserve')),
  name text NOT NULL,
  description text,
  value numeric(12,2) CHECK (value IS NULL OR value > 0),
  cost_type text CHECK (cost_type IS NULL OR cost_type IN ('Fixo', 'Variável')),
  frequency text NOT NULL DEFAULT 'none' CHECK (frequency IN ('none', 'once', 'count', 'monthly')),
  start_date date,
  due_day smallint CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  repeat_count integer,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  legacy_cost_category_id uuid,
  legacy_expense_category_id uuid,
  historical_names text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outgoing_programs_frequency_fields_check CHECK (
    (frequency = 'none' AND start_date IS NULL AND due_day IS NULL AND repeat_count IS NULL)
    OR (frequency = 'once' AND start_date IS NOT NULL AND due_day BETWEEN 1 AND 31 AND repeat_count IS NULL)
    OR (frequency = 'count' AND start_date IS NOT NULL AND due_day BETWEEN 1 AND 31 AND repeat_count > 1)
    OR (frequency = 'monthly' AND start_date IS NOT NULL AND due_day BETWEEN 1 AND 31 AND repeat_count IS NULL)
  ),
  CONSTRAINT outgoing_programs_scheduled_value_check CHECK (
    frequency = 'none' OR value IS NOT NULL
  ),
  CONSTRAINT outgoing_programs_program_kind_check CHECK (
    kind IN ('cost', 'expense') OR frequency <> 'none'
  ),
  CONSTRAINT outgoing_programs_profit_partner_check CHECK (
    kind <> 'profit' OR partner_id IS NOT NULL
  ),
  CONSTRAINT outgoing_programs_legacy_source_check CHECK (
    legacy_cost_category_id IS NULL OR legacy_expense_category_id IS NULL
  )
);