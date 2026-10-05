import { useState } from 'react';
import { Cabecalho, Tela } from '../components/Tela';
import { Aviso, Botao, Campo, Cartao, Linha, Rotulo, T, Titulo } from '../components/ui';
import { useSessao } from '../contexto/Sessao';
import { confirmar } from '../lib/confirmar';
import { supabase, traduzirErro } from '../lib/supabase';

export default function Conta() {
  const { sessao, sair } = useSessao();
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const user = sessao?.user;

  async function trocarSenha() {
    if (senha.length < 8) return setMsg({ t: 'Use uma senha com pelo menos 8 caracteres.', erro: true });
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    setSenha('');
    setMsg(error ? { t: traduzirErro(error), erro: true } : { t: 'Senha alterada.' });
  }

  return (
    <Tela semAbas>
      <Cabecalho titulo="Conta" fechar />
      <Cartao>
        <Linha>
          <Rotulo>Nome</Rotulo>
          <T peso="negrito">{(user?.user_metadata?.nome as string) ?? '—'}</T>
        </Linha>
        <Linha>
          <Rotulo>E-mail</Rotulo>
          <T peso="negrito">{user?.email}</T>
        </Linha>
      </Cartao>
      <Cartao>
        <Titulo>Trocar senha</Titulo>
        <Campo rotulo="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" />
        <Botao rotulo="Salvar nova senha" tipo="secundario" onPress={trocarSenha} carregando={salvando} />
      </Cartao>
      {msg && <Aviso texto={msg.t} tipo={msg.erro ? 'erro' : 'info'} />}
      <Botao
        rotulo="Sair"
        tipo="perigo"
        onPress={async () => {
          if (await confirmar('Sair', 'Você vai precisar entrar de novo com e-mail e senha.', 'Sair')) await sair();
        }}
      />
    </Tela>
  );
}
