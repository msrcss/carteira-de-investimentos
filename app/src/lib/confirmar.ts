import { Alert, Platform } from 'react-native';

/** Pergunta sim/não (no navegador usa window.confirm, porque Alert com botões não funciona na web) */
export function confirmar(titulo: string, mensagem: string, acao = 'Excluir'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  return new Promise((ok) =>
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => ok(false) },
      { text: acao, style: 'destructive', onPress: () => ok(true) },
    ]),
  );
}
