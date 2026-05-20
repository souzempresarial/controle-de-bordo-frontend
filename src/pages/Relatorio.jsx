import { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { CMVCATS, SGA_CATS, NAOOP_CATS, GASTOS_CATS } from '../services/constants';
import { fmt, fmtPct, hoje, MESES, MESES_FULL } from '../services/utils';
import './Relatorio.css';

const CORES_GRAFICO = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function calcMes(lancamentos, pfx) {
  const lm      = lancamentos.filter(l => l.data.startsWith(pfx));
  const fat     = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const cmv     = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const sga     = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp   = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const gastos  = lm.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto    = fat - cmv;
  const lucLiq      = fat - cmv - sga - naoOp;
  const vendas      = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV);
  const uni         = vendas.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket      = uni > 0 ? fat / uni : 0;
  const margem      = fat > 0 ? (lucBruto / fat * 100) : 0;
  const cmvPct      = fat > 0 ? (cmv / fat * 100) : 0;
  const entCaixa    = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && !CMVCATS.includes(l.categoria)).reduce((a, l) => a + (l.valorRecebido ?? l.valor), 0);
  const saiCaixa    = lm.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const caixaLiq    = entCaixa - saiCaixa;
  const lucMedioUni = uni > 0 ? lucBruto / uni : 0;
  return { fat, cmv, sga, naoOp, gastos, lucBruto, lucLiq, uni, ticket, margem, cmvPct, caixaLiq, lucMedioUni };
}

function TooltipBRL({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
}

function TooltipPct({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value.toFixed(2)}%</div>
      ))}
    </div>
  );
}

