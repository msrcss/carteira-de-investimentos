import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { EstadoCarteira } from '../../components/EstadoCarteira';
import { Barras, Legenda } from '../../components/graficos';
import { Tela } from '../../components/Tela';
import { Botao, Cartao, Icones, Linha, Rotulo, T, Titulo, Vazio } from '../../components/ui';
import { useCarteira, useValor } from '../../contexto/Carteira';
import { inicioPeriodo, proventosPorMes, type ProventoDoUsuario } from '../../lib/carteira';
import { dataBR, mesCurto, mesLongo, moeda, percentual, quantidade } from '../../lib/formato';
import { cores } from '../../lib/tema';
import { NOME_PROVENTO } from '../../lib/tipos';

const COR_TIPO = { dividendo: cores.marca, jcp: cores.jcp, rendimento: cores.fii };

export default function Proventos() {
  const c = useCarteira();
  const { m } = useValor();
  const meses = useMemo(() => proventosPorMes(c.proventos, c.hoje), [c.proventos, c.hoje]);
  const inicio12 = inicioPeriodo(c.hoje, '12M')!;
  const recebidos12 = c.proventos.filter((p) => p.recebido && p.provento.data_pagamento! > inicio12);
  const total12 = recebidos12.reduce((s, p) => s + p.liquido, 0);
  const custo = c.posicoes.reduce((s, p) => s + p.custo, 0);
  const aReceber = c.proventos.filter((p) => !p.recebido).sort((a, b) => (a.provento.data_pagamento ?? '9999').localeCompare(b.provento.data_pagamento ?? '9999'));
  const mesAtual = c.hoje.slice(0, 7);
  const doMes = c.proventos.filter((p) => p.recebido && p.provento.data_pagamento!.startsWith(mesAtual));
  const ranking = useMemo(() => {
    const r = new Map<string, number>();
    for (const p of recebidos12) r.set(p.provento.ticker, (r.get(p.provento.ticker) ?? 0) + p.liquido);
    return [...r.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [recebidos12]);
  const tipos = [...new Set(recebidos12.map((p) => p.provento.tipo))];

  const linhaProvento = (p: ProventoDoUsuario, k: number) => (
    <Pressable
      key={p.provento.id}
      onPress={() => (p.provento.user_id ? router.push({ pathname: '/provento', params: { id: p.provento.id } }) : router.push(`/ativo/${p.provento.ticker}`))}
      style={{ paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderTopColor: cores.bordaSuave, gap: 2 }}
    >
      <Linha>
        <T peso="extra">
          {p.provento.ticker} · {NOME_PROVENTO[p.provento.tipo]}
        </T>
        <T peso="extra">{m(p.liquido)}</T>
      </Linha>
      <T tam={12} cor={cores.textoSuave}>
        {p.provento.data_pagamento ? `Pagamento ${dataBR(p.provento.data_pagamento)}` : 'Pagamento a definir'} · {quantidade(p.quantidade)} × {moeda(p.provento.valor_por_cota)}
        {p.provento.tipo === 'jcp' ? ' (líquido de IR)' : ''}
      </T>
    </Pressable>
  );

  return (
    <Tela>
      <Linha>
        <T peso="extra" tam={22}>
          Proventos
        </T>
        <Pressable onPress={() => router.push('/provento')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="button">
          <Icones.mais tam={16} cor={cores.marca} />
          <T peso="negrito" cor={cores.marca}>
            Lançar
          </T>
        </Pressable>
      </Linha>
      <EstadoCarteira />
      {!c.carregando && !c.erro && c.proventos.length === 0 ? (
        <Vazio
          titulo="Nenhum provento ainda"
          texto="Dividendos, JCP e rendimentos aparecem aqui automaticamente pela sua posição na data com. Se faltar algum, lance à mão."
          acao={<Botao rotulo="Lançar provento" tipo="secundario" onPress={() => router.push('/provento')} style={{ alignSelf: 'stretch' }} />}
        />
      ) : null}
      {c.proventos.length > 0 && (
        <>
          <View style={{ backgroundColor: cores.marca, borderRadius: 20, padding: 20, gap: 14 }}>
            <View style={{ gap: 4 }}>
              <T tam={13} cor={cores.marcaClara}>
                Recebidos em 12 meses
              </T>
              <T peso="extra" tam={30} cor="#FFFFFF">
                {m(total12)}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: cores.marcaLinha }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T tam={12} cor={cores.marcaClara}>
                  Média mensal
                </T>
                <T peso="negrito" tam={16} cor="#FFFFFF">
                  {m(total12 / 12)}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T tam={12} cor={cores.marcaClara}>
                  Yield on cost
                </T>
                <T peso="negrito" tam={16} cor="#FFFFFF">
                  {custo > 0 ? percentual(total12 / custo) : '—'}
                </T>
              </View>
            </View>
          </View>

          <Cartao>
            <Titulo>Por mês</Titulo>
            <Barras
              descricao={`Proventos por mês nos últimos 12 meses, total ${moeda(total12)}`}
              grupos={meses.map((mm) => ({
                rotulo: mesCurto(mm.mes + '-01').slice(0, 3),
                partes: [
                  { valor: mm.dividendo, cor: COR_TIPO.dividendo },
                  { valor: mm.jcp, cor: COR_TIPO.jcp },
                  { valor: mm.rendimento, cor: COR_TIPO.rendimento },
                ],
              }))}
            />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {tipos.map((t) => (
                <Legenda key={t} cor={COR_TIPO[t]} rotulo={NOME_PROVENTO[t]} />
              ))}
            </View>
          </Cartao>

          <Cartao style={{ gap: 0 }}>
            <Linha style={{ marginBottom: 8 }}>
              <Titulo>A receber</Titulo>
              <T peso="extra">{m(aReceber.reduce((s, p) => s + p.liquido, 0))}</T>
            </Linha>
            {aReceber.length === 0 ? <T cor={cores.textoSuave}>Nenhum pagamento anunciado.</T> : aReceber.map(linhaProvento)}
          </Cartao>

          <Cartao style={{ gap: 0 }}>
            <Linha style={{ marginBottom: 8 }}>
              <Titulo>Recebidos em {mesLongo(c.hoje)}</Titulo>
              <T peso="extra">{m(doMes.reduce((s, p) => s + p.liquido, 0))}</T>
            </Linha>
            {doMes.length === 0 ? <T cor={cores.textoSuave}>Nada recebido neste mês ainda.</T> : doMes.map(linhaProvento)}
          </Cartao>

          {ranking.length > 0 && (
            <Cartao>
              <Titulo>Ranking em 12 meses</Titulo>
              {ranking.map(([t, v]) => (
                <View key={t} style={{ gap: 4 }}>
                  <Linha>
                    <T peso="negrito">{t}</T>
                    <T peso="negrito">{m(v)}</T>
                  </Linha>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: cores.bordaSuave }}>
                    <View style={{ height: 6, borderRadius: 3, width: `${(v / ranking[0][1]) * 100}%`, backgroundColor: cores.marca }} />
                  </View>
                </View>
              ))}
              <Rotulo>JCP já descontado de 15% de IR.</Rotulo>
            </Cartao>
          )}
        </>
      )}
    </Tela>
  );
}
