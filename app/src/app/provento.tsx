import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Campo, Chips, Rotulo, T } from '../components/ui';
import { useCarteira } from '../contexto/Carteira';
import { useSessao } from '../contexto/Sessao';
import { quantidadeEm } from '../lib/carteira';
import { confirmar } from '../lib/confirmar';
import { excluirProvento, salvarProvento } from '../lib/dados';
import { dataBR, dataISO, lerNumero, moeda, quantidade } from '../lib/formato';
import { mascaraData, mascaraNumero, paraCampo } from '../lib/mascaras';
import { traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';
import { NOME_PROVENTO, type TipoProvento } from '../lib/tipos';

// Lançamento ou correção manual de provento (o da B3 com mesmo ativo, tipo e data com deixa de contar)
export default function ProventoTela() {
  const params = useLocalSearchParams<{ id?: string; ticker?: string }>();
  const c = useCarteira();
  const { sessao } = useSessao();
  const existente = params.id ? c.dados.proventos.find((p) => p.id === params.id && p.user_id) : undefined;
  const tickers = [...new Set(c.dados.lancamentos.map((l) => l.ticker))].sort();

  const [ticker, setTicker] = useState(existente?.ticker ?? params.ticker ?? tickers[0] ?? '');
  const [tipo, setTipo] = useState<TipoProvento>(existente?.tipo ?? (c.dados.ativos.get(params.ticker ?? '')?.classe === 'fii' ? 'rendimento' : 'dividendo'));
  const [valor, setValor] = useState(paraCampo(existente?.valor_por_cota));
  const [dataCom, setDataCom] = useState(existente ? dataBR(existente.data_com) : '');
  const [dataPag, setDataPag] = useState(existente?.data_pagamento ? dataBR(existente.data_pagamento) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const dc = dataISO(dataCom);
  const dp = dataPag ? dataISO(dataPag) : null;
  const v = lerNumero(valor);
  const qtd = ticker && dc ? quantidadeEm(c.dados.lancamentos, c.dados.eventos, ticker, dc) : null;

  async function salvar() {
    setErro(null);
    if (!ticker) return setErro('Escolha o ativo.');
    if (!v || v <= 0) return setErro('Informe o valor por cota.');
    if (!dc) return setErro('Data com inválida (DD/MM/AAAA).');
    if (dataPag && !dp) return setErro('Data de pagamento inválida (DD/MM/AAAA).');
    setSalvando(true);
    try {
      await salvarProvento({ ticker, tipo, valor_por_cota: v, data_com: dc, data_pagamento: dp }, sessao!.user.id, existente?.id);
      await c.recarregar();
      router.back();
    } catch (e) {
      setErro(traduzirErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!existente || !(await confirmar('Excluir provento', `${NOME_PROVENTO[existente.tipo]} de ${existente.ticker} com data com ${dataBR(existente.data_com)}.`))) return;
    setSalvando(true);
    try {
      await excluirProvento(existente.id);
      await c.recarregar();
      router.back();
    } catch (e) {
      setErro(traduzirErro(e));
      setSalvando(false);
    }
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo={existente ? 'Editar provento' : 'Lançar provento'} fechar />
      <T tam={13} cor={cores.textoSuave}>
        Use para um provento que a sincronização não trouxe ou para corrigir um valor. Se a B3 tiver um provento do mesmo tipo e data com, vale o seu.
      </T>
      {tickers.length === 0 ? (
        <Aviso texto="Faça um lançamento de compra antes de registrar proventos." />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Rotulo>Ativo</Rotulo>
            <Chips pequeno valor={ticker} onChange={setTicker} opcoes={tickers.map((t) => ({ v: t, r: t }))} />
          </View>
          <View style={{ gap: 6 }}>
            <Rotulo>Tipo</Rotulo>
            <Chips valor={tipo} onChange={setTipo} opcoes={(Object.keys(NOME_PROVENTO) as TipoProvento[]).map((t) => ({ v: t, r: NOME_PROVENTO[t] }))} />
          </View>
          <Campo rotulo="Valor bruto por cota (R$)" value={valor} onChangeText={(x) => setValor(mascaraNumero(x))} keyboardType="decimal-pad" placeholder="0,00" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Campo style={{ flex: 1 }} rotulo="Data com" value={dataCom} onChangeText={(x) => setDataCom(mascaraData(x))} keyboardType="number-pad" placeholder="DD/MM/AAAA" />
            <Campo style={{ flex: 1 }} rotulo="Pagamento (opcional)" value={dataPag} onChangeText={(x) => setDataPag(mascaraData(x))} keyboardType="number-pad" placeholder="DD/MM/AAAA" />
          </View>
          {qtd != null && (
            <Aviso
              tipo="info"
              texto={qtd > 0 ? `Na data com você tinha ${quantidade(qtd)} ${ticker}${v ? `: ${moeda(qtd * v)} bruto` : ''}.` : `Você não tinha ${ticker} nessa data com, então esse provento não conta na sua carteira.`}
            />
          )}
          {erro && <Aviso texto={erro} />}
          <Botao rotulo="Salvar provento" onPress={salvar} carregando={salvando} />
          {existente && <Botao rotulo="Excluir provento" tipo="perigo" onPress={excluir} desativado={salvando} />}
        </>
      )}
    </Tela>
  );
}
