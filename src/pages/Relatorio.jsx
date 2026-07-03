import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';
import { CMVCATS, DEDUCOES_CATS, SGA_CATS, NAOOP_CATS, GASTOS_CATS } from '../services/constants';
import { fmt, fmtPct, hoje, MESES } from '../services/utils';
import './Relatorio.css';

function calcPeriodo(lancamentos, inicio, fim) {
  const lm        = lancamentos.filter(l => l.data >= inicio && l.data <= fim);
  const fat       = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const deducoes  = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const recLiq    = fat - deducoes;
  const cmvTotal  = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const sga       = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp     = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const gastos    = lm.filter(l => l.tipo === 'Saída' && GASTOS_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto  = recLiq - cmvTotal;
  const lucLiq    = recLiq - cmvTotal - sga - naoOp;

  const aps         = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && l.subcategoria === 'iPhone' && !l.isCMV && l.status !== 'Pendente');
  const fatAp       = aps.reduce((a, l) => a + l.valor, 0);
  const uni         = aps.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket      = uni > 0 ? fatAp / uni : 0;
  const apGrupoIds  = new Set(aps.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvAp       = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedAp       = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const lucMedio    = uni > 0 ? (fatAp - cmvAp - dedAp) / uni : 0;

  const accs        = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Acessórios' && !l.isCMV && l.status !== 'Pendente');
  const fatAcc      = accs.reduce((a, l) => a + l.valor, 0);
  const uniAcc      = accs.reduce((a, l) => a + (l.quantidade || 1), 0);
  const accGrupoIds = new Set(accs.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvAcc      = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && accGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedAcc      = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && accGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const lucAcc      = fatAcc - cmvAcc - dedAcc;
  const lucMedioAcc = uniAcc > 0 ? lucAcc / uniAcc : 0;

  const lmDFC        = lm.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
  const entBruto     = lmDFC.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0);
  const dedInline    = lmDFC.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const upgradeInline = lmDFC.filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0).reduce((a, l) => a + l.valorUpgrade, 0);
  const entCaixa     = entBruto - upgradeInline;
  const saiCaixa     = lmDFC.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0) + dedInline;
  const caixaLiq     = entCaixa - saiCaixa;
  const margemBruta = fat > 0 ? lucBruto / fat * 100 : 0;

  const cvIndiretos = lm.filter(l => l.tipo === 'Saída' && l.categoria === 'Custos Variáveis Indiretos' && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const custoFixos  = lm.filter(l => l.tipo === 'Saída' && ['Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados','Impostos'].includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);

  return { fat, cmvTotal, sga, naoOp, gastos, lucBruto, lucLiq,
           uni, fatAp, ticket, lucMedio, uniAcc, fatAcc, cmvAcc, lucAcc, lucMedioAcc,
           entCaixa, saiCaixa, caixaLiq, margemBruta, cvIndiretos, custoFixos };
}

