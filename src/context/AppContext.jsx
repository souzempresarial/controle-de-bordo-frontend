import { createContext, useContext, useState, useCallback } from 'react';
import { API } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [lancamentos, setLancamentos]   = useState([]);
  const [contas, setContas]             = useState([]);
  const [metasCache, setMetasCache]     = useState({});
  const [loading, setLoading]           = useState(false);

  const entrarCliente = useCallback(async (cliente) => {
    setLoading(true);
    try {
      const [lans, cts, metasArr] = await Promise.all([
        API.listarLancamentos(cliente.id),
        API.listarContas(cliente.id),
        API.listarMetas(cliente.id),
      ]);

      // Converte array de metas para { [mesChave]: { [campo]: valor } }
      const mc = {};
      metasArr.forEach(m => {
        if (!mc[m.mes_chave]) mc[m.mes_chave] = {};
        mc[m.mes_chave][m.campo] = parseFloat(m.valor);
      });

      setClienteAtivo(cliente);
      setLancamentos(lans);
      setContas(cts);
      setMetasCache(mc);
    } finally {
      setLoading(false);
    }
  }, []);

  const sairCliente = useCallback(() => {
    setClienteAtivo(null);
    setLancamentos([]);
    setContas([]);
    setMetasCache({});
  }, []);

  return (
    <AppContext.Provider value={{
      clienteAtivo, lancamentos, setLancamentos,
      contas, setContas,
      metasCache, setMetasCache,
      loading, entrarCliente, sairCliente,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
