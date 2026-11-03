import { useState, useMemo, useEffect, cloneElement } from 'react';
import { flushSync } from 'react-dom';
import Icone from '../components/Icone';
import { ComposedChart, AreaChart, Area, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { CMVCATS, DEDUCOES_CATS, SGA_CATS, NAOOP_CATS, GASTOS_CATS, APORTE_CATS } from '../services/constants';
import { fmt, hoje, MESES, MESES_FULL, upgradeNoCaixa, deducaoNaVenda } from '../services/utils';
import './Relatorio.css';

const FIXOS_CATS = ['Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Marketing','Softwares / Tecnologias','Serviços Terceirizados','Impostos'];

function calcPeriodo(lancamentos, inicio, fim) {
  const lm        = lancamentos.filter(l => l.data >= inicio && l.data <= fim);
  const fat       = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && !APORTE_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const deducoes  = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const recLiq    = fat - deducoes;
  const cmvTotal  = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const sga       = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp     = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const gastos    = lm.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto  = recLiq - cmvTotal;
  const lucLiq    = recLiq - cmvTotal - sga - naoOp;

  const aps         = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && !l.isCMV && l.status !== 'Pendente');
  const fatAp       = aps.reduce((a, l) => a + l.valor, 0);
  const uni         = aps.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket      = uni > 0 ? fatAp / uni : 0;
  const apGrupoIds  = new Set(aps.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvAp       = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedAp       = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0)
                    + aps.reduce((a, l) => a + deducaoNaVenda(l), 0);
  const lucMedio    = uni > 0 ? (fatAp - cmvAp - dedAp) / uni : 0;

  const accs        = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Acessórios' && !l.isCMV && l.status !== 'Pendente');
  const fatAcc      = accs.reduce((a, l) => a + l.valor, 0);
  const uniAcc      = accs.reduce((a, l) => a + (l.quantidade || 1), 0);
  const accGrupoIds = new Set(accs.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvAcc      = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && accGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedAcc      = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && accGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0)
                    + accs.reduce((a, l) => a + deducaoNaVenda(l), 0);
  const lucAcc      = fatAcc - cmvAcc - dedAcc;

  const lmDFC        = lm.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
  const entBruto     = lmDFC.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0);
  const dedInline    = lmDFC.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const upgradeInline = lmDFC.reduce((a, l) => a + upgradeNoCaixa(l), 0);
  const entCaixa     = entBruto - upgradeInline;
  const saiCaixa     = lmDFC.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0) + dedInline;
  const caixaLiq     = entCaixa - saiCaixa;
  const margemBruta = fat > 0 ? lucBruto / fat * 100 : 0;

  const cvIndiretos = lm.filter(l => l.tipo === 'Saída' && l.categoria === 'Custos Variáveis Indiretos' && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const custoFixos  = lm.filter(l => l.tipo === 'Saída' && FIXOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);

  // Margem de contribuição e ponto de equilíbrio com a mesma conta do score
  const imc         = fat > 0 ? (fat - cmvTotal - cvIndiretos) / fat : 0;
  const pe          = imc > 0 ? custoFixos / imc : 0;

  return { fat, deducoes, cmvTotal, sga, naoOp, gastos, lucBruto, lucLiq,
           uni, fatAp, ticket, lucMedio, uniAcc, fatAcc, cmvAcc, lucAcc,
           entCaixa, saiCaixa, caixaLiq, margemBruta, cvIndiretos, custoFixos, imc, pe };
}

