import { useState, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { CMVCATS, SGA_CATS, NAOOP_CATS, GASTOS_CATS } from '../services/constants';
import { fmt, fmtPct, hoje, MESES, MESES_FULL } from '../services/utils';
import './Relatorio.css';

function calcMes(lancamentos, pfx) {
  const lm       = lancamentos.filter(l => l.data.startsWith(pfx));
  const fat      = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const cmvTotal = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const cmvVinc  = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId).reduce((a, l) => a + l.valor, 0);
  const sga      = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp    = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const gastos   = lm.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto = fat - cmvTotal;
  const lucLiq   = fat - cmvTotal - sga - naoOp;
  const aps      = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && !l.isCMV);
  const fatAp    = aps.reduce((a, l) => a + l.valor, 0);
  const uni      = aps.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket   = uni > 0 ? fatAp / uni : 0;
  const lucMedio = uni > 0 ? (fat - cmvVinc) / uni : 0;
  const entCaixa = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && !CMVCATS.includes(l.categoria)).reduce((a, l) => a + (l.valorRecebido ?? l.valor), 0);
  const saiCaixa = lm.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const caixaLiq = entCaixa - saiCaixa;
  return { fat, cmvTotal, cmvVinc, sga, naoOp, gastos, lucBruto, lucLiq, uni, fatAp, ticket, lucMedio, entCaixa, saiCaixa, caixaLiq };
}

