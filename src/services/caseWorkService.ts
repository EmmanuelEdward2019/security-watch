import { supabase, STORAGE_BUCKETS, buildObjectPath, uploadFile, generateFileHash, getSignedUrl } from '@/lib/supabase';
import { notifyByEmail } from '@/lib/email';
import type {
  InvestigationReport,
  LegalDocument,
  LegalDocumentType,
  ForensicAnalysis,
  ForensicAnalysisType,
  ForensicConfidence,
  StoredAttachment,
  Case,
  Evidence,
} from '@/types';

/**
 * The professional deliverables of the investigative module: investigator
 * reports, lawyer filings, and forensic analyses.
 *
 * All three screens previously rendered hardcoded arrays and faked submission
 * with a setTimeout, which meant investigators could not file findings, and the
 * lawyer and medical-expert roles had no working feature at all.
 *
 * Attachments are stored as object paths plus a SHA-256 hash, never as URLs —
 * the buckets are private and read through short-lived signed URLs.
 */

// =============================================================================
// Shared attachment handling
// =============================================================================

async function uploadAttachments(
  bucket: typeof STORAGE_BUCKETS.EVIDENCE | typeof STORAGE_BUCKETS.LEGAL_DOCUMENTS,
  scopeId: string,
  files: File[]
): Promise<{ attachments: StoredAttachment[]; error: string | null }> {
  const attachments: StoredAttachment[] = [];

  for (const file of files) {
    const path = buildObjectPath(scopeId, file.name);
    const hash = await generateFileHash(file);
    const { path: storedPath, error } = await uploadFile(bucket, path, file);

    if (error) {
      return { attachments, error: `Could not upload ${file.name}: ${error}` };
    }
    attachments.push({
      path: storedPath,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      hash,
    });
  }

  return { attachments, error: null };
}

/** Signs an attachment for download. Storage RLS decides whether it succeeds. */
export async function getAttachmentUrl(
  bucket: typeof STORAGE_BUCKETS.EVIDENCE | typeof STORAGE_BUCKETS.LEGAL_DOCUMENTS,
  path: string
): Promise<string | null> {
  const { url } = await getSignedUrl(bucket, path, 600);
  return url;
}

// =============================================================================
// Cases the current user may file work against
// =============================================================================

/**
 * Cases assigned to the signed-in professional.
 *
 * RLS already restricts `cases` to participants, so no role filter is needed
 * here — the query returns exactly what this user is entitled to see.
 */
export async function fetchMyAssignedCases(): Promise<{
  cases: Pick<Case, 'id' | 'title' | 'status' | 'category' | 'urgency' | 'location' | 'created_at'>[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('cases')
    .select('id, title, status, category, urgency, location, created_at')
    .not('status', 'in', '("closed")')
    .order('created_at', { ascending: false });

  if (error) return { cases: [], error: error.message };
  return { cases: (data ?? []) as Pick<Case, 'id' | 'title' | 'status' | 'category' | 'urgency' | 'location' | 'created_at'>[], error: null };
}

/** Evidence on a case, for an expert to attach an analysis to. */
export async function fetchCaseEvidence(
  caseId: string
): Promise<{ evidence: Evidence[]; error: string | null }> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) return { evidence: [], error: error.message };
  return { evidence: (data ?? []) as Evidence[], error: null };
}

// =============================================================================
// Investigation reports
// =============================================================================

export interface SubmitReportInput {
  caseId: string;
  title: string;
  findings: string;
  recommendations?: string;
  files?: File[];
  asDraft?: boolean;
}

