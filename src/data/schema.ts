// Definição única de todas as entidades. Alimenta formulários, tabelas,
// importação (mapeamento de colunas), modelos de planilha e validação.

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'time' | 'select' | 'bool'

export interface Field {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  /** Sinônimos usados para reconhecer colunas em planilhas importadas */
  aliases?: string[]
  /** Campo pessoal/sensível (mascarado nas listagens) */
  sensitive?: boolean
}

export interface EntityDef {
  key: EntityKey
  label: string
  fields: Field[]
  /** Campos que formam a chave natural para detectar duplicatas */
  dedupe: string[]
}

export type EntityKey =
  | 'units' | 'products' | 'ingredients' | 'recipes' | 'sales' | 'expenses' | 'payables' | 'receivables'
  | 'cashEntries' | 'bankStatement' | 'stockMoves' | 'counts' | 'lots' | 'suppliers' | 'supplierPrices'
  | 'purchases' | 'purchaseOrders' | 'deliveries' | 'orders' | 'fees' | 'employees' | 'shifts' | 'payroll'
  | 'equipment' | 'maintenance' | 'checklists' | 'checklistRuns' | 'documents' | 'customers' | 'loyaltyTx'
  | 'feedback' | 'goals' | 'promotions' | 'combos' | 'priceHistory'

const unit: Field = { key: 'unit', label: 'Unidade', type: 'text', aliases: ['loja', 'filial', 'unidade', 'restaurante'] }
const UNITS_MEASURE = ['kg', 'g', 'l', 'ml', 'un']
const CHANNELS = ['salao', 'retirada', 'delivery_proprio', 'ifood', 'outra_plataforma']

