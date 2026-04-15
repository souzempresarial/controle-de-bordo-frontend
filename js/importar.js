// ══════════════════════════════════════════════════════════════════════════════
// IMPORTAR EXTRATO
// ══════════════════════════════════════════════════════════════════════════════
let importLinhas = [];

// Palavras-chave para detectar tipo
const KEYWORDS_ENTRADA = ['pix receb','ted receb','doc receb','crédito','credito','depósito','deposito','recebimento','salário','salario','receita','reembolso','estorno','devolução','devolucao'];
const KEYWORDS_SAIDA   = ['pix enviad','ted enviad','doc enviad','débito','debito','pagamento','compra','saque','tarifa','taxa','transferência enviada','transferencia enviada','boleto','cobrança','cobranca'];

function inferirTipo(desc) {
  const d = desc.toLowerCase();
  if (KEYWORDS_ENTRADA.some(k => d.includes(k))) return 'Entrada';
  if (KEYWORDS_SAIDA.some(k => d.includes(k))) return 'Saída';
  return 'Saída'; // padrão
}

function aplicarRegras(desc) {
  if (!clienteAtivo) return null;
  const regras = DB.getRegras(clienteAtivo.id);
  const sorted = [...regras].sort((a,b) => b.palavra.length - a.palavra.length);
  const d = desc.toLowerCase();
  for (const r of sorted) {
    if (d.includes(r.palavra.toLowerCase())) return { categoria: r.categoria, subcategoria: r.subcategoria || '' };
  }
  return null;
}

function inferirCategoria(desc) {
  const d = desc.toLowerCase();
  if (d.includes('salário') || d.includes('salario') || d.includes('folha')) return 'Renda';
  if (d.includes('aluguel')) return 'Moradia';
  if (d.includes('luz') || d.includes('energia') || d.includes('celesc') || d.includes('copel') || d.includes('cemig') || d.includes('enel')) return 'Moradia';
  if (d.includes('água') || d.includes('agua') || d.includes('sabesp') || d.includes('copasa')) return 'Moradia';
  if (d.includes('internet') || d.includes('claro') || d.includes('vivo') || d.includes('tim') || d.includes('oi ') || d.includes('net ')) return 'Comunicação';
  if (d.includes('ifood') || d.includes('uber eats') || d.includes('rappi')) return 'Alimentação';
  if (d.includes('uber') || d.includes('99 ') || d.includes('cabify')) return 'Transporte';
  if (d.includes('posto') || d.includes('combustivel') || d.includes('combustível') || d.includes('shell') || d.includes('petrobras') || d.includes('ipiranga')) return 'Transporte';
  if (d.includes('mercado') || d.includes('supermercado') || d.includes('extra') || d.includes('carrefour') || d.includes('atacadão') || d.includes('assaí')) return 'Alimentação';
  if (d.includes('farmácia') || d.includes('farmacia') || d.includes('drogaria') || d.includes('ultrafarma') || d.includes('pacheco')) return 'Saúde';
  if (d.includes('netflix') || d.includes('spotify') || d.includes('amazon prime') || d.includes('disney') || d.includes('youtube')) return 'Assinaturas';
  if (d.includes('tarifa') || d.includes('taxa') || d.includes('iof') || d.includes('anuidade')) return 'Impostos / Taxas';
  if (d.includes('fornecedor') || d.includes('compra') || d.includes('nf ') || d.includes('nota fiscal')) return 'Trabalho / Negócio';
  if (d.includes('freelan') || d.includes('autonomo') || d.includes('autônomo')) return 'Renda';
  return '';
}

