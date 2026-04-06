// ══════════════════════════════════════════════════════════════════════════════
// FLUXO DE CAIXA
// ══════════════════════════════════════════════════════════════════════════════
// Estrutura DFC — espelha a planilha do controle de bordo
const DFC_ESTRUTURA = [
  { tipo:'resumo', label:'Entradas Total',   key:'ent_total' },
  { tipo:'resumo', label:'Saídas Total',     key:'sai_total' },
  { tipo:'resumo', label:'Saldo Final',      key:'saldo',    destaque:true },
  { tipo:'sep',    label:'SAÍDAS' },
  { tipo:'grupo',  label:'SAÍDAS OPERACIONAIS', key:'sai_op' },
  { tipo:'subgrupo', label:'Fornecedores (Estoque)', cat:'Fornecedores (Estoque)' },
  { tipo:'subgrupo', label:'Deduções das Vendas',    cat:'Deduções das Vendas' },
  { tipo:'subgrupo', label:'CMV — Custos Variáveis Diretos',   cat:'Custos Variáveis Diretos' },
  { tipo:'subgrupo', label:'CMV — Custos Variáveis Indiretos', cat:'Custos Variáveis Indiretos' },
  { tipo:'subgrupo', label:'Despesas com Ocupação',  cat:'Despesas com Ocupação' },
  { tipo:'subgrupo', label:'Despesas com Pessoal',   cat:'Despesas com Pessoal' },
  { tipo:'subgrupo', label:'Despesas Variáveis',     cat:'Despesas Variáveis' },
  { tipo:'subgrupo', label:'Softwares / Tecnologias',cat:'Softwares / Tecnologias' },
  { tipo:'subgrupo', label:'Serviços Terceirizados', cat:'Serviços Terceirizados' },
  { tipo:'grupo',  label:'SAÍDAS NÃO-OPERACIONAIS',  key:'sai_nop' },
  { tipo:'subgrupo', label:'Saídas Não-Operacionais',cat:'Saídas Não-Operacionais' },
  { tipo:'subgrupo', label:'Dívidas / Empréstimos',  cat:'Dívidas / Empréstimos' },
  { tipo:'grupo',  label:'SAÍDAS DE INVESTIMENTO',   key:'sai_inv' },
  { tipo:'subgrupo', label:'Investimentos',          cat:'Investimentos' },
  { tipo:'sep',    label:'ENTRADAS' },
  { tipo:'grupo',  label:'RECEITAS OPERACIONAIS',    key:'ent_op' },
  { tipo:'subgrupo', label:'Aparelhos',              cat:'Aparelhos' },
  { tipo:'subgrupo', label:'Acessórios',             cat:'Acessórios' },
  { tipo:'subgrupo', label:'Assistência Técnica',    cat:'Assistência Técnica' },
  { tipo:'grupo',  label:'RECEITAS NÃO-OPERACIONAIS',key:'ent_nop' },
  { tipo:'subgrupo', label:'Receitas Não-Operacionais', cat:'Receitas Não-Operacionais' },
];

function abrirModalSaldoInicial() {
  const ano = document.getElementById('fluxo-ano')?.value || hoje().slice(0,4);
  const si  = getSaldoInicial(ano);
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('si-mes').value   = si.mes;
  document.getElementById('si-valor').value = si.valor || '';
  const prev = document.getElementById('si-preview');
  if (si.valor > 0) {
    prev.style.display = 'block';
    prev.innerHTML = `Configuração atual: <strong style="color:var(--accent)">${fmt(si.valor)}</strong> em <strong>${MESES_FULL[si.mes]}/${ano}</strong>`;
  } else {
    prev.style.display = 'none';
  }
  document.getElementById('modal-saldo-inicial').classList.add('open');
  setTimeout(() => document.getElementById('si-valor').focus(), 50);
}

function confirmarSaldoInicial() {
  const ano   = document.getElementById('fluxo-ano')?.value || hoje().slice(0,4);
  const valor = parseFloat(document.getElementById('si-valor').value);
  const mes   = parseInt(document.getElementById('si-mes').value);
  if (isNaN(valor) || valor < 0) { toast('Informe um valor válido', 'error'); return; }
  saveSaldoInicial(ano, valor, mes);
  fecharModal('modal-saldo-inicial');
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  toast(`Saldo inicial de ${fmt(valor)} definido em ${MESES_FULL[mes]}/${ano}`);
}

function getSaldoInicial(ano) {
  const raw = localStorage.getItem(`fin_${clienteAtivo.id}_saldo_inicial_${ano}`);
  if (!raw) return { valor: 0, mes: 0 };
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : { valor: parseFloat(raw) || 0, mes: 0 };
  } catch { return { valor: parseFloat(raw) || 0, mes: 0 }; }
}

function saveSaldoInicial(ano, valor, mes) {
  const obj = { valor: parseFloat(valor) || 0, mes: parseInt(mes) || 0 };
  localStorage.setItem(`fin_${clienteAtivo.id}_saldo_inicial_${ano}`, JSON.stringify(obj));
  renderFluxo();
}

