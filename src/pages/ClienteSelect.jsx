import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../services/api';
import { useApp } from '../context/AppContext';
import './ClienteSelect.css';

const CORES = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function initials(nome) {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const formClienteVazio = () => ({ nome: '', obs: '', cor: CORES[0] });
const formUsuarioVazio = () => ({ nome: '', email: '', senha: '', papel: 'cliente' });

export default function ClienteSelect({ onLogout }) {
  const [clientes, setClientes]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [erro, setErro]                 = useState('');
  const [entrando, setEntrando]         = useState(null);
  const [expandido, setExpandido]       = useState(null); // id do cliente expandido
  const [usuarios, setUsuarios]         = useState({});   // { [clienteId]: [...] }
  const [loadingU, setLoadingU]         = useState({});

  // Modal cliente
  const [modalCliente, setModalCliente] = useState(false);
  const [formCliente, setFormCliente]   = useState(formClienteVazio());
  const [erroCliente, setErroCliente]   = useState('');
  const [salvandoC, setSalvandoC]       = useState(false);

  // Modal usuário
  const [modalUsuario, setModalUsuario] = useState(null); // clienteId
  const [formUsuario, setFormUsuario]   = useState(formUsuarioVazio());
  const [erroUsuario, setErroUsuario]   = useState('');
  const [salvandoU, setSalvandoU]       = useState(false);

  // Confirmações
  const [confirmCliente, setConfirmCliente] = useState(null);
  const [confirmUsuario, setConfirmUsuario] = useState(null);

  // Redefinir senha
  const [redefinindo, setRedefinindo]       = useState(null); // userId
  const [novaSenha, setNovaSenha]           = useState('');
  const [senhaErro, setSenhaErro]           = useState('');
  const [senhaSalvando, setSenhaSalvando]   = useState(false);

  const { entrarCliente } = useApp();
  const navigate          = useNavigate();

  useEffect(() => { carregarClientes(); }, []);

  async function carregarClientes() {
    setLoading(true);
    try {
      const data = await API.listarClientes();
      setClientes(data);
    } catch {
      setErro('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }

  async function carregarUsuarios(clienteId) {
    setLoadingU(p => ({ ...p, [clienteId]: true }));
    try {
      const data = await API.listarUsuarios();
      const filtrados = data.filter(u => u.clienteId === clienteId || u.cliente_id === clienteId);
      setUsuarios(p => ({ ...p, [clienteId]: filtrados }));
    } catch {
      setUsuarios(p => ({ ...p, [clienteId]: [] }));
    } finally {
      setLoadingU(p => ({ ...p, [clienteId]: false }));
    }
  }

  function toggleExpandido(id) {
    if (expandido === id) {
      setExpandido(null);
    } else {
      setExpandido(id);
      if (!usuarios[id]) carregarUsuarios(id);
    }
  }

  async function handleEntrar(cliente) {
    setEntrando(cliente.id);
    try {
      await entrarCliente(cliente);
      navigate('/dashboard');
    } catch {
      setErro('Erro ao carregar dados do cliente');
      setEntrando(null);
    }
  }

  async function handleCriarCliente(e) {
    e.preventDefault();
    if (!formCliente.nome) { setErroCliente('Informe o nome'); return; }
    setSalvandoC(true); setErroCliente('');
    try {
      await API.criarCliente(formCliente);
      setModalCliente(false);
      setFormCliente(formClienteVazio());
      await carregarClientes();
    } catch (err) {
      setErroCliente(err.message);
    } finally {
      setSalvandoC(false);
    }
  }

  async function handleExcluirCliente(id) {
    try {
      await API.excluirCliente(id);
      setConfirmCliente(null);
      await carregarClientes();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function handleCriarUsuario(e) {
    e.preventDefault();
    if (!formUsuario.nome) { setErroUsuario('Informe o nome'); return; }
    if (!formUsuario.email) { setErroUsuario('Informe o email'); return; }
    if (!formUsuario.senha) { setErroUsuario('Informe a senha'); return; }
    setSalvandoU(true); setErroUsuario('');
    try {
      await API.criarUsuario({ ...formUsuario, clienteId: modalUsuario });
      setModalUsuario(null);
      setFormUsuario(formUsuarioVazio());
      await carregarUsuarios(modalUsuario);
    } catch (err) {
      setErroUsuario(err.message);
    } finally {
      setSalvandoU(false);
    }
  }

  async function handleExcluirUsuario(id, clienteId) {
    try {
      await API.excluirUsuario(id);
      setConfirmUsuario(null);
      await carregarUsuarios(clienteId);
    } catch (err) {
      setErro(err.message);
    }
  }

  async function handleRedefinirSenha() {
    if (!novaSenha || novaSenha.length < 6) { setSenhaErro('Senha deve ter no mínimo 6 caracteres'); return; }
    setSenhaSalvando(true); setSenhaErro('');
    try {
      await API.redefinirSenha(redefinindo, novaSenha);
      setRedefinindo(null); setNovaSenha('');
    } catch (err) {
      setSenhaErro(err.message);
    } finally {
      setSenhaSalvando(false);
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
    <div className="clientes-screen">
      <div className="clientes-box">
        <div className="clientes-header">
          <img src="/logo.png" alt="SOUZ Finance" className="clientes-logo-img" />
          <p>Gerencie clientes e usuários do sistema</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setModalCliente(true); setErroCliente(''); setFormCliente(formClienteVazio()); }}>
            + Novo Cliente
          </button>
        </div>

        {erro && <div className="clientes-erro">{erro}</div>}
        {loading && <div className="clientes-loading">Carregando...</div>}

        {!loading && (
          <div className="clientes-lista">
            {clientes.length === 0 ? (
              <div className="clientes-empty">
                <div className="icon">👤</div>
                <div>Nenhum cliente cadastrado ainda.</div>
              </div>
            ) : (
              clientes.map(c => (
                <div key={c.id} className="cliente-card-wrapper">
                  {/* Card do cliente */}
                  <div className={`cliente-card ${entrando === c.id ? 'loading' : ''}`} style={{ cursor: 'default' }}>
                    <div className="cliente-avatar" style={{ background: `${c.cor}22`, color: c.cor }}>
                      {initials(c.nome)}
                    </div>
                    <div className="cliente-info">
                      <div className="nome">{c.nome}</div>
                      <div className="meta">{c.obs || 'Sem observação'}</div>
                    </div>
                    <div className="cliente-acoes">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => !entrando && handleEntrar(c)}
                        disabled={!!entrando}
                      >
                        {entrando === c.id ? '...' : 'Acessar'}
                      </button>
                      <button
                        className={`btn btn-ghost btn-sm ${expandido === c.id ? 'active' : ''}`}
                        onClick={() => toggleExpandido(c.id)}
                      >
                        👥 Usuários
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-excluir"
                        onClick={() => setConfirmCliente(c.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  {/* Painel de usuários expandido */}
                  {expandido === c.id && (
                    <div className="usuarios-painel">
                      <div className="usuarios-painel-header">
                        <span>Usuários de {c.nome}</span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => { setModalUsuario(c.id); setErroUsuario(''); setFormUsuario(formUsuarioVazio()); }}
                        >
                          + Novo Usuário
                        </button>
                      </div>
                      {loadingU[c.id] && <div className="usuarios-loading">Carregando...</div>}
                      {!loadingU[c.id] && (
                        <>
                          {(usuarios[c.id] || []).length === 0 ? (
                            <div className="usuarios-empty-inline">Nenhum usuário cadastrado.</div>
                          ) : (
                            (usuarios[c.id] || []).map(u => (
                              <div key={u.id} className="usuario-row">
                                <div className="usuario-avatar-sm">{u.nome?.[0]?.toUpperCase() || '?'}</div>
                                <div className="usuario-info">
                                  <span className="nome">{u.nome}</span>
                                  <span className="meta">{u.email}</span>
                                </div>
                                <span className={`papel-badge papel-${u.papel}`}>{u.papel}</span>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => { setRedefinindo(u.id); setNovaSenha(''); setSenhaErro(''); }}
                                >
                                  Redefinir Senha
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm btn-excluir"
                                  onClick={() => setConfirmUsuario({ id: u.id, clienteId: c.id })}
                                >
                                  Excluir
                                </button>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <button className="btn-sair" onClick={handleLogout}>Sair</button>
      </div>

      {/* Modal novo cliente */}
      {modalCliente && (
        <div className="modal-overlay" onClick={() => setModalCliente(false)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Cliente</h3>
              <button className="modal-close" onClick={() => setModalCliente(false)}>✕</button>
            </div>
            <form onSubmit={handleCriarCliente}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="field">
                    <label>Nome</label>
                    <input type="text" placeholder="Nome do cliente" value={formCliente.nome} onChange={e => setFormCliente(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Observação</label>
                    <input type="text" placeholder="Opcional" value={formCliente.obs} onChange={e => setFormCliente(f => ({ ...f, obs: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Cor</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {CORES.map(cor => (
                        <div
                          key={cor}
                          onClick={() => setFormCliente(f => ({ ...f, cor }))}
                          style={{
                            width: 28, height: 28, borderRadius: 8, background: cor, cursor: 'pointer',
                            border: formCliente.cor === cor ? '2px solid #fff' : '2px solid transparent',
                            transition: 'border .15s'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {erroCliente && <div className="form-erro">{erroCliente}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCliente(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoC}>{salvandoC ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal novo usuário */}
      {modalUsuario && (
        <div className="modal-overlay" onClick={() => setModalUsuario(null)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Usuário</h3>
              <button className="modal-close" onClick={() => setModalUsuario(null)}>✕</button>
            </div>
            <form onSubmit={handleCriarUsuario}>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="field">
                    <label>Nome</label>
                    <input type="text" placeholder="Nome completo" value={formUsuario.nome} onChange={e => setFormUsuario(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" placeholder="email@exemplo.com" value={formUsuario.email} onChange={e => setFormUsuario(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Senha</label>
                    <input type="password" placeholder="••••••••" value={formUsuario.senha} onChange={e => setFormUsuario(f => ({ ...f, senha: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Papel</label>
                    <select value={formUsuario.papel} onChange={e => setFormUsuario(f => ({ ...f, papel: e.target.value }))}>
                      <option value="cliente">cliente</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                </div>
                {erroUsuario && <div className="form-erro">{erroUsuario}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalUsuario(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoU}>{salvandoU ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar excluir cliente */}
      {confirmCliente && (
        <div className="modal-overlay" onClick={() => setConfirmCliente(null)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir Cliente</h3>
              <button className="modal-close" onClick={() => setConfirmCliente(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Tem certeza? Todos os dados deste cliente serão perdidos.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmCliente(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => handleExcluirCliente(confirmCliente)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal redefinir senha */}
      {redefinindo && (
        <div className="modal-overlay" onClick={() => setRedefinindo(null)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Redefinir Senha</h3>
              <button className="modal-close" onClick={() => setRedefinindo(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Nova Senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleRedefinirSenha()}
                />
              </div>
              {senhaErro && <div className="form-erro">{senhaErro}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRedefinindo(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRedefinirSenha} disabled={senhaSalvando}>
                {senhaSalvando ? 'Salvando...' : 'Redefinir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar excluir usuário */}
      {confirmUsuario && (
        <div className="modal-overlay" onClick={() => setConfirmUsuario(null)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir Usuário</h3>
              <button className="modal-close" onClick={() => setConfirmUsuario(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Tem certeza que deseja excluir este usuário?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmUsuario(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => handleExcluirUsuario(confirmUsuario.id, confirmUsuario.clienteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
