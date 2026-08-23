export type UserRole =
  | 'complainant'
  | 'investigator'
  | 'lawyer'
  | 'medical_expert'
  | 'witness'
  | 'landlord'
  | 'tenant'
  | 'media_agent'
  | 'admin';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  complainant: 'Complainant',
  investigator: 'Investigator (Agent)',
  lawyer: 'Lawyer',
  medical_expert: 'Medical/Forensic Expert',
  witness: 'Witness/Informant',
  landlord: 'Landlord/Property Owner',
  tenant: 'Tenant/Buyer',
  media_agent: 'Media Agent',
  admin: 'Administrator',
};

export type KycStatus = 'pending' | 'approved' | 'rejected';
export type CaseStatus = 'submitted' | 'under_review' | 'assigned' | 'investigating' | 'legal_processing' | 'completed' | 'closed';
export type CaseUrgency = 'low' | 'medium' | 'high' | 'critical';
export type CaseCategory = 'fraud' | 'robbery' | 'murder' | 'assault' | 'domestic_dispute' | 'land_dispute' | 'cybercrime' | 'corruption' | 'kidnapping' | 'missing_person' | 'other';

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  investigating: 'Investigating',
  legal_processing: 'Legal Processing',
  completed: 'Completed',
  closed: 'Closed',
};

export const CASE_URGENCY_LABELS: Record<CaseUrgency, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  fraud: 'Fraud',
  robbery: 'Robbery',
  murder: 'Murder',
  assault: 'Assault',
  domestic_dispute: 'Domestic Dispute',
  land_dispute: 'Land Dispute',
  cybercrime: 'Cybercrime',
  corruption: 'Corruption',
  kidnapping: 'Kidnapping',
  missing_person: 'Missing Person',
  other: 'Other',
};
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type PropertyStatus = 'unverified' | 'pending' | 'verified';
export type MediaStatus = 'pending_review' | 'approved' | 'rejected' | 'published';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentProvider = 'stripe' | 'paystack';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  kyc_status: KycStatus;
  bio?: string;
  location?: string;
  /**
   * The role picked at registration. Roles that grant sight of other people's
   * case files are not self-service, so this holds the request until an admin
   * confirms it — see migration 004.
   */
  requested_role?: UserRole | null;
  role_confirmed_at?: string | null;
  /**
   * Set by submit_kyc_for_review() (migration 016). kyc_status defaults to
   * 'pending' on a new account, so it cannot on its own distinguish "never
   * started" from "submitted, awaiting review" — this can. Optional because
   * clients built before 016 is applied will not receive it.
   */
  kyc_submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Roles a user receives immediately on signup, without admin review. */
export const SELF_SERVICE_ROLES: UserRole[] = [
  'complainant',
  'witness',
  'landlord',
  'tenant',
  'media_agent',
];

/** Roles that must be granted by an admin after verification. */
export const VERIFIED_ROLES: UserRole[] = ['investigator', 'lawyer', 'medical_expert'];

export interface Case {
  id: string;
  title: string;
  description: string;
  category: CaseCategory;
  urgency: CaseUrgency;
  status: CaseStatus;
  location: string;
  latitude?: number;
  longitude?: number;
  complainant_id: string;
  assigned_investigator_id?: string;
  assigned_lawyer_id?: string;
  assigned_expert_id?: string;
  created_at: string;
  updated_at: string;
  complainant?: Profile;
  investigator?: Profile;
  evidence_count?: number;
}

export interface Evidence {
  id: string;
  case_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_hash?: string;
  description?: string;
  chain_of_custody: CustodyLog[];
  created_at: string;
}

export interface CustodyLog {
  timestamp: string;
  action: string;
  user_id: string;
  user_name: string;
  notes?: string;
}

export interface Investigator {
  id: string;
  user_id: string;
  specialization: string[];
  experience_years: number;
  service_area: string;
  rating: number;
  total_cases: number;
  verification_status: VerificationStatus;
  is_available: boolean;
  id_document_url?: string;
  service_records_url?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  profile?: Profile;

  // ── Added by migration 013 (KYC detail capture) ──────────────────────────
  // submit_kyc_for_review() refuses an application missing date_of_birth,
  // residential_address, professional_summary or specialization, so these are
  // effectively required at submission even though the columns are nullable
  // (an application is built up across several visits).
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  national_id_number?: string;
  residential_address?: string;
  state_of_residence?: string;
  nationality?: string;
  professional_summary?: string;
  qualifications?: string;
  certifications?: string[];
  license_number?: string;
  licensing_body?: string;
  previous_employer?: string;
  previous_position?: string;
  languages?: string[];
  submitted_at?: string;
  applied_for_role?: 'investigator' | 'lawyer' | 'medical_expert';
}

