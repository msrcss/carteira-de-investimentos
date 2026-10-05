import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { EstadoCarteira } from '../../components/EstadoCarteira';
import { Tela } from '../../components/Tela';
import { Botao, Cartao, Chips, Icones, Linha, Selo, T, Vazio } from '../../components/ui';
import { useCarteira, useValor } from '../../contexto/Carteira';
import { dataBR, mesAno, moeda, numero, quantidade } from '../../lib/formato';
import { cores } from '../../lib/tema';
import { NOME_EVENTO } from '../../lib/tipos';

type Filtro = 'todos' | 'compra' | 'venda' | 'eventos';

interface Item {
  id: string;
  data: string;
  titulo: string;
  detalhe: string;
  valor: string;
  cor: string;
  origem: string;
  abrir?: () => void;
}

export default function Lancamentos() {
  const c = useCarteira();
  const { m } = useValor();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const meses = useMemo(() => {
    const itens: Item[] = [];
    if (filtro !== 'eventos') {
      for (const l of c.dados.lancamentos) {
        if (filtro !== 'todos' && l.tipo !== filtro) continue;
        itens.push({
          id: l.id,
          data: l.data,
          titulo: `${l.tipo === 'compra' ? 'Compra' : 'Venda'} · ${l.ticker}`,
          detalhe: `${quantidade(l.quantidade)} × ${moeda(l.preco)}${l.taxas ? ` + taxas ${moeda(l.taxas)}` : ''}`,
          valor: m(l.quantidade * l.preco + (l.tipo === 'compra' ? l.taxas : -l.taxas)),
          cor: l.tipo === 'compra' ? cores.positivo : cores.negativo,
          origem: l.origem === 'b3' ? 'B3' : 'Manual',
          abrir: () => router.push(`/lancamento/${l.id}`),
        });
      }
    }
    if (filtro === 'todos' || filtro === 'eventos') {
      const primeira = c.dados.lancamentos[0]?.data ?? '9999';
      for (const e of c.dados.eventos) {
        if (e.data_com < primeira) continue;
        itens.push({
          id: e.id,
          data: e.data_com,
          titulo: `${NOME_EVENTO[e.tipo]} · ${e.ticker}`,
          detalhe: `fator ${numero(e.fator)}`,
          valor: '',
          cor: cores.texto,
          origem: e.fonte === 'b3' ? 'B3' : 'Manual',
          abrir: e.user_id ? () => router.push({ pathname: '/evento', params: { id: e.id } }) : () => router.push(`/ativo/${e.ticker}`),
        });
      }
    }
    itens.sort((a, b) => b.data.localeCompare(a.data));
    const grupos = new Map<string, Item[]>();
    for (const i of itens) grupos.set(i.data.slice(0, 7), [...(grupos.get(i.data.slice(0, 7)) ?? []), i]);
    return [...grupos.entries()];
  }, [c.dados, filtro, m]);

  return (
    <Tela>
      <T peso="extra" tam={22}>
        Lançamentos
      </T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Botao rotulo="Novo" icone={<Icones.mais cor="#FFFFFF" />} onPress={() => router.push('/lancamento/novo')} style={{ flex: 1 }} />
        <Botao rotulo="Importar B3" tipo="secundario" icone={<Icones.enviar />} onPress={() => router.push('/importar')} style={{ flex: 1 }} />
      </View>
      <Chips
        valor={filtro}
        onChange={setFiltro}
        opcoes={[
          { v: 'todos', r: 'Todos' },
          { v: 'compra', r: 'Compras' },
          { v: 'venda', r: 'Vendas' },
          { v: 'eventos', r: 'Eventos' },
        ]}
      />
      <EstadoCarteira />
      {!c.carregando && meses.length === 0 && !c.erro && <Vazio titulo="Nada por aqui" texto="Os lançamentos que você registrar ou importar aparecem aqui, agrupados por mês." />}
      {meses.map(([mes, itens]) => (
        <View key={mes} style={{ gap: 8 }}>
          <T peso="extra" tam={15}>
            {mesAno(mes + '-01').replace(/^./, (l) => l.toUpperCase())}
          </T>
          <Cartao style={{ padding: 0, gap: 0 }}>
            {itens.map((i, k) => (
              <Pressable
                key={i.id}
                onPress={i.abrir}
                style={({ pressed }) => ({ padding: 14, gap: 4, borderTopWidth: k ? 1 : 0, borderTopColor: cores.bordaSuave, backgroundColor: pressed ? cores.fundo : 'transparent' })}
              >
                <Linha>
                  <T peso="extra" tam={15} cor={i.cor}>
                    {i.titulo}
                  </T>
                  <T peso="extra" tam={15}>
                    {i.valor}
                  </T>
                </Linha>
                <Linha>
                  <T tam={12} cor={cores.textoSuave}>
                    {dataBR(i.data)} · {i.detalhe}
                  </T>
                  <Selo texto={i.origem} cor={i.origem === 'B3' ? cores.marca : cores.textoSuave} fundo={i.origem === 'B3' ? '#E7F2EC' : cores.fundo} />
                </Linha>
              </Pressable>
            ))}
          </Cartao>
        </View>
      ))}
    </Tela>
  );
}
