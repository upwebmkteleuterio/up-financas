CREATE TABLE public.outgoing_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.outgoing_programs(id) ON DELETE CASCADE,
  sequence_number integer,
  due_date date NOT NULL,
  scheduled_value numeric(12,2) NOT NULL CHECK (scheduled_value > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial')),
  actual_value numeric(12,2) CHECK (actual_value IS NULL OR actual_value > 0),
  actual_date date,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  is_residual boolean NOT NULL DEFAULT false,
  parent_occurrence_id uuid REFERENCES public.outgoing_occurrences(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outgoing_occurrences_sequence_check CHECK (sequence_number IS NULL OR sequence_number >= 0),
  CONSTRAINT outgoing_occurrences_residual_check CHECK (
    (is_residual AND sequence_number IS NULL AND parent_occurrence_id IS NOT NULL)
    OR (NOT is_residual AND sequence_number IS NOT NULL AND parent_occurrence_id IS NULL)
  ),
  CONSTRAINT outgoing_occurrences_settlement_check CHECK (
    (status = 'pending' AND actual_value IS NULL AND actual_date IS NULL AND transaction_id IS NULL)
    OR (status IN ('paid', 'partial') AND actual_value IS NOT NULL AND actual_date IS NOT NULL AND transaction_id IS NOT NULL)
  )
);