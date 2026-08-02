-- =============================================================================
-- 012 — EVIDENCE INTEGRITY CONSTRAINTS
-- =============================================================================
-- PROPOSED — not yet applied. Review before running `supabase db push`.
--
-- Raised by the mobile team: `evidence.file_size` is nullable. Checking that
-- turned up the more consequential one — **`file_hash` is nullable too**.
--
-- Why that matters more than it looks:
--
--   The platform's central claim is that filed evidence is tamper-evident. That
--   rests entirely on file_hash. But nothing currently requires it, so a client
--   can insert evidence with no hash at all — and downloadAndVerify() then
--   returns `verified: null` ("unknown"), not `false`. A file that never had a
--   hash is therefore indistinguishable from one that was simply never checked,
--   and the UI shows neither a tick nor a warning.
--
--   In other words the integrity guarantee is currently opt-in, decided by
--   whichever client wrote the row. It should be a property of the table.
--
-- The CHECK on the digest format is the part worth arguing about, so it is
-- called out explicitly below.
--
-- SAFETY: `evidence` currently holds 0 rows (verified 30 July 2026), so there is
-- nothing to backfill and no risk of the NOT NULL failing on legacy data. If
-- that is no longer true when you run this, the backfill in section 0 must be
-- resolved first — the migration will abort rather than guess.
-- =============================================================================


-- =============================================================================
-- SECTION 0 — Refuse to run if there is data that would need a judgement call
-- =============================================================================
-- Better to fail loudly here than to invent a hash for real evidence.

DO $$
DECLARE
  v_bad INT;
BEGIN
  SELECT count(*) INTO v_bad
  FROM public.evidence
  WHERE file_hash IS NULL OR file_size IS NULL;

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'Cannot apply: % evidence row(s) have a NULL file_hash or file_size. '
      'These predate the constraint and cannot be hashed retroactively — the '
      'bytes may have changed since filing, so any hash computed now would '
      'assert an integrity that was never verified. Decide explicitly: either '
      'delete them, or move them to a quarantine table, then re-run.',
      v_bad;
  END IF;
END $$;


-- =============================================================================
-- SECTION 1 — Require the hash and the size
-- =============================================================================

ALTER TABLE public.evidence
  ALTER COLUMN file_hash SET NOT NULL,
  ALTER COLUMN file_size SET NOT NULL;


-- =============================================================================
-- SECTION 2 — Require the hash to LOOK like a SHA-256 digest
-- =============================================================================
-- This is the part to review carefully.
--
-- It rejects anything that is not 64 lowercase hex characters. That catches the
-- specific failure the mobile team flagged during implementation: hashing a
-- base64 string instead of the decoded bytes. A base64 SHA-256 digest is 44
-- characters with `+/=`, so it fails this check at the database boundary rather
-- than silently storing a value that can never verify.
--
-- It also catches a truncated digest, an uppercase digest from a different
-- library, and a placeholder string.
--
-- The trade-off: if you ever switch digest algorithms (SHA-512, BLAKE3) this
-- constraint has to change with it. That is arguably a feature — an algorithm
-- change should be a deliberate migration, not something a client can do by
-- writing a different-shaped string.

ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_file_hash_is_sha256;

ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_file_hash_is_sha256
  CHECK (file_hash ~ '^[0-9a-f]{64}$');

-- A zero-byte file is not evidence of anything, and is usually a failed read.
ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_file_size_positive;

ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_file_size_positive
  CHECK (file_size > 0);


-- =============================================================================
-- SECTION 3 — Same treatment for the professional deliverables
-- =============================================================================
-- legal_documents carries a hash for the same reason evidence does: a filed
-- affidavit that cannot be shown to be unaltered is not much use in a
-- proceeding. It is currently nullable.
--
-- NOT enforced as NOT NULL here, because unlike `evidence` this table may
-- already hold rows in other environments and the failure mode is worse (a
-- lawyer blocked from filing). The format check applies only when a hash is
-- present, which is safe either way.

ALTER TABLE public.legal_documents
  DROP CONSTRAINT IF EXISTS legal_documents_file_hash_is_sha256;

ALTER TABLE public.legal_documents
  ADD CONSTRAINT legal_documents_file_hash_is_sha256
  CHECK (file_hash IS NULL OR file_hash ~ '^[0-9a-f]{64}$');


-- =============================================================================
-- Verification
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evidence'
      AND column_name IN ('file_hash', 'file_size')
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'evidence.file_hash / file_size are still nullable';
  END IF;

  RAISE NOTICE 'Evidence integrity constraints applied: hash and size now required, digest format enforced.';
END $$;
