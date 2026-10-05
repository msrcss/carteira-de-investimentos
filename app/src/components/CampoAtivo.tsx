import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { buscarAtivos } from '../lib/dados';
import { classeProvavel } from '../lib/importarB3';
import { cores } from '../lib/tema';
import { NOME_CLASSE, type Ativo, type Classe } from '../lib/tipos';
import { Campo, Chips, T } from './ui';

const VALIDO = /^[A-Z0-9]{4}\d{1,2}$/;

/** Busca de ativo por código ou nome; aceita um código novo, com a classe escolhida pelo usuário */
export function CampoAtivo({
  ticker,
  classe,
  onChange,
  conhecidos,
  erro,
}: {
  ticker: string;
  classe: Classe;
  onChange: (ticker: string, classe: Classe) => void;
  conhecidos: Map<string, Ativo>;
  erro?: string | null;
}) {
  const [texto, setTexto] = useState(ticker);
  const [sugestoes, setSugestoes] = useState<Ativo[]>([]);
  const [aberto, setAberto] = useState(false);
  const t = texto.trim().toUpperCase();
  const existente = conhecidos.get(t) ?? sugestoes.find((s) => s.ticker === t);

  useEffect(() => {
    if (!aberto || t.length < 2) return setSugestoes([]);
    const id = setTimeout(() => {
      buscarAtivos(t).then(setSugestoes).catch(() => setSugestoes([]));
    }, 250);
    return () => clearTimeout(id);
  }, [t, aberto]);

  function escolher(a: { ticker: string; classe: Classe }) {
    setTexto(a.ticker);
    setAberto(false);
    onChange(a.ticker, a.classe);
  }

  return (
    <View style={{ gap: 8 }}>
      <Campo
        rotulo="Ativo"
        value={texto}
        placeholder="Ex.: PETR4, HGLG11"
        autoCapitalize="characters"
        autoCorrect={false}
        erro={erro}
        onFocus={() => setAberto(true)}
        onChangeText={(v) => {
          setTexto(v);
          setAberto(true);
          const up = v.trim().toUpperCase();
          const k = conhecidos.get(up);
          onChange(up, k?.classe ?? classeProvavel(up));
        }}
      />
      {aberto && t.length >= 2 && (
        <View style={{ borderWidth: 1, borderColor: cores.borda, borderRadius: 12, backgroundColor: cores.cartao, overflow: 'hidden' }}>
          {sugestoes.map((s, i) => (
            <Pressable key={s.ticker} onPress={() => escolher(s)} style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: cores.bordaSuave }}>
              <T peso="extra">{s.ticker}</T>
              <T tam={12} cor={cores.textoSuave} numberOfLines={1}>
                {s.nome ?? NOME_CLASSE[s.classe]}
              </T>
            </Pressable>
          ))}
          {VALIDO.test(t) && !sugestoes.some((s) => s.ticker === t) && (
            <Pressable onPress={() => escolher({ ticker: t, classe })} style={{ padding: 12, borderTopWidth: sugestoes.length ? 1 : 0, borderTopColor: cores.bordaSuave }}>
              <T peso="extra" cor={cores.marca}>
                Usar {t}
              </T>
              <T tam={12} cor={cores.textoSuave}>
                Ativo ainda não cadastrado; nome e cotação chegam na próxima sincronização.
              </T>
            </Pressable>
          )}
          {!VALIDO.test(t) && sugestoes.length === 0 && (
            <T tam={12} cor={cores.textoSuave} style={{ padding: 12 }}>
              Digite o código completo, como PETR4 ou HGLG11.
            </T>
          )}
        </View>
      )}
      {VALIDO.test(t) && !existente && (
        <View style={{ gap: 6 }}>
          <T peso="negrito" tam={12} cor={cores.textoSuave}>
            Classe do ativo novo
          </T>
          <Chips
            pequeno
            valor={classe}
            onChange={(c) => onChange(t, c)}
            opcoes={(Object.keys(NOME_CLASSE) as Classe[]).map((v) => ({ v, r: NOME_CLASSE[v] }))}
          />
        </View>
      )}
    </View>
  );
}
