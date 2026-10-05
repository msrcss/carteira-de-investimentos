import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Campo, Cartao, Linha, T } from '../components/ui';
import { useCarteira } from '../contexto/Carteira';
import { confirmar } from '../lib/confirmar';
import { criarCarteira, excluirCarteira, renomearCarteira } from '../lib/dados';
import { traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';

export default function Carteiras() {
  const c = useCarteira();
  const [nova, setNova] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(f: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await f();
      await c.recarregar();
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo="Carteiras" fechar />
      <Cartao style={{ padding: 0, gap: 0 }}>
        {c.carteiras.map((k, i) => {
          const atual = k.id === c.carteira?.id;
          return (
            <View key={k.id} style={{ padding: 14, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: cores.bordaSuave }}>
              {editando?.id === k.id ? (
                <>
                  <Campo rotulo="Nome" value={editando.nome} onChangeText={(nome) => setEditando({ id: k.id, nome })} autoFocus />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Botao rotulo="Cancelar" tipo="secundario" style={{ flex: 1 }} onPress={() => setEditando(null)} />
                    <Botao
                      rotulo="Salvar"
                      style={{ flex: 1 }}
                      carregando={ocupado}
                      onPress={() =>
                        executar(async () => {
                          if (!editando.nome.trim()) throw new Error('Dê um nome à carteira.');
                          await renomearCarteira(k.id, editando.nome.trim());
                          setEditando(null);
                        })
                      }
                    />
                  </View>
                </>
              ) : (
                <Linha>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      c.escolherCarteira(k.id);
                      router.back();
                    }}
                  >
                    <T peso="extra" tam={16} cor={atual ? cores.marca : cores.texto}>
                      {k.nome}
                    </T>
                    {atual && (
                      <T tam={12} cor={cores.textoSuave}>
                        Carteira aberta
                      </T>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setEditando({ id: k.id, nome: k.nome })} hitSlop={8}>
                    <T peso="negrito" tam={13} cor={cores.marca}>
                      Renomear
                    </T>
                  </Pressable>
                  {c.carteiras.length > 1 && (
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        if (await confirmar('Excluir carteira', `"${k.nome}" e todos os lançamentos dela serão apagados. Isso não pode ser desfeito.`))
                          executar(async () => {
                            await excluirCarteira(k.id);
                            if (atual) c.escolherCarteira(c.carteiras.find((x) => x.id !== k.id)!.id);
                          });
                      }}
                    >
                      <T peso="negrito" tam={13} cor={cores.negativo}>
                        Excluir
                      </T>
                    </Pressable>
                  )}
                </Linha>
              )}
            </View>
          );
        })}
      </Cartao>
      <Campo rotulo="Nova carteira" value={nova} onChangeText={setNova} placeholder="Ex.: Aposentadoria" />
      <Botao
        rotulo="Criar carteira"
        tipo="secundario"
        carregando={ocupado}
        desativado={!nova.trim()}
        onPress={() =>
          executar(async () => {
            const k = await criarCarteira(nova.trim());
            setNova('');
            c.escolherCarteira(k.id);
          })
        }
      />
      {erro && <Aviso texto={erro} />}
    </Tela>
  );
}
