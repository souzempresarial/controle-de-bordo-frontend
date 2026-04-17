import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../services/api';
import './Usuarios.css';

const PAPEIS = ['admin', 'cliente'];

const formVazio = () => ({ nome: '', email: '', senha: '', papel: 'cliente', clienteId: '' });

export default function Usuarios({ onLogout }) {
  const [usuarios, setUsuarios]   = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState('');
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(formVazio());
  const [formErro, setFormErro]   = useState('');
  const [salvando, setSalvando]   = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const navigate                  = useNavigate();

  useEffect(() => {
    carregar();
    API.listarClientes().then(setClientes).catch(() => {});
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await API.listarUsuarios();
      setUsuarios(data);
    } catch {
      setErro('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  async function handleCriar(e) {
    e.preventDefault();
    if (!form.nome) { setFormErro('Informe o nome'); return; }
    if (!form.email) { setFormErro('Informe o email'); return; }
    if (!form.senha) { setFormErro('Informe a senha'); return; }
    if (!form.clienteId) { setFormErro('Selecione um cliente'); return; }
    setSalvando(true);
    setFormErro('');
    try {
      await API.criarUsuario(form);
      setModal(false);
      setForm(formVazio());
      await carregar();
    } catch (err) {
      setFormErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    try {
      await API.excluirUsuario(id);
      setConfirmId(null);
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem('cb_token');
    localStorage.removeItem('cb_papel');
    localStorage.removeItem('cb_nome');
    localStorage.removeItem('cb_cliente_id');
    onLogout();
    navigate('/login');
  }

  return (
    <div className="usuarios-screen">
      <div className="usuarios-box">
        <div className="usuarios-header">
          <div className="usuarios-logo">👥</div>
          <h1>Gerenciar Usuários</h1>
          <p>Crie e gerencie os acessos ao sistema</p>
        </div>

        <div className="usuarios-acoes">
          <button className="btn btn-primary" onClick={() => { setModal(true); setFormErro(''); setForm(formVazio()); }}>
            + Novo Usuário
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/clientes')}>
            ← Voltar
          </button>
        </div>

        {erro && <div className="usuarios-erro">{erro}</div>}
        {loading && <div className="usuarios-loading">Carregando...</div>}

        {!loading && (
          <div className="usuarios-lista">
            {usuarios.length === 0 ? (
              <div className="usuarios-empty">
                <div className="icon">👤</div>
                <div>Nenhum usuário cadastrado.</div>
              </div>
            ) : (
              usuarios.map(u => (
                <div key={u.id} className="usuario-card">
                  <div className="usuario-avatar">{u.nome?.[0]?.toUpperCase() || '?'}</div>
                  <div className="usuario-info">
                    <div className="nome">{u.nome}</div>
                    <div className="meta">{u.email}</div>
                  </div>
                  <span className={`papel-badge papel-${u.papel}`}>{u.papel}</span>
                  <button
                    className="btn btn-ghost btn-sm btn-excluir"
                    onClick={() => setConfirmId(u.id)}
                  >
                    Excluir
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <button className="btn-sair" onClick={handleLogout}>Sair</button>
      </div>

      {/* Modal criar usuário */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Usuário</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCriar}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="field">
                    <label>Nome</label>
                    <input
                      type="text"
                      placeholder="Nome completo"
                      value={form.nome}
                      onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Senha</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={form.senha}
                      onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Papel</label>
                    <select value={form.papel} onChange={e => setForm(f => ({ ...f, papel: e.target.value }))}>
                      {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Cliente vinculado</label>
                    <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}>
                      <option value="">— selecione —</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>
                {formErro && <div className="form-erro">{formErro}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação excluir */}
      {confirmId && (
        <div className="modal-overlay" onClick={() => setConfirmId(null)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir Usuário</h3>
              <button className="modal-close" onClick={() => setConfirmId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleExcluir(confirmId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
