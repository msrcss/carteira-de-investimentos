// Leitura e gravação no Supabase. O app nunca chama as fontes de mercado direto:
// lê o que o serviço de sincronização (supabase/functions/sync) gravou no banco.

import { supabase } from './supabase';
import type {
  Ativo,
  Carteira,
  Classe,
  EventoCorporativo,
  Lancamento,
  PontoIndice,
  PrecoHistorico,
  Provento,
} from './tipos';

const PAGINA = 1000; // limite padrão de linhas por consulta no Supabase

async function paginar<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < PAGINA) return todos;
  }
}

const num = (v: unknown) => (v == null ? null : Number(v));

const ativoDe = (r: Record<string, unknown>): Ativo => ({
  ticker: r.ticker as string,
  nome: (r.nome as string) ?? null,
  classe: r.classe as Classe,
  setor: (r.setor as string) ?? null,
  cotacao: num(r.cotacao),
  variacao_dia: num(r.variacao_dia),
  cotacao_em: (r.cotacao_em as string) ?? null,
  indicadores: (r.indicadores as Ativo['indicadores']) ?? {},
});

export interface DadosCarteira {
  lancamentos: Lancamento[];
  ativos: Map<string, Ativo>;
  proventos: Provento[];
  eventos: EventoCorporativo[];
  precos: PrecoHistorico[];
  indices: PontoIndice[];
}

export async function listarCarteiras(): Promise<Carteira[]> {
  const { data, error } = await supabase.from('carteiras').select('id, nome').order('criado_em');
  if (error) throw error;
  return data ?? [];
}

export async function criarCarteira(nome: string): Promise<Carteira> {
  const { data, error } = await supabase.from('carteiras').insert({ nome }).select('id, nome').single();
  if (error) throw error;
  return data;
}

export async function renomearCarteira(id: string, nome: string) {
  const { error } = await supabase.from('carteiras').update({ nome }).eq('id', id);
  if (error) throw error;
}

export async function excluirCarteira(id: string) {
  const { error } = await supabase.from('carteiras').delete().eq('id', id);
  if (error) throw error;
}

export async function carregarCarteira(carteiraId: string): Promise<DadosCarteira> {
  const lancRaw = await paginar<Record<string, unknown>>((de, ate) =>
    supabase.from('lancamentos').select('*').eq('carteira_id', carteiraId).order('data').range(de, ate),
  );
  const lancamentos: Lancamento[] = lancRaw.map((r) => ({
    id: r.id as string,
    carteira_id: r.carteira_id as string,
    ticker: r.ticker as string,
    tipo: r.tipo as Lancamento['tipo'],
    data: r.data as string,
    quantidade: Number(r.quantidade),
    preco: Number(r.preco),
    taxas: Number(r.taxas),
    origem: r.origem as Lancamento['origem'],
  }));
  const tickers = [...new Set(lancamentos.map((l) => l.ticker))];
  if (tickers.length === 0) {
    return { lancamentos, ativos: new Map(), proventos: [], eventos: [], precos: [], indices: [] };
  }
  const inicio = lancamentos[0].data;

  const [ativosR, proventosR, eventosR, precosR, indicesR] = await Promise.all([
    supabase.from('ativos').select('*').in('ticker', tickers),
    paginar<Record<string, unknown>>((de, ate) => supabase.from('proventos').select('*').in('ticker', tickers).order('data_com').range(de, ate)),
    supabase.from('eventos_corporativos').select('*').in('ticker', tickers).order('data_com'),
    paginar<Record<string, unknown>>((de, ate) =>
      supabase.from('precos_historicos').select('ticker, data, fechamento').in('ticker', tickers).gte('data', inicio).order('data').order('ticker').range(de, ate),
    ),
    paginar<Record<string, unknown>>((de, ate) =>
      supabase.from('indices').select('serie, data, valor').gte('data', inicio).order('data').order('serie').range(de, ate),
    ),
  ]);
  if (ativosR.error) throw ativosR.error;
  if (eventosR.error) throw eventosR.error;

  return {
    lancamentos,
    ativos: new Map((ativosR.data ?? []).map((r) => [r.ticker as string, ativoDe(r)])),
    proventos: proventosR.map((r) => ({
      id: r.id as string,
      user_id: (r.user_id as string) ?? null,
      ticker: r.ticker as string,
      tipo: r.tipo as Provento['tipo'],
      valor_por_cota: Number(r.valor_por_cota),
      data_com: r.data_com as string,
      data_pagamento: (r.data_pagamento as string) ?? null,
      fonte: r.fonte as Provento['fonte'],
    })),
    eventos: (eventosR.data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id ?? null,
      ticker: r.ticker,
      tipo: r.tipo,
      fator: Number(r.fator),
      custo_unitario: num(r.custo_unitario),
      data_com: r.data_com,
      fonte: r.fonte,
    })),
    precos: precosR.map((r) => ({ ticker: r.ticker as string, data: r.data as string, fechamento: Number(r.fechamento) })),
    indices: indicesR.map((r) => ({ serie: r.serie as PontoIndice['serie'], data: r.data as string, valor: Number(r.valor) })),
  };
}

