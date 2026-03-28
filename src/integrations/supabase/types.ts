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
      budget_line_items: {
        Row: {
          batch_label: string
          cost_code: string
          cost_group: string
          cost_item_name: string
          cost_type: string
          created_at: string
          description: string
          extended_cost: number
          id: string
          line_item_no: number
          project_id: string
          quantity: number
          unit: string
        }
        Insert: {
          batch_label?: string
          cost_code?: string
          cost_group?: string
          cost_item_name?: string
          cost_type?: string
          created_at?: string
          description?: string
          extended_cost?: number
          id?: string
          line_item_no?: number
          project_id: string
          quantity?: number
          unit?: string
        }
        Update: {
          batch_label?: string
          cost_code?: string
          cost_group?: string
          cost_item_name?: string
          cost_type?: string
          created_at?: string
          description?: string
          extended_cost?: number
          id?: string
          line_item_no?: number
          project_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      invoice_line_items: {
        Row: {
          budget_line_item_id: string
          contract_price: number
          created_at: string
          description: string
          draw_amount: number
          id: string
          invoice_id: string
          line_item_no: number
          percent_complete: number
        }
        Insert: {
          budget_line_item_id: string
          contract_price?: number
          created_at?: string
          description?: string
          draw_amount?: number
          id?: string
          invoice_id: string
          line_item_no?: number
          percent_complete?: number
        }
        Update: {
          budget_line_item_id?: string
          contract_price?: number
          created_at?: string
          description?: string
          draw_amount?: number
          id?: string
          invoice_id?: string
          line_item_no?: number
          percent_complete?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          change_order_total: number
          created_at: string
          credit_total: number
          day_labor_total: number
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string
          period_end: string | null
          period_start: string | null
          project_id: string
          reimbursement_total: number
          rejection_notes: string | null
          sow_total: number
          status: string
          subcontractor_name: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          change_order_total?: number
          created_at?: string
          credit_total?: number
          day_labor_total?: number
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string
          period_end?: string | null
          period_start?: string | null
          project_id: string
          reimbursement_total?: number
          rejection_notes?: string | null
          sow_total?: number
          status?: string
          subcontractor_name?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          change_order_total?: number
          created_at?: string
          credit_total?: number
          day_labor_total?: number
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string
          period_end?: string | null
          period_start?: string | null
          project_id?: string
          reimbursement_total?: number
          rejection_notes?: string | null
          sow_total?: number
          status?: string
          subcontractor_name?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pm_draw_payments: {
        Row: {
          amount: number
          created_at: string
          draw_sheet_id: string
          id: string
          notes: string
          payment_date: string
        }
        Insert: {
          amount?: number
          created_at?: string
          draw_sheet_id: string
          id?: string
          notes?: string
          payment_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          draw_sheet_id?: string
          id?: string
          notes?: string
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_draw_payments_draw_sheet_id_fkey"
            columns: ["draw_sheet_id"]
            isOneToOne: false
            referencedRelation: "pm_draw_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_draw_sheets: {
        Row: {
          created_at: string
          exterior_billed: number
          id: string
          interior_buildout_billed: number
          interior_construction_billed: number
          last_updated: string
          notes: string
          pm_user_id: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exterior_billed?: number
          id?: string
          interior_buildout_billed?: number
          interior_construction_billed?: number
          last_updated?: string
          notes?: string
          pm_user_id: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exterior_billed?: number
          id?: string
          interior_buildout_billed?: number
          interior_construction_billed?: number
          last_updated?: string
          notes?: string
          pm_user_id?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_draw_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_sub_pay_entries: {
        Row: {
          amount: number
          created_at: string
          description: string
          draw_sheet_id: string
          id: string
          sub_name: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          draw_sheet_id: string
          id?: string
          sub_name?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          draw_sheet_id?: string
          id?: string
          sub_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_sub_pay_entries_draw_sheet_id_fkey"
            columns: ["draw_sheet_id"]
            isOneToOne: false
            referencedRelation: "pm_draw_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
          team_member_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          role?: string
          team_member_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          created_at: string
          id: string
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          invited_at: string | null
          project_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          invited_at?: string | null
          project_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          invited_at?: string | null
          project_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          notes: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          notes?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          notes?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string
          amount_invoiced: number
          amount_paid: number
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          total_budget: number
          updated_at: string
        }
        Insert: {
          address: string
          amount_invoiced?: number
          amount_paid?: number
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number
          updated_at?: string
        }
        Update: {
          address?: string
          amount_invoiced?: number
          amount_paid?: number
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      sub_budget_line_items: {
        Row: {
          batch_label: string
          cost_code: string
          cost_group: string
          cost_item_name: string
          cost_type: string
          created_at: string
          description: string
          extended_cost: number
          id: string
          line_item_no: number
          quantity: number
          sub_budget_id: string
          unit: string
        }
        Insert: {
          batch_label?: string
          cost_code?: string
          cost_group?: string
          cost_item_name?: string
          cost_type?: string
          created_at?: string
          description?: string
          extended_cost?: number
          id?: string
          line_item_no?: number
          quantity?: number
          sub_budget_id: string
          unit?: string
        }
        Update: {
          batch_label?: string
          cost_code?: string
          cost_group?: string
          cost_item_name?: string
          cost_type?: string
          created_at?: string
          description?: string
          extended_cost?: number
          id?: string
          line_item_no?: number
          quantity?: number
          sub_budget_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_budget_line_items_sub_budget_id_fkey"
            columns: ["sub_budget_id"]
            isOneToOne: false
            referencedRelation: "sub_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_budgets: {
        Row: {
          created_at: string
          file_name: string
          id: string
          project_id: string
          team_member_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string
          id?: string
          project_id: string
          team_member_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          project_id?: string
          team_member_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_budgets_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_directory: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          location: string
          notes: string
          phone: string
          specialties: string[]
          subcontractor_type: string
          website: string
        }
        Insert: {
          company_name: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          location?: string
          notes?: string
          phone?: string
          specialties?: string[]
          subcontractor_type?: string
          website?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          location?: string
          notes?: string
          phone?: string
          specialties?: string[]
          subcontractor_type?: string
          website?: string
        }
        Relationships: []
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
      team_members: {
        Row: {
          created_at: string
          crew_name: string | null
          email: string
          id: string
          name: string
          phone: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          created_at?: string
          crew_name?: string | null
          email: string
          id?: string
          name: string
          phone?: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          created_at?: string
          crew_name?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_user_roles: { Args: { _user_id: string }; Returns: string[] }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_assigned_to_project: {
        Args: { _project_id: string; _user_id: string }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      invitation_status: "invited" | "pending" | "active"
      project_status: "active" | "on-hold" | "completed" | "archived"
      team_role: "admin" | "project-manager" | "subcontractor"
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
      invitation_status: ["invited", "pending", "active"],
      project_status: ["active", "on-hold", "completed", "archived"],
      team_role: ["admin", "project-manager", "subcontractor"],
    },
  },
} as const
