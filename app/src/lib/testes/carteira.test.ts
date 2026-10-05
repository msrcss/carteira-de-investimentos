/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPosicoes,
  previaLancamento,
  proventosDoUsuario,
  proventosPorMes,
  quantidadeEm,
  resumir,
  serieRentabilidade,
} from '../carteira';
import type { Ativo, EventoCorporativo, Lancamento, Provento } from '../tipos';

let id = 0;
const L = (ticker: string, tipo: 'compra' | 'venda', data: string, quantidade: number, preco: number, taxas = 0): Lancamento => ({
  id: String(++id), carteira_id: 'c', ticker, tipo, data, quantidade, preco, taxas, origem: 'manual',
});
const ativo = (ticker: string, cotacao: number | null, classe: Ativo['classe'] = 'acao'): Ativo => ({
  ticker, nome: null, classe, setor: null, cotacao, variacao_dia: null, cotacao_em: null, indicadores: {},
});
const ev = (ticker: string, tipo: EventoCorporativo['tipo'], data_com: string, fator: number, custo_unitario: number | null = null, user_id: string | null = null): EventoCorporativo => ({
  id: String(++id), user_id, ticker, tipo, fator, custo_unitario, data_com, fonte: user_id ? 'manual' : 'b3',
});
const prov = (ticker: string, tipo: Provento['tipo'], data_com: string, data_pagamento: string | null, valor_por_cota: number, user_id: string | null = null): Provento => ({
  id: String(++id), user_id, ticker, tipo, valor_por_cota, data_com, data_pagamento, fonte: user_id ? 'manual' : 'b3',
});

test('preço médio com compras, taxas e venda parcial', () => {
  const lancs = [L('PETR4', 'compra', '2026-01-10', 100, 30, 10), L('PETR4', 'compra', '2026-02-10', 100, 40), L('PETR4', 'venda', '2026-03-10', 50, 45, 5)];
  const { abertas } = calcularPosicoes(lancs, [], new Map([['PETR4', ativo('PETR4', 50)]]), '2026-10-05');
  const p = abertas[0];
  assert.equal(p.quantidade, 150);
  assert.ok(Math.abs(p.precoMedio - 35.05) < 1e-9); // (3000+10+4000)/200
  assert.ok(Math.abs(p.realizado - (50 * 45 - 5 - 50 * 35.05)) < 1e-9);
  assert.equal(p.valor, 7500);
});

test('venda total encerra a posição', () => {
  const lancs = [L('ITUB4', 'compra', '2026-01-10', 10, 30), L('ITUB4', 'venda', '2026-02-10', 10, 33)];
  const { abertas, encerradas } = calcularPosicoes(lancs, [], new Map(), '2026-10-05');
  assert.equal(abertas.length, 0);
  assert.equal(encerradas[0].realizado, 30);
  assert.equal(resumir(abertas, encerradas).realizado, 30);
});

test('desdobramento, grupamento e bonificação ajustam quantidade e preço médio', () => {
  const lancs = [L('WEGE3', 'compra', '2026-01-10', 100, 40)];
  const eventos = [
    ev('WEGE3', 'desdobramento', '2026-02-01', 2), // 200 a 20
    ev('WEGE3', 'bonificacao', '2026-03-01', 1.1, 15), // +20 ações a 15
    ev('WEGE3', 'grupamento', '2026-04-01', 0.1), // 22 ações
  ];
  const { abertas } = calcularPosicoes(lancs, eventos, new Map(), '2026-10-05');
  assert.equal(abertas[0].quantidade, 22);
  assert.equal(abertas[0].custo, 4000 + 20 * 15);
  // na data com do desdobramento a quantidade ainda é a antiga
  assert.equal(quantidadeEm(lancs, eventos, 'WEGE3', '2026-02-01'), 100);
  assert.equal(quantidadeEm(lancs, eventos, 'WEGE3', '2026-02-02'), 200);
});

test('evento futuro não muda a posição de hoje', () => {
  const lancs = [L('WEGE3', 'compra', '2026-01-10', 100, 40)];
  const { abertas } = calcularPosicoes(lancs, [ev('WEGE3', 'desdobramento', '2026-12-01', 2)], new Map(), '2026-10-05');
  assert.equal(abertas[0].quantidade, 100);
});

