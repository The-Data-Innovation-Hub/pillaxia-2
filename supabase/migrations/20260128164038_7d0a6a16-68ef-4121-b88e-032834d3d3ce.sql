-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');

-- Organization subscriptions table
CREATE TABLE public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  seats_purchased INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Organization invoices table
CREATE TABLE public.organization_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  amount_due INTEGER NOT NULL,
  amount_paid INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payment methods table
CREATE TABLE public.organization_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'card',
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Billing history/events table
CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  description TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_subscriptions
CREATE POLICY "Org admins can view their subscription"
  ON public.organization_subscriptions
  FOR SELECT
  USING (
    public.is_admin(auth.uid()) OR
    public.is_org_admin_for(auth.uid(), organization_id) OR
    public.is_manager_for_org(auth.uid(), organization_id)
  );

CREATE POLICY "Only platform admins can modify subscriptions"
  ON public.organization_subscriptions
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for organization_invoices
CREATE POLICY "Org admins can view their invoices"
  ON public.organization_invoices
  FOR SELECT
  USING (
    public.is_admin(auth.uid()) OR
    public.is_org_admin_for(auth.uid(), organization_id) OR
    public.is_manager_for_org(auth.uid(), organization_id)
  );

CREATE POLICY "Only platform admins can modify invoices"
  ON public.organization_invoices
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for organization_payment_methods
CREATE POLICY "Org admins can view their payment methods"
  ON public.organization_payment_methods
  FOR SELECT
  USING (
    public.is_admin(auth.uid()) OR
    public.is_org_admin_for(auth.uid(), organization_id)
  );

CREATE POLICY "Only platform admins can modify payment methods"
  ON public.organization_payment_methods
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for billing_events
CREATE POLICY "Org admins can view their billing events"
  ON public.billing_events
  FOR SELECT
  USING (
    public.is_admin(auth.uid()) OR
    public.is_org_admin_for(auth.uid(), organization_id) OR
    public.is_manager_for_org(auth.uid(), organization_id)
  );

CREATE POLICY "Only platform admins can create billing events"
  ON public.billing_events
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_org_subscriptions_org_id ON public.organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_stripe_sub ON public.organization_subscriptions(stripe_subscription_id);
CREATE INDEX idx_org_invoices_org_id ON public.organization_invoices(organization_id);
CREATE INDEX idx_billing_events_org_id ON public.billing_events(organization_id);

-- Add trigger for updated_at
CREATE TRIGGER update_org_subscriptions_updated_at
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_invoices_updated_at
  BEFORE UPDATE ON public.organization_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_payment_methods_updated_at
  BEFORE UPDATE ON public.organization_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to count seats used by an organization
CREATE OR REPLACE FUNCTION public.count_org_seats_used(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND is_active = true
$$;

-- Function to check if org has available seats
CREATE OR REPLACE FUNCTION public.org_has_available_seats(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT seats_purchased > seats_used
     FROM public.organization_subscriptions
     WHERE organization_id = p_org_id
       AND status IN ('active', 'trialing')),
    false
  )
$$;