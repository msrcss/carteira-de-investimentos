import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Campo, Chips, Rotulo, T } from '../components/ui';
import { useCarteira } from '../contexto/Carteira';
import { useSessao } from '../contexto/Sessao';
import { aplicarEvento, estadoEm } from '../lib/carteira';
import { confirmar } from '../lib/confirmar';
import { excluirEvento, salvarEvento } from '../lib/dados';
import { dataBR, dataISO, lerNumero, moeda, quantidade } from '../lib/formato';
import { mascaraData, mascaraNumero, paraCampo } from '../lib/mascaras';
import { traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';
import { NOME_EVENTO, type EventoCorporativo, type TipoEvento } from '../lib/tipos';

// Converte o que o usuário digita (proporção ou %) no fator que multiplica a quantidade
function fatorDe(tipo: TipoEvento, n: number): number {
  if (tipo === 'desdobramento') return n; // 1 para N
  if (tipo === 'grupamento') return 1 / n; // N para 1
  return 1 + n / 100; // bonificação de N%
}
function campoDe(e: EventoCorporativo): string {
  if (e.tipo === 'desdobramento') return paraCampo(e.fator);
  if (e.tipo === 'grupamento') return paraCampo(Math.round((1 / e.fator) * 1e6) / 1e6);
  return paraCampo(Math.round((e.fator - 1) * 100 * 1e6) / 1e6);
}

export default function EventoTela() {
  const params = useLocalSearchParams<{ id?: string; ticker?: string }>();
  const c = useCarteira();
  const { sessao } = useSessao();
  const existente = params.id ? c.dados.eventos.find((e) => e.id === params.id && e.user_id) : undefined;
  const tickers = [...new Set(c.dados.lancamentos.map((l) => l.ticker))].sort();

  const [ticker, setTicker] = useState(existente?.ticker ?? params.ticker ?? tickers[0] ?? '');
  const [tipo, setTipo] = useState<TipoEvento>(existente?.tipo ?? 'desdobramento');
  const [proporcao, setProporcao] = useState(existente ? campoDe(existente) : '');
  const [custo, setCusto] = useState(paraCampo(existente?.custo_unitario));
  const [dataCom, setDataCom] = useState(existente ? dataBR(existente.data_com) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const n = lerNumero(proporcao);
  const dc = dataISO(dataCom);
  const fator = n && n > 0 ? fatorDe(tipo, n) : null;
  const antes = ticker && dc ? estadoEm(c.dados.lancamentos, c.dados.eventos.filter((e) => e.id !== existente?.id), dc, ticker).get(ticker) : undefined;
  const depois = antes && fator ? aplicarEvento(antes, { tipo, fator, custo_unitario: lerNumero(custo) }) : undefined;

  async function salvar() {
    setErro(null);
    if (!ticker) return setErro('Escolha o ativo.');
    if (!fator) return setErro('Informe a proporção.');
    if (!dc) return setErro('Data com inválida (DD/MM/AAAA).');
    setSalvando(true);
    try {
      await salvarEvento({ ticker, tipo, fator, custo_unitario: tipo === 'bonificacao' ? lerNumero(custo) : null, data_com: dc }, sessao!.user.id, existente?.id);
      await c.recarregar();
      router.back();
    } catch (e) {
      setErro(traduzirErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!existente || !(await confirmar('Excluir evento', `${NOME_EVENTO[existente.tipo]} de ${existente.ticker} em ${dataBR(existente.data_com)}.`))) return;
    setSalvando(true);
    try {
      await excluirEvento(existente.id);
      await c.recarregar();
      router.back();
    } catch (e) {
      setErro(traduzirErro(e));
      setSalvando(false);
    }
  }

  const rotuloProporcao =
    tipo === 'desdobramento' ? 'Cada 1 ação vira quantas?' : tipo === 'grupamento' ? 'Quantas ações viram 1?' : 'Bonificação (%)';

  return (
    <Tela semAbas>
      <Cabecalho titulo={existente ? 'Editar evento' : 'Evento corporativo'} fechar />
      <T tam={13} cor={cores.textoSuave}>
        Desdobramentos, grupamentos e bonificações mudam a quantidade e o preço médio a partir do dia seguinte à data com.
      </T>
      {tickers.length === 0 ? (
        <Aviso texto="Faça um lançamento de compra antes de registrar eventos." />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Rotulo>Ativo</Rotulo>
            <Chips pequeno valor={ticker} onChange={setTicker} opcoes={tickers.map((t) => ({ v: t, r: t }))} />
          </View>
          <View style={{ gap: 6 }}>
            <Rotulo>Tipo</Rotulo>
            <Chips valor={tipo} onChange={setTipo} opcoes={(Object.keys(NOME_EVENTO) as TipoEvento[]).map((t) => ({ v: t, r: NOME_EVENTO[t] }))} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Campo style={{ flex: 1 }} rotulo={rotuloProporcao} value={proporcao} onChangeText={(x) => setProporcao(mascaraNumero(x))} keyboardType="decimal-pad" />
            <Campo style={{ flex: 1 }} rotulo="Data com" value={dataCom} onChangeText={(x) => setDataCom(mascaraData(x))} keyboardType="number-pad" placeholder="DD/MM/AAAA" />
          </View>
          {tipo === 'bonificacao' && (
            <Campo rotulo="Custo atribuído por ação nova (R$, opcional)" value={custo} onChangeText={(x) => setCusto(mascaraNumero(x))} keyboardType="decimal-pad" placeholder="0,00" />
          )}
          {antes && depois && antes.quantidade > 0 && (
            <Aviso
              tipo="info"
              texto={`Sua posição: ${quantidade(antes.quantidade)} a ${moeda(antes.custo / antes.quantidade)} → ${quantidade(depois.quantidade)} a ${moeda(depois.quantidade ? depois.custo / depois.quantidade : 0)}.`}
            />
          )}
          {erro && <Aviso texto={erro} />}
          <Botao rotulo="Salvar evento" onPress={salvar} carregando={salvando} />
          {existente && <Botao rotulo="Excluir evento" tipo="perigo" onPress={excluir} desativado={salvando} />}
        </>
      )}
    </Tela>
  );
}
