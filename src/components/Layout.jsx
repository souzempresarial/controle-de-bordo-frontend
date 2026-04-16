import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Layout.css';

export default function Layout({ children, usuario, onLogout }) {
  const { clienteAtivo, lancamentos, sairCliente } = useApp();
  const navigate = useNavigate();

  const papel = localStorage.getItem('cb_papel');
  const isAdmin = papel === 'admin';

  // Totais do topbar
  const CMVCATS = ['Custos Variáveis Diretos'];
  let entradas = 0, saidas = 0;
  lancamentos
    .filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'))
    .forEach(l => {
      if (l.tipo === 'Entrada') entradas += l.valorRecebido ?? l.valor;
      else if (l.tipo === 'Saída') saidas += l.valor;
    });
  const saldo = entradas - saidas;

  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
          <span className="app-name">Controle de Bordo</span>
        </div>

        <div className="topbar-divider" />

        <div className="topbar-center">
          <div className="saldo-item">
            <div className="label">Entradas</div>
            <div className="valor entrada">{fmt(entradas)}</div>
          </div>
          <div className="topbar-divider" />
          <div className="saldo-item">
            <div className="label">Saídas</div>
            <div className="valor saida">{fmt(saidas)}</div>
          </div>
          <div className="topbar-divider" />
          <div className="saldo-item">
            <div className="label">Saldo</div>
            <div className={`valor ${saldo >= 0 ? 'entrada' : 'saida'}`}>{fmt(saldo)}</div>
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
