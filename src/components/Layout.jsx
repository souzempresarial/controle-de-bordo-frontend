import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { API } from '../services/api';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo, sairCliente } = useApp();
  const navigate = useNavigate();
  const { tema, toggleTema } = useTheme();
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [perfilAberto, setPerfilAberto]   = useState(false);
  const [perfilForm, setPerfilForm]       = useState({ nome: '', email: '', senhaAtual: '', novaSenha: '' });
  const [perfilMsg, setPerfilMsg]         = useState('');
  const [perfilErro, setPerfilErro]       = useState('');
  const [perfilSalvando, setPerfilSalvando] = useState(false);

  const papel = sessionStorage.getItem('cb_papel');
  const isAdmin = papel === 'admin';

  async function abrirPerfil() {
    setPerfilMsg(''); setPerfilErro('');
    try {
      const info = await API.minhaInfo();
      setPerfilForm({ nome: info.nome || '', email: info.email || '', senhaAtual: '', novaSenha: '' });
    } catch { setPerfilForm({ nome: usuario?.nome || '', email: '', senhaAtual: '', novaSenha: '' }); }
    setPerfilAberto(true);
  }

  async function salvarPerfil(e) {
    e.preventDefault();
    setPerfilSalvando(true); setPerfilMsg(''); setPerfilErro('');
    try {
      await API.editarPerfil({
        nome:      perfilForm.nome      || undefined,
        email:     perfilForm.email     || undefined,
        senhaAtual: perfilForm.senhaAtual || undefined,
        novaSenha: perfilForm.novaSenha  || undefined,
      });
      if (perfilForm.nome) sessionStorage.setItem('cb_nome', perfilForm.nome);
      setPerfilMsg('Perfil atualizado com sucesso!');
      setPerfilForm(f => ({ ...f, senhaAtual: '', novaSenha: '' }));
    } catch (err) {
      setPerfilErro(err.message);
    } finally {
      setPerfilSalvando(false);
    }
  }

  function fecharSidebar() { setSidebarAberta(false); }

  function handleVoltarClientes() {
    sairCliente();
    fecharSidebar();
    navigate('/clientes');
  }

  function handleLogout() {
    onLogout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button className="hamburger" onClick={() => setSidebarAberta(true)} aria-label="Abrir menu">
            <span /><span /><span />
          </button>
          <img src="/logo-horizontal.png" alt="SOUZ Finance" className="topbar-logo" />
        </div>

        <div className="topbar-right">
          {clienteAtivo && (
            <div className="cliente-chip">{clienteAtivo.nome}</div>
          )}
          <button onClick={abrirPerfil} className="btn-topbar" title="Meu perfil" style={{ fontWeight: 600 }}>
            👤 {usuario?.nome}
          </button>
          <button onClick={toggleTema} className="btn-topbar btn-tema" title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} className="btn-topbar">Sair</button>
        </div>
      </header>

      {sidebarAberta && <div className="sidebar-overlay" onClick={fecharSidebar} />}

      <nav className={`sidebar${sidebarAberta ? ' sidebar--aberta' : ''}`}>
        <button className="sidebar-fechar" onClick={fecharSidebar}>✕</button>
        <span className="nav-section">Menu</span>
        <NavLink to="/dashboard" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📊</span> Início
        </NavLink>
        <NavLink to="/lancamentos" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📋</span> Lançamentos
        </NavLink>
        <NavLink to="/relatorio" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📈</span> Resumo Executivo
        </NavLink>
        <NavLink to="/contas" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🔄</span> Gestão de Contas
        </NavLink>
        <NavLink to="/financeiro" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">💹</span> Financeiro
        </NavLink>
        <NavLink to="/upgrade" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📱</span> Controle de Upgrade
        </NavLink>
        <NavLink to="/exportar" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📥</span> Exportar
        </NavLink>

        {isAdmin && (
          <>
            <span className="nav-section">Admin</span>
            <NavLink to="/ranking" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              <span className="nav-icon">🏆</span> Ranking
            </NavLink>
            <button className="nav-btn" onClick={handleVoltarClientes}>
              <span className="nav-icon">🔀</span> Trocar Cliente
            </button>
          </>
        )}
      </nav>

      <main className="main">
        {children}
      </main>

      {/* Modal Perfil */}
      {perfilAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setPerfilAberto(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 20px', width: 400, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Meu Perfil</h3>
              <button onClick={() => setPerfilAberto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
            </div>
            <form onSubmit={salvarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Nome</label>
                <input type="text" value={perfilForm.nome} onChange={e => setPerfilForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={perfilForm.email} onChange={e => setPerfilForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>Senha atual <span style={{ fontSize: 11, color: 'var(--text2)' }}>(obrigatório para alterar e-mail ou senha)</span></label>
                <input type="password" placeholder="••••••••" value={perfilForm.senhaAtual} onChange={e => setPerfilForm(f => ({ ...f, senhaAtual: e.target.value }))} />
              </div>
              <div className="field">
                <label>Nova senha <span style={{ fontSize: 11, color: 'var(--text2)' }}>(deixe vazio para não alterar)</span></label>
                <input type="password" placeholder="Mínimo 6 caracteres" value={perfilForm.novaSenha} onChange={e => setPerfilForm(f => ({ ...f, novaSenha: e.target.value }))} />
              </div>
              {perfilErro && <div style={{ color: 'var(--saida)', fontSize: 13 }}>{perfilErro}</div>}
              {perfilMsg  && <div style={{ color: 'var(--entrada)', fontSize: 13 }}>{perfilMsg}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setPerfilAberto(false)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={perfilSalvando}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  {perfilSalvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}