// Serviço de sincronização de dados de mercado (Supabase Edge Function, Deno).
//
// O app nunca chama as fontes direto: esta função busca e grava no banco.
//   brapi (grátis)  -> cotação do dia e Ibovespa, a cada 30 min no pregão
//   B3 COTAHIST     -> preço de fechamento oficial (sem ajuste), toda noite
//   B3 (site)       -> proventos, desdobramentos, grupamentos e bonificações, toda noite
//   bolsai (grátis) -> indicadores (DY, P/L, P/VP; FII: P/VP, DY, vacância), toda noite
//   BCB SGS 12      -> CDI diário, toda noite
//
// Chamadas:
//   agendador (pg_cron): POST {"tarefa": "cotacoes" | "noturno"} com header x-cron-secret
//   app (usuário logado): POST {"tickers": [...]} -> cotação + proventos só desses ativos
//
// Variáveis (supabase secrets set ...): BRAPI_TOKEN, BOLSAI_TOKEN, CRON_SECRET
// Opcional: BOLSAI_BASE_URL (padrão https://api.usebolsai.com/v1)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BRAPI_TOKEN = Deno.env.get('BRAPI_TOKEN') ?? '';
const BOLSAI_TOKEN = Deno.env.get('BOLSAI_TOKEN') ?? '';
const BOLSAI_BASE_URL = Deno.env.get('BOLSAI_BASE_URL') ?? 'https://api.usebolsai.com/v1';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const MAX_TICKERS_USUARIO = 40;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type Db = SupabaseClient;
interface AtivoUso {
  ticker: string;
  classe: string;
}

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const brParaIso = (s: string | null | undefined) => {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const numeroBr = (s: unknown): number | null => {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string' || !s.trim()) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, init?: RequestInit, tentativas = 2): Promise<unknown> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, init);
    if (r.status === 429 && i < tentativas) {
      await esperar(Number(r.headers.get('retry-after') ?? 5) * 1000);
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} em ${url.replace(/token=[^&]+/, 'token=***')}`);
    return r.json();
  }
}

async function registrar(db: Db, fonte: string, ok: boolean, mensagem: string) {
  await db.from('sync_log').insert({ fonte, ok, mensagem: mensagem.slice(0, 2000) });
}

async function tickersEmUso(db: Db): Promise<AtivoUso[]> {
  const { data, error } = await db.from('tickers_em_uso').select('ticker, classe');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// brapi: cotação e Ibovespa
// ---------------------------------------------------------------------------

async function cotacoes(db: Db, ativos: AtivoUso[], comIbov: boolean) {
  if (!BRAPI_TOKEN) return registrar(db, 'brapi', false, 'BRAPI_TOKEN não configurado');
  const falhas: string[] = [];
  // plano grátis: 1 ativo por chamada
  for (const a of ativos) {
    try {
      const j = (await getJson(`https://brapi.dev/api/quote/${a.ticker}?token=${BRAPI_TOKEN}`)) as { results?: Record<string, unknown>[] };
      const r = j.results?.[0];
      if (!r || typeof r.regularMarketPrice !== 'number') throw new Error('sem preço');
      const { data: atual } = await db.from('ativos').select('nome').eq('ticker', a.ticker).single();
      await db
        .from('ativos')
        .update({
          cotacao: r.regularMarketPrice,
          variacao_dia: typeof r.regularMarketChangePercent === 'number' ? r.regularMarketChangePercent : null,
          cotacao_em: new Date().toISOString(),
          ...(atual?.nome ? {} : { nome: (r.longName as string) || (r.shortName as string) || null }),
        })
        .eq('ticker', a.ticker);
    } catch (e) {
      falhas.push(`${a.ticker}: ${(e as Error).message}`);
    }
  }
  if (comIbov) {
    try {
      const j = (await getJson(`https://brapi.dev/api/quote/%5EBVSP?token=${BRAPI_TOKEN}`)) as { results?: Record<string, unknown>[] };
      const v = j.results?.[0]?.regularMarketPrice;
      if (typeof v === 'number') await db.from('indices').upsert({ serie: 'IBOV', data: hojeSP(), valor: v });
    } catch (e) {
      falhas.push(`IBOV: ${(e as Error).message}`);
    }
  }
  await registrar(db, 'brapi', falhas.length === 0, falhas.length ? falhas.join('; ') : `${ativos.length} cotações`);
}

