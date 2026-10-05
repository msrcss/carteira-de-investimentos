/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerLinhasNegociacao } from '../importarB3';

test('lê o extrato de negociação da B3', () => {
  const r = lerLinhasNegociacao([
    { 'Data do Negócio': '02/10/2026', 'Tipo de Movimentação': 'Compra', Mercado: 'Mercado à Vista', 'Prazo/Vencimento': '-', Instituição: 'XP INVESTIMENTOS', 'Código de Negociação': 'PETR4', Quantidade: 100, Preço: 35.9, Valor: 3590 },
    { 'Data do Negócio': '02/10/2026', 'Tipo de Movimentação': 'Compra', Mercado: 'Mercado Fracionário', 'Prazo/Vencimento': '-', Instituição: 'XP INVESTIMENTOS', 'Código de Negociação': 'PETR4F', Quantidade: 5, Preço: '35,90', Valor: 179.5 },
    { 'Data do Negócio': '02/10/2026', 'Tipo de Movimentação': 'Compra', Mercado: 'Mercado à Vista', 'Prazo/Vencimento': '-', Instituição: 'XP INVESTIMENTOS', 'Código de Negociação': 'PETR4', Quantidade: 100, Preço: 35.9, Valor: 3590 },
    { 'Data do Negócio': '01/09/2026', 'Tipo de Movimentação': 'Venda', Mercado: 'Mercado à Vista', Instituição: 'XP', 'Código de Negociação': 'HGLG11', Quantidade: 3, Preço: 160 },
    { 'Data do Negócio': '01/09/2026', 'Tipo de Movimentação': 'Compra', Mercado: 'Opção de Compra', Instituição: 'XP', 'Código de Negociação': 'PETRJ400', Quantidade: 100, Preço: 1 },
    {},
  ]);
  assert.equal(r.linhas.length, 4);
  assert.equal(r.linhas[0].ticker, 'HGLG11');
  assert.equal(r.linhas[0].tipo, 'venda');
  assert.equal(r.linhas[0].data, '2026-09-01');
  assert.equal(r.linhas.filter((l) => l.ticker === 'PETR4').length, 3);
  const chaves = new Set(r.linhas.map((l) => l.chave));
  assert.equal(chaves.size, 4); // operações iguais no mesmo dia continuam distintas
  assert.equal(r.ignoradas.length, 1);
});
