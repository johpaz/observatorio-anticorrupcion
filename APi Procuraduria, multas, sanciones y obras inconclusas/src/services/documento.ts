/**
 * Coincidencia de documentos (cédula / NIT) sin falsos positivos.
 *
 * Antes se usaba `documento LIKE '%x%'`, que coincide en cualquier parte del número:
 * un documento corto heredaba las sanciones de otra persona, y valores basura como
 * "0000000" coincidían con todo lo que los contuviera.
 *
 * Reglas:
 *  - igualdad exacta tras quitar puntos, guiones y espacios;
 *  - un NIT de empresa (9 dígitos, empieza en 8 o 9) también coincide con su versión de
 *    10 dígitos con dígito de verificación, y viceversa: las fuentes lo guardan de ambas formas;
 *  - documentos placeholder (cortos o de un solo dígito repetido) no coinciden con nada.
 */

/** Quita puntos, guiones, espacios y pasa a mayúsculas. */
export function normalizarDocumento(raw: string): string {
  return raw.replace(/[.\-\s]/g, "").toUpperCase();
}

export function esDocumentoValido(doc: string): boolean {
  const d = normalizarDocumento(doc);
  if (d.length < 5) return false;
  if (/^(.)\1+$/.test(d)) return false; // 0000000, 1111111...
  return true;
}

/** Expresión SQL que normaliza una columna igual que `normalizarDocumento`. */
const normSql = (col: string) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${col}),'.',''),'-',''),' ',''))`;

const esNitBase = (d: string) => /^[89]\d{8}$/.test(d);
const esNitConDv = (d: string) => /^[89]\d{9}$/.test(d);

/**
 * Condición SQL + parámetros para comparar `col` con el documento consultado.
 * Si el documento no es válido devuelve una condición que nunca se cumple.
 */
export function coincideDocumento(col: string, documento: string): { sql: string; params: string[] } {
  const d = normalizarDocumento(documento);
  if (!esDocumentoValido(d)) return { sql: "0", params: [] };

  const n = normSql(col);
  if (esNitBase(d)) {
    // consultado sin DV: acepta exacto o el mismo NIT con un dígito de verificación al final
    return { sql: `(${n} = ? OR (LENGTH(${n}) = 10 AND SUBSTR(${n}, 1, 9) = ?))`, params: [d, d] };
  }
  if (esNitConDv(d)) {
    // consultado con DV: acepta exacto o el NIT base guardado sin DV
    return { sql: `(${n} = ? OR ${n} = ?)`, params: [d, d.slice(0, 9)] };
  }
  return { sql: `${n} = ?`, params: [d] };
}
