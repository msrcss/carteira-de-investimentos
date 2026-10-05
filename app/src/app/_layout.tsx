import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProvedorCarteira } from '../contexto/Carteira';
import { ProvedorSessao, useSessao } from '../contexto/Sessao';
import { cores } from '../lib/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Rotas() {
  const { sessao, carregando } = useSessao();
  const [fontesProntas] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const pronto = fontesProntas && !carregando;

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);

  if (!pronto) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Protected guard={!sessao}>
        <Stack.Screen name="entrar" />
        <Stack.Screen name="cadastrar" />
        <Stack.Screen name="recuperar" />
      </Stack.Protected>
      <Stack.Protected guard={!!sessao}>
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="ativo/[ticker]" />
        <Stack.Screen name="lancamento/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="importar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="provento" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evento" options={{ presentation: 'modal' }} />
        <Stack.Screen name="carteiras" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conta" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProvedorSessao>
        <ProvedorCarteira>
          <StatusBar style="dark" />
          <Rotas />
        </ProvedorCarteira>
      </ProvedorSessao>
    </SafeAreaProvider>
  );
}
