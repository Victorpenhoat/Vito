export type Message = {
  // Pas d'expéditeur ici : il est configuré une fois (MAIL_EXPEDITEUR) et
  // appartient au fournisseur. Un appelant qui pourrait le choisir pourrait
  // le choisir mal.
  a: string;
  sujet: string;
  /** Corps HTML. Le lot 2 lui donnera l'allure de Vito ; ici il est nu. */
  html: string;
  /** Version texte : certains clients ne rendent que celle-là, et son absence pèse dans le classement en indésirable. */
  texte: string;
};

export type MessageEnvoye = {
  /** Identifiant du fournisseur — c'est par lui que le webhook retrouvera la ligne du journal. */
  id: string;
};

export interface MailProvider {
  readonly name: string;
  /**
   * `null` quand le message n'est pas parti, quelle qu'en soit la raison —
   * refus du fournisseur, réseau, réponse inattendue. Le fournisseur ne jette
   * jamais : un e-mail est un effet de bord, il ne doit pas faire échouer
   * l'action qui l'a demandé.
   */
  envoyer(m: Message): Promise<MessageEnvoye | null>;
}
