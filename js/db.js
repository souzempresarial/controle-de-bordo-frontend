// ══════════════════════════════════════════════════════════════════════════════
// CAMADA DE DADOS — trocar localStorage por API aqui no futuro
// ══════════════════════════════════════════════════════════════════════════════
const DB = {
  // CLIENTES
  getClientes: () => JSON.parse(localStorage.getItem('fin_clientes') || '[]'),
  saveClientes: (list) => localStorage.setItem('fin_clientes', JSON.stringify(list)),

  // DADOS DO CLIENTE ATIVO
  getLancamentos: (cid) => JSON.parse(localStorage.getItem(`fin_${cid}_lancamentos`) || '[]'),
  saveLancamentos: (cid, list) => localStorage.setItem(`fin_${cid}_lancamentos`, JSON.stringify(list)),
  getNextId: (cid) => parseInt(localStorage.getItem(`fin_${cid}_nextId`) || '1'),
  saveNextId: (cid, n) => localStorage.setItem(`fin_${cid}_nextId`, n),
  deleteClienteData: (cid) => {
    localStorage.removeItem(`fin_${cid}_lancamentos`);
    localStorage.removeItem(`fin_${cid}_nextId`);
    localStorage.removeItem(`fin_${cid}_regras`);
  },
  // CONTAS A RECEBER / PAGAR (independentes dos lançamentos)
  getContas: (cid) => JSON.parse(localStorage.getItem(`fin_${cid}_contas`) || '[]'),
  saveContas: (cid, list) => localStorage.setItem(`fin_${cid}_contas`, JSON.stringify(list)),
  getNextContaId: (cid) => parseInt(localStorage.getItem(`fin_${cid}_nextContaId`) || '1'),
  saveNextContaId: (cid, n) => localStorage.setItem(`fin_${cid}_nextContaId`, n),
  // REGRAS DE CATEGORIZAÇÃO
  getRegras: (cid) => JSON.parse(localStorage.getItem(`fin_${cid}_regras`) || '[]'),
  saveRegras: (cid, list) => localStorage.setItem(`fin_${cid}_regras`, JSON.stringify(list)),
};
