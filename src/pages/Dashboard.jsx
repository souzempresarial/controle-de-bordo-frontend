import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import './Dashboard.css';

const CMVCATS = ['Custos Variáveis Diretos'];

const fmt = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v) => v !== null && v !== undefined ? v.toFixed(2) + '%' : '—';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function mesAnterior(mes) {
  const [ano, m] = mes.split('-');
  if (parseInt(m) === 1) return `${parseInt(ano) - 1}-12`;
  return `${ano}-${String(parseInt(m) - 1).padStart(2, '0')}`;
}

function calcularTotais(lista) {
  let entradas = 0, saidas = 0;
  lista
    .filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'))
    .forEach(l => {
      if (l.tipo === 'Entrada') entradas += l.valorRecebido ?? l.valor;
      else if (l.tipo === 'Saída') saidas += l.valor;
    });
  return { entradas, saidas, saldo: entradas - saidas };
}

function fmtData(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function Dashboard() {
  const { lancamentos } = useApp();

  const mesAtual = hoje().slice(0, 7);
  const [mes, setMes]   = useState(mesAtual.slice(5, 7));
  const [ano, setAno]   = useState(mesAtual.slice(0, 4));

  const periodo = `${ano}-${mes}`;
  const prevMes = mesAnterior(periodo);

  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(hoje().slice(0, 4));
    return [...set].sort().reverse();
  }, [lancamentos]);

  const lm    = useMemo(() => lancamentos.filter(l => l.data.startsWith(periodo)), [lancamentos, periodo]);
  const lprev = useMemo(() => lancamentos.filter(l => l.data.startsWith(prevMes)), [lancamentos, prevMes]);

  const tm    = calcularTotais(lm);
  const tp    = calcularTotais(lprev);
  const fat      = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const fatPrev  = lprev.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const cmvMes   = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const cmvPrev  = lprev.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);

  const margBruta     = fat > 0     ? ((fat - cmvMes) / fat * 100) : 0;
  const margBrutaPrev = fatPrev > 0 ? ((fatPrev - cmvPrev) / fatPrev * 100) : 0;

  const lucroBruto  = fat - cmvMes;
  const margemBruta = fat > 0 ? (lucroBruto / fat * 100) : null;
  const vendas      = lm.filter(l => l.tipo === 'Entrada');
  const unidades    = vendas.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket      = vendas.length > 0 ? fat / unidades : null;
  const cmvPct      = fat > 0 ? (cmvMes / fat * 100) : null;
  const roi         = cmvMes > 0 ? (lucroBruto / cmvMes * 100) : null;

  const corMar = margemBruta === null ? 'var(--text2)' : margemBruta >= 30 ? 'var(--entrada)' : margemBruta >= 15 ? 'var(--warn)' : 'var(--saida)';
  const corCMV = cmvPct === null ? 'var(--text2)' : cmvPct <= 60 ? 'var(--entrada)' : cmvPct <= 75 ? 'var(--warn)' : 'var(--saida)';
  const corROI = roi === null ? 'var(--text2)' : roi >= 50 ? 'var(--entrada)' : roi >= 20 ? 'var(--warn)' : 'var(--saida)';

  const semCMV = lm.filter(l => !l.isCMV).slice(0, 50);

  return (
    <div className="dashboard">
      {/* Seletor de período */}
      <div className="period-row">
        <span className="period-label">Período</span>
        <select className="period-select" value={mes} onChange={e => setMes(e.target.value)}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>
              {new Date(2024, i).toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
            </option>
          ))}
        </select>
        <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* Cards resumo */}
      <div className="cards">
        <div className="card c-entrada">
          <div className="card-label">Faturamento do Mês</div>
          <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(fat)}</div>
          <div className="card-sub">Mês anterior: <span style={{ color: 'var(--entrada)' }}>{fmt(fatPrev)}</span></div>
        </div>
        <div className="card c-saida">
          <div className="card-label">Saídas do Mês</div>
          <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(tm.saidas)}</div>
          <div className="card-sub">Mês anterior: <span style={{ color: 'var(--saida)' }}>{fmt(tp.saidas)}</span></div>
        </div>
        <div className="card c-saldo">
          <div className="card-label">Saldo do Mês</div>
          <div className="card-value" style={{ color: tm.saldo >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(tm.saldo)}</div>
          <div className="card-sub">Mês anterior: <span style={{ color: tp.saldo >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(tp.saldo)}</span></div>
        </div>
        <div className="card">
          <div className="card-label">Margem Bruta</div>
          <div className="card-value" style={{ color: margBruta >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{margBruta.toFixed(2)}%</div>
          <div className="card-sub">Mês anterior: <span style={{ color: margBrutaPrev >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{margBrutaPrev.toFixed(2)}%</span></div>
        </div>
      </div>

      {/* KPIs */}
      <div className="cards">
        <div className="card">
          <div className="card-label">Margem Bruta — Período</div>
          <div className="card-value" style={{ color: corMar }}>{fmtPct(margemBruta)}</div>
          <div className="card-sub">Lucro Bruto: <span style={{ color: lucroBruto >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(lucroBruto)}</span></div>
        </div>
        <div className="card">
          <div className="card-label">Ticket Médio — Período</div>
          <div className="card-value" style={{ color: 'var(--accent)' }}>{ticket !== null ? fmt(ticket) : '—'}</div>
          <div className="card-sub">{unidades} unidade{unidades !== 1 ? 's' : ''} vendida{unidades !== 1 ? 's' : ''}</div>
        </div>
        <div className="card">
          <div className="card-label">ROI — Período</div>
          <div className="card-value" style={{ color: corROI }}>{roi !== null ? fmtPct(roi) : '—'}</div>
          <div className="card-sub">Lucro {fmt(lucroBruto)} ÷ CMV {fmt(cmvMes)}</div>
        </div>
        <div className="card">
          <div className="card-label">CMV % — Período</div>
          <div className="card-value" style={{ color: corCMV }}>{fmtPct(cmvPct)}</div>
          <div className="card-sub">CMV: <span style={{ color: 'var(--saida)' }}>{fmt(cmvMes)}</span></div>
        </div>
      </div>

      {/* Tabela de últimos lançamentos */}
      <div className="table-panel">
        <div className="table-header">
          <h2>Últimos lançamentos</h2>
        </div>

        {semCMV.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div>Nenhum lançamento neste período</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {semCMV.map(l => {
                  const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
                  return (
                    <tr key={l.id}>
                      <td className="id-cell">#{String(l.id).padStart(3, '0')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                      <td><span className={`tipo-badge tipo-${l.tipo}`}>{l.tipo}</span></td>
                      <td>{l.categoria}</td>
                      <td>
                        {l.descricao}
                        {cmv && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                            <span style={{ background: '#f03e3e18', color: 'var(--saida)', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>CMV {fmt(cmv.valor)}</span>
                            <span style={{ color: (l.valor - cmv.valor) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>Lucro {fmt(l.valor - cmv.valor)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: l.status === 'Pendente' ? 'var(--warn)' : 'var(--text2)' }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: l.tipo === 'Entrada' ? 'var(--entrada)' : l.tipo === 'Saída' ? 'var(--saida)' : 'var(--transferencia)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {l.tipo === 'Entrada' ? '+' : l.tipo === 'Saída' ? '-' : ''}{fmt(l.valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
