import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Tela } from '../components/Tela';
import { Aviso, Botao, Campo, T } from '../components/ui';
import { supabase, supabaseConfigurado, traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';
import { Marca } from '../components/Marca';

export default function Cadastrar() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cadastrar() {
    setErro(null);
    if (!nome.trim() || !email.trim()) return setErro('Preencha nome e e-mail.');
    if (senha.length < 8) return setErro('Use uma senha com pelo menos 8 caracteres.');
    if (senha !== confirma) return setErro('As senhas não conferem.');
    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    setEnviando(false);
    if (error) return setErro(traduzirErro(error));
    // Sem sessão = o projeto exige confirmar o e-mail antes de entrar
    if (!data.session) setAviso(`Enviamos um link de confirmação para ${email.trim()}. Depois de confirmar, volte e entre com sua senha.`);
  }

  return (
    <Tela semAbas>
      <Marca subtitulo="Crie sua conta para começar a acompanhar sua carteira." />
      {aviso ? (
        <>
          <Aviso tipo="info" texto={aviso} />
          <Botao rotulo="Ir para o login" onPress={() => router.replace('/entrar')} />
        </>
      ) : (
        <>
          <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" textContentType="name" />
          <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <Campo rotulo="Confirmar senha" value={confirma} onChangeText={setConfirma} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={cadastrar} />
          {erro && <Aviso texto={erro} />}
          <Botao rotulo="Criar conta" onPress={cadastrar} carregando={enviando} desativado={!supabaseConfigurado} />
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Link href="/entrar">
              <T cor={cores.textoSuave}>
                Já tem conta? <T peso="negrito" cor={cores.marca}>Entrar</T>
              </T>
            </Link>
          </View>
        </>
      )}
    </Tela>
  );
}
