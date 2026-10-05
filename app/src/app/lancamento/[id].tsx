import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CampoAtivo } from '../../components/CampoAtivo';
import { Cabecalho, Tela } from '../../components/Tela';
import { Aviso, Botao, Campo, Cartao, Chips, Linha, Rotulo, Segmento, T } from '../../components/ui';
import { useCarteira } from '../../contexto/Carteira';
import { previaLancamento } from '../../lib/carteira';
import { confirmar } from '../../lib/confirmar';
import { excluirLancamento, registrarAtivo, salvarLancamento } from '../../lib/dados';
import { dataBR, dataISO, lerNumero, moeda, moedaSinal, quantidade } from '../../lib/formato';
import { classeProvavel } from '../../lib/importarB3';
import { mascaraData, mascaraNumero, paraCampo } from '../../lib/mascaras';
import { traduzirErro } from '../../lib/supabase';
import { cores, corResultado } from '../../lib/tema';
import type { Classe, TipoLancamento } from '../../lib/tipos';

export default function LancamentoTela() {
  const params = useLocalSearchParams<{ id: string; ticker?: string }>();
  const c = useCarteira();
  const existente = params.id !== 'novo' ? c.dados.lancamentos.find((l) => l.id === params.id) : undefined;
  const tickerInicial = existente?.ticker ?? params.ticker ?? '';

  const [tipo, setTipo] = useState<TipoLancamento>(existente?.tipo ?? 'compra');
  const [ticker, setTicker] = useState(tickerInicial);
  const [classe, setClasse] = useState<Classe>(c.dados.ativos.get(tickerInicial)?.classe ?? classeProvavel(tickerInicial));
  const [data, setData] = useState(dataBR(existente?.data ?? c.hoje));
  const [qtd, setQtd] = useState(paraCampo(existente?.quantidade));
  const [preco, setPreco] = useState(paraCampo(existente?.preco));
  const [taxas, setTaxas] = useState(paraCampo(existente?.taxas || null));
  const [carteiraId, setCarteiraId] = useState(existente?.carteira_id ?? c.carteira?.id ?? '');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valores = {
    data: dataISO(data),
    quantidade: lerNumero(qtd),
    preco: lerNumero(preco),
    taxas: lerNumero(taxas) ?? 0,
  };
  const previa = useMemo(() => {
    if (!ticker || !valores.data || !valores.quantidade || valores.preco == null) return null;
    if (carteiraId !== c.carteira?.id) return null; // prévia só com os dados da carteira aberta
    return previaLancamento(
      c.dados.lancamentos,
      c.dados.eventos,
      { ticker, tipo, data: valores.data, quantidade: valores.quantidade, preco: valores.preco, taxas: valores.taxas },
      existente?.id,
    );
  }, [ticker, tipo, valores.data, valores.quantidade, valores.preco, valores.taxas, c.dados, existente?.id, carteiraId, c.carteira?.id]);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!/^[A-Z0-9]{4}\d{1,2}$/.test(ticker)) e.ticker = 'Escolha um ativo válido.';
    if (!valores.data) e.data = 'Use DD/MM/AAAA.';
    else if (valores.data > c.hoje) e.data = 'A data não pode ser no futuro.';
    if (!valores.quantidade || valores.quantidade <= 0) e.qtd = 'Informe a quantidade.';
    if (valores.preco == null || valores.preco < 0) e.preco = 'Informe o preço.';
    if (taxas && lerNumero(taxas) == null) e.taxas = 'Valor inválido.';
    setErros(e);
    if (Object.keys(e).length) return;
    if (previa?.vendaMaiorQuePosicao) {
      const ok = await confirmar('Venda maior que a posição', `Na data você tinha ${quantidade(previa.quantidadeAntes)}. Salvar mesmo assim?`, 'Salvar');
      if (!ok) return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await registrarAtivo(ticker, classe);
      await salvarLancamento(
        { carteira_id: carteiraId, ticker, tipo, data: valores.data!, quantidade: valores.quantidade!, preco: valores.preco!, taxas: valores.taxas },
        existente?.id,
      );
      await c.recarregar();
      router.back();
      c.sincronizar().catch(() => {}); // busca cotação e proventos do ativo novo
    } catch (err) {
      setErro(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!existente) return;
    if (!(await confirmar('Excluir lançamento', `${existente.tipo === 'compra' ? 'Compra' : 'Venda'} de ${quantidade(existente.quantidade)} ${existente.ticker} em ${dataBR(existente.data)}.`))) return;
    setSalvando(true);
    try {
      await excluirLancamento(existente.id);
      await c.recarregar();
      router.back();
    } catch (err) {
      setErro(traduzirErro(err));
      setSalvando(false);
    }
  }

  if (params.id !== 'novo' && !existente && !c.carregando) {
    return (
      <Tela semAbas>
        <Cabecalho titulo="Lançamento" fechar />
        <Aviso texto="Lançamento não encontrado nesta carteira." />
      </Tela>
    );
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo={existente ? 'Editar lançamento' : 'Novo lançamento'} fechar />
      <Segmento
        valor={tipo}
        onChange={setTipo}
        opcoes={[
          { v: 'compra', r: 'Compra' },
          { v: 'venda', r: 'Venda', cor: cores.negativo },
        ]}
      />
      <CampoAtivo
        ticker={ticker}
        classe={classe}
        conhecidos={c.dados.ativos}
        erro={erros.ticker}
        onChange={(t, k) => {
          setTicker(t);
          setClasse(k);
        }}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Campo style={{ flex: 1 }} rotulo="Data" value={data} onChangeText={(v) => setData(mascaraData(v))} keyboardType="number-pad" placeholder="DD/MM/AAAA" erro={erros.data} />
        <Campo style={{ flex: 1 }} rotulo="Quantidade" value={qtd} onChangeText={(v) => setQtd(mascaraNumero(v))} keyboardType="decimal-pad" erro={erros.qtd} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Campo style={{ flex: 1 }} rotulo="Preço unitário (R$)" value={preco} onChangeText={(v) => setPreco(mascaraNumero(v))} keyboardType="decimal-pad" placeholder="0,00" erro={erros.preco} />
        <Campo style={{ flex: 1 }} rotulo="Taxas (opcional)" value={taxas} onChangeText={(v) => setTaxas(mascaraNumero(v))} keyboardType="decimal-pad" placeholder="0,00" erro={erros.taxas} />
      </View>
      {c.carteiras.length > 1 && (
        <View style={{ gap: 6 }}>
          <Rotulo>Carteira</Rotulo>
          <Chips valor={carteiraId} onChange={setCarteiraId} opcoes={c.carteiras.map((k) => ({ v: k.id, r: k.nome }))} />
        </View>
      )}

      {previa && (
        <Cartao>
          <Linha>
            <Rotulo>Total da operação</Rotulo>
            <T peso="extra" tam={20}>
              {moeda(previa.total)}
            </T>
          </Linha>
          <View style={{ borderTopWidth: 1, borderTopColor: cores.bordaSuave, paddingTop: 12, gap: 12 }}>
            {tipo === 'compra' ? (
              <Linha>
                <Rotulo>Preço médio</Rotulo>
                <T peso="extra" tam={15}>
                  {previa.quantidadeAntes > 0 ? `${moeda(previa.precoMedioAntes)} → ` : ''}
                  {moeda(previa.precoMedioDepois)}
                </T>
              </Linha>
            ) : (
              <Linha>
                <Rotulo>Lucro realizado</Rotulo>
                <T peso="extra" tam={15} cor={corResultado(previa.lucroRealizado)}>
                  {moedaSinal(previa.lucroRealizado)}
                </T>
              </Linha>
            )}
            <Linha>
              <Rotulo>Posição</Rotulo>
              <T peso="extra" tam={15}>
                {quantidade(previa.quantidadeAntes)} → {quantidade(previa.quantidadeDepois)}
              </T>
            </Linha>
          </View>
          {previa.vendaMaiorQuePosicao && <Aviso texto={`Venda maior que a posição na data (${quantidade(previa.quantidadeAntes)}).`} />}
        </Cartao>
      )}

      {erro && <Aviso texto={erro} />}
      <Botao rotulo={existente ? 'Salvar alterações' : 'Salvar lançamento'} onPress={salvar} carregando={salvando} />
      {existente && <Botao rotulo="Excluir lançamento" tipo="perigo" onPress={excluir} desativado={salvando} />}
    </Tela>
  );
}
