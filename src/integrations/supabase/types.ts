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
      admin_credit_actions: {
        Row: {
          action: string
          admin_id: string
          affected_count: number
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          id: string
          metadata: Json
          reason: string
          scope: string
          user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          affected_count?: number
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          scope?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          affected_count?: number
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          scope?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      coupons: {
        Row: {
          amount_off_cents: number | null
          applies_to: string
          bonus_credits: number
          code: string
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          percent_off: number | null
          redemptions: number
          updated_at: string
        }
        Insert: {
          amount_off_cents?: number | null
          applies_to?: string
          bonus_credits?: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          updated_at?: string
        }
        Update: {
          amount_off_cents?: number | null
          applies_to?: string
          bonus_credits?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          updated_at?: string
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
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          credits: number
          is_active?: boolean
          label: string
          operation: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          credits?: number
          is_active?: boolean
          label?: string
          operation?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packs: {
        Row: {
          bonus_label: string | null
          created_at: string
          credits: number
          currency: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_label?: string | null
          created_at?: string
          credits: number
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_label?: string | null
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_cents: number
          completed_at: string | null
          coupon_code: string | null
          created_at: string
          credits: number
          currency: string
          discount_cents: number
          id: string
          metadata: Json
          pack_id: string | null
          provider: string
          provider_payment_id: string | null
          provider_reference: string | null
          provider_session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          credits: number
          currency?: string
          discount_cents?: number
          id?: string
          metadata?: Json
          pack_id?: string | null
          provider: string
          provider_payment_id?: string | null
          provider_reference?: string | null
          provider_session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          credits?: number
          currency?: string
          discount_cents?: number
          id?: string
          metadata?: Json
          pack_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_reference?: string | null
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
          lifetime_refunded: number
          lifetime_used: number
          reserved: number
          subscription_credits: number
          topup_credits: number
          unlimited_credits: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_credits?: number
          credits_expiring?: number
          expires_at?: string | null
          lifetime_purchased?: number
          lifetime_refunded?: number
          lifetime_used?: number
          reserved?: number
          subscription_credits?: number
          topup_credits?: number
          unlimited_credits?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_credits?: number
          credits_expiring?: number
          expires_at?: string | null
          lifetime_purchased?: number
          lifetime_refunded?: number
          lifetime_used?: number
          reserved?: number
          subscription_credits?: number
          topup_credits?: number
          unlimited_credits?: boolean
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
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          kind: string
          metadata: Json
          pdf_url: string | null
          provider: string
          provider_invoice_id: string | null
          provider_reference: string | null
          purchase_id: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind: string
          metadata?: Json
          pdf_url?: string | null
          provider: string
          provider_invoice_id?: string | null
          provider_reference?: string | null
          purchase_id?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          metadata?: Json
          pdf_url?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_reference?: string | null
          purchase_id?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          project_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          project_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
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
          onboarding: Json
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding?: Json
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding?: Json
          referral_code?: string | null
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
          orchestrator_state: Json | null
          preferred_ai_provider: string | null
          render_control: string | null
          render_duration: number | null
          render_error: string | null
          render_heartbeat: string | null
          render_progress: number | null
          render_started_at: string | null
          render_status: string | null
          seo: string | null
          settings: Json
          songs: string | null
          story: string | null
          story_bible: Json | null
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
          orchestrator_state?: Json | null
          preferred_ai_provider?: string | null
          render_control?: string | null
          render_duration?: number | null
          render_error?: string | null
          render_heartbeat?: string | null
          render_progress?: number | null
          render_started_at?: string | null
          render_status?: string | null
          seo?: string | null
          settings?: Json
          songs?: string | null
          story?: string | null
          story_bible?: Json | null
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
          orchestrator_state?: Json | null
          preferred_ai_provider?: string | null
          render_control?: string | null
          render_duration?: number | null
          render_error?: string | null
          render_heartbeat?: string | null
          render_progress?: number | null
          render_started_at?: string | null
          render_status?: string | null
          seo?: string | null
          settings?: Json
          songs?: string | null
          story?: string | null
          story_bible?: Json | null
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
      referrals: {
        Row: {
          code: string
          created_at: string
          credited_at: string | null
          id: string
          referred_credits_awarded: number
          referred_id: string
          referrer_credits_awarded: number
          referrer_id: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_credits_awarded?: number
          referred_id: string
          referrer_credits_awarded?: number
          referrer_id: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_credits_awarded?: number
          referred_id?: string
          referrer_credits_awarded?: number
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          credits_reversed: number
          currency: string
          id: string
          provider: string
          provider_refund_id: string | null
          purchase_id: string | null
          reason: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          credits_reversed?: number
          currency?: string
          id?: string
          provider: string
          provider_refund_id?: string | null
          purchase_id?: string | null
          reason?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          credits_reversed?: number
          currency?: string
          id?: string
          provider?: string
          provider_refund_id?: string | null
          purchase_id?: string | null
          reason?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      render_clip_jobs: {
        Row: {
          attempts: number
          billing_ref: string | null
          clip_number: number
          cover_url: string | null
          created_at: string
          credits_charged: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          last_heartbeat_at: string | null
          latency_ms: number | null
          locked_until: string | null
          max_attempts: number
          metadata: Json
          model: string | null
          output_url: string | null
          project_id: string
          provider: string | null
          scene_number: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          billing_ref?: string | null
          clip_number: number
          cover_url?: string | null
          created_at?: string
          credits_charged?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          last_heartbeat_at?: string | null
          latency_ms?: number | null
          locked_until?: string | null
          max_attempts?: number
          metadata?: Json
          model?: string | null
          output_url?: string | null
          project_id: string
          provider?: string | null
          scene_number: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          billing_ref?: string | null
          clip_number?: number
          cover_url?: string | null
          created_at?: string
          credits_charged?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          last_heartbeat_at?: string | null
          latency_ms?: number | null
          locked_until?: string | null
          max_attempts?: number
          metadata?: Json
          model?: string | null
          output_url?: string | null
          project_id?: string
          provider?: string | null
          scene_number?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_clip_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "render_clip_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      render_jobs: {
        Row: {
          attempts: number
          composition_error: string | null
          composition_started_at: string | null
          composition_state: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          last_heartbeat_at: string | null
          last_notified_progress: number
          locked_until: string | null
          metadata: Json
          mode: string
          movie_ready_at: string | null
          movie_url: string | null
          notifications_sent: Json
          priority: number
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          composition_error?: string | null
          composition_started_at?: string | null
          composition_state?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_notified_progress?: number
          locked_until?: string | null
          metadata?: Json
          mode?: string
          movie_ready_at?: string | null
          movie_url?: string | null
          notifications_sent?: Json
          priority?: number
          project_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          composition_error?: string | null
          composition_started_at?: string | null
          composition_state?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_notified_progress?: number
          locked_until?: string | null
          metadata?: Json
          mode?: string
          movie_ready_at?: string | null
          movie_url?: string | null
          notifications_sent?: Json
          priority?: number
          project_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          concurrent_jobs: number
          created_at: string
          currency: string
          features: Json
          flutterwave_plan_id_monthly: string | null
          flutterwave_plan_id_yearly: string | null
          id: string
          is_active: boolean
          max_projects: number
          monthly_credits: number
          movie_length_seconds: number
          name: string
          paystack_plan_code_monthly: string | null
          paystack_plan_code_yearly: string | null
          price_cents: number
          price_yearly_cents: number
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
          flutterwave_plan_id_monthly?: string | null
          flutterwave_plan_id_yearly?: string | null
          id: string
          is_active?: boolean
          max_projects?: number
          monthly_credits?: number
          movie_length_seconds?: number
          name: string
          paystack_plan_code_monthly?: string | null
          paystack_plan_code_yearly?: string | null
          price_cents?: number
          price_yearly_cents?: number
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
          flutterwave_plan_id_monthly?: string | null
          flutterwave_plan_id_yearly?: string | null
          id?: string
          is_active?: boolean
          max_projects?: number
          monthly_credits?: number
          movie_length_seconds?: number
          name?: string
          paystack_plan_code_monthly?: string | null
          paystack_plan_code_yearly?: string | null
          price_cents?: number
          price_yearly_cents?: number
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
          billing_cycle: string
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
          billing_cycle?: string
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
          billing_cycle?: string
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
      admin_apply_credit_action: {
        Args: {
          _action: string
          _admin: string
          _amount: number
          _metadata?: Json
          _reason: string
          _scope?: string
          _user: string
        }
        Returns: Json
      }
      claim_next_clips: {
        Args: {
          _job_id: string
          _lease_seconds?: number
          _limit?: number
          _worker_id: string
        }
        Returns: {
          attempts: number
          billing_ref: string | null
          clip_number: number
          cover_url: string | null
          created_at: string
          credits_charged: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          last_heartbeat_at: string | null
          latency_ms: number | null
          locked_until: string | null
          max_attempts: number
          metadata: Json
          model: string | null
          output_url: string | null
          project_id: string
          provider: string | null
          scene_number: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "render_clip_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_render_job: {
        Args: { _lease_seconds?: number; _worker_id: string }
        Returns: {
          attempts: number
          composition_error: string | null
          composition_started_at: string | null
          composition_state: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          last_heartbeat_at: string | null
          last_notified_progress: number
          locked_until: string | null
          metadata: Json
          mode: string
          movie_ready_at: string | null
          movie_url: string | null
          notifications_sent: Json
          priority: number
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "render_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      has_charged_ref: { Args: { _ref: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_user: {
        Args: {
          _body?: string
          _dedupe_key?: string
          _kind: string
          _project_id?: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      reclaim_stalled_clip_jobs: { Args: never; Returns: number }
      reclaim_stalled_render_jobs: { Args: never; Returns: number }
      release_clip_job: {
        Args: {
          _clip_id: string
          _cover_url?: string
          _credits_charged?: number
          _error?: string
          _latency_ms?: number
          _model?: string
          _output_url?: string
          _provider?: string
          _status: string
          _worker_id: string
        }
        Returns: undefined
      }
      release_render_job: {
        Args: {
          _error?: string
          _job_id: string
          _status: string
          _worker_id: string
        }
        Returns: undefined
      }
      reset_failed_clips_for_repair: {
        Args: { _job_id: string }
        Returns: number
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