export async function buscarAtivos(termo: string): Promise<Ativo[]> {
  const t = termo.trim().toUpperCase();
  if (!t) return [];
  const { data, error } = await supabase
    .from('ativos')
    .select('*')
    .or(`ticker.ilike.${t}%,nome.ilike.%${t.replace(/[,()%]/g, '')}%`)
    .order('ticker')
    .limit(8);
  if (error) throw error;
  return (data ?? []).map(ativoDe);
}

export async function registrarAtivo(ticker: string, classe: Classe): Promise<Ativo> {
  const { data, error } = await supabase.rpc('registrar_ativo', { p_ticker: ticker, p_classe: classe });
  if (error) throw error;
  return ativoDe(data as Record<string, unknown>);
}

export type NovoLancamento = Omit<Lancamento, 'id' | 'origem'> & { origem?: Lancamento['origem']; chave_importacao?: string };

export async function salvarLancamento(l: NovoLancamento, id?: string) {
  const { error } = id ? await supabase.from('lancamentos').update(l).eq('id', id) : await supabase.from('lancamentos').insert(l);
  if (error) throw error;
}

export async function excluirLancamento(id: string) {
  const { error } = await supabase.from('lancamentos').delete().eq('id', id);
  if (error) throw error;
}

/** Grava as linhas importadas; as que já existem (mesma chave) são ignoradas. Retorna quantas entraram. */
export async function importarLancamentos(linhas: NovoLancamento[]): Promise<number> {
  let novas = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const { data, error } = await supabase
      .from('lancamentos')
      .upsert(linhas.slice(i, i + 500), { onConflict: 'carteira_id,chave_importacao', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    novas += data?.length ?? 0;
  }
  return novas;
}

export async function chavesImportadas(carteiraId: string): Promise<Set<string>> {
  const linhas = await paginar<{ chave_importacao: string | null }>((de, ate) =>
    supabase.from('lancamentos').select('chave_importacao').eq('carteira_id', carteiraId).not('chave_importacao', 'is', null).range(de, ate),
  );
  return new Set(linhas.map((l) => l.chave_importacao!));
}

export async function salvarProvento(p: Omit<Provento, 'id' | 'user_id' | 'fonte'>, userId: string, id?: string) {
  const linha = { ...p, user_id: userId, fonte: 'manual' as const };
  const { error } = id ? await supabase.from('proventos').update(linha).eq('id', id) : await supabase.from('proventos').insert(linha);
  if (error) throw error;
}

export async function excluirProvento(id: string) {
  const { error } = await supabase.from('proventos').delete().eq('id', id);
  if (error) throw error;
}

export async function salvarEvento(e: Omit<EventoCorporativo, 'id' | 'user_id' | 'fonte'>, userId: string, id?: string) {
  const linha = { ...e, user_id: userId, fonte: 'manual' as const };
  const { error } = id
    ? await supabase.from('eventos_corporativos').update(linha).eq('id', id)
    : await supabase.from('eventos_corporativos').insert(linha);
  if (error) throw error;
}

export async function excluirEvento(id: string) {
  const { error } = await supabase.from('eventos_corporativos').delete().eq('id', id);
  if (error) throw error;
}

/** Pede ao serviço de sincronização para atualizar cotações e proventos desses ativos agora. */
export async function sincronizarAgora(tickers: string[]): Promise<void> {
  const { error } = await supabase.functions.invoke('sync', { body: { tickers } });
  if (error) throw error;
}
