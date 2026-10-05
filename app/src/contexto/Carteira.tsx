import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  calcularPosicoes,
  mesclarCorrecoes,
  proventosDoUsuario,
  resumir,
  type Posicao,
  type ProventoDoUsuario,
  type Resumo,
} from '../lib/carteira';
import { carregarCarteira, listarCarteiras, sincronizarAgora, type DadosCarteira } from '../lib/dados';
import { hojeISO, moeda, moedaSinal, OCULTO } from '../lib/formato';
import { traduzirErro } from '../lib/supabase';
import type { Carteira } from '../lib/tipos';
import { useSessao } from './Sessao';

interface ValorCarteira {
  carteiras: Carteira[];
  carteira: Carteira | null;
  escolherCarteira: (id: string) => void;
  dados: DadosCarteira;
  posicoes: Posicao[];
  encerradas: Posicao[];
  resumo: Resumo;
  proventos: ProventoDoUsuario[];
  hoje: string;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  sincronizar: () => Promise<string | null>;
  ocultar: boolean;
  alternarOcultar: () => void;
}

const VAZIO: DadosCarteira = { lancamentos: [], ativos: new Map(), proventos: [], eventos: [], precos: [], indices: [] };
const CHAVE_CARTEIRA = 'carteira:selecionada';
const CHAVE_OCULTAR = 'carteira:ocultar';

const Contexto = createContext<ValorCarteira | null>(null);

export function ProvedorCarteira({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const [carteiras, setCarteiras] = useState<Carteira[]>([]);
  const [carteiraId, setCarteiraId] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCarteira>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocultar, setOcultar] = useState(false);
  const hoje = hojeISO();

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_OCULTAR).then((v) => setOcultar(v === '1')).catch(() => {});
  }, []);

  const recarregar = useCallback(async () => {
    if (!sessao) return;
    setErro(null);
    try {
      const lista = await listarCarteiras();
      setCarteiras(lista);
      const salva = carteiraId ?? (await AsyncStorage.getItem(CHAVE_CARTEIRA).catch(() => null));
      const atual = lista.find((c) => c.id === salva) ?? lista[0] ?? null;
      if (atual && atual.id !== carteiraId) setCarteiraId(atual.id);
      setDados(atual ? await carregarCarteira(atual.id) : VAZIO);
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [sessao, carteiraId]);

  useEffect(() => {
    if (sessao) {
      setCarregando(true);
      recarregar();
    } else {
      setCarteiras([]);
      setCarteiraId(null);
      setDados(VAZIO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao?.user.id, carteiraId]);

  const escolherCarteira = useCallback((id: string) => {
    AsyncStorage.setItem(CHAVE_CARTEIRA, id).catch(() => {});
    setCarteiraId(id);
  }, []);

  const sincronizar = useCallback(async () => {
    const tickers = [...new Set(dados.lancamentos.map((l) => l.ticker))];
    let aviso: string | null = null;
    if (tickers.length) {
      try {
        await sincronizarAgora(tickers);
      } catch {
        aviso = 'Não consegui atualizar as cotações agora; mostrando os últimos dados salvos.';
      }
    }
    await recarregar();
    return aviso;
  }, [dados.lancamentos, recarregar]);

  const alternarOcultar = useCallback(() => {
    setOcultar((v) => {
      AsyncStorage.setItem(CHAVE_OCULTAR, v ? '0' : '1').catch(() => {});
      return !v;
    });
  }, []);

  const derivados = useMemo(() => {
    const eventos = mesclarCorrecoes(dados.eventos);
    const { abertas, encerradas } = calcularPosicoes(dados.lancamentos, eventos, dados.ativos, hoje);
    return {
      posicoes: abertas,
      encerradas,
      resumo: resumir(abertas, encerradas),
      proventos: proventosDoUsuario(dados.proventos, dados.lancamentos, eventos, hoje),
      dados: { ...dados, eventos },
    };
  }, [dados, hoje]);

  const valor: ValorCarteira = {
    carteiras,
    carteira: carteiras.find((c) => c.id === carteiraId) ?? null,
    escolherCarteira,
    ...derivados,
    hoje,
    carregando,
    erro,
    recarregar,
    sincronizar,
    ocultar,
    alternarOcultar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarteira() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useCarteira fora do ProvedorCarteira');
  return v;
}

/** Formata dinheiro respeitando o botão de ocultar valores */
export function useValor() {
  const { ocultar } = useCarteira();
  return {
    ocultar,
    m: (v: number | null | undefined) => (ocultar ? OCULTO : moeda(v)),
    ms: (v: number) => (ocultar ? OCULTO : moedaSinal(v)),
  };
}
