import { describe, expect, it } from "vitest";
import { arrondirVerres, moyenneVerres, noteApresClic, verresPour } from "./verres";

describe("arrondirVerres", () => {
  it("arrondit au demi-verre et borne à [0,5 ; 5]", () => {
    expect(arrondirVerres(4.3)).toBe(4.5);
    expect(arrondirVerres(4.1)).toBe(4);
    expect(arrondirVerres(0)).toBe(0.5);
    expect(arrondirVerres(9)).toBe(5);
  });
});

describe("verresPour", () => {
  it("découpe la note en pleins / demi / vides", () => {
    expect(verresPour(4.5)).toEqual({ pleins: 4, demi: true, vides: 0 });
    expect(verresPour(5)).toEqual({ pleins: 5, demi: false, vides: 0 });
    expect(verresPour(3)).toEqual({ pleins: 3, demi: false, vides: 2 });
  });
  it("rend cinq verres vides sans note", () => {
    expect(verresPour(null)).toEqual({ pleins: 0, demi: false, vides: 5 });
  });
});

describe("noteApresClic", () => {
  it("donne le verre plein, puis le demi au second clic sur le même verre", () => {
    expect(noteApresClic(4, null)).toBe(4);
    expect(noteApresClic(4, 4)).toBe(3.5);
    expect(noteApresClic(4, 3.5)).toBe(4);
    expect(noteApresClic(1, 1)).toBe(0.5);
  });
});

describe("moyenneVerres", () => {
  it("moyenne les notes renseignées, au dixième", () => {
    expect(moyenneVerres([5, 4.5, 4])).toBe(4.5);
    expect(moyenneVerres([4, 4.5])).toBe(4.3);
    expect(moyenneVerres([null, 3])).toBe(3);
  });
  it("null si aucune note", () => {
    expect(moyenneVerres([])).toBeNull();
    expect(moyenneVerres([null, null])).toBeNull();
  });
});
