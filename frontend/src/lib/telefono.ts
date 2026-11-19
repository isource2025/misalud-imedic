/** Misma regla que el backend: +54 + 10 dígitos (característica + número), con o sin 9, 0 o 15. */
export function telefonoArValido(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12) {
    const i = [2, 3, 4].find((k) => d.slice(k, k + 2) === "15");
    if (i !== undefined) d = d.slice(0, i) + d.slice(i + 2);
  }
  return /^[1-9]\d{9}$/.test(d);
}

export const ERROR_TELEFONO = "Ingresá un teléfono argentino con característica, p. ej. 379 4123456";
