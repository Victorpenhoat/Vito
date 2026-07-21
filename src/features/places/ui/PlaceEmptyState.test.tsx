import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { PlaceEmptyState } from "./PlaceEmptyState";

const messages = {
  places: {
    emptyFavorisTitle: "Aucun favori pour l'instant",
    emptyFavorisBody: "Ajoute tes coups de cœur…",
    emptyRecommandesTitle: "Rien à tester pour l'instant",
    emptyRecommandesBody: "Quand on te conseille une adresse…",
    emptyCtaHotel: "Découvrir des hôtels",
    emptyCtaResto: "Découvrir des restos",
  },
};

const renderState = (props: Parameters<typeof PlaceEmptyState>[0]) =>
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <PlaceEmptyState {...props} />
    </NextIntlClientProvider>,
  );

describe("PlaceEmptyState", () => {
  it("favoris hôtel : titre favoris + CTA hôtel", () => {
    renderState({ category: "hotel", kind: "favoris", onDiscover: () => {} });
    expect(screen.getByText("Aucun favori pour l'instant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Découvrir des hôtels" })).toBeInTheDocument();
  });

  it("recommandes resto : titre recommandés + CTA resto", () => {
    renderState({ category: "resto", kind: "recommandes", onDiscover: () => {} });
    expect(screen.getByText("Rien à tester pour l'instant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Découvrir des restos" })).toBeInTheDocument();
  });

  it("clic CTA → appelle onDiscover", async () => {
    const onDiscover = vi.fn();
    renderState({ category: "hotel", kind: "favoris", onDiscover });
    await userEvent.click(screen.getByRole("button", { name: "Découvrir des hôtels" }));
    expect(onDiscover).toHaveBeenCalledOnce();
  });
});
