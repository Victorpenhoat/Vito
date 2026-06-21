export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      avis: {
        Row: {
          commentaire: string | null
          created_at: string
          etablissement_id: string
          id: string
          note: number | null
          user_id: string
          visite_le: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          etablissement_id: string
          id?: string
          note?: number | null
          user_id: string
          visite_le?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          etablissement_id?: string
          id?: string
          note?: number | null
          user_id?: string
          visite_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avis_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      degustations: {
        Row: {
          avis_id: string | null
          commentaire: string | null
          created_at: string
          deguste_le: string
          etablissement_id: string | null
          id: string
          note: number | null
          prix_paye: number | null
          user_id: string
          vin_id: string
        }
        Insert: {
          avis_id?: string | null
          commentaire?: string | null
          created_at?: string
          deguste_le?: string
          etablissement_id?: string | null
          id?: string
          note?: number | null
          prix_paye?: number | null
          user_id: string
          vin_id: string
        }
        Update: {
          avis_id?: string | null
          commentaire?: string | null
          created_at?: string
          deguste_le?: string
          etablissement_id?: string | null
          id?: string
          note?: number | null
          prix_paye?: number | null
          user_id?: string
          vin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "degustations_avis_id_fkey"
            columns: ["avis_id"]
            isOneToOne: false
            referencedRelation: "avis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degustations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degustations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degustations_vin_id_fkey"
            columns: ["vin_id"]
            isOneToOne: false
            referencedRelation: "vins"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissements: {
        Row: {
          adresse: string | null
          arrondissement: string | null
          categorie: Database["public"]["Enums"]["etablissement_categorie"]
          code_postal: string | null
          created_at: string
          enriched_at: string | null
          id: string
          lat: number | null
          lng: number | null
          nom: string
          place_id: string | null
          price_level: number | null
          source: string
          telephone: string | null
          type: string | null
          ville: string | null
          website: string | null
        }
        Insert: {
          adresse?: string | null
          arrondissement?: string | null
          categorie?: Database["public"]["Enums"]["etablissement_categorie"]
          code_postal?: string | null
          created_at?: string
          enriched_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nom: string
          place_id?: string | null
          price_level?: number | null
          source?: string
          telephone?: string | null
          type?: string | null
          ville?: string | null
          website?: string | null
        }
        Update: {
          adresse?: string | null
          arrondissement?: string | null
          categorie?: Database["public"]["Enums"]["etablissement_categorie"]
          code_postal?: string | null
          created_at?: string
          enriched_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nom?: string
          place_id?: string | null
          price_level?: number | null
          source?: string
          telephone?: string | null
          type?: string | null
          ville?: string | null
          website?: string | null
        }
        Relationships: []
      }
      liste_item_tags: {
        Row: {
          liste_item_id: string
          tag_id: string
        }
        Insert: {
          liste_item_id: string
          tag_id: string
        }
        Update: {
          liste_item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liste_item_tags_liste_item_id_fkey"
            columns: ["liste_item_id"]
            isOneToOne: false
            referencedRelation: "liste_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liste_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      liste_items: {
        Row: {
          added_at: string
          etablissement_id: string
          id: string
          is_favorite: boolean
          montant_par_personne: number | null
          statut: Database["public"]["Enums"]["liste_statut"]
          user_id: string
        }
        Insert: {
          added_at?: string
          etablissement_id: string
          id?: string
          is_favorite?: boolean
          montant_par_personne?: number | null
          statut?: Database["public"]["Enums"]["liste_statut"]
          user_id: string
        }
        Update: {
          added_at?: string
          etablissement_id?: string
          id?: string
          is_favorite?: boolean
          montant_par_personne?: number | null
          statut?: Database["public"]["Enums"]["liste_statut"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liste_items_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liste_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      tags: {
        Row: {
          categorie: string
          created_at: string
          id: string
          is_system: boolean
          label: string
          slug: string
        }
        Insert: {
          categorie?: string
          created_at?: string
          id?: string
          is_system?: boolean
          label: string
          slug: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          is_system?: boolean
          label?: string
          slug?: string
        }
        Relationships: []
      }
      vins: {
        Row: {
          achat_url: string | null
          cepages: string[]
          couleur: Database["public"]["Enums"]["vin_couleur"] | null
          created_at: string
          domaine: string | null
          id: string
          millesime: number | null
          nom: string
          region: string | null
          user_id: string
        }
        Insert: {
          achat_url?: string | null
          cepages?: string[]
          couleur?: Database["public"]["Enums"]["vin_couleur"] | null
          created_at?: string
          domaine?: string | null
          id?: string
          millesime?: number | null
          nom: string
          region?: string | null
          user_id: string
        }
        Update: {
          achat_url?: string | null
          cepages?: string[]
          couleur?: Database["public"]["Enums"]["vin_couleur"] | null
          created_at?: string
          domaine?: string | null
          id?: string
          millesime?: number | null
          nom?: string
          region?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      upsert_etablissement: { Args: { p: Json }; Returns: string }
    }
    Enums: {
      app_role: "client" | "agence" | "admin"
      etablissement_categorie: "resto" | "hotel"
      liste_statut: "a_faire" | "visite"
      vin_couleur: "rouge" | "blanc" | "rose" | "petillant" | "autre"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["client", "agence", "admin"],
      etablissement_categorie: ["resto", "hotel"],
      liste_statut: ["a_faire", "visite"],
      vin_couleur: ["rouge", "blanc", "rose", "petillant", "autre"],
    },
  },
} as const

