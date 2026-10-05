import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as XLSX from 'xlsx';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Cartao, Icones, Linha, Selo, T, Titulo } from '../components/ui';
import { useCarteira } from '../contexto/Carteira';
import { chavesImportadas, importarLancamentos, registrarAtivo } from '../lib/dados';
import { dataBR, moeda, quantidade } from '../lib/formato';
import { classeProvavel, lerLinhasNegociacao, type ResultadoImportacao } from '../lib/importarB3';
import { traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';

const PASSOS = [
  'Entre na Área do Investidor da B3 (investidor.b3.com.br).',
  'Abra Extratos > Negociação.',
  'Escolha o período (até 12 meses por vez) e toque em Baixar > Excel.',
  'Volte aqui e escolha o arquivo baixado.',
];

async function lerArquivo(asset: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' && asset.file) return asset.file.arrayBuffer();
  return new File(asset.uri).arrayBuffer();
}

export default function Importar() {
  const c = useCarteira();
  const [nome, setNome] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [repetidas, setRepetidas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);

  async function escolher() {
    setErro(null);
    setFeito(null);
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', '*/*'],
      copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setLendo(true);
    try {
      const buf = await lerArquivo(asset);
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false });
      const planilha = wb.Sheets[wb.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, { raw: true, defval: '' });
      const res = lerLinhasNegociacao(linhas);
      if (res.linhas.length === 0) throw new Error('Não encontrei operações de compra ou venda. Confira se é o extrato de Negociação da B3.');
      const ja = c.carteira ? await chavesImportadas(c.carteira.id) : new Set<string>();
      setNome(asset.name);
      setResultado(res);
      setRepetidas(new Set(res.linhas.filter((l) => ja.has(l.chave)).map((l) => l.chave)));
    } catch (e) {
      setResultado(null);
      setErro(e instanceof Error && !/supabase/i.test(e.message) ? e.message : traduzirErro(e));
    } finally {
      setLendo(false);
    }
  }

  const novas = resultado?.linhas.filter((l) => !repetidas.has(l.chave)) ?? [];

  async function gravar() {
    if (!c.carteira || novas.length === 0) return;
    setGravando(true);
    setErro(null);
    try {
      for (const t of [...new Set(novas.map((l) => l.ticker))]) {
        await registrarAtivo(t, c.dados.ativos.get(t)?.classe ?? classeProvavel(t));
      }
      const n = await importarLancamentos(
        novas.map((l) => ({
          carteira_id: c.carteira!.id,
          ticker: l.ticker,
          tipo: l.tipo,
          data: l.data,
          quantidade: l.quantidade,
          preco: l.preco,
          taxas: 0,
          origem: 'b3' as const,
          chave_importacao: l.chave,
        })),
      );
      setFeito(n);
      setResultado(null);
      await c.recarregar();
      c.sincronizar().catch(() => {});
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setGravando(false);
    }
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo="Importar planilha B3" fechar />
      {feito != null && (
        <>
          <Aviso tipo="info" texto={`${feito} ${feito === 1 ? 'operação importada' : 'operações importadas'} para ${c.carteira?.nome}.`} />
          <Botao rotulo="Ver lançamentos" onPress={() => router.replace('/lancamentos')} />
        </>
      )}
      {!resultado && (
        <Cartao>
          <Titulo>Como baixar o extrato</Titulo>
          {PASSOS.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' }}>
                <T peso="extra" tam={13} cor="#FFFFFF">
                  {i + 1}
                </T>
              </View>
              <T style={{ flex: 1 }}>{p}</T>
            </View>
          ))}
          <T tam={12} cor={cores.textoSuave}>
            Operações que já foram importadas são reconhecidas e ignoradas. Taxas não vêm no extrato; ajuste depois em cada lançamento se quiser.
          </T>
        </Cartao>
      )}
      <Botao rotulo={resultado ? 'Escolher outro arquivo' : 'Escolher arquivo (.xlsx)'} tipo={resultado ? 'secundario' : 'primario'} icone={<Icones.enviar cor={resultado ? cores.texto : '#FFFFFF'} />} onPress={escolher} carregando={lendo} />
      {erro && <Aviso texto={erro} />}
      {resultado && (
        <>
          <Cartao style={{ gap: 6 }}>
            <T peso="extra">{nome}</T>
            <T tam={13} cor={cores.textoSuave}>
              {resultado.linhas.length} operações encontradas · {novas.length} novas · {repetidas.size} já importadas
              {resultado.ignoradas.length ? ` · ${resultado.ignoradas.length} ignoradas` : ''}
            </T>
          </Cartao>
          <Cartao style={{ padding: 0, gap: 0 }}>
            {resultado.linhas.slice(0, 200).map((l, i) => {
              const rep = repetidas.has(l.chave);
              return (
                <View key={l.chave} style={{ padding: 12, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: cores.bordaSuave, opacity: rep ? 0.5 : 1 }}>
                  <Linha>
                    <T peso="extra" cor={l.tipo === 'compra' ? cores.positivo : cores.negativo}>
                      {l.tipo === 'compra' ? 'Compra' : 'Venda'} · {l.ticker}
                    </T>
                    <T peso="negrito">{moeda(l.quantidade * l.preco)}</T>
                  </Linha>
                  <Linha>
                    <T tam={12} cor={cores.textoSuave}>
                      {dataBR(l.data)} · {quantidade(l.quantidade)} × {moeda(l.preco)}
                    </T>
                    {rep && <Selo texto="Já importada" />}
                  </Linha>
                </View>
              );
            })}
          </Cartao>
          {resultado.linhas.length > 200 && (
            <T tam={12} cor={cores.textoSuave}>
              Mostrando as 200 primeiras de {resultado.linhas.length}; todas serão importadas.
            </T>
          )}
          {resultado.ignoradas.length > 0 && (
            <Aviso
              texto={`Linhas ignoradas: ${resultado.ignoradas
                .slice(0, 5)
                .map((x) => `${x.linha} (${x.motivo})`)
                .join('; ')}${resultado.ignoradas.length > 5 ? '…' : ''}`}
            />
          )}
          <Botao
            rotulo={novas.length ? `Importar ${novas.length} ${novas.length === 1 ? 'operação' : 'operações'}` : 'Nada novo para importar'}
            onPress={gravar}
            carregando={gravando}
            desativado={!novas.length}
          />
        </>
      )}
    </Tela>
  );
}
