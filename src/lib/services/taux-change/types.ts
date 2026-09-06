export type TauxDeChange = {
  /** Combien d'unités de la devise cible vaut UNE unité de la devise source. */
  taux: number;
  /**
   * Jour du taux retenu — pas forcément celui demandé : les taux de référence
   * ne sont publiés que les jours ouvrés, une dépense du dimanche prend donc
   * le vendredi. C'est ce jour-là que l'écran annonce (« taux du 14/10 »).
   */
  date: string;
};

export interface TauxProvider {
  readonly name: string;
  /**
   * `null` quand le taux n'est pas connu : devise hors catalogue, service
   * indisponible, date hors historique. L'appelant demande alors le taux à
   * l'utilisateur plutôt que d'en inventer un — un chiffre faux se propage
   * dans tous les soldes du voyage.
   */
  taux(de: string, vers: string, date: string): Promise<TauxDeChange | null>;
}