test('evento manual corrige o da B3 com mesma data', () => {
  const lancs = [L('A1BC3', 'compra', '2026-01-10', 100, 10)];
  const p = [prov('A1BC3', 'dividendo', '2026-02-01', '2026-02-20', 1), prov('A1BC3', 'dividendo', '2026-02-01', '2026-02-20', 1.5, 'u')];
  const itens = proventosDoUsuario(p, lancs, [], '2026-10-05');
  assert.equal(itens.length, 1);
  assert.equal(itens[0].bruto, 150);
});

test('proventos: posição na data com, JCP líquido e a receber', () => {
  const lancs = [L('BBAS3', 'compra', '2026-01-10', 100, 25), L('BBAS3', 'compra', '2026-03-02', 100, 26)];
  const p = [
    prov('BBAS3', 'jcp', '2026-03-01', '2026-03-20', 0.5), // 100 ações
    prov('BBAS3', 'dividendo', '2026-03-02', '2026-03-25', 0.2), // compra no próprio dia conta: 200
    prov('BBAS3', 'dividendo', '2025-12-01', '2025-12-20', 1), // antes de ter
    prov('BBAS3', 'dividendo', '2026-09-30', '2026-11-10', 0.3), // a receber
  ];
  const itens = proventosDoUsuario(p, lancs, [], '2026-10-05');
  assert.equal(itens.length, 3);
  const jcp = itens.find((i) => i.provento.tipo === 'jcp')!;
  assert.equal(jcp.liquido, 42.5);
  assert.equal(itens.find((i) => i.provento.data_com === '2026-03-02')!.quantidade, 200);
  assert.equal(itens.filter((i) => !i.recebido).length, 1);
  const meses = proventosPorMes(itens, '2026-10-05');
  assert.equal(meses.length, 12);
  assert.equal(meses.find((m) => m.mes === '2026-03')!.total, 42.5 + 40);
});

test('prévia de compra e venda', () => {
  const lancs = [L('PETR4', 'compra', '2026-01-10', 150, 30.83)];
  const c = previaLancamento(lancs, [], { ticker: 'PETR4', tipo: 'compra', data: '2026-10-02', quantidade: 50, preco: 35.9, taxas: 0 });
  assert.equal(c.quantidadeDepois, 200);
  assert.ok(Math.abs(c.precoMedioDepois - (150 * 30.83 + 50 * 35.9) / 200) < 1e-9);
  const v = previaLancamento(lancs, [], { ticker: 'PETR4', tipo: 'venda', data: '2026-10-02', quantidade: 200, preco: 35, taxas: 0 });
  assert.equal(v.vendaMaiorQuePosicao, true);
});

test('rentabilidade pelo método da cota ignora aportes', () => {
  const lancs = [L('X1YZ3', 'compra', '2026-01-02', 100, 10), L('X1YZ3', 'compra', '2026-01-04', 100, 12)];
  const precos = [
    { ticker: 'X1YZ3', data: '2026-01-02', fechamento: 10 },
    { ticker: 'X1YZ3', data: '2026-01-03', fechamento: 11 },
    { ticker: 'X1YZ3', data: '2026-01-04', fechamento: 12 },
    { ticker: 'X1YZ3', data: '2026-01-05', fechamento: 13.2 },
  ];
  const indices = [
    { serie: 'CDI' as const, data: '2026-01-02', valor: 0.05 },
    { serie: 'CDI' as const, data: '2026-01-05', valor: 0.05 },
    { serie: 'IBOV' as const, data: '2026-01-02', valor: 100000 },
    { serie: 'IBOV' as const, data: '2026-01-05', valor: 101000 },
  ];
  const serie = serieRentabilidade({ lancamentos: lancs, eventos: [], proventos: [], precos, ativos: new Map(), indices, hoje: '2026-01-05' });
  const fim = serie[serie.length - 1];
  assert.ok(Math.abs(fim.carteira - 0.32) < 1e-9, String(fim.carteira)); // 10 -> 13,2
  assert.ok(Math.abs(fim.cdi! - 0.0005) < 1e-12);
  assert.ok(Math.abs(fim.ibov! - 0.01) < 1e-12);
});
