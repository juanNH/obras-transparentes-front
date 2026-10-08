/** @file Filtro opcional de localidad oficial con catálogo acotado por una provincia aplicada y códigos preservados durante fallas. */
"use client";

import { useId } from "react";
import type { LocalityCatalog } from "../api/client";

/** Permite elegir códigos exactos sin inferir una localidad desde nombres de obra o geometrías. */
export function LocalityFilter({
  catalog,
  localidadCodigo = [],
  provinciaCodigo = [],
}: {
  catalog: LocalityCatalog | null;
  localidadCodigo?: readonly string[];
  provinciaCodigo?: readonly string[];
}) {
  const help = useId();
  const selected = [...new Set(localidadCodigo)];
  const items = catalog?.items ?? [];
  const unavailable = selected.filter(
    (code) => !items.some((item) => item.codigo === code),
  );
  const disabled = !catalog;
  const helpText =
    provinciaCodigo.length === 1
      ? "Las opciones corresponden a la provincia aplicada. Si cambiaste la provincia en este formulario, aplicá primero esa selección para actualizar la nómina."
      : provinciaCodigo.length > 1
        ? "Aplicá una sola provincia para cargar una nómina manejable de localidades."
        : "Elegí y aplicá una provincia para cargar sus localidades oficiales.";

  return (
    <fieldset className="locality-filter" aria-describedby={help}>
      <legend>Localidad oficial</legend>
      {catalog && (
        <label htmlFor={help}>
          Localidades GeoRef
          <select
            id={help}
            name="localidadCodigo"
            multiple
            size={8}
            defaultValue={selected.filter((code) =>
              items.some((item) => item.codigo === code),
            )}
          >
            {items.map((item) => (
              <option key={item.codigo} value={item.codigo}>
                {item.nombre} · {item.departamentoNombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {unavailable.map((code) => (
        <input key={code} type="hidden" name="localidadCodigo" value={code} />
      ))}
      <p id={help} className="party-filter-help">
        {disabled
          ? helpText
          : "Sólo se listan obras cuya revisión publicada informa el código oficial de la localidad. Podés elegir varias opciones con Ctrl o Cmd."}
      </p>
    </fieldset>
  );
}