/** A supporting file attached to a KYC application. See migration 013. */
export interface KycDocument {
  id: string;
  investigator_id: string;
  uploaded_by: string;
  document_type:
    | 'national_id'
    | 'passport'
    | 'drivers_license'
    | 'service_record'
    | 'academic_certificate'
    | 'professional_certificate'
    | 'call_to_bar'
    | 'medical_license'
    | 'police_clearance'
    | 'reference_letter'
    | 'proof_of_address'
    | 'cv'
    | 'other';
  label?: string;
  file_path: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

/** One suggestion from the match-investigator function. */
export interface InvestigatorMatch {
  investigator_id: string;
  user_id: string;
  full_name: string;
  /**
   * Optional: the engine does not return it, the client fallback does.
   *
   * Needed because `full_name` falls back to the email address for accounts
   * that signed up without one, so a name alone can be ambiguous — or can just
   * be an address with no way to tell two people apart.
   */
  email?: string;
  specialization: string[];
  service_area: string;
  experience_years: number;
  rating: number;
  total_cases: number;
  match_score: number;
  breakdown: {
    specialization: number;
    location: number;
    experience: number;
    rating: number;
    availability: number;
    urgency: number;
  };
}

export interface Guarantor {
  id: string;
  investigator_id: string;
  full_name: string;
  email: string;
  phone: string;
  relationship: string;
  id_document_url?: string;
  verification_status: VerificationStatus;
  verified_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  file_url?: string;
  file_name?: string;
  is_encrypted: boolean;
  read_at?: string;
  created_at: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  case_id?: string;
  type: 'direct' | 'group';
  title?: string;
  created_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  property_type: 'apartment' | 'house' | 'land' | 'commercial' | 'office';
  price: number;
  currency: string;
  location: string;
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  status: PropertyStatus;
  listing_type: 'sale' | 'rent';
  is_active: boolean;
  images: string[];
  features: string[];
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  verified: boolean;
  created_at: string;
}

export interface PropertyRequest {
  id: string;
  property_id: string;
  requester_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester?: Profile;
  property?: Property;
}

export interface Institution {
  id: string;
  name: string;
  type: 'police' | 'school' | 'hospital' | 'market' | 'government' | 'court' | 'other';
  location: string;
  address: string;
  supervising_authority: string;
  created_at: string;
}

export interface MediaReport {
  id: string;
  institution_id: string;
  reporter_id: string;
  title: string;
  description: string;
  media_type: 'video' | 'audio' | 'photo' | 'document';
  file_url: string;
  thumbnail_url?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  status: MediaStatus;
  tags: string[];
  views: number;
  created_at: string;
  updated_at: string;
  institution?: Institution;
  reporter?: Profile;
}

/** A file the owner captured in the field or imported from another device. */
export interface MediaLibraryItem {
  id: string;
  owner_id: string;
  /** Storage path inside the private media-reports bucket. Sign it to read. */
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  /** SHA-256, lower-case hex. */
  file_hash: string;
  media_kind: 'video' | 'audio' | 'photo' | 'document';
  /**
   * 'capture' — recorded in the app, so captured_at and the coordinates were
   * observed. 'import' — brought in from a wearable, body camera or scan, so
   * the metadata is whatever the file carried and must not be presented as
   * though the app witnessed it.
   */
  source: 'capture' | 'import';
  captured_at?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  note?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

export const MEDIA_KIND_LABELS: Record<MediaLibraryItem['media_kind'], string> = {
  video: 'Video',
  audio: 'Audio',
  photo: 'Photo',
  document: 'Document',
};

export interface PerformanceScore {
  id: string;
  institution_id: string;
  scorer_id: string;
  punctuality: number;
  professionalism: number;
  cleanliness: number;
  integrity: number;
  service_delivery: number;
  overall_score: number;
  comment?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  payer_id: string;
  case_id?: string;
  property_id?: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  provider_reference?: string;
  status: PaymentStatus;
  description: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  link?: string;
  created_at: string;
}

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  totalProperties: number;
  verifiedProperties: number;
  totalMediaReports: number;
  publishedMedia: number;
  totalPayments: number;
  paymentCount: number;
  totalUsers: number;
  pendingVerifications: number;
  pendingMedia: number;
  usersByRole: Record<string, number>;
  casesByStatus: Record<string, number>;
  casesByCategory: Record<string, number>;
  casesByUrgency: Record<string, number>;
}

export interface MonthlyTrend {
  month: string;
  cases: number;
  users: number;
  properties: number;
  media: number;
  revenue: number;
}

export interface SecuritySummary {
  guardViolations24h: number;
  guardViolationsTotal: number;
  criticalEvents7d: number;
  roleChanges7d: number;
  unconfirmedPrivilegedRoles: number;
  openDeletionRequests: number;
}

// =============================================================================
// Attachments — stored as an object path plus verification metadata, never a
// bare URL. Private buckets are read through short-lived signed URLs.
// =============================================================================

export interface StoredAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
  hash?: string;
}

