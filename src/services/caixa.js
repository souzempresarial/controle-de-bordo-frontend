// Caixa da loja: saldo das contas no dia 1 (informado) + o que os lançamentos movimentaram.
import { CMVCATS } from './constants';
import { upgradeNoCaixa } from './utils';

const proximoMes = ym => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

// Mesmo cálculo do Fluxo de Caixa: entrada sem o aparelho recebido na troca, saída + taxa gravada na venda, sem CMV
export function resultadoCaixa(lancamentos, pfx) {
  const lm = lancamentos.filter(l => l.data.startsWith(pfx) && !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
  const ent = lm.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0) - lm.reduce((a, l) => a + upgradeNoCaixa(l), 0);
  const ded = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const sai = lm.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0) + ded;
  return { ent, sai, saldo: ent - sai };
}

// Caixa no dia 1 do mês `ym`: o informado, ou o último informado antes + os saldos dos meses entre eles.
// totais = [{ mes: 'AAAA-MM', total }]. null quando nenhum saldo foi informado até ali.
export function caixaNoDia1(lancamentos, totais, ym) {
  const base = totais.filter(t => t.mes <= ym).sort((a, b) => a.mes.localeCompare(b.mes)).pop();
  if (!base) return null;
  let valor = base.total;
  const partes = [{ mes: base.mes, tipo: 'informado', valor: base.total }];
  for (let m = base.mes; m < ym; m = proximoMes(m)) {
    const saldo = resultadoCaixa(lancamentos, m).saldo;
    valor += saldo;
    partes.push({ mes: m, tipo: 'lancamentos', valor: saldo });
  }
  return { valor, informado: base.mes === ym, desde: base.mes, partes };
}

export { proximoMes };
