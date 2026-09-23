export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          severity: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          severity?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          category: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          read_minutes: number | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          read_minutes?: number | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      case_engagements: {
        Row: {
          case_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          created_by: string
          currency: string
          deposit_amount: number
          deposit_paid_at: string | null
          deposit_payment_id: string | null
          deposit_rate: number
          id: string
          note: string | null
          professional_amount: number
          professional_id: string
          professional_role: string
          service_key: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          case_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          created_by: string
          currency?: string
          deposit_amount: number
          deposit_paid_at?: string | null
          deposit_payment_id?: string | null
          deposit_rate?: number
          id?: string
          note?: string | null
          professional_amount: number
          professional_id: string
          professional_role: string
          service_key: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          case_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          created_by?: string
          currency?: string
          deposit_amount?: number
          deposit_paid_at?: string | null
          deposit_payment_id?: string | null
          deposit_rate?: number
          id?: string
          note?: string | null
          professional_amount?: number
          professional_id?: string
          professional_role?: string
          service_key?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_engagements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "case_engagements_deposit_payment_id_fkey"
            columns: ["deposit_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_engagements_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "case_engagements_service_key_fkey"
            columns: ["service_key"]
            isOneToOne: false
            referencedRelation: "service_prices"
            referencedColumns: ["key"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_expert_id: string | null
          assigned_investigator_id: string | null
          assigned_lawyer_id: string | null
          category: string
          complainant_id: string
          created_at: string
          description: string
          filing_fee_paid_at: string | null
          filing_fee_required: boolean
          filing_payment_id: string | null
          handling_institution: string | null
          handling_institution_id: string | null
          handling_state: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          occurred_at: string | null
          outcome: string | null
          outcome_note: string | null
          outcome_recorded_at: string | null
          outcome_recorded_by: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_expert_id?: string | null
          assigned_investigator_id?: string | null
          assigned_lawyer_id?: string | null
          category: string
          complainant_id: string
          created_at?: string
          description: string
          filing_fee_paid_at?: string | null
          filing_fee_required?: boolean
          filing_payment_id?: string | null
          handling_institution?: string | null
          handling_institution_id?: string | null
          handling_state?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          occurred_at?: string | null
          outcome?: string | null
          outcome_note?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency: string
        }
        Update: {
          assigned_expert_id?: string | null
          assigned_investigator_id?: string | null
          assigned_lawyer_id?: string | null
          category?: string
          complainant_id?: string
          created_at?: string
          description?: string
          filing_fee_paid_at?: string | null
          filing_fee_required?: boolean
          filing_payment_id?: string | null
          handling_institution?: string | null
          handling_institution_id?: string | null
          handling_state?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          occurred_at?: string | null
          outcome?: string | null
          outcome_note?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_expert_id_fkey"
            columns: ["assigned_expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cases_assigned_investigator_id_fkey"
            columns: ["assigned_investigator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cases_assigned_lawyer_id_fkey"
            columns: ["assigned_lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cases_complainant_id_fkey"
            columns: ["complainant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cases_filing_payment_id_fkey"
            columns: ["filing_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_handling_institution_id_fkey"
            columns: ["handling_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_outcome_recorded_by_fkey"
            columns: ["outcome_recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          title: string | null
          type: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          type: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      custodian_releases: {
        Row: {
          accepted_at: string | null
          acknowledged_at: string | null
          case_id: string
          created_at: string
          custodian_id: string
          grace_days: number
          id: string
          interval_days: number
          last_check_in_at: string
          note_to_custodian: string | null
          owner_id: string
          released_at: string | null
          status: string
          updated_at: string
          warned_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          acknowledged_at?: string | null
          case_id: string
          created_at?: string
          custodian_id: string
          grace_days?: number
          id?: string
          interval_days: number
          last_check_in_at?: string
          note_to_custodian?: string | null
          owner_id: string
          released_at?: string | null
          status?: string
          updated_at?: string
          warned_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          acknowledged_at?: string | null
          case_id?: string
          created_at?: string
          custodian_id?: string
          grace_days?: number
          id?: string
          interval_days?: number
          last_check_in_at?: string
          note_to_custodian?: string | null
          owner_id?: string
          released_at?: string | null
          status?: string
          updated_at?: string
          warned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodian_releases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodian_releases_custodian_id_fkey"
            columns: ["custodian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "custodian_releases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      evidence: {
        Row: {
          case_id: string
          chain_of_custody: Json
          created_at: string
          description: string | null
          file_hash: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          chain_of_custody?: Json
          created_at?: string
          description?: string | null
          file_hash: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          chain_of_custody?: Json
          created_at?: string
          description?: string | null
          file_hash?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      evidence_anchors: {
        Row: {
          anchored_at: string
          byte_size: number | null
          captured_at: string | null
          case_id: string | null
          created_at: string
          digest: string
          evidence_id: string | null
          fulfilled_at: string | null
          id: string
          media_type: string | null
          user_id: string
        }
        Insert: {
          anchored_at?: string
          byte_size?: number | null
          captured_at?: string | null
          case_id?: string | null
          created_at?: string
          digest: string
          evidence_id?: string | null
          fulfilled_at?: string | null
          id?: string
          media_type?: string | null
          user_id: string
        }
        Update: {
          anchored_at?: string
          byte_size?: number | null
          captured_at?: string | null
          case_id?: string | null
          created_at?: string
          digest?: string
          evidence_id?: string | null
          fulfilled_at?: string | null
          id?: string
          media_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_anchors_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_anchors_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_anchors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      evidence_grant_views: {
        Row: {
          evidence_id: string | null
          grant_id: string
          id: string
          ip_hash: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          evidence_id?: string | null
          grant_id: string
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          evidence_id?: string | null
          grant_id?: string
          id?: string
          ip_hash?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_grant_views_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_grant_views_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "evidence_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_grants: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          evidence_id: string | null
          expires_at: string
          id: string
          max_views: number | null
          purpose: string | null
          recipient_email: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          view_count: number
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          evidence_id?: string | null
          expires_at: string
          id?: string
          max_views?: number | null
          purpose?: string | null
          recipient_email?: string | null
          recipient_name: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          view_count?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          evidence_id?: string | null
          expires_at?: string
          id?: string
          max_views?: number | null
          purpose?: string | null
          recipient_email?: string | null
          recipient_name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_grants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_grants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "evidence_grants_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      forensic_analyses: {
        Row: {
          analysis_type: string
          attachments: Json
          case_id: string
          conclusion: string
          confidence: string
          created_at: string
          evidence_id: string | null
          expert_id: string
          findings: string
          id: string
          methodology: string | null
          status: string
          updated_at: string
        }
        Insert: {
          analysis_type: string
          attachments?: Json
          case_id: string
          conclusion: string
          confidence?: string
          created_at?: string
          evidence_id?: string | null
          expert_id: string
          findings: string
          id?: string
          methodology?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          analysis_type?: string
          attachments?: Json
          case_id?: string
          conclusion?: string
          confidence?: string
          created_at?: string
          evidence_id?: string | null
          expert_id?: string
          findings?: string
          id?: string
          methodology?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forensic_analyses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forensic_analyses_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forensic_analyses_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      guarantors: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          id_document_url: string | null
          investigator_id: string
          phone: string
          relationship: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          id_document_url?: string | null
          investigator_id: string
          phone: string
          relationship: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          id_document_url?: string | null
          investigator_id?: string
          phone?: string
          relationship?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guarantors_investigator_id_fkey"
            columns: ["investigator_id"]
            isOneToOne: false
            referencedRelation: "investigators"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          address: string
          created_at: string
          id: string
          location: string
          name: string
          supervising_authority: string | null
          type: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          location: string
          name: string
          supervising_authority?: string | null
          type: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          supervising_authority?: string | null
          type?: string
        }
        Relationships: []
      }
      investigation_reports: {
        Row: {
          attachments: Json
          author_id: string
          case_id: string
          created_at: string
          findings: string
          id: string
          recommendations: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          case_id: string
          created_at?: string
          findings: string
          id?: string
          recommendations?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          case_id?: string
          created_at?: string
          findings?: string
          id?: string
          recommendations?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "investigation_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      investigators: {
        Row: {
          admin_notes: string | null
          applied_for_role: string | null
          certifications: string[]
          created_at: string
          date_of_birth: string | null
          experience_years: number
          gender: string | null
          id: string
          id_document_url: string | null
          is_available: boolean
          languages: string[]
          license_number: string | null
          licensing_body: string | null
          national_id_number: string | null
          nationality: string | null
          previous_employer: string | null
          previous_position: string | null
          professional_summary: string | null
          qualifications: string | null
          rating: number
          residential_address: string | null
          service_area: string | null
          service_records_url: string | null
          specialization: string[]
          state_of_residence: string | null
          submitted_at: string | null
          total_cases: number
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          admin_notes?: string | null
          applied_for_role?: string | null
          certifications?: string[]
          created_at?: string
          date_of_birth?: string | null
          experience_years?: number
          gender?: string | null
          id?: string
          id_document_url?: string | null
          is_available?: boolean
          languages?: string[]
          license_number?: string | null
          licensing_body?: string | null
          national_id_number?: string | null
          nationality?: string | null
          previous_employer?: string | null
          previous_position?: string | null
          professional_summary?: string | null
          qualifications?: string | null
          rating?: number
          residential_address?: string | null
          service_area?: string | null
          service_records_url?: string | null
          specialization?: string[]
          state_of_residence?: string | null
          submitted_at?: string | null
          total_cases?: number
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          admin_notes?: string | null
          applied_for_role?: string | null
          certifications?: string[]
          created_at?: string
          date_of_birth?: string | null
          experience_years?: number
          gender?: string | null
          id?: string
          id_document_url?: string | null
          is_available?: boolean
          languages?: string[]
          license_number?: string | null
          licensing_body?: string | null
          national_id_number?: string | null
          nationality?: string | null
          previous_employer?: string | null
          previous_position?: string | null
          professional_summary?: string | null
          qualifications?: string | null
          rating?: number
          residential_address?: string | null
          service_area?: string | null
          service_records_url?: string | null
          specialization?: string[]
          state_of_residence?: string | null
          submitted_at?: string | null
          total_cases?: number
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          investigator_id: string
          label: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          investigator_id: string
          label?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          investigator_id?: string
          label?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_investigator_id_fkey"
            columns: ["investigator_id"]
            isOneToOne: false
            referencedRelation: "investigators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          author_id: string
          case_id: string | null
          created_at: string
          description: string | null
          document_type: string
          file_hash: string | null
          file_name: string
          file_path: string
          file_size: number | null
          filed_at: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          case_id?: string | null
          created_at?: string
          description?: string | null
          document_type: string
          file_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          filed_at?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          case_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: string
          file_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          filed_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "legal_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          captured_at: string | null
          created_at: string
          duration_seconds: number | null
          file_hash: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          gps_address: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          media_kind: string
          note: string | null
          owner_id: string
          source: string
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_hash: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          media_kind: string
          note?: string | null
          owner_id: string
          source?: string
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_hash?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          media_kind?: string
          note?: string | null
          owner_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_library_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      media_reports: {
        Row: {
          created_at: string
          description: string
          file_url: string
          gps_address: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          institution_id: string
          media_type: string
          reporter_id: string
          status: string
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          created_at?: string
          description: string
          file_url: string
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          institution_id: string
          media_type: string
          reporter_id: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          created_at?: string
          description?: string
          file_url?: string
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          institution_id?: string
          media_type?: string
          reporter_id?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_reports_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          is_encrypted: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_encrypted?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_encrypted?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          push_attempts: number
          pushed_at: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          push_attempts?: number
          pushed_at?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          push_attempts?: number
          pushed_at?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          channels: string[]
          id: string
          obligation_id: string
          obligation_kind: string
          sent_at: string
          sequence_no: number
          user_id: string
        }
        Insert: {
          channels?: string[]
          id?: string
          obligation_id: string
          obligation_kind: string
          sent_at?: string
          sequence_no: number
          user_id: string
        }
        Update: {
          channels?: string[]
          id?: string
          obligation_id?: string
          obligation_kind?: string
          sent_at?: string
          sequence_no?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          case_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          payer_id: string
          property_id: string | null
          provider: string
          provider_payload: Json | null
          provider_reference: string | null
          purpose: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          case_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payer_id: string
          property_id?: string | null
          provider: string
          provider_payload?: Json | null
          provider_reference?: string | null
          purpose?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          case_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payer_id?: string
          property_id?: string | null
          provider?: string
          provider_payload?: Json | null
          provider_reference?: string | null
          purpose?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          recipient_code: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          recipient_code?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          recipient_code?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payout_ledger: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          engagement_id: string
          id: string
          note: string | null
          professional_id: string
          reason: string
          released_at: string | null
          released_by: string | null
          status: string
          transfer_reference: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          engagement_id: string
          id?: string
          note?: string | null
          professional_id: string
          reason: string
          released_at?: string | null
          released_by?: string | null
          status?: string
          transfer_reference?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          engagement_id?: string
          id?: string
          note?: string | null
          professional_id?: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
          status?: string
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_ledger_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_ledger_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "case_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_ledger_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_ledger_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_scores: {
        Row: {
          cleanliness: number
          comment: string | null
          created_at: string
          id: string
          institution_id: string
          integrity: number
          overall_score: number | null
          professionalism: number
          punctuality: number
          scorer_id: string
          service_delivery: number
        }
        Insert: {
          cleanliness: number
          comment?: string | null
          created_at?: string
          id?: string
          institution_id: string
          integrity: number
          overall_score?: number | null
          professionalism: number
          punctuality: number
          scorer_id: string
          service_delivery: number
        }
        Update: {
          cleanliness?: number
          comment?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          integrity?: number
          overall_score?: number | null
          professionalism?: number
          punctuality?: number
          scorer_id?: string
          service_delivery?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_scores_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_scores_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          kyc_status: string
          kyc_submitted_at: string | null
          location: string | null
          phone: string | null
          push_show_preview: boolean
          requested_role: string | null
          role: string
          role_confirmed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string | null
          phone?: string | null
          push_show_preview?: boolean
          requested_role?: string | null
          role: string
          role_confirmed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string | null
          phone?: string | null
          push_show_preview?: boolean
          requested_role?: string | null
          role?: string
          role_confirmed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          currency: string
          description: string
          features: string[]
          id: string
          images: string[]
          is_active: boolean
          latitude: number | null
          listing_type: string
          location: string
          longitude: number | null
          owner_id: string
          price: number
          property_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string
          description: string
          features?: string[]
          id?: string
          images?: string[]
          is_active?: boolean
          latitude?: number | null
          listing_type: string
          location: string
          longitude?: number | null
          owner_id: string
          price: number
          property_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          currency?: string
          description?: string
          features?: string[]
          id?: string
          images?: string[]
          is_active?: boolean
          latitude?: number | null
          listing_type?: string
          location?: string
          longitude?: number | null
          owner_id?: string
          price?: number
          property_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          property_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          property_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          property_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          property_id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          property_id: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          property_id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      property_verification_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          payment_id: string | null
          property_id: string
          reason: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          property_id: string
          reason?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          property_id?: string
          reason?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_verification_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_verification_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_verification_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "property_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          disabled_at: string | null
          disabled_reason: string | null
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_resources: {
        Row: {
          address: string | null
          alt_phone: string | null
          category: string
          created_at: string
          email: string | null
          guidance: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          phone: string | null
          priority: number
          state: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          category?: string
          created_at?: string
          email?: string | null
          guidance?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          phone?: string | null
          priority?: number
          state?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          category?: string
          created_at?: string
          email?: string | null
          guidance?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          phone?: string | null
          priority?: number
          state?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_resources_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_properties: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_properties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schema_migration_marks: {
        Row: {
          applied_at: string
          mark: string
        }
        Insert: {
          applied_at?: string
          mark: string
        }
        Update: {
          applied_at?: string
          mark?: string
        }
        Relationships: []
      }
      security_service_requests: {
        Row: {
          admin_notes: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          location: string | null
          message: string
          phone: string | null
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          location?: string | null
          message: string
          phone?: string | null
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          location?: string | null
          message?: string
          phone?: string | null
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          amount: number
          commission_rate: number
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_platform_fee: boolean
          key: string
          label: string
          module: string
          sort_order: number
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          commission_rate?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_platform_fee?: boolean
          key: string
          label: string
          module: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_platform_fee?: boolean
          key?: string
          label?: string
          module?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_custodian_release: {
        Args: { p_id: string }
        Returns: undefined
      }
      add_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_assign_case: {
        Args: { p_case_id: string; p_slot?: string; p_user_id: string }
        Returns: undefined
      }
      admin_audit_log: {
        Args: {
          p_action?: string
          p_limit?: number
          p_offset?: number
          p_resource_type?: string
          p_severity?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          actor_name: string
          actor_role: string
          created_at: string
          details: Json
          id: string
          resource_id: string
          resource_type: string
          severity: string
          total_count: number
          user_id: string
        }[]
      }
      admin_corroboration_clusters: {
        Args: {
          p_days?: number
          p_limit?: number
          p_radius_km?: number
          p_window_hours?: number
        }
        Returns: {
          case_id: string
          category: string
          corroborations: number
          distinct_reporters: number
          latitude: number
          location: string
          longitude: number
          nearest_km: number
          occurred_at: string
          status: string
          title: string
          urgency: string
        }[]
      }
      admin_create_engagement: {
        Args: {
          p_case_id: string
          p_deposit_rate?: number
          p_note?: string
          p_professional_id: string
          p_role: string
          p_service_key: string
        }
        Returns: string
      }
      admin_institution_scorecard: {
        Args: { p_days?: number }
        Returns: {
          accepted: number
          cases: number
          institution: string
          median_days: number
          refused: number
          resolved: number
          state: string
        }[]
      }
      admin_kyc_application: {
        Args: { p_investigator_id: string }
        Returns: Json
      }
      admin_kyc_queue: {
        Args: { p_status?: string }
        Returns: {
          applied_for_role: string
          document_count: number
          email: string
          full_name: string
          guarantor_count: number
          has_id: boolean
          has_summary: boolean
          investigator_id: string
          is_complete: boolean
          phone: string
          requested_role: string
          submitted_at: string
          user_id: string
          verification_status: string
          waiting_days: number
        }[]
      }
      admin_monthly_trends: {
        Args: { p_months?: number }
        Returns: {
          cases: number
          media: number
          month: string
          properties: number
          revenue: number
          users: number
        }[]
      }
      admin_outcome_ledger: {
        Args: { p_days?: number }
        Returns: {
          cases: number
          category: string
          institutions: number
          median_days: number
          outcome: string
        }[]
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_release_payout: {
        Args: { p_ledger_id: string; p_note?: string; p_reference: string }
        Returns: undefined
      }
      admin_resolve_verification_request: {
        Args: { p_notes?: string; p_request_id: string; p_status: string }
        Returns: undefined
      }
      admin_review_guarantor: {
        Args: { p_guarantor_id: string; p_status: string }
        Returns: undefined
      }
      admin_review_investigator: {
        Args: { p_investigator_id: string; p_notes?: string; p_status: string }
        Returns: undefined
      }
      admin_review_media_report: {
        Args: { p_note?: string; p_report_id: string; p_status: string }
        Returns: undefined
      }
      admin_security_summary: { Args: never; Returns: Json }
      admin_set_kyc_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_property_status: {
        Args: {
          p_property_id: string
          p_status: string
          p_verify_documents?: boolean
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_unverified_referrals: {
        Args: never
        Returns: {
          category: string
          guidance: string
          id: string
          kind: string
          name: string
          phone: string
          state: string
          website: string
        }[]
      }
      admin_verify_referral: {
        Args: { p_active?: boolean; p_id: string }
        Returns: undefined
      }
      anchor_evidence_digest: {
        Args: {
          p_byte_size?: number
          p_captured_at?: string
          p_case_id?: string
          p_digest: string
          p_media_type?: string
        }
        Returns: {
          already_anchored: boolean
          anchor_id: string
          anchored_at: string
        }[]
      }
      append_custody_entry: {
        Args: { p_action: string; p_evidence_id: string; p_notes?: string }
        Returns: undefined
      }
      attach_library_item_to_case: {
        Args: { p_case_id: string; p_description?: string; p_item_id: string }
        Returns: string
      }
      can_message: { Args: { p_user_id: string }; Returns: boolean }
      can_read_media_object: { Args: { p_name: string }; Returns: boolean }
      case_category_family: { Args: { p_category: string }; Returns: string }
      case_corroboration: {
        Args: {
          p_case_id: string
          p_radius_km?: number
          p_window_hours?: number
        }
        Returns: {
          direct_matches: number
          first_report_at: string
          has_coordinates: boolean
          last_report_at: string
          nearest_km: number
          radius_km: number
          related_matches: number
          window_hours: number
        }[]
      }
      case_evidence_grants: {
        Args: { p_case_id: string }
        Returns: {
          created_at: string
          created_by_name: string
          evidence_id: string
          evidence_name: string
          expires_at: string
          id: string
          is_live: boolean
          last_viewed_at: string
          max_views: number
          purpose: string
          recipient_email: string
          recipient_name: string
          revoked_at: string
          view_count: number
        }[]
      }
      claim_push_batch: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          link: string
          notification_id: string
          platform: string
          show_preview: boolean
          title: string
          token: string
        }[]
      }
      create_conversation: {
        Args: {
          p_case_id?: string
          p_participant_ids: string[]
          p_title?: string
          p_type: string
        }
        Returns: string
      }
      create_custodian_release: {
        Args: {
          p_case_id: string
          p_custodian_id: string
          p_grace_days?: number
          p_interval_days?: number
          p_note?: string
        }
        Returns: string
      }
      create_evidence_grant: {
        Args: {
          p_case_id: string
          p_evidence_id?: string
          p_expires_in_hours?: number
          p_max_views?: number
          p_purpose?: string
          p_recipient_email?: string
          p_recipient_name: string
        }
        Returns: {
          expires_at: string
          grant_id: string
          token: string
        }[]
      }
      current_role_name: { Args: never; Returns: string }
      custodian_check_in: { Args: { p_id?: string }; Returns: number }
      custodian_releases_due: {
        Args: never
        Returns: {
          action: string
          case_id: string
          custodian_id: string
          id: string
          overdue_hours: number
          owner_id: string
        }[]
      }
      disable_push_token: {
        Args: { p_reason: string; p_token: string }
        Returns: undefined
      }
      due_payment_reminders: {
        Args: never
        Returns: {
          amount: number
          currency: string
          days_outstanding: number
          next_sequence: number
          obligation_id: string
          obligation_kind: string
          pay_link: string
          subject: string
          user_id: string
        }[]
      }
      eligible_custodians: {
        Args: never
        Returns: {
          full_name: string
          role: string
          service_area: string
          user_id: string
        }[]
      }
      evidence_anchor_for: {
        Args: { p_evidence_id: string }
        Returns: {
          anchored_at: string
          captured_at: string
          fulfilled_at: string
          held_hours: number
        }[]
      }
      evidence_for_grant: {
        Args: { p_grant_id: string }
        Returns: {
          created_at: string
          description: string
          file_hash: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
        }[]
      }
      execute_custodian_release: { Args: { p_id: string }; Returns: undefined }
      find_referrals: {
        Args: { p_category?: string; p_limit?: number; p_state?: string }
        Returns: {
          address: string
          alt_phone: string
          category: string
          email: string
          guidance: string
          id: string
          is_local: boolean
          kind: string
          name: string
          phone: string
          state: string
          website: string
        }[]
      }
      increment_media_views: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      institution_rankings: {
        Args: never
        Returns: {
          avg_score: number
          evaluations: number
          institution_id: string
          location: string
          name: string
          published_reports: number
          type: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_case_participant: { Args: { p_case_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_eligible_custodian: { Args: { p_user_id: string }; Returns: boolean }
      is_released_custodian: { Args: { p_case_id: string }; Returns: boolean }
      landlord_transactions: {
        Args: never
        Returns: {
          amount: number
          counterparty_name: string
          created_at: string
          currency: string
          payment_id: string
          property_id: string
          property_title: string
          purpose: string
          reference: string
          status: string
        }[]
      }
      link_evidence_anchor: {
        Args: { p_evidence_id: string }
        Returns: {
          anchored_at: string
          matched: boolean
        }[]
      }
      log_guard_violation: {
        Args: { p_details: Json; p_resource_id: string; p_table: string }
        Returns: undefined
      }
      mark_custodian_release_warned: {
        Args: { p_id: string }
        Returns: undefined
      }
      messaging_contacts: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          avatar_url: string
          full_name: string
          is_team: boolean
          role: string
          user_id: string
        }[]
      }
      my_activity: {
        Args: { p_limit?: number }
        Returns: {
          detail: string
          id: string
          kind: string
          occurred_at: string
          status: string
          title: string
        }[]
      }
      my_earnings: {
        Args: never
        Returns: {
          amount: number
          case_id: string
          case_title: string
          created_at: string
          currency: string
          ledger_id: string
          reason: string
          reference: string
          released_at: string
          status: string
        }[]
      }
      my_pending_anchors: {
        Args: never
        Returns: {
          anchored_at: string
          byte_size: number
          captured_at: string
          case_id: string
          digest: string
          id: string
          media_type: string
        }[]
      }
      owns_property: { Args: { p_property_id: string }; Returns: boolean }
      payment_reminder_due_at: {
        Args: { p_created: string; p_last_sent: string; p_sent: number }
        Returns: string
      }
      properties_nearby: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_km?: number
        }
        Returns: {
          address: string
          area_sqm: number
          bathrooms: number
          bedrooms: number
          created_at: string
          currency: string
          description: string
          distance_km: number
          id: string
          images: string[]
          latitude: number
          listing_type: string
          location: string
          longitude: number
          price: number
          property_type: string
          status: string
          title: string
        }[]
      }
      public_institution_scorecard: {
        Args: { p_months?: number }
        Returns: {
          accepted: number
          cases: number
          institution: string
          median_days: number
          refused: number
          state: string
        }[]
      }
      public_outcome_summary: {
        Args: { p_months?: number }
        Returns: {
          cases: number
          category: string
          median_days: number
          no_action: number
          referred_out: number
          resolved: number
          still_open: number
        }[]
      }
      reap_unconfirmed_signups: {
        Args: { p_older_than?: string }
        Returns: number
      }
      record_case_outcome: {
        Args: {
          p_case_id: string
          p_institution?: string
          p_institution_id?: string
          p_note?: string
          p_outcome: string
          p_state?: string
        }
        Returns: undefined
      }
      record_evidence_grant_view: {
        Args: {
          p_evidence_id?: string
          p_grant_id: string
          p_ip?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_payment_reminder: {
        Args: {
          p_channels: string[]
          p_kind: string
          p_obligation: string
          p_sequence: number
          p_user: string
        }
        Returns: boolean
      }
      register_push_token: {
        Args: { p_device_name?: string; p_platform: string; p_token: string }
        Returns: undefined
      }
      rename_library_item: {
        Args: { p_item_id: string; p_name: string }
        Returns: string
      }
      request_account_deletion: { Args: { p_reason?: string }; Returns: string }
      resolve_evidence_grant: {
        Args: { p_token: string }
        Returns: {
          case_id: string
          case_title: string
          evidence_id: string
          expires_at: string
          grant_id: string
          purpose: string
          recipient_name: string
          views_left: number
        }[]
      }
      respond_to_custodian_request: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      revoke_evidence_grant: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      set_custodian_release_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      set_push_preview: { Args: { p_show: boolean }; Returns: undefined }
      settle_case_filing_fee: {
        Args: { p_payment_id: string }
        Returns: string
      }
      settle_engagement_deposit: {
        Args: { p_payment_id: string }
        Returns: string
      }
      shares_context_with: { Args: { p_user_id: string }; Returns: boolean }
      storage_uuid_prefix: { Args: { p_name: string }; Returns: string }
      submit_kyc_for_review: { Args: never; Returns: undefined }
      submit_library_item_to_admin: {
        Args: {
          p_description: string
          p_institution_id: string
          p_item_id: string
          p_tags?: string[]
          p_title: string
        }
        Returns: string
      }
      tsw_elevate: { Args: never; Returns: undefined }
      tsw_invoke_sweep: {
        Args: { p_function: string; p_header: string; p_secret_name: string }
        Returns: number
      }
      tsw_is_elevated: { Args: never; Returns: boolean }
      tsw_min_cell: { Args: never; Returns: number }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_case_status: {
        Args: { p_case_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
