// Planilha de estoque (extensão do Mercado Phone ou feita à mão) → itens no mesmo formato da importação pela API,
// para passar pela mesma revisão item a item antes de entrar no Balanço

// Colunas do modelo, na ordem em que a extensão exporta
export const COLUNAS_MODELO = ['Produto', 'Tipo', 'Categoria', 'Quantidade', 'IMEI', 'Valor de custo', 'Valor de venda', 'Data de entrada', 'Data de venda'];

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Nome da coluna na planilha → campo (aceita variações comuns de cabeçalho)
const ALIAS = {
  produto:   ['produto', 'nome do produto', 'nome', 'descricao', 'item'],
  tipo:      ['tipo', 'tipo de produto'],
  categoria: ['categoria', 'estoque', 'destino'],
  quantidade:['quantidade', 'qtd', 'qtde'],
  imei:      ['imei', 'imei 1', 'serial'],
  custo:     ['valor de custo', 'custo', 'valor custo', 'preco de custo'],
  venda:     ['valor de venda', 'venda', 'valor venda', 'preco de venda'],
  entrada:   ['data de entrada', 'entrada', 'data entrada'],
  dataVenda: ['data de venda', 'data venda', 'vendido em'],
};

// "R$ 1.248,33", "1248.33", 1248.33 → número; vazio/inválido → null
function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/r\$\s*/i, '').trim();
  if (!s) return null;
  const n = parseFloat(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Data do Excel (número de série), "dd/mm/aaaa" ou "aaaa-mm-dd" → "aaaa-mm-dd"
function data(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

function destinoDe(categoria, tipo) {
  const c = norm(categoria);
  if (/manut|assist|laborat|conserto/.test(c)) return 'manutencao';
  if (/acess/.test(c)) return 'acessorios';
  if (/aparel/.test(c)) return 'aparelhos';
  return tipo === 'aparelho' ? 'aparelhos' : 'acessorios';
}

function tipoDe(tipo, categoria, imei) {
  const t = norm(tipo) || norm(categoria);
  if (/peca|servico/.test(t)) return 'peca';
  if (/acess/.test(t)) return 'acessorio';
  if (/aparel|celular|smartphone|iphone/.test(t) || imei) return 'aparelho';
  return 'acessorio';
}

export async function lerPlanilhaEstoque(arquivo) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await arquivo.arrayBuffer(), { cellDates: true });
  const aba = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, defval: '', raw: true, blankrows: false });
  if (!linhas.length) throw new Error('A planilha está vazia.');

  // Cabeçalho = primeira linha que tem a coluna de produto (a extensão pode pôr um título antes)
  const idxCab = linhas.findIndex(l => l.some(c => ALIAS.produto.includes(norm(c))));
  if (idxCab < 0) throw new Error(`Não achei a coluna "Produto". Use o modelo: ${COLUNAS_MODELO.join(', ')}.`);
  const cab = linhas[idxCab].map(norm);
  const col = Object.fromEntries(Object.entries(ALIAS).map(([campo, nomes]) => [campo, cab.findIndex(c => nomes.includes(c))]));
  if (col.custo < 0) throw new Error('Não achei a coluna "Valor de custo". Sem ela não dá para calcular o patrimônio.');
  if (col.tipo < 0 && col.categoria < 0) throw new Error('Não achei a coluna "Tipo" nem "Categoria". Uma das duas precisa existir.');

  const pega = (l, campo) => (col[campo] >= 0 ? l[col[campo]] : '');
  const itens = [];
  let vendidos = 0;
  linhas.slice(idxCab + 1).forEach((l, i) => {
    const descricao = String(pega(l, 'produto')).replace(/\s+/g, ' ').trim();
    if (!descricao) return;
    // A extensão já filtra, mas planilha feita à mão pode trazer o vendido: o que tem data de venda não é estoque
    if (data(pega(l, 'dataVenda'))) { vendidos++; return; }
    const imei = String(pega(l, 'imei')).trim() || null;
    const tipo = tipoDe(pega(l, 'tipo'), pega(l, 'categoria'), imei);
    const custo = numero(pega(l, 'custo'));
    const qtdLida = numero(pega(l, 'quantidade'));
    const quantidade = qtdLida == null ? 1 : Math.max(0, Math.round(qtdLida));
    const alertas = [];
    if (custo == null) alertas.push('Custo vazio ou inválido na planilha');
    else if (!custo) alertas.push('Sem custo cadastrado');
    if (tipo === 'peca') alertas.push('Peça ou serviço — não entra por padrão');
    if (!quantidade) alertas.push('Quantidade zero');
    itens.push({
      linha:           idxCab + i + 2,
      descricao,
      imei,
      tipo,
      destino:         destinoDe(pega(l, 'categoria'), tipo),
      quantidade,
      custo:           custo || 0,
      venda:           numero(pega(l, 'venda')),
      disponibilidade: '',
      dataEntrada:     data(pega(l, 'entrada')),
      alertas,
      aprovado:        custo != null && custo > 0 && quantidade > 0 && tipo !== 'peca',
    });
  });

  // Mesmo IMEI duas vezes = cadastro duplicado
  const vistos = new Set();
  for (const it of itens) {
    if (!it.imei) continue;
    if (vistos.has(it.imei)) { it.alertas.push('IMEI duplicado na planilha'); it.aprovado = false; }
    vistos.add(it.imei);
  }
  if (!itens.length) throw new Error(vendidos ? 'Todos os itens da planilha têm data de venda: nada parado em estoque.' : 'Nenhum produto encontrado abaixo do cabeçalho.');
  const ordem = { aparelho: 0, acessorio: 1, peca: 2 };
  itens.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.custo * b.quantidade - a.custo * a.quantidade);
  return { itens, vendidos };
}

export async function baixarModeloEstoque() {
  const XLSX = await import('xlsx');
  const exemplo = [
    COLUNAS_MODELO,
    ['iPhone 15 Pro 128GB Natural', 'Aparelho', 'Estoque Aparelhos', 1, '351234567890123', 3650, 4290, '2026-10-02', ''],
    ['Capa MagSafe iPhone 15', 'Acessório', 'Estoque Acessórios', 12, '', 18.5, 79.9, '2026-09-20', ''],
    ['iPhone 13 (troca de tela)', 'Aparelho', 'Manutenção', 1, '359876543210987', 1700, '', '2026-10-10', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(exemplo);
  ws['!cols'] = [34, 12, 20, 11, 18, 14, 14, 15, 14].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
  XLSX.writeFile(wb, 'modelo-estoque-souz.xlsx');
}
