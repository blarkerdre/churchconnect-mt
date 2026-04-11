ALTER TABLE public.exam_titles
  ADD COLUMN send_result_email boolean NOT NULL DEFAULT true,
  ADD COLUMN send_certificate_email boolean NOT NULL DEFAULT true;