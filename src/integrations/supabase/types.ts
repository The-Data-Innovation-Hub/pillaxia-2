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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          clinician_user_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          location: string | null
          patient_user_id: string
          reminder_sent: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          clinician_user_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          patient_user_id: string
          reminder_sent?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          clinician_user_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          patient_user_id?: string
          reminder_sent?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      caregiver_invitations: {
        Row: {
          caregiver_email: string
          caregiver_user_id: string | null
          created_at: string
          id: string
          patient_user_id: string
          permissions: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          caregiver_email: string
          caregiver_user_id?: string | null
          created_at?: string
          id?: string
          patient_user_id: string
          permissions?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          caregiver_email?: string
          caregiver_user_id?: string | null
          created_at?: string
          id?: string
          patient_user_id?: string
          permissions?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      caregiver_messages: {
        Row: {
          caregiver_user_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          patient_user_id: string
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          caregiver_user_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          patient_user_id: string
          sender_type?: string
          updated_at?: string | null
        }
        Update: {
          caregiver_user_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          patient_user_id?: string
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clinician_messages: {
        Row: {
          clinician_user_id: string
          created_at: string
          delivery_status: Json | null
          id: string
          is_read: boolean
          message: string
          patient_user_id: string
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          clinician_user_id: string
          created_at?: string
          delivery_status?: Json | null
          id?: string
          is_read?: boolean
          message: string
          patient_user_id: string
          sender_type?: string
          updated_at?: string | null
        }
        Update: {
          clinician_user_id?: string
          created_at?: string
          delivery_status?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          patient_user_id?: string
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clinician_patient_assignments: {
        Row: {
          assigned_at: string
          clinician_user_id: string
          id: string
          notes: string | null
          patient_user_id: string
        }
        Insert: {
          assigned_at?: string
          clinician_user_id: string
          id?: string
          notes?: string | null
          patient_user_id: string
        }
        Update: {
          assigned_at?: string
          clinician_user_id?: string
          id?: string
          notes?: string | null
          patient_user_id?: string
        }
        Relationships: []
      }
      controlled_drug_adjustments: {
        Row: {
          adjustment_type: string
          controlled_drug_id: string
          created_at: string
          id: string
          invoice_number: string | null
          new_stock: number
          performed_by: string
          previous_stock: number
          quantity: number
          reason: string
          supplier: string | null
          witness_id: string | null
        }
        Insert: {
          adjustment_type: string
          controlled_drug_id: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          new_stock: number
          performed_by: string
          previous_stock: number
          quantity: number
          reason: string
          supplier?: string | null
          witness_id?: string | null
        }
        Update: {
          adjustment_type?: string
          controlled_drug_id?: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          new_stock?: number
          performed_by?: string
          previous_stock?: number
          quantity?: number
          reason?: string
          supplier?: string | null
          witness_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlled_drug_adjustments_controlled_drug_id_fkey"
            columns: ["controlled_drug_id"]
            isOneToOne: false
            referencedRelation: "controlled_drugs"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_drug_dispensing: {
        Row: {
          controlled_drug_id: string
          created_at: string
          dispensed_at: string
          dispensing_pharmacist_id: string
          id: string
          notes: string | null
          patient_id: string | null
          patient_name: string
          prescriber_dea: string | null
          prescriber_name: string
          prescription_number: string
          quantity_dispensed: number
          quantity_remaining: number
          witness_pharmacist_id: string | null
        }
        Insert: {
          controlled_drug_id: string
          created_at?: string
          dispensed_at?: string
          dispensing_pharmacist_id: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          patient_name: string
          prescriber_dea?: string | null
          prescriber_name: string
          prescription_number: string
          quantity_dispensed: number
          quantity_remaining: number
          witness_pharmacist_id?: string | null
        }
        Update: {
          controlled_drug_id?: string
          created_at?: string
          dispensed_at?: string
          dispensing_pharmacist_id?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          patient_name?: string
          prescriber_dea?: string | null
          prescriber_name?: string
          prescription_number?: string
          quantity_dispensed?: number
          quantity_remaining?: number
          witness_pharmacist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlled_drug_dispensing_controlled_drug_id_fkey"
            columns: ["controlled_drug_id"]
            isOneToOne: false
            referencedRelation: "controlled_drugs"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_drugs: {
        Row: {
          created_at: string
          created_by: string | null
          current_stock: number
          form: string
          generic_name: string | null
          id: string
          is_active: boolean
          manufacturer: string | null
          minimum_stock: number
          name: string
          ndc_number: string | null
          schedule: Database["public"]["Enums"]["drug_schedule"]
          storage_location: string | null
          strength: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_stock?: number
          form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          minimum_stock?: number
          name: string
          ndc_number?: string | null
          schedule: Database["public"]["Enums"]["drug_schedule"]
          storage_location?: string | null
          strength: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_stock?: number
          form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          minimum_stock?: number
          name?: string
          ndc_number?: string | null
          schedule?: Database["public"]["Enums"]["drug_schedule"]
          storage_location?: string | null
          strength?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      drug_interactions: {
        Row: {
          created_at: string
          description: string
          drug_a: string
          drug_b: string
          id: string
          recommendation: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          description: string
          drug_a: string
          drug_b: string
          id?: string
          recommendation?: string | null
          severity: string
        }
        Update: {
          created_at?: string
          description?: string
          drug_a?: string
          drug_b?: string
          id?: string
          recommendation?: string | null
          severity?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          schedule_id: string
          scheduled_time: string
          status: string
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          schedule_id: string
          scheduled_time: string
          status?: string
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          schedule_id?: string
          scheduled_time?: string
          status?: string
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          id: string
          is_active: boolean
          medication_id: string
          quantity: number
          time_of_day: string
          user_id: string
          with_food: boolean | null
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          medication_id: string
          quantity?: number
          time_of_day: string
          user_id: string
          with_food?: boolean | null
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          medication_id?: string
          quantity?: number
          time_of_day?: string
          user_id?: string
          with_food?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string
          dosage_unit: string
          end_date: string | null
          form: string
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          pharmacy: string | null
          prescriber: string | null
          refills_remaining: number | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage: string
          dosage_unit?: string
          end_date?: string | null
          form?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          pharmacy?: string | null
          prescriber?: string | null
          refills_remaining?: number | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string
          dosage_unit?: string
          end_date?: string | null
          form?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          pharmacy?: string | null
          prescriber?: string | null
          refills_remaining?: number | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          notification_type: string
          opened_at: string | null
          retry_count: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type: string
          opened_at?: string | null
          retry_count?: number
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          notification_type?: string
          opened_at?: string | null
          retry_count?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          description: string | null
          id: string
          is_enabled: boolean
          setting_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_enabled?: boolean
          setting_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_enabled?: boolean
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      patient_activity_log: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_allergies: {
        Row: {
          allergen: string
          created_at: string
          id: string
          is_drug_allergy: boolean
          reaction_description: string | null
          reaction_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergen: string
          created_at?: string
          id?: string
          is_drug_allergy?: boolean
          reaction_description?: string | null
          reaction_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergen?: string
          created_at?: string
          id?: string
          is_drug_allergy?: boolean
          reaction_description?: string | null
          reaction_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_chronic_conditions: {
        Row: {
          condition_name: string
          created_at: string
          diagnosed_date: string | null
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          diagnosed_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string
          relationship: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relationship: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relationship?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_engagement_scores: {
        Row: {
          adherence_score: number
          app_usage_score: number
          created_at: string
          id: string
          metrics: Json | null
          notification_score: number
          overall_score: number
          risk_level: string
          score_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adherence_score?: number
          app_usage_score?: number
          created_at?: string
          id?: string
          metrics?: Json | null
          notification_score?: number
          overall_score?: number
          risk_level?: string
          score_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adherence_score?: number
          app_usage_score?: number
          created_at?: string
          id?: string
          metrics?: Json | null
          notification_score?: number
          overall_score?: number
          risk_level?: string
          score_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_notification_preferences: {
        Row: {
          created_at: string
          email_clinician_messages: boolean
          email_encouragements: boolean
          email_missed_alerts: boolean
          email_reminders: boolean
          id: string
          in_app_encouragements: boolean
          in_app_missed_alerts: boolean
          in_app_reminders: boolean
          push_clinician_messages: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_clinician_messages: boolean
          sms_reminders: boolean
          updated_at: string
          user_id: string
          whatsapp_clinician_messages: boolean
          whatsapp_reminders: boolean
        }
        Insert: {
          created_at?: string
          email_clinician_messages?: boolean
          email_encouragements?: boolean
          email_missed_alerts?: boolean
          email_reminders?: boolean
          id?: string
          in_app_encouragements?: boolean
          in_app_missed_alerts?: boolean
          in_app_reminders?: boolean
          push_clinician_messages?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_clinician_messages?: boolean
          sms_reminders?: boolean
          updated_at?: string
          user_id: string
          whatsapp_clinician_messages?: boolean
          whatsapp_reminders?: boolean
        }
        Update: {
          created_at?: string
          email_clinician_messages?: boolean
          email_encouragements?: boolean
          email_missed_alerts?: boolean
          email_reminders?: boolean
          id?: string
          in_app_encouragements?: boolean
          in_app_missed_alerts?: boolean
          in_app_reminders?: boolean
          push_clinician_messages?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_clinician_messages?: boolean
          sms_reminders?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_clinician_messages?: boolean
          whatsapp_reminders?: boolean
        }
        Relationships: []
      }
      polypharmacy_warnings: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          is_acknowledged: boolean
          medication_count: number
          patient_user_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          medication_count: number
          patient_user_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          medication_count?: number
          patient_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          language_preference: string | null
          last_name: string | null
          license_expiration_date: string | null
          license_number: string | null
          organization: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          language_preference?: string | null
          last_name?: string | null
          license_expiration_date?: string | null
          license_number?: string | null
          organization?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          language_preference?: string | null
          last_name?: string | null
          license_expiration_date?: string | null
          license_number?: string | null
          organization?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      red_flag_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          clinician_user_id: string
          created_at: string
          description: string | null
          id: string
          is_acknowledged: boolean
          patient_user_id: string
          severity: number
          symptom_entry_id: string | null
          symptom_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          clinician_user_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_acknowledged?: boolean
          patient_user_id: string
          severity: number
          symptom_entry_id?: string | null
          symptom_type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          clinician_user_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_acknowledged?: boolean
          patient_user_id?: string
          severity?: number
          symptom_entry_id?: string | null
          symptom_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_flag_alerts_symptom_entry_id_fkey"
            columns: ["symptom_entry_id"]
            isOneToOne: false
            referencedRelation: "symptom_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      soap_notes: {
        Row: {
          assessment: string | null
          clinician_user_id: string
          created_at: string
          id: string
          objective: string | null
          patient_user_id: string
          plan: string | null
          subjective: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          assessment?: string | null
          clinician_user_id: string
          created_at?: string
          id?: string
          objective?: string | null
          patient_user_id: string
          plan?: string | null
          subjective?: string | null
          updated_at?: string
          visit_date?: string
        }
        Update: {
          assessment?: string | null
          clinician_user_id?: string
          created_at?: string
          id?: string
          objective?: string | null
          patient_user_id?: string
          plan?: string | null
          subjective?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: []
      }
      symptom_entries: {
        Row: {
          created_at: string
          description: string | null
          id: string
          medication_id: string | null
          recorded_at: string
          severity: number
          symptom_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          medication_id?: string | null
          recorded_at?: string
          severity: number
          symptom_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          medication_id?: string | null
          recorded_at?: string
          severity?: number
          symptom_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_entries_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_caregiver_for_patient: {
        Args: { _caregiver_user_id: string; _patient_user_id: string }
        Returns: boolean
      }
      is_clinician: { Args: { _user_id: string }; Returns: boolean }
      is_clinician_assigned: {
        Args: { _clinician_user_id: string; _patient_user_id: string }
        Returns: boolean
      }
      is_patient: { Args: { _user_id: string }; Returns: boolean }
      is_pharmacist: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "patient" | "clinician" | "pharmacist" | "admin"
      drug_schedule: "II" | "III" | "IV" | "V"
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
      app_role: ["patient", "clinician", "pharmacist", "admin"],
      drug_schedule: ["II", "III", "IV", "V"],
    },
  },
} as const
