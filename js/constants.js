// ══════════════════════════════════════════════════════════════════════════════
// CATEGORIAS
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORIAS_ENTRADA = {
  '— Receitas Operacionais —': null,
  'Aparelhos':             ['iPhone','Android','Apple Watch','AirPods','Mac','iPad','Fonte Turbo','Outro'],
  'Acessórios':            ['Acessórios Geral','Kit 3 em 1','Capa e Película','Cabo / Carregador','Outro'],
  'Assistência Técnica':   ['Conserto de Tela','Troca de Bateria','Troca de Traseira','Doc de Carga','Outro'],
  'Outros Produtos':           ['Perfumes','Bebidas','Informática','Eletrônicos','JBL','Outro'],
  '— Receitas Não-Operacionais —': null,
  'Receitas Não-Operacionais': ['Blindagem','Seguro','Vendas Extras','Empréstimo','Investimento Externo','Aplicações Fora da Companhia','Outro'],
};

const CATEGORIAS_SAIDA = {
  '— Fornecedores (Estoque) —': null,
  'Fornecedores (Estoque)':['Aparelhos','Acessórios','Embalagens','Brindes','Assistência Técnica','Boleto','Outro'],
  '— Deduções das Vendas —': null,
  'Deduções das Vendas':   ['Taxas de Maquininha','Estornos','Descontos','Outro'],
  '— Custos Variáveis —': null,
  'Custos Variáveis Indiretos':['Comissões do Vendedor','Motoboy','Freelancers','Horas Extras de Colaboradores','Outro'],
  '— Despesas SG&A —': null,
  'Despesas com Ocupação': ['Luz','Operadora Celular','Internet','Água','Aluguel / Condomínio / IPTU','Outro'],
  'Despesas com Pessoal':  ['Vales - Transporte & Refeição','13º & Férias','INSS & FGTS','Adiantamento','Folha de Pagamento','Pró-Labore / PLR','Outro'],
  'Despesas Variáveis':    ['Mídia Paga','Tarifas Bancárias','Frete','Garantia','Manutenções / Reparos','Treinamentos','Outros'],
  'Softwares / Tecnologias':['CRM','Sistema ERP','Outro'],
  'Serviços Terceirizados':['Assessoria Contábil','BPO Terceirização','Emissão de NF-e','Serviços Gerais (Limpeza)','Google Meu Negócio','Assistência Técnica','Assessoria de Marketing','DAS - Simples Nacional','DAS - MEIs'],
  '— Não-Operacional —': null,
  'Saídas Não-Operacionais':['Suprimentos','Obras','Despesas Extras','Decorações','Manutenções em Equipamentos'],
  'Dívidas / Empréstimos': ['Empréstimo Infinity','Empréstimo Itaú','Outro'],
  '— Investimento —': null,
  'Investimentos':         ['Equipamentos','Reformas','Computadores','Veículos','Imóveis'],
};

const CATEGORIAS_TRANSF = {
  'Transferência':         ['Entre Contas Próprias','Para Reserva / Caixa','Para Investimento','Para Terceiros','Outros'],
};

// Categorias CMV — usadas só no modal de Entrada, nunca no dropdown de Saída
const CATEGORIAS_CMV = {
  'Custos Variáveis Diretos': ['Aparelhos iPhone','Aparelhos Android','Acessórios','Embalagens','Brindes','Assistência Técnica','Outros'],
};

// Mapa plano para lookup de subcategorias (categoria → subs)
const TODAS_CATEGORIAS = {};
[CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, CATEGORIAS_TRANSF, CATEGORIAS_CMV].forEach(grupo => {
  Object.entries(grupo).forEach(([cat, subs]) => { if (subs) TODAS_CATEGORIAS[cat] = subs; });
});

function getCatsPorTipo(tipo) {
  if (tipo === 'Entrada')      return CATEGORIAS_ENTRADA;
  if (tipo === 'Transferência') return CATEGORIAS_TRANSF;
  return CATEGORIAS_SAIDA;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAPAS DRE / DFC
// ══════════════════════════════════════════════════════════════════════════════
const DRE_MAP = {
  // RECEITAS OPERACIONAIS
  'Aparelhos':                   { tipo:'entrada', grupo:'rec_op',  label:'Venda de Aparelhos' },
  'Acessórios':                  { tipo:'entrada', grupo:'rec_op',  label:'Venda de Acessórios' },
  'Assistência Técnica':         { tipo:'entrada', grupo:'rec_op',  label:'Assistência Técnica' },
  'Outros Produtos':             { tipo:'entrada', grupo:'rec_op',  label:'Outros Produtos' },
  // RECEITAS NÃO OPERACIONAIS
  'Receitas Não-Operacionais':   { tipo:'entrada', grupo:'rec_nop', label:'Receitas Não-Operacionais' },
  // CUSTOS (CMV) — lançamentos auto-gerados pelo modal de Entrada
  'Custos Variáveis Diretos':    { tipo:'saida',   grupo:'cmv',     label:'Custos Variáveis Diretos' },
  'Custos Variáveis Indiretos':  { tipo:'saida',   grupo:'cmv',     label:'Custos Variáveis Indiretos' },
  // DESPESAS OPERACIONAIS
  'Deduções das Vendas':         { tipo:'saida',   grupo:'desp_op', label:'Deduções das Vendas' },
  'Despesas com Ocupação':       { tipo:'saida',   grupo:'desp_op', label:'Despesas com Ocupação' },
  'Despesas com Pessoal':        { tipo:'saida',   grupo:'desp_op', label:'Despesas com Pessoal' },
  'Despesas Variáveis':          { tipo:'saida',   grupo:'desp_op', label:'Despesas Variáveis' },
  'Softwares / Tecnologias':     { tipo:'saida',   grupo:'desp_op', label:'Softwares / Tecnologias' },
  'Serviços Terceirizados':      { tipo:'saida',   grupo:'desp_op', label:'Serviços Terceirizados' },
  // NÃO OPERACIONAL SAÍDA
  'Saídas Não-Operacionais':     { tipo:'saida',   grupo:'nop',     label:'Saídas Não-Operacionais' },
  'Dívidas / Empréstimos':       { tipo:'saida',   grupo:'nop',     label:'Dívidas / Empréstimos' },
  // INVESTIMENTO
  'Investimentos':               { tipo:'saida',   grupo:'nop',     label:'Investimentos' },
};

// DFC: mapeamento categoria → atividade (op / fin / inv)
// Lançamentos com isCMV:true são excluídos do DFC — são ajuste contábil do DRE apenas
const DFC_MAP = {
  // Operacional
  'Aparelhos':               'op', 'Acessórios':            'op',
  'Assistência Técnica':     'op', 'Outros Produtos':       'op',
  'Fornecedores (Estoque)':  'op',
  'Deduções das Vendas':     'op', 'Despesas com Ocupação': 'op',
  'Despesas com Pessoal':    'op', 'Despesas Variáveis':    'op',
  'Softwares / Tecnologias': 'op', 'Serviços Terceirizados':'op',
  // Financiamento
  'Receitas Não-Operacionais':'fin','Saídas Não-Operacionais':'fin',
  'Dívidas / Empréstimos':   'fin',
  // Investimento
  'Investimentos':           'inv',
  'Transferência':           'inv',
};
