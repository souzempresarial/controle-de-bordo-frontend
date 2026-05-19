import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtData } from '../services/utils';
import './Lancamentos.css';

export default function Lancamentos() {
  const { lancamentos } = useApp();

  const [busca, setBusca]           = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCat, setFiltroCat]   = useState('');
  const [filtroSub, setFiltroSub]   = useState('');
  const [filtroMes, setFiltroMes]   = useState('');

  // Listas para filtros
  const todasCats  = useMemo(() => [...new Set(lancamentos.map(l => l.categoria))].filter(Boolean).sort(), [lancamentos]);
  const todasSubs  = useMemo(() => {
    const base = filtroCat ? lancamentos.filter(l => l.categoria === filtroCat) : lancamentos;
    return [...new Set(base.map(l => l.subcategoria))].filter(Boolean).sort();
  }, [lancamentos, filtroCat]);
  const todosMeses = useMemo(() => [...new Set(lancamentos.map(l => l.data.slice(0,7)))].sort().reverse(), [lancamentos]);

  const semCMV = useMemo(() => lancamentos.filter(l => !(l.isCMV && l.grupoId)), [lancamentos]);

  const filtrados = useMemo(() => {
    let lista = semCMV;
    if (filtroTipo) lista = lista.filter(l => l.tipo === filtroTipo);
    if (filtroCat)  lista = lista.filter(l => l.categoria === filtroCat);
    if (filtroSub)  lista = lista.filter(l => l.subcategoria === filtroSub);
    if (filtroMes)  lista = lista.filter(l => l.data.startsWith(filtroMes));
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(l =>
        (l.descricao||'').toLowerCase().includes(b) ||
        (l.categoria||'').toLowerCase().includes(b) ||
        (l.subcategoria||'').toLowerCase().includes(b) ||
        String(l.id).includes(b)
      );
    }
    return lista;
  }, [semCMV, filtroTipo, filtroCat, filtroSub, filtroMes, busca]);

  const totaisFiltro = useMemo(() => {
    const entradas = filtrados.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + parseFloat(l.valor), 0);
    const saidas   = filtrados.filter(l => l.tipo === 'Saída').reduce((a, l) => a + parseFloat(l.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtrados]);


  return (
    <div className="lancamentos-page">
      <div className="table-panel">
        <div className="table-header">
          <h2>Todos os Lançamentos</h2>
          <input className="search-box" placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="filter-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option>Entrada</option><option>Saída</option><option>Transferência</option>
          </select>
          <select className="filter-select" value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setFiltroSub(''); }}>
            <option value="">Todas categorias</option>
            {todasCats.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={filtroSub} onChange={e => setFiltroSub(e.target.value)}>
            <option value="">Todas subcategorias</option>
            {todasSubs.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {todosMeses.map(m => {
              const [y, mo] = m.split('-');
              return <option key={m} value={m}>{new Date(y, mo-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
        </div>

        {filtrados.length > 0 && (
          <div style={{ display: 'flex', gap: 20, padding: '10px 0', fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text2)' }}>{filtrados.length} lançamento{filtrados.length !== 1 ? 's' : ''}</span>
            {totaisFiltro.entradas > 0 && <span style={{ color: 'var(--entrada)', fontWeight: 700 }}>Entradas: +{fmt(totaisFiltro.entradas)}</span>}
            {totaisFiltro.saidas   > 0 && <span style={{ color: 'var(--saida)',   fontWeight: 700 }}>Saídas: -{fmt(totaisFiltro.saidas)}</span>}
            {totaisFiltro.entradas > 0 && totaisFiltro.saidas > 0 && (
              <span style={{ color: totaisFiltro.saldo >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 700 }}>
                Saldo: {fmt(totaisFiltro.saldo)}
              </span>
            )}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div>Nenhum lançamento encontrado</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Data</th><th>Tipo</th><th>Categoria</th>
                  <th>Subcategoria</th><th>Descrição</th><th>Pagamento</th>
                  <th>Status</th><th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => {
                  const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
                  return (
                    <tr key={l.id}>
                      <td className="id-cell">#{String(l.id).padStart(3,'0')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                      <td><span className={`tipo-badge tipo-${l.tipo}`}>{l.tipo}</span></td>
                      <td>{l.categoria}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.subcategoria || '—'}</td>
                      <td>
                        {l.descricao}
                        {cmv && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11 }}>
                            <span style={{ background: '#f03e3e18', color: 'var(--saida)', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>CMV {fmt(cmv.valor)}</span>
                            <span style={{ color: (l.valor - cmv.valor) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                              Lucro {fmt(l.valor - cmv.valor)} · Margem {l.valor > 0 ? ((l.valor - cmv.valor) / l.valor * 100).toFixed(2) : 0}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text2)' }}>{l.pagamento || '—'}</td>
                      <td><span style={{ fontSize: 11, color: l.status === 'Pendente' ? 'var(--warn)' : 'var(--text2)' }}>{l.status}</span></td>
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
