const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const qtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const OCULTO = 'R$ ••••';

export const moeda = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : brl.format(v).replace(/ /g, ' '));
export const numero = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : num.format(v));
export const quantidade = (v: number) => qtd.format(v);
export const percentual = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : pct.format(v));

export const comSinal = (s: string, v: number) => (v > 0 ? `+${s}` : v < 0 ? s.replace('-', '−') : s);
export const moedaSinal = (v: number) => comSinal(moeda(v), v);
export const percentualSinal = (v: number) => comSinal(percentual(v), v);

/** Data de hoje no fuso de São Paulo, AAAA-MM-DD */
export function hojeISO(agora = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return p.format(agora);
}

/** AAAA-MM-DD -> DD/MM/AAAA */
export const dataBR = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

/** DD/MM/AAAA -> AAAA-MM-DD (ou null se inválida) */
export function dataISO(br: string): string | null {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, a] = m;
  const dt = new Date(Date.UTC(+a, +mo - 1, +d));
  if (dt.getUTCDate() !== +d || dt.getUTCMonth() !== +mo - 1) return null;
  return `${a}-${mo}-${d}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesCurto = (iso: string) => `${MESES[+iso.slice(5, 7) - 1]}/${iso.slice(2, 4)}`;
export const mesLongo = (iso: string) => MESES_LONGOS[+iso.slice(5, 7) - 1];
export const mesAno = (iso: string) => `${MESES_LONGOS[+iso.slice(5, 7) - 1]} de ${iso.slice(0, 4)}`;

/** "1.234,56" ou "R$ 1.234,56" -> 1234.56 */
export function lerNumero(txt: string): number | null {
  const limpo = txt.replace(/[R$\s]/g, '');
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return isFinite(n) ? n : null;
}
