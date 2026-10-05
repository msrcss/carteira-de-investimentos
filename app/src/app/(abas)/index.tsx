import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { EstadoCarteira } from '../../components/EstadoCarteira';
import { GraficoLinhas, Legenda, Rosca } from '../../components/graficos';
import { Tela } from '../../components/Tela';
import { Botao, BotaoIcone, Cartao, Chips, Icones, Linha, Rotulo, T, Titulo, Vazio } from '../../components/ui';
import { useCarteira, useValor } from '../../contexto/Carteira';
import { useSessao } from '../../contexto/Sessao';
import { distribuicao, inicioPeriodo, serieRentabilidade, type Agrupamento } from '../../lib/carteira';
import { mesCurto, mesLongo, percentualSinal, percentual } from '../../lib/formato';
import { cores, corResultado, paleta } from '../../lib/tema';
import { NOME_CLASSE } from '../../lib/tipos';

type Periodo = '1M' | '6M' | '12M' | 'Tudo';

export default function Resumo() {
  const c = useCarteira();
  const { sessao } = useSessao();
  const { m, ms, ocultar } = useValor();
  const [periodo, setPeriodo] = useState<Periodo>('12M');
  const [agrupar, setAgrupar] = useState<Agrupamento>('classe');
  const [atualizando, setAtualizando] = useState(false);
  const nome = (sessao?.user.user_metadata?.nome as string | undefined)?.split(' ')[0];

  const serie = useMemo(
    () =>
      serieRentabilidade({
        lancamentos: c.dados.lancamentos,
        eventos: c.dados.eventos,
        proventos: c.dados.proventos,
        precos: c.dados.precos,
        ativos: c.dados.ativos,
        indices: c.dados.indices,
        hoje: c.hoje,
        inicio: inicioPeriodo(c.hoje, periodo),
      }),
    [c.dados, c.hoje, periodo],
  );
  const fim = serie[serie.length - 1];
  const rotulosX = serie.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => mesCurto(serie[Math.round(f * (serie.length - 1))].data)) : [];

  const dist = useMemo(() => distribuicao(c.posicoes, agrupar, NOME_CLASSE), [c.posicoes, agrupar]);
  const corDe = (chave: string, i: number) => (agrupar === 'classe' ? (chave === 'FIIs' ? cores.fii : chave === 'Ações' ? cores.marca : paleta[i + 2]) : paleta[i % paleta.length]);
  const distVisivel = dist.slice(0, 6);
  const outros = dist.slice(6).reduce((s, d) => ({ valor: s.valor + d.valor, pct: s.pct + d.pct }), { valor: 0, pct: 0 });

  const mesAtual = c.hoje.slice(0, 7);
  const recebidosMes = c.proventos.filter((p) => p.recebido && p.provento.data_pagamento!.startsWith(mesAtual));
  const aReceber = c.proventos.filter((p) => !p.recebido);

  const comCotacao = c.posicoes.filter((p) => p.cotacao != null);
  const maiorAlta = [...comCotacao].sort((a, b) => b.resultadoPct - a.resultadoPct)[0];
  const maiorBaixa = [...comCotacao].sort((a, b) => a.resultadoPct - b.resultadoPct)[0];

  async function atualizar() {
    setAtualizando(true);
    const aviso = await c.sincronizar();
    setAtualizando(false);
    if (aviso) Alert.alert('Cotações', aviso);
  }

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Linha>
        <View style={{ gap: 2, flex: 1 }}>
          <Rotulo>{nome ? `Olá, ${nome}` : 'Olá'}</Rotulo>
          <Pressable onPress={() => router.push('/carteiras')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="button" accessibilityLabel="Trocar carteira">
            <T peso="extra" tam={22} numberOfLines={1} style={{ flexShrink: 1 }}>
              {c.carteira?.nome ?? 'Minha carteira'}
            </T>
            <Icones.baixo tam={18} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BotaoIcone rotulo={ocultar ? 'Mostrar valores' : 'Ocultar valores'} onPress={c.alternarOcultar}>
            {ocultar ? <Icones.olhoFechado /> : <Icones.olho />}
          </BotaoIcone>
          <BotaoIcone rotulo="Conta" onPress={() => router.push('/conta')}>
            <Icones.usuario />
          </BotaoIcone>
        </View>
      </Linha>

      <EstadoCarteira />

      {!c.carregando && !c.erro && c.dados.lancamentos.length === 0 ? (
        <Vazio
          titulo="Sua carteira está vazia"
          texto="Registre sua primeira compra ou importe o extrato de negociação da B3."
          acao={
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              <Botao rotulo="Novo lançamento" onPress={() => router.push('/lancamento/novo')} />
              <Botao rotulo="Importar planilha da B3" tipo="secundario" onPress={() => router.push('/importar')} />
            </View>
          }
        />
      ) : null}

      {!c.carregando && c.dados.lancamentos.length > 0 && (
        <>
          <View style={{ backgroundColor: cores.marca, borderRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ gap: 4 }}>
              <T tam={13} cor={cores.marcaClara}>
                Patrimônio
              </T>
              <T peso="extra" tam={34} cor="#FFFFFF" style={{ letterSpacing: -0.5 }} adjustsFontSizeToFit numberOfLines={1}>
                {m(c.resumo.patrimonio)}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: cores.marcaLinha }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T tam={12} cor={cores.marcaClara}>
                  Investido
                </T>
                <T peso="negrito" tam={16} cor="#FFFFFF">
                  {m(c.resumo.investido)}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T tam={12} cor={cores.marcaClara}>
                  Resultado
                </T>
                <T peso="negrito" tam={16} cor={c.resumo.resultado >= 0 ? cores.positivoNoVerde : '#FFC9C2'} numberOfLines={2}>
                  {ms(c.resumo.resultado)} · {percentualSinal(c.resumo.resultadoPct)}
                </T>
              </View>
            </View>
          </View>

          <Cartao style={{ gap: 14 }}>
            <Linha>
              <Titulo>Rentabilidade</Titulo>
              <Chips pequeno valor={periodo} onChange={setPeriodo} opcoes={(['1M', '6M', '12M', 'Tudo'] as const).map((v) => ({ v, r: v }))} />
            </Linha>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { r: 'Carteira', v: fim?.carteira, cor: cores.marca },
                { r: 'CDI', v: fim?.cdi, cor: cores.cdi },
                { r: 'Ibovespa', v: fim?.ibov, cor: cores.ibov, tracejada: true },
              ].map((x) => (
                <View key={x.r} style={{ flex: 1, gap: 2 }}>
                  <Legenda cor={x.cor} rotulo={x.r} tracejada={x.tracejada} />
                  <T peso="extra" tam={17} cor={x.r === 'Carteira' && x.v != null ? corResultado(x.v) : cores.texto}>
                    {x.v == null ? '—' : percentualSinal(x.v)}
                  </T>
                </View>
              ))}
            </View>
            <GraficoLinhas
              descricao={`Rentabilidade no período: carteira ${percentual(fim?.carteira)}, CDI ${percentual(fim?.cdi)}, Ibovespa ${percentual(fim?.ibov)}`}
              rotulosX={rotulosX}
              series={[
                { valores: serie.map((p) => p.ibov), cor: cores.ibov, tracejada: true },
                { valores: serie.map((p) => p.cdi), cor: cores.cdi },
                { valores: serie.map((p) => p.carteira), cor: cores.marca, espessura: 2.5 },
              ]}
            />
          </Cartao>

          <Cartao>
            <Linha>
              <Titulo>Proventos</Titulo>
              <Link href="/proventos">
                <T peso="negrito" tam={13} cor={cores.marca}>
                  Ver todos
                </T>
              </Link>
            </Linha>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: cores.fundo, borderRadius: 12, padding: 12, gap: 4 }}>
                <Rotulo>Recebidos em {mesLongo(c.hoje)}</Rotulo>
                <T peso="extra" tam={18}>
                  {m(recebidosMes.reduce((s, p) => s + p.liquido, 0))}
                </T>
              </View>
              <View style={{ flex: 1, backgroundColor: cores.fundo, borderRadius: 12, padding: 12, gap: 4 }}>
                <Rotulo>A receber</Rotulo>
                <T peso="extra" tam={18}>
                  {m(aReceber.reduce((s, p) => s + p.liquido, 0))}
                </T>
                <T tam={12} cor={cores.textoSuave}>
                  {aReceber.length} {aReceber.length === 1 ? 'pagamento' : 'pagamentos'}
                </T>
              </View>
            </View>
          </Cartao>

          {c.posicoes.length > 0 && (
            <Cartao style={{ gap: 14 }}>
              <Linha>
                <Titulo>Distribuição</Titulo>
                <Chips
                  pequeno
                  valor={agrupar}
                  onChange={setAgrupar}
                  opcoes={[
                    { v: 'classe', r: 'Classe' },
                    { v: 'setor', r: 'Setor' },
                    { v: 'ativo', r: 'Ativo' },
                  ]}
                />
              </Linha>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Rosca
                  descricao={dist.map((d) => `${d.chave} ${percentual(d.pct)}`).join(', ')}
                  fatias={[...distVisivel.map((d, i) => ({ valor: d.valor, cor: corDe(d.chave, i) })), { valor: outros.valor, cor: cores.borda }]}
                  linha1={`${c.posicoes.length} ${c.posicoes.length === 1 ? 'ativo' : 'ativos'}`}
                  linha2={agrupar === 'classe' ? `${dist.length} ${dist.length === 1 ? 'classe' : 'classes'}` : agrupar === 'setor' ? `${dist.length} setores` : ''}
                />
                <View style={{ flex: 1, gap: 10 }}>
                  {distVisivel.map((d, i) => (
                    <View key={d.chave} style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: corDe(d.chave, i) }} />
                        <T peso="negrito" style={{ flex: 1 }} numberOfLines={1}>
                          {d.chave}
                        </T>
                        <T peso="negrito">{percentual(d.pct)}</T>
                      </View>
                      <T tam={12} cor={cores.textoSuave} style={{ paddingLeft: 18 }}>
                        {m(d.valor)}
                      </T>
                    </View>
                  ))}
                  {outros.valor > 0 && (
                    <T tam={12} cor={cores.textoSuave}>
                      Outros · {percentual(outros.pct)}
                    </T>
                  )}
                </View>
              </View>
            </Cartao>
          )}

          {maiorAlta && maiorBaixa && comCotacao.length > 1 && (
            <Cartao style={{ gap: 4 }}>
              <Titulo>Destaques</Titulo>
              {[
                { r: 'Maior alta', p: maiorAlta },
                { r: 'Maior baixa', p: maiorBaixa },
              ].map((x) => (
                <Pressable
                  key={x.r}
                  onPress={() => router.push(`/ativo/${x.p.ticker}`)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.bordaSuave }}
                >
                  <T peso="negrito">
                    {x.r} · {x.p.ticker}
                  </T>
                  <T peso="negrito" cor={corResultado(x.p.resultadoPct)}>
                    {percentualSinal(x.p.resultadoPct)}
                  </T>
                </Pressable>
              ))}
            </Cartao>
          )}
        </>
      )}
    </Tela>
  );
}
