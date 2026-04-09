// ══════════════════════════════════════════════════════════════════════════════
// FORMULÁRIO
// ══════════════════════════════════════════════════════════════════════════════
function abrirModalLancamento() {
  limparForm();
  popularCats('f-categoria', 'f-tipo');
  document.getElementById('modal-lancamento').classList.add('open');
  setTimeout(() => document.getElementById('f-valor').focus(), 50);
}

function abrirModalNovaConta(tipo) {
  editandoContaId = null;
  document.getElementById('conta-modal-titulo').textContent = 'Nova Conta';
  document.getElementById('conta-desc').value  = '';
  document.getElementById('conta-valor').value = '';
  document.getElementById('conta-venc').value  = '';
  document.getElementById('conta-cat').value   = '';
  document.getElementById('conta-recorrente').checked = false;
  document.getElementById('conta-periodicidade').value = 'mensal';
  document.getElementById('conta-periodicidade-wrap').style.display = 'none';
  document.getElementById('conta-subcat').innerHTML = '<option value="">— selecione —</option>';
  setContaTipo(tipo || 'receber');
  document.getElementById('modal-conta').classList.add('open');
  setTimeout(() => document.getElementById('conta-desc').focus(), 50);
}

function setContaTipo(tipo) {
  document.getElementById('conta-tipo-receber').className = tipo === 'receber' ? 'btn btn-primary' : 'btn btn-ghost';
  document.getElementById('conta-tipo-pagar').className   = tipo === 'pagar'   ? 'btn btn-primary' : 'btn btn-ghost';
  document.getElementById('modal-conta').dataset.tipo = tipo;
  document.getElementById('conta-recorrente-wrap').style.display = tipo === 'pagar' ? '' : 'none';
  if (tipo !== 'pagar') {
    document.getElementById('conta-recorrente').checked = false;
    document.getElementById('conta-periodicidade-wrap').style.display = 'none';
  }
  // Popular categorias conforme tipo
  const tipoLanc = tipo === 'receber' ? 'Entrada' : 'Saída';
  const cats = getCatsPorTipo(tipoLanc);
  const sel = document.getElementById('conta-cat');
  const atual = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>' +
    Object.entries(cats).map(([cat, subs]) =>
      subs === null
        ? `<option disabled style="color:var(--text2);font-size:11px">${cat}</option>`
        : `<option${cat === atual ? ' selected' : ''}>${cat}</option>`
    ).join('');
}

function atualizarSubsConta() {
  const cat  = document.getElementById('conta-cat').value;
  const sel  = document.getElementById('conta-subcat');
  const subs = TODAS_CATEGORIAS[cat] || [];
  sel.innerHTML = '<option value="">— selecione —</option>' +
    subs.map(s => `<option>${s}</option>`).join('');
}

function toggleRecorrencia() {
  const checked = document.getElementById('conta-recorrente').checked;
  document.getElementById('conta-periodicidade-wrap').style.display = checked ? '' : 'none';
}

async function salvarConta() {
  const desc          = document.getElementById('conta-desc').value.trim();
  const valor         = parseFloat(document.getElementById('conta-valor').value.replace(',','.'));
  const venc          = document.getElementById('conta-venc').value;
  const cat           = document.getElementById('conta-cat').value;
  const subcat        = document.getElementById('conta-subcat').value;
  const tipo          = document.getElementById('modal-conta').dataset.tipo || 'receber';
  const recorrente    = tipo === 'pagar' && document.getElementById('conta-recorrente').checked;
  const periodicidade = recorrente ? document.getElementById('conta-periodicidade').value : null;

  if (!desc)               { toast('Informe a descrição', 'error'); return; }
  if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return; }
  if (!venc)               { toast('Informe o vencimento', 'error'); return; }
  if (!cat)                { toast('Selecione a categoria', 'error'); return; }

  const dados = { tipo, descricao: desc, valor, vencimento: venc, categoria: cat, subcategoria: subcat, recorrente, periodicidade: periodicidade || null };

  try {
    if (editandoContaId) {
      const atualizada = await API.editarConta(clienteAtivo.id, editandoContaId, dados);
      const idx = contas.findIndex(c => c.id === editandoContaId);
      if (idx !== -1) contas[idx] = atualizada;
      toast('Conta atualizada');
    } else {
      const nova = await API.criarConta(clienteAtivo.id, dados);
      contas.push(nova);
      toast('Conta adicionada');
    }
    fecharModal('modal-conta');
    renderAll();
  } catch (err) {
    toast('Erro ao salvar conta', 'error');
    console.error(err);
  }
}

