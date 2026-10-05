import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GraficoLinhas } from '../../components/graficos';
import { Cabecalho, Tela } from '../../components/Tela';
import { Botao, Cartao, Chips, Linha, Rotulo, Selo, T, Titulo } from '../../components/ui';
import { useCarteira, useValor } from '../../contexto/Carteira';
import { inicioPeriodo } from '../../lib/carteira';
import { dataBR, mesCurto, moeda, numero, percentual, percentualSinal, quantidade } from '../../lib/formato';
import { cores, corResultado } from '../../lib/tema';
import { NOME_CLASSE, NOME_EVENTO, NOME_PROVENTO } from '../../lib/tipos';

type Periodo = '1M' | '6M' | '12M' | 'Tudo';

export default function AtivoTela() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const c = useCarteira();
  const { m, ms } = useValor();
  const [periodo, setPeriodo] = useState<Periodo>('6M');
  const ativo = c.dados.ativos.get(ticker);
  const posicao = c.posicoes.find((p) => p.ticker === ticker) ?? c.encerradas.find((p) => p.ticker === ticker);
  const lancs = c.dados.lancamentos.filter((l) => l.ticker === ticker).reverse();
  const provs = c.proventos.filter((p) => p.provento.ticker === ticker);
  const eventos = c.dados.eventos.filter((e) => e.ticker === ticker).sort((a, b) => b.data_com.localeCompare(a.data_com));
  const fii = ativo?.classe === 'fii';

  const historico = useMemo(() => {
    const inicio = inicioPeriodo(c.hoje, periodo) ?? '0000';
    const h = c.dados.precos.filter((p) => p.ticker === ticker && p.data >= inicio);
    if (ativo?.cotacao && (!h.length || h[h.length - 1].data < c.hoje)) h.push({ ticker, data: c.hoje, fechamento: ativo.cotacao });
    return h;
  }, [c.dados.precos, c.hoje, periodo, ticker, ativo?.cotacao]);
  const rotulosX = historico.length > 1 ? [0, 0.5, 1].map((f) => mesCurto(historico[Math.round(f * (historico.length - 1))].data)) : [];
  const ind = ativo?.indicadores ?? {};
  const indicadores = fii
    ? [
        { r: 'P/VP', v: numero(ind.pvp) },
        { r: 'DY 12m', v: ind.dy != null ? percentual(ind.dy / 100) : '—' },
        { r: 'Vacância', v: ind.vacancia != null ? percentual(ind.vacancia / 100) : '—' },
      ]
    : [
        { r: 'DY 12m', v: ind.dy != null ? percentual(ind.dy / 100) : '—' },
        { r: 'P/L', v: numero(ind.pl) },
        { r: 'P/VP', v: numero(ind.pvp) },
      ];
  const proventos12m = provs.filter((p) => p.recebido && p.provento.data_pagamento! >= (inicioPeriodo(c.hoje, '12M') ?? '')).reduce((s, p) => s + p.liquido, 0);

  return (
    <Tela semAbas>
      <Cabecalho titulo={ticker} />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <T tam={14} cor={cores.textoSuave} numberOfLines={1} style={{ flexShrink: 1 }}>
            {ativo?.nome ?? 'Nome aparece após a próxima sincronização'}
          </T>
          {ativo && <Selo texto={NOME_CLASSE[ativo.classe]} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <T peso="extra" tam={30}>
            {moeda(ativo?.cotacao)}
          </T>
          {ativo?.variacao_dia != null && (
            <T peso="negrito" tam={15} cor={corResultado(ativo.variacao_dia)}>
              {percentualSinal(ativo.variacao_dia / 100)} hoje
            </T>
          )}
        </View>
        {ativo?.cotacao_em && (
          <T tam={12} cor={cores.textoSuave}>
            Atualizado em {dataBR(ativo.cotacao_em)} às {new Date(ativo.cotacao_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </T>
        )}
      </View>

      <Cartao>
        <Linha>
          <Titulo>Cotação</Titulo>
          <Chips pequeno valor={periodo} onChange={setPeriodo} opcoes={(['1M', '6M', '12M', 'Tudo'] as const).map((v) => ({ v, r: v }))} />
        </Linha>
        <GraficoLinhas incluirZero={false} descricao={`Histórico de preço de ${ticker}`} rotulosX={rotulosX} series={[{ valores: historico.map((h) => h.fechamento), cor: cores.marca, espessura: 2.5 }]} />
      </Cartao>

      <Cartao>
        <Titulo>Indicadores</Titulo>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {indicadores.map((i) => (
            <View key={i.r} style={{ flex: 1, backgroundColor: cores.fundo, borderRadius: 12, padding: 12, gap: 4 }}>
              <Rotulo>{i.r}</Rotulo>
              <T peso="extra" tam={17}>
                {i.v}
              </T>
            </View>
          ))}
        </View>
      </Cartao>

      {posicao && (
        <Cartao>
          <Titulo>Sua posição</Titulo>
          {[
            ['Quantidade', quantidade(posicao.quantidade)],
            ['Preço médio', moeda(posicao.precoMedio)],
            ['Custo', m(posicao.custo)],
            ['Valor atual', m(posicao.valor)],
          ].map(([r, v]) => (
            <Linha key={r}>
              <Rotulo>{r}</Rotulo>
              <T peso="negrito">{v}</T>
            </Linha>
          ))}
          <Linha>
            <Rotulo>Resultado</Rotulo>
            <T peso="negrito" cor={corResultado(posicao.resultado)}>
              {ms(posicao.resultado)} · {percentualSinal(posicao.resultadoPct)}
            </T>
          </Linha>
          {posicao.realizado !== 0 && (
            <Linha>
              <Rotulo>Lucro realizado</Rotulo>
              <T peso="negrito" cor={corResultado(posicao.realizado)}>
                {ms(posicao.realizado)}
              </T>
            </Linha>
          )}
          <Linha>
            <Rotulo>Peso na carteira</Rotulo>
            <T peso="negrito">{percentual(posicao.peso)}</T>
          </Linha>
          <Linha>
            <Rotulo>Proventos em 12 meses</Rotulo>
            <T peso="negrito">{m(proventos12m)}</T>
          </Linha>
        </Cartao>
      )}

      <Cartao style={{ gap: 4 }}>
        <Linha style={{ marginBottom: 6 }}>
          <Titulo>Suas operações</Titulo>
          <Pressable onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: 'novo', ticker } })}>
            <T peso="negrito" tam={13} cor={cores.marca}>
              + Lançar
            </T>
          </Pressable>
        </Linha>
        {lancs.length === 0 && <T cor={cores.textoSuave}>Nenhuma operação.</T>}
        {lancs.map((l) => (
          <Pressable key={l.id} onPress={() => router.push(`/lancamento/${l.id}`)} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.bordaSuave }}>
            <Linha>
              <T peso="negrito" cor={l.tipo === 'compra' ? cores.positivo : cores.negativo}>
                {l.tipo === 'compra' ? 'Compra' : 'Venda'} · {quantidade(l.quantidade)}
              </T>
              <T peso="negrito">{moeda(l.preco)}</T>
            </Linha>
            <T tam={12} cor={cores.textoSuave}>
              {dataBR(l.data)} · {l.origem === 'b3' ? 'importado da B3' : 'manual'}
            </T>
          </Pressable>
        ))}
      </Cartao>

      <Cartao style={{ gap: 4 }}>
        <Linha style={{ marginBottom: 6 }}>
          <Titulo>Proventos</Titulo>
          <Pressable onPress={() => router.push({ pathname: '/provento', params: { ticker } })}>
            <T peso="negrito" tam={13} cor={cores.marca}>
              + Lançar
            </T>
          </Pressable>
        </Linha>
        {provs.length === 0 && <T cor={cores.textoSuave}>Nenhum provento enquanto você tinha o ativo.</T>}
        {provs.slice(0, 12).map((p) => (
          <Pressable
            key={p.provento.id}
            onPress={() => p.provento.user_id && router.push({ pathname: '/provento', params: { id: p.provento.id } })}
            style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.bordaSuave }}
          >
            <Linha>
              <T peso="negrito">
                {NOME_PROVENTO[p.provento.tipo]} · {moeda(p.provento.valor_por_cota)}/cota
              </T>
              <T peso="negrito">{m(p.liquido)}</T>
            </Linha>
            <T tam={12} cor={cores.textoSuave}>
              Data com {dataBR(p.provento.data_com)} · {p.recebido ? 'pago' : 'paga'} em {dataBR(p.provento.data_pagamento)} · {p.provento.fonte === 'b3' ? 'B3' : 'manual'}
            </T>
          </Pressable>
        ))}
      </Cartao>

      <Cartao style={{ gap: 4 }}>
        <Linha style={{ marginBottom: 6 }}>
          <Titulo>Eventos corporativos</Titulo>
          <Pressable onPress={() => router.push({ pathname: '/evento', params: { ticker } })}>
            <T peso="negrito" tam={13} cor={cores.marca}>
              + Lançar
            </T>
          </Pressable>
        </Linha>
        {eventos.length === 0 && <T cor={cores.textoSuave}>Nenhum desdobramento, grupamento ou bonificação registrado.</T>}
        {eventos.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => e.user_id && router.push({ pathname: '/evento', params: { id: e.id } })}
            style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.bordaSuave }}
          >
            <Linha>
              <T peso="negrito">{NOME_EVENTO[e.tipo]}</T>
              <T peso="negrito">fator {numero(e.fator)}</T>
            </Linha>
            <T tam={12} cor={cores.textoSuave}>
              Data com {dataBR(e.data_com)} · {e.fonte === 'b3' ? 'B3' : 'manual'}
              {e.custo_unitario ? ` · custo ${moeda(e.custo_unitario)}` : ''}
            </T>
          </Pressable>
        ))}
        <T tam={12} cor={cores.textoSuave} style={{ marginTop: 6 }}>
          Eventos ajustam quantidade e preço médio a partir do dia seguinte à data com. Um evento lançado à mão com a mesma data substitui o da B3.
        </T>
      </Cartao>

      <Botao rotulo="Novo lançamento deste ativo" onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: 'novo', ticker } })} />
    </Tela>
  );
}
