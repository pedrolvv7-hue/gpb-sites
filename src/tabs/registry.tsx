import { ComponentType } from 'react'
import { useLocation } from 'react-router-dom'
import type { EntityKey } from '../data/schema'
import * as C from './central'
import * as V from './vendas'
import * as F from './financeiro'
import * as M from './cardapio'
import * as E from './estoque'
import * as P from './compras'
import * as O from './operacao'
import * as A from './admin'

export interface TourStep { target: string; title: string; text: string }
export interface TabDef {
  id: string
  num: number | null
  name: string
  route: string
  category: string
  summary: string
  component: ComponentType
  uses: EntityKey[]
  tour: TourStep[]
}

export const CATEGORIES = [
  'Central e Inteligência', 'Vendas e Faturamento', 'Financeiro e Resultados', 'Cardápio e Precificação', 'Estoque e Ingredientes',
  'Compras e Fornecedores', 'Delivery e Pedidos', 'Funcionários e Operação', 'Clientes e Crescimento', 'Administração',
]

// Textos padrão dos passos do tour. Um passo só aparece se o elemento existir na tela.
const STEP: Record<string, [string, string]> = {
  title: ['O que é esta aba', 'Aqui estão o nome, a categoria e o resumo do que a aba faz.'],
  updated: ['Atualização dos dados', 'Mostra de quantos registros os números vêm e quando foi a última importação.'],
  period: ['Período', 'Escolha as datas analisadas ou use os atalhos de 7, 30 e 90 dias.'],
  kpi: ['Indicadores', 'Cartões com os principais números. O ícone de interrogação explica cada cálculo.'],
  chart: ['Gráfico', 'Passe o mouse ou toque nas barras e linhas para ver os valores.'],
  filter: ['Filtros', 'Restringem o que é exibido. Não apagam dados.'],
  search: ['Pesquisa', 'Digite qualquer parte de um nome, data ou valor para encontrar registros.'],
  table: ['Tabela', 'Clique no título de uma coluna para ordenar.'],
  export: ['Exportar', 'Baixa exatamente o que está filtrado em CSV, que abre no Excel.'],
  add: ['Adicionar', 'Cria um registro manualmente.'],
  import: ['Importar planilha', 'Abre a Importação Inteligente já com o tipo certo selecionado.'],
  template: ['Modelo', 'Baixa uma planilha vazia com as colunas esperadas.'],
  form: ['Formulário', 'Preencha os campos. Os marcados com * são obrigatórios.'],
  empty: ['Sem dados', 'Esta aba precisa de dados. O botão indica onde obtê-los.'],
  learn: ['Aprender', 'Reinicie este tour quando quiser. O tutorial completo explica tudo em detalhes.'],
}
const tour = (...targets: (string | [string, string, string])[]): TourStep[] =>
  ['title', 'updated', ...targets, 'learn'].map((t) => (Array.isArray(t) ? { target: t[0], title: t[1], text: t[2] } : { target: t, title: STEP[t][0], text: STEP[t][1] }))

const TABLE = ['search', 'filter', 'table', 'export'] as const
const CRUD = ['add', 'import', 'template', ...TABLE] as const

