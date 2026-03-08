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
      challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          channel: string
          created_at: string
          id: string
          image_url: string | null
          recipe_id: string | null
          text: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id?: string | null
          text: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          image_url?: string | null
          recipe_id?: string | null
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_meals: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_list_items: {
        Row: {
          created_at: string
          grocery_list_id: string
          id: string
          ingredient: string
          is_checked: boolean | null
          quantity: string | null
        }
        Insert: {
          created_at?: string
          grocery_list_id: string
          id?: string
          ingredient: string
          is_checked?: boolean | null
          quantity?: string | null
        }
        Update: {
          created_at?: string
          grocery_list_id?: string
          id?: string
          ingredient?: string
          is_checked?: boolean | null
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_grocery_list_id_fkey"
            columns: ["grocery_list_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean | null
          created_at: string
          date: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          date?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "user_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_daily_notes: {
        Row: {
          created_at: string
          date: string
          energy_level: number | null
          id: string
          mood_emoji: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          energy_level?: number | null
          id?: string
          mood_emoji?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          energy_level?: number | null
          id?: string
          mood_emoji?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          calories: number | null
          carbs_g: number | null
          date: string
          fat_g: number | null
          food_name: string
          id: string
          image_url: string | null
          logged_at: string
          meal_type: string
          protein_g: number | null
          recipe_id: string | null
          servings: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          date?: string
          fat_g?: number | null
          food_name: string
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_type: string
          protein_g?: number | null
          recipe_id?: string | null
          servings?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          date?: string
          fat_g?: number | null
          food_name?: string
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_type?: string
          protein_g?: number | null
          recipe_id?: string | null
          servings?: number | null
          user_id?: string
        }
        Relationships: []
      }
      macro_calculations: {
        Row: {
          activity_level: string | null
          age: number | null
          bmr: number | null
          calories: number | null
          carbs: number | null
          created_at: string
          fats: number | null
          gender: string | null
          goal: string | null
          height: number | null
          id: string
          protein: number | null
          tdee: number | null
          user_id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          bmr?: number | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fats?: number | null
          gender?: string | null
          goal?: string | null
          height?: number | null
          id?: string
          protein?: number | null
          tdee?: number | null
          user_id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          bmr?: number | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fats?: number | null
          gender?: string | null
          goal?: string | null
          height?: number | null
          id?: string
          protein?: number | null
          tdee?: number | null
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      meal_plan_entries: {
        Row: {
          created_at: string
          day_of_week: string
          id: string
          meal_id: string
          meal_plan_id: string
          meal_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          id?: string
          meal_id: string
          meal_plan_id: string
          meal_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          id?: string
          meal_id?: string
          meal_plan_id?: string
          meal_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_ratings: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ratings_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number | null
          carbs: number | null
          category: string | null
          coach_notes: string | null
          cook_time: number | null
          created_at: string
          cuisine: string | null
          description: string | null
          diet_tags: string[] | null
          fats: number | null
          health_tags: string[] | null
          id: string
          image_filename: string | null
          image_url: string | null
          ingredients: Json | null
          instructions: Json | null
          is_public: boolean | null
          prep_time: number | null
          protein: number | null
          servings: number | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          category?: string | null
          coach_notes?: string | null
          cook_time?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          diet_tags?: string[] | null
          fats?: number | null
          health_tags?: string[] | null
          id?: string
          image_filename?: string | null
          image_url?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          is_public?: boolean | null
          prep_time?: number | null
          protein?: number | null
          servings?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          category?: string | null
          coach_notes?: string | null
          cook_time?: number | null
          created_at?: string
          cuisine?: string | null
          description?: string | null
          diet_tags?: string[] | null
          fats?: number | null
          health_tags?: string[] | null
          id?: string
          image_filename?: string | null
          image_url?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          is_public?: boolean | null
          prep_time?: number | null
          protein?: number | null
          servings?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_clicks: {
        Row: {
          action: string
          clicked_at: string
          id: string
          partner_id: string
          user_id: string
        }
        Insert: {
          action: string
          clicked_at?: string
          id?: string
          partner_id: string
          user_id: string
        }
        Update: {
          action?: string
          clicked_at?: string
          id?: string
          partner_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_clicks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          added_at: string
          category: string
          description: string | null
          discount_label: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_members_only: boolean | null
          logo_url: string | null
          name: string
          promo_code: string | null
          website_url: string | null
        }
        Insert: {
          added_at?: string
          category: string
          description?: string | null
          discount_label?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_members_only?: boolean | null
          logo_url?: string | null
          name: string
          promo_code?: string | null
          website_url?: string | null
        }
        Update: {
          added_at?: string
          category?: string
          description?: string | null
          discount_label?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_members_only?: boolean | null
          logo_url?: string | null
          name?: string
          promo_code?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          allergies: string[] | null
          avatar_url: string | null
          created_at: string
          diet_prefs: string[] | null
          goal: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          id: string
          name: string | null
          onboarding_completed: boolean | null
          preferred_units: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          created_at?: string
          diet_prefs?: string[] | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean | null
          preferred_units?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          created_at?: string
          diet_prefs?: string[] | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          name?: string | null
          onboarding_completed?: boolean | null
          preferred_units?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          arms_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string
          date: string
          hips_cm: number | null
          id: string
          notes: string | null
          photo_url: string | null
          thighs_cm: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          hips_cm?: number | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          thighs_cm?: number | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          hips_cm?: number | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          thighs_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          angle: string
          created_at: string
          id: string
          photo_url: string
          progress_log_id: string
          user_id: string
        }
        Insert: {
          angle: string
          created_at?: string
          id?: string
          photo_url: string
          progress_log_id: string
          user_id: string
        }
        Update: {
          angle?: string
          created_at?: string
          id?: string
          photo_url?: string
          progress_log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          id: string
          post_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          post_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          post_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          items: Json | null
          updated_at: string
          user_id: string
          week_start_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json | null
          updated_at?: string
          user_id: string
          week_start_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json | null
          updated_at?: string
          user_id?: string
          week_start_date?: string | null
        }
        Relationships: []
      }
      streak_reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_reminder_sent: string | null
          reminder_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_reminder_sent?: string | null
          reminder_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_reminder_sent?: string | null
          reminder_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          id: string
          recipe_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          recipe_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          recipe_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_habits: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_macros: {
        Row: {
          calculation_method: string | null
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          id: string
          is_custom: boolean | null
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_method?: string | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          is_custom?: boolean | null
          protein_g?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calculation_method?: string | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          is_custom?: boolean | null
          protein_g?: number
          updated_at?: string
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
      water_logs: {
        Row: {
          best_streak: number
          created_at: string
          date: string
          glasses: number
          goal: number
          id: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          created_at?: string
          date?: string
          glasses?: number
          goal?: number
          id?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          created_at?: string
          date?: string
          glasses?: number
          goal?: number
          id?: string
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
    }
    Enums: {
      app_role: "user" | "coach" | "admin"
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
      app_role: ["user", "coach", "admin"],
    },
  },
} as const