function TooltipBRL({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
}

const varPct   = (curr, prev) => (prev && prev !== 0) ? (curr - prev) / Math.abs(prev) * 100 : null;
const varCor   = (v, inv = false) => v === null ? 'var(--text2)' : ((inv ? v <= 0 : v >= 0) ? 'var(--entrada)' : 'var(--saida)');
const varLabel = (v) => v === null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export default function Relatorio() {
  const { lancamentos } = useApp();

  const anoAtual = hoje().slice(0, 4);
  const mesAtual = parseInt(hoje().slice(5, 7)) - 1;

  const [ano, setAno]             = useState(anoAtual);
  const [mesFiltro, setMesFiltro] = useState(String(mesAtual));

  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mv = useMemo(() =>
    MESES.map((_, i) => calcMes(lancamentos, `${ano}-${String(i + 1).padStart(2, '0')}`)),
    [lancamentos, ano]
  );

  const lucAcum = useMemo(() => {
    let acc = 0;
    return mv.map(m => { acc += m.lucBruto; return acc; });
  }, [mv]);

  const mesIdx       = mesFiltro !== '' ? parseInt(mesFiltro) : null;
  const labelPeriodo = mesIdx !== null ? `${MESES_FULL[mesIdx]} / ${ano}` : `Anual ${ano}`;

  const filtrados = useMemo(() => {
    const lancAno = lancamentos.filter(l => l.data.startsWith(ano));
    if (mesFiltro === '') return lancAno;
    const m = parseInt(mesFiltro);
    return lancAno.filter(l => parseInt(l.data.slice(5, 7)) - 1 === m);
  }, [lancamentos, ano, mesFiltro]);

  const d       = mesIdx !== null ? mv[mesIdx] : null;
  const prevIdx = mesIdx !== null ? (mesIdx === 0 ? 11 : mesIdx - 1) : null;
  const prevAno = mesIdx === 0 ? String(parseInt(ano) - 1) : ano;
  const prev    = prevIdx !== null
    ? calcMes(lancamentos, `${prevAno}-${String(prevIdx + 1).padStart(2, '0')}`)
    : null;

  const lucAcumMes = mesIdx !== null ? lucAcum[mesIdx] : 0;

  // Deltas para visão mensal
  const dFat    = d && prev ? varPct(d.fat, prev.fat) : null;
  const dLucMed = d && prev && prev.lucMedio !== 0 ? varPct(d.lucMedio, prev.lucMedio) : null;
  const dTicket = d && prev && prev.ticket !== 0 ? varPct(d.ticket, prev.ticket) : null;
  const dLucLiq = d && prev && prev.lucLiq !== 0 ? varPct(d.lucLiq, prev.lucLiq) : null;
  const dCusto  = d && prev && (prev.cmvTotal + prev.gastos) > 0 ? varPct(d.cmvTotal + d.gastos, prev.cmvTotal + prev.gastos) : null;
  const fatDiff = d && prev ? d.fat - prev.fat : null;

  const margemMes  = d && d.fat > 0 ? d.lucLiq / d.fat * 100 : null;
  const margemPrev = prev && prev.fat > 0 ? prev.lucLiq / prev.fat * 100 : null;

  // Receita por categoria (visão mensal)
  const recPorCat = useMemo(() => {
    const vendas = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV);
    const fat    = vendas.reduce((a, l) => a + l.valor, 0);
    const obj    = {};
    vendas.forEach(l => {
      if (!obj[l.categoria]) obj[l.categoria] = { fat: 0, uni: 0 };
      obj[l.categoria].fat += l.valor;
      obj[l.categoria].uni += (l.quantidade || 1);
    });
    return Object.entries(obj)
      .sort((a, b) => b[1].fat - a[1].fat)
      .map(([key, data]) => ({ key, fat: data.fat, uni: data.uni, pct: fat > 0 ? data.fat / fat * 100 : 0 }));
  }, [filtrados]);

  // Gastos por categoria (visão mensal)
  const gastPorCat = useMemo(() => {
    const obj = {};
    filtrados
      .filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente')
      .forEach(l => { obj[l.categoria] = (obj[l.categoria] || 0) + l.valor; });
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  // Gráfico de barras anual
  const dadosBar = MESES.map((m, i) => ({
    mes: m, Faturamento: mv[i].fat, 'Lucro Líq.': mv[i].lucLiq,
  }));

  // Linhas da matriz anual
  const matrizLinhas = [
    { label: 'Faturamento',             fn: (m) => m.fat > 0 ? fmt(m.fat) : '—',                            cor: (m)    => m.fat > 0 ? 'var(--entrada)' : 'var(--text2)' },
    { label: 'Qtd Aparelhos Vendidos',  fn: (m) => m.uni > 0 ? String(m.uni) : '—',                         cor: ()     => 'var(--text)' },
    { label: 'Lucro Médio / Aparelho',  fn: (m) => m.uni > 0 ? fmt(m.lucMedio) : '—',                       cor: (m)    => m.uni > 0 ? (m.lucMedio >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' },
    { label: 'Lucro Acumulado',         fn: (m, i) => m.fat > 0 ? fmt(lucAcum[i]) : '—',                    cor: (m, i) => m.fat > 0 ? (lucAcum[i] >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)', bold: true },
    { label: 'Gastos Totais',           fn: (m) => m.gastos > 0 ? fmt(m.gastos) : '—',                      cor: (m)    => m.gastos > 0 ? 'var(--saida)' : 'var(--text2)' },
    { label: 'Ticket Médio',            fn: (m) => m.uni > 0 ? fmt(m.ticket) : '—',                         cor: ()     => 'var(--text)' },
    { label: 'Lucro Líquido',           fn: (m) => m.fat > 0 ? fmt(m.lucLiq) : '—',                         cor: (m)    => m.fat > 0 ? (m.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)', bold: true },
    { label: 'Caixa Líquido',           fn: (m) => m.fat > 0 ? fmt(m.caixaLiq) : '—',                       cor: (m)    => m.fat > 0 ? (m.caixaLiq >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' },
  ];

  return (
    <div className="relatorio-page">

      {/* ── Filtros ── */}
      <div className="rel-filtros">
        <span className="period-label">Relatório</span>
        <select className="period-select" value={ano} onChange={e => { setAno(e.target.value); setMesFiltro(String(mesAtual)); }}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
        {mesFiltro === '' ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setMesFiltro(String(mesAtual))}>← Fechar anual</button>
        ) : (
          <>
            <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
              {MESES_FULL.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setMesFiltro('')}>Ver todos os meses →</button>
          </>
        )}
      </div>

      {/* ── VISÃO ANUAL: Matriz ── */}
      {mesFiltro === '' && (
        <div className="table-panel">
          <div className="table-header">
            <h2>Relatório Anual — {ano}</h2>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>Clique em um mês para detalhar</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rel-matrix-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Métrica</th>
                  {MESES.map((m, i) => (
                    <th
                      key={m}
                      className={i === mesAtual && ano === anoAtual ? 'col-atual' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setMesFiltro(String(i))}
                    >{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrizLinhas.map(({ label, fn, cor, bold }) => (
                  <tr key={label}>
                    <td className="metric-name-cell">
                      <span className="metric-label-text">{label}</span>
                    </td>
                    {mv.map((m, i) => (
                      <td
                        key={i}
                        className={`metric-val ${i === mesAtual && ano === anoAtual ? 'col-atual' : ''}`}
                        style={{ color: cor(m, i), fontWeight: bold ? 700 : 600 }}
                        onClick={() => setMesFiltro(String(i))}
                      >
                        {fn(m, i)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VISÃO MENSAL ── */}
      {mesIdx !== null && d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 1. VENDAS */}
          <div className="table-panel">
            <div className="table-header"><h2>Vendas — {labelPeriodo}</h2></div>
            <div style={{ padding: '16px 20px' }}>

              <div className="rel-big-nums">
                <div className="rel-big-card">
                  <div className="rel-big-label">Aparelhos Vendidos</div>
                  <div className="rel-big-val" style={{ color: 'var(--accent)' }}>{d.uni > 0 ? d.uni : '—'}</div>
                  {prev && prev.uni > 0 && (
                    <div className="rel-big-sub">vs {MESES_FULL[prevIdx]}: {prev.uni}</div>
                  )}
                </div>
                <div className="rel-big-card">
                  <div className="rel-big-label">Lucro Médio / Aparelho</div>
                  <div className="rel-big-val" style={{ color: d.uni > 0 ? (d.lucMedio >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' }}>
                    {d.uni > 0 ? fmt(d.lucMedio) : '—'}
                  </div>
                  {dLucMed !== null && (
                    <div className="rel-big-sub" style={{ color: varCor(dLucMed) }}>{varLabel(dLucMed)} vs mês ant.</div>
                  )}
                </div>
                <div className="rel-big-card">
                  <div className="rel-big-label">Lucro Acumulado no Ano</div>
                  <div className="rel-big-val" style={{ color: lucAcumMes >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                    {fmt(lucAcumMes)}
                  </div>
                  <div className="rel-big-sub">Jan – {MESES_FULL[mesIdx]}</div>
                </div>
                <div className="rel-big-card">
                  <div className="rel-big-label">Ticket Médio</div>
                  <div className="rel-big-val">{d.uni > 0 ? fmt(d.ticket) : '—'}</div>
                  {dTicket !== null && (
                    <div className="rel-big-sub" style={{ color: varCor(dTicket) }}>{varLabel(dTicket)} vs mês ant.</div>
                  )}
                </div>
              </div>

              {recPorCat.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="rel-section-title">Receita por Categoria</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recPorCat.map(({ key, fat, uni, pct }) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{key}</span>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ color: 'var(--text2)', fontSize: 12 }}>{uni} un.</span>
                            <span style={{ color: 'var(--entrada)', fontWeight: 700 }}>{fmt(fat)}</span>
                            <span style={{ fontWeight: 700, minWidth: 44, textAlign: 'right', color: pct > 50 ? 'var(--text)' : 'var(--text2)' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 7, background: 'var(--border)', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--entrada)', borderRadius: 4, transition: 'width .3s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. RECEITA */}
          <div className="table-panel">
            <div className="table-header"><h2>Receita — {labelPeriodo}</h2></div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                  <div className="rel-section-title" style={{ marginBottom: 4 }}>Faturamento Bruto</div>
                  <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--entrada)', lineHeight: 1 }}>{fmt(d.fat)}</div>
                </div>
                {prev && prev.fat > 0 && (
                  <div style={{ padding: '12px 18px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 2 }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>vs {MESES_FULL[prevIdx]}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: varCor(dFat) }}>{varLabel(dFat)}</div>
                    <div style={{ fontSize: 12, color: varCor(dFat), marginTop: 2 }}>
                      {fatDiff !== null && (fatDiff >= 0 ? '+' : '')}{fatDiff !== null ? fmt(fatDiff) : ''}
                    </div>
                  </div>
                )}
              </div>
              <div className="rel-section-title" style={{ marginBottom: 8 }}>Evolução do Ano</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dadosBar} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                  <YAxis tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                  <Tooltip content={<TooltipBRL />} />
                  <Bar dataKey="Faturamento" radius={[3, 3, 0, 0]}>
                    {dadosBar.map((_, i) => <Cell key={i} fill="#22c55e" fillOpacity={i === mesIdx ? 1 : 0.2} />)}
                  </Bar>
                  <Bar dataKey="Lucro Líq." radius={[3, 3, 0, 0]}>
                    {dadosBar.map((_, i) => <Cell key={i} fill="#8b5cf6" fillOpacity={i === mesIdx ? 1 : 0.2} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. FLUXO DE CAIXA */}
          <div className="table-panel">
            <div className="table-header"><h2>Fluxo de Caixa — {labelPeriodo}</h2></div>
            <div style={{ padding: '16px 20px' }}>
              <div className="rel-big-nums" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="rel-big-card" style={{ borderLeft: '3px solid var(--entrada)' }}>
                  <div className="rel-big-label">Entradas</div>
                  <div className="rel-big-val" style={{ color: 'var(--entrada)' }}>{fmt(d.entCaixa)}</div>
                </div>
                <div className="rel-big-card" style={{ borderLeft: '3px solid var(--saida)' }}>
                  <div className="rel-big-label">Saídas</div>
                  <div className="rel-big-val" style={{ color: 'var(--saida)' }}>{fmt(d.saiCaixa)}</div>
                </div>
                <div className="rel-big-card" style={{ borderLeft: `3px solid ${d.caixaLiq >= 0 ? 'var(--entrada)' : 'var(--saida)'}` }}>
                  <div className="rel-big-label">Saldo Final</div>
                  <div className="rel-big-val" style={{ color: d.caixaLiq >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 900 }}>
                    {fmt(d.caixaLiq)}
                  </div>
                </div>
              </div>

              {gastPorCat.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="rel-section-title">Onde Está Saindo o Dinheiro</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {gastPorCat.map(([cat, val]) => {
                      const pct    = d.saiCaixa > 0 ? val / d.saiCaixa * 100 : 0;
                      const maxVal = gastPorCat[0][1] || 1;
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                            <span>{cat}</span>
                            <div style={{ display: 'flex', gap: 16 }}>
                              <span style={{ color: 'var(--saida)', fontWeight: 700 }}>{fmt(val)}</span>
                              <span style={{ color: 'var(--text2)', minWidth: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div style={{ height: 7, background: 'var(--border)', borderRadius: 4 }}>
                            <div style={{ height: '100%', width: `${val / maxVal * 100}%`, background: 'var(--saida)', opacity: .65, borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. LUCRO */}
          <div className="table-panel">
            <div className="table-header"><h2>Lucro — {labelPeriodo}</h2></div>
            <div style={{ padding: '16px 20px' }}>
              <div className="rel-big-nums" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="rel-big-card" style={{ borderLeft: '3px solid var(--saida)' }}>
                  <div className="rel-big-label">Custo Total</div>
                  <div className="rel-big-val" style={{ color: 'var(--saida)' }}>{fmt(d.cmvTotal + d.gastos)}</div>
                  {dCusto !== null && (
                    <div className="rel-big-sub" style={{ color: varCor(dCusto, true) }}>{varLabel(dCusto)} vs mês ant.</div>
                  )}
                </div>
                <div className="rel-big-card" style={{ borderLeft: `3px solid ${d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)'}` }}>
                  <div className="rel-big-label">Lucro Líquido</div>
                  <div className="rel-big-val" style={{ color: d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 900 }}>
                    {fmt(d.lucLiq)}
                  </div>
                  {dLucLiq !== null && (
                    <div className="rel-big-sub" style={{ color: varCor(dLucLiq) }}>{varLabel(dLucLiq)} vs mês ant.</div>
                  )}
                </div>
                <div className="rel-big-card" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="rel-big-label">Margem Líquida</div>
                  <div className="rel-big-val" style={{ color: 'var(--accent)' }}>
                    {margemMes !== null ? fmtPct(margemMes) : '—'}
                  </div>
                  {margemPrev !== null && (
                    <div className="rel-big-sub">vs mês ant.: {fmtPct(margemPrev)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {filtrados.length === 0 && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div>Nenhum lançamento para {labelPeriodo}</div>
        </div>
      )}
    </div>
  );
}