// =============================================================================
// Pricing
// =============================================================================

export type PriceModule = 'investigation' | 'property' | 'media' | 'security';

export interface ServicePrice {
  id: string;
  key: string;
  module: PriceModule;
  label: string;
  description?: string;
  amount: number;
  currency: string;
  unit?: string;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export const PRICE_MODULE_LABELS: Record<PriceModule, string> = {
  investigation: 'Investigative Services',
  property: 'Property & Real Estate',
  media: 'Transparency & Media',
  security: 'Fountain Source Security',
};

// =============================================================================
// Investigation reports
// =============================================================================

export type InvestigationReportStatus = 'draft' | 'submitted' | 'accepted' | 'revision_requested';

export interface InvestigationReport {
  id: string;
  case_id: string;
  author_id: string;
  title: string;
  findings: string;
  recommendations?: string;
  attachments: StoredAttachment[];
  status: InvestigationReportStatus;
  reviewer_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  case?: Pick<Case, 'id' | 'title' | 'status' | 'category'>;
  author?: Profile;
}

export const INVESTIGATION_REPORT_STATUS_LABELS: Record<InvestigationReportStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted: 'Accepted',
  revision_requested: 'Revision requested',
};

// =============================================================================
// Legal documents
// =============================================================================

export type LegalDocumentType =
  | 'affidavit' | 'petition' | 'court_filing' | 'legal_opinion' | 'witness_statement'
  | 'subpoena' | 'settlement' | 'correspondence' | 'other';

export type LegalDocumentStatus = 'draft' | 'filed' | 'served' | 'archived';

export interface LegalDocument {
  id: string;
  case_id?: string | null;
  author_id: string;
  document_type: LegalDocumentType;
  title: string;
  description?: string;
  file_path: string;
  file_name: string;
  file_size?: number;
  file_hash?: string;
  status: LegalDocumentStatus;
  filed_at?: string | null;
  created_at: string;
  updated_at: string;
  case?: Pick<Case, 'id' | 'title'>;
}

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  affidavit: 'Affidavit',
  petition: 'Petition',
  court_filing: 'Court filing',
  legal_opinion: 'Legal opinion',
  witness_statement: 'Witness statement',
  subpoena: 'Subpoena',
  settlement: 'Settlement agreement',
  correspondence: 'Correspondence',
  other: 'Other',
};

export const LEGAL_DOCUMENT_STATUS_LABELS: Record<LegalDocumentStatus, string> = {
  draft: 'Draft',
  filed: 'Filed',
  served: 'Served',
  archived: 'Archived',
};

// =============================================================================
// Forensic analyses
// =============================================================================

export type ForensicAnalysisType =
  | 'medical_examination' | 'toxicology' | 'dna' | 'ballistics' | 'digital_forensics'
  | 'document_examination' | 'pathology' | 'psychological' | 'other';

export type ForensicConfidence = 'low' | 'moderate' | 'high' | 'conclusive';
export type ForensicAnalysisStatus = 'in_progress' | 'completed' | 'peer_review' | 'finalised';

export interface ForensicAnalysis {
  id: string;
  case_id: string;
  evidence_id?: string | null;
  expert_id: string;
  analysis_type: ForensicAnalysisType;
  methodology?: string;
  findings: string;
  conclusion: string;
  confidence: ForensicConfidence;
  attachments: StoredAttachment[];
  status: ForensicAnalysisStatus;
  created_at: string;
  updated_at: string;
  case?: Pick<Case, 'id' | 'title' | 'category' | 'urgency'>;
  evidence?: Pick<Evidence, 'id' | 'file_name' | 'file_hash'>;
}

