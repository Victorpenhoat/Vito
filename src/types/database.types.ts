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
      conciergerie_demandes: {
        Row: {
          avec_enfants: boolean
          chaise_haute: boolean | null
          commentaire: string | null
          created_at: string
          date_debut: string | null
          date_resa: string | null
          enfants_ages: number[] | null
          etablissement_id: string
          heure_resa: string | null
          id: string
          nb_enfants: number
          nombre_convives: number | null
          nombre_nuits: number | null
          occasion: string | null
          repondu_le: string | null
          repondu_par: string | null
          reponse: string | null
          sejour_type: string | null
          statut: Database["public"]["Enums"]["conciergerie_statut"]
          type: Database["public"]["Enums"]["conciergerie_type"]
          user_id: string
        }
        Insert: {
          avec_enfants?: boolean
          chaise_haute?: boolean | null
          commentaire?: string | null
          created_at?: string
          date_debut?: string | null
          date_resa?: string | null
          enfants_ages?: number[] | null
          etablissement_id: string
          heure_resa?: string | null
          id?: string
          nb_enfants?: number
          nombre_convives?: number | null
          nombre_nuits?: number | null
          occasion?: string | null
          repondu_le?: string | null
          repondu_par?: string | null
          reponse?: string | null
          sejour_type?: string | null
          statut?: Database["public"]["Enums"]["conciergerie_statut"]
          type: Database["public"]["Enums"]["conciergerie_type"]
          user_id: string
        }
        Update: {
          avec_enfants?: boolean
          chaise_haute?: boolean | null
          commentaire?: string | null
          created_at?: string
          date_debut?: string | null
          date_resa?: string | null
          enfants_ages?: number[] | null
          etablissement_id?: string
          heure_resa?: string | null
          id?: string
          nb_enfants?: number
          nombre_convives?: number | null
          nombre_nuits?: number | null
          occasion?: string | null
          repondu_le?: string | null
          repondu_par?: string | null
          reponse?: string | null
          sejour_type?: string | null
          statut?: Database["public"]["Enums"]["conciergerie_statut"]
          type?: Database["public"]["Enums"]["conciergerie_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciergerie_demandes_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciergerie_demandes_repondu_par_fkey"
            columns: ["repondu_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciergerie_demandes_user_id_fkey"
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
      depense_groupe_membres: {
        Row: {
          added_at: string
          groupe_id: string
          profile_id: string
          role: string
        }
        Insert: {
          added_at?: string
          groupe_id: string
          profile_id: string
          role?: string
        }
        Update: {
          added_at?: string
          groupe_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "depense_groupe_membres_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "depense_groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depense_groupe_membres_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      depense_groupes: {
        Row: {
          created_at: string
          devise: string
          id: string
          owner_id: string
          titre: string
          voyage_id: string | null
        }
        Insert: {
          created_at?: string
          devise?: string
          id?: string
          owner_id: string
          titre: string
          voyage_id?: string | null
        }
        Update: {
          created_at?: string
          devise?: string
          id?: string
          owner_id?: string
          titre?: string
          voyage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depense_groupes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depense_groupes_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      depense_parts: {
        Row: {
          depense_id: string
          part_cents: number
          profile_id: string
        }
        Insert: {
          depense_id: string
          part_cents: number
          profile_id: string
        }
        Update: {
          depense_id?: string
          part_cents?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "depense_parts_depense_id_fkey"
            columns: ["depense_id"]
            isOneToOne: false
            referencedRelation: "depenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depense_parts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      depenses: {
        Row: {
          created_at: string
          created_by: string
          date: string | null
          groupe_id: string
          id: string
          libelle: string
          mode: Database["public"]["Enums"]["depense_mode"]
          montant_cents: number
          paye_par: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string | null
          groupe_id: string
          id?: string
          libelle: string
          mode?: Database["public"]["Enums"]["depense_mode"]
          montant_cents: number
          paye_par: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string | null
          groupe_id?: string
          id?: string
          libelle?: string
          mode?: Database["public"]["Enums"]["depense_mode"]
          montant_cents?: number
          paye_par?: string
        }
        Relationships: [
          {
            foreignKeyName: "depenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depenses_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "depense_groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depenses_paye_par_fkey"
            columns: ["paye_par"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profil_gouts: {
        Row: {
          ambiances: string[]
          budget_max: number | null
          types_preferes: string[]
          updated_at: string
          user_id: string
          zones: string[]
        }
        Insert: {
          ambiances?: string[]
          budget_max?: number | null
          types_preferes?: string[]
          updated_at?: string
          user_id: string
          zones?: string[]
        }
        Update: {
          ambiances?: string[]
          budget_max?: number | null
          types_preferes?: string[]
          updated_at?: string
          user_id?: string
          zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profil_gouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      remboursements: {
        Row: {
          created_at: string
          created_by: string
          date: string | null
          de_profile_id: string
          groupe_id: string
          id: string
          montant_cents: number
          vers_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string | null
          de_profile_id: string
          groupe_id: string
          id?: string
          montant_cents: number
          vers_profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string | null
          de_profile_id?: string
          groupe_id?: string
          id?: string
          montant_cents?: number
          vers_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remboursements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_de_profile_id_fkey"
            columns: ["de_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "depense_groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_vers_profile_id_fkey"
            columns: ["vers_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          conciergerie_mail: string | null
          conciergerie_tel: string | null
          created_at: string
          created_by: string
          date_debut: string | null
          date_fin: string | null
          fournisseur: string | null
          id: string
          lien: string | null
          notes: string | null
          reference: string | null
          type: Database["public"]["Enums"]["reservation_type"]
          voyage_id: string
        }
        Insert: {
          conciergerie_mail?: string | null
          conciergerie_tel?: string | null
          created_at?: string
          created_by: string
          date_debut?: string | null
          date_fin?: string | null
          fournisseur?: string | null
          id?: string
          lien?: string | null
          notes?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["reservation_type"]
          voyage_id: string
        }
        Update: {
          conciergerie_mail?: string | null
          conciergerie_tel?: string | null
          created_at?: string
          created_by?: string
          date_debut?: string | null
          date_fin?: string | null
          fournisseur?: string | null
          id?: string
          lien?: string | null
          notes?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["reservation_type"]
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
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
      voyage_membres: {
        Row: {
          added_at: string
          profile_id: string
          role: string
          voyage_id: string
        }
        Insert: {
          added_at?: string
          profile_id: string
          role?: string
          voyage_id: string
        }
        Update: {
          added_at?: string
          profile_id?: string
          role?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_membres_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_membres_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyages: {
        Row: {
          created_at: string
          date_debut: string | null
          date_fin: string | null
          destination: string | null
          id: string
          owner_id: string
          statut: Database["public"]["Enums"]["voyage_statut"]
          titre: string
        }
        Insert: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          id?: string
          owner_id: string
          statut?: Database["public"]["Enums"]["voyage_statut"]
          titre: string
        }
        Update: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          id?: string
          owner_id?: string
          statut?: Database["public"]["Enums"]["voyage_statut"]
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: string
          status: string
          period: string
          current_period_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier?: string
          status: string
          period: string
          current_period_end: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: string
          status?: string
          period?: string
          current_period_end?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      cancel_subscription: { Args: Record<PropertyKey, never>; Returns: undefined }
      can_access_groupe: { Args: { g_id: string }; Returns: boolean }
      can_access_voyage: { Args: { v_id: string }; Returns: boolean }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      find_or_create_vin: { Args: { p: Json }; Returns: string }
      is_groupe_owner: { Args: { g_id: string }; Returns: boolean }
      is_voyage_owner: { Args: { v_id: string }; Returns: boolean }
      mock_subscribe: { Args: { p_period: string }; Returns: undefined }
      share_groupe: {
        Args: { p_email: string; p_groupe_id: string }
        Returns: string
      }
      share_voyage: {
        Args: { p_email: string; p_voyage_id: string }
        Returns: string
      }
      unshare_groupe: {
        Args: { p_groupe_id: string; p_profile_id: string }
        Returns: undefined
      }
      unshare_voyage: {
        Args: { p_profile_id: string; p_voyage_id: string }
        Returns: undefined
      }
      upsert_etablissement: { Args: { p: Json }; Returns: string }
    }
    Enums: {
      app_role: "client" | "agence" | "admin"
      conciergerie_statut: "nouvelle" | "en_cours" | "confirmee" | "refusee"
      conciergerie_type: "resto" | "hotel"
      depense_mode: "egal" | "exact"
      etablissement_categorie: "resto" | "hotel"
      liste_statut: "a_faire" | "visite"
      reservation_type: "hotel" | "vol" | "voiture" | "hebergement" | "autre"
      vin_couleur: "rouge" | "blanc" | "rose" | "petillant" | "autre"
      voyage_statut: "planifie" | "confirme" | "en_cours" | "termine"
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
      depense_mode: ["egal", "exact"],
      etablissement_categorie: ["resto", "hotel"],
      liste_statut: ["a_faire", "visite"],
      reservation_type: ["hotel", "vol", "voiture", "hebergement", "autre"],
      vin_couleur: ["rouge", "blanc", "rose", "petillant", "autre"],
      voyage_statut: ["planifie", "confirme", "en_cours", "termine"],
    },
  },
} as const

