export const cores = {
  fundo: '#F4F5F2',
  cartao: '#FFFFFF',
  borda: '#E3E6E1',
  bordaSuave: '#EEF0EC',
  bordaCampo: '#D5DAD3',
  segmento: '#E6E9E4',
  texto: '#15201B',
  textoSuave: '#5A6660',
  marca: '#0E5C45',
  marcaEscura: '#0A4535',
  marcaClara: '#CFE6DA',
  marcaLinha: '#2D7860',
  positivoNoVerde: '#B9F2D3',
  positivo: '#11734B',
  negativo: '#B42318',
  fii: '#E08A3C',
  cdi: '#C2580A',
  ibov: '#5B6B7A',
  jcp: '#5B6B7A',
};

export const paleta = [cores.marca, cores.fii, '#3B6FB6', '#8C5CB8', '#C2580A', '#2F8F83', '#B8860B', '#6B7A3B', '#A23B5A', cores.ibov];

export const fonte = {
  regular: 'Manrope_400Regular',
  medio: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  negrito: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
};

export const corResultado = (v: number) => (v > 0 ? cores.positivo : v < 0 ? cores.negativo : cores.texto);
