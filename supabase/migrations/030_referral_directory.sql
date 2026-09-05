-- ============================================================================
-- 030 — Referral directory
-- ============================================================================
--
-- Most reports will never become a paid engagement. Today those people get a
-- case row and silence, which is the worst possible answer for the majority of
-- everyone who ever touches this platform.
--
-- What someone actually needs on the night is concrete and local: which
-- command has jurisdiction, what to do when the demand is for a bribe, which
-- organisation handles this category, where a sexual assault referral centre
-- is, what number a missing person goes to. None of that requires an account,
-- a payment, or a professional. It requires a directory.
--
-- READABLE WITHOUT AN ACCOUNT. Deliberately anon-readable. Someone looking for
-- an emergency number at two in the morning must not be asked to sign up
-- first, and this is also the surface that earns the platform its reputation —
-- the paid work comes out of trust built here.
--
-- SEEDED INACTIVE, ON PURPOSE. Section 4 inserts real organisations with their
-- mandates and official websites, and every row lands with `is_active = false`.
-- A wrong telephone number in a security application is not a cosmetic defect;
-- it is someone in trouble dialling a number that does not answer. Contact
-- details must be checked by a human against the organisation's own published
-- source and switched on deliberately. `admin_verify_referral` is that step,
-- and `verified_at` / `verified_by` record who stood behind it.
-- ============================================================================

