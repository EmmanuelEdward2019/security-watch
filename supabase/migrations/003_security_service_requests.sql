-- =============================================================================
-- TABLE: security_service_requests
-- Stores enquiries / service requests submitted via the Fountain Source pages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.security_service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'security_guards',
    'security_surveillance',
    'security_escorts',
    'event_security',
    'private_protection',
    'home_security',
    'infrastructure_security',
    'maritime_security',
    'security_training',
    'debt_recovery',
    'construction',
    'logistics',
    'other'
  )),
  location TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'in_progress', 'completed', 'cancelled')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssr_status ON public.security_service_requests(status);
CREATE INDEX IF NOT EXISTS idx_ssr_service_type ON public.security_service_requests(service_type);
CREATE INDEX IF NOT EXISTS idx_ssr_created_at ON public.security_service_requests(created_at DESC);

ALTER TABLE public.security_service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a request"
  ON public.security_service_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read all requests"
  ON public.security_service_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update requests"
  ON public.security_service_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER ssr_updated_at
  BEFORE UPDATE ON public.security_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
