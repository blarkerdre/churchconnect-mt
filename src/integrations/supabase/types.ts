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
      announcement_reactions: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          reaction: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          reaction?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          reaction?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reactions_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          is_published: boolean | null
          publish_date: string | null
          target_audience: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_published?: boolean | null
          publish_date?: string | null
          target_audience?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_published?: boolean | null
          publish_date?: string | null
          target_audience?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_feedback: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          admin_response: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_method: string | null
          checked_in_at: string | null
          created_at: string
          id: string
          member_id: string
          session_id: string
          tenant_id: string | null
        }
        Insert: {
          check_in_method?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          session_id: string
          tenant_id?: string | null
        }
        Update: {
          check_in_method?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          female_count: number
          id: string
          male_count: number
          notes: string | null
          report_saved: boolean
          session_date: string
          session_type: Database["public"]["Enums"]["session_type"]
          status: string
          tenant_id: string | null
          title: string | null
          total_count: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          female_count?: number
          id?: string
          male_count?: number
          notes?: string | null
          report_saved?: boolean
          session_date: string
          session_type: Database["public"]["Enums"]["session_type"]
          status?: string
          tenant_id?: string | null
          title?: string | null
          total_count?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          female_count?: number
          id?: string
          male_count?: number
          notes?: string | null
          report_saved?: boolean
          session_date?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: string
          tenant_id?: string | null
          title?: string | null
          total_count?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      books_of_the_month: {
        Row: {
          author: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          month: string
          purchase_url: string | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          author: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          month: string
          purchase_url?: string | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          author?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          month?: string
          purchase_url?: string | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_of_the_month_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_log: {
        Row: {
          call_type: string | null
          caller_id: string | null
          created_at: string
          delivery_status: string | null
          delivery_updated_at: string | null
          duration_seconds: number | null
          id: string
          member_id: string | null
          notes: string | null
          provider: string | null
          provider_call_id: string | null
          recipient_phone: string
          reference_id: string | null
          reference_type: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          call_type?: string | null
          caller_id?: string | null
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          duration_seconds?: number | null
          id?: string
          member_id?: string | null
          notes?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recipient_phone: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          call_type?: string | null
          caller_id?: string | null
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          duration_seconds?: number | null
          id?: string
          member_id?: string | null
          notes?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recipient_phone?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          accent_color: string
          background_color: string
          background_image_url: string | null
          church_name: string
          created_at: string
          custom_message: string | null
          id: string
          logo_url: string | null
          signatory_name: string
          signatory_title: string
          tenant_id: string | null
          text_positions: Json | null
          training_type: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          background_image_url?: string | null
          church_name?: string
          created_at?: string
          custom_message?: string | null
          id?: string
          logo_url?: string | null
          signatory_name?: string
          signatory_title?: string
          tenant_id?: string | null
          text_positions?: Json | null
          training_type: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          background_image_url?: string | null
          church_name?: string
          created_at?: string
          custom_message?: string | null
          id?: string
          logo_url?: string | null
          signatory_name?: string
          signatory_title?: string
          tenant_id?: string | null
          text_positions?: Json | null
          training_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      church_attendance_reports: {
        Row: {
          adult_female: number
          adult_male: number
          children: number
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          service_date: string
          service_type: string
          teens: number
          tenant_id: string | null
          title: string | null
          total_attendance: number
          updated_at: string
        }
        Insert: {
          adult_female?: number
          adult_male?: number
          children?: number
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          service_date: string
          service_type?: string
          teens?: number
          tenant_id?: string | null
          title?: string | null
          total_attendance?: number
          updated_at?: string
        }
        Update: {
          adult_female?: number
          adult_male?: number
          children?: number
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          service_date?: string
          service_type?: string
          teens?: number
          tenant_id?: string | null
          title?: string | null
          total_attendance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_attendance_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      church_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_registrations: {
        Row: {
          course_id: string
          id: string
          member_id: string
          registered_at: string
          tenant_id: string | null
        }
        Insert: {
          course_id: string
          id?: string
          member_id: string
          registered_at?: string
          tenant_id?: string | null
        }
        Update: {
          course_id?: string
          id?: string
          member_id?: string
          registered_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_registrations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "exam_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          related_id: string | null
          related_table: string | null
          tenant_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          related_id?: string | null
          related_table?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          related_id?: string | null
          related_table?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domifort_api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          request_count: number
          revoked_at: string | null
          signing_secret_hash: string
          signing_secret_prefix: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_used_at?: string | null
          request_count?: number
          revoked_at?: string | null
          signing_secret_hash: string
          signing_secret_prefix: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          request_count?: number
          revoked_at?: string | null
          signing_secret_hash?: string
          signing_secret_prefix?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
      domifort_bookings: {
        Row: {
          amount_minor: number | null
          booking_end: string | null
          booking_start: string | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          external_ref: string
          id: string
          location: string | null
          payload: Json
          received_at: string
          service_type: string | null
          source_token_id: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_minor?: number | null
          booking_end?: string | null
          booking_start?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_ref: string
          id?: string
          location?: string | null
          payload: Json
          received_at?: string
          service_type?: string | null
          source_token_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number | null
          booking_end?: string | null
          booking_start?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_ref?: string
          id?: string
          location?: string | null
          payload?: Json
          received_at?: string
          service_type?: string | null
          source_token_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domifort_bookings_source_token_id_fkey"
            columns: ["source_token_id"]
            isOneToOne: false
            referencedRelation: "domifort_api_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domifort_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      domifort_ingest_log: {
        Row: {
          auth_valid: boolean
          error: string | null
          external_ref: string | null
          id: string
          ip: string | null
          payload_size: number | null
          received_at: string
          signature_valid: boolean
          status_code: number
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth_valid?: boolean
          error?: string | null
          external_ref?: string | null
          id?: string
          ip?: string | null
          payload_size?: number | null
          received_at?: string
          signature_valid?: boolean
          status_code: number
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_valid?: boolean
          error?: string | null
          external_ref?: string | null
          id?: string
          ip?: string | null
          payload_size?: number | null
          received_at?: string
          signature_valid?: boolean
          status_code?: number
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domifort_ingest_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "domifort_api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_reactions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reaction: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reaction?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reaction?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string | null
          guest_name: string | null
          id: string
          member_id: string | null
          status: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          member_id?: string | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          member_id?: string | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audience: string
          capacity: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_mode: string
          id: string
          is_public: boolean | null
          is_recurring: boolean
          location: string | null
          recurrence_end_date: string | null
          recurrence_frequency: string | null
          recurrence_parent_id: string | null
          reminder_days_before: number[] | null
          reminder_hours_before: number[] | null
          reminder_sent: boolean
          requires_registration: boolean | null
          start_time: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_mode?: string
          id?: string
          is_public?: boolean | null
          is_recurring?: boolean
          location?: string | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          recurrence_parent_id?: string | null
          reminder_days_before?: number[] | null
          reminder_hours_before?: number[] | null
          reminder_sent?: boolean
          requires_registration?: boolean | null
          start_time?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_mode?: string
          id?: string
          is_public?: boolean | null
          is_recurring?: boolean
          location?: string | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          recurrence_parent_id?: string | null
          reminder_days_before?: number[] | null
          reminder_hours_before?: number[] | null
          reminder_sent?: boolean
          requires_registration?: boolean | null
          start_time?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_answer: string | null
          tenant_id: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_answer?: string | null
          tenant_id?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_answer?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          certificate_issued: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          member_id: string
          passed: boolean | null
          retake_allowed: boolean
          score: number | null
          session_id: string | null
          started_at: string
          subject_id: string | null
          tenant_id: string | null
          total_points: number | null
          training_type: string
        }
        Insert: {
          certificate_issued?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          passed?: boolean | null
          retake_allowed?: boolean
          score?: number | null
          session_id?: string | null
          started_at?: string
          subject_id?: string | null
          tenant_id?: string | null
          total_points?: number | null
          training_type: string
        }
        Update: {
          certificate_issued?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          passed?: boolean | null
          retake_allowed?: boolean
          score?: number | null
          session_id?: string | null
          started_at?: string
          subject_id?: string | null
          tenant_id?: string | null
          total_points?: number | null
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_question_answers: {
        Row: {
          correct_answer: string
          question_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          correct_answer: string
          question_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          question_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_question_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          answer_count: number
          created_at: string
          created_by: string | null
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          points: number
          question_text: string
          question_type: string
          sort_order: number
          subject_id: string | null
          tenant_id: string | null
          training_type: string
        }
        Insert: {
          answer_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          points?: number
          question_text: string
          question_type?: string
          sort_order?: number
          subject_id?: string | null
          tenant_id?: string | null
          training_type: string
        }
        Update: {
          answer_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          points?: number
          question_text?: string
          question_type?: string
          sort_order?: number
          subject_id?: string | null
          tenant_id?: string | null
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_session_courses: {
        Row: {
          exam_title: string
          id: string
          session_id: string
          sort_order: number
          tenant_id: string | null
        }
        Insert: {
          exam_title: string
          id?: string
          session_id: string
          sort_order?: number
          tenant_id?: string | null
        }
        Update: {
          exam_title?: string
          id?: string
          session_id?: string
          sort_order?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_session_courses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_session_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ended_at: string | null
          id: string
          name: string
          pass_mark_percentage: number
          started_at: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          name: string
          pass_mark_percentage?: number
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          name?: string
          pass_mark_percentage?: number
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          grade_classifications: Json | null
          id: string
          is_active: boolean
          name: string
          pass_mark_percentage: number
          randomize_questions: boolean
          sort_order: number
          tenant_id: string | null
          time_limit_minutes: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          grade_classifications?: Json | null
          id?: string
          is_active?: boolean
          name: string
          pass_mark_percentage?: number
          randomize_questions?: boolean
          sort_order?: number
          tenant_id?: string | null
          time_limit_minutes?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          grade_classifications?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          pass_mark_percentage?: number
          randomize_questions?: boolean
          sort_order?: number
          tenant_id?: string | null
          time_limit_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "exam_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subjects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_titles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          exams_open: boolean
          grade_classifications: Json | null
          id: string
          is_active: boolean
          name: string
          pass_mark_percentage: number
          registration_open: boolean
          send_certificate_email: boolean
          send_result_email: boolean
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exams_open?: boolean
          grade_classifications?: Json | null
          id?: string
          is_active?: boolean
          name: string
          pass_mark_percentage?: number
          registration_open?: boolean
          send_certificate_email?: boolean
          send_result_email?: boolean
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exams_open?: boolean
          grade_classifications?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          pass_mark_percentage?: number
          registration_open?: boolean
          send_certificate_email?: boolean
          send_result_email?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_titles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      first_timers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          follow_up_assigned_to: string | null
          follow_up_status:
            | Database["public"]["Enums"]["followup_status"]
            | null
          how_heard: string | null
          id: string
          last_name: string
          member_id: string | null
          notes: string | null
          phone: string | null
          prayer_request: string | null
          tenant_id: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          follow_up_assigned_to?: string | null
          follow_up_status?:
            | Database["public"]["Enums"]["followup_status"]
            | null
          how_heard?: string | null
          id?: string
          last_name: string
          member_id?: string | null
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          tenant_id?: string | null
          updated_at?: string
          visit_date?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          follow_up_assigned_to?: string | null
          follow_up_status?:
            | Database["public"]["Enums"]["followup_status"]
            | null
          how_heard?: string | null
          id?: string
          last_name?: string
          member_id?: string | null
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          tenant_id?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "first_timers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "first_timers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_message_templates: {
        Row: {
          channel: string
          created_at: string
          delay_hours: number
          followup_type: string
          id: string
          is_active: boolean
          message_template: string
          sort_order: number
          subject: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          delay_hours?: number
          followup_type: string
          id?: string
          is_active?: boolean
          message_template: string
          sort_order?: number
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          delay_hours?: number
          followup_type?: string
          id?: string
          is_active?: boolean
          message_template?: string
          sort_order?: number
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_referral_updates: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          referral_id: string
          status_change:
            | Database["public"]["Enums"]["followup_referral_status"]
            | null
          tenant_id: string
          update_text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          referral_id: string
          status_change?:
            | Database["public"]["Enums"]["followup_referral_status"]
            | null
          tenant_id: string
          update_text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          referral_id?: string
          status_change?:
            | Database["public"]["Enums"]["followup_referral_status"]
            | null
          tenant_id?: string
          update_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_referral_updates_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "followup_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_referral_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_referrals: {
        Row: {
          assigned_leader_id: string | null
          created_at: string
          followup_id: string
          id: string
          member_id: string | null
          notes: string | null
          referral_type: Database["public"]["Enums"]["followup_referral_type"]
          referred_by: string | null
          status: Database["public"]["Enums"]["followup_referral_status"]
          target_unit_name: string | null
          target_wsf_centre_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_leader_id?: string | null
          created_at?: string
          followup_id: string
          id?: string
          member_id?: string | null
          notes?: string | null
          referral_type: Database["public"]["Enums"]["followup_referral_type"]
          referred_by?: string | null
          status?: Database["public"]["Enums"]["followup_referral_status"]
          target_unit_name?: string | null
          target_wsf_centre_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_leader_id?: string | null
          created_at?: string
          followup_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          referral_type?: Database["public"]["Enums"]["followup_referral_type"]
          referred_by?: string | null
          status?: Database["public"]["Enums"]["followup_referral_status"]
          target_unit_name?: string | null
          target_wsf_centre_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_referrals_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_referrals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_referrals_target_wsf_centre_id_fkey"
            columns: ["target_wsf_centre_id"]
            isOneToOne: false
            referencedRelation: "wsf_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_scheduled_messages: {
        Row: {
          channel: Database["public"]["Enums"]["followup_message_channel"]
          created_at: string
          created_by: string | null
          error_message: string | null
          followup_id: string
          id: string
          member_id: string | null
          message: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["followup_message_status"]
          subject: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["followup_message_channel"]
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          followup_id: string
          id?: string
          member_id?: string | null
          message: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_message_status"]
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["followup_message_channel"]
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          followup_id?: string
          id?: string
          member_id?: string | null
          message?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["followup_message_status"]
          subject?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_scheduled_messages_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_scheduled_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_scheduled_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          followup_type: Database["public"]["Enums"]["followup_type"]
          id: string
          member_id: string | null
          notes: string | null
          priority: string | null
          status: Database["public"]["Enums"]["followup_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          followup_type: Database["public"]["Enums"]["followup_type"]
          id?: string
          member_id?: string | null
          notes?: string | null
          priority?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          followup_type?: Database["public"]["Enums"]["followup_type"]
          id?: string
          member_id?: string | null
          notes?: string | null
          priority?: string | null
          status?: Database["public"]["Enums"]["followup_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      member_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          member_id: string
          new_status: string
          previous_status: string | null
          tenant_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          member_id: string
          new_status: string
          previous_status?: string | null
          tenant_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          member_id?: string
          new_status?: string
          previous_status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_status_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          attended_foundation_school: boolean | null
          baptized_by_immersion: boolean | null
          bcc_completed: boolean | null
          bfc_completed: boolean | null
          church_unit: string | null
          city: string | null
          created_at: string
          data_retention_reviewed_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gdpr_consent: boolean | null
          gdpr_consent_date: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          holy_spirit_baptism: boolean | null
          how_did_you_hear: string | null
          id: string
          last_name: string
          lcc_completed: boolean | null
          ldc_completed: boolean | null
          live_work_in_city: boolean | null
          membership_date: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          notes: string | null
          phone: string | null
          photo_url: string | null
          postcode: string | null
          preferred_contact_modes: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string | null
          water_baptism: boolean | null
          winners_satellite: boolean | null
          wofbi_highest_level: string | null
          workers_in_training: boolean | null
          worshipped_at_other_wci: boolean | null
          worshipped_before: boolean | null
          worshipped_when_where: string | null
          would_like_to_join: boolean | null
          wsf_centre_id: string | null
        }
        Insert: {
          address?: string | null
          attended_foundation_school?: boolean | null
          baptized_by_immersion?: boolean | null
          bcc_completed?: boolean | null
          bfc_completed?: boolean | null
          church_unit?: string | null
          city?: string | null
          created_at?: string
          data_retention_reviewed_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gdpr_consent?: boolean | null
          gdpr_consent_date?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          holy_spirit_baptism?: boolean | null
          how_did_you_hear?: string | null
          id?: string
          last_name: string
          lcc_completed?: boolean | null
          ldc_completed?: boolean | null
          live_work_in_city?: boolean | null
          membership_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          preferred_contact_modes?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          water_baptism?: boolean | null
          winners_satellite?: boolean | null
          wofbi_highest_level?: string | null
          workers_in_training?: boolean | null
          worshipped_at_other_wci?: boolean | null
          worshipped_before?: boolean | null
          worshipped_when_where?: string | null
          would_like_to_join?: boolean | null
          wsf_centre_id?: string | null
        }
        Update: {
          address?: string | null
          attended_foundation_school?: boolean | null
          baptized_by_immersion?: boolean | null
          bcc_completed?: boolean | null
          bfc_completed?: boolean | null
          church_unit?: string | null
          city?: string | null
          created_at?: string
          data_retention_reviewed_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gdpr_consent?: boolean | null
          gdpr_consent_date?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          holy_spirit_baptism?: boolean | null
          how_did_you_hear?: string | null
          id?: string
          last_name?: string
          lcc_completed?: boolean | null
          ldc_completed?: boolean | null
          live_work_in_city?: boolean | null
          membership_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          preferred_contact_modes?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          water_baptism?: boolean | null
          winners_satellite?: boolean | null
          wofbi_highest_level?: string | null
          workers_in_training?: boolean | null
          worshipped_at_other_wci?: boolean | null
          worshipped_before?: boolean | null
          worshipped_when_where?: string | null
          would_like_to_join?: boolean | null
          wsf_centre_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_members_wsf_centre"
            columns: ["wsf_centre_id"]
            isOneToOne: false
            referencedRelation: "wsf_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string | null
          sender_id: string
          subject: string | null
          tenant_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          sender_id: string
          subject?: string | null
          tenant_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          sender_id?: string
          subject?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pastoral_care: {
        Row: {
          assigned_to: string | null
          care_type: Database["public"]["Enums"]["pastoral_care_type"]
          confidential: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_id: string | null
          resolution_notes: string | null
          status: Database["public"]["Enums"]["pastoral_care_status"]
          subject: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          care_type: Database["public"]["Enums"]["pastoral_care_type"]
          confidential?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["pastoral_care_status"]
          subject: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          care_type?: Database["public"]["Enums"]["pastoral_care_type"]
          confidential?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["pastoral_care_status"]
          subject?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastoral_care_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastoral_care_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_locations: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purged_data_archives: {
        Row: {
          created_at: string
          data: Json
          expires_at: string
          id: string
          purged_at: string
          purged_by: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          expires_at?: string
          id?: string
          purged_at?: string
          purged_by: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          purged_at?: string
          purged_by?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purged_data_archives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_communications: {
        Row: {
          channel: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          filters: Json | null
          id: string
          message: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          tenant_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          filters?: Json | null
          id?: string
          message: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          filters?: Json | null
          id?: string
          message?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sermon_note_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sermon_note_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sermon_notes: {
        Row: {
          category: string | null
          content: string
          created_at: string
          folder_id: string | null
          id: string
          service_date: string
          speaker: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          folder_id?: string | null
          id?: string
          service_date?: string
          speaker?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          service_date?: string
          speaker?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sermon_notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "sermon_note_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sermon_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          channel: string
          created_at: string
          delivery_status: string | null
          delivery_updated_at: string | null
          error_message: string | null
          id: string
          message: string
          message_sid: string | null
          recipient_member_id: string | null
          recipient_phone: string
          reference_id: string | null
          sender_id: string
          sms_type: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          message_sid?: string | null
          recipient_member_id?: string | null
          recipient_phone: string
          reference_id?: string | null
          sender_id: string
          sms_type?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          message_sid?: string | null
          recipient_member_id?: string | null
          recipient_phone?: string
          reference_id?: string | null
          sender_id?: string
          sms_type?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppressed_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          tenant_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          tenant_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoices: {
        Row: {
          bill_to: Json
          created_at: string
          created_by: string | null
          currency: string
          document_type: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          line_items: Json
          notes: string | null
          payment_id: string | null
          pdf_url: string | null
          sent_at: string | null
          sent_to: string | null
          status: string
          subscription_id: string | null
          subtotal: number
          tax_amount: number
          tenant_id: string
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          bill_to?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          document_type: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          line_items?: Json
          notes?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          bill_to?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          line_items?: Json
          notes?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "tenant_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
          reference: string | null
          status: string
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          currency: string
          grace_period_days: number
          id: string
          is_active: boolean
          next_due_date: string
          setup_fee_amount: number
          setup_fee_paid: boolean
          setup_fee_paid_at: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          grace_period_days?: number
          id?: string
          is_active?: boolean
          next_due_date: string
          setup_fee_amount?: number
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          grace_period_days?: number
          id?: string
          is_active?: boolean
          next_due_date?: string
          setup_fee_amount?: number
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          logo_url: string | null
          member_limit: number
          name: string
          plan_tier: string
          settings: Json | null
          setup_complete: boolean
          slug: string
          sms_limit_monthly: number
          storage_limit_mb: number
          subscription_status: string
          timezone: string
          updated_at: string
          whatsapp_limit_monthly: number
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          member_limit?: number
          name: string
          plan_tier?: string
          settings?: Json | null
          setup_complete?: boolean
          slug: string
          sms_limit_monthly?: number
          storage_limit_mb?: number
          subscription_status?: string
          timezone?: string
          updated_at?: string
          whatsapp_limit_monthly?: number
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          member_limit?: number
          name?: string
          plan_tier?: string
          settings?: Json | null
          setup_complete?: boolean
          slug?: string
          sms_limit_monthly?: number
          storage_limit_mb?: number
          subscription_status?: string
          timezone?: string
          updated_at?: string
          whatsapp_limit_monthly?: number
        }
        Relationships: []
      }
      testimonies: {
        Row: {
          action: string
          created_at: string
          god_did: string
          id: string
          member_name: string | null
          share_publicly: boolean
          situation: string
          tenant_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          god_did: string
          id?: string
          member_name?: string | null
          share_publicly?: boolean
          situation: string
          tenant_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          god_did?: string
          id?: string
          member_name?: string | null
          share_publicly?: boolean
          situation?: string
          tenant_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_completions: {
        Row: {
          certificate_number: string
          certificate_url: string | null
          completion_date: string
          created_at: string
          id: string
          issued_by: string
          member_id: string
          notes: string | null
          tenant_id: string | null
          training_type: string
        }
        Insert: {
          certificate_number: string
          certificate_url?: string | null
          completion_date?: string
          created_at?: string
          id?: string
          issued_by: string
          member_id: string
          notes?: string | null
          tenant_id?: string | null
          training_type: string
        }
        Update: {
          certificate_number?: string
          certificate_url?: string | null
          completion_date?: string
          created_at?: string
          id?: string
          issued_by?: string
          member_id?: string
          notes?: string | null
          tenant_id?: string | null
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_reports: {
        Row: {
          created_at: string
          female: number
          holy_ghost_baptism: number
          id: string
          male: number
          notes: string | null
          recorded_by: string | null
          session_date: string
          tenant_id: string | null
          title: string | null
          total_attendance: number
          training_type: string
          updated_at: string
          water_baptism: number
        }
        Insert: {
          created_at?: string
          female?: number
          holy_ghost_baptism?: number
          id?: string
          male?: number
          notes?: string | null
          recorded_by?: string | null
          session_date: string
          tenant_id?: string | null
          title?: string | null
          total_attendance?: number
          training_type: string
          updated_at?: string
          water_baptism?: number
        }
        Update: {
          created_at?: string
          female?: number
          holy_ghost_baptism?: number
          id?: string
          male?: number
          notes?: string | null
          recorded_by?: string | null
          session_date?: string
          tenant_id?: string | null
          title?: string | null
          total_attendance?: number
          training_type?: string
          updated_at?: string
          water_baptism?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transportation: {
        Row: {
          assigned_driver: string | null
          assigned_to: string | null
          created_at: string
          destination: string | null
          driver_phone: string | null
          id: string
          member_id: string | null
          notes: string | null
          passengers: number | null
          pickup_address: string
          pickup_time: string | null
          request_date: string
          status: Database["public"]["Enums"]["transport_status"]
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_driver?: string | null
          assigned_to?: string | null
          created_at?: string
          destination?: string | null
          driver_phone?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          passengers?: number | null
          pickup_address: string
          pickup_time?: string | null
          request_date: string
          status?: Database["public"]["Enums"]["transport_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_driver?: string | null
          assigned_to?: string | null
          created_at?: string
          destination?: string | null
          driver_phone?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          passengers?: number | null
          pickup_address?: string
          pickup_time?: string | null
          request_date?: string
          status?: Database["public"]["Enums"]["transport_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transportation_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_join_requests: {
        Row: {
          created_at: string
          decline_reason: string | null
          id: string
          member_id: string
          request_type: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          unit_name: string | null
          updated_at: string
          wsf_centre_id: string | null
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          member_id: string
          request_type: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          unit_name?: string | null
          updated_at?: string
          wsf_centre_id?: string | null
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          id?: string
          member_id?: string
          request_type?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          unit_name?: string | null
          updated_at?: string
          wsf_centre_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_join_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_join_requests_wsf_centre_id_fkey"
            columns: ["wsf_centre_id"]
            isOneToOne: false
            referencedRelation: "wsf_centres"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_leader_assignments: {
        Row: {
          created_at: string
          id: string
          tenant_id: string | null
          unit_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id?: string | null
          unit_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string | null
          unit_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_leader_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wsf_attendance: {
        Row: {
          centre_id: string
          created_at: string
          id: string
          meeting_date: string
          member_id: string
          notes: string | null
          present: boolean | null
          recorded_by: string | null
          tenant_id: string | null
        }
        Insert: {
          centre_id: string
          created_at?: string
          id?: string
          meeting_date: string
          member_id: string
          notes?: string | null
          present?: boolean | null
          recorded_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          centre_id?: string
          created_at?: string
          id?: string
          meeting_date?: string
          member_id?: string
          notes?: string | null
          present?: boolean | null
          recorded_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wsf_attendance_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "wsf_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wsf_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wsf_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wsf_attendance_reports: {
        Row: {
          centre_id: string
          children: number
          created_at: string
          female: number
          first_timers: number
          id: string
          male: number
          meeting_date: string
          notes: string | null
          reported_by: string | null
          tenant_id: string | null
          testimonies: number
          updated_at: string
        }
        Insert: {
          centre_id: string
          children?: number
          created_at?: string
          female?: number
          first_timers?: number
          id?: string
          male?: number
          meeting_date: string
          notes?: string | null
          reported_by?: string | null
          tenant_id?: string | null
          testimonies?: number
          updated_at?: string
        }
        Update: {
          centre_id?: string
          children?: number
          created_at?: string
          female?: number
          first_timers?: number
          id?: string
          male?: number
          meeting_date?: string
          notes?: string | null
          reported_by?: string | null
          tenant_id?: string | null
          testimonies?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wsf_attendance_reports_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "wsf_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wsf_attendance_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wsf_centres: {
        Row: {
          address: string | null
          city: string | null
          coverage_postcodes: string | null
          created_at: string
          host_member_id: string | null
          host_name: string | null
          id: string
          is_active: boolean | null
          leader_id: string | null
          location: string | null
          meeting_day: string | null
          meeting_time: string | null
          name: string
          postcode: string | null
          tenant_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          coverage_postcodes?: string | null
          created_at?: string
          host_member_id?: string | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name: string
          postcode?: string | null
          tenant_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          coverage_postcodes?: string | null
          created_at?: string
          host_member_id?: string | null
          host_name?: string | null
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name?: string
          postcode?: string | null
          tenant_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wsf_centres_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wsf_centres_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wsf_centres_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "wsf_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      wsf_zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wsf_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_tenant_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      approve_join_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      auto_link_member_by_email:
        | { Args: { _email: string; _user_id: string }; Returns: string }
        | {
            Args: { _email: string; _tenant_id?: string; _user_id: string }
            Returns: string
          }
      count_pending_join_requests_for_user: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: number
      }
      create_tenant_owner: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      decline_join_request: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_church_unit_names: {
        Args: { _tenant_slug?: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_active_wsf_centre_names: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      get_exam_questions_safe: {
        Args: { _subject_id?: string; _training_type?: string }
        Returns: {
          answer_count: number
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          points: number
          question_text: string
          question_type: string
          sort_order: number
          subject_id: string
          tenant_id: string
          training_type: string
        }[]
      }
      get_exam_questions_with_answers: {
        Args: {
          _subject_id?: string
          _tenant_id: string
          _training_type?: string
        }
        Returns: {
          answer_count: number
          correct_answer: string
          created_at: string
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          points: number
          question_text: string
          question_type: string
          sort_order: number
          subject_id: string
          tenant_id: string
          training_type: string
        }[]
      }
      get_tenant_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          settings: Json
          slug: string
        }[]
      }
      get_tenant_message_usage: {
        Args: { _tenant_id: string }
        Returns: {
          sms_count: number
          whatsapp_count: number
        }[]
      }
      get_upcoming_birthdays: {
        Args: { _days_ahead?: number; _tenant_id: string }
        Returns: {
          church_unit: string
          date_of_birth: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          photo_url: string
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _tenant_id: string
              _user_id: string
            }
            Returns: boolean
          }
      is_admin:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { _tenant_id: string; _user_id: string }; Returns: boolean }
      is_assigned_referral_leader_for_member: {
        Args: { _member_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_followup_team_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_home_cell_leader_for_centre: {
        Args: { _centre_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_unit_leader_for_member: {
        Args: { _church_unit: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_unit_leader_for_session: {
        Args: { _tenant_id: string; _unit: string; _user_id: string }
        Returns: boolean
      }
      is_wsf_leader_for_centre: {
        Args: { _centre_id: string; _user_id: string }
        Returns: boolean
      }
      is_wsf_leader_for_session: {
        Args: { _tenant_id: string; _unit: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_invoice_number: {
        Args: { _doc_type: string; _tenant_id: string }
        Returns: string
      }
      notify_all_users:
        | {
            Args: {
              _message: string
              _reference_id?: string
              _reference_type?: string
              _title: string
              _type?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _message: string
              _reference_id?: string
              _reference_type?: string
              _tenant_id?: string
              _title: string
              _type?: string
            }
            Returns: undefined
          }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      update_own_member_profile:
        | {
            Args: {
              _address?: string
              _city?: string
              _date_of_birth?: string
              _email?: string
              _emergency_contact_name?: string
              _emergency_contact_phone?: string
              _first_name?: string
              _gender?: string
              _last_name?: string
              _member_id: string
              _notes?: string
              _phone?: string
              _photo_url?: string
              _postcode?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _address?: string
              _attended_foundation_school?: boolean
              _baptized_by_immersion?: boolean
              _bcc_completed?: boolean
              _bfc_completed?: boolean
              _church_unit?: string
              _city?: string
              _date_of_birth?: string
              _email?: string
              _emergency_contact_name?: string
              _emergency_contact_phone?: string
              _first_name?: string
              _gender?: string
              _holy_spirit_baptism?: boolean
              _how_did_you_hear?: string
              _last_name?: string
              _lcc_completed?: boolean
              _ldc_completed?: boolean
              _live_work_in_city?: boolean
              _member_id: string
              _membership_status?: string
              _notes?: string
              _phone?: string
              _photo_url?: string
              _postcode?: string
              _preferred_contact_modes?: string
              _water_baptism?: boolean
              _winners_satellite?: boolean
              _wofbi_highest_level?: string
              _workers_in_training?: boolean
              _worshipped_at_other_wci?: boolean
              _worshipped_before?: boolean
              _worshipped_when_where?: string
              _would_like_to_join?: boolean
              _wsf_centre_id?: string
            }
            Returns: undefined
          }
      upsert_own_member_profile: {
        Args: {
          p_address?: string
          p_attended_foundation_school?: boolean
          p_baptized_by_immersion?: boolean
          p_bcc_completed?: boolean
          p_bfc_completed?: boolean
          p_church_unit?: string
          p_city?: string
          p_date_of_birth?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_first_name: string
          p_gdpr_consent?: boolean
          p_gender?: string
          p_holy_spirit_baptism?: boolean
          p_how_did_you_hear?: string
          p_last_name: string
          p_lcc_completed?: boolean
          p_ldc_completed?: boolean
          p_live_work_in_city?: boolean
          p_membership_status?: string
          p_notes?: string
          p_phone?: string
          p_postcode?: string
          p_preferred_contact_modes?: string
          p_tenant_id: string
          p_water_baptism?: boolean
          p_winners_satellite?: boolean
          p_wofbi_highest_level?: string
          p_worshipped_at_other_wci?: boolean
          p_worshipped_before?: boolean
          p_worshipped_when_where?: string
          p_would_like_to_join?: boolean
          p_wsf_centre_id?: string
        }
        Returns: string
      }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_tenant_access: { Args: { _tenant_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "unit_leader"
        | "member"
        | "wsf_leader"
      followup_message_channel: "sms" | "email"
      followup_message_status:
        | "draft"
        | "scheduled"
        | "sent"
        | "failed"
        | "cancelled"
      followup_referral_status:
        | "pending"
        | "contacted"
        | "engaged"
        | "joined"
        | "declined"
        | "closed"
      followup_referral_type: "unit_leader" | "home_cell_leader"
      followup_status: "Pending" | "In Progress" | "Completed" | "Overdue"
      followup_type:
        | "First Timer"
        | "New Convert"
        | "Absentee"
        | "General"
        | "Pastoral"
        | "Visitor"
      gender_type: "Male" | "Female"
      membership_status:
        | "Active"
        | "Inactive"
        | "New Convert"
        | "First Timer"
        | "Visitor"
      pastoral_care_status: "Open" | "In Progress" | "Resolved" | "Closed"
      pastoral_care_type:
        | "Counselling"
        | "Visitation"
        | "Prayer Request"
        | "Hospital Visit"
        | "Bereavement"
        | "Marriage"
        | "Financial Support"
        | "Other"
      session_type:
        | "Sunday Service"
        | "Midweek Service"
        | "Special Program"
        | "Unit Meeting"
        | "Home Cell Meeting"
        | "Other"
      tenant_role: "owner" | "admin" | "member"
      transport_status: "Pending" | "Confirmed" | "Completed" | "Cancelled"
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
    Enums: {
      app_role: ["super_admin", "admin", "unit_leader", "member", "wsf_leader"],
      followup_message_channel: ["sms", "email"],
      followup_message_status: [
        "draft",
        "scheduled",
        "sent",
        "failed",
        "cancelled",
      ],
      followup_referral_status: [
        "pending",
        "contacted",
        "engaged",
        "joined",
        "declined",
        "closed",
      ],
      followup_referral_type: ["unit_leader", "home_cell_leader"],
      followup_status: ["Pending", "In Progress", "Completed", "Overdue"],
      followup_type: [
        "First Timer",
        "New Convert",
        "Absentee",
        "General",
        "Pastoral",
        "Visitor",
      ],
      gender_type: ["Male", "Female"],
      membership_status: [
        "Active",
        "Inactive",
        "New Convert",
        "First Timer",
        "Visitor",
      ],
      pastoral_care_status: ["Open", "In Progress", "Resolved", "Closed"],
      pastoral_care_type: [
        "Counselling",
        "Visitation",
        "Prayer Request",
        "Hospital Visit",
        "Bereavement",
        "Marriage",
        "Financial Support",
        "Other",
      ],
      session_type: [
        "Sunday Service",
        "Midweek Service",
        "Special Program",
        "Unit Meeting",
        "Home Cell Meeting",
        "Other",
      ],
      tenant_role: ["owner", "admin", "member"],
      transport_status: ["Pending", "Confirmed", "Completed", "Cancelled"],
    },
  },
} as const