function calcScore(d, prevFat) {
  if (d.fat === 0) return { total: 0, cor: '#527060', pilares: [] };

  const mc_pct = (d.fat - d.cmvTotal - d.cvIndiretos) / d.fat * 100;
  const mc_pts = mc_pct > 30 ? 2 : mc_pct >= 20 ? 1 : 0;

  const ml_pct = d.lucLiq / d.fat * 100;
  const ml_pts = ml_pct > 10 ? 2 : ml_pct >= 5 ? 1 : 0;

  const imc    = d.fat > 0 ? (d.fat - d.cmvTotal - d.cvIndiretos) / d.fat : 0;
  const pe     = imc > 0 ? d.custoFixos / imc : d.fat;
  const ms_pct = (d.fat - pe) / d.fat * 100;
  const ms_pts = ms_pct > 20 ? 2 : ms_pct >= 10 ? 1 : 0;

  const fc_pct = d.caixaLiq / d.fat * 100;
  const fc_pts = d.caixaLiq > 0 ? 2 : fc_pct >= -10 ? 1 : 0;

  const cresc_pct = prevFat > 0 ? (d.fat - prevFat) / prevFat * 100 : 0;
  const cresc_pts = cresc_pct > 5 ? 2 : cresc_pct >= -5 ? 1 : 0;

  const pts  = mc_pts + ml_pts + ms_pts + fc_pts + cresc_pts;
  const total = pts / 10 * 100;
  const cor   = total >= 70 ? '#22c55e' : total >= 40 ? '#f59e0b' : '#f03e3e';

  return {
    total, cor, pts,
    pilares: [
      { label: 'Margem de Contribuição', valor: mc_pct.toFixed(1) + '%', pts: mc_pts },
      { label: 'Margem Líquida',         valor: ml_pct.toFixed(1) + '%', pts: ml_pts },
      { label: 'Margem de Segurança',    valor: ms_pct.toFixed(1) + '%', pts: ms_pts },
      { label: 'Fluxo de Caixa',         valor: fc_pct.toFixed(1) + '%', pts: fc_pts },
      { label: 'Crescimento da Receita', valor: (prevFat > 0 ? (cresc_pct > 0 ? '+' : '') + cresc_pct.toFixed(1) + '%' : '—'), pts: cresc_pts },
    ],
  };
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

function fmtDateBR(iso) {
  if (!iso) return '';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}


export default function Relatorio() {
  const { lancamentos, clienteAtivo } = useApp();

  const [dataInicio, setDataInicio] = useState(
    () => localStorage.getItem('rel_dataInicio') || `${hoje().slice(0, 7)}-01`
  );
  const [dataFim, setDataFim] = useState(
    () => localStorage.getItem('rel_dataFim') || hoje()
  );

  function atualizarInicio(v) { setDataInicio(v); localStorage.setItem('rel_dataInicio', v); }
  function atualizarFim(v)    { setDataFim(v);    localStorage.setItem('rel_dataFim', v); }

  const [verLancamentos, setVerLancamentos] = useState(false);
  const [revelar, setRevelar]               = useState(false);

  const anoGrafico = dataFim.slice(0, 4);

  const mv = useMemo(() =>
    MESES.map((_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return calcPeriodo(lancamentos, `${anoGrafico}-${m}-01`, `${anoGrafico}-${m}-31`);
    }),
    [lancamentos, anoGrafico]
  );

  const d = useMemo(() =>
    calcPeriodo(lancamentos, dataInicio, dataFim),
    [lancamentos, dataInicio, dataFim]
  );

  const filtrados = useMemo(() =>
    lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim),
    [lancamentos, dataInicio, dataFim]
  );

  const margemMes  = d.fat > 0 ? d.lucLiq / d.fat * 100 : null;
  const custoAtual = d.cmvTotal + d.gastos;

  const mesAtual   = parseInt(dataFim.slice(5, 7)) - 1;
  const prevFat    = mesAtual > 0 ? mv[mesAtual - 1].fat : 0;
  const score      = calcScore(d, prevFat);

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

  const labelPeriodo = `${fmtDateBR(dataInicio)} — ${fmtDateBR(dataFim)}`;

  return (
    <div className="relatorio-page">

      {/* ── Filtros ── */}
      <div className="rel-filtros no-print">
        <span className="period-label">Período</span>
        <input type="date" className="period-select" value={dataInicio} onChange={e => atualizarInicio(e.target.value)} />
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>até</span>
        <input type="date" className="period-select" value={dataFim} onChange={e => atualizarFim(e.target.value)} />
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setVerLancamentos(v => !v)}
        >
          {verLancamentos ? 'Ocultar lançamentos ▲' : 'Ver lançamentos ▼'}
        </button>
      </div>

      {verLancamentos && (
        <div className="table-panel" style={{ marginBottom: 8 }}>
          <div style={{ padding: '14px 20px 6px', fontWeight: 700, fontSize: 13, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Lançamentos do período — {labelPeriodo}
          </div>
          {filtrados.filter(l => !(l.isCMV && l.grupoId)).length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>Nenhum lançamento neste período</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados
                    .filter(l => !(l.isCMV && l.grupoId))
                    .sort((a, b) => a.data < b.data ? 1 : -1)
                    .map(l => (
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
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {d.fat > 0 && (
        <div className="rel-monthly">

          {/* ── Header Resumo Executivo ── */}
          <div className="rel-exec-header">
            <img src="/logo-horizontal.png" alt="SOUZ Finance" className="rel-exec-logo" />
            <div className="rel-exec-label">Resumo Executivo</div>
            <div className="rel-exec-divider" />
            <div className="rel-exec-title">{clienteAtivo?.obs || clienteAtivo?.nome}</div>
            <div className="rel-exec-period">{labelPeriodo}</div>
            <div className="rel-exec-footer">
              <div className="rel-exec-footer-brand">Preparado por SOUZ Finance</div>
              <div className="rel-exec-scroll">↓</div>
            </div>
          </div>

          {/* ===== 1. VENDAS ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Vendas<span className="rel-pdf-dot">.</span></div>
            <div className="rel-pdf-subheading">{labelPeriodo}</div>

            <div className="rel-vendas-layout">
              <div className="rel-vendas-stats">

                <div className="rel-kv-group">
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Faturamento total</span>
                    <span className="rel-kv-val" style={{ color: 'var(--entrada)' }}>{fmt(d.fat)}</span>
                  </div>
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Gastos totais</span>
                    <span className="rel-kv-val" style={{ color: 'var(--saida)' }}>{fmt(d.gastos)}</span>
                  </div>
                </div>

                <div className="rel-kv-group">
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Total de aparelhos vendidos</span>
                    <span className="rel-kv-val">{d.uni > 0 ? d.uni : '—'}</span>
                  </div>
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Lucro médio por aparelho</span>
                    <span className="rel-kv-val" style={{ color: d.uni > 0 ? (d.lucMedio >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)' }}>
                      {d.uni > 0 ? fmt(d.lucMedio) : '—'}
                    </span>
                  </div>
                </div>

                <div className="rel-kv-group">
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Total de acessórios vendidos</span>
                    <span className="rel-kv-val">{d.uniAcc > 0 ? d.uniAcc : '—'}</span>
                  </div>
                  <div className="rel-kv-row">
                    <span className="rel-kv-label">Lucro acumulado acessórios</span>
                    <span className="rel-kv-val" style={{ color: d.lucAcc >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                      {fmt(d.lucAcc)}
                    </span>
                  </div>
                </div>

                {(d.uni > 0 || d.uniAcc > 0) && (
                  <div className="rel-kv-group">
                    <div className="rel-kv-row">
                      <span className="rel-kv-label">Lucro médio por aparelho e acessório</span>
                      <span className="rel-kv-val" style={{ color: 'var(--entrada)' }}>
                        {d.uni > 0 ? fmt((d.lucMedio * d.uni + d.lucAcc) / d.uni) : '—'}
                      </span>
                    </div>
                    <div className="rel-kv-row">
                      <span className="rel-kv-label">Ticket médio de aparelhos</span>
                      <span className="rel-kv-val">{d.uni > 0 ? fmt(d.ticket) : '—'}</span>
                    </div>
                  </div>
                )}

              </div>

              <div className="rel-chart-container">
                <div className="rel-chart-title">Total de Vendas — {anoGrafico}</div>
                <div className="rel-chart-legend">
                  <span><span className="rel-legend-dot" style={{ background: '#22c55e' }} />Aparelhos</span>
                  <span><span className="rel-legend-dot" style={{ background: '#06b6d4' }} />Acessórios</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosBarVendas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Bar dataKey="Aparelhos" fill="#22c55e" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Acessórios" fill="#06b6d4" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ===== 2. RECEITA ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Receita<span className="rel-pdf-dot">.</span></div>

            <div className="rel-receita-layout">
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

              <div className="rel-receita-center">
                <p style={{ fontSize: 14, lineHeight: 1.8 }}>
                  Foi gerado um total de{' '}
                  <strong style={{ color: 'var(--entrada)' }}>{fmt(d.fat)}</strong>{' '}
                  em receita bruta no período de {labelPeriodo}.
                </p>
              </div>

              <div className="rel-receita-right">
                <div className="rel-chart-title">Receita Mensal — {anoGrafico}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dadosBarFat} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 9 }} />
                    <YAxis tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} tick={{ fill: 'var(--text2)', fontSize: 9 }} />
                    <Tooltip content={<TooltipBRL />} />
                    <Bar dataKey="Faturamento" fill="#22c55e" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                <Gauge pct={score.total} color={score.cor} label="Saúde Financeira" size={150} />
              </div>
            </div>
          </div>

          {/* ===== 4. LUCRO ===== */}
          <div className="table-panel rel-pdf-section">
            <div className="rel-pdf-heading">Lucro<span className="rel-pdf-dot">.</span></div>

            <div style={{ padding: '0 24px 28px' }}>
              <hr className="rel-lucro-divider" />
              <div className="rel-lucro-cards">
                <div className="rel-lucro-card" style={{ borderColor: 'rgba(239,68,68,.4)' }}>
                  <div className="rel-lucro-card-label">{labelPeriodo}</div>
                  <div className="rel-lucro-card-name" style={{ color: 'var(--saida)' }}>Custo Total</div>
                  <div className="rel-lucro-card-val" style={{ color: 'var(--saida)' }}>{fmt(custoAtual)}</div>
                </div>
                <div className="rel-lucro-card" style={{ borderColor: d.lucLiq >= 0 ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)' }}>
                  <div className="rel-lucro-card-label">{labelPeriodo}</div>
                  <div className="rel-lucro-card-name" style={{ color: d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>Lucro Líquido</div>
                  <div className="rel-lucro-card-val" style={{ color: d.lucLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(d.lucLiq)}</div>
                </div>
                <div className="rel-lucro-card" style={{ borderColor: 'rgba(245,158,11,.4)' }}>
                  <div className="rel-lucro-card-label">{labelPeriodo}</div>
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

      {d.fat === 0 && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div>Nenhum lançamento para {labelPeriodo}</div>
        </div>
      )}
    </div>
  );
}
