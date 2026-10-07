import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API } from '../services/api';

const AppContext = createContext(null);

function clienteSalvo() {
  try { return JSON.parse(sessionStorage.getItem('sf_cliente_json') || 'null'); }
  catch { sessionStorage.removeItem('sf_cliente_json'); return null; }
}

const espera = ms => new Promise(r => setTimeout(r, ms));

export function AppProvider({ children }) {
  // Volta com o cliente já definido após F5; os dados chegam depois, sem deixar clienteAtivo null no meio
  const [clienteAtivo, setClienteAtivo] = useState(clienteSalvo);
  const [lancamentos, setLancamentos]   = useState([]);
  const [contas, setContas]             = useState([]);
  const [metasCache, setMetasCache]     = useState({});
  const [loading, setLoading]           = useState(false);
  const [erroEntrar, setErroEntrar]     = useState('');

  const entrarCliente = useCallback(async (cliente) => {
    setLoading(true);
    setErroEntrar('');
    try {
      const [lansRes, ctsRes, metasRes] = await Promise.allSettled([
        API.listarLancamentos(cliente.id),
        API.listarContas(cliente.id),
        API.listarMetas(cliente.id),
      ]);

      if (lansRes.status === 'rejected' || ctsRes.status === 'rejected') {
        setErroEntrar('Não foi possível carregar os dados do cliente. Verifique sua conexão e tente novamente.');
        throw new Error('Falha ao carregar dados do cliente');
      }

      const lans     = lansRes.status  === 'fulfilled' ? lansRes.value  : [];
      const cts      = ctsRes.status   === 'fulfilled' ? ctsRes.value   : [];
      const metasArr = metasRes.status === 'fulfilled' ? metasRes.value : [];

      const mc = {};
      metasArr.forEach(m => {
        if (!mc[m.mes_chave]) mc[m.mes_chave] = {};
        mc[m.mes_chave][m.campo] = parseFloat(m.valor);
      });

      setClienteAtivo(cliente);
      setLancamentos(lans);
      setContas(cts);
      setMetasCache(mc);
      sessionStorage.setItem('sf_cliente_json', JSON.stringify(cliente));
    } finally {
      setLoading(false);
    }
  }, []);

  const sairCliente = useCallback(() => {
    setClienteAtivo(null);
    setLancamentos([]);
    setContas([]);
    setMetasCache({});
    sessionStorage.removeItem('sf_cliente_json');
  }, []);

  const recarregarCliente = useCallback(async () => {
    const cliente = clienteSalvo();
    if (!cliente) return;
    for (const atraso of [0, 1500, 4000]) {
      if (atraso) await espera(atraso);
      try {
        await entrarCliente(cliente);
        return;
      } catch { /* tenta de novo; erroEntrar fica visível se todas falharem */ }
    }
  }, [entrarCliente]);

  useEffect(() => { recarregarCliente(); }, [recarregarCliente]);

  return (
    <AppContext.Provider value={{
      clienteAtivo, lancamentos, setLancamentos,
      contas, setContas,
      metasCache, setMetasCache,
      loading, erroEntrar, entrarCliente, sairCliente, recarregarCliente,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
