import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Tela } from '../components/Tela';
import { Marca } from '../components/Marca';
import { Aviso, Botao, Campo, T } from '../components/ui';
import { supabase, supabaseConfigurado, traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setErro(null);
    if (!email.trim() || !senha) return setErro('Preencha e-mail e senha.');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(traduzirErro(error));
  }

  return (
    <Tela semAbas>
      <Marca subtitulo="Suas ações e FIIs, preço médio, proventos e rentabilidade em um lugar." />
      {!supabaseConfigurado && (
        <Aviso texto="O app ainda não está ligado ao Supabase. Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo app/.env (veja o README)." />
      )}
      <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={entrar} />
      {erro && <Aviso texto={erro} />}
      <Botao rotulo="Entrar" onPress={entrar} carregando={enviando} desativado={!supabaseConfigurado} />
      <View style={{ alignItems: 'center', gap: 16, marginTop: 8 }}>
        <Link href="/recuperar">
          <T peso="negrito" cor={cores.marca}>
            Esqueci minha senha
          </T>
        </Link>
        <Link href="/cadastrar">
          <T cor={cores.textoSuave}>
            Não tem conta? <T peso="negrito" cor={cores.marca}>Criar conta</T>
          </T>
        </Link>
      </View>
    </Tela>
  );
}
