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
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in_method: string | null
          checked_in_at: string | null
          created_at: string
          id: string
          member_id: string
          session_id: string
        }
        Insert: {
          check_in_method?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          session_id: string
        }
        Update: {
          check_in_method?: string | null
          checked_in_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
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
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          session_date: string
          session_type: Database["public"]["Enums"]["session_type"]
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          session_date: string
          session_type: Database["public"]["Enums"]["session_type"]
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
          title?: string | null
          total_attendance?: number
          updated_at?: string
        }
        Relationships: []
      }
      church_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          uploaded_by?: string | null
        }
        Relationships: []
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
        }
        Relationships: []
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
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string | null
          guest_name: string | null
          id: string
          member_id: string | null
          status: string | null
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
        ]
      }
      events: {
        Row: {
          capacity: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          is_public: boolean | null
          location: string | null
          requires_registration: boolean | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          requires_registration?: boolean | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          requires_registration?: boolean | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      members: {
        Row: {
          address: string | null
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
          id: string
          last_name: string
          lcc_completed: boolean | null
          ldc_completed: boolean | null
          membership_date: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          notes: string | null
          phone: string | null
          photo_url: string | null
          postcode: string | null
          updated_at: string
          user_id: string | null
          water_baptism: boolean | null
          winners_satellite: boolean | null
          workers_in_training: boolean | null
          wsf_centre_id: string | null
        }
        Insert: {
          address?: string | null
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
          id?: string
          last_name: string
          lcc_completed?: boolean | null
          ldc_completed?: boolean | null
          membership_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          updated_at?: string
          user_id?: string | null
          water_baptism?: boolean | null
          winners_satellite?: boolean | null
          workers_in_training?: boolean | null
          wsf_centre_id?: string | null
        }
        Update: {
          address?: string | null
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
          id?: string
          last_name?: string
          lcc_completed?: boolean | null
          ldc_completed?: boolean | null
          membership_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          updated_at?: string
          user_id?: string | null
          water_baptism?: boolean | null
          winners_satellite?: boolean | null
          workers_in_training?: boolean | null
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
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          sender_id: string
          subject?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          sender_id?: string
          subject?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
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
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_log: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
          title?: string | null
          total_attendance?: number
          training_type?: string
          updated_at?: string
          water_baptism?: number
        }
        Relationships: []
      }
      transportation: {
        Row: {
          assigned_driver: string | null
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
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_driver?: string | null
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
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_driver?: string | null
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
        ]
      }
      unit_leader_assignments: {
        Row: {
          created_at: string
          id: string
          unit_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unit_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
        ]
      }
      wsf_centres: {
        Row: {
          address: string | null
          city: string | null
          coverage_postcodes: string | null
          created_at: string
          id: string
          is_active: boolean | null
          leader_id: string | null
          location: string | null
          meeting_day: string | null
          meeting_time: string | null
          name: string
          postcode: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          coverage_postcodes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name: string
          postcode?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          coverage_postcodes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name?: string
          postcode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wsf_centres_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_own_member_profile: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_all_users: {
        Args: {
          _message: string
          _reference_id?: string
          _reference_type?: string
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
              _city?: string
              _date_of_birth?: string
              _email?: string
              _emergency_contact_name?: string
              _emergency_contact_phone?: string
              _first_name?: string
              _gender?: string
              _last_name?: string
              _member_id: string
              _membership_status?: string
              _notes?: string
              _phone?: string
              _photo_url?: string
              _postcode?: string
            }
            Returns: undefined
          }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "unit_leader"
        | "member"
        | "wsf_leader"
      followup_status: "Pending" | "In Progress" | "Completed" | "Overdue"
      followup_type:
        | "First Timer"
        | "New Convert"
        | "Absentee"
        | "General"
        | "Pastoral"
      gender_type: "Male" | "Female"
      membership_status: "Active" | "Inactive" | "New Convert" | "First Timer"
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
        | "WSF Meeting"
        | "Other"
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
      followup_status: ["Pending", "In Progress", "Completed", "Overdue"],
      followup_type: [
        "First Timer",
        "New Convert",
        "Absentee",
        "General",
        "Pastoral",
      ],
      gender_type: ["Male", "Female"],
      membership_status: ["Active", "Inactive", "New Convert", "First Timer"],
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
        "WSF Meeting",
        "Other",
      ],
      transport_status: ["Pending", "Confirmed", "Completed", "Cancelled"],
    },
  },
} as const