function parsearExtrato(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  const resultados = [];

  const reData  = /\b(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})\b/;
  const reValor = /[-−]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:CR|DB|C|D)?\b/gi;

  for (const linha of linhas) {
    if (/^(data|descrição|valor|saldo|extrato|conta|agência|período|banco|histórico|documento|página|pag\.|total)/i.test(linha)) continue;
    if (linha.length < 8) continue;

    const matchData = linha.match(reData);
    if (!matchData) continue;

    const valores = [];
    let m;
    const reV = /[-−]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    while ((m = reV.exec(linha)) !== null) {
      const numStr = m[1].replace(/\./g,'').replace(',','.');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) valores.push({ val: num, raw: m[0], idx: m.index });
    }
    if (!valores.length) continue;

    const valorPrincipal = valores.reduce((a,b) => a.val > b.val ? a : b);

    let desc = linha
      .replace(reData, '')
      .replace(/R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!desc || desc.length < 3) desc = 'Lançamento importado';

    const isEntrada = /\bC\b|CR\b|crédito|credito|\+/i.test(linha) && !/débito|debito|\bD\b|\bDB\b/i.test(linha);
    const tipo = isEntrada ? 'Entrada' : inferirTipo(desc);

    let [, dia, mes, ano] = matchData;
    if (ano.length === 2) ano = '20' + ano;
    const dataISO = `${ano}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;

    resultados.push({
      data:        dataISO,
      tipo,
      descricao:   desc,
      valor:       valorPrincipal.val,
      categoria:   (aplicarRegras(desc) || {categoria: inferirCategoria(desc)}).categoria,
      subcategoria:(aplicarRegras(desc) || {subcategoria:''}).subcategoria,
      viaRegra:    !!aplicarRegras(desc),
      pagamento:   '',
      status:      'Confirmado',
      ignorar:     false,
    });
  }

  // Remove duplicatas óbvias
  const uniq = [];
  const visto = new Set();
  for (const r of resultados) {
    const chave = `${r.data}_${r.valor}_${r.descricao.slice(0,20)}`;
    if (!visto.has(chave)) { visto.add(chave); uniq.push(r); }
  }

  return uniq;
}

function processarExtrato() {
  const texto = document.getElementById('import-texto').value;
  if (!texto.trim()) { toast('Cole o texto do extrato primeiro', 'error'); return; }

  importLinhas = parsearExtrato(texto);

  if (!importLinhas.length) {
    document.getElementById('import-preview').innerHTML = `
      <div class="form-panel" style="text-align:center;color:var(--text2)">
        <div style="font-size:32px;margin-bottom:10px">🤔</div>
        <div>Não consegui detectar transações neste texto.</div>
        <div style="font-size:12px;margin-top:6px">Tente copiar apenas as linhas de transações do extrato.</div>
      </div>`;
    return;
  }

  renderImportPreview();
}

function renderImportPreview() {
  function opsCatsPorTipo(tipo) {
    return '<option value="">— categoria —</option>' +
      Object.entries(getCatsPorTipo(tipo)).map(([c, subs]) =>
        subs === null
          ? `<option disabled style="color:var(--text2);font-size:11px">${c}</option>`
          : `<option>${c}</option>`
      ).join('');
  }

  const linhasHTML = importLinhas.map((l, i) => {
    const palavraSugerida = l.descricao.split(/\s+/).slice(0,3).join(' ');
    return `
    <div class="import-row ${l.ignorar?'import-ignorar':''}" id="irow-${i}">
      <input type="date" value="${l.data}" onchange="importLinhas[${i}].data=this.value">
      <select onchange="importLinhas[${i}].tipo=this.value;atualizarCorValor(${i})">
        <option${l.tipo==='Saída'?' selected':''}>Saída</option>
        <option${l.tipo==='Entrada'?' selected':''}>Entrada</option>
        <option${l.tipo==='Transferência'?' selected':''}>Transferência</option>
      </select>
      <input type="text" value="${l.descricao}" onchange="importLinhas[${i}].descricao=this.value">
      <select id="icat-${i}" onchange="importLinhas[${i}].categoria=this.value;importLinhas[${i}].categoriaAlterada=true;atualizarSubImport(${i});toggleRegraBox(${i})">${opsCatsPorTipo(l.tipo).replace(`<option>${l.categoria}<`, `<option selected>${l.categoria}<`)}</select>
      <select id="isub-${i}"><option value="">— subcategoria —</option></select>
      <input type="number" value="${l.valor}" step="0.01" style="text-align:right;color:${l.tipo==='Entrada'?'var(--entrada)':'var(--saida)'}" onchange="importLinhas[${i}].valor=parseFloat(this.value)" id="ival-${i}">
      <div class="regra-box" id="regrabox-${i}">
        ${l.viaRegra ? `<span class="via-regra-badge">⚡ regra aplicada</span>` : `
        <input type="checkbox" id="rcheck-${i}" onchange="importLinhas[${i}].lembrar=this.checked">
        <label for="rcheck-${i}" style="white-space:nowrap;cursor:pointer">Lembrar:</label>
        <input type="text" id="rpalavra-${i}" value="${palavraSugerida}" placeholder="palavra-chave"
          oninput="importLinhas[${i}].palavraRegra=this.value"
          style="${l.categoriaAlterada?'':'opacity:.4;pointer-events:none'}">`}
      </div>
      <button class="btn btn-ghost btn-sm" title="${l.ignorar?'Incluir':'Ignorar'}" onclick="toggleIgnorar(${i})" style="color:${l.ignorar?'var(--entrada)':'var(--danger)'}">
        ${l.ignorar?'✓':'✕'}
      </button>
    </div>`;
  }).join('');

  document.getElementById('import-preview').innerHTML = `
    <div class="import-preview-panel">
      <div class="import-preview-header">
        <h2>${importLinhas.filter(l=>!l.ignorar).length} de ${importLinhas.length} transações detectadas</h2>
        <button class="btn btn-ghost btn-sm" onclick="marcarTodos(true)">Ignorar todos</button>
        <button class="btn btn-ghost btn-sm" onclick="marcarTodos(false)">Incluir todos</button>
        <button class="btn btn-primary btn-sm" onclick="confirmarImport()">✓ Importar selecionados</button>
      </div>
      <div class="import-header-row">
        <span>Data</span><span>Tipo</span><span>Descrição</span>
        <span>Categoria</span><span>Subcategoria</span><span>Valor</span><span>Regra</span><span></span>
      </div>
      ${linhasHTML}
    </div>`;

  importLinhas.forEach((l, i) => {
    if (l.categoria) atualizarSubImport(i, l.subcategoria);
  });
}

function atualizarSubImport(i, valorAtual) {
  const cat  = importLinhas[i].categoria;
  const sub  = document.getElementById('isub-' + i);
  if (!sub) return;
  const subs = TODAS_CATEGORIAS[cat] || [];
  sub.innerHTML = '<option value="">— subcategoria —</option>' +
    subs.map(s=>`<option${s===valorAtual?' selected':''}>${s}</option>`).join('');
  sub.onchange = () => { importLinhas[i].subcategoria = sub.value; };
}

function atualizarCorValor(i) {
  const inp = document.getElementById('ival-' + i);
  if (inp) inp.style.color = importLinhas[i].tipo==='Entrada' ? 'var(--entrada)' : 'var(--saida)';
}

function toggleRegraBox(i) {
  const inp = document.getElementById('rpalavra-' + i);
  if (!inp) return;
  inp.style.opacity = '1';
  inp.style.pointerEvents = 'auto';
}

function toggleIgnorar(i) {
  importLinhas[i].ignorar = !importLinhas[i].ignorar;
  renderImportPreview();
}

function marcarTodos(ignorar) {
  importLinhas.forEach(l => l.ignorar = ignorar);
  renderImportPreview();
}

async function confirmarImport() {
  const validos = importLinhas.filter(l => !l.ignorar && l.valor > 0 && l.descricao);
  if (!validos.length) { toast('Nenhuma transação selecionada', 'error'); return; }

  try {
    const criados = await Promise.all(validos.map(l =>
      API.criarLancamento(clienteAtivo.id, {
        data:        l.data,
        tipo:        l.tipo,
        categoria:   l.categoria || 'Outro',
        subcategoria:l.subcategoria || '',
        descricao:   l.descricao,
        pagamento:   l.pagamento || '',
        status:      l.status,
        valor:       l.valor,
        obs:         'Importado do extrato',
      })
    ));
    criados.forEach(l => lancamentos.unshift(l));

    // Salvar regras novas
    const regras = DB.getRegras(clienteAtivo.id);
    let regrasSalvas = 0;
    validos.forEach(l => {
      if (l.lembrar && l.palavraRegra && l.palavraRegra.trim() && l.categoria) {
        const palavra = l.palavraRegra.trim().toLowerCase();
        const jaExiste = regras.some(r => r.palavra.toLowerCase() === palavra);
        if (!jaExiste) {
          regras.push({ id: Date.now() + Math.random(), palavra, categoria: l.categoria, subcategoria: l.subcategoria || '', criadaEm: new Date().toISOString() });
          regrasSalvas++;
        }
      }
    });
    if (regrasSalvas) DB.saveRegras(clienteAtivo.id, regras);

    importLinhas = [];
    document.getElementById('import-texto').value = '';
    document.getElementById('import-preview').innerHTML = '';
    const msg = regrasSalvas ? `${validos.length} lançamentos importados · ${regrasSalvas} regra${regrasSalvas>1?'s':''} salva${regrasSalvas>1?'s':''}` : `${validos.length} lançamentos importados`;
    toast(msg);
    navTo('lancamentos', document.querySelectorAll('.nav-btn')[2]);
  } catch (err) {
    toast('Erro ao importar lançamentos', 'error');
    console.error(err);
  }
}
