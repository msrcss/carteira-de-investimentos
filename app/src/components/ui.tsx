import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { cores, fonte } from '../lib/tema';

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type Peso = keyof typeof fonte;

export function T({
  peso = 'semi',
  tam = 14,
  cor = cores.texto,
  style,
  ...rest
}: TextProps & { peso?: Peso; tam?: number; cor?: string }) {
  return <Text {...rest} style={[{ fontFamily: fonte[peso], fontSize: tam, color: cor, fontVariant: ['tabular-nums'] }, style]} />;
}

export const Rotulo = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => (
  <T tam={12} cor={cores.textoSuave} style={style}>
    {children}
  </T>
);

export const Titulo = ({ children }: { children: ReactNode }) => (
  <T peso="extra" tam={16}>
    {children}
  </T>
);

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

export const Cartao = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 16, padding: 16, gap: 12 }, style]}>
    {children}
  </View>
);

export const Linha = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, style]}>{children}</View>
);

export function Chip({ rotulo, ativo, onPress, pequeno }: { rotulo: string; ativo?: boolean; onPress?: () => void; pequeno?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!ativo }}
      style={{
        height: pequeno ? 28 : 32,
        paddingHorizontal: pequeno ? 10 : 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: ativo ? cores.texto : cores.bordaCampo,
        backgroundColor: ativo ? cores.texto : cores.cartao,
        justifyContent: 'center',
      }}
    >
      <T tam={pequeno ? 12 : 13} cor={ativo ? '#FFFFFF' : cores.texto}>
        {rotulo}
      </T>
    </Pressable>
  );
}

export function Chips<V extends string>({ opcoes, valor, onChange, pequeno }: { opcoes: { v: V; r: string }[]; valor: V; onChange: (v: V) => void; pequeno?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {opcoes.map((o) => (
        <Chip key={o.v} rotulo={o.r} ativo={o.v === valor} onPress={() => onChange(o.v)} pequeno={pequeno} />
      ))}
    </View>
  );
}

export function Segmento<V extends string>({ opcoes, valor, onChange }: { opcoes: { v: V; r: string; cor?: string }[]; valor: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: cores.segmento, borderRadius: 14 }}>
      {opcoes.map((o) => {
        const on = o.v === valor;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? o.cor ?? cores.marca : 'transparent' }}
          >
            <T peso="extra" tam={15} cor={on ? '#FFFFFF' : cores.textoSuave}>
              {o.r}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Botao({
  rotulo,
  onPress,
  tipo = 'primario',
  carregando,
  desativado,
  icone,
  style,
}: {
  rotulo: string;
  onPress?: () => void;
  tipo?: 'primario' | 'secundario' | 'perigo';
  carregando?: boolean;
  desativado?: boolean;
  icone?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fundo = tipo === 'primario' ? cores.marca : cores.cartao;
  const cor = tipo === 'primario' ? '#FFFFFF' : tipo === 'perigo' ? cores.negativo : cores.texto;
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado || carregando}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 16,
          backgroundColor: pressed && tipo === 'primario' ? cores.marcaEscura : fundo,
          borderWidth: tipo === 'primario' ? 0 : 1,
          borderColor: tipo === 'perigo' ? '#F1C9C5' : cores.borda,
          opacity: desativado ? 0.5 : 1,
        },
        style,
      ]}
    >
      {carregando ? <ActivityIndicator color={cor} /> : icone}
      <T peso="negrito" tam={16} cor={cor}>
        {rotulo}
      </T>
    </Pressable>
  );
}

export function BotaoIcone({ children, onPress, rotulo }: { children: ReactNode; onPress?: () => void; rotulo: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </Pressable>
  );
}

