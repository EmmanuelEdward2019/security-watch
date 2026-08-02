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
    PostgrestVersion: "14.4"
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
      cases: {
        Row: {
          assigned_expert_id: string | null
          assigned_investigator_id: string | null
          assigned_lawyer_id: string | null
          category: string
          complainant_id: string
          created_at: string
          description: string
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
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
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
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
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
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
      media_reports: {
        Row: {
          created_at: string
          description: string
          file_url: string
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
          location: string | null
          phone: string | null
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
          location?: string | null
          phone?: string | null
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
          location?: string | null
          phone?: string | null
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
          listing_type: string
          location: string
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
          listing_type: string
          location: string
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
          listing_type?: string
          location?: string
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
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
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
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
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
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
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
      admin_platform_stats: { Args: never; Returns: Json }
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
      append_custody_entry: {
        Args: { p_action: string; p_evidence_id: string; p_notes?: string }
        Returns: undefined
      }
      can_read_media_object: { Args: { p_name: string }; Returns: boolean }
      create_conversation: {
        Args: {
          p_case_id?: string
          p_participant_ids: string[]
          p_title?: string
          p_type: string
        }
        Returns: string
      }
      current_role_name: { Args: never; Returns: string }
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
      log_guard_violation: {
        Args: { p_details: Json; p_resource_id: string; p_table: string }
        Returns: undefined
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
          payment_id: string
          purpose: string
          status: string
        }[]
      }
      owns_property: { Args: { p_property_id: string }; Returns: boolean }
      request_account_deletion: { Args: { p_reason?: string }; Returns: string }
      shares_context_with: { Args: { p_user_id: string }; Returns: boolean }
      storage_uuid_prefix: { Args: { p_name: string }; Returns: string }
      submit_kyc_for_review: { Args: never; Returns: undefined }
      tsw_elevate: { Args: never; Returns: undefined }
      tsw_is_elevated: { Args: never; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
