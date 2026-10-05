import { useState } from 'react';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Campo, T } from '../components/ui';
import { supabase, traduzirErro } from '../lib/supabase';
import { cores } from '../lib/tema';

// Recuperação por código: o e-mail de "Reset password" do Supabase precisa mostrar {{ .Token }} (veja o README).
export default function Recuperar() {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarCodigo() {
    setErro(null);
    if (!email.trim()) return setErro('Informe seu e-mail.');
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setEnviando(false);
    if (error) return setErro(traduzirErro(error));
    setEtapa('codigo');
  }

  async function trocarSenha() {
    setErro(null);
    if (senha.length < 8) return setErro('Use uma senha com pelo menos 8 caracteres.');
    setEnviando(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: codigo.trim(), type: 'recovery' });
    if (error) {
      setEnviando(false);
      return setErro(error.message.match(/expired|invalid/i) ? 'Código inválido ou expirado.' : traduzirErro(error));
    }
    // verifyOtp já abre a sessão; o app vai para o Resumo quando a senha for salva
    const r = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (r.error) setErro(traduzirErro(r.error));
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo="Recuperar senha" />
      {etapa === 'email' ? (
        <>
          <T cor={cores.textoSuave}>Vamos enviar um código para o seu e-mail.</T>
          <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {erro && <Aviso texto={erro} />}
          <Botao rotulo="Enviar código" onPress={enviarCodigo} carregando={enviando} />
        </>
      ) : (
        <>
          <Aviso tipo="info" texto={`Se existir uma conta com ${email.trim()}, o código chega em instantes.`} />
          <Campo rotulo="Código do e-mail" value={codigo} onChangeText={setCodigo} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
          <Campo rotulo="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          {erro && <Aviso texto={erro} />}
          <Botao rotulo="Salvar nova senha" onPress={trocarSenha} carregando={enviando} />
        </>
      )}
    </Tela>
  );
}
