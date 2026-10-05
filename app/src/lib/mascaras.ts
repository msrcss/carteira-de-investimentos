/** Formata enquanto digita: 02102026 -> 02/10/2026 */
export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Aceita só dígitos, vírgula e ponto */
export const mascaraNumero = (v: string) => v.replace(/[^\d.,]/g, '');

/** Número em JS -> texto com vírgula para preencher campo */
export const paraCampo = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