export const FORENSIC_ANALYSIS_TYPE_LABELS: Record<ForensicAnalysisType, string> = {
  medical_examination: 'Medical examination',
  toxicology: 'Toxicology',
  dna: 'DNA analysis',
  ballistics: 'Ballistics',
  digital_forensics: 'Digital forensics',
  document_examination: 'Document examination',
  pathology: 'Pathology',
  psychological: 'Psychological assessment',
  other: 'Other',
};

export const FORENSIC_CONFIDENCE_LABELS: Record<ForensicConfidence, string> = {
  low: 'Low confidence',
  moderate: 'Moderate confidence',
  high: 'High confidence',
  conclusive: 'Conclusive',
};

export const FORENSIC_STATUS_LABELS: Record<ForensicAnalysisStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  peer_review: 'Peer review',
  finalised: 'Finalised',
};

// =============================================================================
// Property extras
// =============================================================================

export interface SavedProperty {
  id: string;
  user_id: string;
  property_id: string;
  notes?: string;
  created_at: string;
  property?: Property;
}

export type PropertyVerificationStatus =
  | 'pending' | 'in_review' | 'verified' | 'failed' | 'cancelled';

export interface PropertyVerificationRequest {
  id: string;
  property_id: string;
  requester_id: string;
  reason?: string;
  status: PropertyVerificationStatus;
  payment_id?: string | null;
  admin_notes?: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  property?: Property;
  requester?: Profile;
}

export const PROPERTY_VERIFICATION_STATUS_LABELS: Record<PropertyVerificationStatus, string> = {
  pending: 'Awaiting payment',
  in_review: 'Under review',
  verified: 'Verified',
  failed: 'Verification failed',
  cancelled: 'Cancelled',
};

export interface LandlordTransaction {
  payment_id: string;
  property_id: string;
  property_title: string;
  counterparty_name: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  purpose: string | null;
  reference: string | null;
  created_at: string;
}

/**
 * A tranche the platform owes this professional.
 *
 * Previously this mirrored the COMPLAINANT'S payment on a case the
 * professional was assigned to — gross of commission, and not actually owed to
 * them. It now reads the payout ledger, so `amount` is their share after The
 * Security Watch's commission and `status` describes the payout, not the
 * client's card transaction.
 */
export type PayoutStatus = 'accrued' | 'approved' | 'released' | 'cancelled';

export interface EarningRecord {
  ledger_id: string;
  case_id: string;
  case_title: string;
  /** The professional's share, net of commission. */
  amount: number;
  currency: string;
  status: PayoutStatus;
  /** Which tranche: the mobilisation deposit, the balance, or an adjustment. */
  reason: 'deposit_share' | 'balance_share' | 'adjustment';
  /** Bank or Paystack reference, present once released. */
  reference: string | null;
  released_at: string | null;
  created_at: string;
}

// =============================================================================
// Institutions, activity, admin
// =============================================================================

export interface InstitutionRanking {
  institution_id: string;
  name: string;
  type: Institution['type'];
  location: string;
  avg_score: number;
  evaluations: number;
  published_reports: number;
}

export interface ActivityEntry {
  id: string;
  kind: 'media_report' | 'institution_score' | 'audit';
  title: string;
  detail: string | null;
  status: string;
  occurred_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  severity: 'info' | 'notice' | 'warning' | 'critical';
  created_at: string;
  total_count: number;
}

export type DeletionRequestStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  reason?: string;
  status: DeletionRequestStatus;
  admin_notes?: string;
  processed_at?: string | null;
  requested_at: string;
}

// =============================================================================
// Contact and content
// =============================================================================

export type ContactMessageStatus = 'new' | 'read' | 'responded' | 'closed' | 'spam';

export interface ContactMessage {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  admin_notes?: string;
  created_at: string;
}

export interface SecurityServiceRequest {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  service_type: string;
  location?: string;
  message: string;
  status: 'pending' | 'contacted' | 'in_progress' | 'completed' | 'cancelled';
  admin_notes?: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  cover_image_url?: string;
  category: string;
  tags: string[];
  author_name?: string;
  read_minutes?: number;
  status: 'draft' | 'published' | 'archived';
  published_at?: string | null;
  created_at: string;
}
