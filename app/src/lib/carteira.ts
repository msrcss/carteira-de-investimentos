// Cálculos da carteira: posição, preço médio, resultado, proventos e rentabilidade.
// Funções puras, sem acesso a rede, para poder testar com dados de exemplo.
//
// Convenção de datas: strings AAAA-MM-DD (comparáveis como texto).
// Um evento corporativo com data com D passa a valer no dia seguinte (data ex),
// porque o preço de fechamento de D ainda é o preço antigo (COTAHIST não é ajustado).

import type {
  Ativo,
  Classe,
  EventoCorporativo,
  Lancamento,
  PontoIndice,
  PrecoHistorico,
  Provento,
} from './tipos';

export const IR_JCP = 0.15;

export interface Estado {
  quantidade: number;
  custo: number; // custo total da posição (base do preço médio)
  realizado: number; // lucro/prejuízo realizado em vendas
}

const vazio = (): Estado => ({ quantidade: 0, custo: 0, realizado: 0 });

// Lançamento manual com mesmo ativo, tipo e data com substitui o que veio da B3 (é uma correção).
export function mesclarCorrecoes<T extends { user_id: string | null; ticker: string; tipo: string; data_com: string }>(
  itens: T[],
): T[] {
  const manuais = new Set(itens.filter((i) => i.user_id).map((i) => `${i.ticker}|${i.tipo}|${i.data_com}`));
  return itens.filter((i) => i.user_id || !manuais.has(`${i.ticker}|${i.tipo}|${i.data_com}`));
}

function ordenarLancamentos(lancs: Lancamento[]): Lancamento[] {
  // No mesmo dia, compras antes de vendas (evita posição negativa por ordem de digitação)
  return [...lancs].sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.tipo === b.tipo ? 0 : a.tipo === 'compra' ? -1 : 1,
  );
}

export function aplicarLancamento(e: Estado, l: Pick<Lancamento, 'tipo' | 'quantidade' | 'preco' | 'taxas'>): Estado {
  if (l.tipo === 'compra') {
    return {
      quantidade: e.quantidade + l.quantidade,
      custo: e.custo + l.quantidade * l.preco + l.taxas,
      realizado: e.realizado,
    };
  }
  const pm = e.quantidade > 0 ? e.custo / e.quantidade : 0;
  const q = Math.min(l.quantidade, e.quantidade);
  const quantidade = e.quantidade - q;
  return {
    quantidade,
    custo: quantidade > 1e-9 ? e.custo - q * pm : 0,
    realizado: e.realizado + q * l.preco - l.taxas - q * pm,
  };
}

export function aplicarEvento(e: Estado, ev: Pick<EventoCorporativo, 'tipo' | 'fator' | 'custo_unitario'>): Estado {
  if (e.quantidade <= 0) return e;
  if (ev.tipo === 'grupamento') {
    // Frações são leiloadas pela empresa; o custo total fica na posição inteira
    return { ...e, quantidade: Math.floor(e.quantidade * ev.fator + 1e-9) };
  }
  const novas = e.quantidade * ev.fator - e.quantidade;
  const custoExtra = ev.tipo === 'bonificacao' && ev.custo_unitario ? Math.floor(novas + 1e-9) * ev.custo_unitario : 0;
  const quantidade = ev.tipo === 'bonificacao' ? e.quantidade + Math.floor(novas + 1e-9) : e.quantidade * ev.fator;
  return { ...e, quantidade, custo: e.custo + custoExtra };
}

/**
 * Estado de cada ativo no fim do dia `data` (ou atual, se omitida):
 * lançamentos até `data`, inclusive, e eventos com data com anterior a `data`.
 */
export function estadoEm(
  lancamentos: Lancamento[],
  eventos: EventoCorporativo[],
  data?: string,
  ticker?: string,
): Map<string, Estado> {
  type Mov = { data: string; ordem: number; l?: Lancamento; ev?: EventoCorporativo };
  const movs: Mov[] = [];
  for (const l of ordenarLancamentos(lancamentos)) {
    if (ticker && l.ticker !== ticker) continue;
    if (data && l.data > data) continue;
    movs.push({ data: l.data, ordem: 0, l });
  }
  for (const ev of eventos) {
    if (ticker && ev.ticker !== ticker) continue;
    if (data && ev.data_com >= data) continue;
    movs.push({ data: ev.data_com, ordem: 1, ev });
  }
  movs.sort((a, b) => (a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.ordem - b.ordem));

  const estados = new Map<string, Estado>();
  for (const m of movs) {
    const t = m.l ? m.l.ticker : m.ev!.ticker;
    const atual = estados.get(t) ?? vazio();
    estados.set(t, m.l ? aplicarLancamento(atual, m.l) : aplicarEvento(atual, m.ev!));
  }
  return estados;
}

