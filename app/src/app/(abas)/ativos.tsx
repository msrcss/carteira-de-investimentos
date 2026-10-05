import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { EstadoCarteira } from '../../components/EstadoCarteira';
import { Tela } from '../../components/Tela';
import { Botao, Cartao, Chips, Icones, Linha, T, Vazio } from '../../components/ui';
import { useCarteira, useValor } from '../../contexto/Carteira';
import type { Posicao } from '../../lib/carteira';
import { moeda, percentual, percentualSinal, quantidade } from '../../lib/formato';
import { cores, corResultado, fonte } from '../../lib/tema';
import { NOME_CLASSE, type Classe } from '../../lib/tipos';

type Ordem = 'valor' | 'resultado' | 'codigo';

export default function Ativos() {
  const c = useCarteira();
  const { m, ms } = useValor();
  const [busca, setBusca] = useState('');
  const [classe, setClasse] = useState<'todas' | Classe>('todas');
  const [ordem, setOrdem] = useState<Ordem>('valor');
  const [atualizando, setAtualizando] = useState(false);

  const classes = [...new Set(c.posicoes.map((p) => p.classe))];
  const grupos = useMemo(() => {
    const t = busca.trim().toUpperCase();
    const filtradas = c.posicoes
      .filter((p) => classe === 'todas' || p.classe === classe)
      .filter((p) => !t || p.ticker.includes(t) || (p.nome ?? '').toUpperCase().includes(t))
      .sort((a, b) => (ordem === 'resultado' ? b.resultadoPct - a.resultadoPct : ordem === 'codigo' ? a.ticker.localeCompare(b.ticker) : b.valor - a.valor));
    const porClasse = new Map<Classe, Posicao[]>();
    for (const p of filtradas) porClasse.set(p.classe, [...(porClasse.get(p.classe) ?? []), p]);
    return [...porClasse.entries()];
  }, [c.posicoes, busca, classe, ordem]);

  return (
    <Tela
      atualizando={atualizando}
      onAtualizar={async () => {
        setAtualizando(true);
        await c.sincronizar();
        setAtualizando(false);
      }}
    >
      <T peso="extra" tam={22}>
        Ativos
      </T>
      <EstadoCarteira />
      {!c.carregando && c.posicoes.length === 0 && !c.erro ? (
        <Vazio titulo="Nenhum ativo em carteira" texto="Seus ativos aparecem aqui depois do primeiro lançamento." acao={<Botao rotulo="Novo lançamento" onPress={() => router.push('/lancamento/novo')} style={{ alignSelf: 'stretch' }} />} />
      ) : null}
      {c.posicoes.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderWidth: 1, borderColor: cores.bordaCampo, borderRadius: 12, paddingHorizontal: 14, backgroundColor: cores.cartao }}>
            <Icones.busca tam={18} cor={cores.textoSuave} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar ativo"
              placeholderTextColor="#9AA39E"
              autoCapitalize="characters"
              style={{ flex: 1, fontFamily: fonte.semi, fontSize: 16, color: cores.texto }}
            />
          </View>
          <Chips
            valor={classe}
            onChange={setClasse}
            opcoes={[{ v: 'todas' as const, r: 'Todas' }, ...classes.map((k) => ({ v: k, r: NOME_CLASSE[k] }))]}
          />
          <Linha>
            <T tam={12} cor={cores.textoSuave}>
              Ordenar por
            </T>
            <Chips
              pequeno
              valor={ordem}
              onChange={setOrdem}
              opcoes={[
                { v: 'valor', r: 'Valor' },
                { v: 'resultado', r: 'Resultado' },
                { v: 'codigo', r: 'Código' },
              ]}
            />
          </Linha>
          {grupos.map(([k, lista]) => {
            const total = lista.reduce((s, p) => s + p.valor, 0);
            return (
              <View key={k} style={{ gap: 8 }}>
                <Linha>
                  <T peso="extra" tam={15}>
                    {NOME_CLASSE[k]}
                  </T>
                  <T tam={13} cor={cores.textoSuave}>
                    {m(total)}
                  </T>
                </Linha>
                <Cartao style={{ padding: 0, gap: 0 }}>
                  {lista.map((p, i) => (
                    <Pressable
                      key={p.ticker}
                      onPress={() => router.push(`/ativo/${p.ticker}`)}
                      style={({ pressed }) => ({ padding: 14, gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: cores.bordaSuave, backgroundColor: pressed ? cores.fundo : 'transparent' })}
                    >
                      <Linha>
                        <View style={{ flex: 1 }}>
                          <T peso="extra" tam={15}>
                            {p.ticker}
                          </T>
                          <T tam={12} cor={cores.textoSuave} numberOfLines={1}>
                            {quantidade(p.quantidade)} × PM {moeda(p.precoMedio)}
                          </T>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <T peso="extra" tam={15}>
                            {m(p.valor)}
                          </T>
                          <T tam={12} peso="negrito" cor={corResultado(p.resultado)}>
                            {ms(p.resultado)} · {percentualSinal(p.resultadoPct)}
                          </T>
                        </View>
                      </Linha>
                      <Linha>
                        <T tam={12} cor={cores.textoSuave}>
                          Cotação {p.cotacao != null ? moeda(p.cotacao) : 'aguardando sync'}
                          {p.variacaoDia != null ? ` (${percentualSinal(p.variacaoDia / 100)} hoje)` : ''}
                        </T>
                        <T tam={12} cor={cores.textoSuave}>
                          {percentual(p.peso)} da carteira
                        </T>
                      </Linha>
                    </Pressable>
                  ))}
                </Cartao>
              </View>
            );
          })}
          {c.encerradas.length > 0 && (
            <T tam={12} cor={cores.textoSuave} style={{ textAlign: 'center' }}>
              {c.encerradas.length} {c.encerradas.length === 1 ? 'posição encerrada' : 'posições encerradas'} · lucro realizado total {m(c.resumo.realizado)}
            </T>
          )}
        </>
      )}
    </Tela>
  );
}
