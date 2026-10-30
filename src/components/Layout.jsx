import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { API } from '../services/api';
import PasswordInput from './PasswordInput';
import ChatWidget from './ChatWidget';
import Icone from './Icone';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo, erroEntrar, loading: carregandoCliente, recarregarCliente } = useApp();
  const navigate = useNavigate();
  const { tema, toggleTema } = useTheme();
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [recolhida, setRecolhida] = useState(() => {
    try { return localStorage.getItem('sf_sidebar_recolhida') === '1'; } catch { return false; }
  });
  function alternarRecolhida() {
    setRecolhida(r => {
      try { localStorage.setItem('sf_sidebar_recolhida', r ? '0' : '1'); } catch { /* só não lembra */ }
      return !r;
    });
  }
  const [perfilAberto, setPerfilAberto]   = useState(false);
  const [perfilForm, setPerfilForm]       = useState({ nome: '', email: '', telefone: '', senhaAtual: '', novaSenha: '' });
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
      setPerfilForm({ nome: info.nome || '', email: info.email || '', telefone: info.telefone || '', senhaAtual: '', novaSenha: '' });
    } catch (err) {
      console.error('[abrirPerfil]', err.message);
      setPerfilErro('Não foi possível carregar seus dados. Tente novamente.');
      setPerfilForm({ nome: usuario?.nome || '', email: '', telefone: '', senhaAtual: '', novaSenha: '' });
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
        telefone:  perfilForm.telefone  || null,
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
    <div className={`app${recolhida ? ' app--sidebar-recolhida' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button className="hamburger" onClick={() => setSidebarAberta(true)} aria-label="Abrir menu">
            <span /><span /><span />
          </button>
          <img src="/logo-horizontal.png" alt="SOUZ Finance" className="topbar-logo" />
        </div>

        <div className="topbar-right">
          {clienteAtivo && (
            <div className="cliente-chip" title={clienteAtivo.obs?.trim() ? `${clienteAtivo.obs.trim()} · ${clienteAtivo.nome}` : clienteAtivo.nome}>
              {clienteAtivo.obs?.trim() || clienteAtivo.nome}
            </div>
          )}
          <button onClick={handleLogout} className="btn-topbar btn-topbar-sair">Sair</button>
        </div>
      </header>

      {sidebarAberta && <div className="sidebar-overlay" onClick={fecharSidebar} />}

      <nav className={`sidebar${sidebarAberta ? ' sidebar--aberta' : ''}`}>
        <button className="sidebar-fechar" onClick={fecharSidebar}>✕</button>
        {podeVer('dashboard') && <NavLink to="/dashboard" title="Visão Geral" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Visão Geral
        </NavLink>}
        {podeVer('chat') && <NavLink to="/chat" title="SOUZ AI" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          SOUZ AI
        </NavLink>}
        {podeVer('lancamentos') && <NavLink to="/lancamentos" title="Conciliações Bancárias" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Conciliações Bancárias
        </NavLink>}
        {podeVer('relatorio') && <NavLink to="/relatorio" title="Resumo Executivo" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Resumo Executivo
        </NavLink>}
        {podeVer('contas') && <NavLink to="/contas" title="Gestão de Contas" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Gestão de Contas
        </NavLink>}
        {podeVer('financeiro') && <NavLink to="/financeiro" title="Financeiro" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>
          Financeiro
        </NavLink>}
        {podeVer('upgrade') && <NavLink to="/upgrade" title="Controle de Upgrade" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          Controle de Upgrade
        </NavLink>}
        {podeVer('exportar') && <NavLink to="/exportar" title="Exportar" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar
        </NavLink>}
        {podeVer('integracoes') && <NavLink to="/integracoes" title="Integrações" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="6" height="10" rx="1"/><rect x="16" y="7" width="6" height="10" rx="1"/><path d="M8 12h8"/><path d="M11 9l-3 3 3 3"/><path d="M13 9l3 3-3 3"/></svg>
          Integrações
        </NavLink>}

        {isAdmin && (
          <NavLink to="/ranking" title="Ranking" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
            Ranking
          </NavLink>
        )}

        <div className="sidebar-rodape">
          <button type="button" className="sidebar-usuario" onClick={() => { fecharSidebar(); abrirPerfil(); }} title="Meu perfil">
            <span className="sidebar-avatar" aria-hidden="true">{(usuario?.nome || '?').trim()[0].toUpperCase()}</span>
            <span className="sidebar-usuario-nome">{usuario?.nome}</span>
          </button>
          <div className="sidebar-acoes">
            <button type="button" className="sidebar-acao" onClick={toggleTema} aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}>
              <Icone nome={tema === 'dark' ? 'sol' : 'lua'} tamanho={16} />
            </button>
            <button type="button" className="sidebar-acao sidebar-recolher" onClick={alternarRecolhida} aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'} title={recolhida ? 'Expandir menu' : 'Recolher menu'}>
              <Icone nome="layout" tamanho={16} />
            </button>
          </div>
          <button type="button" className="nav-btn sidebar-sair" onClick={handleLogout}>
            <Icone nome="sair" tamanho={16} /> Sair
          </button>
        </div>
      </nav>

      <main className="main">
        {erroEntrar && !carregandoCliente && (
          <div className="aviso-carregamento" role="alert">
            <span>{erroEntrar}</span>
            <button type="button" className="btn btn-sm" onClick={recarregarCliente}>Tentar de novo</button>
          </div>
        )}
        {children}
      </main>

      <ChatWidget />

      {/* Modal Perfil */}
      {perfilAberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPerfilAberto(false)}>
          <form className="modal-box modal-small" onSubmit={salvarPerfil}>
            <div className="modal-header">
              <h3>Meu Perfil</h3>
              <button type="button" className="modal-close" onClick={() => setPerfilAberto(false)} aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Nome</label>
                <input type="text" value={perfilForm.nome} onChange={e => setPerfilForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={perfilForm.email} onChange={e => setPerfilForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>WhatsApp <span style={{ opacity: .75 }}>(com DDD, ex: 11999990000)</span></label>
                <input type="tel" placeholder="11999990000" value={perfilForm.telefone} onChange={e => setPerfilForm(f => ({ ...f, telefone: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div className="field">
                <label>Senha atual <span style={{ opacity: .75 }}>(obrigatório para alterar e-mail ou senha)</span></label>
                <PasswordInput placeholder="••••••••" value={perfilForm.senhaAtual} onChange={e => setPerfilForm(f => ({ ...f, senhaAtual: e.target.value }))} />
              </div>
              <div className="field">
                <label>Nova senha <span style={{ opacity: .75 }}>(deixe vazio para não alterar)</span></label>
                <PasswordInput placeholder="Mínimo 6 caracteres" value={perfilForm.novaSenha} onChange={e => setPerfilForm(f => ({ ...f, novaSenha: e.target.value }))} />
              </div>
              {perfilErro && <div className="form-erro">{perfilErro}</div>}
              {perfilMsg  && <div style={{ color: 'var(--entrada)', fontSize: 13, textAlign: 'center' }}>{perfilMsg}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setPerfilAberto(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={perfilSalvando}>{perfilSalvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}