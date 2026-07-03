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
      admin_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          meta: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          meta: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          meta?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          meta?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_recipients: {
        Row: {
          antragsform: string | null
          bcc: string | null
          cc: string | null
          created_at: string
          id: string
          krankenkasse: string
          recipient_email: string
          updated_at: string
        }
        Insert: {
          antragsform?: string | null
          bcc?: string | null
          cc?: string | null
          created_at?: string
          id?: string
          krankenkasse: string
          recipient_email: string
          updated_at?: string
        }
        Update: {
          antragsform?: string | null
          bcc?: string | null
          cc?: string | null
          created_at?: string
          id?: string
          krankenkasse?: string
          recipient_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          antragsform: string | null
          applicant_name: string | null
          applicant_vorname: string | null
          created_at: string
          exported_at: string | null
          id: string
          intake_meta: Json
          krankenkasse: string
          last_opened_at: string | null
          parent_application_id: string | null
          payload_encrypted: string
          payload_hash: string
          payload_iv: string
          pdf_count: number
          person_index: number | null
          person_role: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          vertriebspartner: string | null
        }
        Insert: {
          antragsform?: string | null
          applicant_name?: string | null
          applicant_vorname?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          intake_meta?: Json
          krankenkasse: string
          last_opened_at?: string | null
          parent_application_id?: string | null
          payload_encrypted: string
          payload_hash: string
          payload_iv: string
          pdf_count?: number
          person_index?: number | null
          person_role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          vertriebspartner?: string | null
        }
        Update: {
          antragsform?: string | null
          applicant_name?: string | null
          applicant_vorname?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          intake_meta?: Json
          krankenkasse?: string
          last_opened_at?: string | null
          parent_application_id?: string | null
          payload_encrypted?: string
          payload_hash?: string
          payload_iv?: string
          pdf_count?: number
          person_index?: number | null
          person_role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          vertriebspartner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_template: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_inbox_messages: {
        Row: {
          block_id: string | null
          chat_id: string
          created_at: string
          id: string
          media_mime: string | null
          media_url: string | null
          processed_at: string | null
          received_at: string
          text: string | null
          type: string
          wa_message_id: string
        }
        Insert: {
          block_id?: string | null
          chat_id: string
          created_at?: string
          id?: string
          media_mime?: string | null
          media_url?: string | null
          processed_at?: string | null
          received_at?: string
          text?: string | null
          type: string
          wa_message_id: string
        }
        Update: {
          block_id?: string | null
          chat_id?: string
          created_at?: string
          id?: string
          media_mime?: string | null
          media_url?: string | null
          processed_at?: string | null
          received_at?: string
          text?: string | null
          type?: string
          wa_message_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
