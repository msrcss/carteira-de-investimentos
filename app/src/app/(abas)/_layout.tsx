import Tabs from 'expo-router/js-tabs';
import { Icones } from '../../components/ui';
import { cores, fonte } from '../../lib/tema';

export default function Abas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.marca,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarLabelStyle: { fontFamily: fonte.negrito, fontSize: 11, lineHeight: 14 },
        tabBarStyle: { backgroundColor: cores.cartao, borderTopColor: cores.borda },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Resumo', tabBarIcon: ({ color }) => <Icones.resumo cor={color as string} tam={22} /> }} />
      <Tabs.Screen name="ativos" options={{ title: 'Ativos', tabBarIcon: ({ color }) => <Icones.ativos cor={color as string} tam={22} /> }} />
      <Tabs.Screen name="lancamentos" options={{ title: 'Lançamentos', tabBarIcon: ({ color }) => <Icones.lancamentos cor={color as string} tam={22} /> }} />
      <Tabs.Screen name="proventos" options={{ title: 'Proventos', tabBarIcon: ({ color }) => <Icones.proventos cor={color as string} tam={22} /> }} />
    </Tabs>
  );
}