export function Campo({ rotulo, erro, style, ...rest }: TextInputProps & { rotulo: string; erro?: string | null }) {
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <T peso="negrito" tam={12} cor={cores.textoSuave}>
        {rotulo}
      </T>
      <TextInput
        placeholderTextColor="#9AA39E"
        {...rest}
        style={{
          height: 48,
          borderWidth: 1,
          borderColor: erro ? cores.negativo : cores.bordaCampo,
          borderRadius: 12,
          paddingHorizontal: 14,
          fontFamily: fonte.semi,
          fontSize: 16,
          color: cores.texto,
          backgroundColor: cores.cartao,
        }}
      />
      {erro ? (
        <T tam={12} cor={cores.negativo}>
          {erro}
        </T>
      ) : null}
    </View>
  );
}

export const Aviso = ({ texto, tipo = 'erro' }: { texto: string; tipo?: 'erro' | 'info' }) => (
  <View style={{ backgroundColor: tipo === 'erro' ? '#FDECEA' : '#E7F2EC', borderRadius: 12, padding: 12 }}>
    <T tam={13} cor={tipo === 'erro' ? cores.negativo : cores.marca}>
      {texto}
    </T>
  </View>
);

export const Vazio = ({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) => (
  <Cartao style={{ alignItems: 'center', paddingVertical: 28 }}>
    <T peso="extra" tam={16} style={{ textAlign: 'center' }}>
      {titulo}
    </T>
    {texto ? (
      <T tam={14} cor={cores.textoSuave} style={{ textAlign: 'center' }}>
        {texto}
      </T>
    ) : null}
    {acao}
  </Cartao>
);

export const Selo = ({ texto, cor = cores.textoSuave, fundo = cores.fundo }: { texto: string; cor?: string; fundo?: string }) => (
  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: fundo }}>
    <T peso="negrito" tam={11} cor={cor}>
      {texto}
    </T>
  </View>
);

// ---------------------------------------------------------------------------
// Ícones (mesmos traços do design)
// ---------------------------------------------------------------------------

type PropsIcone = { tam?: number; cor?: string };
const Ic = ({ tam = 20, cor = cores.texto, children, traco = 1.8 }: PropsIcone & { children: ReactNode; traco?: number }) => (
  <Svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const Icones = {
  resumo: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M3 11l9-7 9 7" />
      <Path d="M5 10v10h14V10" />
    </Ic>
  ),
  ativos: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M4 19V9" />
      <Path d="M10 19V5" />
      <Path d="M16 19v-7" />
      <Path d="M21 19H3" />
    </Ic>
  ),
  lancamentos: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M7 4v16" />
      <Path d="M4 7l3-3 3 3" />
      <Path d="M17 20V4" />
      <Path d="M14 17l3 3 3-3" />
    </Ic>
  ),
  proventos: (p: PropsIcone) => (
    <Ic {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5" />
      <Path d="M12 6v2" />
      <Path d="M12 16v2" />
    </Ic>
  ),
  olho: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Ic>
  ),
  olhoFechado: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M3 3l18 18" />
      <Path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
      <Path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Ic>
  ),
  baixo: (p: PropsIcone) => (
    <Ic {...p} traco={2}>
      <Path d="M6 9l6 6 6-6" />
    </Ic>
  ),
  voltar: (p: PropsIcone) => (
    <Ic {...p} traco={2}>
      <Path d="M15 18l-6-6 6-6" />
    </Ic>
  ),
  fechar: (p: PropsIcone) => (
    <Ic {...p} traco={2}>
      <Path d="M6 6l12 12" />
      <Path d="M18 6L6 18" />
    </Ic>
  ),
  busca: (p: PropsIcone) => (
    <Ic {...p} traco={2}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-4-4" />
    </Ic>
  ),
  mais: (p: PropsIcone) => (
    <Ic {...p} traco={2}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Ic>
  ),
  enviar: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M12 16V4" />
      <Path d="M7 9l5-5 5 5" />
      <Path d="M4 20h16" />
    </Ic>
  ),
  usuario: (p: PropsIcone) => (
    <Ic {...p}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Ic>
  ),
  atualizar: (p: PropsIcone) => (
    <Ic {...p}>
      <Path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <Path d="M21 4v5h-5" />
    </Ic>
  ),
};
