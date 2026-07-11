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
      asset_versions: {
        Row: {
          asset_id: string
          content: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          payload: Json | null
          provider: string | null
          updated_at: string
          user_id: string
          version_number: number
        }
        Insert: {
          asset_id: string
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          payload?: Json | null
          provider?: string | null
          updated_at?: string
          user_id: string
          version_number?: number
        }
        Update: {
          asset_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          payload?: Json | null
          provider?: string | null
          updated_at?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          project_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          project_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_costs: {
        Row: {
          category: string
          credits: number
          is_active: boolean
          label: string
          operation: string
          updated_at: string
        }
        Insert: {
          category?: string
          credits: number
          is_active?: boolean
          label: string
          operation: string
          updated_at?: string
        }
        Update: {
          category?: string
          credits?: number
          is_active?: boolean
          label?: string
          operation?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string
          credits: number
          currency: string
          id: string
          provider: string
          provider_payment_id: string | null
          provider_session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string
          credits: number
          currency?: string
          id?: string
          provider: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          balance_after: number
          balance_before: number
          created_at: string
          credits: number
          id: string
          metadata: Json
          model: string | null
          operation: string
          project_id: string | null
          provider: string | null
          reason: string | null
          ref_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          balance_after: number
          balance_before: number
          created_at?: string
          credits: number
          id?: string
          metadata?: Json
          model?: string | null
          operation: string
          project_id?: string | null
          provider?: string | null
          reason?: string | null
          ref_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          balance_after?: number
          balance_before?: number
          created_at?: string
          credits?: number
          id?: string
          metadata?: Json
          model?: string | null
          operation?: string
          project_id?: string | null
          provider?: string | null
          reason?: string | null
          ref_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_wallet: {
        Row: {
          balance: number
          bonus_credits: number
          credits_expiring: number
          expires_at: string | null
          lifetime_purchased: number
          lifetime_used: number
          reserved: number
          subscription_credits: number
          topup_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_credits?: number
          credits_expiring?: number
          expires_at?: string | null
          lifetime_purchased?: number
          lifetime_used?: number
          reserved?: number
          subscription_credits?: number
          topup_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_credits?: number
          credits_expiring?: number
          expires_at?: string | null
          lifetime_purchased?: number
          lifetime_used?: number
          reserved?: number
          subscription_credits?: number
          topup_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          metadata: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_key: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_history: {
        Row: {
          asset_id: string | null
          asset_type: string
          created_at: string
          credits_used: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          project_id: string | null
          provider: string | null
          status: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          asset_type: string
          created_at?: string
          credits_used?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          provider?: string | null
          status?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          asset_type?: string
          created_at?: string
          credits_used?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          provider?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_queue: {
        Row: {
          asset_type: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          estimated_seconds: number | null
          id: string
          payload: Json | null
          progress: number
          project_id: string | null
          provider: string | null
          retry_count: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          estimated_seconds?: number | null
          id?: string
          payload?: Json | null
          progress?: number
          project_id?: string | null
          provider?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          estimated_seconds?: number | null
          id?: string
          payload?: Json | null
          progress?: number
          project_id?: string | null
          provider?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          active_version_id: string | null
          asset_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          project_id: string
          provider: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_version_id?: string | null
          asset_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          provider?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_version_id?: string | null
          asset_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          provider?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          age_group: string | null
          animation_style: string | null
          archived_at: string | null
          audio: string | null
          background_music: Json | null
          category: string | null
          characters: string | null
          color_label: string | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          duration: number | null
          folder_id: string | null
          generated_images: Json | null
          id: string
          image_assets: string | null
          images: string | null
          is_archived: boolean
          is_favorite: boolean
          is_pinned: boolean
          language: string | null
          last_opened_at: string | null
          media_pipeline: Json | null
          music: string | null
          name: string
          objective: string | null
          preferred_ai_provider: string | null
          render_duration: number | null
          render_progress: number | null
          render_status: string | null
          seo: string | null
          settings: Json
          songs: string | null
          story: string | null
          storyboard: string | null
          style: string | null
          subtitle_file: Json | null
          tags: string[]
          target_age: string | null
          target_platform: string | null
          theme: string | null
          thumbnail: Json | null
          thumbnail_url: string | null
          topic: string | null
          updated_at: string
          user_id: string
          video: string | null
          video_file: Json | null
          video_provider: string | null
          voice: string | null
          voice_audio: Json | null
          voice_preference: string | null
        }
        Insert: {
          age_group?: string | null
          animation_style?: string | null
          archived_at?: string | null
          audio?: string | null
          background_music?: Json | null
          category?: string | null
          characters?: string | null
          color_label?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          duration?: number | null
          folder_id?: string | null
          generated_images?: Json | null
          id?: string
          image_assets?: string | null
          images?: string | null
          is_archived?: boolean
          is_favorite?: boolean
          is_pinned?: boolean
          language?: string | null
          last_opened_at?: string | null
          media_pipeline?: Json | null
          music?: string | null
          name: string
          objective?: string | null
          preferred_ai_provider?: string | null
          render_duration?: number | null
          render_progress?: number | null
          render_status?: string | null
          seo?: string | null
          settings?: Json
          songs?: string | null
          story?: string | null
          storyboard?: string | null
          style?: string | null
          subtitle_file?: Json | null
          tags?: string[]
          target_age?: string | null
          target_platform?: string | null
          theme?: string | null
          thumbnail?: Json | null
          thumbnail_url?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
          video?: string | null
          video_file?: Json | null
          video_provider?: string | null
          voice?: string | null
          voice_audio?: Json | null
          voice_preference?: string | null
        }
        Update: {
          age_group?: string | null
          animation_style?: string | null
          archived_at?: string | null
          audio?: string | null
          background_music?: Json | null
          category?: string | null
          characters?: string | null
          color_label?: string | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          duration?: number | null
          folder_id?: string | null
          generated_images?: Json | null
          id?: string
          image_assets?: string | null
          images?: string | null
          is_archived?: boolean
          is_favorite?: boolean
          is_pinned?: boolean
          language?: string | null
          last_opened_at?: string | null
          media_pipeline?: Json | null
          music?: string | null
          name?: string
          objective?: string | null
          preferred_ai_provider?: string | null
          render_duration?: number | null
          render_progress?: number | null
          render_status?: string | null
          seo?: string | null
          settings?: Json
          songs?: string | null
          story?: string | null
          storyboard?: string | null
          style?: string | null
          subtitle_file?: Json | null
          tags?: string[]
          target_age?: string | null
          target_platform?: string | null
          theme?: string | null
          thumbnail?: Json | null
          thumbnail_url?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
          video?: string | null
          video_file?: Json | null
          video_provider?: string | null
          voice?: string | null
          voice_audio?: Json | null
          voice_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_connections: {
        Row: {
          account_id: string | null
          account_name: string | null
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          expires_at: string | null
          id: string
          meta: Json
          platform: string
          scopes: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          meta?: Json
          platform: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          meta?: Json
          platform?: string
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publish_history: {
        Row: {
          created_at: string
          description: string | null
          error_message: string | null
          external_post_id: string | null
          hashtags: string[] | null
          id: string
          meta: Json
          platform: string
          project_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_post_id?: string | null
          hashtags?: string[] | null
          id?: string
          meta?: Json
          platform: string
          project_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_post_id?: string | null
          hashtags?: string[] | null
          id?: string
          meta?: Json
          platform?: string
          project_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          concurrent_jobs: number
          created_at: string
          currency: string
          features: Json
          id: string
          is_active: boolean
          monthly_credits: number
          movie_length_seconds: number
          name: string
          price_cents: number
          publish_limit: number
          sort_order: number
          storage_limit_mb: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          concurrent_jobs?: number
          created_at?: string
          currency?: string
          features?: Json
          id: string
          is_active?: boolean
          monthly_credits?: number
          movie_length_seconds?: number
          name: string
          price_cents?: number
          publish_limit?: number
          sort_order?: number
          storage_limit_mb?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          concurrent_jobs?: number
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          monthly_credits?: number
          movie_length_seconds?: number
          name?: string
          price_cents?: number
          publish_limit?: number
          sort_order?: number
          storage_limit_mb?: number
          stripe_price_id?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_commit: {
        Args: {
          _credits: number
          _model?: string
          _operation: string
          _project?: string
          _provider?: string
          _ref?: string
          _user: string
        }
        Returns: Json
      }
      credit_grant: {
        Args: {
          _credits: number
          _kind?: string
          _reason: string
          _ref?: string
          _user: string
        }
        Returns: Json
      }
      credit_refund: {
        Args: {
          _credits: number
          _operation: string
          _project?: string
          _reason?: string
          _ref?: string
          _user: string
        }
        Returns: Json
      }
      credit_reserve: {
        Args: {
          _credits: number
          _operation: string
          _project?: string
          _ref?: string
          _user: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
