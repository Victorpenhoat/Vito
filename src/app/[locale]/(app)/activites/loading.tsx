// Squelette d'attente : la page est rendue par le serveur et interroge la base,
// donc l'onglet peut mettre un instant à s'ouvrir. Mieux vaut une forme qui
// occupe la place qu'un écran blanc — la mise en page ne saute pas à l'arrivée.
export default function ChargementActivites() {
  return (
    <main className="flex animate-pulse flex-col gap-4 p-4 md:p-8 lg:mx-auto lg:w-full lg:max-w-[1100px]">
      <div className="h-8 w-44 rounded bg-line-soft" />
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 w-24 rounded-full bg-line-soft" />)}
      </div>
      <div className="h-40 rounded-card bg-line-soft" />
    </main>
  );
}
