export type Classe = 'acao' | 'fii' | 'etf' | 'bdr';
export type TipoLancamento = 'compra' | 'venda';
export type TipoProvento = 'dividendo' | 'jcp' | 'rendimento';
export type TipoEvento = 'desdobramento' | 'grupamento' | 'bonificacao';

export interface Carteira {
  id: string;
  nome: string;
}

export interface Indicadores {
  dy?: number | null;
  pl?: number | null;
  pvp?: number | null;
  roe?: number | null;
  vacancia?: number | null;
}

export interface Ativo {
  ticker: string;
  nome: string | null;
  classe: Classe;
  setor: string | null;
  cotacao: number | null;
  variacao_dia: number | null;
  cotacao_em: string | null;
  indicadores: Indicadores;
}

export interface Lancamento {
  id: string;
  carteira_id: string;
  ticker: string;
  tipo: TipoLancamento;
  data: string; // AAAA-MM-DD
  quantidade: number;
  preco: number;
  taxas: number;
  origem: 'manual' | 'b3';
}

export interface Provento {
  id: string;
  user_id: string | null;
  ticker: string;
  tipo: TipoProvento;
  valor_por_cota: number;
  data_com: string;
  data_pagamento: string | null;
  fonte: 'b3' | 'manual';
}

export interface EventoCorporativo {
  id: string;
  user_id: string | null;
  ticker: string;
  tipo: TipoEvento;
  fator: number;
  custo_unitario: number | null;
  data_com: string;
  fonte: 'b3' | 'manual';
}

export interface PrecoHistorico {
  ticker: string;
  data: string;
  fechamento: number;
}

export interface PontoIndice {
  serie: 'CDI' | 'IBOV';
  data: string;
  valor: number;
}

export const NOME_CLASSE: Record<Classe, string> = {
  acao: 'Ações',
  fii: 'FIIs',
  etf: 'ETFs',
  bdr: 'BDRs',
};

export const NOME_PROVENTO: Record<TipoProvento, string> = {
  dividendo: 'Dividendo',
  jcp: 'JCP',
  rendimento: 'Rendimento',
};

export const NOME_EVENTO: Record<TipoEvento, string> = {
  desdobramento: 'Desdobramento',
  grupamento: 'Grupamento',
  bonificacao: 'Bonificação',
};
