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
      account_lockouts: {
        Row: {
          created_at: string
          email: string
          failed_attempts: number
          id: string
          locked_at: string
          locked_until: string
          unlock_token: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failed_attempts?: number
          id?: string
          locked_at?: string
          locked_until: string
          unlock_token?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failed_attempts?: number
          id?: string
          locked_at?: string
          locked_until?: string
          unlock_token?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          clinician_user_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_video_call: boolean
          location: string | null
          patient_user_id: string
          reminder_sent: boolean
          status: string
          title: string
          updated_at: string
          video_room_id: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          clinician_user_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_video_call?: boolean
          location?: string | null
          patient_user_id: string
          reminder_sent?: boolean
          status?: string
          title: string
          updated_at?: string
          video_room_id?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          clinician_user_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_video_call?: boolean
          location?: string | null
          patient_user_id?: string
          reminder_sent?: boolean
          status?: string
          title?: string
          updated_at?: string
          video_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_video_room_id_fkey"
            columns: ["video_room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
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
      availability_notification_history: {
        Row: {
          alert_id: string
          availability_id: string
          channels_used: Json
          id: string
          notified_at: string
          patient_user_id: string
        }
        Insert: {
          alert_id: string
          availability_id: string
          channels_used?: Json
          id?: string
          notified_at?: string
          patient_user_id: string
        }
        Update: {
          alert_id?: string
          availability_id?: string
          channels_used?: Json
          id?: string
          notified_at?: string
          patient_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_notification_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "medication_availability_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_notification_history_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "medication_availability"
            referencedColumns: ["id"]
          },
        ]
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
      compliance_reports: {
        Row: {
          created_at: string
          generated_by: string
          id: string
          report_data: Json
          report_period_end: string
          report_period_start: string
          report_type: string
          summary: Json | null
        }
        Insert: {
          created_at?: string
          generated_by: string
          id?: string
          report_data?: Json
          report_period_end: string
          report_period_start: string
          report_type: string
          summary?: Json | null
        }
        Update: {
          created_at?: string
          generated_by?: string
          id?: string
          report_data?: Json
          report_period_end?: string
          report_period_start?: string
          report_type?: string
          summary?: Json | null
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
          expiry_alert_sent: boolean
          expiry_date: string | null
          form: string
          generic_name: string | null
          id: string
          is_active: boolean
          lot_number: string | null
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
          expiry_alert_sent?: boolean
          expiry_date?: string | null
          form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          lot_number?: string | null
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
          expiry_alert_sent?: boolean
          expiry_date?: string | null
          form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          lot_number?: string | null
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
      data_access_log: {
        Row: {
          access_type: string
          accessed_record_id: string | null
          accessed_table: string
          created_at: string
          data_category: string
          id: string
          ip_address: string | null
          patient_id: string | null
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          accessed_record_id?: string | null
          accessed_table: string
          created_at?: string
          data_category?: string
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_record_id?: string | null
          accessed_table?: string
          created_at?: string
          data_category?: string
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string
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
      drug_recall_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          channels_used: Json
          id: string
          notification_type: string
          notified_at: string
          patient_user_id: string | null
          pharmacy_id: string | null
          recall_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channels_used?: Json
          id?: string
          notification_type: string
          notified_at?: string
          patient_user_id?: string | null
          pharmacy_id?: string | null
          recall_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channels_used?: Json
          id?: string
          notification_type?: string
          notified_at?: string
          patient_user_id?: string | null
          pharmacy_id?: string | null
          recall_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_recall_notifications_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_recall_notifications_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "drug_recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_recalls: {
        Row: {
          affected_ndc_numbers: string[] | null
          created_at: string
          created_by: string | null
          drug_name: string
          expiry_date_range: string | null
          fda_reference: string | null
          generic_name: string | null
          id: string
          instructions: string | null
          is_active: boolean
          lot_numbers: string[] | null
          manufacturer: string | null
          recall_class: string
          recall_date: string
          recall_reason: string
          updated_at: string
        }
        Insert: {
          affected_ndc_numbers?: string[] | null
          created_at?: string
          created_by?: string | null
          drug_name: string
          expiry_date_range?: string | null
          fda_reference?: string | null
          generic_name?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          lot_numbers?: string[] | null
          manufacturer?: string | null
          recall_class?: string
          recall_date?: string
          recall_reason: string
          updated_at?: string
        }
        Update: {
          affected_ndc_numbers?: string[] | null
          created_at?: string
          created_by?: string | null
          drug_name?: string
          expiry_date_range?: string | null
          fda_reference?: string | null
          generic_name?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          lot_numbers?: string[] | null
          manufacturer?: string | null
          recall_class?: string
          recall_date?: string
          recall_reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      drug_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          destination_pharmacy_id: string
          dosage: string | null
          drug_name: string
          expiry_date: string | null
          form: string | null
          generic_name: string | null
          id: string
          lot_number: string | null
          notes: string | null
          quantity: number
          reason: string | null
          requested_at: string
          requested_by: string
          source_pharmacy_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          destination_pharmacy_id: string
          dosage?: string | null
          drug_name: string
          expiry_date?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          quantity: number
          reason?: string | null
          requested_at?: string
          requested_by: string
          source_pharmacy_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          destination_pharmacy_id?: string
          dosage?: string | null
          drug_name?: string
          expiry_date?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          quantity?: number
          reason?: string | null
          requested_at?: string
          requested_by?: string
          source_pharmacy_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_transfers_destination_pharmacy_id_fkey"
            columns: ["destination_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_transfers_source_pharmacy_id_fkey"
            columns: ["source_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      medication_availability: {
        Row: {
          created_at: string
          dosage: string | null
          form: string | null
          generic_name: string | null
          id: string
          is_available: boolean
          last_updated_by: string | null
          medication_name: string
          notes: string | null
          pharmacy_id: string
          price_naira: number | null
          quantity_available: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          is_available?: boolean
          last_updated_by?: string | null
          medication_name: string
          notes?: string | null
          pharmacy_id: string
          price_naira?: number | null
          quantity_available?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          is_available?: boolean
          last_updated_by?: string | null
          medication_name?: string
          notes?: string | null
          pharmacy_id?: string
          price_naira?: number | null
          quantity_available?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_availability_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_availability_alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          medication_name: string
          notify_email: boolean
          notify_push: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          patient_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          medication_name: string
          notify_email?: boolean
          notify_push?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          patient_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          medication_name?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          patient_user_id?: string
          updated_at?: string
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
          prescription_status: string
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
          prescription_status?: string
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
          prescription_status?: string
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
      patient_preferred_pharmacies: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          patient_user_id: string
          pharmacy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          patient_user_id: string
          pharmacy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          patient_user_id?: string
          pharmacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_preferred_pharmacies_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_risk_flags: {
        Row: {
          clinician_user_id: string
          created_at: string
          days_since_last_log: number | null
          description: string | null
          flag_type: string
          id: string
          is_resolved: boolean
          metric_value: number | null
          patient_user_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          clinician_user_id: string
          created_at?: string
          days_since_last_log?: number | null
          description?: string | null
          flag_type: string
          id?: string
          is_resolved?: boolean
          metric_value?: number | null
          patient_user_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          clinician_user_id?: string
          created_at?: string
          days_since_last_log?: number | null
          description?: string | null
          flag_type?: string
          id?: string
          is_resolved?: boolean
          metric_value?: number | null
          patient_user_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_locations: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          pharmacist_user_id: string
          phone: string | null
          state: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          pharmacist_user_id: string
          phone?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pharmacist_user_id?: string
          phone?: string | null
          state?: string
          updated_at?: string
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
      post_call_summaries: {
        Row: {
          clinician_user_id: string
          created_at: string
          follow_up_date: string | null
          id: string
          patient_user_id: string
          prescriptions_written: Json | null
          recommendations: string | null
          room_id: string
          sent_at: string | null
          sent_to_patient: boolean
          summary: string
        }
        Insert: {
          clinician_user_id: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          patient_user_id: string
          prescriptions_written?: Json | null
          recommendations?: string | null
          room_id: string
          sent_at?: string | null
          sent_to_patient?: boolean
          summary: string
        }
        Update: {
          clinician_user_id?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          patient_user_id?: string
          prescriptions_written?: Json | null
          recommendations?: string | null
          room_id?: string
          sent_at?: string | null
          sent_to_patient?: boolean
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_call_summaries_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          prescription_id: string
          previous_status: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          prescription_id: string
          previous_status?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          prescription_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_status_history_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinician_user_id: string
          created_at: string
          date_expires: string | null
          date_written: string
          dea_schedule: string | null
          diagnosis_code: string | null
          diagnosis_description: string | null
          dispense_as_written: boolean
          dispensed_at: string | null
          dosage: string
          dosage_unit: string
          form: string
          generic_name: string | null
          id: string
          instructions: string | null
          is_controlled_substance: boolean
          medication_name: string
          patient_user_id: string
          pharmacy_id: string | null
          prescription_number: string
          quantity: number
          received_at: string | null
          refills_authorized: number
          refills_remaining: number
          sent_at: string | null
          sig: string
          status: string
          updated_at: string
        }
        Insert: {
          clinician_user_id: string
          created_at?: string
          date_expires?: string | null
          date_written?: string
          dea_schedule?: string | null
          diagnosis_code?: string | null
          diagnosis_description?: string | null
          dispense_as_written?: boolean
          dispensed_at?: string | null
          dosage: string
          dosage_unit?: string
          form?: string
          generic_name?: string | null
          id?: string
          instructions?: string | null
          is_controlled_substance?: boolean
          medication_name: string
          patient_user_id: string
          pharmacy_id?: string | null
          prescription_number: string
          quantity: number
          received_at?: string | null
          refills_authorized?: number
          refills_remaining?: number
          sent_at?: string | null
          sig: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinician_user_id?: string
          created_at?: string
          date_expires?: string | null
          date_written?: string
          dea_schedule?: string | null
          diagnosis_code?: string | null
          diagnosis_description?: string | null
          dispense_as_written?: boolean
          dispensed_at?: string | null
          dosage?: string
          dosage_unit?: string
          form?: string
          generic_name?: string | null
          id?: string
          instructions?: string | null
          is_controlled_substance?: boolean
          medication_name?: string
          patient_user_id?: string
          pharmacy_id?: string | null
          prescription_number?: string
          quantity?: number
          received_at?: string | null
          refills_authorized?: number
          refills_remaining?: number
          sent_at?: string | null
          sig?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_locations"
            referencedColumns: ["id"]
          },
        ]
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
          job_title: string | null
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
          job_title?: string | null
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
          job_title?: string | null
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
          native_token: string | null
          p256dh: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          native_token?: string | null
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          native_token?: string | null
          p256dh?: string
          platform?: string | null
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
      refill_requests: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          patient_notes: string | null
          patient_user_id: string
          pharmacist_notes: string | null
          refills_granted: number | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          patient_notes?: string | null
          patient_user_id: string
          pharmacist_notes?: string | null
          refills_granted?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          patient_notes?: string | null
          patient_user_id?: string
          pharmacist_notes?: string | null
          refills_granted?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refill_requests_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string | null
          device_fingerprint: string | null
          event_category: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: string | null
          location: Json | null
          metadata: Json | null
          session_id: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_fingerprint?: string | null
          event_category?: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          location?: Json | null
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          device_fingerprint?: string | null
          event_category?: string
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: string | null
          location?: Json | null
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          notify_account_locked: boolean
          notify_account_unlocked: boolean
          notify_concurrent_session_blocked: boolean
          notify_data_export: boolean
          notify_mfa_disabled: boolean
          notify_mfa_enabled: boolean
          notify_new_device_login: boolean
          notify_password_change: boolean
          notify_password_reset: boolean
          notify_permission_change: boolean
          notify_suspicious_activity: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_account_locked?: boolean
          notify_account_unlocked?: boolean
          notify_concurrent_session_blocked?: boolean
          notify_data_export?: boolean
          notify_mfa_disabled?: boolean
          notify_mfa_enabled?: boolean
          notify_new_device_login?: boolean
          notify_password_change?: boolean
          notify_password_reset?: boolean
          notify_permission_change?: boolean
          notify_suspicious_activity?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_account_locked?: boolean
          notify_account_unlocked?: boolean
          notify_concurrent_session_blocked?: boolean
          notify_data_export?: boolean
          notify_mfa_disabled?: boolean
          notify_mfa_enabled?: boolean
          notify_new_device_login?: boolean
          notify_password_change?: boolean
          notify_password_reset?: boolean
          notify_permission_change?: boolean
          notify_suspicious_activity?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      user_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          ended_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity_at: string
          location: Json | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          location?: Json | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity_at?: string
          location?: Json | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_call_notes: {
        Row: {
          assessment: string | null
          clinician_user_id: string
          created_at: string
          id: string
          is_draft: boolean
          objective: string | null
          patient_user_id: string
          plan: string | null
          room_id: string
          subjective: string | null
          updated_at: string
        }
        Insert: {
          assessment?: string | null
          clinician_user_id: string
          created_at?: string
          id?: string
          is_draft?: boolean
          objective?: string | null
          patient_user_id: string
          plan?: string | null
          room_id: string
          subjective?: string | null
          updated_at?: string
        }
        Update: {
          assessment?: string | null
          clinician_user_id?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          objective?: string | null
          patient_user_id?: string
          plan?: string | null
          room_id?: string
          subjective?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_call_notes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      video_room_participants: {
        Row: {
          admitted_at: string | null
          admitted_by: string | null
          connection_quality: string | null
          created_at: string
          id: string
          is_in_waiting_room: boolean
          joined_at: string | null
          left_at: string | null
          participant_type: string
          room_id: string
          user_id: string
        }
        Insert: {
          admitted_at?: string | null
          admitted_by?: string | null
          connection_quality?: string | null
          created_at?: string
          id?: string
          is_in_waiting_room?: boolean
          joined_at?: string | null
          left_at?: string | null
          participant_type?: string
          room_id: string
          user_id: string
        }
        Update: {
          admitted_at?: string | null
          admitted_by?: string | null
          connection_quality?: string | null
          created_at?: string
          id?: string
          is_in_waiting_room?: boolean
          joined_at?: string | null
          left_at?: string | null
          participant_type?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      video_rooms: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          appointment_id: string | null
          clinician_user_id: string
          created_at: string
          id: string
          is_group_call: boolean
          patient_user_id: string
          recording_enabled: boolean
          recording_sid: string | null
          recording_url: string | null
          room_name: string
          room_sid: string | null
          scheduled_start: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          appointment_id?: string | null
          clinician_user_id: string
          created_at?: string
          id?: string
          is_group_call?: boolean
          patient_user_id: string
          recording_enabled?: boolean
          recording_sid?: string | null
          recording_url?: string | null
          room_name: string
          room_sid?: string | null
          scheduled_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          appointment_id?: string | null
          clinician_user_id?: string
          created_at?: string
          id?: string
          is_group_call?: boolean
          patient_user_id?: string
          recording_enabled?: boolean
          recording_sid?: string | null
          recording_url?: string | null
          room_name?: string
          room_sid?: string | null
          scheduled_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_rooms_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_room_queue: {
        Row: {
          called_at: string | null
          clinician_user_id: string
          created_at: string
          entered_at: string
          estimated_wait_minutes: number | null
          id: string
          patient_user_id: string
          priority: string
          queue_position: number
          reason_for_visit: string | null
          room_id: string | null
          status: string
        }
        Insert: {
          called_at?: string | null
          clinician_user_id: string
          created_at?: string
          entered_at?: string
          estimated_wait_minutes?: number | null
          id?: string
          patient_user_id: string
          priority?: string
          queue_position?: number
          reason_for_visit?: string | null
          room_id?: string | null
          status?: string
        }
        Update: {
          called_at?: string | null
          clinician_user_id?: string
          created_at?: string
          entered_at?: string
          estimated_wait_minutes?: number | null
          id?: string
          patient_user_id?: string
          priority?: string
          queue_position?: number
          reason_for_visit?: string | null
          room_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_room_queue_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_account_locked: { Args: { p_email: string }; Returns: Json }
      check_session_limits: { Args: { p_user_id: string }; Returns: boolean }
      generate_prescription_number: { Args: never; Returns: string }
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
      log_data_access: {
        Args: {
          p_access_type: string
          p_accessed_record_id: string
          p_accessed_table: string
          p_data_category?: string
          p_patient_id?: string
          p_reason?: string
          p_user_id: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_description?: string
          p_event_category?: string
          p_event_type: Database["public"]["Enums"]["security_event_type"]
          p_ip_address?: string
          p_metadata?: Json
          p_severity?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_ip_address?: string
          p_success: boolean
          p_user_agent?: string
        }
        Returns: Json
      }
      unlock_account: { Args: { p_email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "patient" | "clinician" | "pharmacist" | "admin"
      drug_schedule: "II" | "III" | "IV" | "V"
      security_event_type:
        | "login_success"
        | "login_failure"
        | "logout"
        | "password_change"
        | "password_reset_request"
        | "mfa_enabled"
        | "mfa_disabled"
        | "session_timeout"
        | "concurrent_session_blocked"
        | "suspicious_activity"
        | "data_export"
        | "data_access"
        | "permission_change"
        | "account_locked"
        | "account_unlocked"
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
      security_event_type: [
        "login_success",
        "login_failure",
        "logout",
        "password_change",
        "password_reset_request",
        "mfa_enabled",
        "mfa_disabled",
        "session_timeout",
        "concurrent_session_blocked",
        "suspicious_activity",
        "data_export",
        "data_access",
        "permission_change",
        "account_locked",
        "account_unlocked",
      ],
    },
  },
} as const