export function quantidadeEm(
  lancamentos: Lancamento[],
  eventos: EventoCorporativo[],
  ticker: string,
  data: string,
): number {
  return estadoEm(lancamentos, eventos, data, ticker).get(ticker)?.quantidade ?? 0;
}

// ---------------------------------------------------------------------------
// Posição atual
// ---------------------------------------------------------------------------

export interface Posicao {
  ticker: string;
  nome: string | null;
  classe: Classe;
  setor: string | null;
  quantidade: number;
  custo: number;
  precoMedio: number;
  cotacao: number | null;
  variacaoDia: number | null;
  valor: number;
  resultado: number;
  resultadoPct: number;
  realizado: number;
  peso: number;
}

export function calcularPosicoes(
  lancamentos: Lancamento[],
  eventos: EventoCorporativo[],
  ativos: Map<string, Ativo>,
  hoje: string,
): { abertas: Posicao[]; encerradas: Posicao[] } {
  // eventos já anunciados com data com hoje ou no futuro ainda não mudam a posição
  const estados = estadoEm(lancamentos, eventos.filter((e) => e.data_com < hoje));
  const todas: Posicao[] = [];
  for (const [ticker, e] of estados) {
    const a = ativos.get(ticker);
    const precoMedio = e.quantidade > 0 ? e.custo / e.quantidade : 0;
    const cotacao = a?.cotacao ?? null;
    const valor = e.quantidade * (cotacao ?? precoMedio);
    todas.push({
      ticker,
      nome: a?.nome ?? null,
      classe: a?.classe ?? 'acao',
      setor: a?.setor ?? null,
      quantidade: e.quantidade,
      custo: e.custo,
      precoMedio,
      cotacao,
      variacaoDia: a?.variacao_dia ?? null,
      valor,
      resultado: valor - e.custo,
      resultadoPct: e.custo > 0 ? (valor - e.custo) / e.custo : 0,
      realizado: e.realizado,
      peso: 0,
    });
  }
  const abertas = todas.filter((p) => p.quantidade > 1e-9);
  const total = abertas.reduce((s, p) => s + p.valor, 0);
  for (const p of abertas) p.peso = total > 0 ? p.valor / total : 0;
  abertas.sort((a, b) => b.valor - a.valor);
  return { abertas, encerradas: todas.filter((p) => p.quantidade <= 1e-9) };
}

export interface Resumo {
  patrimonio: number;
  investido: number;
  resultado: number;
  resultadoPct: number;
  realizado: number;
}

export function resumir(posicoes: Posicao[], encerradas: Posicao[] = []): Resumo {
  const patrimonio = posicoes.reduce((s, p) => s + p.valor, 0);
  const investido = posicoes.reduce((s, p) => s + p.custo, 0);
  return {
    patrimonio,
    investido,
    resultado: patrimonio - investido,
    resultadoPct: investido > 0 ? (patrimonio - investido) / investido : 0,
    realizado: [...posicoes, ...encerradas].reduce((s, p) => s + p.realizado, 0),
  };
}

// ---------------------------------------------------------------------------
// Prévia de um novo lançamento
// ---------------------------------------------------------------------------

export interface Previa {
  total: number;
  quantidadeAntes: number;
  quantidadeDepois: number;
  precoMedioAntes: number;
  precoMedioDepois: number;
  lucroRealizado: number;
  vendaMaiorQuePosicao: boolean;
}

export function previaLancamento(
  lancamentos: Lancamento[],
  eventos: EventoCorporativo[],
  novo: Pick<Lancamento, 'ticker' | 'tipo' | 'data' | 'quantidade' | 'preco' | 'taxas'>,
  ignorarId?: string,
): Previa {
  const outros = lancamentos.filter((l) => l.id !== ignorarId);
  const antes = estadoEm(outros, eventos, novo.data, novo.ticker).get(novo.ticker) ?? vazio();
  const depois = aplicarLancamento(antes, novo);
  const bruto = novo.quantidade * novo.preco;
  return {
    total: novo.tipo === 'compra' ? bruto + novo.taxas : bruto - novo.taxas,
    quantidadeAntes: antes.quantidade,
    quantidadeDepois: depois.quantidade,
    precoMedioAntes: antes.quantidade > 0 ? antes.custo / antes.quantidade : 0,
    precoMedioDepois: depois.quantidade > 0 ? depois.custo / depois.quantidade : 0,
    lucroRealizado: depois.realizado - antes.realizado,
    vendaMaiorQuePosicao: novo.tipo === 'venda' && novo.quantidade > antes.quantidade + 1e-9,
  };
}

