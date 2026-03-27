-- The Security Watch - Initial Database Schema
-- Integrated: Investigative Services | Institutional Transparency | Property Verification & Marketplace

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TRIGGER FUNCTION: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- HELPER FUNCTION: Check if current user is admin
-- =============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HELPER FUNCTION: Check if user is case participant (complainant or assigned)
-- =============================================================================
CREATE OR REPLACE FUNCTION is_case_participant(p_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = p_case_id
    AND (
      c.complainant_id = auth.uid()
      OR c.assigned_investigator_id = auth.uid()
      OR c.assigned_lawyer_id = auth.uid()
      OR c.assigned_expert_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HELPER FUNCTION: Check if user is conversation participant
-- =============================================================================
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TABLE: profiles
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN (
    'complainant', 'investigator', 'lawyer', 'medical_expert', 'witness',
    'landlord', 'tenant', 'media_agent', 'admin'
  )),
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  bio TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX idx_profiles_email ON public.profiles(email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (is_admin());

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: cases
-- =============================================================================
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'fraud', 'robbery', 'murder', 'assault', 'domestic_dispute', 'land_dispute',
    'cybercrime', 'corruption', 'kidnapping', 'missing_person', 'other'
  )),
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'assigned', 'investigating', 'legal_processing',
    'completed', 'closed'
  )),
  location TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  complainant_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  assigned_investigator_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  assigned_lawyer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  assigned_expert_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_complainant_id ON public.cases(complainant_id);
CREATE INDEX idx_cases_assigned_investigator_id ON public.cases(assigned_investigator_id);
CREATE INDEX idx_cases_assigned_lawyer_id ON public.cases(assigned_lawyer_id);
CREATE INDEX idx_cases_assigned_expert_id ON public.cases(assigned_expert_id);
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_category ON public.cases(category);
CREATE INDEX idx_cases_urgency ON public.cases(urgency);
CREATE INDEX idx_cases_created_at ON public.cases(created_at DESC);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants can read case" ON public.cases
  FOR SELECT USING (
    complainant_id = auth.uid()
    OR assigned_investigator_id = auth.uid()
    OR assigned_lawyer_id = auth.uid()
    OR assigned_expert_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "Authenticated users can create cases" ON public.cases
  FOR INSERT WITH CHECK (auth.uid() = complainant_id);

CREATE POLICY "Case participants can update case" ON public.cases
  FOR UPDATE USING (
    complainant_id = auth.uid()
    OR assigned_investigator_id = auth.uid()
    OR assigned_lawyer_id = auth.uid()
    OR assigned_expert_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "Admins can read all cases" ON public.cases
  FOR SELECT USING (is_admin());

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: evidence
-- =============================================================================
CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  description TEXT,
  chain_of_custody JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_case_id ON public.evidence(case_id);
CREATE INDEX idx_evidence_uploaded_by ON public.evidence(uploaded_by);
CREATE INDEX idx_evidence_created_at ON public.evidence(created_at DESC);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants can read evidence" ON public.evidence
  FOR SELECT USING (is_case_participant(case_id) OR is_admin());

CREATE POLICY "Case participants can insert evidence" ON public.evidence
  FOR INSERT WITH CHECK (is_case_participant(case_id) OR is_admin());

CREATE POLICY "Case participants can update evidence" ON public.evidence
  FOR UPDATE USING (is_case_participant(case_id) OR is_admin());

CREATE POLICY "Admins can manage all evidence" ON public.evidence
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: investigators
-- =============================================================================
CREATE TABLE public.investigators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  specialization TEXT[] NOT NULL DEFAULT '{}',
  experience_years INT NOT NULL DEFAULT 0,
  service_area TEXT,
  rating NUMERIC NOT NULL DEFAULT 0,
  total_cases INT NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  id_document_url TEXT,
  service_records_url TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigators_user_id ON public.investigators(user_id);
CREATE INDEX idx_investigators_verification_status ON public.investigators(verification_status);
CREATE INDEX idx_investigators_rating ON public.investigators(rating DESC);
CREATE INDEX idx_investigators_specialization ON public.investigators USING GIN(specialization);

ALTER TABLE public.investigators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved investigators" ON public.investigators
  FOR SELECT USING (verification_status = 'approved' OR user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own investigator profile" ON public.investigators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investigator profile" ON public.investigators
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all investigators" ON public.investigators
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: guarantors
-- =============================================================================
CREATE TABLE public.guarantors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investigator_id UUID NOT NULL REFERENCES public.investigators(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL,
  id_document_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guarantors_investigator_id ON public.guarantors(investigator_id);
CREATE INDEX idx_guarantors_verification_status ON public.guarantors(verification_status);

ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investigator can read own guarantors" ON public.guarantors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.investigators i WHERE i.id = investigator_id AND i.user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Investigator can insert guarantors" ON public.guarantors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.investigators i WHERE i.id = investigator_id AND i.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all guarantors" ON public.guarantors
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: conversations
-- =============================================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_case_id ON public.conversations(case_id);
CREATE INDEX idx_conversations_type ON public.conversations(type);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read conversations" ON public.conversations
  FOR SELECT USING (is_conversation_participant(id) OR is_admin());

CREATE POLICY "Case participants can create case conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    case_id IS NULL OR is_case_participant(case_id) OR is_admin()
  );

CREATE POLICY "Admins can manage all conversations" ON public.conversations
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: conversation_participants
-- =============================================================================
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants(user_id);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read conversation participants" ON public.conversation_participants
  FOR SELECT USING (is_conversation_participant(conversation_id) OR is_admin());

CREATE POLICY "Participants can add self to conversation" ON public.conversation_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove self from conversation" ON public.conversation_participants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all participants" ON public.conversation_participants
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: messages
-- =============================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can read messages" ON public.messages
  FOR SELECT USING (is_conversation_participant(conversation_id) OR is_admin());

CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "Admins can manage all messages" ON public.messages
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: properties
-- =============================================================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('apartment', 'house', 'land', 'commercial', 'office')),
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  bedrooms INT,
  bathrooms INT,
  area_sqm NUMERIC,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'pending', 'verified')),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  images TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_listing_type ON public.properties(listing_type);
