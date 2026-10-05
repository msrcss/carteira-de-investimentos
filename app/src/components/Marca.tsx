import { View } from 'react-native';
import { cores } from '../lib/tema';
import { T } from './ui';

export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <View style={{ gap: 8, marginTop: 32, marginBottom: 8 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' }}>
        <T peso="extra" tam={24} cor="#FFFFFF">
          C
        </T>
      </View>
      <T peso="extra" tam={28}>
        Carteira digital
      </T>
      <T tam={15} cor={cores.textoSuave}>
        {subtitulo}
      </T>
    </View>
  );
}
