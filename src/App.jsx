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
import Ranking from './pages/Ranking';
import Upgrade from './pages/Upgrade';

function getUsuarioInicial() {
  const papel = sessionStorage.getItem('cb_papel');
  const nome  = sessionStorage.getItem('cb_nome');
  return papel ? { papel, nome } : null;
}

function PrivateRoute({ usuario, children }) {
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

function PrivateLayout({ usuario, onLogout, children }) {
  if (!usuario) return <Navigate to="/login" replace />;
  return <Layout usuario={usuario} onLogout={onLogout}>{children}</Layout>;
}

export default function App() {
  const [usuario, setUsuario] = useState(getUsuarioInicial);

  useEffect(() => {
    const tema = localStorage.getItem('cb_tema') || 'dark';
    document.documentElement.dataset.theme = tema;
  }, []);

  function handleLogin(dados) {
    setUsuario(dados);
  }

  function handleLogout() {
    API.logout().catch(() => {});
    sessionStorage.removeItem('cb_papel');
    sessionStorage.removeItem('cb_nome');
    sessionStorage.removeItem('cb_cliente_id');
    sessionStorage.removeItem('cb_cliente_json');
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
                ? <Navigate to={papel === 'admin' ? '/clientes' : '/dashboard'} replace />
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
          <Route path="/dashboard"   element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Dashboard /></PrivateLayout>} />
          <Route path="/lancamentos" element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Lancamentos /></PrivateLayout>} />
          <Route path="/relatorio"   element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Relatorio /></PrivateLayout>} />
          <Route path="/contas"      element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Contas /></PrivateLayout>} />
          <Route path="/financeiro"  element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Financeiro /></PrivateLayout>} />
          <Route path="/exportar"    element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Exportar /></PrivateLayout>} />
          <Route path="/upgrade"    element={<PrivateLayout usuario={usuario} onLogout={handleLogout}><Upgrade /></PrivateLayout>} />

          {/* Rota raiz: redireciona conforme papel */}
          <Route
            path="/"
            element={
              !usuario
                ? <Navigate to="/login" replace />
                : papel === 'admin'
                ? <Navigate to="/clientes" replace />
                : <Navigate to="/dashboard" replace />
            }
          />

          {/* Verificação de e-mail (pública) */}
          <Route path="/verificar" element={<VerificarEmail />} />

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