// ---------------------------------------------------------------------------
// Proventos
// ---------------------------------------------------------------------------

export interface ProventoDoUsuario {
  provento: Provento;
  quantidade: number;
  bruto: number;
  liquido: number;
  recebido: boolean;
}

export function proventosDoUsuario(
  proventos: Provento[],
  lancamentos: Lancamento[],
  eventos: EventoCorporativo[],
  hoje: string,
): ProventoDoUsuario[] {
  const out: ProventoDoUsuario[] = [];
  for (const p of mesclarCorrecoes(proventos)) {
    const quantidade = quantidadeEm(lancamentos, eventos, p.ticker, p.data_com);
    if (quantidade <= 0) continue;
    const bruto = quantidade * p.valor_por_cota;
    out.push({
      provento: p,
      quantidade,
      bruto,
      liquido: p.tipo === 'jcp' ? bruto * (1 - IR_JCP) : bruto,
      recebido: !!p.data_pagamento && p.data_pagamento <= hoje,
    });
  }
  out.sort((a, b) => dataRef(b).localeCompare(dataRef(a)));
  return out;
}

const dataRef = (p: ProventoDoUsuario) => p.provento.data_pagamento ?? p.provento.data_com;

export interface MesProventos {
  mes: string; // AAAA-MM
  dividendo: number;
  jcp: number;
  rendimento: number;
  total: number;
}