-- ── SECTION 1 — the directory ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_resources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),

  -- What kind of body this is, which is what tells someone whether it is the
  -- right door. A regulator and a shelter are not interchangeable.
  kind        TEXT NOT NULL CHECK (kind IN (
    'emergency', 'police', 'anti_corruption', 'legal_aid', 'human_rights',
    'medical', 'shelter', 'ngo', 'regulator', 'missing_persons'
  )),

  -- Matches `cases.category` so a referral can be looked up straight from a
  -- report, plus 'any' for bodies that take everything (an emergency line).
  category    TEXT NOT NULL DEFAULT 'any' CHECK (category IN (
    'any', 'fraud', 'robbery', 'murder', 'assault', 'domestic_dispute',
    'land_dispute', 'cybercrime', 'corruption', 'kidnapping', 'missing_person',
    'other'
  )),

  -- A Nigerian state, or 'national' for bodies that cover the whole country.
  -- Constrained rather than free text: "Lagos", "lagos" and "Lagos State" as
  -- three separate values would quietly break every lookup.
  state       TEXT NOT NULL DEFAULT 'national' CHECK (state IN (
    'national',
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
    'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
    'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  )),

  phone       TEXT,
  alt_phone   TEXT,
  email       TEXT,
  website     TEXT,
  address     TEXT,

  -- What this body actually does, in plain words. The difference between a
  -- directory and a useful directory.
  guidance    TEXT,

  -- Ordering hint. An emergency line outranks a general enquiry desk however
  -- the alphabet feels about it.
  priority    INT NOT NULL DEFAULT 100,

  -- False until a person has checked the contact details. See the header.
  is_active   BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same body, same state, same category, twice, is a data-entry slip.
  CONSTRAINT referral_is_unique UNIQUE (name, state, category)
);

CREATE INDEX IF NOT EXISTS idx_referrals_lookup
  ON public.referral_resources(category, state, priority)
  WHERE is_active;

ALTER TABLE public.referral_resources ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS referral_resources_updated_at ON public.referral_resources;
CREATE TRIGGER referral_resources_updated_at
  BEFORE UPDATE ON public.referral_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Anyone, signed in or not, sees the ACTIVE rows. Nobody but an admin sees the
-- unverified ones — an unchecked number must not reach a member of the public
-- through some other listing.
DROP POLICY IF EXISTS "Anyone can read active referrals" ON public.referral_resources;
CREATE POLICY "Anyone can read active referrals" ON public.referral_resources
  FOR SELECT USING (is_active);

DROP POLICY IF EXISTS "Admins can read every referral" ON public.referral_resources;
CREATE POLICY "Admins can read every referral" ON public.referral_resources
  FOR SELECT USING (public.is_admin());

-- Writes are admin-only and go through the RPCs in section 3, so `verified_by`
-- is always the person who actually looked.
DROP POLICY IF EXISTS "Admins can write referrals" ON public.referral_resources;
CREATE POLICY "Admins can write referrals" ON public.referral_resources
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.referral_resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.referral_resources TO authenticated;

-- ── SECTION 2 — looking one up ──────────────────────────────────────────────

-- Ordered the way somebody in trouble needs them: their own state before the
-- national body, the specific category before the catch-all, and the emergency
-- line before either.
CREATE OR REPLACE FUNCTION public.find_referrals(
  p_category TEXT DEFAULT NULL,
  p_state    TEXT DEFAULT NULL,
  p_limit    INT DEFAULT 20
)
RETURNS TABLE (
  id       UUID,
  name     TEXT,
  kind     TEXT,
  category TEXT,
  state    TEXT,
  phone    TEXT,
  alt_phone TEXT,
  email    TEXT,
  website  TEXT,
  address  TEXT,
  guidance TEXT,
  is_local BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id, r.name, r.kind, r.category, r.state,
    r.phone, r.alt_phone, r.email, r.website, r.address, r.guidance,
    (p_state IS NOT NULL AND r.state = p_state)
  FROM public.referral_resources r
  WHERE r.is_active
    AND (p_category IS NULL OR r.category = p_category OR r.category = 'any')
    AND (p_state IS NULL OR r.state = p_state OR r.state = 'national')
  ORDER BY
    -- An emergency number is the first thing on the page, always.
    (r.kind = 'emergency') DESC,
    -- Then anything in their own state, which is who can actually attend.
    (p_state IS NOT NULL AND r.state = p_state) DESC,
    -- Then the body that handles this specific category over the general desk.
    (p_category IS NOT NULL AND r.category = p_category) DESC,
    r.priority,
    r.name
  LIMIT GREATEST(LEAST(coalesce(p_limit, 20), 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.find_referrals(TEXT, TEXT, INT) TO anon, authenticated;

-- ── SECTION 3 — verifying, before anything is shown ─────────────────────────

CREATE OR REPLACE FUNCTION public.admin_verify_referral(
  p_id     UUID,
  p_active BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  UPDATE public.referral_resources
  SET is_active   = p_active,
      -- Clearing these on deactivation is deliberate: a row switched back off
      -- because its number turned out to be wrong must not still claim it was
      -- verified. The next person has to check it again.
      verified_at = CASE WHEN p_active THEN now() ELSE NULL END,
      verified_by = CASE WHEN p_active THEN auth.uid() ELSE NULL END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_referral(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_referral(UUID, BOOLEAN) TO authenticated;

-- The admin queue: everything still waiting to be checked.
CREATE OR REPLACE FUNCTION public.admin_unverified_referrals()
RETURNS TABLE (
  id       UUID,
  name     TEXT,
  kind     TEXT,
  category TEXT,
  state    TEXT,
  phone    TEXT,
  website  TEXT,
  guidance TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  RETURN QUERY
  SELECT r.id, r.name, r.kind, r.category, r.state, r.phone, r.website, r.guidance
  FROM public.referral_resources r
  WHERE NOT r.is_active
  ORDER BY r.priority, r.name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unverified_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unverified_referrals() TO authenticated;

-- ── SECTION 4 — the seed ────────────────────────────────────────────────────
--
-- Real bodies, with their mandates and their official web addresses. Telephone
-- numbers are left NULL except where the number is a nationally published
-- short code, because a number recalled rather than checked is exactly the
-- kind of thing that gets someone hurt. Every row is inactive; an
-- administrator fills in the contact details from the organisation's own site
-- and switches it on.
--
-- ON CONFLICT DO NOTHING so this migration is safe to re-run and never
-- overwrites a correction an administrator has already made.

INSERT INTO public.referral_resources
  (name, kind, category, state, phone, website, guidance, priority, is_active)
VALUES
  -- 112 is Nigeria's published national emergency number, routed through the
  -- state Emergency Communication Centres. It is the one number in this seed
  -- carried with confidence; everything else is left for verification.
  ('National Emergency Number', 'emergency', 'any', 'national', '112', NULL,
   'Free from any phone, day or night. Routed to the emergency call centre for '
   || 'your state — police, fire or ambulance. Use this first if anyone is in '
   || 'immediate danger.', 1, false),

  ('Nigeria Police Force — Complaint Response Unit', 'police', 'any', 'national',
   NULL, 'https://npf.gov.ng',
   'Where to take a complaint about the conduct of police officers themselves, '
   || 'including unlawful arrest and demands for money. Separate from the '
   || 'division you would report a crime to.', 10, false),

  ('Nigeria Police Force — National Cybercrime Centre', 'police', 'cybercrime',
   'national', NULL, 'https://npf.gov.ng',
   'Online fraud, account takeovers, blackmail using intimate images, and '
   || 'impersonation. Bring screenshots, account names and transaction '
   || 'references — the case is only as good as what you kept.', 20, false),

  ('Economic and Financial Crimes Commission (EFCC)', 'anti_corruption', 'fraud',
   'national', NULL, 'https://www.efcc.gov.ng',
   'Financial crime: advance-fee fraud, investment schemes, money laundering '
   || 'and large-scale theft. Report with bank details, dates and amounts.',
   30, false),

  ('Independent Corrupt Practices Commission (ICPC)', 'anti_corruption',
   'corruption', 'national', NULL, 'https://icpc.gov.ng',
   'Bribery and abuse of office by public officials, and corruption in the '
   || 'award or delivery of public contracts.', 31, false),

  ('National Human Rights Commission (NHRC)', 'human_rights', 'any', 'national',
   NULL, 'https://www.nigeriarights.gov.ng',
   'Unlawful detention, torture, extrajudicial killing and other abuses by '
   || 'state actors. Takes complaints directly from the public and can '
   || 'investigate on its own initiative.', 40, false),

  ('Legal Aid Council of Nigeria', 'legal_aid', 'any', 'national', NULL,
   'https://legalaidcouncil.gov.ng',
   'Free legal representation for people who cannot afford a lawyer, in '
   || 'criminal matters and some civil ones. Has an office in every state.',
   50, false),

  ('NAPTIP — trafficking and violence against persons', 'ngo', 'any', 'national',
   NULL, 'https://www.naptip.gov.ng',
   'Human trafficking, forced labour, and offences under the Violence Against '
   || 'Persons (Prohibition) Act — including domestic violence and sexual '
   || 'offences.', 60, false),

  ('Nigerian Communications Commission (NCC)', 'regulator', 'cybercrime',
   'national', NULL, 'https://www.ncc.gov.ng',
   'Complaints against telephone networks: SIM swap fraud, unsolicited '
   || 'charges, and refusal to act on a compromised line.', 70, false),

  ('Lagos State Domestic and Sexual Violence Agency (DSVA)', 'shelter',
   'domestic_dispute', 'Lagos', NULL, 'https://lagosstatedsva.org',
   'Domestic and sexual violence in Lagos State. Provides shelter, counselling '
   || 'and help pursuing a case through the courts.', 15, false),

  ('Mirabel Centre', 'medical', 'assault', 'Lagos', NULL,
   'https://mirabelcentre.org',
   'Sexual assault referral centre at Lagos State University Teaching '
   || 'Hospital, Ikeja. Free medical care and forensic examination. Going '
   || 'early, before washing or changing clothes, preserves evidence.',
   16, false)
ON CONFLICT (name, state, category) DO NOTHING;
