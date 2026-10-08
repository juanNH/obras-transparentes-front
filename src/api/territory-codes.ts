/** @file Códigos de jurisdicciones INDEC instaladas para validar filtros sin depender de catálogos de obras. */

const PROVINCE_CODES = new Set([
  "02",
  "06",
  "10",
  "14",
  "18",
  "22",
  "26",
  "30",
  "34",
  "38",
  "42",
  "46",
  "50",
  "54",
  "58",
  "62",
  "66",
  "70",
  "74",
  "78",
  "82",
  "86",
  "90",
  "94",
]);

/** Comprueba que un código pertenece a una de las 24 jurisdicciones INDEC instaladas. */
export function isKnownProvinceCode(code: string): boolean {
  return PROVINCE_CODES.has(code);
}
