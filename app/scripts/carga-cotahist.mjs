// Carga inicial do histórico de preços a partir dos arquivos anuais COTAHIST da B3.
// O serviço de sincronização só guarda o fechamento do dia a dia em diante (e 3 meses da brapi
// para ativos novos); rode isto uma vez para ter o gráfico de rentabilidade completo.
//
// Uso (no seu computador, dentro de app/):
//   SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/carga-cotahist.mjs 2024 2025 2026
//
// A service_role dá acesso total ao banco: use só no terminal, nunca no app nem no repositório.

import { createClient } from '@supabase/supabase-js';
import { unzipSync } from 'fflate';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anos = process.argv.slice(2);
if (!url || !chave || anos.length === 0) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/carga-cotahist.mjs 2025 2026');
  process.exit(1);
}
const db = createClient(url, chave, { auth: { persistSession: false } });

const { data: emUso, error } = await db.from('tickers_em_uso').select('ticker');
if (error) throw error;
const tickers = new Set(emUso.map((t) => t.ticker));
console.log(`${tickers.size} ativos em uso`);

for (const ano of anos) {
  const arquivo = `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A${ano}.ZIP`;
  console.log(`Baixando ${arquivo} ...`);
  const r = await fetch(arquivo);
  if (!r.ok) {
    console.error(`  falhou: HTTP ${r.status}`);
    continue;
  }
  const zip = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const texto = new TextDecoder('latin1').decode(Object.values(zip)[0]);
  const linhas = [];
  for (const l of texto.split('\n')) {
    if (!l.startsWith('01') || l.slice(24, 27) !== '010') continue;
    const ticker = l.slice(12, 24).trim();
    if (!tickers.has(ticker)) continue;
    const d = l.slice(2, 10);
    linhas.push({ ticker, data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, fechamento: Number(l.slice(108, 121)) / 100 });
  }
  for (let i = 0; i < linhas.length; i += 1000) {
    const { error: e } = await db.from('precos_historicos').upsert(linhas.slice(i, i + 1000));
    if (e) throw e;
  }
  console.log(`  ${ano}: ${linhas.length} fechamentos gravados`);
}
