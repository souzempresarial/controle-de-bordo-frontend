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

export const CATEGORIAS_CMV = {
  'Custos Variáveis Diretos': ['Aparelhos iPhone','Aparelhos Android','Acessórios','Embalagens','Brindes','Assistência Técnica','Outros'],
};

export const CATEGORIAS_TRANSF = {
  'Transferência': ['Entre Contas Próprias','Para Reserva / Caixa','Para Investimento','Para Terceiros','Outros'],
};

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