export async function submitInvestigationReport(
  input: SubmitReportInput,
  authorId: string
): Promise<{ id: string | null; error: string | null }> {
  const { attachments, error: uploadErr } = await uploadAttachments(
    STORAGE_BUCKETS.EVIDENCE,
    input.caseId,
    input.files ?? []
  );
  if (uploadErr) return { id: null, error: uploadErr };

  const { data, error } = await supabase
    .from('investigation_reports')
    .insert({
      case_id: input.caseId,
      author_id: authorId,
      title: input.title,
      findings: input.findings,
      recommendations: input.recommendations ?? null,
      attachments,
      status: input.asDraft ? 'draft' : 'submitted',
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };

  // Tell the complainant a report has landed, without leaking its contents.
  if (!input.asDraft) {
    const { data: caseRow } = await supabase
      .from('cases')
      .select('complainant_id, title')
      .eq('id', input.caseId)
      .maybeSingle();

    if (caseRow?.complainant_id) {
      notifyByEmail(caseRow.complainant_id, 'report_ready', {
        caseTitle: caseRow.title,
        caseId: input.caseId,
        actionUrl: `${window.location.origin}/app/cases/${input.caseId}`,
      });
    }
  }

  return { id: data.id, error: null };
}

export async function fetchInvestigationReports(options?: {
  caseId?: string;
  authorId?: string;
}): Promise<{ reports: InvestigationReport[]; error: string | null }> {
  let query = supabase
    .from('investigation_reports')
    .select('*, case:cases(id, title, status, category)')
    .order('created_at', { ascending: false });

  if (options?.caseId) query = query.eq('case_id', options.caseId);
  if (options?.authorId) query = query.eq('author_id', options.authorId);

  const { data, error } = await query;
  if (error) return { reports: [], error: error.message };
  return { reports: (data ?? []) as InvestigationReport[], error: null };
}

export async function updateInvestigationReport(
  id: string,
  updates: Partial<Pick<InvestigationReport, 'title' | 'findings' | 'recommendations' | 'status'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('investigation_reports').update(updates).eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Legal documents
// =============================================================================

export interface UploadLegalDocumentInput {
  caseId?: string | null;
  documentType: LegalDocumentType;
  title: string;
  description?: string;
  file: File;
}

export async function uploadLegalDocument(
  input: UploadLegalDocumentInput,
  authorId: string
): Promise<{ id: string | null; error: string | null }> {
  // Path is keyed by author: the legal-documents storage policy grants the
  // author, admins, and participants of the linked case.
  const path = buildObjectPath(authorId, input.file.name);
  const hash = await generateFileHash(input.file);

  const { path: storedPath, error: uploadErr } = await uploadFile(
    STORAGE_BUCKETS.LEGAL_DOCUMENTS,
    path,
    input.file
  );
  if (uploadErr) return { id: null, error: uploadErr };

  const { data, error } = await supabase
    .from('legal_documents')
    .insert({
      case_id: input.caseId ?? null,
      author_id: authorId,
      document_type: input.documentType,
      title: input.title,
      description: input.description ?? null,
      file_path: storedPath,
      file_name: input.file.name,
      file_size: input.file.size,
      file_hash: hash,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function fetchLegalDocuments(options?: {
  caseId?: string;
  authorId?: string;
}): Promise<{ documents: LegalDocument[]; error: string | null }> {
  let query = supabase
    .from('legal_documents')
    .select('*, case:cases(id, title)')
    .order('created_at', { ascending: false });

  if (options?.caseId) query = query.eq('case_id', options.caseId);
  if (options?.authorId) query = query.eq('author_id', options.authorId);

  const { data, error } = await query;
  if (error) return { documents: [], error: error.message };
  return { documents: (data ?? []) as LegalDocument[], error: null };
}

export async function updateLegalDocumentStatus(
  id: string,
  status: LegalDocument['status']
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('legal_documents')
    .update({
      status,
      filed_at: status === 'filed' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteLegalDocument(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('legal_documents').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// =============================================================================
// Forensic analyses
// =============================================================================

export interface SubmitAnalysisInput {
  caseId: string;
  evidenceId?: string | null;
  analysisType: ForensicAnalysisType;
  methodology?: string;
  findings: string;
  conclusion: string;
  confidence: ForensicConfidence;
  files?: File[];
  status?: ForensicAnalysis['status'];
}

export async function submitForensicAnalysis(
  input: SubmitAnalysisInput,
  expertId: string
): Promise<{ id: string | null; error: string | null }> {
  const { attachments, error: uploadErr } = await uploadAttachments(
    STORAGE_BUCKETS.EVIDENCE,
    input.caseId,
    input.files ?? []
  );
  if (uploadErr) return { id: null, error: uploadErr };

  const { data, error } = await supabase
    .from('forensic_analyses')
    .insert({
      case_id: input.caseId,
      evidence_id: input.evidenceId ?? null,
      expert_id: expertId,
      analysis_type: input.analysisType,
      methodology: input.methodology ?? null,
      findings: input.findings,
      conclusion: input.conclusion,
      confidence: input.confidence,
      attachments,
      status: input.status ?? 'completed',
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };

  // Examining evidence is a custody event, so it goes on the record.
  if (input.evidenceId) {
    await supabase.rpc('append_custody_entry', {
      p_evidence_id: input.evidenceId,
      p_action: 'analysed',
      p_notes: `Forensic analysis recorded: ${input.analysisType}`,
    });
  }

  return { id: data.id, error: null };
}

export async function fetchForensicAnalyses(options?: {
  caseId?: string;
  expertId?: string;
}): Promise<{ analyses: ForensicAnalysis[]; error: string | null }> {
  let query = supabase
    .from('forensic_analyses')
    .select('*, case:cases(id, title, category, urgency), evidence:evidence(id, file_name, file_hash)')
    .order('created_at', { ascending: false });

  if (options?.caseId) query = query.eq('case_id', options.caseId);
  if (options?.expertId) query = query.eq('expert_id', options.expertId);

  const { data, error } = await query;
  if (error) return { analyses: [], error: error.message };
  return { analyses: (data ?? []) as ForensicAnalysis[], error: null };
}

export async function updateForensicAnalysis(
  id: string,
  updates: Partial<Pick<ForensicAnalysis, 'findings' | 'conclusion' | 'confidence' | 'status' | 'methodology'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('forensic_analyses').update(updates).eq('id', id);
  return { error: error?.message ?? null };
}
