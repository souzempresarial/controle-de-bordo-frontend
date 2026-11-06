// Mês a que uma conta pertence (competência). Mesma regra do backend (src/services/competencia.js):
// - salário e encargos pagos até o dia 10 e impostos até o dia 20 se referem ao mês anterior (vale do dia 15-20 é do próprio mês)
// - compra de fornecedor e conta a receber pertencem ao mês em que foram registradas, se antes do vencimento
// - o resto pertence ao mês do vencimento
export function competenciaPadrao({ tipo, categoria, vencimento, criado_em }) {
  const venc = /^\d{4}-\d{2}-\d{2}/.test(String(vencimento || '')) ? String(vencimento).slice(0, 10) : null;
  const registro = String(criado_em || new Date().toISOString()).slice(0, 7);
  if (!venc || venc > '2100-01-01') return registro;
  const mesVenc = venc.slice(0, 7);
  if (tipo === 'pagar' && ((categoria === 'Despesas com Pessoal' && +venc.slice(8, 10) <= 10) || (categoria === 'Impostos' && +venc.slice(8, 10) <= 20))) {
    const [y, m] = mesVenc.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }
  if (tipo === 'receber' || categoria === 'Fornecedores (Estoque)') return registro < mesVenc ? registro : mesVenc;
  return mesVenc;
}

export const competenciaDe = c => c.competencia || competenciaPadrao(c);

// Último dia do mês "AAAA-MM"
export function fimDoMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// A conta estava em aberto no fim do mês? Pendente hoje, ou paga depois do fim do mês.
// Quitada antiga sem data de pagamento: considera paga no vencimento
export function abertaNoFimDe(c, ym) {
  if (c.status !== 'quitado') return true;
  const pago = String(c.pago_em || c.vencimento || '').slice(0, 10);
  return !!pago && pago > fimDoMes(ym);
}
