CREATE TABLE IF NOT EXISTS public.internal_job_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.internal_job_tokens TO service_role;

ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_job_tokens (name, token)
VALUES ('scheduler', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;