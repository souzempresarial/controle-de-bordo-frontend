import { useState, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { CMVCATS, SGA_CATS, NAOOP_CATS, GASTOS_CATS } from '../services/constants';
import { fmt, fmtPct, hoje, MESES, MESES_FULL } from '../services/utils';
import './Relatorio.css';

function calcMes(lancamentos, pfx) {
  const lm        = lancamentos.filter(l => l.data.startsWith(pfx));
  const fat       = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const cmvTotal  = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const cmvVinc   = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId).reduce((a, l) => a + l.valor, 0);
  const sga       = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp     = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const gastos    = lm.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto  = fat - cmvTotal;
  const lucLiq    = fat - cmvTotal - sga - naoOp;

  const aps       = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && !l.isCMV);
  const fatAp     = aps.reduce((a, l) => a + l.valor, 0);
  const uni       = aps.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket    = uni > 0 ? fatAp / uni : 0;
  const lucMedio  = uni > 0 ? (fatAp - cmvVinc) / uni : 0;

  const accs      = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Acessórios' && !l.isCMV);
  const fatAcc    = accs.reduce((a, l) => a + l.valor, 0);
  const uniAcc    = accs.reduce((a, l) => a + (l.quantidade || 1), 0);
  const cmvAcc    = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.subcategoria === 'Acessórios').reduce((a, l) => a + l.valor, 0);
  const lucAcc    = fatAcc - cmvAcc;
  const lucMedioAcc = uniAcc > 0 ? lucAcc / uniAcc : 0;

  const entCaixa  = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && !CMVCATS.includes(l.categoria)).reduce((a, l) => a + (l.valorRecebido ?? l.valor), 0);
  const saiCaixa  = lm.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const caixaLiq  = entCaixa - saiCaixa;
  const margemBruta = fat > 0 ? lucBruto / fat * 100 : 0;

  return { fat, cmvTotal, cmvVinc, sga, naoOp, gastos, lucBruto, lucLiq,
           uni, fatAp, ticket, lucMedio, uniAcc, fatAcc, cmvAcc, lucAcc, lucMedioAcc,
           entCaixa, saiCaixa, caixaLiq, margemBruta };
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

function Gauge({ pct, color = '#22c55e', label, size = 140 }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const dash = (clamped / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border)" strokeWidth={13} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={13}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray .5s' }} />
        <text x={55} y={55} textAnchor="middle" dominantBaseline="middle"
          fontSize={18} fontWeight={800} fill={color}>
          {Math.round(clamped)}%
        </text>
      </svg>
      {label && (
        <div style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>
          {label}
        </div>
      )}
    </div>
  );
}

