import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { getCatsPorTipo, getSubcats, CATEGORIAS_CMV } from '../services/constants';
import { fmt, fmtData, hoje } from '../services/utils';
import './Lancamentos.css';

const formVazio = () => ({
  data: hoje(), tipo: 'Saída', valor: '', descricao: '', categoria: '',
  subcategoria: '', pagamento: '', status: 'Confirmado', obs: '', quantidade: '',
  valorRecebido: '', cmvValor: '', cmvCat: '', cmvSub: '',
});

export default function Lancamentos() {
  const { lancamentos, setLancamentos, clienteAtivo } = useApp();

  const [busca, setBusca]       = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCat, setFiltroCat]   = useState('');
  const [filtroMes, setFiltroMes]   = useState('');

  const [modalAberto, setModalAberto]   = useState(false);
  const [editandoId, setEditandoId]     = useState(null);
  const [form, setForm]                 = useState(formVazio);
  const [salvando, setSalvando]         = useState(false);
  const [erroForm, setErroForm]         = useState('');

  const [confirmando, setConfirmando]   = useState(null); // { id, descricao, valor }

  // Categorias e subcats derivadas do form
  const cats    = getCatsPorTipo(form.tipo);
  const subcats = getSubcats(form.categoria);
  const cmvCats = CATEGORIAS_CMV;
  const cmvSubs = getSubcats(form.cmvCat);

  // Listas para filtros
  const todasCats  = useMemo(() => [...new Set(lancamentos.map(l => l.categoria))].sort(), [lancamentos]);
  const todosMeses = useMemo(() => [...new Set(lancamentos.map(l => l.data.slice(0,7)))].sort().reverse(), [lancamentos]);

  const semCMV = useMemo(() => lancamentos.filter(l => !l.isCMV), [lancamentos]);

  const filtrados = useMemo(() => {
    let lista = semCMV;
    if (filtroTipo) lista = lista.filter(l => l.tipo === filtroTipo);
    if (filtroCat)  lista = lista.filter(l => l.categoria === filtroCat);
    if (filtroMes)  lista = lista.filter(l => l.data.startsWith(filtroMes));
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(l =>
        l.descricao.toLowerCase().includes(b) ||
        l.categoria.toLowerCase().includes(b) ||
        (l.subcategoria||'').toLowerCase().includes(b) ||
        String(l.id).includes(b)
      );
    }
    return lista;
  }, [semCMV, filtroTipo, filtroCat, filtroMes, busca]);

  function setField(campo, valor) {
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      if (campo === 'tipo') { novo.categoria = ''; novo.subcategoria = ''; novo.cmvValor = ''; novo.cmvCat = ''; novo.cmvSub = ''; }
      if (campo === 'categoria') { novo.subcategoria = ''; }
      if (campo === 'cmvCat') { novo.cmvSub = ''; }
      return novo;
    });
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio());
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(l) {
    setEditandoId(l.id);
    setForm({
      data: l.data || hoje(),
      tipo: l.tipo,
      valor: l.valor,
      descricao: l.descricao,
      categoria: l.categoria,
      subcategoria: l.subcategoria || '',
      pagamento: l.pagamento || '',
      status: l.status,
      obs: l.obs || '',
      quantidade: l.quantidade || '',
      valorRecebido: l.valorRecebido ?? '',
      cmvValor: '', cmvCat: '', cmvSub: '',
    });
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
  }

  async function salvar() {
    if (!form.valor || parseFloat(form.valor) <= 0) { setErroForm('Informe o valor'); return; }
    if (!form.categoria) { setErroForm('Selecione a categoria'); return; }

    const cmvValor = form.tipo === 'Entrada' ? (parseFloat(form.cmvValor) || 0) : 0;
    if (cmvValor > 0 && !form.cmvCat) { setErroForm('Selecione o tipo de custo do CMV'); return; }

    setSalvando(true);
    setErroForm('');
    try {
      if (editandoId) {
        const atualizado = await API.editarLancamento(editandoId, {
          data: form.data, tipo: form.tipo, valor: parseFloat(form.valor),
          categoria: form.categoria, subcategoria: form.subcategoria,
          descricao: form.descricao, pagamento: form.pagamento,
          status: form.status, obs: form.obs,
          quantidade: form.tipo === 'Entrada' ? (parseInt(form.quantidade) || null) : null,
        });
        setLancamentos(prev => prev.map(l => l.id === editandoId ? { ...l, ...atualizado } : l));
      } else {
        const quantidade    = form.tipo === 'Entrada' ? (parseInt(form.quantidade) || null) : null;
        const vrRaw         = parseFloat(form.valorRecebido);
        const valorRecebido = (!isNaN(vrRaw) && vrRaw < parseFloat(form.valor)) ? vrRaw : null;
        const grupoId       = cmvValor > 0 ? ('g' + Date.now()) : null;

        const novo = await API.criarLancamento(clienteAtivo.id, {
          tipo: form.tipo, valor: parseFloat(form.valor), data: form.data,
          categoria: form.categoria, subcategoria: form.subcategoria,
          descricao: form.descricao, pagamento: form.pagamento,
          status: form.status, obs: form.obs,
          quantidade, valor_recebido: valorRecebido, grupo_id: grupoId,
        });

        let novosLans = [novo];

        if (cmvValor > 0) {
          const cmv = await API.criarLancamento(clienteAtivo.id, {
            tipo: 'Saída', valor: cmvValor, data: form.data,
            categoria: form.cmvCat, subcategoria: form.cmvSub,
            descricao: 'CMV — ' + form.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: 'CMV vinculado ao #' + String(novo.id).padStart(3, '0'),
            grupo_id: grupoId, is_cmv: true,
          });
          novosLans = [cmv, novo];
        }

        setLancamentos(prev => [...novosLans, ...prev]);
      }
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
    } catch (err) {
      console.error(err);
    }
    setConfirmando(null);
  }

  const isEntrada = form.tipo === 'Entrada';
  const margemPreview = isEntrada && form.valor && form.cmvValor
    ? { lucro: parseFloat(form.valor) - parseFloat(form.cmvValor), margem: ((parseFloat(form.valor) - parseFloat(form.cmvValor)) / parseFloat(form.valor) * 100).toFixed(2) }
    : null;

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
          <select className="filter-select" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
            <option value="">Todas categorias</option>
            {todasCats.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {todosMeses.map(m => {
              const [y, mo] = m.split('-');
              return <option key={m} value={m}>{new Date(y, mo-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <button className="btn btn-primary" onClick={abrirNovo}>＋ Novo Lançamento</button>
        </div>

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
                  <th>Status</th><th style={{ textAlign: 'right' }}>Valor</th><th></th>
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

      {/* Modal Novo / Editar */}
      {modalAberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editandoId ? `Editar Lançamento #${String(editandoId).padStart(3,'0')}` : 'Novo Lançamento'}</h3>
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
                  <select value={form.tipo} onChange={e => setField('tipo', e.target.value)} disabled={!!editandoId}>
                    <option>Entrada</option><option>Saída</option><option>Transferência</option>
                  </select>
                </div>
                <div className="field">
                  <label>{isEntrada ? 'Valor Venda (R$)' : 'Valor (R$)'}</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setField('valor', e.target.value)} />
                </div>
                {isEntrada && !editandoId && (
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
                  <input type="text" placeholder="Descrição do lançamento" value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
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
                    <input type="number" placeholder="1" value={form.quantidade} onChange={e => setField('quantidade', e.target.value)} />
                  </div>
                )}
                <div className="field span2">
                  <label>Observações</label>
                  <input type="text" placeholder="Opcional" value={form.obs} onChange={e => setField('obs', e.target.value)} />
                </div>
              </div>

              {/* CMV — só para Entrada nova */}
              {isEntrada && !editandoId && (
                <div className="cmv-section">
                  <div className="cmv-titulo">Custo da Mercadoria Vendida (CMV)</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Valor CMV (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.cmvValor} onChange={e => setField('cmvValor', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Tipo de Custo</label>
                      <select value={form.cmvCat} onChange={e => setField('cmvCat', e.target.value)}>
                        <option value="">— selecione —</option>
                        {Object.keys(cmvCats).map(c => <option key={c}>{c}</option>)}
                      </select>
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
                {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar'}
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
