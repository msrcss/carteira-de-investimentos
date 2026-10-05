// Lê as linhas do extrato "Negociação" da Área do Investidor da B3
// (Extratos > Negociação > baixar Excel). Colunas esperadas:
// Data do Negócio | Tipo de Movimentação | Mercado | Prazo/Vencimento | Instituição |
// Código de Negociação | Quantidade | Preço | Valor

import { dataISO, lerNumero } from './formato';
import type { TipoLancamento } from './tipos';

export interface LinhaImportada {
  data: string;
  tipo: TipoLancamento;
  ticker: string;
  quantidade: number;
  preco: number;
  instituicao: string;
  chave: string;
}

export interface ResultadoImportacao {
  linhas: LinhaImportada[];
  ignoradas: { linha: number; motivo: string }[];
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const COLUNAS = {
  data: ['datadonegocio', 'data'],
  tipo: ['tipodemovimentacao', 'compravenda', 'cv'],
  mercado: ['mercado'],
  instituicao: ['instituicao'],
  ticker: ['codigodenegociacao', 'codigo', 'ativo'],
  quantidade: ['quantidade'],
  preco: ['preco', 'precounitario'],
};

function achar(linha: Record<string, unknown>, nomes: string[]): unknown {
  for (const [k, v] of Object.entries(linha)) if (nomes.includes(normalizar(k))) return v;
  return undefined;
}

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

function numero(v: unknown): number | null {
  if (typeof v === 'number') return v;
  return lerNumero(texto(v));
}

function data(v: unknown): string | null {
  if (typeof v === 'number') {
    // data serial do Excel
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = texto(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return dataISO(s);
}

export function lerLinhasNegociacao(linhas: Record<string, unknown>[]): ResultadoImportacao {
  const ok: LinhaImportada[] = [];
  const ignoradas: ResultadoImportacao['ignoradas'] = [];
  const ocorrencias = new Map<string, number>();

  linhas.forEach((l, i) => {
    const n = i + 2; // linha 1 é o cabeçalho
    const d = data(achar(l, COLUNAS.data));
    const tipoTxt = normalizar(texto(achar(l, COLUNAS.tipo)));
    const mercado = normalizar(texto(achar(l, COLUNAS.mercado)));
    let ticker = texto(achar(l, COLUNAS.ticker)).toUpperCase();
    const quantidade = numero(achar(l, COLUNAS.quantidade));
    const preco = numero(achar(l, COLUNAS.preco));
    const instituicao = texto(achar(l, COLUNAS.instituicao));

    if (!d && !ticker) return; // linha vazia ou total
    if (!d) return ignoradas.push({ linha: n, motivo: 'data inválida' });
    const tipo: TipoLancamento | null = tipoTxt.startsWith('compra') || tipoTxt === 'c' ? 'compra' : tipoTxt.startsWith('venda') || tipoTxt === 'v' ? 'venda' : null;
    if (!tipo) return ignoradas.push({ linha: n, motivo: 'tipo não é compra nem venda' });
    if (mercado && !mercado.includes('vista') && !mercado.includes('fracionario')) {
      return ignoradas.push({ linha: n, motivo: `mercado não suportado (${texto(achar(l, COLUNAS.mercado))})` });
    }
    // Mercado fracionário usa o ticker com F no final (PETR4F)
    if (/^[A-Z0-9]{4}\d{1,2}F$/.test(ticker)) ticker = ticker.slice(0, -1);
    if (!/^[A-Z0-9]{4}\d{1,2}$/.test(ticker)) return ignoradas.push({ linha: n, motivo: `código inválido (${ticker})` });
    if (!quantidade || quantidade <= 0) return ignoradas.push({ linha: n, motivo: 'quantidade inválida' });
    if (preco == null || preco < 0) return ignoradas.push({ linha: n, motivo: 'preço inválido' });

    // Duas operações iguais no mesmo dia são legítimas; o número da ocorrência as diferencia
    const base = [d, tipo, ticker, quantidade, preco.toFixed(4), normalizar(instituicao)].join('|');
    const k = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, k);
    ok.push({ data: d, tipo, ticker, quantidade, preco, instituicao, chave: `${base}|${k}` });
  });

  ok.sort((a, b) => a.data.localeCompare(b.data));
  return { linhas: ok, ignoradas };
}

/** Classe provável pelo código: final 11 costuma ser FII (pode ser unit ou ETF; o usuário corrige). */
export function classeProvavel(ticker: string): 'acao' | 'fii' | 'bdr' {
  if (/3[2-5]$/.test(ticker)) return 'bdr';
  if (/11$/.test(ticker)) return 'fii';
  return 'acao';
}