const varPct   = (curr, prev) => (prev && prev !== 0) ? (curr - prev) / Math.abs(prev) * 100 : null;
const varCor   = (v, inv = false) => v === null ? 'var(--text2)' : ((inv ? v <= 0 : v >= 0) ? 'var(--entrada)' : 'var(--saida)');

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

  const accLucAcum = useMemo(() => {
    if (mesIdx === null) return 0;
    return mv.slice(0, mesIdx + 1).reduce((a, m) => a + m.lucAcc, 0);
  }, [mv, mesIdx]);

  const dFat    = d && prev ? varPct(d.fat, prev.fat) : null;
  const dLucMed = d && prev && prev.lucMedio !== 0 ? varPct(d.lucMedio, prev.lucMedio) : null;
  const fatDiff = d && prev ? d.fat - prev.fat : null;

  const margemMes  = d && d.fat > 0 ? d.lucLiq / d.fat * 100 : null;
  const margemPrev = prev && prev.fat > 0 ? prev.lucLiq / prev.fat * 100 : null;
  const custoPrev  = prev ? prev.cmvTotal + prev.gastos : 0;
  const custoAtual = d ? d.cmvTotal + d.gastos : 0;

  // Breakdown de receita: subcategorias de Aparelhos + outras categorias
  const recBreakdown = useMemo(() => {
    const vendas = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV);
    const total  = vendas.reduce((a, l) => a + l.valor, 0);
    const obj    = {};
    vendas.forEach(l => {
      const key = l.categoria === 'Aparelhos' ? (l.subcategoria || 'Outro') : l.categoria;
      if (!obj[key]) obj[key] = 0;
      obj[key] += l.valor;
    });
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([key, val]) => ({ key, val, pct: total > 0 ? val / total * 100 : 0 }));
  }, [filtrados]);

  const dadosBarVendas = MESES.map((m, i) => ({
    mes: m, Aparelhos: mv[i].fatAp, 'Acessórios': mv[i].fatAcc,
  }));

  const dadosBarFat = MESES.map((m, i) => ({ mes: m, Faturamento: mv[i].fat }));

  const mesNome  = mesIdx !== null ? MESES_FULL[mesIdx].toUpperCase() : '';
  const prevNome = prevIdx !== null ? MESES_FULL[prevIdx].toUpperCase() : '';

  return (
    <div className="relatorio-page">

      {/* ── Filtros ── */}
      <div className="rel-filtros">
        <span className="period-label">Relatório</span>
        <select className="period-select" value={ano} onChange={e => { setAno(e.target.value); setMesFiltro(String(mesAtual)); }}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
        {mesFiltro !== '' && (
          <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
            {MESES_FULL.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
          </select>
        )}
      </div>

      {/* ── VISÃO MENSAL ── */}
      {mesIdx !== null && d && (
        <div className="rel-monthly">

          {/* ===== 1. VENDAS ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Vendas<span className="rel-pdf-dot">.</span></div>
            <div className="rel-pdf-subheading">{mesNome}</div>

            <div className="rel-vendas-layout">
              <div className="rel-vendas-stats">
                <div className="rel-stat-group">
                  <div className="rel-stat-line">Total de aparelhos vendidos: <strong>{d.uni > 0 ? d.uni : '—'}</strong></div>
                  <div className="rel-stat-line">
                    Lucro médio por aparelho:{' '}
                    <strong style={{ color: d.uni > 0 ? (d.lucMedio >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' }}>
                      {d.uni > 0 ? fmt(d.lucMedio) : '—'}
                    </strong>
                    {dLucMed !== null && (
                      <span style={{ fontSize: 11, color: varCor(dLucMed), marginLeft: 6 }}>
                        ({dLucMed >= 0 ? '+' : ''}{dLucMed.toFixed(1)}% vs {MESES[prevIdx]})
                      </span>
                    )}
                  </div>
                </div>

                <div className="rel-stat-group">
                  <div className="rel-stat-line">Total de acessórios vendidos: <strong>{d.uniAcc > 0 ? d.uniAcc : '—'}</strong></div>
                  <div className="rel-stat-line">
                    Lucro médio por acessório:{' '}
                    <strong style={{ color: d.uniAcc > 0 ? (d.lucMedioAcc >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' }}>
                      {d.uniAcc > 0 ? fmt(d.lucMedioAcc) : '—'}
                    </strong>
                  </div>
                </div>

                {(d.uni > 0 || d.uniAcc > 0) && (
                  <div className="rel-stat-group">
                    <div className="rel-stat-line">
                      Lucro médio por aparelho e acessório:{' '}
                      <strong style={{ color: 'var(--entrada)' }}>
                        {fmt((d.lucMedio * d.uni + d.lucMedioAcc * d.uniAcc) / (d.uni + d.uniAcc || 1))}
                      </strong>
                    </div>
                    <div className="rel-stat-line">
                      Lucro acumulado com acessório:{' '}
                      <strong style={{ color: accLucAcum >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                        {fmt(accLucAcum)}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="rel-stat-group">
                  <div className="rel-stat-line">Ticket médio de aparelhos:{' '}<strong>{d.uni > 0 ? fmt(d.ticket) : '—'}</strong></div>
                  <div className="rel-stat-line">
                    Lucro acumulado no ano:{' '}
                    <strong style={{ color: lucAcumMes >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(lucAcumMes)}</strong>
                  </div>
                </div>
              </div>

              <div className="rel-chart-container">
                <div className="rel-chart-title">Total de Vendas</div>
                <div className="rel-chart-legend">
                  <span><span className="rel-legend-dot" style={{ background: '#22c55e' }} />Aparelhos vendidos</span>
                  <span><span className="rel-legend-dot" style={{ background: '#06b6d4' }} />Acessórios Vendidos</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosBarVendas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Bar dataKey="Aparelhos" radius={[3, 3, 0, 0]}>
                      {dadosBarVendas.map((_, i) => <Cell key={i} fill="#22c55e" fillOpacity={i === mesIdx ? 1 : 0.22} />)}
                    </Bar>
                    <Bar dataKey="Acessórios" radius={[3, 3, 0, 0]}>
                      {dadosBarVendas.map((_, i) => <Cell key={i} fill="#06b6d4" fillOpacity={i === mesIdx ? 1 : 0.22} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ===== 2. RECEITA ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Receita<span className="rel-pdf-dot">.</span></div>

            <div className="rel-receita-layout">
              {/* Esquerda: breakdown */}
              <div className="rel-receita-left">
                {recBreakdown.length > 0 && (
                  <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16, color: 'var(--text2)' }}>
                    A maior parte da receita é proveniente das vendas de{' '}
                    <strong style={{ color: 'var(--text)' }}>{recBreakdown[0]?.key}</strong>, sendo:
                  </p>
                )}
                <div className="rel-breakdown-list">
                  {recBreakdown.map(({ key, pct }) => (
                    <div key={key} className="rel-breakdown-item">
                      <span className="rel-breakdown-label">{key}:</span>
                      <span className="rel-breakdown-pct" style={{ color: pct > 10 ? 'var(--accent)' : 'var(--text2)' }}>
                        {pct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Centro: texto descritivo */}
              <div className="rel-receita-center">
                <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 18 }}>
                  Foi gerado um total de{' '}
                  <strong style={{ color: 'var(--entrada)' }}>{fmt(d.fat)}</strong>{' '}
                  em receita bruta durante o mês de {MESES_FULL[mesIdx]} de {ano}.
                </p>
                {prev && prev.fat > 0 && fatDiff !== null && (
                  <p style={{ fontSize: 14, lineHeight: 1.8 }}>
                    No mês de {MESES_FULL[mesIdx]}, tivemos um{' '}
                    <strong style={{ color: fatDiff >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                      {fatDiff >= 0 ? 'Superávit' : 'Déficit'}
                    </strong>{' '}
                    no faturamento em relação ao mês anterior de{' '}
                    <strong style={{ color: fatDiff >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                      {fmt(Math.abs(fatDiff))}
                    </strong>
                    {dFat !== null && (
                      <>, que representa{' '}
                        <strong style={{ color: fatDiff >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                          {Math.abs(dFat).toFixed(2)}%.
                        </strong>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Direita: gráfico + crescimento */}
              <div className="rel-receita-right">
                <div className="rel-chart-title">Receita Mensal</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dadosBarFat} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 9 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} tick={{ fill: 'var(--text2)', fontSize: 9 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Bar dataKey="Faturamento" radius={[3, 3, 0, 0]}>
                      {dadosBarFat.map((_, i) => <Cell key={i} fill="#22c55e" fillOpacity={i === mesIdx ? 1 : 0.22} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {dFat !== null && (
                  <div style={{ marginTop: 14 }}>
                    <Gauge
                      pct={Math.min(Math.abs(dFat), 100)}
                      color={dFat >= 0 ? '#22c55e' : '#ef4444'}
                      label="Crescimento"
                      size={110}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== 3. FLUXO DE CAIXA ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Fluxo de Caixa<span className="rel-pdf-dot">.</span></div>

            <div className="rel-caixa-layout">
              <div className="rel-caixa-left">
                <div className="rel-caixa-main" style={{ borderColor: d.caixaLiq >= 0 ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)' }}>
                  <div className="rel-caixa-main-val" style={{ color: d.caixaLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                    {fmt(d.caixaLiq)}
                  </div>
                  <div className="rel-caixa-main-label">GERAÇÃO DE CAIXA</div>
                </div>
                <div className="rel-caixa-cards">
                  <div className="rel-caixa-card" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
                    <div className="rel-caixa-card-label">Entradas</div>
                    <div className="rel-caixa-card-val" style={{ color: 'var(--entrada)' }}>{fmt(d.entCaixa)}</div>
                  </div>
                  <div className="rel-caixa-card" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
                    <div className="rel-caixa-card-label">Saídas</div>
                    <div className="rel-caixa-card-val" style={{ color: 'var(--saida)' }}>{fmt(d.saiCaixa)}</div>
                  </div>
                </div>
              </div>
              <div className="rel-caixa-right">
                <Gauge
                  pct={Math.max(0, d.margemBruta)}
                  color="#22c55e"
                  label="Nível de Saúde Financeira"
                  size={150}
                />
              </div>
            </div>
          </div>

          {/* ===== 4. LUCRO ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Lucro<span className="rel-pdf-dot">.</span></div>

            <div style={{ padding: '0 24px 28px' }}>
              <hr className="rel-lucro-divider" />

              {prev && prev.fat > 0 && (
                <div className="rel-lucro-prev-row">
                  <div className="rel-lucro-prev-col">
                    <div className="rel-lucro-prev-label">{prevNome}</div>
                    <div className="rel-lucro-prev-val" style={{ color: 'var(--saida)' }}>{fmt(custoPrev)}</div>
                  </div>
                  <div className="rel-lucro-prev-col">
                    <div className="rel-lucro-prev-label">{prevNome}</div>
                    <div className="rel-lucro-prev-val" style={{ color: prev.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(prev.lucLiq)}</div>
                  </div>
                  <div className="rel-lucro-prev-col">
                    <div className="rel-lucro-prev-label">{prevNome}</div>
                    <div className="rel-lucro-prev-val" style={{ color: margemPrev !== null && margemPrev >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                      {margemPrev !== null ? fmtPct(margemPrev) : '—'}
                    </div>
                  </div>
                </div>
              )}

              <div className="rel-lucro-cards">
                <div className="rel-lucro-card" style={{ borderColor: 'rgba(239,68,68,.4)' }}>
                  <div className="rel-lucro-card-label">{mesNome}</div>
                  <div className="rel-lucro-card-name" style={{ color: 'var(--saida)' }}>Custo</div>
                  <div className="rel-lucro-card-val" style={{ color: 'var(--saida)' }}>{fmt(custoAtual)}</div>
                </div>
                <div className="rel-lucro-card" style={{ borderColor: d.lucLiq >= 0 ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)' }}>
                  <div className="rel-lucro-card-label">{mesNome}</div>
                  <div className="rel-lucro-card-name" style={{ color: d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>Lucro Líquido</div>
                  <div className="rel-lucro-card-val" style={{ color: d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(d.lucLiq)}</div>
                </div>
                <div className="rel-lucro-card" style={{ borderColor: 'rgba(245,158,11,.4)' }}>
                  <div className="rel-lucro-card-label">{mesNome}</div>
                  <div className="rel-lucro-card-name" style={{ color: '#f59e0b' }}>Margem</div>
                  <div className="rel-lucro-card-val" style={{ color: margemMes !== null && margemMes >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                    {margemMes !== null ? fmtPct(margemMes) : '—'}
                  </div>
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