export function proventosPorMes(itens: ProventoDoUsuario[], hoje: string, meses = 12): MesProventos[] {
  const lista: MesProventos[] = [];
  const [ano, mes] = hoje.split('-').map(Number);
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    lista.push({ mes: d.toISOString().slice(0, 7), dividendo: 0, jcp: 0, rendimento: 0, total: 0 });
  }
  const porMes = new Map(lista.map((m) => [m.mes, m]));
  for (const p of itens) {
    if (!p.recebido) continue;
    const m = porMes.get(p.provento.data_pagamento!.slice(0, 7));
    if (!m) continue;
    m[p.provento.tipo] += p.liquido;
    m.total += p.liquido;
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Distribuição
// ---------------------------------------------------------------------------

export type Agrupamento = 'classe' | 'setor' | 'ativo';

export function distribuicao(
  posicoes: Posicao[],
  por: Agrupamento,
  nomeClasse: Record<Classe, string>,
): { chave: string; valor: number; pct: number }[] {
  const m = new Map<string, number>();
  for (const p of posicoes) {
    const k = por === 'classe' ? nomeClasse[p.classe] : por === 'setor' ? p.setor || 'Sem setor' : p.ticker;
    m.set(k, (m.get(k) ?? 0) + p.valor);
  }
  const total = posicoes.reduce((s, p) => s + p.valor, 0);
  return [...m.entries()]
    .map(([chave, valor]) => ({ chave, valor, pct: total > 0 ? valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------------------
// Rentabilidade (método da cota / TWR) comparada com CDI e Ibovespa
// ---------------------------------------------------------------------------

export interface PontoRentabilidade {
  data: string;
  carteira: number; // acumulado desde o início da janela (0,05 = 5%)
  cdi: number | null;
  ibov: number | null;
}

/** Último valor com data <= d numa lista ordenada por data. */
function ultimoAte<T extends { data: string }>(lista: T[], d: string): T | undefined {
  let lo = 0;
  let hi = lista.length - 1;
  let achado: T | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lista[mid].data <= d) {
      achado = lista[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return achado;
}

export function serieRentabilidade(params: {
  lancamentos: Lancamento[];
  eventos: EventoCorporativo[];
  proventos: Provento[];
  precos: PrecoHistorico[];
  ativos: Map<string, Ativo>;
  indices: PontoIndice[];
  hoje: string;
  inicio?: string; // início da janela; omitido = desde o primeiro lançamento
}): PontoRentabilidade[] {
  const { lancamentos, eventos, precos, ativos, indices, hoje } = params;
  if (lancamentos.length === 0) return [];

  const lancs = ordenarLancamentos(lancamentos);
  const primeira = lancs[0].data;
  const tickers = new Set(lancs.map((l) => l.ticker));

  const precosPorTicker = new Map<string, PrecoHistorico[]>();
  for (const p of precos) {
    if (!tickers.has(p.ticker)) continue;
    if (!precosPorTicker.has(p.ticker)) precosPorTicker.set(p.ticker, []);
    precosPorTicker.get(p.ticker)!.push(p);
  }
  for (const l of precosPorTicker.values()) l.sort((a, b) => a.data.localeCompare(b.data));

  // Dias com algum dado: pregões com preço, dias de lançamento e hoje
  const datas = new Set<string>([hoje]);
  for (const l of lancs) datas.add(l.data);
  for (const l of precosPorTicker.values()) for (const p of l) if (p.data >= primeira && p.data <= hoje) datas.add(p.data);
  const dias = [...datas].filter((d) => d >= primeira && d <= hoje).sort();

  const proventosUsuario = proventosDoUsuario(params.proventos, lancamentos, eventos, hoje);
  const proventosPorDia = new Map<string, number>();
  for (const p of proventosUsuario) {
    if (!p.recebido) continue;
    const d = p.provento.data_pagamento!;
    proventosPorDia.set(d, (proventosPorDia.get(d) ?? 0) + p.liquido);
  }

  // último preço pago em lançamento, como reserva quando não há histórico
  const ultimoPrecoLanc = new Map<string, { data: string; fechamento: number }[]>();
  for (const l of lancs) {
    if (!ultimoPrecoLanc.has(l.ticker)) ultimoPrecoLanc.set(l.ticker, []);
    ultimoPrecoLanc.get(l.ticker)!.push({ data: l.data, fechamento: l.preco });
  }

  const preco = (t: string, d: string, e: Estado): number => {
    if (d === hoje && ativos.get(t)?.cotacao) return ativos.get(t)!.cotacao!;
    const h = precosPorTicker.get(t);
    const p = h && ultimoAte(h, d);
    if (p) return p.fechamento;
    const u = ultimoAte(ultimoPrecoLanc.get(t) ?? [], d);
    if (u) return u.fechamento;
    return e.quantidade > 0 ? e.custo / e.quantidade : 0;
  };

  const cota: { data: string; cota: number }[] = [];
  let cotaAtual = 1;
  let valorAnterior = 0;
  for (const d of dias) {
    const estados = estadoEm(lancs, eventos, d);
    let valor = 0;
    for (const [t, e] of estados) if (e.quantidade > 0) valor += e.quantidade * preco(t, d, e);
    let fluxo = 0;
    for (const l of lancs) {
      if (l.data !== d) continue;
      fluxo += l.tipo === 'compra' ? l.quantidade * l.preco + l.taxas : -(l.quantidade * l.preco - l.taxas);
    }
    // Aportes e resgates no fim do dia, ao preço da operação; no primeiro dia o aporte é a base
    const renda = proventosPorDia.get(d) ?? 0;
    if (valorAnterior > 1e-6) cotaAtual *= (valor - fluxo + renda) / valorAnterior;
    else if (fluxo > 1e-6) cotaAtual *= (valor + renda) / fluxo;
    cota.push({ data: d, cota: cotaAtual });
    valorAnterior = valor;
  }

  const inicio = params.inicio && params.inicio > primeira ? params.inicio : primeira;
  const base = ultimoAte(cota, inicio) ?? cota[0];
  const janela = cota.filter((c) => c.data >= base.data);

  const cdi = indices.filter((i) => i.serie === 'CDI').sort((a, b) => a.data.localeCompare(b.data));
  const ibov = indices.filter((i) => i.serie === 'IBOV').sort((a, b) => a.data.localeCompare(b.data));
  const ibovBase = ultimoAte(ibov, base.data);

  let fatorCdi = 1;
  let iCdi = cdi.findIndex((c) => c.data > base.data);
  if (iCdi < 0) iCdi = cdi.length;
  const temCdi = cdi.length > 0 && cdi[0].data <= base.data;

  return janela.map((c) => {
    while (iCdi < cdi.length && cdi[iCdi].data <= c.data) {
      fatorCdi *= 1 + cdi[iCdi].valor / 100;
      iCdi++;
    }
    const ib = ultimoAte(ibov, c.data);
    return {
      data: c.data,
      carteira: c.cota / base.cota - 1,
      cdi: temCdi ? fatorCdi - 1 : null,
      ibov: ibovBase && ib ? ib.valor / ibovBase.valor - 1 : null,
    };
  });
}

export function inicioPeriodo(hoje: string, periodo: '1M' | '6M' | '12M' | 'Tudo'): string | undefined {
  if (periodo === 'Tudo') return undefined;
  const meses = periodo === '1M' ? 1 : periodo === '6M' ? 6 : 12;
  const [a, m, d] = hoje.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1 - meses, d));
  return dt.toISOString().slice(0, 10);
}
