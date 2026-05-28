import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo, sairCliente } = useApp();
  const navigate = useNavigate();

  const papel = localStorage.getItem('cb_papel');
  const isAdmin = papel === 'admin';

  function handleVoltarClientes() {
    sairCliente();
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
          <div className="brand-logo brand-logo--sm">
            <span className="brand-souz">SOUZ</span>
            <span className="brand-divider">|</span>
            <span className="brand-finance">FINANCE</span>
          </div>
        </div>

        <div className="topbar-right">
          {clienteAtivo && (
            <div className="cliente-chip">{clienteAtivo.nome}</div>
          )}
          <span className="topbar-usuario">{usuario?.nome}</span>
          <button onClick={handleLogout} className="btn-topbar">Sair</button>
        </div>
      </header>

      <nav className="sidebar">
        <span className="nav-section">Menu</span>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📊</span> Início
        </NavLink>
        <NavLink to="/lancamentos" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📋</span> Lançamentos
        </NavLink>
        <NavLink to="/relatorio" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📈</span> Relatório
        </NavLink>
        <NavLink to="/contas" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">🔄</span> Gestão de Contas
        </NavLink>
        <NavLink to="/financeiro" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">💹</span> Financeiro
        </NavLink>
        <NavLink to="/exportar" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📥</span> Exportar
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
