import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo, sairCliente } = useApp();
  const navigate = useNavigate();
  const { tema, toggleTema } = useTheme();
  const [sidebarAberta, setSidebarAberta] = useState(false);

  const papel = localStorage.getItem('cb_papel');
  const isAdmin = papel === 'admin';

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
          <span className="topbar-usuario">{usuario?.nome}</span>
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
        <NavLink to="/exportar" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📥</span> Exportar
        </NavLink>
        <NavLink to="/upgrade" onClick={fecharSidebar} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📱</span> Controle de Upgrade
        </NavLink>

        {isAdmin && (
          <>
            <span className="nav-section">Cliente</span>
            <button className="nav-btn" onClick={handleVoltarClientes}>
              <span className="nav-icon">🔀</span> Trocar Cliente
            </button>
          </>
        )}
      </nav>

      <main className="main">
        {children}
      </main>
    </div>
  );
}