export const ENTITIES: Record<EntityKey, EntityDef> = {
  units: { key: 'units', label: 'Unidades', dedupe: ['code'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'unidade', 'loja'] },
    { key: 'code', label: 'Código', type: 'text', required: true, aliases: ['codigo', 'id', 'sigla'] },
    { key: 'city', label: 'Cidade', type: 'text', aliases: ['cidade'] },
    { key: 'seats', label: 'Lugares', type: 'number', aliases: ['lugares', 'mesas', 'assentos'] },
  ] },
  products: { key: 'products', label: 'Produtos', dedupe: ['name'], fields: [
    { key: 'name', label: 'Produto', type: 'text', required: true, aliases: ['produto', 'item', 'nome', 'prato', 'descricao'] },
    { key: 'category', label: 'Categoria', type: 'text', aliases: ['categoria', 'grupo', 'secao'] },
    { key: 'price', label: 'Preço de venda', type: 'money', required: true, aliases: ['preco', 'valor', 'preco venda', 'pv'] },
    { key: 'active', label: 'Ativo', type: 'bool', aliases: ['ativo', 'disponivel'] },
    { key: 'description', label: 'Descrição', type: 'text', aliases: ['descricao', 'detalhes'] },
    { key: 'photoUrl', label: 'URL da foto', type: 'text', aliases: ['foto', 'imagem'] },
    { key: 'published', label: 'No cardápio digital', type: 'bool', aliases: ['publicado'] },
  ] },
  ingredients: { key: 'ingredients', label: 'Ingredientes', dedupe: ['name'], fields: [
    { key: 'name', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'insumo', 'materia prima', 'nome'] },
    { key: 'measure', label: 'Unidade de medida', type: 'select', options: UNITS_MEASURE, required: true, aliases: ['unidade medida', 'un', 'medida', 'unidade'] },
    { key: 'cost', label: 'Custo por unidade', type: 'money', required: true, aliases: ['custo', 'preco', 'custo unitario', 'valor'] },
    { key: 'minStock', label: 'Estoque mínimo', type: 'number', aliases: ['minimo', 'estoque minimo'] },
    { key: 'leadDays', label: 'Prazo de entrega (dias)', type: 'number', aliases: ['prazo', 'lead time'] },
    { key: 'barcode', label: 'Código de barras', type: 'text', aliases: ['ean', 'codigo barras', 'gtin'] },
    { key: 'supplier', label: 'Fornecedor principal', type: 'text', aliases: ['fornecedor'] },
  ] },
  recipes: { key: 'recipes', label: 'Fichas técnicas', dedupe: ['product', 'ingredient'], fields: [
    { key: 'product', label: 'Prato', type: 'text', required: true, aliases: ['prato', 'produto', 'receita'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'insumo'] },
    { key: 'qty', label: 'Quantidade', type: 'number', required: true, aliases: ['quantidade', 'qtd', 'qtde'] },
    { key: 'measure', label: 'Unidade', type: 'select', options: UNITS_MEASURE, required: true, aliases: ['unidade', 'un', 'medida'] },
    { key: 'yield', label: 'Rendimento (porções)', type: 'number', aliases: ['rendimento', 'porcoes'] },
    { key: 'lossPct', label: 'Perda de preparo (%)', type: 'number', aliases: ['perda', 'quebra', 'fc'] },
  ] },
  sales: { key: 'sales', label: 'Vendas', dedupe: ['orderId', 'product', 'date', 'time', 'qty', 'unitPrice'], fields: [
    { key: 'orderId', label: 'Nº pedido', type: 'text', aliases: ['pedido', 'comanda', 'numero pedido', 'id pedido', 'cupom', 'venda'] },
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data', 'data venda', 'dia'] },
    { key: 'time', label: 'Hora', type: 'time', aliases: ['hora', 'horario'] },
    { key: 'product', label: 'Produto', type: 'text', required: true, aliases: ['produto', 'item', 'prato', 'descricao'] },
    { key: 'qty', label: 'Quantidade', type: 'number', required: true, aliases: ['quantidade', 'qtd', 'qtde'] },
    { key: 'unitPrice', label: 'Preço unitário', type: 'money', required: true, aliases: ['preco', 'valor unitario', 'preco unitario', 'valor'] },
    { key: 'discount', label: 'Desconto', type: 'money', aliases: ['desconto'] },
    { key: 'channel', label: 'Canal', type: 'select', options: CHANNELS, aliases: ['canal', 'origem', 'tipo'] },
    { key: 'status', label: 'Status', type: 'select', options: ['concluida', 'cancelada', 'devolvida'], aliases: ['status', 'situacao'] },
    { key: 'payment', label: 'Pagamento', type: 'text', aliases: ['pagamento', 'forma pagamento', 'meio'] },
    { key: 'customer', label: 'Cliente', type: 'text', aliases: ['cliente'] },
    unit,
  ] },
  expenses: { key: 'expenses', label: 'Despesas', dedupe: ['date', 'description', 'amount'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data', 'competencia'] },
    { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'historico'] },
    { key: 'category', label: 'Categoria', type: 'select', options: ['aluguel', 'energia', 'agua', 'gas', 'pessoal', 'marketing', 'manutencao', 'impostos', 'taxas', 'outros'], aliases: ['categoria', 'tipo'] },
    { key: 'amount', label: 'Valor', type: 'money', required: true, aliases: ['valor', 'total'] },
    unit,
  ] },
  payables: { key: 'payables', label: 'Contas a pagar', dedupe: ['description', 'dueDate', 'amount'], fields: [
    { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'conta'] },
    { key: 'supplier', label: 'Fornecedor', type: 'text', aliases: ['fornecedor', 'credor'] },
    { key: 'dueDate', label: 'Vencimento', type: 'date', required: true, aliases: ['vencimento', 'data vencimento'] },
    { key: 'amount', label: 'Valor', type: 'money', required: true, aliases: ['valor'] },
    { key: 'installment', label: 'Parcela', type: 'text', aliases: ['parcela'] },
    { key: 'paidDate', label: 'Data de pagamento', type: 'date', aliases: ['pagamento', 'data pagamento', 'pago em'] },
    unit,
  ] },
  receivables: { key: 'receivables', label: 'Contas a receber', dedupe: ['description', 'dueDate', 'amount'], fields: [
    { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao'] },
    { key: 'source', label: 'Origem', type: 'text', aliases: ['origem', 'adquirente', 'plataforma', 'cliente'] },
    { key: 'dueDate', label: 'Previsão', type: 'date', required: true, aliases: ['previsao', 'vencimento', 'data prevista'] },
    { key: 'amount', label: 'Valor', type: 'money', required: true, aliases: ['valor', 'liquido'] },
    { key: 'receivedDate', label: 'Recebido em', type: 'date', aliases: ['recebido', 'data recebimento'] },
    unit,
  ] },
  cashEntries: { key: 'cashEntries', label: 'Lançamentos de caixa', dedupe: ['date', 'description', 'amount', 'type'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'type', label: 'Tipo', type: 'select', options: ['entrada', 'saida'], required: true, aliases: ['tipo', 'natureza'] },
    { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'historico'] },
    { key: 'amount', label: 'Valor', type: 'money', required: true, aliases: ['valor'] },
    unit,
  ] },
  bankStatement: { key: 'bankStatement', label: 'Extrato bancário', dedupe: ['date', 'description', 'amount'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data', 'data lancamento'] },
    { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'historico', 'lancamento'] },
    { key: 'amount', label: 'Valor (+ crédito / - débito)', type: 'money', required: true, aliases: ['valor'] },
  ] },
  stockMoves: { key: 'stockMoves', label: 'Movimentações de estoque', dedupe: ['date', 'ingredient', 'type', 'qty'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'insumo', 'item'] },
    { key: 'type', label: 'Tipo', type: 'select', options: ['entrada', 'saida', 'ajuste', 'perda'], required: true, aliases: ['tipo', 'movimento'] },
    { key: 'qty', label: 'Quantidade', type: 'number', required: true, aliases: ['quantidade', 'qtd'] },
    { key: 'note', label: 'Observação', type: 'text', aliases: ['obs', 'observacao', 'motivo'] },
    unit,
  ] },
  counts: { key: 'counts', label: 'Contagens físicas', dedupe: ['date', 'ingredient'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'insumo', 'item'] },
    { key: 'qty', label: 'Quantidade contada', type: 'number', required: true, aliases: ['quantidade', 'contagem', 'qtd'] },
    { key: 'countedBy', label: 'Responsável', type: 'text', required: true, aliases: ['responsavel', 'contado por'] },
    unit,
  ] },
  lots: { key: 'lots', label: 'Lotes e validades', dedupe: ['ingredient', 'lot'], fields: [
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'produto', 'item'] },
    { key: 'lot', label: 'Lote', type: 'text', aliases: ['lote'] },
    { key: 'receivedDate', label: 'Recebimento', type: 'date', aliases: ['recebimento', 'entrada'] },
    { key: 'expiry', label: 'Validade', type: 'date', required: true, aliases: ['validade', 'vencimento'] },
    { key: 'qty', label: 'Quantidade', type: 'number', aliases: ['quantidade', 'qtd'] },
    { key: 'location', label: 'Local', type: 'text', aliases: ['local', 'armazenamento'] },
    unit,
  ] },
  suppliers: { key: 'suppliers', label: 'Fornecedores', dedupe: ['name'], fields: [
    { key: 'name', label: 'Fornecedor', type: 'text', required: true, aliases: ['fornecedor', 'nome', 'razao social'] },
    { key: 'contact', label: 'Contato', type: 'text', aliases: ['contato', 'vendedor'] },
    { key: 'phone', label: 'Telefone', type: 'text', aliases: ['telefone', 'whatsapp', 'celular'] },
    { key: 'email', label: 'E-mail', type: 'text', aliases: ['email', 'e-mail'] },
    { key: 'terms', label: 'Condições', type: 'text', aliases: ['condicoes', 'pagamento', 'prazo pagamento'] },
    { key: 'minOrder', label: 'Pedido mínimo', type: 'money', aliases: ['pedido minimo', 'minimo'] },
    { key: 'freight', label: 'Frete', type: 'money', aliases: ['frete'] },
    { key: 'leadDays', label: 'Prazo de entrega (dias)', type: 'number', aliases: ['prazo', 'prazo entrega'] },
  ] },
  supplierPrices: { key: 'supplierPrices', label: 'Preços de fornecedores', dedupe: ['supplier', 'ingredient', 'date'], fields: [
    { key: 'supplier', label: 'Fornecedor', type: 'text', required: true, aliases: ['fornecedor'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'produto', 'item'] },
    { key: 'price', label: 'Preço', type: 'money', required: true, aliases: ['preco', 'valor'] },
    { key: 'date', label: 'Data da cotação', type: 'date', required: true, aliases: ['data'] },
  ] },
  purchases: { key: 'purchases', label: 'Compras', dedupe: ['date', 'supplier', 'ingredient', 'qty'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data', 'emissao'] },
    { key: 'supplier', label: 'Fornecedor', type: 'text', required: true, aliases: ['fornecedor'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'produto', 'item'] },
    { key: 'qty', label: 'Quantidade', type: 'number', required: true, aliases: ['quantidade', 'qtd'] },
    { key: 'unitCost', label: 'Custo unitário', type: 'money', required: true, aliases: ['custo', 'preco', 'valor unitario'] },
    unit,
  ] },
  purchaseOrders: { key: 'purchaseOrders', label: 'Pedidos de compra', dedupe: ['created', 'supplier', 'ingredient'], fields: [
    { key: 'created', label: 'Criado em', type: 'date', required: true },
    { key: 'supplier', label: 'Fornecedor', type: 'text' },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true },
    { key: 'qty', label: 'Quantidade', type: 'number', required: true },
    { key: 'estCost', label: 'Custo estimado', type: 'money' },
    { key: 'expectedDate', label: 'Entrega prevista', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['rascunho', 'aprovado', 'enviado', 'cancelado'], required: true },
    { key: 'origin', label: 'Origem', type: 'text' },
  ] },
  deliveries: { key: 'deliveries', label: 'Entregas', dedupe: ['supplier', 'ingredient', 'expectedDate'], fields: [
    { key: 'supplier', label: 'Fornecedor', type: 'text', required: true, aliases: ['fornecedor'] },
    { key: 'ingredient', label: 'Ingrediente', type: 'text', required: true, aliases: ['ingrediente', 'item'] },
    { key: 'expectedDate', label: 'Data prevista', type: 'date', required: true, aliases: ['previsao', 'data prevista'] },
    { key: 'receivedDate', label: 'Data recebida', type: 'date', aliases: ['recebido', 'data recebimento'] },
    { key: 'expectedQty', label: 'Qtd esperada', type: 'number', required: true, aliases: ['esperado', 'qtd pedida'] },
    { key: 'receivedQty', label: 'Qtd recebida', type: 'number', aliases: ['recebida', 'qtd recebida'] },
    { key: 'receivedBy', label: 'Conferido por', type: 'text' },
  ] },
  orders: { key: 'orders', label: 'Pedidos (central)', dedupe: ['code'], fields: [
    { key: 'code', label: 'Código', type: 'text', required: true, aliases: ['pedido', 'codigo'] },
    { key: 'customer', label: 'Cliente', type: 'text', aliases: ['cliente'] },
    { key: 'items', label: 'Itens', type: 'text', required: true, aliases: ['itens', 'produtos'] },
    { key: 'total', label: 'Total', type: 'money', required: true, aliases: ['total', 'valor'] },
    { key: 'channel', label: 'Canal', type: 'select', options: CHANNELS, aliases: ['canal'] },
    { key: 'status', label: 'Status', type: 'select', options: ['novo', 'preparo', 'pronto', 'entregue', 'cancelado'], required: true, aliases: ['status'] },
    { key: 'createdAt', label: 'Recebido em', type: 'text', aliases: ['criado', 'recebido'] },
    { key: 'startedAt', label: 'Início preparo', type: 'text', aliases: ['inicio preparo'] },
    { key: 'readyAt', label: 'Pronto em', type: 'text', aliases: ['pronto', 'fim preparo'] },
    unit,
  ] },
  fees: { key: 'fees', label: 'Taxas por canal', dedupe: ['channel'], fields: [
    { key: 'channel', label: 'Canal / meio', type: 'text', required: true, aliases: ['canal', 'plataforma', 'meio'] },
    { key: 'feePct', label: 'Comissão (%)', type: 'number', required: true, aliases: ['comissao', 'taxa', 'percentual'] },
    { key: 'fixedFee', label: 'Taxa fixa por pedido', type: 'money', aliases: ['taxa fixa'] },
  ] },
  employees: { key: 'employees', label: 'Funcionários', dedupe: ['name'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'funcionario', 'colaborador'] },
    { key: 'role', label: 'Função', type: 'text', required: true, aliases: ['funcao', 'cargo'] },
    { key: 'phone', label: 'Telefone', type: 'text', sensitive: true, aliases: ['telefone', 'celular'] },
    { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'ferias', 'afastado', 'desligado'], aliases: ['status', 'situacao'] },
    { key: 'admission', label: 'Admissão', type: 'date', aliases: ['admissao', 'data admissao'] },
    unit,
  ] },
  shifts: { key: 'shifts', label: 'Escalas', dedupe: ['employee', 'date', 'start'], fields: [
    { key: 'employee', label: 'Funcionário', type: 'text', required: true, aliases: ['funcionario', 'nome', 'colaborador'] },
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'start', label: 'Início', type: 'time', required: true, aliases: ['inicio', 'entrada'] },
    { key: 'end', label: 'Fim', type: 'time', required: true, aliases: ['fim', 'saida'] },
    { key: 'role', label: 'Função no turno', type: 'text', aliases: ['funcao', 'posto'] },
    unit,
  ] },
  payroll: { key: 'payroll', label: 'Custos de pessoal', dedupe: ['month', 'employee', 'type'], fields: [
    { key: 'month', label: 'Competência (AAAA-MM)', type: 'text', required: true, aliases: ['competencia', 'mes'] },
    { key: 'employee', label: 'Funcionário ou função', type: 'text', required: true, aliases: ['funcionario', 'nome', 'funcao'] },
    { key: 'type', label: 'Tipo', type: 'select', options: ['salario', 'encargos', 'beneficios', 'extras', 'outros'], aliases: ['tipo', 'verba'] },
    { key: 'amount', label: 'Valor', type: 'money', required: true, aliases: ['valor'] },
    unit,
  ] },
  equipment: { key: 'equipment', label: 'Equipamentos', dedupe: ['name'], fields: [
    { key: 'name', label: 'Equipamento', type: 'text', required: true, aliases: ['equipamento', 'nome'] },
    { key: 'location', label: 'Local', type: 'text', aliases: ['local', 'setor'] },
    { key: 'intervalDays', label: 'Intervalo de revisão (dias)', type: 'number', aliases: ['intervalo', 'periodicidade'] },
    { key: 'lastMaintenance', label: 'Última manutenção registrada', type: 'date', aliases: ['ultima manutencao'] },
    unit,
  ] },
  maintenance: { key: 'maintenance', label: 'Manutenções', dedupe: ['equipment', 'date'], fields: [
    { key: 'equipment', label: 'Equipamento', type: 'text', required: true, aliases: ['equipamento'] },
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'description', label: 'Serviço', type: 'text', required: true, aliases: ['servico', 'descricao'] },
    { key: 'cost', label: 'Custo', type: 'money', aliases: ['custo', 'valor'] },
    { key: 'doneBy', label: 'Executado por', type: 'text', required: true, aliases: ['tecnico', 'responsavel'] },
    { key: 'evidence', label: 'Evidência (nº OS, nota)', type: 'text', required: true, aliases: ['os', 'nota', 'evidencia'] },
  ] },
  checklists: { key: 'checklists', label: 'Checklists', dedupe: ['name'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'type', label: 'Tipo', type: 'select', options: ['abertura', 'fechamento', 'limpeza', 'higiene', 'equipamentos', 'seguranca', 'outro'], required: true },
    { key: 'items', label: 'Itens (separados por ;)', type: 'text', required: true },
  ] },
  checklistRuns: { key: 'checklistRuns', label: 'Execuções de checklist', dedupe: ['checklist', 'date', 'item'], fields: [
    { key: 'checklist', label: 'Checklist', type: 'text', required: true },
    { key: 'date', label: 'Data', type: 'date', required: true },
    { key: 'item', label: 'Item', type: 'text', required: true },
    { key: 'responsible', label: 'Responsável', type: 'text', required: true },
    { key: 'at', label: 'Confirmado em', type: 'text' },
  ] },
  documents: { key: 'documents', label: 'Documentos', dedupe: ['name'], fields: [
    { key: 'name', label: 'Documento', type: 'text', required: true, aliases: ['documento', 'nome'] },
    { key: 'type', label: 'Tipo', type: 'select', options: ['licenca', 'alvara', 'certificado', 'contrato', 'operacional', 'outro'], aliases: ['tipo'] },
    { key: 'issueDate', label: 'Emissão', type: 'date', aliases: ['emissao'] },
    { key: 'expiry', label: 'Vencimento', type: 'date', aliases: ['vencimento', 'validade'] },
    { key: 'confirmed', label: 'Datas confirmadas', type: 'bool' },
    { key: 'notes', label: 'Observações', type: 'text', aliases: ['obs'] },
    unit,
  ] },
  customers: { key: 'customers', label: 'Clientes', dedupe: ['name', 'phone'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'cliente'] },
    { key: 'phone', label: 'Telefone', type: 'text', sensitive: true, aliases: ['telefone', 'celular', 'whatsapp'] },
    { key: 'email', label: 'E-mail', type: 'text', sensitive: true, aliases: ['email'] },
    { key: 'consent', label: 'Consentimento LGPD', type: 'bool', aliases: ['consentimento', 'aceite'] },
    { key: 'createdAt', label: 'Cadastro', type: 'date', aliases: ['cadastro', 'data cadastro'] },
  ] },
  loyaltyTx: { key: 'loyaltyTx', label: 'Pontos de fidelidade', dedupe: ['customer', 'date', 'points', 'reason'], fields: [
    { key: 'customer', label: 'Cliente', type: 'text', required: true },
    { key: 'date', label: 'Data', type: 'date', required: true },
    { key: 'points', label: 'Pontos (+ ganho / - resgate)', type: 'number', required: true },
    { key: 'reason', label: 'Motivo', type: 'text' },
  ] },
  feedback: { key: 'feedback', label: 'Feedbacks', dedupe: ['date', 'customer', 'text'], fields: [
    { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data'] },
    { key: 'customer', label: 'Cliente', type: 'text', aliases: ['cliente', 'autor'] },
    { key: 'rating', label: 'Nota (1-5)', type: 'number', aliases: ['nota', 'estrelas', 'avaliacao'] },
    { key: 'type', label: 'Tipo', type: 'select', options: ['elogio', 'sugestao', 'reclamacao'], aliases: ['tipo'] },
    { key: 'text', label: 'Comentário', type: 'text', required: true, aliases: ['comentario', 'texto', 'mensagem'] },
    { key: 'status', label: 'Status', type: 'select', options: ['aberto', 'em_andamento', 'resolvido'] },
    unit,
  ] },
  goals: { key: 'goals', label: 'Metas', dedupe: ['month', 'unit'], fields: [
    { key: 'month', label: 'Mês (AAAA-MM)', type: 'text', required: true },
    { key: 'target', label: 'Meta de faturamento', type: 'money', required: true },
    unit,
  ] },
  promotions: { key: 'promotions', label: 'Promoções', dedupe: ['name'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'product', label: 'Produto', type: 'text', required: true },
    { key: 'discountPct', label: 'Desconto (%)', type: 'number', required: true },
    { key: 'start', label: 'Início', type: 'date', required: true },
    { key: 'end', label: 'Fim', type: 'date', required: true },
  ] },
  combos: { key: 'combos', label: 'Combos', dedupe: ['name'], fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true },
    { key: 'items', label: 'Produtos (separados por ;)', type: 'text', required: true },
    { key: 'price', label: 'Preço do combo', type: 'money', required: true },
  ] },
  priceHistory: { key: 'priceHistory', label: 'Histórico de preços', dedupe: ['kind', 'item', 'date', 'value'], fields: [
    { key: 'kind', label: 'Tipo', type: 'select', options: ['venda', 'custo'], required: true },
    { key: 'item', label: 'Item', type: 'text', required: true },
    { key: 'date', label: 'Data', type: 'date', required: true },
    { key: 'value', label: 'Valor', type: 'money', required: true },
  ] },
}

export const ENTITY_LIST = Object.values(ENTITIES)