function calcularContasReceber() {
  const venda    = parseFloat(document.getElementById('f-valor').value) || 0;
  const recebido = parseFloat(document.getElementById('f-recebido').value);
  const prev     = document.getElementById('receber-preview');
  if (!venda || isNaN(recebido) || recebido >= venda) { prev.style.display = 'none'; return; }
  const aReceber = venda - recebido;
  prev.style.display = 'flex';
  document.getElementById('prev-venda').textContent    = fmt(venda);
  document.getElementById('prev-recebido').textContent = fmt(recebido);
  document.getElementById('prev-receber').textContent  = fmt(aReceber);
}

function calcularUnitario() {
  const valor = parseFloat(document.getElementById('f-valor').value) || 0;
  const qtd   = parseFloat(document.getElementById('f-quantidade').value) || 0;
  document.getElementById('f-unitario').value = (valor > 0 && qtd > 0) ? fmt(valor / qtd) : '';
}

function toggleCMVSection() {
  const tipo    = document.getElementById('f-tipo').value;
  const sec     = document.getElementById('cmv-section');
  const isEnt   = tipo === 'Entrada';
  sec.style.display = isEnt ? 'block' : 'none';
  document.getElementById('f-recebido-wrap').style.display = isEnt ? '' : 'none';
  document.getElementById('f-qtd-wrap').style.display      = isEnt ? '' : 'none';
  document.getElementById('f-unit-wrap').style.display     = isEnt ? '' : 'none';
  if (!isEnt) {
    document.getElementById('f-cmv-valor').value = '';
    document.getElementById('f-cmv-cat').value   = '';
    document.getElementById('f-cmv-sub').innerHTML = '<option value="">— selecione —</option>';
    document.getElementById('margem-preview').style.display = 'none';
    document.getElementById('f-recebido').value = '';
    document.getElementById('receber-preview').style.display = 'none';
    document.getElementById('f-quantidade').value = '';
    document.getElementById('f-unitario').value   = '';
  }
  // Atualiza label do valor
  document.getElementById('f-valor-label').textContent =
    tipo === 'Entrada' ? 'Valor Venda (R$)' : 'Valor (R$)';
}

function calcularMargem() {
  const receita = parseFloat(document.getElementById('f-valor').value) || 0;
  const cmv     = parseFloat(document.getElementById('f-cmv-valor').value) || 0;
  const prev    = document.getElementById('margem-preview');

  if (!receita && !cmv) { prev.style.display = 'none'; return; }
  prev.style.display = 'flex';

  const lucro   = receita - cmv;
  const margem  = receita ? ((lucro / receita) * 100).toFixed(2) : 0;

  document.getElementById('prev-receita').textContent = fmt(receita);
  document.getElementById('prev-cmv').textContent     = fmt(cmv);
  document.getElementById('prev-lucro').textContent   = fmt(lucro);
  document.getElementById('prev-lucro').style.color   = lucro >= 0 ? 'var(--entrada)' : 'var(--saida)';
  document.getElementById('prev-margem').textContent  = margem + '%';
  document.getElementById('prev-margem').style.color  = margem >= 0 ? 'var(--entrada)' : 'var(--saida)';
}

function resetCatForm() {
  document.getElementById('f-categoria').value = '';
  document.getElementById('f-subcategoria').innerHTML = '<option value="">— selecione —</option>';
}


