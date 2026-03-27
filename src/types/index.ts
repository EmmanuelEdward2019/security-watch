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
  created_at: string;
  updated_at: string;
}

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
  id_document_url?: string;
  service_records_url?: string;
  admin_notes?: string;
  created_at: string;
  profile?: Profile;
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
  totalPayments: number;
  totalUsers: number;
  pendingVerifications: number;
}
