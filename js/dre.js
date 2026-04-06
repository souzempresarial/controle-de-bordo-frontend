// ══════════════════════════════════════════════════════════════════════════════
// DRE — visão anual (espelha planilha controle de bordo)
// ══════════════════════════════════════════════════════════════════════════════

function getDREManual(ano) {
  const key = `fin_${clienteAtivo.id}_dre_manual_${ano}`;
  const m = JSON.parse(localStorage.getItem(key) || '{}');
  return {
    depreciacao: m.depreciacao || new Array(12).fill(0),
    irpj:        m.irpj        || new Array(12).fill(0),
  };
}

function saveDREManual(ano, field, mesIdx, valor) {
  const key = `fin_${clienteAtivo.id}_dre_manual_${ano}`;
  const m = JSON.parse(localStorage.getItem(key) || '{}');
  if (!m[field]) m[field] = new Array(12).fill(0);
  m[field][mesIdx] = parseFloat(valor) || 0;
  localStorage.setItem(key, JSON.stringify(m));
  renderDRE();
}

function renderDRE() {
  const anoEl = document.getElementById('dre-ano');
  const ano   = anoEl?.value || hoje().slice(0,4);

  if (anoEl) {
    const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))].sort().reverse();
    if (!anos.includes(hoje().slice(0,4))) anos.unshift(hoje().slice(0,4));
    const vAtual = anoEl.value || hoje().slice(0,4);
    anoEl.innerHTML = anos.map(a => `<option${a===vAtual?' selected':''}>${a}</option>`).join('');
  }

  const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const manual = getDREManual(ano);

  // Calcular valores por mês
  const mv = MESES.map((_, i) => {
    const pfx = `${ano}-${String(i+1).padStart(2,'0')}`;
    const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
    const ent = (cat, sub) => lm.filter(l => l.tipo==='Entrada' && l.categoria===cat && (!sub||l.subcategoria===sub)).reduce((a,l)=>a+l.valor,0);
    const sai = (cat)      => lm.filter(l => l.tipo==='Saída'   && l.categoria===cat).reduce((a,l)=>a+l.valor,0);
    const qualquer = (cat) => lm.filter(l => l.categoria===cat).reduce((a,l)=>a+l.valor,0);

    const subscricao  = ent('Aparelhos') + ent('Acessórios') + ent('Assistência Técnica');
    const recNaoOp    = ent('Receitas Não-Operacionais');
    const recBruta    = subscricao + recNaoOp;
    const deducoes    = sai('Deduções das Vendas');
    const recLiquida  = recBruta - deducoes;

    const cmvInd      = sai('Custos Variáveis Indiretos');
    const cmvDir      = qualquer('Custos Variáveis Diretos');
    const cmvTotal    = cmvInd + cmvDir;
    const lucroBruto  = recLiquida - cmvTotal;
    const margContrib = recBruta > 0 ? (lucroBruto / recBruta * 100) : null;

    const ocupacao    = sai('Despesas com Ocupação');
    const pessoal     = sai('Despesas com Pessoal');
    const variaveis   = sai('Despesas Variáveis');
    const softwares   = sai('Softwares / Tecnologias');
    const terceiros   = sai('Serviços Terceirizados');
    const sga         = ocupacao + pessoal + variaveis + softwares + terceiros;
    const pontoEq     = (margContrib && margContrib > 0) ? (sga / (margContrib / 100)) : null;

    const ebitda      = lucroBruto - sga;
    const margEbitda  = recBruta > 0 ? (ebitda / recBruta * 100) : null;

    const recFin      = ent('Receitas Não-Operacionais', 'Aplicações Fora da Companhia');
    const despJuros   = sai('Dívidas / Empréstimos');
    const despNaoOp   = sai('Saídas Não-Operacionais');
    const resFin      = recFin - despJuros - despNaoOp;

    const dep         = manual.depreciacao[i] || 0;
    const lair        = ebitda + resFin - dep;
    const irpjV       = manual.irpj[i] || 0;
    const lucroLiq    = lair - irpjV;
    const margLiq     = recBruta > 0 ? (lucroLiq / recBruta * 100) : null;

    return { subscricao, recNaoOp, recBruta, deducoes, recLiquida,
             cmvInd, cmvDir, cmvTotal, lucroBruto, margContrib, pontoEq,
             ocupacao, pessoal, variaveis, softwares, terceiros, sga,
             ebitda, margEbitda, recFin, despJuros, despNaoOp, resFin,
             dep, lair, irpjV, lucroLiq, margLiq };
  });

  const S  = k => mv.reduce((a,v) => a + (v[k]||0), 0);
  const tRecBruta   = S('recBruta'),  tLucroBruto = S('lucroBruto');
  const tSga        = S('sga'),       tEbitda     = S('ebitda');
  const tLucroLiq   = S('lucroLiq'),  tRecLiq     = S('recLiquida');
  const tCmv        = S('cmvTotal'),  tResFin     = S('resFin');
  const tLair       = S('lair'),      tDep        = S('dep'), tIrpj = S('irpjV');

  // Cards
  document.getElementById('dre-cards').innerHTML = `
    <div class="card"><div class="card-label">Receita Bruta ${ano}</div><div class="card-value" style="color:var(--entrada)">${fmt(tRecBruta)}</div></div>
    <div class="card"><div class="card-label">Lucro Bruto</div><div class="card-value" style="color:${tLucroBruto>=0?'var(--entrada)':'var(--saida)'}">${fmt(tLucroBruto)}</div><div class="card-sub">${tRecBruta>0?(tLucroBruto/tRecBruta*100).toFixed(2)+'%':''}</div></div>
    <div class="card"><div class="card-label">EBITDA</div><div class="card-value" style="color:${tEbitda>=0?'var(--entrada)':'var(--saida)'}">${fmt(tEbitda)}</div><div class="card-sub">${tRecBruta>0?(tEbitda/tRecBruta*100).toFixed(2)+'%':''}</div></div>
    <div class="card"><div class="card-label">Lucro Líquido</div><div class="card-value" style="color:${tLucroLiq>=0?'var(--entrada)':'var(--saida)'}">${fmt(tLucroLiq)}</div><div class="card-sub">${tRecBruta>0?(tLucroLiq/tRecBruta*100).toFixed(2)+'%':''}</div></div>`;

  // Helpers de renderização
  const d  = v => (!v||v===0) ? `<span style="color:var(--text2)">—</span>`
                               : `<span style="color:${v>=0?'var(--entrada)':'var(--saida)'}">${v<0?'('+fmt(-v)+')':fmt(v)}</span>`;
  const dn = v => (!v||v===0) ? `<span style="color:var(--text2)">—</span>`
                               : `<span style="color:var(--saida)">${fmt(v)}</span>`;
  const dp = v => v===null ? `<span style="color:var(--text2)">—</span>`
                           : `<span style="color:${v>=0?'var(--entrada)':'var(--saida)'}">${v.toFixed(2)}%</span>`;

  const rowBig = (label, vals, totVal, neg=false, final=false) => {
    const bg = final ? 'background:#22c55e18;' : 'background:var(--surface2);';
    const fn = neg ? dn : d;
    return `<tr style="${bg}font-weight:800;border-top:2px solid var(--border);border-bottom:2px solid var(--border)">
      <td style="padding-left:8px">${label}</td>
      ${vals.map(v=>`<td style="text-align:right">${fn(v)}</td>`).join('')}
      <td style="text-align:right">${fn(totVal)}</td></tr>`;
  };
  const rowMed = (label, vals, totVal, neg=false) => {
    if (!vals.some(v=>v&&v!==0) && !totVal) return '';
    const fn = neg ? dn : d;
    return `<tr style="font-weight:600">
      <td style="padding-left:16px">${label}</td>
      ${vals.map(v=>`<td style="text-align:right">${fn(v)}</td>`).join('')}
      <td style="text-align:right">${fn(totVal)}</td></tr>`;
  };
  const rowExpandable = (label, cat, vals, totVal, neg=false, tipo='Saída') => {
    if (!vals.some(v=>v&&v!==0) && !totVal) return '';
    const fn  = neg ? dn : d;
    const gid = 'drex_' + cat.replace(/[^a-zA-Z0-9]/g,'_');
    const subs = TODAS_CATEGORIAS[cat] || [];
    let subHtml = '';
    subs.forEach(sub => {
      const subVals = MESES.map((_,i) => {
        const pfx = `${ano}-${String(i+1).padStart(2,'0')}`;
        return lancamentos.filter(l => (!tipo||l.tipo===tipo) && l.categoria===cat && l.subcategoria===sub && l.data.startsWith(pfx)).reduce((a,l)=>a+l.valor,0);
      });
      const subTot = subVals.reduce((a,b)=>a+b,0);
      if (!subVals.some(v=>v!==0) && subTot===0) return;
      subHtml += `<tr class="${gid}_sub" style="display:none;background:#0a0f1500">
        <td style="padding-left:36px;color:var(--text2);font-size:12px;border-left:2px solid #22c55e33">${sub}</td>
        ${subVals.map(v=>`<td style="text-align:right;font-size:12px">${fn(v)}</td>`).join('')}
        <td style="text-align:right;font-size:12px">${fn(subTot)}</td></tr>`;
    });
    const hasExp = subHtml !== '';
    const icon = hasExp ? `<span id="${gid}_icon" style="display:inline-block;margin-right:6px;font-size:9px;transition:transform .15s;color:var(--text2)">▶</span>` : '<span style="display:inline-block;width:15px"></span>';
    const onclick = hasExp ? `onclick="(function(){var s=document.querySelectorAll('.${gid}_sub'),ic=document.getElementById('${gid}_icon'),op=s[0]&&s[0].style.display!=='none';s.forEach(function(r){r.style.display=op?'none':'table-row';});if(ic)ic.style.transform=op?'':'rotate(90deg)';})()"` : '';
    return `<tr style="font-weight:600;${hasExp?'cursor:pointer;':''}" ${onclick}>
      <td style="padding-left:16px">${icon}${label}</td>
      ${vals.map(v=>`<td style="text-align:right">${fn(v)}</td>`).join('')}
      <td style="text-align:right">${fn(totVal)}</td></tr>
    ${subHtml}`;
  };
  const rowPct = (label, vals, totVal) =>
    `<tr style="font-style:italic">
      <td style="padding-left:8px;font-size:12px;color:var(--text2)">${label}</td>
      ${vals.map(v=>`<td style="text-align:right;font-size:12px">${dp(v)}</td>`).join('')}
      <td style="text-align:right;font-size:12px">${dp(totVal)}</td></tr>`;
  const rowEdit = (label, field, _vals, totVal) =>
    `<tr><td style="padding-left:16px;color:var(--text2)">${label}</td>
      ${MESES.map((_,i)=>`<td style="text-align:right">
        <input type="number" value="${manual[field][i]||''}" placeholder="—" min="0" step="0.01"
          style="width:78px;text-align:right;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:2px 5px;font-size:12px"
          onchange="saveDREManual('${ano}','${field}',${i},this.value)">
      </td>`).join('')}
      <td style="text-align:right">${dn(totVal)}</td></tr>`;

  const thMeses = MESES.map(m=>`<th style="text-align:right;min-width:90px">${m}</th>`).join('');
  let h = `<table class="fluxo-table" style="min-width:1200px">
    <thead><tr><th style="min-width:280px">DRE — Resultado do Exercício</th>${thMeses}<th style="text-align:right;min-width:100px">TOTAL</th></tr></thead><tbody>`;

  h += rowBig('RECEITA BRUTA', mv.map(v=>v.recBruta), tRecBruta);
  h += rowMed('(+) Receita Operacional', mv.map(v=>v.subscricao), S('subscricao'));
  h += rowExpandable('(+) Receitas Não-Operacionais', 'Receitas Não-Operacionais', mv.map(v=>v.recNaoOp), S('recNaoOp'), false, 'Entrada');
  h += rowExpandable('(-) Deduções das Vendas', 'Deduções das Vendas', mv.map(v=>v.deducoes), S('deducoes'), true);
  h += rowBig('(=) RECEITA LÍQUIDA', mv.map(v=>v.recLiquida), tRecLiq);

  h += rowBig('(+) CMV — Custo de Mercadoria Vendida', mv.map(v=>v.cmvTotal), tCmv, true);
  h += rowExpandable('(-) Custos Variáveis Indiretos', 'Custos Variáveis Indiretos', mv.map(v=>v.cmvInd), S('cmvInd'), true);
  h += rowExpandable('(-) Custos Variáveis Diretos', 'Custos Variáveis Diretos', mv.map(v=>v.cmvDir), S('cmvDir'), true, null);

  h += rowBig('(=) LUCRO BRUTO', mv.map(v=>v.lucroBruto), tLucroBruto);
  h += rowPct('Margem de Contribuição (%)', mv.map(v=>v.margContrib), tRecBruta>0?(tLucroBruto/tRecBruta*100):null);
  h += `<tr style="font-style:italic"><td style="padding-left:8px;font-size:12px;color:var(--text2)">Ponto de Equilíbrio</td>
    ${mv.map(v=>`<td style="text-align:right;font-size:12px">${v.pontoEq!==null?d(v.pontoEq):'<span style="color:var(--text2)">—</span>'}</td>`).join('')}
    <td style="text-align:right;font-size:12px">${tLucroBruto>0&&tRecBruta>0?d(tSga/(tLucroBruto/tRecBruta)):'<span style="color:var(--text2)">—</span>'}</td></tr>`;

  h += rowBig('(=) Despesas SG&A', mv.map(v=>v.sga), tSga, true);
  h += rowExpandable('(-) Despesas com Ocupação',    'Despesas com Ocupação',    mv.map(v=>v.ocupacao),  S('ocupacao'),  true);
  h += rowExpandable('(-) Despesas com Pessoal',     'Despesas com Pessoal',     mv.map(v=>v.pessoal),   S('pessoal'),   true);
  h += rowExpandable('(-) Despesas Variáveis',       'Despesas Variáveis',       mv.map(v=>v.variaveis), S('variaveis'), true);
  h += rowExpandable('(-) Softwares / Tecnologias',  'Softwares / Tecnologias',  mv.map(v=>v.softwares), S('softwares'), true);
  h += rowExpandable('(-) Serviços Terceirizados',   'Serviços Terceirizados',   mv.map(v=>v.terceiros), S('terceiros'), true);

  h += rowBig('(=) LUCRO OPERACIONAL (EBITDA)', mv.map(v=>v.ebitda), tEbitda);
  h += rowPct('Margem EBITDA (%)', mv.map(v=>v.margEbitda), tRecBruta>0?(tEbitda/tRecBruta*100):null);

  h += rowMed('(+) Resultado Financeiro', mv.map(v=>v.resFin), tResFin);
  h += rowMed('(+) Receitas Financeiras [Aplic. fora da Companhia]', mv.map(v=>v.recFin), S('recFin'));
  h += rowExpandable('(-) Despesas Financeiras [Juros Empréstimos]', 'Dívidas / Empréstimos', mv.map(v=>v.despJuros), S('despJuros'), true);
  h += rowExpandable('(-) Despesas Financeiras [Não-Operacionais]',  'Saídas Não-Operacionais', mv.map(v=>v.despNaoOp), S('despNaoOp'), true);

  h += rowEdit('(-) Depreciação', 'depreciacao', mv.map(v=>v.dep), tDep);

  h += rowBig('(=) LUCRO ANTES DO IR (LAIR)', mv.map(v=>v.lair), tLair);

  h += rowEdit('(-) Imposto sobre Lucro (IRPJ)', 'irpj', mv.map(v=>v.irpjV), tIrpj);

  h += rowBig('(=) LUCRO LÍQUIDO', mv.map(v=>v.lucroLiq), tLucroLiq, false, true);
  h += rowPct('Margem Líquida (%)', mv.map(v=>v.margLiq), tRecBruta>0?(tLucroLiq/tRecBruta*100):null);

  h += '</tbody></table>';
  document.getElementById('dre-corpo').innerHTML = h;
  initStickyScrollbar('dre-corpo');
}