function limparForm() {
  ['f-valor','f-descricao','f-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-tipo').value = 'Saída';
  document.getElementById('f-pagamento').value = '';
  document.getElementById('f-status').value = 'Confirmado';
  document.getElementById('f-data').value = hoje();
  document.getElementById('f-categoria').value = '';
  document.getElementById('f-subcategoria').innerHTML = '<option value="">— selecione —</option>';
  // Reset valor recebido
  document.getElementById('f-recebido').value = '';
  document.getElementById('receber-preview').style.display = 'none';
  // Reset quantidade
  document.getElementById('f-quantidade').value = '';
  document.getElementById('f-unitario').value   = '';
  // Reset CMV
  document.getElementById('f-cmv-valor').value = '';
  document.getElementById('f-cmv-cat').value = '';
  document.getElementById('f-cmv-sub').innerHTML = '<option value="">— selecione —</option>';
  document.getElementById('cmv-section').style.display = 'none';
  document.getElementById('margem-preview').style.display = 'none';
}

async function salvarLancamento() {
  const valor     = parseFloat(document.getElementById('f-valor').value);
  const descricao = document.getElementById('f-descricao').value.trim();
  const categoria = document.getElementById('f-categoria').value;
  const tipo      = document.getElementById('f-tipo').value;

  if (!valor || valor <= 0)    { toast('Informe o valor', 'error'); return; }
  if (!categoria)              { toast('Selecione a categoria', 'error'); return; }

  const data         = document.getElementById('f-data').value || hoje();
  const pagamento    = document.getElementById('f-pagamento').value;
  const status       = document.getElementById('f-status').value;
  const obs          = document.getElementById('f-obs').value.trim();
  const subcategoria = document.getElementById('f-subcategoria').value;

  const cmvValor = tipo === 'Entrada' ? (parseFloat(document.getElementById('f-cmv-valor').value) || 0) : 0;
  const cmvCat   = document.getElementById('f-cmv-cat').value;
  const cmvSub   = document.getElementById('f-cmv-sub').value;

  if (cmvValor > 0 && !cmvCat) { toast('Selecione o tipo de custo do CMV', 'error'); return; }
  if (cmvValor >= valor)        { toast('CMV não pode ser maior ou igual à receita', 'warn'); }

  const grupoId       = cmvValor > 0 ? ('g' + Date.now()) : null;
  const quantidade    = tipo === 'Entrada' ? (parseInt(document.getElementById('f-quantidade').value) || null) : null;
  const recebidoRaw   = tipo === 'Entrada' ? parseFloat(document.getElementById('f-recebido').value) : NaN;
  const valorRecebido = (!isNaN(recebidoRaw) && recebidoRaw < valor) ? recebidoRaw : null;

  try {
    const l = await API.criarLancamento(clienteAtivo.id, {
      tipo, valor, data, categoria, subcategoria,
      descricao, pagamento, status, obs,
      quantidade, valor_recebido: valorRecebido, grupo_id: grupoId,
    });
    lancamentos.unshift(l);

    if (cmvValor > 0) {
      const lCMV = await API.criarLancamento(clienteAtivo.id, {
        tipo: 'Saída', valor: cmvValor, data,
        categoria: cmvCat, subcategoria: cmvSub,
        descricao: 'CMV — ' + descricao,
        pagamento, status,
        obs: 'Lançamento CMV vinculado ao #' + String(l.id).padStart(3,'0'),
        grupo_id: grupoId, is_cmv: true,
      });
      lancamentos.unshift(lCMV);
      toast('Entrada #' + String(l.id).padStart(3,'0') + ' + CMV #' + String(lCMV.id).padStart(3,'0') + ' adicionados');
    } else {
      toast('Lançamento #' + String(l.id).padStart(3,'0') + ' adicionado');
    }

    limparForm();
    fecharModal('modal-lancamento');
    renderAll();
  } catch (err) {
    toast('Erro ao salvar lançamento', 'error');
    console.error(err);
  }
}
