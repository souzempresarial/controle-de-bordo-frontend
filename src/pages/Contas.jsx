import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { getCatsPorTipo, getSubcats } from '../services/constants';
import { fmt, fmtData, hoje } from '../services/utils';
import './Contas.css';

function vencInfo(venc) {
  if (!venc) return { label: '—', cor: 'var(--text2)', extra: '' };
  const now  = new Date(); now.setHours(0,0,0,0);
  const d    = new Date(venc + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  const label = fmtData(venc);
  if (diff < 0)   return { label, cor: 'var(--saida)',  extra: ' (vencida)' };
  if (diff === 0) return { label, cor: 'var(--warn)',   extra: ' (hoje)' };
  if (diff <= 3)  return { label, cor: 'var(--warn)',   extra: ` (${diff}d)` };
  return { label, cor: 'var(--text)', extra: '' };
}

const formVazio = (tipo = 'receber') => ({
  tipo, descricao: '', valor: '', vencimento: '', categoria: '',
  subcategoria: '', recorrente: false, periodicidade: 'mensal',
});

export default function Contas() {
  const { contas, setContas, lancamentos, setLancamentos, clienteAtivo } = useApp();

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId]   = useState(null);
  const [form, setForm]               = useState(formVazio());
  const [salvando, setSalvando]       = useState(false);
  const [erroForm, setErroForm]       = useState('');
  const [confirmando, setConfirmando] = useState(null);
  const [quitando, setQuitando]       = useState(null);
  const [toast, setToast]             = useState(null);

  function showToast(msg, tipo = 'ok') {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  const pendR = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente');
  const pendP = contas.filter(c => c.tipo === 'pagar'   && c.status === 'pendente');
  const totR  = pendR.reduce((a, c) => a + c.valor, 0);
  const totP  = pendP.reduce((a, c) => a + c.valor, 0);

  const cats    = getCatsPorTipo(form.tipo === 'receber' ? 'Entrada' : 'Saída');
  const subcats = getSubcats(form.categoria);

  function setField(campo, valor) {
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      if (campo === 'tipo') { novo.categoria = ''; novo.subcategoria = ''; }
      if (campo === 'categoria') { novo.subcategoria = ''; }
      return novo;
    });
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio('receber'));
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(c) {
    setEditandoId(c.id);
    setForm({
      tipo: c.tipo, descricao: c.descricao || '', valor: c.valor,
      vencimento: c.vencimento || '', categoria: c.categoria || '',
      subcategoria: c.subcategoria || '',
      recorrente: !!c.recorrente, periodicidade: c.periodicidade || 'mensal',
    });
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() { setModalAberto(false); setEditandoId(null); }

  async function salvar() {
    if (!form.descricao.trim()) { setErroForm('Informe a descrição'); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { setErroForm('Informe um valor válido'); return; }
    if (!form.vencimento) { setErroForm('Informe o vencimento'); return; }
    if (!form.categoria) { setErroForm('Selecione a categoria'); return; }

    const dados = {
      tipo: form.tipo, descricao: form.descricao.trim(), valor: parseFloat(form.valor),
      vencimento: form.vencimento, categoria: form.categoria, subcategoria: form.subcategoria,
      recorrente: form.tipo === 'pagar' ? form.recorrente : false,
      periodicidade: form.recorrente ? form.periodicidade : null,
    };

    setSalvando(true); setErroForm('');
    try {
      if (editandoId) {
        const atualizada = await API.editarConta(clienteAtivo.id, editandoId, dados);
        setContas(prev => prev.map(c => c.id === editandoId ? atualizada : c));
        showToast('Conta atualizada');
      } else {
        const nova = await API.criarConta(clienteAtivo.id, dados);
        setContas(prev => [...prev, nova]);
        showToast('Conta criada');
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
      await API.excluirConta(clienteAtivo.id, id);
      setContas(prev => prev.filter(c => c.id !== id));
      showToast('Conta excluída');
    } catch (err) {
      showToast('Erro ao excluir', 'erro');
    }
    setConfirmando(null);
  }

  async function quitar(c) {
    setQuitando(c.id);
    const tipoLanc = c.tipo === 'receber' ? 'Entrada' : 'Saída';
    try {
      await API.editarConta(clienteAtivo.id, c.id, { ...c, status: 'quitado' });
      setContas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'quitado' } : x));

      const novoLanc = await API.criarLancamento(clienteAtivo.id, {
        tipo: tipoLanc, descricao: c.descricao, valor: c.valor,
        data: hoje(), categoria: c.categoria || (tipoLanc === 'Saída' ? 'Despesas Variáveis' : 'Outras Receitas'),
        subcategoria: c.subcategoria || '', status: 'Confirmado',
      });
      setLancamentos(prev => [novoLanc, ...prev]);

      if (c.recorrente && c.periodicidade && c.vencimento) {
        const d = new Date(c.vencimento + 'T00:00:00');
        if (c.periodicidade === 'mensal')  d.setMonth(d.getMonth() + 1);
        else if (c.periodicidade === 'semanal') d.setDate(d.getDate() + 7);
        else if (c.periodicidade === 'anual')   d.setFullYear(d.getFullYear() + 1);
        const novaConta = await API.criarConta(clienteAtivo.id, {
          tipo: c.tipo, descricao: c.descricao, valor: c.valor,
          vencimento: d.toISOString().split('T')[0],
          categoria: c.categoria, subcategoria: c.subcategoria || '',
          recorrente: true, periodicidade: c.periodicidade,
        });
        setContas(prev => [...prev, novaConta]);
        showToast('Conta quitada — lançamento criado e próxima gerada');
      } else {
        showToast('Conta quitada — lançamento criado');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao quitar conta', 'erro');
    }
    setQuitando(null);
  }

  const TabelaContas = ({ lista, cor, tipoLabel }) => (
    lista.length === 0
      ? <div className="empty-state"><div className="icon">✅</div><div>Nenhuma conta a {tipoLabel} pendente</div></div>
      : <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Vencimento</th><th>Descrição</th><th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Valor</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const vi = vencInfo(c.vencimento);
                return (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: 'nowrap', color: vi.cor, fontWeight: vi.extra ? 700 : 400 }}>
                      {vi.label}{vi.extra}
                    </td>
                    <td>
                      {c.descricao || '—'}
                      {c.recorrente && (
                        <span className="recorrente-badge">{c.periodicidade}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text2)' }}>{c.categoria || '—'}</td>
                    <td style={{ textAlign: 'right', color: cor, fontWeight: 700 }}>{fmt(c.valor)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => quitar(c)}
                          disabled={quitando === c.id}
                        >
                          {quitando === c.id ? '...' : 'Quitar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmando(c)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
  );

  return (
    <div className="contas-page">
      {/* Resumo */}
      <div className="cards">
        <div className="card">
          <div className="card-label">A Receber</div>
          <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(totR)}</div>
          <div className="card-sub">{pendR.length} pendente{pendR.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card">
          <div className="card-label">A Pagar</div>
          <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(totP)}</div>
          <div className="card-sub">{pendP.length} pendente{pendP.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card">
          <div className="card-label">Saldo Previsto</div>
          <div className="card-value" style={{ color: (totR - totP) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(totR - totP)}</div>
          <div className="card-sub">A receber − a pagar</div>
        </div>
      </div>

      {/* Botão */}
      <div>
        <button className="btn btn-primary" onClick={abrirNovo}>＋ Nova Conta</button>
      </div>

      {/* Contas a Receber */}
      <div className="table-panel">
        <div className="table-header">
          <h2 style={{ color: 'var(--entrada)' }}>Contas a Receber</h2>
          {pendR.length > 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{pendR.length} pendente{pendR.length !== 1 ? 's' : ''} · Total: {fmt(totR)}</span>}
        </div>
        <TabelaContas lista={pendR} cor="var(--entrada)" tipoLabel="receber" />
      </div>

      {/* Contas a Pagar */}
      <div className="table-panel">
        <div className="table-header">
          <h2 style={{ color: 'var(--saida)' }}>Contas a Pagar</h2>
          {pendP.length > 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{pendP.length} pendente{pendP.length !== 1 ? 's' : ''} · Total: {fmt(totP)}</span>}
        </div>
        <TabelaContas lista={pendP} cor="var(--saida)" tipoLabel="pagar" />
      </div>

      {/* Modal Nova / Editar Conta */}
      {modalAberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editandoId ? 'Editar Conta' : `Nova Conta a ${form.tipo === 'receber' ? 'Receber' : 'Pagar'}`}</h3>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="modal-body">
              {!editandoId && (
                <div className="tipo-toggle">
                  <button className={`btn ${form.tipo === 'receber' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setField('tipo', 'receber')}>A Receber</button>
                  <button className={`btn ${form.tipo === 'pagar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setField('tipo', 'pagar')}>A Pagar</button>
                </div>
              )}
              <div className="form-grid">
                <div className="field span2">
                  <label>Descrição</label>
                  <input type="text" placeholder="Descrição da conta" value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Valor (R$)</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setField('valor', e.target.value)} />
                </div>
                <div className="field">
                  <label>Vencimento</label>
                  <input type="date" value={form.vencimento} onChange={e => setField('vencimento', e.target.value)} />
                </div>
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
                {form.tipo === 'pagar' && (
                  <>
                    <div className="field span2" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" id="recorrente" checked={form.recorrente} onChange={e => setField('recorrente', e.target.checked)} />
                      <label htmlFor="recorrente" style={{ textTransform: 'none', fontSize: 13, cursor: 'pointer' }}>Conta recorrente</label>
                    </div>
                    {form.recorrente && (
                      <div className="field">
                        <label>Periodicidade</label>
                        <select value={form.periodicidade} onChange={e => setField('periodicidade', e.target.value)}>
                          <option value="semanal">Semanal</option>
                          <option value="mensal">Mensal</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
              {erroForm && <div className="form-erro">{erroForm}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Exclusão */}
      {confirmando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmando(null)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Excluir Conta</h3>
              <button className="modal-close" onClick={() => setConfirmando(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                Excluir <strong style={{ color: 'var(--text)' }}>{confirmando.descricao}</strong> ({fmt(confirmando.valor)})?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmando.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.msg}</div>
      )}
    </div>
  );
}
