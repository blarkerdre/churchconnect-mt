-- Create tenant_invoices table
CREATE TABLE public.tenant_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.tenant_payments(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'receipt')),
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'GBP',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  bill_to JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  terms TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invoices_number_unique UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_tenant_invoices_tenant ON public.tenant_invoices(tenant_id);
CREATE INDEX idx_tenant_invoices_status ON public.tenant_invoices(status);
CREATE INDEX idx_tenant_invoices_doc_type ON public.tenant_invoices(document_type);

-- Enable RLS
ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

-- Super admins: full access
CREATE POLICY "Super admins full access tenant_invoices"
ON public.tenant_invoices FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tenant admins/owners: SELECT only their own tenant
CREATE POLICY "Tenant admins view own invoices"
ON public.tenant_invoices FOR SELECT
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_tenant_invoices_updated_at
BEFORE UPDATE ON public.tenant_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential numbering function: scoped per (tenant, year, doc_type)
CREATE OR REPLACE FUNCTION public.next_invoice_number(
  _tenant_id UUID,
  _doc_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix TEXT;
  _year TEXT;
  _next_seq INT;
  _result TEXT;
BEGIN
  IF _doc_type = 'receipt' THEN
    _prefix := 'RCT';
  ELSE
    _prefix := 'INV';
  END IF;

  _year := to_char(now(), 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        regexp_replace(invoice_number, '^' || _prefix || '-' || _year || '-', '')
        AS INT
      )
    ), 0
  ) + 1
  INTO _next_seq
  FROM public.tenant_invoices
  WHERE tenant_id = _tenant_id
    AND invoice_number LIKE _prefix || '-' || _year || '-%';

  _result := _prefix || '-' || _year || '-' || lpad(_next_seq::TEXT, 4, '0');
  RETURN _result;
END;
$$;