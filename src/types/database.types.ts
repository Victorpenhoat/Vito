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
      agence_clients: {
        Row: {
          added_at: string
          agence_id: string
          client_id: string
        }
        Insert: {
          added_at?: string
          agence_id: string
          client_id: string
        }
        Update: {
          added_at?: string
          agence_id?: string
          client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agence_clients_agence_id_fkey"
            columns: ["agence_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agence_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      degustation_tags: {
        Row: {
          degustation_id: string
          tag_id: string
        }
        Insert: {
          degustation_id: string
          tag_id: string
        }
        Update: {
          degustation_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "degustation_tags_degustation_id_fkey"
            columns: ["degustation_id"]
            isOneToOne: false
            referencedRelation: "degustations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "degustation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      degustations: {
        Row: {
          a_racheter: boolean
          avis_id: string | null
          commentaire: string | null
          created_at: string
          deguste_le: string
          etablissement_id: string | null
          id: string
          lieu_nom: string | null
          lieu_type: string | null
          note: number | null
          prix_paye: number | null
          prix_unite: string | null
          user_id: string
          vin_id: string
          visite_id: string | null
        }
        Insert: {
          a_racheter?: boolean
          avis_id?: string | null
          commentaire?: string | null
          created_at?: string
          deguste_le?: string
          etablissement_id?: string | null
          id?: string
          lieu_nom?: string | null
          lieu_type?: string | null
          note?: number | null
          prix_paye?: number | null
          prix_unite?: string | null
          user_id: string
          vin_id: string
          visite_id?: string | null
        }
        Update: {
          a_racheter?: boolean
          avis_id?: string | null
          commentaire?: string | null
          created_at?: string
          deguste_le?: string
          etablissement_id?: string | null
          id?: string
          lieu_nom?: string | null
          lieu_type?: string | null
          note?: number | null
          prix_paye?: number | null
          prix_unite?: string | null
          user_id?: string
          vin_id?: string
          visite_id?: string | null
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
          {
            foreignKeyName: "degustations_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
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
          equipements: Json | null
          id: string
          lat: number | null
          lng: number | null
          nom: string
          photo_fetched_at: string | null
          photo_ref: string | null
          place_id: string | null
          price_level: number | null
          rating: number | null
          rating_count: number | null
          source: string
          telephone: string | null
          type: string | null
          type_hebergement: string | null
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
          equipements?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          nom: string
          photo_fetched_at?: string | null
          photo_ref?: string | null
          place_id?: string | null
          price_level?: number | null
          rating?: number | null
          rating_count?: number | null
          source?: string
          telephone?: string | null
          type?: string | null
          type_hebergement?: string | null
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
          equipements?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          nom?: string
          photo_fetched_at?: string | null
          photo_ref?: string | null
          place_id?: string | null
          price_level?: number | null
          rating?: number | null
          rating_count?: number | null
          source?: string
          telephone?: string | null
          type?: string | null
          type_hebergement?: string | null
          ville?: string | null
          website?: string | null
        }
        Relationships: []
      }
      famille_membres: {
        Row: {
          added_at: string
          famille_id: string
          profile_id: string
          role: string
        }
        Insert: {
          added_at?: string
          famille_id: string
          profile_id: string
          role?: string
        }
        Update: {
          added_at?: string
          famille_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "famille_membres_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famille_membres_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      famille_restos: {
        Row: {
          added_by: string | null
          created_at: string
          etablissement_id: string
          famille_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          etablissement_id: string
          famille_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          etablissement_id?: string
          famille_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "famille_restos_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famille_restos_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famille_restos_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      familles: {
        Row: {
          created_at: string
          id: string
          nom: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "familles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_documents: {
        Row: {
          contenu_chiffre: string
          contenu_chiffre_verso: string | null
          country: string | null
          created_at: string
          doc_label: string | null
          doc_number: string | null
          doc_number_chiffre: string | null
          doc_type: string
          expiry_date: string | null
          holder_name: string | null
          id: string
          issue_date: string | null
          issue_place: string | null
          member_id: string
          mime_type: string
          mime_type_verso: string | null
          ocr_raw: Json | null
          ocr_raw_chiffre: string | null
          reminder: boolean
          taille: number
          taille_verso: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contenu_chiffre: string
          contenu_chiffre_verso?: string | null
          country?: string | null
          created_at?: string
          doc_label?: string | null
          doc_number?: string | null
          doc_number_chiffre?: string | null
          doc_type: string
          expiry_date?: string | null
          holder_name?: string | null
          id?: string
          issue_date?: string | null
          issue_place?: string | null
          member_id: string
          mime_type: string
          mime_type_verso?: string | null
          ocr_raw?: Json | null
          ocr_raw_chiffre?: string | null
          reminder?: boolean
          taille: number
          taille_verso?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contenu_chiffre?: string
          contenu_chiffre_verso?: string | null
          country?: string | null
          created_at?: string
          doc_label?: string | null
          doc_number?: string | null
          doc_number_chiffre?: string | null
          doc_type?: string
          expiry_date?: string | null
          holder_name?: string | null
          id?: string
          issue_date?: string | null
          issue_place?: string | null
          member_id?: string
          mime_type?: string
          mime_type_verso?: string | null
          ocr_raw?: Json | null
          ocr_raw_chiffre?: string | null
          reminder?: boolean
          taille?: number
          taille_verso?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          address: string | null
          address_inherit: boolean
          avatar_color: string | null
          birth_date: string | null
          birth_place: string | null
          circle: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          profile_id: string | null
          relation: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          address_inherit?: boolean
          avatar_color?: string | null
          birth_date?: string | null
          birth_place?: string | null
          circle?: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          profile_id?: string | null
          relation: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          address_inherit?: boolean
          avatar_color?: string | null
          birth_date?: string | null
          birth_place?: string | null
          circle?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          profile_id?: string | null
          relation?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          consomme_le: string | null
          consomme_par: string | null
          created_at: string
          cree_par: string
          email: string | null
          expire_le: string
          family_member_id: string | null
          id: string
          role_vise: string
          token: string
          usages: number
          usages_max: number
          voyage_id: string | null
        }
        Insert: {
          consomme_le?: string | null
          consomme_par?: string | null
          created_at?: string
          cree_par: string
          email?: string | null
          expire_le?: string
          family_member_id?: string | null
          id?: string
          role_vise?: string
          token: string
          usages?: number
          usages_max?: number
          voyage_id?: string | null
        }
        Update: {
          consomme_le?: string | null
          consomme_par?: string | null
          created_at?: string
          cree_par?: string
          email?: string | null
          expire_le?: string
          family_member_id?: string | null
          id?: string
          role_vise?: string
          token?: string
          usages?: number
          usages_max?: number
          voyage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_consomme_par_fkey"
            columns: ["consomme_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
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
          archived_at: string | null
          checkin_heure: string | null
          checkout_heure: string | null
          etablissement_id: string
          etoiles: number | null
          id: string
          is_archived: boolean
          is_favorite: boolean
          montant_par_personne: number | null
          origine_family_member_id: string | null
          origine_qui: string | null
          origine_source: string | null
          origine_type: string | null
          prix_nuit: number | null
          reco_source: string | null
          statut: Database["public"]["Enums"]["liste_statut"]
          user_id: string
        }
        Insert: {
          added_at?: string
          archived_at?: string | null
          checkin_heure?: string | null
          checkout_heure?: string | null
          etablissement_id: string
          etoiles?: number | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          montant_par_personne?: number | null
          origine_family_member_id?: string | null
          origine_qui?: string | null
          origine_source?: string | null
          origine_type?: string | null
          prix_nuit?: number | null
          reco_source?: string | null
          statut?: Database["public"]["Enums"]["liste_statut"]
          user_id: string
        }
        Update: {
          added_at?: string
          archived_at?: string | null
          checkin_heure?: string | null
          checkout_heure?: string | null
          etablissement_id?: string
          etoiles?: number | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          montant_par_personne?: number | null
          origine_family_member_id?: string | null
          origine_qui?: string | null
          origine_source?: string | null
          origine_type?: string | null
          prix_nuit?: number | null
          reco_source?: string | null
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
            foreignKeyName: "liste_items_origine_family_member_id_fkey"
            columns: ["origine_family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
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
          biometrie_activee: boolean
          conditions_acceptees_le: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          locale: string
          role: Database["public"]["Enums"]["app_role"]
          suppression_demandee_le: string | null
          suspendu_le: string | null
          verrou_delai_minutes: number
        }
        Insert: {
          biometrie_activee?: boolean
          conditions_acceptees_le?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
          suppression_demandee_le?: string | null
          suspendu_le?: string | null
          verrou_delai_minutes?: number
        }
        Update: {
          biometrie_activee?: boolean
          conditions_acceptees_le?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
          suppression_demandee_le?: string | null
          suspendu_le?: string | null
          verrou_delai_minutes?: number
        }
        Relationships: []
      }
      reauth_tickets: {
        Row: {
          cible: string
          consomme_le: string | null
          created_at: string
          expire_le: string
          id: string
          ticket_hash: string
          user_id: string
        }
        Insert: {
          cible: string
          consomme_le?: string | null
          created_at?: string
          expire_le?: string
          id?: string
          ticket_hash: string
          user_id: string
        }
        Update: {
          cible?: string
          consomme_le?: string | null
          created_at?: string
          expire_le?: string
          id?: string
          ticket_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reauth_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommandations: {
        Row: {
          categorie: string
          created_at: string
          de_profile_id: string
          id: string
          libelle: string
          mot: string | null
          place_id: string
          statut: string
          traitee_le: string | null
          vers_profile_id: string
        }
        Insert: {
          categorie: string
          created_at?: string
          de_profile_id: string
          id?: string
          libelle: string
          mot?: string | null
          place_id: string
          statut?: string
          traitee_le?: string | null
          vers_profile_id: string
        }
        Update: {
          categorie?: string
          created_at?: string
          de_profile_id?: string
          id?: string
          libelle?: string
          mot?: string | null
          place_id?: string
          statut?: string
          traitee_le?: string | null
          vers_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommandations_de_profile_id_fkey"
            columns: ["de_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommandations_vers_profile_id_fkey"
            columns: ["vers_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          details: Json | null
          etablissement_id: string | null
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
          details?: Json | null
          etablissement_id?: string | null
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
          details?: Json | null
          etablissement_id?: string | null
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
            foreignKeyName: "reservations_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
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
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          id: string
          period: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          id?: string
          period: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          id?: string
          period?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
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
      tags: {
        Row: {
          categorie: string
          color: string | null
          created_at: string
          id: string
          is_system: boolean
          label: string
          scope: string
          slug: string
          user_id: string | null
        }
        Insert: {
          categorie?: string
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          label: string
          scope?: string
          slug: string
          user_id?: string | null
        }
        Update: {
          categorie?: string
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          label?: string
          scope?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vins: {
        Row: {
          achat_url: string | null
          analyse_at: string | null
          analyse_confiance: Json | null
          analyse_contenu: Json | null
          analyse_modele: string | null
          appellation: string | null
          cepages: string[]
          couleur: Database["public"]["Enums"]["vin_couleur"] | null
          created_at: string
          cuvee: string | null
          degre: number | null
          domaine: string | null
          etiquette_chiffree: string | null
          etiquette_mime: string | null
          etiquette_taille: number | null
          id: string
          millesime: number | null
          nom: string
          region: string | null
          user_id: string
        }
        Insert: {
          achat_url?: string | null
          analyse_at?: string | null
          analyse_confiance?: Json | null
          analyse_contenu?: Json | null
          analyse_modele?: string | null
          appellation?: string | null
          cepages?: string[]
          couleur?: Database["public"]["Enums"]["vin_couleur"] | null
          created_at?: string
          cuvee?: string | null
          degre?: number | null
          domaine?: string | null
          etiquette_chiffree?: string | null
          etiquette_mime?: string | null
          etiquette_taille?: number | null
          id?: string
          millesime?: number | null
          nom: string
          region?: string | null
          user_id: string
        }
        Update: {
          achat_url?: string | null
          analyse_at?: string | null
          analyse_confiance?: Json | null
          analyse_contenu?: Json | null
          analyse_modele?: string | null
          appellation?: string | null
          cepages?: string[]
          couleur?: Database["public"]["Enums"]["vin_couleur"] | null
          created_at?: string
          cuvee?: string | null
          degre?: number | null
          domaine?: string | null
          etiquette_chiffree?: string | null
          etiquette_mime?: string | null
          etiquette_taille?: number | null
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
      visites: {
        Row: {
          adultes: number | null
          chambres: number | null
          commentaire: string | null
          created_at: string
          date_fin: string | null
          enfants: number | null
          id: string
          liste_item_id: string
          note: number | null
          user_id: string
          visite_le: string
          voyage_id: string | null
        }
        Insert: {
          adultes?: number | null
          chambres?: number | null
          commentaire?: string | null
          created_at?: string
          date_fin?: string | null
          enfants?: number | null
          id?: string
          liste_item_id: string
          note?: number | null
          user_id: string
          visite_le?: string
          voyage_id?: string | null
        }
        Update: {
          adultes?: number | null
          chambres?: number | null
          commentaire?: string | null
          created_at?: string
          date_fin?: string | null
          enfants?: number | null
          id?: string
          liste_item_id?: string
          note?: number | null
          user_id?: string
          visite_le?: string
          voyage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visites_liste_item_id_fkey"
            columns: ["liste_item_id"]
            isOneToOne: false
            referencedRelation: "liste_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_depense_parts: {
        Row: {
          depense_id: string
          part_cents: number
          participant_id: string
        }
        Insert: {
          depense_id: string
          part_cents: number
          participant_id: string
        }
        Update: {
          depense_id?: string
          part_cents?: number
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_depense_parts_depense_id_fkey"
            columns: ["depense_id"]
            isOneToOne: false
            referencedRelation: "voyage_depenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_depense_parts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "voyage_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_depenses: {
        Row: {
          created_at: string
          created_by: string
          date: string | null
          id: string
          libelle: string
          mode: Database["public"]["Enums"]["depense_mode"]
          montant_cents: number
          paye_par: string
          voyage_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string | null
          id?: string
          libelle: string
          mode?: Database["public"]["Enums"]["depense_mode"]
          montant_cents: number
          paye_par: string
          voyage_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string | null
          id?: string
          libelle?: string
          mode?: Database["public"]["Enums"]["depense_mode"]
          montant_cents?: number
          paye_par?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_depenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_depenses_paye_par_fkey"
            columns: ["paye_par"]
            isOneToOne: false
            referencedRelation: "voyage_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_depenses_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_documents: {
        Row: {
          contenu_chiffre: string
          created_at: string
          id: string
          mime_type: string
          nom: string
          reservation_id: string | null
          taille: number
          uploaded_by: string | null
          voyage_id: string
        }
        Insert: {
          contenu_chiffre: string
          created_at?: string
          id?: string
          mime_type: string
          nom: string
          reservation_id?: string | null
          taille: number
          uploaded_by?: string | null
          voyage_id: string
        }
        Update: {
          contenu_chiffre?: string
          created_at?: string
          id?: string
          mime_type?: string
          nom?: string
          reservation_id?: string | null
          taille?: number
          uploaded_by?: string | null
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_documents_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_documents_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_etapes: {
        Row: {
          created_at: string
          created_by: string
          etablissement_id: string | null
          heure: string | null
          id: string
          jour: string | null
          lieu: string | null
          notes: string | null
          ordre: number
          titre: string
          voyage_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          etablissement_id?: string | null
          heure?: string | null
          id?: string
          jour?: string | null
          lieu?: string | null
          notes?: string | null
          ordre?: number
          titre: string
          voyage_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          etablissement_id?: string | null
          heure?: string | null
          id?: string
          jour?: string | null
          lieu?: string | null
          notes?: string | null
          ordre?: number
          titre?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_etapes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_etapes_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_etapes_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
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
      voyage_participants: {
        Row: {
          created_at: string
          created_by: string
          display_name: string
          email: string | null
          family_member_id: string | null
          id: string
          profile_id: string | null
          role: string
          voyage_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          display_name: string
          email?: string | null
          family_member_id?: string | null
          id?: string
          profile_id?: string | null
          role?: string
          voyage_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          display_name?: string
          email?: string | null
          family_member_id?: string | null
          id?: string
          profile_id?: string | null
          role?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_participants_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_participants_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_remboursements: {
        Row: {
          created_at: string
          created_by: string
          date: string | null
          de_participant_id: string
          id: string
          montant_cents: number
          vers_participant_id: string
          voyage_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string | null
          de_participant_id: string
          id?: string
          montant_cents: number
          vers_participant_id: string
          voyage_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string | null
          de_participant_id?: string
          id?: string
          montant_cents?: number
          vers_participant_id?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_remboursements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_remboursements_de_participant_id_fkey"
            columns: ["de_participant_id"]
            isOneToOne: false
            referencedRelation: "voyage_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_remboursements_vers_participant_id_fkey"
            columns: ["vers_participant_id"]
            isOneToOne: false
            referencedRelation: "voyage_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_remboursements_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyages: {
        Row: {
          cover_fetched_at: string | null
          cover_photo_ref: string | null
          cover_url: string | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          destination: string | null
          devise: string
          id: string
          owner_id: string
          periode_texte: string | null
          statut: Database["public"]["Enums"]["voyage_statut"]
          titre: string
        }
        Insert: {
          cover_fetched_at?: string | null
          cover_photo_ref?: string | null
          cover_url?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          devise?: string
          id?: string
          owner_id: string
          periode_texte?: string | null
          statut?: Database["public"]["Enums"]["voyage_statut"]
          titre: string
        }
        Update: {
          cover_fetched_at?: string | null
          cover_photo_ref?: string | null
          cover_url?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          devise?: string
          id?: string
          owner_id?: string
          periode_texte?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_lister_comptes: {
        Args: never
        Returns: {
          created_at: string
          derniere_connexion: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          statut: string
        }[]
      }
      admin_suspendre_compte: {
        Args: { p_suspendre: boolean; p_user_id: string }
        Returns: boolean
      }
      annuler_suppression_compte: { Args: never; Returns: undefined }
      cache_etablissement_photo: {
        Args: { p_etab: string; p_ref: string }
        Returns: undefined
      }
      can_access_famille: { Args: { f_id: string }; Returns: boolean }
      can_access_groupe: { Args: { g_id: string }; Returns: boolean }
      can_access_voyage: { Args: { v_id: string }; Returns: boolean }
      cancel_subscription: { Args: never; Returns: undefined }
      consommer_invitation: { Args: { p_token: string }; Returns: Json }
      consommer_reauth_ticket: {
        Args: { p_cible: string; p_hash: string }
        Returns: boolean
      }
      creer_voyage_pour_client: {
        Args: {
          p_client_id: string
          p_date_debut: string
          p_date_fin: string
          p_destination: string
          p_statut: Database["public"]["Enums"]["voyage_statut"]
          p_titre: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delai_retractation_jours: { Args: never; Returns: number }
      delier_client: { Args: { p_client_id: string }; Returns: undefined }
      demander_suppression_compte: { Args: never; Returns: string }
      emettre_reauth_ticket: {
        Args: { p_cible: string; p_hash: string }
        Returns: undefined
      }
      find_or_create_vin: { Args: { p: Json }; Returns: string }
      fusionner_tags: {
        Args: { p_cible: string; p_source: string }
        Returns: undefined
      }
      invitation_infos: { Args: { p_token: string }; Returns: Json }
      inviter_famille: {
        Args: { p_email: string; p_famille_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_agence: { Args: never; Returns: boolean }
      is_co_membre: { Args: { target: string }; Returns: boolean }
      is_concierge: { Args: never; Returns: boolean }
      is_famille_owner: { Args: { f_id: string }; Returns: boolean }
      is_groupe_membre: {
        Args: { g_id: string; p_id: string }
        Returns: boolean
      }
      is_groupe_owner: { Args: { g_id: string }; Returns: boolean }
      is_premium: { Args: { uid: string }; Returns: boolean }
      is_voyage_owner: { Args: { v_id: string }; Returns: boolean }
      lier_client: { Args: { p_email: string }; Returns: string }
      mes_connexions_recentes: {
        Args: { p_limite?: number }
        Returns: {
          action: string
          cree_le: string
          ip: string
        }[]
      }
      mes_sessions: {
        Args: never
        Returns: {
          courante: boolean
          created_at: string
          id: string
          ip: string
          refreshed_at: string
          user_agent: string
        }[]
      }
      mock_subscribe: { Args: { p_period: string }; Returns: undefined }
      purger_comptes_supprimes: { Args: never; Returns: number }
      quitter_famille: { Args: never; Returns: undefined }
      recommander_adresse: {
        Args: {
          p_categorie: string
          p_family_member_id: string
          p_libelle: string
          p_mot?: string
          p_place_id: string
        }
        Returns: Json
      }
      retirer_membre_famille: {
        Args: { p_famille_id: string; p_profile_id: string }
        Returns: undefined
      }
      revoquer_autres_sessions: { Args: never; Returns: number }
      revoquer_session: { Args: { p_session_id: string }; Returns: boolean }
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
      voyage_statut:
        | "idee"
        | "en_preparation"
        | "planifie"
        | "confirme"
        | "en_cours"
        | "termine"
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
      conciergerie_statut: ["nouvelle", "en_cours", "confirmee", "refusee"],
      conciergerie_type: ["resto", "hotel"],
      depense_mode: ["egal", "exact"],
      etablissement_categorie: ["resto", "hotel"],
      liste_statut: ["a_faire", "visite"],
      reservation_type: ["hotel", "vol", "voiture", "hebergement", "autre"],
      vin_couleur: ["rouge", "blanc", "rose", "petillant", "autre"],
      voyage_statut: [
        "idee",
        "en_preparation",
        "planifie",
        "confirme",
        "en_cours",
        "termine",
      ],
    },
  },
} as const

