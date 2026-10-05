import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { cores } from '../lib/tema';
import { BotaoIcone, Icones, T } from './ui';

/** Tela rolável com o fundo e espaçamentos do design */
export function Tela({
  children,
  atualizando,
  onAtualizar,
  semAbas,
}: {
  children: ReactNode;
  atualizando?: boolean;
  onAtualizar?: () => void;
  semAbas?: boolean;
}) {
  return (
    <SafeAreaView edges={semAbas ? ['top', 'bottom'] : ['top']} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onAtualizar ? <RefreshControl refreshing={!!atualizando} onRefresh={onAtualizar} tintColor={cores.marca} /> : undefined}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Cabeçalho com botão de voltar/fechar e título */
export function Cabecalho({ titulo, fechar, direita }: { titulo: string; fechar?: boolean; direita?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <BotaoIcone rotulo={fechar ? 'Fechar' : 'Voltar'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        {fechar ? <Icones.fechar /> : <Icones.voltar />}
      </BotaoIcone>
      <T peso="extra" tam={22} style={{ flex: 1 }} numberOfLines={1}>
        {titulo}
      </T>
      {direita}
    </View>
  );
}
