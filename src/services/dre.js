export function calcDREBase(lm) {
  const ent = (cat, sub) => lm.filter(l => l.tipo === 'Entrada' && l.categoria === cat && (!sub || l.subcategoria === sub)).reduce((a,l) => a+l.valor, 0);
  const sai = (cat)      => lm.filter(l => l.tipo === 'Saída'   && l.categoria === cat).reduce((a,l) => a+l.valor, 0);
  const qua = (cat)      => lm.filter(l => l.categoria === cat).reduce((a,l) => a+l.valor, 0);

  const aparelhos    = ent('Aparelhos');
  const acessorios   = ent('Acessórios');
  const assistencia  = ent('Assistência Técnica');
  const outrosProd   = ent('Outros Produtos');
  const subscricao   = aparelhos + acessorios + assistencia + outrosProd;

  const recFin       = ent('Receitas Não-Operacionais', 'Aplicações Fora da Companhia');
  const recNaoOp     = ent('Receitas Não-Operacionais') - recFin;
  const recBruta     = subscricao + recNaoOp;

  const deducoesDiretas = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null && l.subcategoria !== 'Upgrade').reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const deducoes     = sai('Deduções das Vendas') + deducoesDiretas;
  const recLiquida   = recBruta - deducoes;

  const cmvDir       = qua('Custos Variáveis Diretos');
  const cmvTotal     = cmvDir;
  const lucroBruto   = recLiquida - cmvTotal;

  const custosVarInd = sai('Custos Variáveis Indiretos');
  const contribuicao = lucroBruto - custosVarInd;
  const margContrib  = recBruta > 0 ? (contribuicao / recBruta * 100) : null;

  const ocupacao     = sai('Despesas com Ocupação');
  const pessoal      = sai('Despesas com Pessoal');
  const variaveis    = sai('Despesas Variáveis');
  const softwares    = sai('Softwares / Tecnologias');
  const terceiros    = sai('Serviços Terceirizados');
  const impostos     = sai('Impostos');
  const sga          = ocupacao + pessoal + variaveis + softwares + terceiros + impostos;
  const pontoEq      = (margContrib && margContrib > 0) ? (sga / (margContrib / 100)) : null;
  const ebitda       = contribuicao - sga;
  const margEbitda   = recBruta > 0 ? (ebitda / recBruta * 100) : null;

  const despJuros    = lm.filter(l => l.tipo === 'Saída' && l.categoria === 'Dívidas / Empréstimos' && l.subcategoria !== 'Amortização').reduce((a,l) => a+l.valor, 0);
  const despNaoOp    = sai('Saídas Não-Operacionais');
  const resFin       = recFin - despJuros - despNaoOp;

  const lucroLiq     = ebitda + resFin;
  const margem       = recBruta > 0 ? (lucroLiq / recBruta * 100) : 0;

  return {
    aparelhos, acessorios, assistencia, outrosProd,
    subscricao, recNaoOp, recBruta, deducoes, recLiquida,
    cmvDir, cmvTotal, custosVarInd, lucroBruto, contribuicao, margContrib, pontoEq,
    ocupacao, pessoal, variaveis, softwares, terceiros, impostos, sga,
    ebitda, margEbitda, recFin, despJuros, despNaoOp, resFin,
    lucroLiq, margem,
  };
}
