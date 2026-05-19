export const CATEGORIAS_ENTRADA = {
  '— Receitas Operacionais —': null,
  'Aparelhos':             ['iPhone','Android','Apple Watch','AirPods','Mac','iPad','Fonte Turbo','Outro'],
  'Acessórios':            ['Acessórios Geral','Kit 3 em 1','Capa e Película','Cabo / Carregador','Outro'],
  'Assistência Técnica':   ['Conserto de Tela','Troca de Bateria','Troca de Traseira','Doc de Carga','Outro'],
  'Outros Produtos':       ['Perfumes','Bebidas','Informática','Eletrônicos','JBL','Outro'],
  '— Receitas Não-Operacionais —': null,
  'Receitas Não-Operacionais': ['Blindagem','Seguro','Vendas Extras','Empréstimo','Investimento Externo','Aplicações Fora da Companhia','Outro'],
};

export const CATEGORIAS_SAIDA = {
  '— Custos (CMV) —': null,
  'Custos Variáveis Diretos': ['Aparelhos iPhone','Aparelhos Android','iPad','MacBook','Apple Watch','AirPods','Acessórios','Embalagens','Brindes','Assistência Técnica','Outros'],
  '— Fornecedores (Estoque) —': null,
  'Fornecedores (Estoque)':['Aparelhos','Aparelhos (Upgrade)','Pix Fornecedor','Acessórios','Embalagens','Brindes','Assistência Técnica','Boleto','Outro'],
  '— Deduções das Vendas —': null,
  'Deduções das Vendas':   ['Taxas de Maquininha','Estornos','Descontos','Outro'],
  '— Custos Variáveis —': null,
  'Custos Variáveis Indiretos':['Comissões do Vendedor','Motoboy','Freelancers','Horas Extras de Colaboradores','Outro'],
  '— Despesas SG&A —': null,
  'Despesas com Ocupação': ['Luz','Operadora Celular','Internet','Água','Aluguel / Condomínio / IPTU','Outro'],
  'Despesas com Pessoal':  ['Vales - Transporte & Refeição','13º & Férias','INSS & FGTS','Adiantamento','Folha de Pagamento','Pró-Labore / PLR','Outro'],
  'Despesas Variáveis':    ['Mídia Paga','Tarifas Bancárias','Frete','Garantia','Manutenções / Reparos','Treinamentos','Uber','Deslocamento','Alimentação','Eventos','Outro'],
  'Softwares / Tecnologias':['CRM','Sistema ERP','Outro'],
  'Serviços Terceirizados':['Assessoria Contábil','BPO Terceirização','Emissão de NF-e','Serviços Gerais (Limpeza)','Google Meu Negócio','Assistência Técnica','Assessoria de Marketing','Outro'],
  'Impostos':              ['DAS - Simples Nacional','DAS - MEIs','Outro'],
  '— Não-Operacional —': null,
  'Saídas Não-Operacionais':['Suprimentos','Obras','Despesas Extras','Decorações','Manutenções em Equipamentos','Patrocínio','Momento Recreativo','Perda de Mercadoria','Outro'],
  'Dívidas / Empréstimos': ['Empréstimo Infinity','Empréstimo Itaú','Outro'],
  '— Investimento —': null,
  'Investimentos':         ['Equipamentos','Reformas','Computadores','Veículos','Imóveis','Outro'],
};

export const CATEGORIAS_CMV = {
  'Custos Variáveis Diretos': ['Aparelhos iPhone','Aparelhos Android','iPad','MacBook','Apple Watch','AirPods','Acessórios','Embalagens','Brindes','Assistência Técnica','Outros'],
};

export const CATEGORIAS_TRANSF = {
  'Transferência': ['Entre Contas Próprias','Para Reserva / Caixa','Para Investimento','Para Terceiros','Outros'],
};

// Constantes de classificação financeira — usadas em Dashboard, Relatorio, Financeiro e Layout
export const CMVCATS    = ['Custos Variáveis Diretos'];
export const SGA_CATS   = ['Deduções das Vendas','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados','Impostos'];
export const NAOOP_CATS = ['Dívidas / Empréstimos','Saídas Não-Operacionais'];
export const GASTOS_CATS = [...SGA_CATS, ...NAOOP_CATS, 'Investimentos'];

export function getCatsPorTipo(tipo) {
  if (tipo === 'Entrada') return CATEGORIAS_ENTRADA;
  if (tipo === 'Transferência') return CATEGORIAS_TRANSF;
  return CATEGORIAS_SAIDA;
}

export function getSubcats(cat) {
  const todas = [CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, CATEGORIAS_TRANSF, CATEGORIAS_CMV];
  for (const grupo of todas) {
    if (grupo[cat] && grupo[cat] !== null) return grupo[cat];
  }
  return [];
}
