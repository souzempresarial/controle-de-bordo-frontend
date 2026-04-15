import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../services/api';
import { useApp } from '../context/AppContext';
import './ClienteSelect.css';

function initials(nome) {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function ClienteSelect({ onLogout }) {
  const [clientes, setClientes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState('');
  const [entrando, setEntrando]   = useState(null);
  const { entrarCliente }         = useApp();
  const navigate                  = useNavigate();

  useEffect(() => {
    API.listarClientes()
      .then(setClientes)
      .catch(() => setErro('Erro ao carregar clientes'))
      .finally(() => setLoading(false));
  }, []);

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
          <div className="clientes-logo">📊</div>
          <h1>Controle de Bordo 2.0</h1>
          <p>Selecione um cliente para acessar</p>
        </div>

        {loading && <div className="clientes-loading">Carregando clientes...</div>}
        {erro && <div className="clientes-erro">{erro}</div>}

        {!loading && !erro && (
          <div className="clientes-lista">
            {clientes.length === 0 ? (
              <div className="clientes-empty">
                <div className="icon">👤</div>
                <div>Nenhum cliente cadastrado ainda.</div>
              </div>
            ) : (
              clientes.map(c => (
                <div
                  key={c.id}
                  className={`cliente-card ${entrando === c.id ? 'loading' : ''}`}
                  onClick={() => !entrando && handleEntrar(c)}
                >
                  <div
                    className="cliente-avatar"
                    style={{ background: `${c.cor}22`, color: c.cor }}
                  >
                    {initials(c.nome)}
                  </div>
                  <div className="cliente-info">
                    <div className="nome">{c.nome}</div>
                    <div className="meta">{entrando === c.id ? 'Carregando...' : (c.obs || 'Clique para acessar')}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <button className="btn-sair" onClick={handleLogout}>Sair</button>
      </div>
    </div>
  );
}
