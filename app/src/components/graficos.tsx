import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { cores, fonte } from '../lib/tema';
import { T } from './ui';

function useLargura(inicial = 320) {
  const [largura, setLargura] = useState(inicial);
  const onLayout = (e: LayoutChangeEvent) => setLargura(Math.max(100, Math.round(e.nativeEvent.layout.width)));
  return { largura, onLayout };
}

export interface SerieLinha {
  valores: (number | null)[];
  cor: string;
  espessura?: number;
  tracejada?: boolean;
}

/** Linhas sobre um eixo x comum (índices). Valores nulos interrompem a série. */
export function GraficoLinhas({
  series,
  altura = 140,
  rotulosX = [],
  descricao,
  incluirZero = true,
}: {
  series: SerieLinha[];
  altura?: number;
  rotulosX?: string[];
  descricao: string;
  /** Rentabilidade parte do zero; preço não precisa */
  incluirZero?: boolean;
}) {
  const { largura, onLayout } = useLargura();
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v != null));
  const n = Math.max(...series.map((s) => s.valores.length), 0);
  if (n < 2 || todos.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height: altura, alignItems: 'center', justifyContent: 'center' }}>
        <T tam={13} cor={cores.textoSuave}>
          Ainda não há histórico suficiente para o gráfico.
        </T>
      </View>
    );
  }
  let min = incluirZero ? Math.min(...todos, 0) : Math.min(...todos);
  let max = incluirZero ? Math.max(...todos, 0) : Math.max(...todos);
  if (max - min < 1e-9) {
    max += 1;
    min -= 1;
  }
  const pad = 6;
  const y = (v: number) => pad + (altura - 2 * pad) * (1 - (v - min) / (max - min));
  const x = (i: number) => (largura * i) / (n - 1);
  const zero = y(0);

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={descricao}>
      <Svg width={largura} height={altura}>
        {incluirZero && <Line x1={0} y1={zero} x2={largura} y2={zero} stroke={cores.borda} strokeWidth={1} />}
        <Line x1={0} y1={pad} x2={largura} y2={pad} stroke={cores.bordaSuave} strokeWidth={1} />
        <Line x1={0} y1={altura - pad} x2={largura} y2={altura - pad} stroke={cores.bordaSuave} strokeWidth={1} />
        {series.map((s, k) => {
          // quebra em trechos contínuos
          const trechos: string[] = [];
          let atual: string[] = [];
          s.valores.forEach((v, i) => {
            if (v == null) {
              if (atual.length > 1) trechos.push(atual.join(' '));
              atual = [];
            } else atual.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
          });
          if (atual.length > 1) trechos.push(atual.join(' '));
          return trechos.map((pts, j) => (
            <Polyline
              key={`${k}-${j}`}
              points={pts}
              fill="none"
              stroke={s.cor}
              strokeWidth={s.espessura ?? 2}
              strokeDasharray={s.tracejada ? '4 4' : undefined}
              strokeLinejoin="round"
            />
          ));
        })}
        {(() => {
          const s = series[series.length - 1];
          const ult = s.valores.length - 1;
          const v = s.valores[ult];
          return v != null ? <Circle cx={x(ult)} cy={y(v)} r={4} fill={s.cor} /> : null;
        })()}
      </Svg>
      {rotulosX.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {rotulosX.map((r, i) => (
            <T key={i} tam={11} cor={cores.textoSuave}>
              {r}
            </T>
          ))}
        </View>
      )}
    </View>
  );
}

export function Rosca({
  fatias,
  tam = 120,
  linha1,
  linha2,
  descricao,
}: {
  fatias: { valor: number; cor: string }[];
  tam?: number;
  linha1?: string;
  linha2?: string;
  descricao: string;
}) {
  const r = tam / 2 - 16;
  const c = 2 * Math.PI * r;
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  let acumulado = 0;
  return (
    <View accessible accessibilityLabel={descricao}>
      <Svg width={tam} height={tam}>
        <Circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={cores.bordaSuave} strokeWidth={18} />
        {total > 0 &&
          fatias.map((f, i) => {
            const comp = (f.valor / total) * c;
            const el = (
              <Circle
                key={i}
                cx={tam / 2}
                cy={tam / 2}
                r={r}
                fill="none"
                stroke={f.cor}
                strokeWidth={18}
                strokeDasharray={`${comp} ${c - comp}`}
                strokeDashoffset={-acumulado}
                transform={`rotate(-90 ${tam / 2} ${tam / 2})`}
              />
            );
            acumulado += comp;
            return el;
          })}
        {linha1 ? (
          <SvgText x={tam / 2} y={tam / 2 - 3} textAnchor="middle" fontFamily={fonte.semi} fontSize={11} fill={cores.textoSuave}>
            {linha1}
          </SvgText>
        ) : null}
        {linha2 ? (
          <SvgText x={tam / 2} y={tam / 2 + 13} textAnchor="middle" fontFamily={fonte.extra} fontSize={14} fill={cores.texto}>
            {linha2}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

/** Barras empilhadas por mês */
export function Barras({
  grupos,
  altura = 140,
  descricao,
}: {
  grupos: { rotulo: string; partes: { valor: number; cor: string }[] }[];
  altura?: number;
  descricao: string;
}) {
  const { largura, onLayout } = useLargura();
  const max = Math.max(...grupos.map((g) => g.partes.reduce((s, p) => s + p.valor, 0)), 0);
  const n = grupos.length || 1;
  const passo = largura / n;
  const lb = Math.min(18, passo * 0.6);
  return (
    <View onLayout={onLayout} accessible accessibilityLabel={descricao}>
      <Svg width={largura} height={altura}>
        <Line x1={0} y1={altura - 0.5} x2={largura} y2={altura - 0.5} stroke={cores.borda} strokeWidth={1} />
        {grupos.map((g, i) => {
          let topo = altura;
          return g.partes.map((p, j) => {
            const h = max > 0 ? (p.valor / max) * (altura - 4) : 0;
            topo -= h;
            return h > 0 ? <Rect key={`${i}-${j}`} x={i * passo + (passo - lb) / 2} y={topo} width={lb} height={h} rx={j === g.partes.length - 1 ? 3 : 0} fill={p.cor} /> : null;
          });
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {grupos.map((g, i) => (
          <T key={i} tam={10} cor={cores.textoSuave} style={{ width: passo, textAlign: 'center' }}>
            {i % 2 === (n - 1) % 2 ? g.rotulo : ''}
          </T>
        ))}
      </View>
    </View>
  );
}

export const Legenda = ({ cor, rotulo, tracejada }: { cor: string; rotulo: string; tracejada?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View
      style={
        tracejada
          ? { width: 12, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: cor }
          : { width: 12, height: 3, borderRadius: 2, backgroundColor: cor }
      }
    />
    <T tam={12} cor={cores.textoSuave}>
      {rotulo}
    </T>
  </View>
);
