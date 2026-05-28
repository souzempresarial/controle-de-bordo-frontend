import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { CATEGORIAS_CMV, getCatsPorTipo, getSubcats, getCmvSubAuto } from '../services/constants';
import { fmt, fmtData, hoje } from '../services/utils';
import './Lancamentos.css';

const formVazio = (l, cmv) => ({
  data: l.data || hoje(),
  tipo: l.tipo,
  valor: l.valor,
  descricao: l.descricao || '',
  categoria: l.categoria || '',
  subcategoria: l.subcategoria || '',
  pagamento: l.pagamento || '',
  status: l.status || 'Confirmado',
  obs: l.obs || '',
  quantidade: l.quantidade || '',
  valorRecebido: l.valorRecebido ?? '',
  cmvValor: cmv ? cmv.valor : '',
  cmvCat:   cmv ? (cmv.categoria || 'Custos Variáveis Diretos') : 'Custos Variáveis Diretos',
  cmvSub:   cmv ? (cmv.subcategoria || '') : '',
});

export default function Lancamentos() {
  const { lancamentos, setLancamentos, clienteAtivo } = useApp();

  const [busca, setBusca]           = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCat, setFiltroCat]   = useState('');
  const [filtroSub, setFiltroSub]   = useState('');
  const [filtroMes, setFiltroMes]   = useState('');

  const [editando, setEditando]         = useState(null);
  const [editandoCMV, setEditandoCMV]   = useState(null);
  const [form, setForm]                 = useState(null);
  const [salvando, setSalvando]         = useState(false);
  const [erroForm, setErroForm]         = useState('');
  const [confirmando, setConfirmando]   = useState(null);

  const [sortCol, setSortCol] = useState('data');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function sortIcon(col) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

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

  const filtradosOrdenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'valor') { va = parseFloat(va); vb = parseFloat(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtrados, sortCol, sortDir]);

  const totaisFiltro = useMemo(() => {
    const entradas = filtrados.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + parseFloat(l.valor), 0);
    const saidas   = filtrados.filter(l => l.tipo === 'Saída').reduce((a, l) => a + parseFloat(l.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtrados]);

  const cats     = form ? getCatsPorTipo(form.tipo) : {};
  const subcats  = form ? getSubcats(form.categoria) : [];
  const cmvCats  = CATEGORIAS_CMV;
  const cmvSubs  = form ? getSubcats(form.cmvCat) : [];

  const isEntrada = form?.tipo === 'Entrada';
  const margemPreview = isEntrada && form?.valor && form?.cmvValor
    ? {
        lucro:  parseFloat(form.valor) - parseFloat(form.cmvValor),
        margem: ((parseFloat(form.valor) - parseFloat(form.cmvValor)) / parseFloat(form.valor) * 100).toFixed(2),
      }
    : null;

  function setField(campo, valor) {
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      if (campo === 'categoria')   { novo.subcategoria = ''; novo.cmvSub = getCmvSubAuto(valor, ''); }
      if (campo === 'subcategoria'){ novo.cmvSub = getCmvSubAuto(f.categoria, valor); }
      if (campo === 'cmvCat')      { novo.cmvSub = ''; }
      return novo;
    });
  }

  function abrirEditar(l) {
    const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
    setEditando(l);
    setEditandoCMV(cmv || null);
    setForm(formVazio(l, cmv));
    setErroForm('');
  }

  function fecharModal() { setEditando(null); setEditandoCMV(null); setForm(null); }

  async function salvar() {
    if (!form.valor || parseFloat(form.valor) <= 0) { setErroForm('Informe o valor'); return; }
    if (!form.categoria) { setErroForm('Selecione a categoria'); return; }
    setSalvando(true); setErroForm('');
    try {
      const atualizado = await API.editarLancamento(editando.id, {
        data: form.data, tipo: form.tipo, valor: parseFloat(form.valor),
        categoria: form.categoria, subcategoria: form.subcategoria,
        descricao: form.descricao, pagamento: form.pagamento,
        status: form.status, obs: form.obs,
        quantidade: form.tipo === 'Entrada' ? (parseInt(form.quantidade) || null) : null,
      });

      const vrRaw         = parseFloat(form.valorRecebido);
      const valorBruto    = parseFloat(form.valor);
      const isCartao      = form.pagamento === 'Crédito' || form.pagamento === 'Débito';
      const valorRecebido = (!isNaN(vrRaw) && vrRaw < valorBruto) ? vrRaw : null;

      let grupoId = editando.grupoId || null;
      let atualizadoCMV = null;
      let novoCMV = null;

      if (isEntrada && form.cmvValor && parseFloat(form.cmvValor) > 0) {
        if (editandoCMV) {
          atualizadoCMV = await API.editarLancamento(editandoCMV.id, {
            data: form.data, tipo: 'Saída',
            valor: parseFloat(form.cmvValor),
            categoria: form.cmvCat || editandoCMV.categoria,
            subcategoria: form.cmvSub || editandoCMV.subcategoria,
            descricao: editandoCMV.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: editandoCMV.obs,
          });
        } else {
          grupoId = grupoId || ('g' + Date.now());
          novoCMV = await API.criarLancamento(clienteAtivo.id, {
            tipo: 'Saída', valor: parseFloat(form.cmvValor), data: form.data,
            categoria: form.cmvCat, subcategoria: form.cmvSub,
            descricao: 'CMV — ' + form.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: 'CMV vinculado ao #' + String(editando.id).padStart(3, '0'),
            grupo_id: grupoId, is_cmv: true,
          });
        }
      }

      await API.editarLancamento(editando.id, {
        data: form.data, tipo: form.tipo, valor: parseFloat(form.valor),
        categoria: form.categoria, subcategoria: form.subcategoria,
        descricao: form.descricao, pagamento: form.pagamento,
        status: form.status, obs: form.obs,
        quantidade: isEntrada ? (parseInt(form.quantidade) || null) : null,
        valor_recebido: valorRecebido,
        grupo_id: grupoId,
      });

      setLancamentos(prev => {
        let lista = prev.map(l => {
          if (l.id === editando.id) return { ...l, ...atualizado, grupoId, valorRecebido };
          if (atualizadoCMV && l.id === editandoCMV.id) return { ...l, ...atualizadoCMV };
          return l;
        });
        if (novoCMV) lista = [novoCMV, ...lista];
        return lista;
      });
      fecharModal();
    } catch (err) {
      setErroForm(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    try {
      await API.excluirLancamento(clienteAtivo.id, id);
      setLancamentos(prev => {
        const sem = prev.filter(l => l.id !== id);
        const pais = new Set(sem.filter(l => l.grupoId && !l.isCMV).map(l => l.grupoId));
        const orfaos = sem.filter(l => l.isCMV && !pais.has(l.grupoId));
        orfaos.forEach(o => API.excluirLancamento(clienteAtivo.id, o.id));
        return sem.filter(l => !l.isCMV || pais.has(l.grupoId));
      });
    } catch (err) { console.error(err); }
    setConfirmando(null);
  }

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
                  <th>ID</th>
                  {[['data','Data'],['tipo','Tipo'],['categoria','Categoria'],['subcategoria','Subcategoria'],['descricao','Descrição'],['pagamento','Pagamento'],['status','Status']].map(([col, label]) => (
                    <th key={col} onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label}{sortIcon(col)}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort('valor')}>
                    Valor{sortIcon('valor')}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradosOrdenados.map(l => {
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
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(l)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmando(l)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar */}
      {editando && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>Editar Lançamento #{String(editando.id).padStart(3,'0')}</h3>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>Data</label>
                  <input type="date" value={form.data} onChange={e => setField('data', e.target.value)} />
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={form.tipo} disabled>
                    <option>Entrada</option><option>Saída</option><option>Transferência</option>
                  </select>
                </div>
                <div className="field">
                  <label>{isEntrada ? 'Valor Venda (R$)' : 'Valor (R$)'}</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setField('valor', e.target.value)} />
                </div>
                {isEntrada && (
                  <div className="field">
                    <label>Valor Recebido (R$)</label>
                    <input type="number" step="0.01" placeholder="deixe vazio se total" value={form.valorRecebido} onChange={e => setField('valorRecebido', e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
                    <option value="">— selecione —</option>
                    {Object.entries(cats).map(([cat, subs]) =>
                      subs === null
                        ? <option key={cat} disabled style={{ color: 'var(--text2)', fontSize: 11 }}>{cat}</option>
                        : <option key={cat}>{cat}</option>
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Subcategoria</label>
                  <select value={form.subcategoria} onChange={e => setField('subcategoria', e.target.value)}>
                    <option value="">— selecione —</option>
                    {subcats.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>Descrição</label>
                  <input type="text" value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Pagamento</label>
                  <select value={form.pagamento} onChange={e => setField('pagamento', e.target.value)}>
                    <option value="">—</option>
                    <option>Dinheiro</option><option>Pix</option><option>Crédito</option>
                    <option>Débito</option><option>Boleto</option><option>Transferência</option><option>Outro</option>
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}>
                    <option>Confirmado</option><option>Pendente</option>
                  </select>
                </div>
                {isEntrada && (
                  <div className="field">
                    <label>Quantidade</label>
                    <input type="number" value={form.quantidade} onChange={e => setField('quantidade', e.target.value)} />
                  </div>
                )}
                <div className="field span2">
                  <label>Observações</label>
                  <input type="text" value={form.obs} onChange={e => setField('obs', e.target.value)} />
                </div>
              </div>

              {isEntrada && (
                <div className="cmv-section">
                  <div className="cmv-titulo">Custo da Mercadoria Vendida (CMV)</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Valor CMV (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.cmvValor} onChange={e => setField('cmvValor', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Subcategoria CMV</label>
                      <select value={form.cmvSub} onChange={e => setField('cmvSub', e.target.value)}>
                        <option value="">— selecione —</option>
                        {cmvSubs.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  {margemPreview && (
                    <div className="margem-preview">
                      <span>Receita: <strong>{fmt(parseFloat(form.valor))}</strong></span>
                      <span>CMV: <strong style={{ color: 'var(--saida)' }}>{fmt(parseFloat(form.cmvValor))}</strong></span>
                      <span>Lucro: <strong style={{ color: margemPreview.lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(margemPreview.lucro)}</strong></span>
                      <span>Margem: <strong style={{ color: margemPreview.margem >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{margemPreview.margem}%</strong></span>
                    </div>
                  )}
                </div>
              )}

              {erroForm && <div className="form-erro">{erroForm}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmando(null)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Excluir Lançamento</h3>
              <button className="modal-close" onClick={() => setConfirmando(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                Excluir <strong style={{ color: 'var(--text)' }}>#{String(confirmando.id).padStart(3,'0')} — {confirmando.descricao}</strong> ({fmt(confirmando.valor)})?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmando.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
