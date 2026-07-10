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
      broadcasts: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      colleges: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          type: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          type?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          type?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          logo_url: string | null
          name: string
          notes: string | null
          sector: string | null
          tier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          sector?: string | null
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          sector?: string | null
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          file_url: string
          id: string
          status: string
          student_id: string
          student_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_url: string
          id?: string
          status?: string
          student_id: string
          student_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_url?: string
          id?: string
          status?: string
          student_id?: string
          student_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_requests: {
        Row: {
          course: string
          created_at: string
          email: string
          full_name: string
          id: string
          receipt_path: string | null
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          roll_number: string | null
          section: string
          status: string
          university: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          course: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          receipt_path?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roll_number?: string | null
          section: string
          status?: string
          university: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          course?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          receipt_path?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roll_number?: string | null
          section?: string
          status?: string
          university?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      learning_materials: {
        Row: {
          course: string | null
          created_at: string
          description: string | null
          file_url: string
          id: string
          module: string | null
          subject: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          course?: string | null
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          module?: string | null
          subject: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          course?: string | null
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          module?: string | null
          subject?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      network_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          reported: boolean
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          reported?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          reported?: boolean
          sender_id?: string
        }
        Relationships: []
      }
      network_teachers: {
        Row: {
          course: string
          created_at: string
          designation: string | null
          id: string
          name: string
          subject: string
          university: string
        }
        Insert: {
          course: string
          created_at?: string
          designation?: string | null
          id?: string
          name: string
          subject: string
          university: string
        }
        Update: {
          course?: string
          created_at?: string
          designation?: string | null
          id?: string
          name?: string
          subject?: string
          university?: string
        }
        Relationships: []
      }
      noc_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          event_name: string | null
          from_date: string | null
          id: string
          reason: string
          request_type: Database["public"]["Enums"]["noc_type"]
          status: Database["public"]["Enums"]["noc_status"]
          student_id: string
          student_name: string
          to_date: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          event_name?: string | null
          from_date?: string | null
          id?: string
          reason: string
          request_type?: Database["public"]["Enums"]["noc_type"]
          status?: Database["public"]["Enums"]["noc_status"]
          student_id: string
          student_name: string
          to_date?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          event_name?: string | null
          from_date?: string | null
          id?: string
          reason?: string
          request_type?: Database["public"]["Enums"]["noc_type"]
          status?: Database["public"]["Enums"]["noc_status"]
          student_id?: string
          student_name?: string
          to_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ppt_submissions: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          reviewer_notes: string | null
          risk_recovery: boolean
          slot: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          reviewer_notes?: string | null
          risk_recovery?: boolean
          slot: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          reviewer_notes?: string | null
          risk_recovery?: boolean
          slot?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          batch: string | null
          college: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          onboarded_at: string | null
          phone: string | null
          professional_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          batch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarded_at?: string | null
          phone?: string | null
          professional_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          batch?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
          phone?: string | null
          professional_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: string | null
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          subject: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: string | null
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          subject: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
          subject?: string
        }
        Relationships: []
      }
      student_profiles_detail: {
        Row: {
          avatar_url: string | null
          blood_group: string | null
          college_name: string | null
          course: string | null
          created_at: string
          father_name: string | null
          full_name: string | null
          id: string
          mother_name: string | null
          roll_number: string | null
          semester: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blood_group?: string | null
          college_name?: string | null
          course?: string | null
          created_at?: string
          father_name?: string | null
          full_name?: string | null
          id?: string
          mother_name?: string | null
          roll_number?: string | null
          semester?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blood_group?: string | null
          college_name?: string | null
          course?: string | null
          created_at?: string
          father_name?: string | null
          full_name?: string | null
          id?: string
          mother_name?: string | null
          roll_number?: string | null
          semester?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syllabi: {
        Row: {
          college: string
          created_at: string
          file_url: string
          id: string
          subject: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          college: string
          created_at?: string
          file_url: string
          id?: string
          subject: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          college?: string
          created_at?: string
          file_url?: string
          id?: string
          subject?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      todo_list: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_key: string
          completed_at: string
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_key: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_key?: string
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
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
      user_stats: {
        Row: {
          id: string
          score: number
          subject: string | null
          taken_at: string
          total: number
          user_id: string
        }
        Insert: {
          id?: string
          score?: number
          subject?: string | null
          taken_at?: string
          total?: number
          user_id: string
        }
        Update: {
          id?: string
          score?: number
          subject?: string | null
          taken_at?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_vset_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "student" | "admin" | "teacher"
      noc_status: "pending" | "approved" | "rejected"
      noc_type: "leave" | "event" | "internship" | "other"
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
      app_role: ["student", "admin", "teacher"],
      noc_status: ["pending", "approved", "rejected"],
      noc_type: ["leave", "event", "internship", "other"],
    },
  },
} as const