function calcScore(d, prevFat) {
  if (d.fat === 0) return { total: 0, pilares: [] };

  const mc_pct = (d.fat - d.cmvTotal - d.cvIndiretos) / d.fat * 100;
  const mc_pts = mc_pct >= 20 ? 2 : mc_pct >= 10 ? 1 : 0;

  const ml_pct = d.lucLiq / d.fat * 100;
  const ml_pts = ml_pct > 10 ? 2 : ml_pct >= 5 ? 1 : 0;

  const pe     = d.imc > 0 ? d.custoFixos / d.imc : d.fat;
  const ms_pct = (d.fat - pe) / d.fat * 100;
  const ms_pts = ms_pct > 20 ? 2 : ms_pct >= 10 ? 1 : 0;

  const fc_pct = d.caixaLiq / d.fat * 100;
  const fc_pts = d.caixaLiq > 0 ? 2 : fc_pct >= -10 ? 1 : 0;

  const cresc_pct = prevFat > 0 ? (d.fat - prevFat) / prevFat * 100 : 0;
  const cresc_pts = cresc_pct > 5 ? 2 : cresc_pct >= -5 ? 1 : 0;

  const pts  = mc_pts + ml_pts + ms_pts + fc_pts + cresc_pts;
  return {
    total: pts / 10 * 100,
    pilares: [
      { label: 'Margem de contribuição', valor: pct1(mc_pct), pts: mc_pts, regra: 'de 20% a 30% (ou mais) vale 2 · de 10% a 20% vale 1' },
      { label: 'Margem líquida',         valor: pct1(ml_pct), pts: ml_pts, regra: 'acima de 10% vale 2 · de 5% a 10% vale 1' },
      { label: 'Margem de segurança',    valor: pct1(ms_pct), pts: ms_pts, regra: 'quanto vendeu acima do ponto de equilíbrio' },
      { label: 'Geração de caixa',       valor: pct1(fc_pct), pts: fc_pts, regra: 'caixa positivo vale 2' },
      { label: 'Crescimento da receita', valor: prevFat > 0 ? sinal(cresc_pct) + pct1(cresc_pct) : '—', pts: cresc_pts, regra: 'acima de 5% vale 2 · estável vale 1' },
    ],
  };
}

// ── Formatação ──
const pct1  = v => `${(v || 0).toFixed(1).replace('.', ',')}%`;
const sinal = v => (v > 0 ? '+' : '');
function fmtK(v) {
  const a = Math.abs(v || 0), s = v < 0 ? '–' : '';
  if (a >= 1e6)  return `${s}R$ ${(a / 1e6).toFixed(2).replace('.', ',')} mi`;
  if (a >= 1e4)  return `${s}R$ ${Math.round(a / 1e3)} mil`;
  if (a >= 1e3)  return `${s}R$ ${(a / 1e3).toFixed(1).replace('.', ',')} mil`;
  return `${s}R$ ${Math.round(a)}`;
}
const eixoK = v => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v);

