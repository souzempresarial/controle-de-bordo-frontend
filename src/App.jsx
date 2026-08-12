import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { API } from './services/api';
import { AppProvider } from './context/AppContext';
import Login from './pages/Login';
import ClienteSelect from './pages/ClienteSelect';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Lancamentos from './pages/Lancamentos';
import Relatorio from './pages/Relatorio';
import Contas from './pages/Contas';
import Financeiro from './pages/Financeiro';
import Exportar from './pages/Exportar';
import VerificarEmail from './pages/VerificarEmail';
import RedefinirSenha from './pages/RedefinirSenha';
import Ranking from './pages/Ranking';
import Upgrade from './pages/Upgrade';

function getUsuarioInicial() {
  const papel = sessionStorage.getItem('sf_papel');
  const nome  = sessionStorage.getItem('sf_nome');
  return papel ? { papel, nome } : null;
}

function getPrimeiraPermissaoFuncionario() {
  try {
    const perms = JSON.parse(sessionStorage.getItem('sf_permissoes') || 'null');
    return Array.isArray(perms) && perms[0] ? `/${perms[0]}` : null;
  } catch {
    return null;
  }
}

function PrivateRoute({ usuario, children }) {
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

function SemAcesso({ onLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', fontFamily: 'system-ui', color: 'var(--text-2, #888)' }}>
      <p>Nenhuma permissão configurada. Contate o administrador.</p>
      <button onClick={onLogout} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border, #ddd)', cursor: 'pointer', background: 'transparent', color: 'inherit' }}>Sair</button>
    </div>
  );
}

function PrivateLayout({ usuario, onLogout, children, slug }) {
  if (!usuario) return <Navigate to="/login" replace />;
  if (slug && usuario.papel === 'funcionario') {
    const raw = (() => { try { return JSON.parse(sessionStorage.getItem('sf_permissoes') || 'null'); } catch { return null; } })();
    const perms = Array.isArray(raw) ? raw : []; // null ou inválido = sem permissões
    if (!perms.includes(slug)) {
      const primeiro = perms[0];
      if (!primeiro) return <SemAcesso onLogout={onLogout} />;
      return <Navigate to={`/${primeiro}`} replace />;
    }
  }
  return <Layout usuario={usuario} onLogout={onLogout}>{children}</Layout>;
}

export default function App() {
  const [usuario, setUsuario] = useState(getUsuarioInicial);

  useEffect(() => {
    const tema = localStorage.getItem('sf_tema') || 'dark';
    document.documentElement.dataset.theme = tema;
  }, []);

  function handleLogin(dados) {
    setUsuario(dados);
  }

  function handleLogout() {
    API.logout().catch(() => {});
    sessionStorage.removeItem('sf_papel');
    sessionStorage.removeItem('sf_nome');
    sessionStorage.removeItem('sf_cliente_id');
    sessionStorage.removeItem('sf_cliente_json');
    sessionStorage.removeItem('sf_permissoes');
    setUsuario(null);
  }

  const papel = usuario?.papel;

  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Login */}
          <Route
            path="/login"
            element={
              usuario
                ? <Navigate to={
                    papel === 'admin' ? '/clientes' :
                    papel === 'funcionario' ? (getPrimeiraPermissaoFuncionario() || '/dashboard') :
                    '/dashboard'
                  } replace />
                : <Login onLogin={handleLogin} />
            }
          />

          {/* Seleção de clientes — só admin */}
          <Route
            path="/clientes"
            element={
              <PrivateRoute usuario={usuario}>
                {papel !== 'admin'
                  ? <Navigate to="/dashboard" replace />
                  : <ClienteSelect onLogout={handleLogout} />}
              </PrivateRoute>
            }
          />

          {/* Páginas dentro do Layout */}
          <Route path="/dashboard"   element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="dashboard"><Dashboard /></PrivateLayout>} />
          <Route path="/lancamentos" element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="lancamentos"><Lancamentos /></PrivateLayout>} />
          <Route path="/relatorio"   element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="relatorio"><Relatorio /></PrivateLayout>} />
          <Route path="/contas"      element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="contas"><Contas /></PrivateLayout>} />
          <Route path="/financeiro"  element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="financeiro"><Financeiro /></PrivateLayout>} />
          <Route path="/exportar"    element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="exportar"><Exportar /></PrivateLayout>} />
          <Route path="/upgrade"     element={<PrivateLayout usuario={usuario} onLogout={handleLogout} slug="upgrade"><Upgrade /></PrivateLayout>} />

          {/* Rota raiz: redireciona conforme papel */}
          <Route
            path="/"
            element={
              !usuario
                ? <Navigate to="/login" replace />
                : papel === 'admin'
                ? <Navigate to="/clientes" replace />
                : papel === 'funcionario'
                ? <Navigate to={getPrimeiraPermissaoFuncionario() || '/dashboard'} replace />
                : <Navigate to="/dashboard" replace />
            }
          />

          {/* Verificação de e-mail (pública) */}
          <Route path="/verificar" element={<VerificarEmail />} />

          {/* Redefinição de senha (pública) */}
          <Route path="/redefinir" element={<RedefinirSenha />} />

          {/* Ranking — admin only */}
          <Route
            path="/ranking"
            element={
              <PrivateLayout usuario={usuario} onLogout={handleLogout}>
                {papel !== 'admin' ? <Navigate to="/dashboard" replace /> : <Ranking />}
              </PrivateLayout>
            }
          />


          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}