/** Ativo sem nenhum histórico: carrega os últimos 3 meses da brapi (limite do plano grátis) */
async function historicoInicial(db: Db, ativos: AtivoUso[]) {
  if (!BRAPI_TOKEN) return;
  for (const a of ativos) {
    const { count } = await db.from('precos_historicos').select('*', { count: 'exact', head: true }).eq('ticker', a.ticker);
    if (count) continue;
    try {
      const j = (await getJson(`https://brapi.dev/api/quote/${a.ticker}?range=3mo&interval=1d&token=${BRAPI_TOKEN}`)) as {
        results?: { historicalDataPrice?: { date: number; close: number }[] }[];
      };
      const linhas = (j.results?.[0]?.historicalDataPrice ?? [])
        .filter((p) => p.close > 0)
        .map((p) => ({ ticker: a.ticker, data: new Date(p.date * 1000).toISOString().slice(0, 10), fechamento: p.close }));
      if (linhas.length) await db.from('precos_historicos').upsert(linhas);
    } catch (e) {
      await registrar(db, 'brapi-historico', false, `${a.ticker}: ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// B3 COTAHIST diário: fechamento oficial sem ajuste
// ---------------------------------------------------------------------------

export function lerCotahist(texto: string, tickers: Set<string>) {
  const out: { ticker: string; data: string; fechamento: number }[] = [];
  for (const linha of texto.split('\n')) {
    if (!linha.startsWith('01')) continue;
    const tpmerc = linha.slice(24, 27);
    if (tpmerc !== '010') continue; // mercado à vista (fracionário tem o mesmo preço de referência)
    const ticker = linha.slice(12, 24).trim();
    if (!tickers.has(ticker)) continue;
    const d = linha.slice(2, 10);
    out.push({ ticker, data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, fechamento: Number(linha.slice(108, 121)) / 100 });
  }
  return out;
}

async function cotahist(db: Db, ativos: AtivoUso[], dataIso: string) {
  const [a, m, d] = dataIso.split('-');
  const url = `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${d}${m}${a}.ZIP`;
  try {
    const r = await fetch(url);
    if (r.status === 404) return registrar(db, 'cotahist', true, `${dataIso}: sem pregão ou arquivo ainda não publicado`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arquivos = unzipSync(new Uint8Array(await r.arrayBuffer()));
    const conteudo = Object.values(arquivos)[0];
    const texto = new TextDecoder('latin1').decode(conteudo);
    const linhas = lerCotahist(texto, new Set(ativos.map((x) => x.ticker)));
    if (linhas.length) await db.from('precos_historicos').upsert(linhas);
    await registrar(db, 'cotahist', true, `${dataIso}: ${linhas.length} fechamentos`);
  } catch (e) {
    await registrar(db, 'cotahist', false, `${dataIso}: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// B3 site de empresas listadas: proventos e eventos (JSON público, não é API oficial)
// ---------------------------------------------------------------------------

const ISIN_CLASSE: Record<string, string> = { '3': 'OR', '4': 'PR', '5': 'PA', '6': 'PB', '7': 'PC', '8': 'PD' };

/** O ISIN do provento é da mesma classe do ticker? (PETR3 = ...OR, PETR4 = ...PR; 11 aceita todos) */
function mesmaClasse(ticker: string, isin: string | undefined) {
  const sufixo = ticker.slice(4);
  const esperado = ISIN_CLASSE[sufixo];
  if (!esperado || !isin) return true;
  return isin.slice(9, 11) === esperado;
}

function tipoProvento(label: string): 'dividendo' | 'jcp' | 'rendimento' | null {
  const l = label.toUpperCase();
  if (l.includes('JRS') || l.includes('JUROS')) return 'jcp';
  if (l.includes('RENDIMENTO')) return 'rendimento';
  if (l.includes('DIVIDENDO')) return 'dividendo';
  return null;
}

/** Fator que multiplica a quantidade. A B3 publica desdobramento e bonificação em %, grupamento como fração. Conferir. */
export function fatorB3(label: string, factor: number): { tipo: 'desdobramento' | 'grupamento' | 'bonificacao'; fator: number } | null {
  const l = label.toUpperCase();
  if (l.includes('DESDOBRAMENTO')) return { tipo: 'desdobramento', fator: 1 + factor / 100 };
  if (l.includes('BONIFICA')) return { tipo: 'bonificacao', fator: 1 + factor / 100 };
  if (l.includes('GRUPAMENTO')) return { tipo: 'grupamento', fator: factor < 1 ? factor : 1 / factor };
  return null;
}

const b64 = (o: unknown) => btoa(JSON.stringify(o));

async function proventosB3(db: Db, ativos: AtivoUso[]) {
  const falhas: string[] = [];
  let nProv = 0;
  let nEv = 0;
  const porEmissor = new Map<string, AtivoUso[]>();
  for (const a of ativos) porEmissor.set(a.ticker.slice(0, 4), [...(porEmissor.get(a.ticker.slice(0, 4)) ?? []), a]);

  for (const [emissor, lista] of porEmissor) {
    try {
      const fii = lista.some((a) => a.classe === 'fii');
      const url = fii
        ? `https://sistemaswebb3-listados.b3.com.br/fundsListedProxy/Search/GetListedSupplementFunds/${b64({ cnpj: '0', identifierFund: emissor, typeFund: 7 })}`
        : `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/${b64({ issuingCompany: emissor, language: 'pt-br' })}`;
      const bruto = (await getJson(url)) as unknown;
      const j = (Array.isArray(bruto) ? bruto[0] : bruto) as {
        cashDividends?: Record<string, string>[];
        stockDividends?: Record<string, string>[];
      } | null;
      if (!j) continue;

      for (const a of lista) {
        const provs = (j.cashDividends ?? [])
          .filter((c) => mesmaClasse(a.ticker, c.isinCode ?? c.assetIssued))
          .map((c) => ({
            ticker: a.ticker,
            tipo: tipoProvento(c.label ?? c.corporateAction ?? '') ?? (fii ? 'rendimento' : null),
            valor_por_cota: numeroBr(c.rate ?? c.value),
            data_com: brParaIso(c.lastDatePrior ?? c.lastDatePriorEx),
            data_pagamento: brParaIso(c.paymentDate),
            fonte: 'b3',
            user_id: null,
          }))
          .filter((p) => p.tipo && p.valor_por_cota && p.valor_por_cota > 0 && p.data_com);
        if (provs.length) {
          const { error } = await db.from('proventos').upsert(provs, { onConflict: 'escopo,ticker,tipo,data_com,valor_por_cota', ignoreDuplicates: true });
          if (error) throw error;
          nProv += provs.length;
        }

        const evs = (j.stockDividends ?? [])
          .filter((s) => mesmaClasse(a.ticker, s.isinCode ?? s.assetIssued))
          .map((s) => {
            const f = fatorB3(s.label ?? '', numeroBr(s.factor) ?? 0);
            return f && f.fator > 0 && f.fator !== 1
              ? { ticker: a.ticker, tipo: f.tipo, fator: f.fator, data_com: brParaIso(s.lastDatePrior), fonte: 'b3', user_id: null }
              : null;
          })
          .filter((e): e is NonNullable<typeof e> => !!e && !!e.data_com);
        if (evs.length) {
          const { error } = await db.from('eventos_corporativos').upsert(evs, { onConflict: 'escopo,ticker,tipo,data_com', ignoreDuplicates: true });
          if (error) throw error;
          nEv += evs.length;
        }
      }
    } catch (e) {
      falhas.push(`${emissor}: ${(e as Error).message}`);
    }
    await esperar(300); // gentileza com o site da B3
  }
  await registrar(db, 'b3-proventos', falhas.length === 0, `${nProv} proventos, ${nEv} eventos${falhas.length ? '; falhas: ' + falhas.join('; ') : ''}`);
}

// ---------------------------------------------------------------------------
// bolsai (grátis): indicadores atuais
// ---------------------------------------------------------------------------

function pegar(o: Record<string, unknown>, nomes: string[]): number | null {
  for (const n of nomes) {
    const v = o[n];
    const x = typeof v === 'number' ? v : numeroBr(v);
    if (x != null) return x;
  }
  return null;
}

async function indicadores(db: Db, ativos: AtivoUso[]) {
  if (!BOLSAI_TOKEN) return registrar(db, 'bolsai', false, 'BOLSAI_TOKEN não configurado');
  const falhas: string[] = [];
  for (const a of ativos) {
    try {
      const caminho = a.classe === 'fii' ? `fiis/${a.ticker}` : `fundamentals/${a.ticker}`;
      const bruto = (await getJson(`${BOLSAI_BASE_URL}/${caminho}`, { headers: { Authorization: `Bearer ${BOLSAI_TOKEN}`, 'X-API-Key': BOLSAI_TOKEN } })) as Record<string, unknown>;
      const o = ((bruto.data as Record<string, unknown>) ?? bruto) as Record<string, unknown>;
      const ind = {
        dy: pegar(o, ['dy', 'dividend_yield', 'dividendYield', 'dy_12m']),
        pl: pegar(o, ['pl', 'p_l', 'pe', 'price_earnings', 'priceEarnings']),
        pvp: pegar(o, ['pvp', 'p_vp', 'pb', 'price_to_book', 'priceToBook']),
        roe: pegar(o, ['roe']),
        vacancia: pegar(o, ['vacancia', 'vacancy', 'vacancia_fisica', 'physical_vacancy']),
      };
      // DY e vacância podem vir como fração (0,085) ou % (8,5); o app espera %
      for (const k of ['dy', 'vacancia', 'roe'] as const) if (ind[k] != null && Math.abs(ind[k]!) < 1) ind[k] = ind[k]! * 100;
      const setor = (o.sector ?? o.setor ?? o.segment ?? o.segmento) as string | undefined;
      await db
        .from('ativos')
        .update({ indicadores: ind, indicadores_em: new Date().toISOString(), ...(setor ? { setor } : {}) })
        .eq('ticker', a.ticker);
    } catch (e) {
      falhas.push(`${a.ticker}: ${(e as Error).message}`);
    }
  }
  await registrar(db, 'bolsai', falhas.length === 0, falhas.length ? falhas.join('; ') : `${ativos.length} ativos`);
}

// ---------------------------------------------------------------------------
// BCB SGS série 12: CDI diário (% ao dia)
// ---------------------------------------------------------------------------

async function cdi(db: Db) {
  try {
    const { data: ultimo } = await db.from('indices').select('data').eq('serie', 'CDI').order('data', { ascending: false }).limit(1).maybeSingle();
    // primeira carga: 10 anos (limite por consulta); depois, desde o último dia salvo
    const inicio = ultimo?.data ? new Date(ultimo.data) : new Date(Date.now() - 10 * 365 * 86400000);
    const br = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${br(inicio)}&dataFinal=${br(new Date())}`;
    const lista = (await getJson(url)) as { data: string; valor: string }[];
    const linhas = lista.map((p) => ({ serie: 'CDI', data: brParaIso(p.data), valor: Number(p.valor) })).filter((p) => p.data && Number.isFinite(p.valor));
    for (let i = 0; i < linhas.length; i += 1000) await db.from('indices').upsert(linhas.slice(i, i + 1000));
    await registrar(db, 'bcb-cdi', true, `${linhas.length} dias`);
  } catch (e) {
    await registrar(db, 'bcb-cdi', false, (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// entrada
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const resp = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const corpo = (await req.json().catch(() => ({}))) as { tarefa?: string; tickers?: string[]; data?: string };

  // Agendador
  if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
    const ativos = await tickersEmUso(db);
    if (corpo.tarefa === 'cotacoes') {
      await cotacoes(db, ativos, true);
    } else if (corpo.tarefa === 'noturno') {
      await cotacoes(db, ativos, true); // fecha o Ibovespa do dia
      await cotahist(db, ativos, corpo.data ?? hojeSP());
      await historicoInicial(db, ativos);
      await proventosB3(db, ativos);
      await indicadores(db, ativos);
      await cdi(db);
    } else return resp({ erro: 'tarefa desconhecida' }, 400);
    return resp({ ok: true, ativos: ativos.length });
  }

  // Usuário logado pedindo atualização dos próprios ativos
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return resp({ erro: 'não autorizado' }, 401);
  const pedidos = [...new Set((corpo.tickers ?? []).map((t) => String(t).toUpperCase()))].slice(0, MAX_TICKERS_USUARIO);
  const { data: ativos } = await db.from('ativos').select('ticker, classe').in('ticker', pedidos.length ? pedidos : ['-']);
  if (!ativos?.length) return resp({ ok: true, ativos: 0 });

  // Cotação só se a última tiver mais de 15 min, para não gastar a cota da brapi à toa
  const { data: recentes } = await db.from('ativos').select('ticker, cotacao_em, nome').in('ticker', ativos.map((a) => a.ticker));
  const velhos = ativos.filter((a) => {
    const r = recentes?.find((x) => x.ticker === a.ticker);
    return !r?.cotacao_em || Date.now() - new Date(r.cotacao_em).getTime() > 15 * 60000;
  });
  const novos = ativos.filter((a) => !recentes?.find((x) => x.ticker === a.ticker)?.nome);
  if (velhos.length) await cotacoes(db, velhos, false);
  if (novos.length) {
    await historicoInicial(db, novos);
    await proventosB3(db, novos);
    await indicadores(db, novos);
  }
  return resp({ ok: true, ativos: velhos.length, novos: novos.length });
});