type Raw = [string, string, string, string, ComponentType, EntityKey[], TourStep[]]
const RAW: Raw[] = [
  // Central e Inteligência
  ['visao-geral', 'Visão Geral', '/', 'Painel executivo com faturamento, pedidos, ticket, custos, margem, resultado estimado, estoque e alertas.', C.VisaoGeral, ['sales', 'expenses', 'recipes', 'ingredients', 'payroll'], tour('period', 'kpi', 'chart', ['alerts', 'Alertas', 'Os alertas mais recentes. Clique para ir à aba relacionada.'], 'empty')],
  ['restaubrain', 'RestauBrain AI', '/restaubrain', 'Pergunte sobre o restaurante e receba respostas calculadas a partir dos seus registros, com as fontes.', C.RestauBrain, [], tour(['ask', 'Pergunta', 'Escreva a pergunta em linguagem comum.'], ['suggestions', 'Sugestões', 'Perguntas prontas que o RestauBrain sabe responder.'], ['answer', 'Resposta', 'Resposta com os números e as fontes usadas.'])],
  ['morningbrain', 'MorningBrain', '/morningbrain', 'Resumo do que mudou desde o último acesso: importações, vendas novas, variações, alertas e dados desatualizados.', C.MorningBrain, [], tour('kpi', ['alerts', 'Prioridades', 'Problemas que pedem atenção.'], ['freshness', 'Atualização', 'Data do registro mais recente de cada fonte.'], ['recs', 'Recomendações', 'O que verificar ou completar.'])],
  ['alertas', 'Central de Alertas', '/alertas', 'Todos os alertas gerados a partir dos dados, com filtro, evidência e registro de resolução.', C.Alertas, [], tour('filter', 'search', 'table', ['resolve', 'Resolver', 'Marque como resolvido e anote o que foi feito.'], 'export', 'empty')],
  ['anomalias', 'Detector de Anomalias', '/anomalias', 'Identifica dias de faturamento e meses de despesa estatisticamente fora do padrão, com evidências.', C.Anomalias, ['sales', 'expenses'], tour('filter', 'chart', 'table', 'empty')],
  ['saude', 'Saúde do Negócio', '/saude', 'Pontuação explicável que combina vendas, margens, despesas, estoque, pagamentos e qualidade dos dados.', C.Saude, ['sales', 'expenses', 'recipes', 'payables', 'counts'], tour('kpi', 'table')],
  ['relatorios', 'Relatórios Inteligentes', '/relatorios', 'Relatório gerencial com indicadores, gráfico, comparação, alertas, recomendações e dados faltantes, em PDF ou CSV.', C.Relatorios, ['sales', 'expenses'], tour('period', ['report', 'Relatório', 'Prévia do relatório.'], ['pdf', 'PDF', 'Abre a impressão: escolha "Salvar como PDF".'], 'export')],
  // Vendas
  ['faturamento', 'Faturamento', '/faturamento', 'Faturamento diário, semanal, mensal e anual.', V.Faturamento, ['sales'], tour('period', 'kpi', 'filter', 'chart', 'table', 'export', 'empty')],
  ['historico-vendas', 'Histórico de Vendas', '/historico-vendas', 'Todas as vendas com pesquisa e filtros por canal, status e unidade.', V.HistoricoVendas, ['sales'], tour(...CRUD, 'form', 'empty')],
  ['mais-vendidos', 'Produtos Mais Vendidos', '/mais-vendidos', 'Ranking por quantidade, receita e participação.', V.MaisVendidos, ['sales', 'products'], tour('period', 'filter', 'chart', 'table', 'export', 'empty')],
  ['menos-vendidos', 'Produtos Menos Vendidos', '/menos-vendidos', 'Produtos com baixa procura, inclusive sem vendas, e data da última venda.', V.MenosVendidos, ['sales', 'products'], tour('period', 'filter', 'chart', 'table', 'export', 'empty')],
  ['horarios-pico', 'Horários de Pico', '/horarios-pico', 'Faturamento e pedidos por hora, quando as vendas têm horário.', V.HorariosPico, ['sales'], tour('period', 'chart', 'table', 'empty')],
  ['dias-movimentados', 'Dias Mais Movimentados', '/dias-movimentados', 'Média de faturamento por dia da semana.', V.DiasMovimentados, ['sales'], tour('period', 'chart', 'table', 'empty')],
  ['ticket-medio', 'Ticket Médio', '/ticket-medio', 'Ticket médio geral, por canal e por unidade.', V.TicketMedio, ['sales'], tour('period', 'kpi', 'table', 'empty')],
  ['comparacao-periodos', 'Comparação de Períodos', '/comparacao-periodos', 'Compara vendas, pedidos, itens, ticket e descontos entre dois períodos.', V.ComparacaoPeriodos, ['sales'], tour('period', 'table', 'export', 'empty')],
  ['metas', 'Metas de Vendas', '/metas', 'Metas mensais por unidade com acompanhamento automático e projeção.', V.Metas, ['goals', 'sales'], tour('kpi', ...CRUD)],
  ['previsao-vendas', 'Previsão de Vendas', '/previsao-vendas', 'Projeção estatística com tendência, padrão semanal e intervalo de incerteza.', V.PrevisaoVendas, ['sales'], tour('filter', 'kpi', 'chart', 'table', 'empty')],
  // Financeiro
  ['lucro-prato', 'Lucro por Prato', '/lucro-prato', 'Custo, contribuição e margem de cada produto, a partir de vendas e fichas técnicas.', F.LucroPrato, ['sales', 'recipes', 'ingredients'], tour('period', ...TABLE, 'empty')],
  ['margem-bruta', 'Margem Bruta', '/margem-bruta', 'Receita líquida menos CMV, com a cobertura das fichas técnicas.', F.MargemBruta, ['sales', 'recipes', 'ingredients'], tour('period', 'kpi')],
  ['resultado-operacional', 'Resultado Operacional', '/resultado-operacional', 'Demonstrativo estimado: receitas, CMV, despesas, pessoal, taxas e resultado.', F.ResultadoOperacional, ['sales', 'expenses', 'payroll', 'fees'], tour('period', 'table')],
  ['despesas', 'Controle de Despesas', '/despesas', 'Cadastro, importação, classificação e consulta de despesas.', F.ControleDespesas, ['expenses'], tour(...CRUD, 'form', 'empty')],
  ['despesas-categoria', 'Despesas por Categoria', '/despesas-categoria', 'Gastos agrupados por categoria e comparados com o período anterior.', F.DespesasCategoria, ['expenses'], tour('period', 'chart', 'table', 'export', 'empty')],
  ['fluxo-caixa', 'Fluxo de Caixa', '/fluxo-caixa', 'Entradas e saídas efetivas por data, com saldo acumulado e projeção.', F.FluxoCaixa, ['payables', 'receivables', 'cashEntries'], tour('period', 'kpi', 'chart', ...CRUD)],
  ['contas-pagar', 'Contas a Pagar', '/contas-pagar', 'Contas, vencimentos, parcelas e registro de pagamentos.', F.ContasPagar, ['payables'], tour('kpi', ...CRUD, ['pay', 'Registrar pagamento', 'Anota a data de um pagamento já feito.'], 'form')],
  ['contas-receber', 'Contas a Receber', '/contas-receber', 'Recebíveis e pendências.', F.ContasReceber, ['receivables'], tour('kpi', ...CRUD, 'form')],
  ['conciliacao', 'Conciliação Financeira', '/conciliacao', 'Cruza extrato bancário com recebimentos, pagamentos e caixa, destacando divergências.', F.Conciliacao, ['bankStatement', 'payables', 'receivables', 'cashEntries'], tour('kpi', ...TABLE, 'add', 'import', 'empty')],
  ['simulador-precos', 'Simulador de Preços', '/simulador-precos', 'Simula preço, custo, margem e volume sem alterar dados reais.', F.SimuladorPrecos, ['products', 'recipes'], tour('form', 'kpi', 'empty')],
  ['calculadora', 'Calculadora Profissional', '/calculadora', 'Calculadora comum e calculadora de restaurante: CMV, margem, markup, porção, desconto, combo e ponto de equilíbrio.', F.Calculadora, [], tour('filter', 'form')],
  // Cardápio
  ['engenharia-cardapio', 'Engenharia de Cardápio', '/engenharia-cardapio', 'Matriz popularidade x margem que indica pratos a analisar.', M.EngenhariaCardapio, ['sales', 'recipes'], tour('period', 'chart', ...TABLE, 'empty')],
  ['fichas-tecnicas', 'Fichas Técnicas', '/fichas-tecnicas', 'Ingredientes, quantidades, rendimento, perdas e custo por porção de cada prato.', M.FichasTecnicas, ['recipes', 'products', 'ingredients'], tour(['list', 'Receitas', 'Clique para ver o detalhamento de custos.'], ...CRUD, 'form', 'empty')],
  ['custo-receitas', 'Custo de Receitas', '/custo-receitas', 'Custos das receitas recalculados automaticamente quando os ingredientes mudam.', M.CustoReceitas, ['ingredients', 'recipes'], tour(...CRUD, 'form')],
  ['combos', 'Criador de Combos', '/combos', 'Combina produtos e calcula custo, desconto e margem estimada.', M.CriadorCombos, ['combos', 'products', 'recipes'], tour(...CRUD, 'form', 'empty')],
  ['promocoes', 'Promoções Inteligentes', '/promocoes', 'Analisa promoções anteriores e simula novas sem alterar preços.', M.Promocoes, ['promotions', 'sales'], tour('table', 'form', 'kpi', 'add')],
  ['analise-precos', 'Análise de Preços', '/analise-precos', 'Evolução dos preços de venda e dos custos, com variação.', M.AnalisePrecos, ['products', 'ingredients'], tour(...TABLE, 'chart', 'empty')],
  ['cardapio-digital', 'Cardápio Digital', '/cardapio-digital', 'Cardápio público opcional sincronizado com os produtos.', M.CardapioDigital, ['products'], tour('form', 'table', ['preview', 'Visualizar', 'Abre o cardápio como o cliente verá.'])],
  // Estoque
  ['estoque', 'Estoque Geral', '/estoque', 'Estoque teórico por ingrediente, contagens, entradas, saídas, perdas e valor.', E.EstoqueGeral, ['ingredients', 'stockMoves', 'counts', 'purchases', 'sales', 'recipes'], tour('kpi', ...CRUD, 'empty')],
  ['estoque-minimo', 'Estoque Mínimo', '/estoque-minimo', 'Limites por ingrediente e situação atual.', E.EstoqueMinimo, ['ingredients'], tour('table', 'search', 'export')],
  ['previsao-reposicao', 'Previsão de Reposição', '/previsao-reposicao', 'Consumo médio diário e dias de estoque restantes.', E.PrevisaoReposicao, ['ingredients', 'sales', 'recipes'], tour('chart', 'table', 'export')],
  ['validades', 'Controle de Validades', '/validades', 'Lotes, recebimento, validade, quantidade e local.', E.Validades, ['lots'], tour('kpi', ...CRUD, 'form')],
  ['desperdicio', 'Detector de Desperdício', '/desperdicio', 'Compara estoque esperado e contagem física entre contagens consecutivas.', E.Desperdicio, ['counts', 'purchases', 'stockMoves', 'sales'], tour('kpi', 'table', 'export', 'empty')],
  ['consumo-ingredientes', 'Consumo de Ingredientes', '/consumo-ingredientes', 'Ingredientes consumidos teoricamente pelas vendas, comparados com as compras.', E.ConsumoIngredientes, ['sales', 'recipes', 'purchases'], tour('period', 'chart', 'table')],
  ['inventario', 'Inventário', '/inventario', 'Contagem física pelo celular, com pesquisa, código de barras e histórico.', E.Inventario, ['counts'], tour('form', ['save', 'Registrar', 'Salva somente os itens que você preencheu.'], 'table')],
  ['lista-compras', 'Lista de Compras', '/lista-compras', 'Sugestões de reposição com aprovação para gerar pedidos.', E.ListaCompras, ['ingredients', 'purchaseOrders'], tour('table', ['approve', 'Aprovar', 'Gera rascunhos de pedido de compra.'], 'empty')],
  // Compras
  ['fornecedores', 'Fornecedores', '/fornecedores', 'Fornecedores, contatos, condições e tabela de preços.', P.Fornecedores, ['suppliers', 'supplierPrices'], tour(...CRUD, 'form')],
  ['comparador-fornecedores', 'Comparador de Fornecedores', '/comparador-fornecedores', 'Compara preço, frete, prazo, mínimo e histórico por ingrediente.', P.ComparadorFornecedores, ['supplierPrices', 'suppliers'], tour('filter', 'table', 'export', 'empty')],
  ['historico-compras', 'Histórico de Compras', '/historico-compras', 'Compras por fornecedor, produto, unidade e período.', P.HistoricoCompras, ['purchases'], tour('period', 'kpi', 'chart', ...CRUD)],
  ['pedidos-compra', 'Pedidos de Compra', '/pedidos-compra', 'Rascunhos, aprovação, envio e cancelamento de pedidos.', P.PedidosCompra, ['purchaseOrders'], tour('kpi', ...CRUD, ['approve', 'Aprovar', 'Registra sua aprovação. Não envia nem paga.'])],
  ['entregas', 'Entregas e Recebimentos', '/entregas', 'Datas e quantidades previstas x recebidas, divergências e status.', P.Entregas, ['deliveries'], tour('kpi', ...CRUD, ['receive', 'Registrar recebimento', 'Informe quantidade conferida e quem conferiu.'])],
  // Delivery
  ['delivery', 'Delivery Analytics', '/delivery', 'Pedidos, faturamento e descontos dos canais de delivery.', P.DeliveryAnalytics, ['sales'], tour('period', 'kpi', 'chart', 'table', 'empty')],
  ['taxas', 'Taxas e Comissões', '/taxas', 'Taxas de plataformas e meios de pagamento conforme os percentuais cadastrados.', P.TaxasComissoes, ['fees', 'sales'], tour('period', 'kpi', 'table', 'add')],
  ['canais', 'Comparador de Canais', '/canais', 'Salão, retirada, delivery próprio e plataformas lado a lado.', P.ComparadorCanais, ['sales', 'fees'], tour('period', 'chart', 'table', 'export')],
  ['pedidos', 'Central de Pedidos', '/pedidos', 'Recebe e acompanha pedidos criados no sistema, em quadro por status.', P.CentralPedidos, ['orders'], tour('form', ['board', 'Quadro', 'Avance o pedido de coluna conforme o andamento.'])],
  ['tempo-preparo', 'Tempo de Preparo', '/tempo-preparo', 'Duração entre os eventos registrados de cada pedido.', P.TempoPreparo, ['orders'], tour('kpi', 'table', 'empty')],
  // Operação
  ['funcionarios', 'Funcionários', '/funcionarios', 'Cadastro, função, unidade, contato protegido e status.', O.Funcionarios, ['employees'], tour('kpi', ...CRUD, 'form')],
  ['escalas', 'Escalas e Turnos', '/escalas', 'Calendário semanal, escalas recorrentes, edição e alertas de conflito.', O.Escalas, ['shifts', 'employees'], tour('table', 'form', 'add', 'import')],
  ['custos-pessoal', 'Custos de Pessoal', '/custos-pessoal', 'Custos de folha por mês e em relação ao faturamento.', O.CustosPessoal, ['payroll'], tour('chart', ...CRUD)],
  ['produtividade', 'Produtividade Operacional', '/produtividade', 'Faturamento e itens por turno e por hora escalada.', O.Produtividade, ['sales', 'shifts'], tour('period', 'table', 'export')],
  ['manutencao', 'Manutenção de Equipamentos', '/manutencao', 'Equipamentos, histórico, próximas revisões e registro de execução.', O.Manutencao, ['equipment', 'maintenance'], tour('table', 'add', 'import', 'form')],
  ['checklist', 'Checklist Operacional', '/checklist', 'Checklists digitais executados pelo celular, com responsável e horário.', O.Checklist, ['checklists', 'checklistRuns'], tour('form', 'add', 'table')],
  ['documentos', 'Documentos e Vencimentos', '/documentos', 'Licenças, alvarás, certificados e contratos com alertas de vencimento.', O.Documentos, ['documents'], tour(['upload', 'Ler arquivo', 'Extrai datas de arquivos de texto para você confirmar.'], ...CRUD, 'form')],
  // Clientes
  ['clientes', 'Clientes', '/clientes', 'Cadastro de clientes com consentimento LGPD e contatos protegidos.', O.Clientes, ['customers'], tour('kpi', ...CRUD, 'form')],
  ['fidelidade', 'Fidelidade', '/fidelidade', 'Programa opcional de pontos e recompensas com regras configuráveis.', O.Fidelidade, ['loyaltyTx', 'customers'], tour('form', 'table', 'add')],
  ['clientes-recorrentes', 'Clientes Recorrentes', '/clientes-recorrentes', 'Frequência de compra de clientes identificados nas vendas.', O.ClientesRecorrentes, ['sales'], tour('kpi', 'table', 'export', 'empty')],
  ['feedback', 'Avaliações e Feedback', '/feedback', 'Formulário próprio, importação de avaliações e acompanhamento de reclamações.', O.Feedback, ['feedback'], tour('kpi', 'form', 'import', ...TABLE)],
  // Administração
  ['importacao', 'Importação Inteligente', '/importacao', 'SmartImport: envie CSV/XLSX, revise o mapeamento, valide e importe sem duplicar.', A.SmartImport, [], tour(['upload', 'Enviar arquivos', 'Escolha um ou vários arquivos CSV ou XLSX.'], ['detect', 'Tipo de relatório', 'Confira o tipo reconhecido automaticamente.'], ['mapping', 'Mapeamento', 'Cada campo do sistema ligado a uma coluna da planilha.'], ['diagnosis', 'Diagnóstico', 'Linhas válidas, com erro e duplicadas.'], ['confirm', 'Confirmar', 'Grava as linhas válidas de uma só vez.'], ['undo', 'Desfazer', 'Remove todos os registros de uma importação.'], 'template', 'table')],
  ['integracoes', 'Central de Integrações', '/integracoes', 'Status real de cada conector e o que é necessário para ativá-lo.', A.Integracoes, [], tour('table')],
  ['unidades', 'Gestão de Unidades', '/unidades', 'Cadastro das unidades e acesso aos dados de cada uma.', A.Unidades, ['units'], tour(...CRUD, 'form')],
  ['comparacao-unidades', 'Comparação entre Unidades', '/comparacao-unidades', 'Faturamento, margem, despesas, ticket e indicadores proporcionais por unidade.', A.ComparacaoUnidades, ['units', 'sales', 'expenses'], tour('period', 'chart', 'table', 'empty')],
  ['tutorial', 'Tutorial Completo', '/tutorial', 'Central de Tutoriais: guias de todas as abas, importação, finanças, estoque e automação.', A.TutorialCompleto, [], tour(['tut-search', 'Pesquisa', 'Encontre qualquer tutorial pelo nome ou assunto.'], ['tut-progress', 'Progresso', 'Quantos tutoriais você já concluiu.'], ['tut-guides', 'Guias', 'Guias temáticos completos.'])],
  ['configuracoes', 'Configurações', '/configuracoes', 'Perfil, empresa, tema, limites de alertas, backup, demonstração e exclusão de dados.', A.Configuracoes, [], tour('form', ['thresholds', 'Limites', 'Valores que disparam alertas.'], 'export', 'table')],
]

export const TABS: TabDef[] = [
  ...RAW.map(([id, name, route, summary, component, uses, t], i) => ({ id, num: i + 1, name, route, summary, component, uses, tour: t, category: CATEGORIES[catIndex(i)] })),
  { id: 'autopilot', num: null, name: 'AutoPilot AI', route: '/autopilot', category: 'Módulos adicionais', summary: 'Automatiza cálculos, alertas, previsões e prepara compras para aprovação.', component: A.AutoPilot, uses: [],
    tour: tour(['mode', 'Modo', 'Escolha automático, com aprovação ou monitoramento.'], ['run', 'Executar', 'Roda todas as tarefas agora.'], 'table') },
]

function catIndex(i: number) {
  const bounds = [7, 17, 28, 35, 43, 48, 53, 60, 64, 70]
  return bounds.findIndex((b) => i < b)
}

export function useCurrentTab() {
  const { pathname } = useLocation()
  return TABS.find((t) => t.route === pathname) || (pathname.startsWith('/tutoriais') ? TABS.find((t) => t.id === 'tutorial') : undefined)
}
