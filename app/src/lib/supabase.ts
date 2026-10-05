import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurado = !!url && !!chave;

export const supabase = createClient(url || 'http://localhost', chave || 'sem-chave', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Renova o token só com o app em primeiro plano
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensagens do Supabase Auth em português */
export function traduzirErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const mapa: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/user already registered/i, 'Já existe uma conta com esse e-mail.'],
    [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/unable to validate email|invalid email/i, 'E-mail inválido.'],
    [/rate limit|too many/i, 'Muitas tentativas. Espere um pouco e tente de novo.'],
    [/network|fetch/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  ];
  for (const [re, txt] of mapa) if (re.test(msg)) return txt;
  return msg;
}