function SparkMetrica({ label, valor, sub, dados, fmtFn, cor }) {
  const corValor = cor || (typeof valor === 'number' && valor < 0 ? 'var(--saida)' : 'var(--entrada)');
  return (
    <div className="spark-card">
      <div className="spark-chart">
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={dados} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="v" radius={2}>
              {dados.map((d, i) => <Cell key={i} fill={d.atual ? '#3b82f6' : '#3b82f633'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="spark-info">
        <div className="spark-label">{label}</div>
        <div className="spark-valor" style={{ color: corValor }}>{valor === null ? '—' : fmtFn(valor)}</div>
        {sub && <div className="spark-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function Relatorio() {
  const { lancamentos, contas } = useApp();

  const anoAtual = hoje().slice(0, 4);
  const mesAtual = parseInt(hoje().slice(5, 7)) - 1;

  const [ano, setAno]             = useState(anoAtual);
  const [mesFiltro, setMesFiltro] = useState('');

  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mv = useMemo(() =>
    MESES.map((_, i) => calcMes(lancamentos, `${ano}-${String(i + 1).padStart(2, '0')}`)),
    [lancamentos, ano]
  );

  const mesIdx       = mesFiltro !== '' ? parseInt(mesFiltro) : null;
  const labelPeriodo = mesIdx !== null ? `${MESES_FULL[mesIdx]}/${ano}` : ano;

  const filtrados = useMemo(() => {
    const lancAno = lancamentos.filter(l => l.data.startsWith(ano));
    if (mesFiltro === '') return lancAno;
    const m = parseInt(mesFiltro);
    return lancAno.filter(l => parseInt(l.data.slice(5, 7)) - 1 === m);
  }, [lancamentos, ano, mesFiltro]);

  const totFat      = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const totCMV      = filtrados.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const totSGA      = filtrados.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const totNaoOp    = filtrados.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const totGastos   = filtrados.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const totLucBruto = totFat - totCMV;
  const totLucLiq   = totFat - totCMV - totSGA - totNaoOp;
  const totMargem   = totFat > 0 ? (totLucBruto / totFat * 100) : null;
  const totVendas   = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV);
  const totUni      = totVendas.reduce((a, l) => a + (l.quantidade || 1), 0);
  const totTicket   = totUni > 0 ? totFat / totUni : null;
  const totCMVPct   = totFat > 0 ? (totCMV / totFat * 100) : null;

  const prevMesIdx = mesIdx !== null ? (mesIdx === 0 ? 11 : mesIdx - 1) : null;
  const prevAno    = mesIdx === 0 ? String(parseInt(ano) - 1) : ano;
  const prevPfx    = prevMesIdx !== null ? `${prevAno}-${String(prevMesIdx + 1).padStart(2, '0')}` : null;
  const prevDados  = prevPfx ? calcMes(lancamentos, prevPfx) : null;
  const fatVar     = prevDados && prevDados.fat > 0 ? ((totFat - prevDados.fat) / prevDados.fat * 100) : null;
  const lucVar     = prevDados && prevDados.lucLiq !== 0 ? ((totLucLiq - prevDados.lucLiq) / Math.abs(prevDados.lucLiq) * 100) : null;
  const gastosVar  = prevDados && prevDados.gastos > 0 ? ((totGastos - prevDados.gastos) / prevDados.gastos * 100) : null;

  const entCaixa     = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV && !CMVCATS.includes(l.categoria)).reduce((a, l) => a + (l.valorRecebido ?? l.valor), 0);
  const saiCaixa     = filtrados.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const geracaoCaixa = entCaixa - saiCaixa;

  const ncgReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((a, c) => a + c.valor, 0);
  const ncgPagar   = contas.filter(c => c.tipo === 'pagar'   && c.status === 'pendente').reduce((a, c) => a + c.valor, 0);
  const ncg        = ncgReceber - ncgPagar;

  const scoreML    = totFat > 0 ? Math.max(0, Math.min(100, (totLucLiq / totFat) / 0.25 * 100)) : 0;
  const scoreGC    = totFat > 0 ? Math.max(0, Math.min(100, (geracaoCaixa / totFat) / 0.20 * 100)) : 0;
  const scoreCresc = fatVar !== null ? Math.max(0, Math.min(100, (fatVar + 20) / 40 * 100)) : 50;
  const scoreCMV   = totFat > 0 ? Math.max(0, Math.min(100, (80 - (totCMV / totFat * 100)) / 50 * 100)) : 50;
  const healthScore = Math.round(scoreML * 0.40 + scoreGC * 0.30 + scoreCresc * 0.20 + scoreCMV * 0.10);
  const healthLabel = healthScore >= 70 ? 'Saudável' : healthScore >= 40 ? 'Atenção' : 'Crítico';
  const healthColor = healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#ef4444';

  const recPorCat = useMemo(() => {
    const obj = {};
    filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV)
      .forEach(l => { obj[l.categoria] = (obj[l.categoria] || 0) + l.valor; });
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  const gastPorCat = useMemo(() => {
    const obj = {};
    filtrados.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria))
      .forEach(l => { obj[l.categoria] = (obj[l.categoria] || 0) + l.valor; });
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  const dadosAnuais  = MESES.map((m, i) => ({ mes: m, Faturamento: mv[i].fat, 'Lucro Bruto': mv[i].lucBruto, 'Lucro Líq.': mv[i].lucLiq }));
  const dadosTicket  = MESES.map((m, i) => ({ mes: m, 'Ticket Médio': mv[i].ticket }));
  const dadosCMVPct  = MESES.map((m, i) => ({ mes: m, 'CMV %': parseFloat(mv[i].cmvPct.toFixed(2)) }));
  const dadosDoughnut = gastPorCat.slice(0, 8).map(([cat, val]) => ({ name: cat, value: val }));

  const mkSpark = (dados, idx) => MESES.map((_, i) => ({ v: dados[i], atual: i === idx }));

  const corMargem = (m) => m === null ? 'var(--text2)' : m >= 30 ? 'var(--entrada)' : m >= 15 ? 'var(--warn)' : 'var(--saida)';
  const corLucro  = (v) => v >= 0 ? 'var(--entrada)' : 'var(--saida)';
  const delta     = (v) => v === null ? null : (v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`);
  const corDelta  = (v) => v === null ? 'var(--text2)' : v >= 0 ? 'var(--entrada)' : 'var(--saida)';

  return (
    <div className="relatorio-page">
      {/* Seletor */}
      <div className="rel-filtros">
        <span className="period-label">Relatório</span>
        <select className="period-select" value={ano} onChange={e => { setAno(e.target.value); setMesFiltro(''); }}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
        <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
          <option value="">Ano inteiro</option>
          {MESES_FULL.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
        </select>
      </div>

      {/* Cards resumo */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Faturamento</div>
          <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(totFat)}</div>
          <div className="card-sub">
            {labelPeriodo}
            {fatVar !== null && <span style={{ color: corDelta(fatVar), marginLeft: 6, fontSize: 11, fontWeight: 700 }}>{delta(fatVar)} vs mês ant.</span>}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Lucro Bruto</div>
          <div className="card-value" style={{ color: corLucro(totLucBruto) }}>{fmt(totLucBruto)}</div>
          <div className="card-sub">CMV: {fmt(totCMV)}</div>
        </div>
        <div className="card">
          <div className="card-label">Lucro Líquido</div>
          <div className="card-value" style={{ color: corLucro(totLucLiq) }}>{fmt(totLucLiq)}</div>
          <div className="card-sub">
            SG&A: {fmt(totSGA)}
            {lucVar !== null && <span style={{ color: corDelta(lucVar), marginLeft: 6, fontSize: 11, fontWeight: 700 }}>{delta(lucVar)}</span>}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Margem Bruta</div>
          <div className="card-value" style={{ color: corMargem(totMargem) }}>{fmtPct(totMargem)}</div>
          <div className="card-sub">CMV%: {fmtPct(totCMVPct)}</div>
        </div>
        <div className="card">
          <div className="card-label">Ticket Médio</div>
          <div className="card-value" style={{ color: 'var(--accent)' }}>{totTicket !== null ? fmt(totTicket) : '—'}</div>
          <div className="card-sub">{totUni} unidades vendidas</div>
        </div>
      </div>

      {/* ── VISÃO ANUAL ── */}
      {mesFiltro === '' && (
        <>
          <div className="rel-graficos-grid">
            <div className="table-panel">
              <div className="table-header"><h2>Faturamento × Lucro — {ano}</h2></div>
              <div style={{ padding: '8px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dadosAnuais} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }} />
                    <Bar dataKey="Faturamento"  fill="#22c55e88" stroke="#22c55e" strokeWidth={1} radius={[3,3,0,0]} />
                    <Bar dataKey="Lucro Bruto"  fill="#3b82f688" stroke="#3b82f6" strokeWidth={1} radius={[3,3,0,0]} />
                    <Bar dataKey="Lucro Líq."   fill="#8b5cf688" stroke="#8b5cf6" strokeWidth={1} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-panel">
              <div className="table-header"><h2>Ticket Médio por Mês</h2></div>
              <div style={{ padding: '8px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dadosTicket} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Bar dataKey="Ticket Médio" fill="#f59e0b88" stroke="#f59e0b" strokeWidth={1} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-panel">
              <div className="table-header"><h2>CMV % sobre Receita</h2></div>
              <div style={{ padding: '8px 16px 16px' }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dadosCMVPct} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <YAxis tickFormatter={v => v + '%'} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                    <Tooltip content={<TooltipPct />} />
                    <Bar dataKey="CMV %" fill="#ef444488" stroke="#ef4444" strokeWidth={1} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-panel">
              <div className="table-header"><h2>Gastos por Categoria</h2></div>
              <div style={{ padding: '8px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {dadosDoughnut.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={dadosDoughnut} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={2}>
                        {dadosDoughnut.map((_, i) => <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--text2)', fontSize: 13, padding: 40 }}>Sem dados</div>
                )}
              </div>
            </div>
          </div>

          <div className="table-panel">
            <div className="table-header">
              <h2>Evolução Mensal — {ano}</h2>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Clique em um mês para detalhar</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th style={{ textAlign: 'right' }}>Faturamento</th>
                    <th style={{ textAlign: 'right' }}>CMV</th>
                    <th style={{ textAlign: 'right' }}>Lucro Bruto</th>
                    <th style={{ textAlign: 'right' }}>Margem</th>
                    <th style={{ textAlign: 'right' }}>Lucro Líq.</th>
                    <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                    <th style={{ textAlign: 'right' }}>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {mv.map((m, i) => (
                    <tr
                      key={i}
                      className={i === mesAtual && ano === anoAtual ? 'mes-atual' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setMesFiltro(String(i))}
                    >
                      <td style={{ fontWeight: 600 }}>{MESES_FULL[i]}</td>
                      <td style={{ textAlign: 'right', color: 'var(--entrada)', fontWeight: 600 }}>{m.fat > 0 ? fmt(m.fat) : '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--saida)' }}>{m.cmv > 0 ? fmt(m.cmv) : '—'}</td>
                      <td style={{ textAlign: 'right', color: corLucro(m.lucBruto) }}>{m.fat > 0 ? fmt(m.lucBruto) : '—'}</td>
                      <td style={{ textAlign: 'right', color: corMargem(m.margem) }}>{m.fat > 0 ? fmtPct(m.margem) : '—'}</td>
                      <td style={{ textAlign: 'right', color: corLucro(m.lucLiq) }}>{m.fat > 0 ? fmt(m.lucLiq) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{m.ticket > 0 ? fmt(m.ticket) : '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{m.uni > 0 ? m.uni : '—'}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td style={{ fontWeight: 700 }}>TOTAL</td>
                    <td style={{ textAlign: 'right', color: 'var(--entrada)', fontWeight: 700 }}>{fmt(mv.reduce((a, m) => a + m.fat, 0))}</td>
                    <td style={{ textAlign: 'right', color: 'var(--saida)', fontWeight: 700 }}>{fmt(mv.reduce((a, m) => a + m.cmv, 0))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: corLucro(mv.reduce((a, m) => a + m.lucBruto, 0)) }}>{fmt(mv.reduce((a, m) => a + m.lucBruto, 0))}</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: corLucro(mv.reduce((a, m) => a + m.lucLiq, 0)) }}>{fmt(mv.reduce((a, m) => a + m.lucLiq, 0))}</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)', fontWeight: 700 }}>{mv.reduce((a, m) => a + m.uni, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── VISÃO MENSAL ── */}
      {mesIdx !== null && (
        <>
          <div className="spark-grid">
            <SparkMetrica
              label="Faturamento"
              valor={totFat}
              sub={totUni + ' unidades'}
              dados={mkSpark(mv.map(v => v.fat), mesIdx)}
              fmtFn={fmt}
              cor="var(--entrada)"
            />
            <SparkMetrica
              label="Lucro Líquido"
              valor={totLucLiq}
              sub={totFat > 0 ? `Margem: ${(totLucLiq/totFat*100).toFixed(1)}%` : null}
              dados={mkSpark(mv.map(v => v.lucLiq), mesIdx)}
              fmtFn={fmt}
            />
            <SparkMetrica
              label="Ticket Médio"
              valor={totTicket}
              sub={totUni + ' vendas'}
              dados={mkSpark(mv.map(v => v.ticket), mesIdx)}
              fmtFn={fmt}
              cor="var(--accent)"
            />
            <SparkMetrica
              label="Gastos Totais"
              valor={totGastos}
              sub={gastosVar !== null ? `${delta(gastosVar)} vs mês ant.` : null}
              dados={mkSpark(mv.map(v => v.gastos), mesIdx)}
              fmtFn={fmt}
              cor="var(--saida)"
            />
            <SparkMetrica
              label="CMV %"
              valor={totCMVPct}
              sub={`CMV: ${fmt(totCMV)}`}
              dados={mkSpark(mv.map(v => v.cmvPct), mesIdx)}
              fmtFn={v => v.toFixed(2) + '%'}
              cor={totCMVPct !== null ? (totCMVPct <= 60 ? 'var(--entrada)' : totCMVPct <= 75 ? 'var(--warn)' : 'var(--saida)') : 'var(--text2)'}
            />
            <SparkMetrica
              label="Margem Bruta"
              valor={totMargem}
              sub={`Lucro Bruto: ${fmt(totLucBruto)}`}
              dados={mkSpark(mv.map(v => v.margem), mesIdx)}
              fmtFn={v => v.toFixed(2) + '%'}
              cor={corMargem(totMargem)}
            />
          </div>

          <div className="table-panel resumo-exec">
            <div className="table-header">
              <h2>Resumo Executivo — {labelPeriodo}</h2>
            </div>
            <div className="resumo-body">
              <div className="resumo-bloco">
                <div className="resumo-bloco-title">Saúde Financeira</div>
                <div className="health-score-wrap">
                  <div className="health-score-bar-bg">
                    <div className="health-score-bar-fill" style={{ width: `${healthScore}%`, background: healthColor }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: healthColor }}>{healthScore}</span>
                    <span className={`health-badge health-${healthLabel.toLowerCase()}`}>{healthLabel}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                    {[
                      { label: 'Margem Liq.', val: scoreML, peso: '40%' },
                      { label: 'Geração Caixa', val: scoreGC, peso: '30%' },
                      { label: 'Crescimento', val: scoreCresc, peso: '20%' },
                      { label: 'CMV Control', val: scoreCMV, peso: '10%' },
                    ].map(({ label, val, peso }) => (
                      <div key={label} style={{ fontSize: 11, color: 'var(--text2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>{label}</span><span style={{ color: 'var(--text)' }}>{Math.round(val)}/100 <span style={{ color: 'var(--text2)' }}>({peso})</span></span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${val}%`, background: val >= 70 ? '#22c55e' : val >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 2, transition: 'width .3s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="resumo-bloco">
                <div className="resumo-bloco-title">vs. {prevMesIdx !== null ? MESES_FULL[prevMesIdx] : 'Mês Anterior'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Faturamento',   atual: totFat,    prev: prevDados?.fat,    var: fatVar },
                    { label: 'Lucro Líquido', atual: totLucLiq, prev: prevDados?.lucLiq, var: lucVar },
                    { label: 'Gastos',        atual: totGastos, prev: prevDados?.gastos, var: gastosVar },
                    { label: 'CMV',           atual: totCMV,    prev: prevDados?.cmv },
                  ].map(({ label, atual, prev, var: v }) => {
                    const varCalc = v !== undefined ? v : (prev && prev > 0 ? (atual - prev) / prev * 100 : null);
                    return (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text2)' }}>{label}</span>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {prev !== undefined && <span style={{ color: 'var(--text2)', fontSize: 11 }}>{fmt(prev ?? 0)}</span>}
                            <span style={{ fontWeight: 700 }}>{fmt(atual)}</span>
                            {varCalc !== null && <span style={{ color: corDelta(label === 'Gastos' || label === 'CMV' ? -varCalc : varCalc), fontSize: 11, fontWeight: 700 }}>{delta(varCalc)}</span>}
                          </div>
                        </div>
                        {prev !== undefined && prev > 0 && (
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, atual / Math.max(atual, prev ?? 0) * 100)}%`, background: corDelta(label === 'Gastos' || label === 'CMV' ? -(varCalc ?? 0) : (varCalc ?? 0)), borderRadius: 2, transition: 'width .3s' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="resumo-bloco">
                <div className="resumo-bloco-title">Receita por Categoria</div>
                {recPorCat.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recPorCat.map(([cat, val], i) => {
                      const pct    = totFat > 0 ? (val / totFat * 100) : 0;
                      const uniCat = filtrados.filter(l => l.tipo === 'Entrada' && l.categoria === cat && !l.isCMV).reduce((a, l) => a + (l.quantidade || 1), 0);
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{cat}</span>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <span style={{ color: 'var(--text2)', fontSize: 11 }}>{uniCat} un.</span>
                              <span style={{ color: 'var(--entrada)', fontWeight: 700 }}>{fmt(val)}</span>
                              <span style={{ color: 'var(--text2)', fontSize: 11 }}>{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: CORES_GRAFICO[i % CORES_GRAFICO.length], borderRadius: 3, transition: 'width .3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text2)', fontSize: 13 }}>Nenhuma entrada no período</div>
                )}
              </div>

              <div className="resumo-bloco">
                <div className="resumo-bloco-title">Capital de Giro (NCG)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>A Receber</span>
                    <span style={{ color: 'var(--entrada)', fontWeight: 700 }}>{fmt(ncgReceber)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>A Pagar</span>
                    <span style={{ color: 'var(--saida)', fontWeight: 700 }}>{fmt(ncgPagar)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ fontWeight: 700 }}>NCG</span>
                    <span style={{ color: ncg >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 800, fontSize: 16 }}>{fmt(ncg)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>Geração de Caixa</span>
                    <span style={{ color: geracaoCaixa >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 700 }}>{fmt(geracaoCaixa)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {gastPorCat.length > 0 && (
            <div className="table-panel">
              <div className="table-header"><h2>Gastos por Categoria — {labelPeriodo}</h2></div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {gastPorCat.map(([cat, val]) => (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span>{cat}</span>
                      <span style={{ color: 'var(--saida)', fontWeight: 600 }}>{fmt(val)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${(val / (gastPorCat[0][1] || 1) * 100).toFixed(1)}%`, background: 'var(--saida)', borderRadius: 3, transition: 'width .3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {filtrados.length === 0 && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div>Nenhum lançamento encontrado para {labelPeriodo}</div>
        </div>
      )}
    </div>
  );
}
