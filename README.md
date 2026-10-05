# Carteira digital

App mobile (iOS e Android) para acompanhar uma carteira de ações e FIIs da B3, no estilo do Investidor10: posição, preço médio, resultado, proventos, rentabilidade comparada com CDI e Ibovespa, e importação do extrato da B3.

| Pasta | O que tem |
|---|---|
| `app/` | App em Expo (React Native + TypeScript), com login pelo Supabase |
| `supabase/migrations/` | Banco de dados: tabelas, regras de acesso (RLS) e gatilho que cria a primeira carteira |
| `supabase/functions/sync/` | Serviço que busca cotações, proventos, eventos, indicadores e CDI e grava no banco |
| `supabase/agendamento.sql` | Agenda o serviço (a cada 30 min no pregão e toda noite) |

O app nunca chama as fontes de mercado direto do celular: ele lê do banco, e o serviço `sync` mantém o banco atualizado. Isso protege as chaves e cabe nos planos grátis.

## O que o app faz

- **Conta:** cadastro com nome, e-mail e senha; login; recuperação de senha por código; troca de senha; sair.
- **Carteiras:** várias carteiras por usuário (criar, renomear, excluir, trocar no topo do Resumo).
- **Resumo:** patrimônio, investido, resultado; rentabilidade em 1M/6M/12M/Tudo contra CDI e Ibovespa (método da cota, que não distorce com aportes); proventos do mês e a receber; distribuição por classe, setor ou ativo; maior alta e maior baixa; botão para ocultar valores.
- **Ativos:** posição agrupada por classe, com busca, filtro e ordenação.
- **Ativo:** cotação, gráfico, indicadores (ações: DY, P/L, P/VP; FIIs: P/VP, DY, vacância), sua posição, suas operações, proventos e eventos corporativos.
- **Lançamentos:** histórico por mês com filtro; novo lançamento com prévia do preço médio e do lucro na venda; editar e excluir.
- **Importar B3:** lê o Excel de *Extratos > Negociação* da Área do Investidor, mostra a prévia e ignora o que já foi importado.
- **Proventos:** 12 meses, média mensal, yield on cost, gráfico mensal, a receber e ranking. Calculados pela sua posição na data com; JCP líquido de 15% de IR.
- **Correções manuais:** proventos e eventos (desdobramento, grupamento, bonificação) podem ser lançados à mão. Um lançamento manual com o mesmo ativo, tipo e data com substitui o que veio da B3.

## Como colocar para funcionar

### 1. Supabase (banco e login), grátis

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região São Paulo).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261005000000_esquema_inicial.sql` e clique em **Run**.
3. Em **Authentication > Email Templates > Reset Password**, inclua o código no texto do e-mail, por exemplo: `Seu código para trocar a senha: {{ .Token }}`. O app pede esse código.
4. (Opcional, para uso pessoal) Em **Authentication > Providers > Email**, desligue *Confirm email* para entrar logo depois do cadastro.

### 2. Rodar o app no celular

Precisa de Node 20+ no computador e do app **Expo Go** no celular.

```bash
cd app
cp .env.example .env      # preencha com Project Settings > API: URL e chave anon/publishable
npm install
npx expo start            # escaneie o QR code com a câmera (iPhone) ou com o Expo Go (Android)
```

A chave **anon/publishable** é pública e pode ficar no app. A **service_role** nunca vai no app nem no repositório.

### 3. Dados de mercado

1. Crie contas grátis na [brapi](https://brapi.dev) e na [bolsai](https://usebolsai.com) e copie os tokens.
2. Instale a CLI e publique a função (no seu computador, na raiz do repositório):

   ```bash
   npx supabase login
   npx supabase link --project-ref SEU-PROJETO
   npx supabase secrets set BRAPI_TOKEN=... BOLSAI_TOKEN=... CRON_SECRET=uma-senha-longa-qualquer
   npx supabase functions deploy sync
   ```

3. Abra `supabase/agendamento.sql`, troque os três valores indicados no topo e rode no SQL Editor.
4. (Opcional) Para ter o histórico de preços completo desde a sua primeira compra, rode uma vez:

   ```bash
   cd app
   SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/carga-cotahist.mjs 2024 2025 2026
   ```

Sem o passo 3 o app funciona, mas sem cotações: o valor da posição usa o preço médio até a primeira sincronização. Puxar a tela para baixo no Resumo pede uma atualização na hora.

| Dado | Fonte | Quando |
|---|---|---|
| Cotação e Ibovespa | brapi grátis | a cada 30 min no pregão |
| Fechamento oficial | B3 COTAHIST | toda noite |
| Proventos e eventos | site da B3 | toda noite e ao lançar um ativo novo |
| Indicadores | bolsai grátis | toda noite |
| CDI | Banco Central (SGS 12) | toda noite |

O resultado de cada rodada fica na tabela `sync_log`.

### 4. Instalar de verdade (sem depender do computador)

Com uma conta grátis na Expo: `npx eas-cli@latest build --platform android --profile preview` gera um APK para instalar no Android. No iPhone é preciso a conta de desenvolvedor da Apple.

## Desenvolvimento

```bash
cd app
npm test            # cálculos de posição, preço médio, eventos, proventos, rentabilidade e importação B3
npm run typecheck
```

## Pontos a conferir com dados reais

Estes trechos foram escritos pela documentação pública, sem poder chamar as fontes deste ambiente:

- Campos do JSON de proventos da B3 (`cashDividends`, `stockDividends`) e o significado do campo `factor` em grupamentos (`fatorB3` em `supabase/functions/sync/index.ts`).
- Endereço e nomes dos campos da bolsai (`BOLSAI_BASE_URL` e a função `indicadores`).
- O histórico inicial da brapi pode vir ajustado por proventos; o fechamento diário da B3 (COTAHIST) não é ajustado, que é o que o cálculo espera.