function mesAnterior(chave, n = 1) {
  const [y, m] = chave.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const nomeMes  = chave => MESES_FULL[parseInt(chave.slice(5, 7)) - 1];
const curtoMes = chave => MESES[parseInt(chave.slice(5, 7)) - 1];

// Variação contra o mês anterior: percentual, diferença em valor e o valor do mês anterior.
// formato: 'moeda' | 'num' | 'pct' (indicador em %, varia em pontos); `inverso` quando subir é ruim (despesa)
function Delta({ atual, anterior, inverso = false, formato = 'moeda', rotulo }) {
  const pontos = formato === 'pct';
  if (anterior == null || (!pontos && !anterior)) return <span className="rel-delta neutro">sem base de comparação</span>;
  const dif = atual - anterior;
  if (Math.abs(dif) < (pontos ? 0.05 : 0.5)) return <span className="rel-delta neutro">estável vs {rotulo}</span>;
  const bom = inverso ? dif < 0 : dif > 0;
  const mostra = v => (formato === 'moeda' ? fmtK(v) : formato === 'num' ? Math.round(v).toLocaleString('pt-BR') : pct1(v));
  const varPct = Math.abs(dif / anterior * 100);
  return (
    <span className={`rel-delta ${bom ? 'bom' : 'ruim'}`}>
      {dif > 0 ? '▲' : '▼'}{' '}
      {pontos
        ? `${Math.abs(dif).toFixed(1).replace('.', ',')} p.p.`
        : <>{varPct >= 1000 ? '>999' : varPct.toFixed(0)}% <b>{dif > 0 ? '+' : '–'}{mostra(Math.abs(dif))}</b></>}
      <small>{rotulo}: {mostra(anterior)}</small>
    </span>
  );
}

function TooltipBRL({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rel-tooltip">
      <div className="rel-tooltip-titulo">{label}</div>
      {payload.map((p, i) => <div key={i}><span>{p.name}</span><strong>{fmt(p.value)}</strong></div>)}
    </div>
  );
}

// Na tela o gráfico acompanha a largura do card; na impressão o navegador não espera ele se redimensionar,
// então desenha direto no tamanho da folha A4 deitada
function Grafico({ imprimindo, largura, altura, children }) {
  if (imprimindo) return cloneElement(children, { width: largura, height: altura });
  return <ResponsiveContainer width="100%" height={altura}>{children}</ResponsiveContainer>;
}

function Spark({ dados, chave, imprimindo }) {
  return (
    <div className="rel-spark" aria-hidden="true">
      <Grafico imprimindo={imprimindo} largura={306} altura={44}>
        <AreaChart data={dados} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sp-${chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b6f23e" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#b6f23e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={chave} stroke="var(--accent)" strokeWidth={2} fill={`url(#sp-${chave})`} isAnimationActive={false}
            dot={false} activeDot={false} />
        </AreaChart>
      </Grafico>
    </div>
  );
}

function Pagina({ titulo, sub, icone, children }) {
  return (
    <section className="rel-pagina">
      <header className="rel-pagina-cab">
        <span className="rel-pagina-icone"><Icone nome={icone} tamanho={17} /></span>
        <div>
          <h2>{titulo}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

const CORES_MIX = ['#b6f23e', 'var(--text)', '#7c8f6a', '#c3cdb9', '#4d8f0a', '#a3a99e', '#e3e8de'];

export default function Relatorio() {
  const { lancamentos, clienteAtivo } = useApp();

  const [mes, setMes] = useState(() => {
    try { const s = localStorage.getItem('rel_mes'); if (s) return s; } catch { /* sem storage */ }
    return mesAnterior(hoje().slice(0, 7));
  });
  function mudarMes(v) { if (!v) return; setMes(v); try { localStorage.setItem('rel_mes', v); } catch { /* sem storage */ } }

  const [verLancamentos, setVerLancamentos] = useState(false);
  const [imprimindo, setImprimindo]         = useState(false);

  useEffect(() => {
    const antes  = () => flushSync(() => setImprimindo(true));
    const depois = () => setImprimindo(false);
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    // Folha deitada e sem margem só enquanto esta tela está aberta (o navegador ignora o tamanho em página nomeada)
    const folha = document.createElement('style');
    folha.textContent = '@page { size: A4 landscape; margin: 0; }';
    document.head.appendChild(folha);
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois); folha.remove(); };
  }, []);

  const inicio = `${mes}-01`, fim = `${mes}-31`;
  const ant    = mesAnterior(mes);
  const rotAnt = curtoMes(ant).toLowerCase();

  // Últimos 6 meses até o mês escolhido
  const serie = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const k = mesAnterior(mes, 5 - i);
    const p = calcPeriodo(lancamentos, `${k}-01`, `${k}-31`);
    return { chave: k, mes: curtoMes(k), Faturamento: p.fat, Lucro: p.lucLiq, Margem: p.fat ? p.lucLiq / p.fat * 100 : 0, Caixa: p.caixaLiq, ...p };
  }), [lancamentos, mes]);

  const d = serie[5];
  const p = serie[4];
  // Cliente novo no sistema: o gráfico começa no primeiro mês com venda (mínimo de 3 barras)
  const primeiro  = serie.findIndex(s => s.fat > 0);
  const serieGraf = serie.slice(Math.max(0, Math.min(primeiro < 0 ? 0 : primeiro, 3)));
  const score = calcScore(d, p.fat);

  const doMes    = useMemo(() => lancamentos.filter(l => l.data >= inicio && l.data <= fim), [lancamentos, inicio, fim]);
  const doMesAnt = useMemo(() => lancamentos.filter(l => l.data >= `${ant}-01` && l.data <= `${ant}-31`), [lancamentos, ant]);

  // Despesas por grupo com o mês anterior ao lado
  const despesas = useMemo(() => {
    const soma = (lista, cat) => lista.filter(l => l.tipo === 'Saída' && l.categoria === cat && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
    return [...SGA_CATS, ...NAOOP_CATS]
      .map(cat => ({ cat, atual: soma(doMes, cat), antes: soma(doMesAnt, cat) }))
      .filter(x => x.atual || x.antes)
      .sort((a, b) => b.atual - a.atual);
  }, [doMes, doMesAnt]);
  const maiorDespesa = Math.max(...despesas.map(x => Math.max(x.atual, x.antes)), 1);

  // Mix de receita
  const mix = useMemo(() => {
    const vendas = doMes.filter(l => l.tipo === 'Entrada' && !l.isCMV && !APORTE_CATS.includes(l.categoria) && l.status !== 'Pendente');
    const total  = vendas.reduce((a, l) => a + l.valor, 0);
    const obj = {};
    vendas.forEach(l => {
      const k = l.categoria === 'Aparelhos' ? (l.subcategoria || 'Aparelhos') : l.categoria;
      obj[k] = (obj[k] || 0) + l.valor;
    });
    // Fatias abaixo de 2% viram "Outros" para a legenda não poluir
    const lista   = Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: total ? v / total * 100 : 0 }));
    const grandes = lista.filter(x => x.pct >= 2), pequenas = lista.filter(x => x.pct < 2);
    if (pequenas.length > 1) grandes.push({ k: 'Outros', v: pequenas.reduce((a, x) => a + x.v, 0), pct: pequenas.reduce((a, x) => a + x.pct, 0) });
    else grandes.push(...pequenas);
    return grandes;
  }, [doMes]);

  // Lucro por modelo: venda menos o CMV do mesmo grupo
  const modelos = useMemo(() => {
    const cmv = {};
    doMes.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId).forEach(l => { cmv[l.grupoId] = (cmv[l.grupoId] || 0) + l.valor; });
    const obj = {};
    doMes.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && !l.isCMV && l.status !== 'Pendente' && l.grupoId && cmv[l.grupoId] != null)
      .forEach(l => {
        const nome = (l.descricao || 'Sem descrição').split(/\s+[—–-]\s+/)[0].trim().toUpperCase();
        const o = obj[nome] ||= { nome, n: 0, venda: 0, lucro: 0 };
        o.n += l.quantidade || 1; o.venda += l.valor; o.lucro += l.valor - cmv[l.grupoId];
      });
    return Object.values(obj).map(o => ({ ...o, margem: o.venda ? o.lucro / o.venda * 100 : 0 }));
  }, [doMes]);
  const topModelos  = [...modelos].sort((a, b) => b.lucro - a.lucro).slice(0, 6);
  const maiorLucroM = Math.max(...topModelos.map(m => m.lucro), 1);

  // Destaques escritos a partir dos números
  const destaques = useMemo(() => {
    if (!d.fat) return [];
    const t = [];
    if (p.fat) {
      const v = (d.fat - p.fat) / p.fat * 100;
      t.push(`Faturamento ${v >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(v).toFixed(0)}% em relação a ${nomeMes(ant).toLowerCase()} (${fmtK(p.fat)} → ${fmtK(d.fat)}).`);
    }
    if (p.fat) {
      t.push(d.lucLiq >= 0
        ? `Lucro líquido de ${fmtK(d.lucLiq)}${p.lucLiq < 0 ? `, saindo de um prejuízo de ${fmtK(-p.lucLiq)} no mês anterior` : `, contra ${fmtK(p.lucLiq)} no mês anterior`}.`
        : `Prejuízo de ${fmtK(-d.lucLiq)} no mês${p.lucLiq >= 0 ? `, depois de lucro de ${fmtK(p.lucLiq)} no mês anterior` : ''}.`);
    }
    if (d.imc > 0) {
      const mcA = d.imc * 100, mcP = p.imc * 100;
      t.push(`Margem de contribuição de ${pct1(mcA)}${p.fat ? ` (${pct1(mcP)} em ${rotAnt})` : ''}: cada ponto de margem vale cerca de ${fmtK(d.fat / 100)} de lucro por mês.`);
    }
    if (d.pe > 0) {
      t.push(d.fat >= d.pe
        ? `O ponto de equilíbrio ficou em ${fmtK(d.pe)}: o faturamento ficou ${fmtK(d.fat - d.pe)} acima dele.`
        : `O faturamento ficou ${fmtK(d.pe - d.fat)} abaixo do ponto de equilíbrio (${fmtK(d.pe)}).`);
    }
    const sub = despesas.filter(x => x.antes > 0 && x.atual - x.antes > 1000).sort((a, b) => (b.atual - b.antes) - (a.atual - a.antes))[0];
    if (sub) t.push(`${sub.cat} subiu ${((sub.atual - sub.antes) / sub.antes * 100).toFixed(0)}% (${fmtK(sub.antes)} → ${fmtK(sub.atual)}).`);
    return t.slice(0, 5);
  }, [d, p, despesas, ant, rotAnt]);

  // Cascata: do faturamento ao lucro
  const cascata = [
    { k: 'Faturamento',          v: d.fat,          tipo: 'base' },
    { k: 'Taxas e deduções',     v: -d.deducoes,    tipo: 'menos' },
    { k: 'Custo dos produtos',   v: -d.cmvTotal,    tipo: 'menos' },
    { k: 'Custos variáveis',     v: -d.cvIndiretos, tipo: 'menos' },
    { k: 'Despesas fixas',       v: -d.custoFixos,  tipo: 'menos' },
    { k: 'Não operacional',      v: -d.naoOp,       tipo: 'menos' },
    { k: 'Lucro líquido',        v: d.lucLiq,       tipo: 'total' },
  ].filter(x => x.tipo !== 'menos' || x.v !== 0);
  let corrente = d.fat;
  const cascataPos = cascata.map(x => {
    if (x.tipo === 'base')  return { ...x, de: 0, ate: x.v };
    if (x.tipo === 'total') return { ...x, de: Math.min(0, x.v), ate: Math.max(0, x.v) };
    const de = corrente + x.v, ate = corrente; corrente = de;
    return { ...x, de, ate };
  });
  const escala = Math.max(d.fat, 1);

  const nomeCliente = clienteAtivo?.obs || clienteAtivo?.nome || '';
  const margemLiq   = d.fat ? d.lucLiq / d.fat * 100 : 0;
  const margemLiqP  = p.fat ? p.lucLiq / p.fat * 100 : null;
  const statusSaude = score.total >= 70 ? ['Saudável', 'bom'] : score.total >= 40 ? ['Atenção', 'medio'] : ['Crítico', 'ruim'];

  return (
    <div className="relatorio-page">

      <div className="rel-barra no-print">
        <div className="rel-barra-titulo">
          <h1>Resumo Executivo</h1>
          <p>{nomeCliente} · {nomeMes(mes)} de {mes.slice(0, 4)}</p>
        </div>
        <div className="rel-barra-acoes">
          <input type="month" id="rel-mes" className="period-select" value={mes} onChange={e => mudarMes(e.target.value)} aria-label="Mês do relatório" />
          <button className="btn btn-ghost btn-sm" onClick={() => setVerLancamentos(v => !v)}>
            <Icone nome="documento" tamanho={14} /> {verLancamentos ? 'Ocultar lançamentos' : 'Ver lançamentos'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!d.fat}>
            <Icone nome="baixar" tamanho={14} /> Baixar PDF
          </button>
        </div>
      </div>


      {verLancamentos && (
        <div className="table-panel no-print">
          {doMes.filter(l => !(l.isCMV && l.grupoId)).length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>Nenhum lançamento neste mês</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Pagamento</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                </thead>
                <tbody>
                  {doMes.filter(l => !(l.isCMV && l.grupoId)).sort((a, b) => (a.data < b.data ? 1 : -1)).map(l => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.data.split('-').reverse().join('/')}</td>
                      <td><span className={`tipo-badge tipo-${l.tipo}`}>{l.tipo}</span></td>
                      <td>{l.categoria}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.descricao || '—'}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.pagamento || '—'}</td>
                      <td style={{ fontSize: 11, color: l.status === 'Pendente' ? 'var(--warn)' : 'var(--text2)' }}>{l.status}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: l.tipo === 'Entrada' ? 'var(--entrada)' : l.tipo === 'Saída' ? 'var(--saida)' : 'var(--transferencia)' }}>
                        {l.tipo === 'Entrada' ? '+' : l.tipo === 'Saída' ? '-' : ''}{fmt(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {d.fat > 0 ? (
        <div className="rel-doc">

          {/* ── Capa ── */}
          <section className="rel-capa">
            <img src="/logo-horizontal.png" alt="SOUZ Finance" className="rel-capa-logo" />
            <div className="rel-capa-centro">
              <span className="rel-capa-eyebrow">Resumo Executivo</span>
              <h1>{nomeCliente}</h1>
              <p className="rel-capa-mes">{nomeMes(mes)} <span>{mes.slice(0, 4)}</span></p>
            </div>
            <div className="rel-capa-kpis">
              <div><span>Faturamento</span><strong>{fmtK(d.fat)}</strong></div>
              <div><span>Lucro líquido</span><strong>{fmtK(d.lucLiq)}</strong></div>
              <div><span>Saúde financeira</span><strong>{Math.round(score.total)}<small>/100</small></strong></div>
            </div>
            <div className="rel-capa-rodape">Preparado por SOUZ Finance · BPO financeiro</div>
          </section>

          {/* ── O mês em números ── */}
          <Pagina titulo="O mês em números" sub={`${nomeMes(mes)} comparado com ${nomeMes(ant).toLowerCase()}`} icone="grafico">
            <div className="rel-hero">
              <article className="rel-hero-card destaque">
                <span className="rel-hero-label">Faturamento</span>
                <strong className="rel-hero-valor">{fmt(d.fat)}</strong>
                <Delta atual={d.fat} anterior={p.fat} rotulo={rotAnt} />
                <Spark dados={serieGraf} chave="Faturamento" imprimindo={imprimindo} />
              </article>
              <article className="rel-hero-card">
                <span className="rel-hero-label">Lucro líquido</span>
                <strong className={`rel-hero-valor ${d.lucLiq < 0 ? 'negativo' : ''}`}>{fmt(d.lucLiq)}</strong>
                <Delta atual={d.lucLiq} anterior={p.fat ? p.lucLiq : null} rotulo={rotAnt} />
                <Spark dados={serieGraf} chave="Lucro" imprimindo={imprimindo} />
              </article>
              <article className="rel-hero-card">
                <span className="rel-hero-label">Margem líquida</span>
                <strong className={`rel-hero-valor ${margemLiq < 0 ? 'negativo' : ''}`}>{pct1(margemLiq)}</strong>
                <Delta atual={margemLiq} anterior={margemLiqP} formato="pct" rotulo={rotAnt} />
                <Spark dados={serieGraf} chave="Margem" imprimindo={imprimindo} />
              </article>
            </div>

            <div className="rel-mini-kpis">
              <div><span>Aparelhos vendidos</span><strong>{d.uni || '—'}</strong><Delta atual={d.uni} anterior={p.uni} formato="num" rotulo={rotAnt} /></div>
              <div><span>Ticket médio</span><strong>{d.uni ? fmt(d.ticket) : '—'}</strong><Delta atual={d.ticket} anterior={p.ticket} rotulo={rotAnt} /></div>
              <div><span>Margem bruta</span><strong>{pct1(d.margemBruta)}</strong><Delta atual={d.margemBruta} anterior={p.fat ? p.margemBruta : null} formato="pct" rotulo={rotAnt} /></div>
              <div><span>Geração de caixa</span><strong className={d.caixaLiq < 0 ? 'negativo' : ''}>{fmtK(d.caixaLiq)}</strong><Delta atual={d.caixaLiq} anterior={p.fat ? p.caixaLiq : null} rotulo={rotAnt} /></div>
            </div>

            {destaques.length > 0 && (
              <div className="rel-destaques">
                <h3>O que aconteceu no mês</h3>
                <ul>{destaques.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
          </Pagina>

          {/* ── Do faturamento ao lucro ── */}
          <Pagina titulo="Do faturamento ao lucro" sub="Para onde foi cada real vendido" icone="moeda">
            <div className="rel-cascata">
              {cascataPos.map(x => (
                <div key={x.k} className={`rel-cascata-linha ${x.tipo}`}>
                  <span className="rel-cascata-nome">{x.k}</span>
                  <div className="rel-cascata-trilho">
                    <span className={`rel-cascata-barra ${x.tipo === 'total' && x.v < 0 ? 'negativo' : ''}`}
                      style={{ left: `${Math.max(0, x.de) / escala * 100}%`, width: `${Math.max(0.6, (x.ate - Math.max(0, x.de)) / escala * 100)}%` }} />
                  </div>
                  <span className="rel-cascata-valor">{x.tipo === 'menos' ? '–' : ''}{fmt(Math.abs(x.v))}</span>
                  <span className="rel-cascata-pct">{pct1(Math.abs(x.v) / escala * 100)}</span>
                </div>
              ))}
            </div>

            {d.pe > 0 && (
              <div className="rel-equilibrio">
                <div className="rel-equilibrio-texto">
                  <span>Ponto de equilíbrio</span>
                  <strong>{fmt(d.pe)}</strong>
                  <p>{d.fat >= d.pe
                    ? <>Faturamento mínimo para não ter prejuízo. Neste mês a empresa vendeu <b>{fmtK(d.fat - d.pe)}</b> acima dele.</>
                    : <>Faturamento mínimo para não ter prejuízo. Faltaram <b>{fmtK(d.pe - d.fat)}</b> para chegar nele.</>}</p>
                </div>
                <div className="rel-equilibrio-visual">
                  <div className="rel-equilibrio-trilho">
                    <span className="rel-equilibrio-fat" style={{ width: `${Math.min(100, d.fat / Math.max(d.fat, d.pe) * 100)}%` }} />
                    <span className="rel-equilibrio-marca" style={{ left: `${Math.min(100, d.pe / Math.max(d.fat, d.pe) * 100)}%` }}>
                      <em>equilíbrio</em>
                    </span>
                  </div>
                  <div className="rel-equilibrio-legenda"><span>R$ 0</span><span>Faturamento {fmtK(d.fat)}</span></div>
                </div>
              </div>
            )}
          </Pagina>

          {/* ── Vendas ── */}
          <Pagina titulo="Vendas" sub={serieGraf.length === 6 ? 'Faturamento e lucro dos últimos 6 meses' : `Faturamento e lucro desde ${nomeMes(serieGraf[0].chave).toLowerCase()}`}icone="celular">
            <div className="rel-vendas">
              <div className="rel-grafico">
                <div className="rel-legenda">
                  <span><i className="q lima" />Faturamento</span>
                  <span><i className="l" />Lucro líquido</span>
                </div>
                <Grafico imprimindo={imprimindo} largura={720} altura={250}>
                  <ComposedChart data={serieGraf}margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: 'var(--text2)', fontSize: 12 }} />
                    <YAxis domain={[v => (v < -0.08 * d.fat ? v * 1.15 : 0), 'auto']} allowDataOverflow tickCount={5} tickFormatter={eixoK} tickLine={false} axisLine={false} tick={{ fill: 'var(--text2)', fontSize: 11 }} width={48} />
                    <Tooltip content={<TooltipBRL />} cursor={{ fill: 'var(--surface2)' }} />
                    <Bar dataKey="Faturamento" radius={[8, 8, 8, 8]} maxBarSize={46} isAnimationActive={false}>
                      {serieGraf.map((s, i) => <Cell key={s.chave} fill={i === serieGraf.length - 1 ? '#b6f23e' : 'var(--text2)'} fillOpacity={i === serieGraf.length - 1 ? 1 : 0.22} />)}
                    </Bar>
                    <Line type="monotone" dataKey="Lucro" name="Lucro líquido" stroke="var(--text)" strokeWidth={2.2} dot={{ r: 3.5, fill: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                  </ComposedChart>
                </Grafico>
              </div>

              <div className="rel-vendas-lado">
                <div className="rel-kv"><span>Aparelhos vendidos</span><strong>{d.uni || '—'}</strong></div>
                <div className="rel-kv"><span>Lucro médio por aparelho</span><strong>{d.uni ? fmt(d.lucMedio) : '—'}</strong></div>
                <div className="rel-kv"><span>Acessórios vendidos</span><strong>{d.uniAcc || '—'}</strong></div>
                <div className="rel-kv"><span>Lucro com acessórios</span><strong>{d.uniAcc ? fmt(d.lucAcc) : '—'}</strong></div>
              </div>
            </div>

            {mix.length > 0 && (
              <div className="rel-mix">
                <h3>De onde veio a receita</h3>
                <div className="rel-mix-barra">
                  {mix.map((m, i) => <span key={m.k} style={{ width: `${m.pct}%`, background: CORES_MIX[i % CORES_MIX.length] }} title={`${m.k}: ${pct1(m.pct)}`} />)}
                </div>
                <div className="rel-mix-legenda">
                  {mix.map((m, i) => (
                    <span key={m.k}><i style={{ background: CORES_MIX[i % CORES_MIX.length] }} />{m.k}<b>{pct1(m.pct)}</b><small>{fmtK(m.v)}</small></span>
                  ))}
                </div>
              </div>
            )}
          </Pagina>

          {/* ── Lucro por modelo ── */}
          {topModelos.length > 0 && (
            <Pagina titulo="Lucro por modelo" sub="Os modelos que mais deixaram lucro no mês" icone="celular">
              <div>
                <div className="rel-modelo-lista">
                    {topModelos.map(m => (
                      <div key={m.nome} className="rel-modelo">
                        <div className="rel-modelo-topo">
                          <span className="rel-modelo-nome">{m.nome}<small>{m.n} {m.n === 1 ? 'vendido' : 'vendidos'} · {fmtK(m.venda)}</small></span>
                          <span className="rel-modelo-valor">{fmtK(m.lucro)}</span>
                          <span className={`rel-pill ${m.margem >= 20 ? 'bom' : m.margem >= 10 ? 'medio' : 'ruim'}`}>{pct1(m.margem)}</span>
                        </div>
                        <div className="rel-modelo-barra"><span style={{ width: `${Math.max(2, m.lucro / maiorLucroM * 100)}%` }} /></div>
                      </div>
                  ))}
                </div>
              </div>
            </Pagina>
          )}

          {/* ── Despesas e caixa ── */}
          <Pagina titulo="Despesas e caixa" sub={`${nomeMes(mes)} ao lado de ${nomeMes(ant).toLowerCase()}`} icone="carteira">
            <div className="rel-despesas">
              <div className="rel-desp-tabela">
                <div className="rel-desp-cab"><span>Grupo</span><span /><span>{curtoMes(mes)}</span><span>Variação</span></div>
                {despesas.map(x => (
                  <div key={x.cat} className="rel-desp-linha">
                    <span className="rel-desp-nome">{x.cat}</span>
                    <span className="rel-desp-barras">
                      <i className="atual" style={{ width: `${x.atual / maiorDespesa * 100}%` }} />
                      <i className="antes" style={{ width: `${x.antes / maiorDespesa * 100}%` }} />
                    </span>
                    <span className="rel-desp-valor">{fmt(x.atual)}</span>
                    {x.antes ? <Delta atual={x.atual} anterior={x.antes} inverso rotulo={rotAnt} /> : <span className="rel-delta neutro">novo</span>}
                  </div>
                ))}
                <div className="rel-legenda pequena"><span><i className="q lima" />{nomeMes(mes)}</span><span><i className="q cinza" />{nomeMes(ant)}</span></div>
              </div>

              <div className="rel-caixa">
                <div className="rel-caixa-card principal">
                  <span>Geração de caixa</span>
                  <strong className={d.caixaLiq < 0 ? 'negativo' : ''}>{fmt(d.caixaLiq)}</strong>
                  <div className="rel-caixa-linhas">
                    <div><span>Entradas</span><b>{fmt(d.entCaixa)}</b></div>
                    <div><span>Saídas</span><b>{fmt(d.saiCaixa)}</b></div>
                  </div>
                  <small>Inclui compras de estoque, que não entram no lucro.</small>
                </div>
              </div>
            </div>
          </Pagina>

          {/* ── Saúde financeira ── */}
          <Pagina titulo="Saúde financeira" sub="Nota de 0 a 100 a partir de cinco indicadores" icone="checkRedondo">
            <div className="rel-saude">
              <div className={`rel-saude-nota ${statusSaude[1]}`}>
                <strong>{Math.round(score.total)}</strong>
                <span>de 100</span>
                <em>{statusSaude[0]}</em>
              </div>
              <div className="rel-pilares">
                {score.pilares.map(x => (
                  <div key={x.label} className="rel-pilar">
                    <div className="rel-pilar-topo">
                      <span>{x.label}</span>
                      <b>{x.valor}</b>
                    </div>
                    <div className="rel-pilar-segs" aria-label={`${x.pts} de 2 pontos`}>
                      <i className={x.pts >= 1 ? (x.pts === 2 ? 'cheio' : 'meio') : ''} />
                      <i className={x.pts === 2 ? 'cheio' : ''} />
                    </div>
                    <small>{x.regra}</small>
                  </div>
                ))}
              </div>
            </div>
          </Pagina>

        </div>
      ) : (
        <div className="empty-state">
          <div className="icon"><Icone nome="grafico" tamanho={30} traco={1.6} /></div>
          <div>Nenhum lançamento em {nomeMes(mes).toLowerCase()} de {mes.slice(0, 4)}</div>
        </div>
      )}
    </div>
  );
}
