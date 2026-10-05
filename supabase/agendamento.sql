-- Agenda a sincronização de dados de mercado (rode uma vez no SQL Editor do Supabase,
-- depois de publicar a função "sync" e definir os segredos). Troque os três valores:
--   SEU-PROJETO     -> o id do projeto (está na URL: https://SEU-PROJETO.supabase.co)
--   SUA-CHAVE-ANON  -> Project Settings > API > anon/publishable key
--   SEU-CRON-SECRET -> o mesmo valor que você definiu em CRON_SECRET
-- Horários em UTC (Brasília = UTC-3).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cotações a cada 30 min no pregão (10h às 18h de Brasília, segunda a sexta)
select cron.schedule(
  'carteira-cotacoes',
  '*/30 13-21 * * 1-5',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SUA-CHAVE-ANON',
      'x-cron-secret', 'SEU-CRON-SECRET'
    ),
    body := '{"tarefa":"cotacoes"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Rotina noturna (22h30 de Brasília): fechamento B3, proventos, eventos, indicadores e CDI
select cron.schedule(
  'carteira-noturno',
  '30 1 * * 2-6',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SUA-CHAVE-ANON',
      'x-cron-secret', 'SEU-CRON-SECRET'
    ),
    body := jsonb_build_object('tarefa', 'noturno', 'data', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')),
    timeout_milliseconds := 300000
  );
  $$
);

-- Para conferir:  select * from cron.job;   select * from public.sync_log order by em desc limit 20;
-- Para remover:   select cron.unschedule('carteira-cotacoes'); select cron.unschedule('carteira-noturno');
