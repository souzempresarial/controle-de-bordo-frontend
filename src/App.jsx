import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Login from './pages/Login';
import ClienteSelect from './pages/ClienteSelect';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

function getUsuarioInicial() {
  const token = localStorage.getItem('cb_token');
  const papel = localStorage.getItem('cb_papel');
  const nome  = localStorage.getItem('cb_nome');
  return token ? { token, papel, nome } : null;
}

export default function App() {
  const [usuario, setUsuario] = useState(getUsuarioInicial);

  function handleLogin(dados) {
    setUsuario(dados);
  }

  function handleLogout() {
    localStorage.removeItem('cb_token');
    localStorage.removeItem('cb_papel');
    localStorage.removeItem('cb_nome');
    localStorage.removeItem('cb_cliente_id');
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
              !usuario
                ? <Navigate to="/login" replace />
                : papel !== 'admin'
                ? <Navigate to="/dashboard" replace />
                : <ClienteSelect onLogout={handleLogout} />
            }
          />

          {/* Dashboard e demais páginas — dentro do Layout */}
          <Route
            path="/dashboard"
            element={
              !usuario
                ? <Navigate to="/login" replace />
                : <Layout usuario={usuario} onLogout={handleLogout}>
                    <Dashboard />
                  </Layout>
            }
          />

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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
