import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, supabaseConfigurado } from '../lib/supabase';

interface ValorSessao {
  sessao: Session | null;
  carregando: boolean;
  sair: () => Promise<void>;
}

const Contexto = createContext<ValorSessao>({ sessao: null, carregando: true, sair: async () => {} });

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Contexto.Provider value={{ sessao, carregando, sair: async () => void (await supabase.auth.signOut()) }}>
      {children}
    </Contexto.Provider>
  );
}

export const useSessao = () => useContext(Contexto);
