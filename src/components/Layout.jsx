import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { API } from '../services/api';
import PasswordInput from './PasswordInput';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo } = useApp();
  const navigate = useNavigate();
  const { tema, toggleTema } = useTheme();
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [perfilAberto, setPerfilAberto]   = useState(false);
  const [perfilForm, setPerfilForm]       = useState({ nome: '', email: '', senhaAtual: '', novaSenha: '' });
  const [perfilMsg, setPerfilMsg]         = useState('');
  const [perfilErro, setPerfilErro]       = useState('');
  const [perfilSalvando, setPerfilSalvando] = useState(false);

  const papel = sessionStorage.getItem('sf_papel');
  const isAdmin = papel === 'admin';
  const isFuncionario = papel === 'funcionario';
  const permissoesRaw = sessionStorage.getItem('sf_permissoes');
  const permissoes = (() => { try { return permissoesRaw ? JSON.parse(permissoesRaw) : null; } catch { return null; } })();
  const podeVer = (slug) => !isFuncionario || (Array.isArray(permissoes) && permissoes.includes(slug));

  async function abrirPerfil() {
    setPerfilMsg(''); setPerfilErro('');
    try {
      const info = await API.minhaInfo();
      setPerfilForm({ nome: info.nome || '', email: info.email || '', senhaAtual: '', novaSenha: '' });
    } catch (err) {
      console.error('[abrirPerfil]', err.message);
      setPerfilErro('Não foi possível carregar seus dados. Tente novamente.');
      setPerfilForm({ nome: usuario?.nome || '', email: '', senhaAtual: '', novaSenha: '' });
    }
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
      if (perfilForm.nome) sessionStorage.setItem('sf_nome', perfilForm.nome);
      setPerfilMsg('Perfil atualizado com sucesso!');
      setPerfilForm(f => ({ ...f, senhaAtual: '', novaSenha: '' }));
    } catch (err) {
      setPerfilErro(err.message);
    } finally {
      setPerfilSalvando(false);
    }
  }

  function fecharSidebar() { setSidebarAberta(false); }

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
          <button onClick={abrirPerfil} className="btn-topbar" title="Meu perfil" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="btn-topbar-nome">{usuario?.nome}</span>
          </button>
          <button onClick={toggleTema} className="btn-topbar btn-tema" title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
            {tema === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button onClick={handleLogout} className="btn-topbar btn-topbar-sair">Sair</button>
        </div>
      </header>

      {sidebarAberta && <div className="sidebar-overlay" onClick={fecharSidebar} />}

      <nav className={`sidebar${sidebarAberta ? ' sidebar--aberta' : ''}`}>
        <button className="sidebar-fechar" onClick={fecharSidebar}>✕</button>
        <span className="nav-section">Menu</span>
        {podeVer('dashboard') && <NavLink to="/dashboard" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Início
        </NavLink>}
        {podeVer('lancamentos') && <NavLink to="/lancamentos" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Lançamentos
        </NavLink>}
        {podeVer('relatorio') && <NavLink to="/relatorio" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Resumo Executivo
        </NavLink>}
        {podeVer('contas') && <NavLink to="/contas" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Gestão de Contas
        </NavLink>}
        {podeVer('financeiro') && <NavLink to="/financeiro" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>
          Financeiro
        </NavLink>}
        {podeVer('upgrade') && <NavLink to="/upgrade" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          Controle de Upgrade
        </NavLink>}
        {podeVer('exportar') && <NavLink to="/exportar" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar
        </NavLink>}

        <div className="sidebar-footer">
          <button className="nav-btn" onClick={() => { fecharSidebar(); abrirPerfil(); }}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Meu Perfil
          </button>
          <button className="nav-btn" onClick={handleLogout}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair
          </button>
        </div>

        {isAdmin && (
          <>
            <span className="nav-section">Admin</span>
            <NavLink to="/ranking" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
              Ranking
            </NavLink>
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 20px', width: 400, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
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
                <PasswordInput placeholder="••••••••" value={perfilForm.senhaAtual} onChange={e => setPerfilForm(f => ({ ...f, senhaAtual: e.target.value }))} />
              </div>
              <div className="field">
                <label>Nova senha <span style={{ fontSize: 11, color: 'var(--text2)' }}>(deixe vazio para não alterar)</span></label>
                <PasswordInput placeholder="Mínimo 6 caracteres" value={perfilForm.novaSenha} onChange={e => setPerfilForm(f => ({ ...f, novaSenha: e.target.value }))} />
              </div>
              {perfilErro && <div style={{ color: 'var(--saida)', fontSize: 13 }}>{perfilErro}</div>}
              {perfilMsg  && <div style={{ color: 'var(--entrada)', fontSize: 13 }}>{perfilMsg}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setPerfilAberto(false)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={perfilSalvando}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
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