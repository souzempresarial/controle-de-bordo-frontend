import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CMVCATS, SGA_CATS, NAOOP_CATS } from '../services/constants';
import { fmt, fmtPct, hoje, MESES, MESES_FULL } from '../services/utils';
import './Relatorio.css';

function calcMes(lancamentos, pfx) {
  const lm     = lancamentos.filter(l => l.data.startsWith(pfx));
  const fat    = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const cmv    = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const sga    = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const naoOp  = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const lucBruto = fat - cmv;
  const lucLiq   = fat - cmv - sga - naoOp;
  const vendas   = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV);
  const uni      = vendas.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket   = uni > 0 ? fat / uni : null;
  const margem   = fat > 0 ? (lucBruto / fat * 100) : null;
  const cmvPct   = fat > 0 ? (cmv / fat * 100) : null;
  return { fat, cmv, sga, naoOp, lucBruto, lucLiq, uni, ticket, margem, cmvPct };
}

export default function Relatorio() {
  const { lancamentos } = useApp();

  const anoAtual = hoje().slice(0, 4);
  const mesAtual = parseInt(hoje().slice(5, 7)) - 1;

  const [ano, setAno]         = useState(anoAtual);
  const [mesFiltro, setMesFiltro] = useState(''); // '' = ano inteiro, '0'..'11' = mês

  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  // Dados mensais do ano
  const mv = useMemo(() =>
    MESES.map((_, i) => calcMes(lancamentos, `${ano}-${String(i + 1).padStart(2, '0')}`)),
    [lancamentos, ano]
  );

  // Período filtrado
  const filtrados = useMemo(() => {
    const lancAno = lancamentos.filter(l => l.data.startsWith(ano));
    if (mesFiltro === '') return lancAno;
    const m = parseInt(mesFiltro);
    return lancAno.filter(l => parseInt(l.data.slice(5, 7)) - 1 === m);
  }, [lancamentos, ano, mesFiltro]);

  const periodo = mesFiltro !== '' ? calcMes(lancamentos, `${ano}-${String(parseInt(mesFiltro) + 1).padStart(2, '0')}`) : null;
  const labelPeriodo = mesFiltro !== '' ? `${MESES_FULL[parseInt(mesFiltro)]}/${ano}` : ano;

  // Totais do período selecionado
  const totFat    = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const totCMV    = filtrados.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const totSGA    = filtrados.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const totNaoOp  = filtrados.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const totLucBruto = totFat - totCMV;
  const totLucLiq   = totFat - totCMV - totSGA - totNaoOp;
  const totMargem   = totFat > 0 ? (totLucBruto / totFat * 100) : null;
  const totVendas   = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV);
  const totUni      = totVendas.reduce((a, l) => a + (l.quantidade || 1), 0);
  const totTicket   = totUni > 0 ? totFat / totUni : null;
  const totCMVPct   = totFat > 0 ? (totCMV / totFat * 100) : null;

  // Gastos por categoria
  const porCat = useMemo(() => {
    const obj = {};
    filtrados
      .filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria))
      .forEach(l => { obj[l.categoria] = (obj[l.categoria] || 0) + l.valor; });
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  const maxGasto = porCat[0]?.[1] || 1;

  const corMargem = (m) => m === null ? 'var(--text2)' : m >= 30 ? 'var(--entrada)' : m >= 15 ? 'var(--warn)' : 'var(--saida)';
  const corLucro  = (v) => v >= 0 ? 'var(--entrada)' : 'var(--saida)';

  return (
    <div className="relatorio-page">
      {/* Seletor */}
      <div className="rel-filtros">
        <span className="period-label">Relatório</span>
        <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
          <option value="">Ano inteiro</option>
          {MESES_FULL.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
        </select>
        <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Cards resumo do período */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Faturamento</div>
          <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(totFat)}</div>
          <div className="card-sub">{labelPeriodo}</div>
        </div>
        <div className="card">
          <div className="card-label">Lucro Bruto</div>
          <div className="card-value" style={{ color: corLucro(totLucBruto) }}>{fmt(totLucBruto)}</div>
          <div className="card-sub">CMV: {fmt(totCMV)}</div>
        </div>
        <div className="card">
          <div className="card-label">Lucro Líquido</div>
          <div className="card-value" style={{ color: corLucro(totLucLiq) }}>{fmt(totLucLiq)}</div>
          <div className="card-sub">SG&A: {fmt(totSGA)}</div>
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

      {/* Tabela mensal — só no ano inteiro */}
      {mesFiltro === '' && (
        <div className="table-panel">
          <div className="table-header">
            <h2>Evolução Mensal — {ano}</h2>
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
                    <td style={{ textAlign: 'right' }}>{m.ticket !== null ? fmt(m.ticket) : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{m.uni > 0 ? m.uni : '—'}</td>
                  </tr>
                ))}
                {/* Totais */}
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
      )}

      {/* Gastos por categoria */}
      {porCat.length > 0 && (
        <div className="table-panel">
          <div className="table-header">
            <h2>Gastos por Categoria — {labelPeriodo}</h2>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {porCat.map(([cat, val]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span>{cat}</span>
                  <span style={{ color: 'var(--saida)', fontWeight: 600 }}>{fmt(val)}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(val / maxGasto * 100).toFixed(1)}%`, background: 'var(--saida)', borderRadius: 3, transition: 'width .3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
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