CREATE INDEX idx_properties_is_active ON public.properties(is_active);
CREATE INDEX idx_properties_price ON public.properties(price);
CREATE INDEX idx_properties_property_type ON public.properties(property_type);
CREATE INDEX idx_properties_created_at ON public.properties(created_at DESC);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active properties visible to all" ON public.properties
  FOR SELECT USING (is_active = true OR owner_id = auth.uid() OR is_admin());

CREATE POLICY "Owners can insert properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id OR is_admin());

CREATE POLICY "Admins can manage all properties" ON public.properties
  FOR ALL USING (is_admin());

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: property_documents
-- =============================================================================
CREATE TABLE public.property_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_documents_property_id ON public.property_documents(property_id);
CREATE INDEX idx_property_documents_document_type ON public.property_documents(document_type);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property visible documents readable" ON public.property_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_active = true OR p.owner_id = auth.uid()))
    OR is_admin()
  );

CREATE POLICY "Property owners can manage documents" ON public.property_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
    OR is_admin()
  );

-- =============================================================================
-- TABLE: property_requests
-- =============================================================================
CREATE TABLE public.property_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_requests_property_id ON public.property_requests(property_id);
CREATE INDEX idx_property_requests_requester_id ON public.property_requests(requester_id);
CREATE INDEX idx_property_requests_status ON public.property_requests(status);

ALTER TABLE public.property_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester and owner can read requests" ON public.property_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Users can create requests" ON public.property_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Property owners can update request status" ON public.property_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
    OR is_admin()
  );

-- =============================================================================
-- TABLE: institutions
-- =============================================================================
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('police', 'school', 'hospital', 'market', 'government', 'court', 'other')),
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  supervising_authority TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_type ON public.institutions(type);
CREATE INDEX idx_institutions_name ON public.institutions(name);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institutions visible to all" ON public.institutions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage institutions" ON public.institutions
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: media_reports
-- =============================================================================
CREATE TABLE public.media_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  reporter_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio', 'photo', 'document')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_reports_institution_id ON public.media_reports(institution_id);
CREATE INDEX idx_media_reports_reporter_id ON public.media_reports(reporter_id);
CREATE INDEX idx_media_reports_status ON public.media_reports(status);
CREATE INDEX idx_media_reports_created_at ON public.media_reports(created_at DESC);
CREATE INDEX idx_media_reports_tags ON public.media_reports USING GIN(tags);

ALTER TABLE public.media_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published reports visible to all" ON public.media_reports
  FOR SELECT USING (
    status = 'published'
    OR reporter_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "Users can create media reports" ON public.media_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter and admin can update reports" ON public.media_reports
  FOR UPDATE USING (reporter_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage all media reports" ON public.media_reports
  FOR ALL USING (is_admin());

CREATE TRIGGER media_reports_updated_at
  BEFORE UPDATE ON public.media_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: performance_scores
-- =============================================================================
CREATE TABLE public.performance_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  scorer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  punctuality INT NOT NULL CHECK (punctuality >= 1 AND punctuality <= 5),
  professionalism INT NOT NULL CHECK (professionalism >= 1 AND professionalism <= 5),
  cleanliness INT NOT NULL CHECK (cleanliness >= 1 AND cleanliness <= 5),
  integrity INT NOT NULL CHECK (integrity >= 1 AND integrity <= 5),
  service_delivery INT NOT NULL CHECK (service_delivery >= 1 AND service_delivery <= 5),
  overall_score NUMERIC NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_performance_scores_institution_id ON public.performance_scores(institution_id);
CREATE INDEX idx_performance_scores_scorer_id ON public.performance_scores(scorer_id);
CREATE INDEX idx_performance_scores_overall_score ON public.performance_scores(overall_score DESC);

ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Performance scores visible to all" ON public.performance_scores
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit scores" ON public.performance_scores
  FOR INSERT WITH CHECK (auth.uid() = scorer_id);

CREATE POLICY "Scorer can update own score" ON public.performance_scores
  FOR UPDATE USING (auth.uid() = scorer_id);

CREATE POLICY "Admins can manage all scores" ON public.performance_scores
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: payments
-- =============================================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paystack')),
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_payer_id ON public.payments(payer_id);
CREATE INDEX idx_payments_case_id ON public.payments(case_id);
CREATE INDEX idx_payments_property_id ON public.payments(property_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payers can read own payments" ON public.payments
  FOR SELECT USING (payer_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = payer_id);

CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (mark read)" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications for self" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications" ON public.notifications
  FOR ALL USING (is_admin());

-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs read-only for admins" ON public.audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can insert audit logs for own actions" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "No updates or deletes on audit logs" ON public.audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "No deletes on audit logs" ON public.audit_logs
  FOR DELETE USING (false);

-- =============================================================================
-- TRIGGER: Auto-create profile on auth signup (optional - for Supabase Auth)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'complainant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
