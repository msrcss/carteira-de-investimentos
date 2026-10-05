import { ActivityIndicator, View } from 'react-native';
import { useCarteira } from '../contexto/Carteira';
import { cores } from '../lib/tema';
import { Aviso, Botao } from './ui';

/** Carregando ou erro ao ler a carteira; null quando está tudo certo */
export function EstadoCarteira() {
  const { carregando, erro, recarregar } = useCarteira();
  if (carregando)
    return (
      <View style={{ paddingVertical: 40 }}>
        <ActivityIndicator color={cores.marca} />
      </View>
    );
  if (erro)
    return (
      <View style={{ gap: 12 }}>
        <Aviso texto={`Não consegui carregar sua carteira: ${erro}`} />
        <Botao rotulo="Tentar de novo" tipo="secundario" onPress={recarregar} />
      </View>
    );
  return null;
}