function renderFluxo() {
  const anoEl = document.getElementById('fluxo-ano');
  const ano   = anoEl?.value || hoje().slice(0,4);

  // Popular select de anos
  if (anoEl) {
    const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))].sort().reverse();
    if (!anos.includes(hoje().slice(0,4))) anos.unshift(hoje().slice(0,4));
    const vAtual = anoEl.value || hoje().slice(0,4);
    anoEl.innerHTML = anos.map(a => `<option${a===vAtual?' selected':''}>${a}</option>`).join('');
  }

  const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  // Soma por categoria+subcategoria por mês — exclui CMV (DRE only)
  const cmvCats = Object.keys(CATEGORIAS_CMV);
  const lancDFC = lancamentos.filter(l => !l.isCMV && !cmvCats.includes(l.categoria) && !(l.tipo==='Saída' && l.status==='Pendente'));
  const valDFC = l => l.tipo==='Entrada' ? (l.valorRecebido ?? l.valor) : l.valor;
  function somarCat(cat, mes) {
    return lancDFC
      .filter(l => l.data.startsWith(`${ano}-${String(mes+1).padStart(2,'0')}`) && l.categoria === cat)
      .reduce((a,l) => a + valDFC(l), 0);
  }
  function somarSubs(cat, mes) {
    const subs = TODAS_CATEGORIAS[cat] || [];
    const total = somarCat(cat, mes);
    return { total, subs: subs.map(s => ({
      label: s,
      val: lancDFC
        .filter(l => l.data.startsWith(`${ano}-${String(mes+1).padStart(2,'0')}`) && l.categoria===cat && l.subcategoria===s)
        .reduce((a,l) => a + valDFC(l), 0)
    }))};
  }
  function somarTipo(tipo, mes) {
    return lancDFC
      .filter(l => l.data.startsWith(`${ano}-${String(mes+1).padStart(2,'0')}`) && l.tipo===tipo)
      .reduce((a,l) => a + valDFC(l), 0);
  }

  // Saldo inicial
  const si = getSaldoInicial(ano);
  const saldoInicial = si.valor;
  const saldoInicialMes = si.mes;
  // Atualiza label do botão com valor atual
  const btnSI = document.getElementById('btn-saldo-inicial');
  if (btnSI) btnSI.textContent = saldoInicial > 0 ? `💰 Saldo Inicial: ${fmt(saldoInicial)}` : '💰 Saldo Inicial';

  // Cards de saldo anual DFC
  const totalEntDFC = lancDFC.filter(l=>l.data.startsWith(ano)&&l.tipo==='Entrada').reduce((a,l)=>a+valDFC(l),0);
  const totalSaiDFC = lancDFC.filter(l=>l.data.startsWith(ano)&&l.tipo==='Saída').reduce((a,l)=>a+l.valor,0);
  const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const saldoPeriodo = totalEntDFC - totalSaiDFC;
  const saldoFinal   = saldoInicial + saldoPeriodo;
  document.getElementById('fluxo-cards').innerHTML = `
    <div class="card"><div class="card-label">Saldo Inicial</div><div class="card-value" style="color:var(--accent)">${fmt(saldoInicial)}</div><div class="card-sub">A partir de ${MESES_LABEL[saldoInicialMes]}/${ano}</div></div>
    <div class="card"><div class="card-label">Entradas DFC ${ano}</div><div class="card-value" style="color:var(--entrada)">${fmt(totalEntDFC)}</div></div>
    <div class="card"><div class="card-label">Saídas DFC ${ano}</div><div class="card-value" style="color:var(--saida)">${fmt(totalSaiDFC)}</div></div>
    <div class="card"><div class="card-label">Saldo Final ${ano}</div><div class="card-value" style="color:${saldoFinal>=0?'var(--entrada)':'var(--saida)'}">${fmt(saldoFinal)}</div><div class="card-sub">Inicial + período</div></div>`;

  // Totais anuais por linha
  const totaisAnuais = {};

  // Header
  const thMeses = MESES.map(m=>`<th style="text-align:right;min-width:90px">${m}</th>`).join('');
  let html = `<table class="fluxo-table" style="min-width:1200px">
    <thead><tr><th style="min-width:260px">Descrição</th>${thMeses}<th style="text-align:right;min-width:100px">TOTAL</th></tr></thead>
    <tbody>`;

  DFC_ESTRUTURA.forEach(row => {
    if (row.tipo === 'sep') {
      html += `<tr><td colspan="14" style="background:#22c55e22;color:#22c55e;font-weight:700;font-size:12px;letter-spacing:1px;padding:10px 14px;text-transform:uppercase">${row.label}</td></tr>`;
      return;
    }

    if (row.tipo === 'resumo') {
      if (row.key === 'saldo') {
        // Saldo do mês — resultado isolado de cada mês
        const saldoMesVals = MESES.map((_,i) => somarTipo('Entrada',i) - somarTipo('Saída',i));
        const totalSaldoMes = saldoMesVals.reduce((a,b)=>a+b,0);
        html += `<tr style="font-weight:700;border-top:2px solid var(--border)">
          <td style="font-weight:700">Saldo do Mês</td>
          ${saldoMesVals.map(v=>`<td class="fluxo-saldo-col ${v>=0?'saldo-pos':'saldo-neg'}" style="text-align:right">${fmt(v)}</td>`).join('')}
          <td class="fluxo-saldo-col ${totalSaldoMes>=0?'saldo-pos':'saldo-neg'}" style="text-align:right">${fmt(totalSaldoMes)}</td>
        </tr>`;
        return;
      }
      const vals = MESES.map((_,i) => {
        if (row.key==='ent_total') return somarTipo('Entrada',i);
        if (row.key==='sai_total') return somarTipo('Saída',i);
        return 0;
      });
      const total = vals.reduce((a,b)=>a+b,0);
      const cls   = row.key==='ent_total' ? 'saldo-pos' : 'saldo-neg';
      const bg    = row.destaque ? 'background:#22c55e18;font-weight:800;' : 'font-weight:700;';
      html += `<tr style="${bg}border-bottom:2px solid var(--border)">
        <td style="font-weight:700">${row.label}</td>
        ${vals.map(v=>`<td style="text-align:right;color:${v>=0?'var(--entrada)':'var(--saida)'}">${v?fmt(v):'—'}</td>`).join('')}
        <td class="fluxo-saldo-col ${cls}" style="text-align:right">${fmt(total)}</td>
      </tr>`;
      return;
    }

    if (row.tipo === 'grupo') {
      const vals = MESES.map((_,i) => {
        // soma todas as sublinhas desse grupo
        let s = 0;
        DFC_ESTRUTURA.forEach(r2 => {
          if (r2.tipo==='subgrupo') {
            // verificar se pertence a este grupo
            const idxGrupo = DFC_ESTRUTURA.indexOf(row);
            const idxSub   = DFC_ESTRUTURA.indexOf(r2);
            const proxGrupo= DFC_ESTRUTURA.findIndex((r3,i3) => i3>idxGrupo && r3.tipo==='grupo');
            if (idxSub > idxGrupo && (proxGrupo===-1 || idxSub < proxGrupo)) {
              s += somarCat(r2.cat, i);
            }
          }
        });
        return s;
      });
      const total = vals.reduce((a,b)=>a+b,0);
      totaisAnuais[row.key] = total;
      html += `<tr style="background:var(--surface2);font-weight:700;border-top:1px solid var(--border)">
        <td>${row.label}</td>
        ${vals.map(v=>`<td style="text-align:right">${v?fmt(v):'—'}</td>`).join('')}
        <td style="text-align:right;font-weight:700">${fmt(total)}</td>
      </tr>`;
      return;
    }

    if (row.tipo === 'subgrupo') {
      const vals = MESES.map((_,i) => somarCat(row.cat, i));
      const total = vals.reduce((a,b)=>a+b,0);
      const subs  = TODAS_CATEGORIAS[row.cat] || [];
      html += `<tr style="border-bottom:1px solid #ffffff05">
        <td style="padding-left:20px;color:var(--text2);font-size:12px;font-weight:600">${row.label}</td>
        ${vals.map(v=>`<td style="text-align:right;color:var(--text2);font-size:12px">${v?fmt(v):'—'}</td>`).join('')}
        <td style="text-align:right;color:var(--text2);font-size:12px">${total?fmt(total):'—'}</td>
      </tr>`;
      // subcategorias
      subs.forEach(s => {
        const subVals = MESES.map((_,i) =>
          lancamentos.filter(l => l.data.startsWith(`${ano}-${String(i+1).padStart(2,'0')}`) && l.categoria===row.cat && l.subcategoria===s)
            .reduce((a,l)=>a+l.valor,0));
        const subTotal = subVals.reduce((a,b)=>a+b,0);
        if (!subTotal) return; // omite linhas zeradas
        html += `<tr>
          <td style="padding-left:36px;font-size:12px;color:var(--text2)">${s}</td>
          ${subVals.map(v=>`<td style="text-align:right;font-size:12px">${v?fmt(v):'—'}</td>`).join('')}
          <td style="text-align:right;font-size:12px">${fmt(subTotal)}</td>
        </tr>`;
      });
    }
  });

  html += '</tbody></table>';

  if (!lancamentos.some(l => l.data.startsWith(ano))) {
    document.getElementById('fluxo-corpo').innerHTML =
      `<div class="empty-state"><div class="icon">📈</div><div>Nenhum lançamento em ${ano}</div></div>`;
    return;
  }
  document.getElementById('fluxo-corpo').innerHTML = html;
  initStickyScrollbar('fluxo-corpo');
}
