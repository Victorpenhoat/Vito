import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Input } from "./Input";
import { Select } from "./Select";

describe("Input / Select — drop-in nu vs stack labellisé", () => {
  it("Input sans label ni erreur : rend un <input> nu (pas de wrapper label)", () => {
    const { container } = render(<Input name="x" placeholder="y" className="w-24" />);
    expect(container.firstElementChild?.tagName).toBe("INPUT");
    expect(container.querySelector("label")).toBeNull();
    expect(container.querySelector("input")).toHaveClass("w-24");
  });

  it("Input avec label : enveloppe dans un label + span", () => {
    const { container, getByText } = render(<Input label="Nom" name="x" />);
    expect(container.firstElementChild?.tagName).toBe("LABEL");
    expect(getByText("Nom")).toBeInTheDocument();
  });

  it("Input avec erreur : affiche l'erreur + aria-invalid", () => {
    const { getByText, container } = render(<Input error="Requis" name="x" />);
    expect(getByText("Requis")).toBeInTheDocument();
    expect(container.querySelector("input")).toHaveAttribute("aria-invalid", "true");
  });

  it("Select sans label : rend le control + chevron, sans wrapper label", () => {
    const { container } = render(<Select name="s"><option value="a">A</option></Select>);
    expect(container.querySelector("label")).toBeNull();
    expect(container.querySelector("select")).toBeInTheDocument();
  });
});
