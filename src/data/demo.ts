// Dados de DEMONSTRAÇÃO. São fictícios e só são carregados quando o usuário
// pede explicitamente. Enquanto ativos, um aviso fica fixo no topo da tela.
import type { Data } from './store'
import { addDays, today } from '../lib/calc'

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

export function buildDemo(): Partial<Record<keyof Data, any[]>> {
  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const end = addDays(today(), -1)
  const units = [{ name: 'Centro', code: 'CTR', city: 'São Paulo', seats: 60 }, { name: 'Shopping Norte', code: 'SHN', city: 'São Paulo', seats: 40 }]
  const ingredients = [
    ['Pão brioche', 'un', 1.6, 80, 2, 'Padaria Aurora'], ['Blend bovino 160g', 'un', 6.2, 60, 2, 'Frigorífico Boi Bom'],
    ['Queijo cheddar', 'kg', 48, 3, 3, 'Laticínios Serra'], ['Bacon', 'kg', 42, 3, 3, 'Frigorífico Boi Bom'],
    ['Alface', 'kg', 12, 2, 1, 'Hortifruti Verde'], ['Tomate', 'kg', 8.5, 4, 1, 'Hortifruti Verde'],
    ['Batata congelada', 'kg', 14, 15, 4, 'Distribuidora Sul'], ['Óleo de soja', 'l', 9, 10, 4, 'Distribuidora Sul'],
    ['Molho especial', 'kg', 22, 2, 2, 'Distribuidora Sul'], ['Refrigerante lata', 'un', 2.8, 96, 3, 'Bebidas Rio'],
    ['Peito de frango', 'kg', 19, 6, 2, 'Frigorífico Boi Bom'], ['Cebola', 'kg', 6, 3, 1, 'Hortifruti Verde'],
    ['Sorvete creme', 'l', 18, 4, 3, 'Laticínios Serra'], ['Calda chocolate', 'kg', 30, 1, 3, 'Distribuidora Sul'],
    ['Pão australiano', 'un', 2.1, 40, 2, 'Padaria Aurora'],
  ].map(([name, measure, cost, minStock, leadDays, supplier]) => ({ name, measure, cost, minStock, leadDays, supplier, barcode: '' }))
  const products = [
    ['Classic Burger', 'Burgers', 32], ['Cheddar Bacon', 'Burgers', 39], ['Salada Burger', 'Burgers', 34], ['Chicken Crispy', 'Burgers', 33],
    ['Australiano Duplo', 'Burgers', 46], ['Batata Média', 'Acompanhamentos', 16], ['Batata com Cheddar e Bacon', 'Acompanhamentos', 26],
    ['Refrigerante', 'Bebidas', 7], ['Sundae', 'Sobremesas', 15], ['Onion Rings', 'Acompanhamentos', 19],
  ].map(([name, category, price]) => ({ name, category, price, active: true, published: true, description: `${name} da casa`, photoUrl: '' }))
  const R = (product: string, ingredient: string, qty: number, measure: string, extra: any = {}) => ({ product, ingredient, qty, measure, yield: 1, lossPct: 0, ...extra })
  const recipes = [
    R('Classic Burger', 'Pão brioche', 1, 'un'), R('Classic Burger', 'Blend bovino 160g', 1, 'un'), R('Classic Burger', 'Queijo cheddar', 30, 'g'), R('Classic Burger', 'Molho especial', 20, 'g'),
    R('Cheddar Bacon', 'Pão brioche', 1, 'un'), R('Cheddar Bacon', 'Blend bovino 160g', 1, 'un'), R('Cheddar Bacon', 'Queijo cheddar', 50, 'g'), R('Cheddar Bacon', 'Bacon', 40, 'g'),
    R('Salada Burger', 'Pão brioche', 1, 'un'), R('Salada Burger', 'Blend bovino 160g', 1, 'un'), R('Salada Burger', 'Alface', 20, 'g'), R('Salada Burger', 'Tomate', 40, 'g'), R('Salada Burger', 'Molho especial', 20, 'g'),
    R('Chicken Crispy', 'Pão brioche', 1, 'un'), R('Chicken Crispy', 'Peito de frango', 150, 'g', { lossPct: 10 }), R('Chicken Crispy', 'Óleo de soja', 40, 'ml'), R('Chicken Crispy', 'Alface', 15, 'g'),
    R('Australiano Duplo', 'Pão australiano', 1, 'un'), R('Australiano Duplo', 'Blend bovino 160g', 2, 'un'), R('Australiano Duplo', 'Queijo cheddar', 60, 'g'), R('Australiano Duplo', 'Bacon', 40, 'g'),
    R('Batata Média', 'Batata congelada', 200, 'g', { lossPct: 5 }), R('Batata Média', 'Óleo de soja', 30, 'ml'),
    R('Batata com Cheddar e Bacon', 'Batata congelada', 250, 'g', { lossPct: 5 }), R('Batata com Cheddar e Bacon', 'Queijo cheddar', 60, 'g'), R('Batata com Cheddar e Bacon', 'Bacon', 30, 'g'),
    R('Refrigerante', 'Refrigerante lata', 1, 'un'),
    R('Sundae', 'Sorvete creme', 150, 'ml'), R('Sundae', 'Calda chocolate', 30, 'g'),
    // Onion Rings propositalmente sem ficha técnica, para demonstrar dados faltantes
  ]
  const weights = [16, 12, 7, 8, 5, 14, 6, 18, 5, 3]
  const pickProduct = () => {
    let x = r() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) < 0) return products[i]
    return products[0]
  }
  const channels = ['salao', 'salao', 'salao', 'retirada', 'delivery_proprio', 'ifood', 'ifood']
  const sales: any[] = [], orders: any[] = []
  let oid = 1000
  for (let d = 59; d >= 0; d--) {
    const date = addDays(end, -d)
    const dow = new Date(date + 'T12:00:00').getDay()
    for (const u of units) {
      const base = (u.code === 'CTR' ? 38 : 24) * [1.25, 0.6, 0.75, 0.85, 0.95, 1.35, 1.5][dow] * (1 + (59 - d) * 0.003)
      const n = Math.round(base * (0.85 + r() * 0.3))
      for (let i = 0; i < n; i++) {
        oid++
        const hour = pick([11, 12, 12, 13, 13, 14, 18, 19, 19, 20, 20, 20, 21, 21, 22])
        const time = `${String(hour).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`
        const ch = pick(channels)
        const status = r() < 0.02 ? 'cancelada' : 'concluida'
        const items = 1 + Math.floor(r() * 3)
        for (let k = 0; k < items; k++) {
          const p = pickProduct()
          sales.push({ orderId: `${u.code}-${oid}`, date, time, product: p.name, qty: r() < 0.15 ? 2 : 1, unitPrice: p.price, discount: r() < 0.05 ? 3 : 0, channel: ch, status, payment: pick(['pix', 'credito', 'debito', 'dinheiro']), customer: r() < 0.3 ? `Cliente ${1 + Math.floor(r() * 120)}` : '', unit: u.code })
        }
      }
    }
  }
  const expenses: any[] = []
  for (let m = 3; m >= 0; m--) {
    const dt = new Date(end + 'T12:00:00'); dt.setMonth(dt.getMonth() - m)
    const ym = dt.toISOString().slice(0, 7)
    for (const u of units) {
      const f = u.code === 'CTR' ? 1 : 0.7
      expenses.push({ date: `${ym}-05`, description: 'Aluguel', category: 'aluguel', amount: Math.round(9000 * f), unit: u.code })
      expenses.push({ date: `${ym}-10`, description: 'Conta de energia', category: 'energia', amount: Math.round((2100 + r() * 300) * f * (m === 0 ? 1.6 : 1)), unit: u.code })
      expenses.push({ date: `${ym}-12`, description: 'Água', category: 'agua', amount: Math.round((480 + r() * 80) * f), unit: u.code })
      expenses.push({ date: `${ym}-15`, description: 'Gás', category: 'gas', amount: Math.round((900 + r() * 150) * f), unit: u.code })
      expenses.push({ date: `${ym}-20`, description: 'Anúncios', category: 'marketing', amount: Math.round((1200 + r() * 400) * f), unit: u.code })
    }
  }
  const t = today()
  const payables = [
    { description: 'Frigorífico Boi Bom NF 3321', supplier: 'Frigorífico Boi Bom', dueDate: addDays(t, -3), amount: 4820, installment: '1/1', paidDate: '', unit: 'CTR' },
    { description: 'Distribuidora Sul NF 998', supplier: 'Distribuidora Sul', dueDate: addDays(t, 4), amount: 2310.5, installment: '1/2', paidDate: '', unit: 'CTR' },
    { description: 'Distribuidora Sul NF 998', supplier: 'Distribuidora Sul', dueDate: addDays(t, 34), amount: 2310.5, installment: '2/2', paidDate: '', unit: 'CTR' },
    { description: 'Aluguel', supplier: 'Imobiliária', dueDate: addDays(t, -20), amount: 9000, installment: '1/1', paidDate: addDays(t, -21), unit: 'CTR' },
    { description: 'Laticínios Serra NF 77', supplier: 'Laticínios Serra', dueDate: addDays(t, 9), amount: 1590, installment: '1/1', paidDate: '', unit: 'SHN' },
  ]
  const receivables = [
    { description: 'Repasse iFood semana', source: 'ifood', dueDate: addDays(t, -2), amount: 6240, receivedDate: '', unit: 'CTR' },
    { description: 'Repasse iFood semana', source: 'ifood', dueDate: addDays(t, 5), amount: 5980, receivedDate: '', unit: 'CTR' },
    { description: 'Cartão de crédito D+30', source: 'adquirente', dueDate: addDays(t, 12), amount: 18400, receivedDate: '', unit: 'CTR' },
    { description: 'Cartão de crédito D+30', source: 'adquirente', dueDate: addDays(t, -10), amount: 17100, receivedDate: addDays(t, -10), unit: 'CTR' },
  ]
  const bankStatement = [
    { date: addDays(t, -10), description: 'CRED ADQUIRENTE', amount: 17100 },
    { date: addDays(t, -21), description: 'PAG ALUGUEL', amount: -9000 },
    { date: addDays(t, -6), description: 'TED RECEBIDA IFOOD', amount: 5912.4 },
    { date: addDays(t, -4), description: 'PIX ENVIADO', amount: -350 },
  ]
  const suppliers = [
    { name: 'Frigorífico Boi Bom', contact: 'Marcos', phone: '(11) 90000-0001', email: '', terms: '28 dias', minOrder: 500, freight: 0, leadDays: 2 },
    { name: 'Distribuidora Sul', contact: 'Ana', phone: '(11) 90000-0002', email: '', terms: '2x 30/60', minOrder: 800, freight: 60, leadDays: 4 },
    { name: 'Hortifruti Verde', contact: 'José', phone: '(11) 90000-0003', email: '', terms: 'à vista', minOrder: 100, freight: 25, leadDays: 1 },
    { name: 'Laticínios Serra', contact: 'Paula', phone: '(11) 90000-0004', email: '', terms: '21 dias', minOrder: 300, freight: 40, leadDays: 3 },
    { name: 'Padaria Aurora', contact: 'Rita', phone: '(11) 90000-0005', email: '', terms: '7 dias', minOrder: 150, freight: 0, leadDays: 1 },
    { name: 'Bebidas Rio', contact: 'Caio', phone: '(11) 90000-0006', email: '', terms: '14 dias', minOrder: 400, freight: 0, leadDays: 3 },
    { name: 'Atacado Central', contact: 'Lia', phone: '(11) 90000-0007', email: '', terms: 'à vista', minOrder: 1000, freight: 90, leadDays: 2 },
  ]
  const supplierPrices = ingredients.flatMap((i) => [
    { supplier: i.supplier, ingredient: i.name, price: i.cost, date: addDays(t, -15) },
    { supplier: 'Atacado Central', ingredient: i.name, price: +(Number(i.cost) * (0.88 + r() * 0.2)).toFixed(2), date: addDays(t, -10) },
  ])
  const purchases: any[] = [], counts: any[] = []
  const countDate = addDays(end, -14)
  for (const i of ingredients) {
    counts.push({ date: countDate, ingredient: i.name, qty: Number(i.minStock) * (2 + r() * 2), countedBy: 'Gerente', unit: 'CTR' })
    purchases.push({ date: addDays(end, -7), supplier: i.supplier, ingredient: i.name, qty: Math.round(Number(i.minStock) * (0.5 + r() * 1.5)), unitCost: i.cost, unit: 'CTR' })
  }
  const lots = [
    { ingredient: 'Alface', lot: 'H-221', receivedDate: addDays(t, -3), expiry: addDays(t, 2), qty: 3, location: 'Câmara fria', unit: 'CTR' },
    { ingredient: 'Queijo cheddar', lot: 'L-889', receivedDate: addDays(t, -20), expiry: addDays(t, 25), qty: 5, location: 'Câmara fria', unit: 'CTR' },
    { ingredient: 'Sorvete creme', lot: 'S-12', receivedDate: addDays(t, -40), expiry: addDays(t, -1), qty: 2, location: 'Freezer 2', unit: 'SHN' },
  ]
  const stockMoves = [{ date: addDays(end, -5), ingredient: 'Tomate', type: 'perda', qty: 1.5, note: 'Amassados no recebimento', unit: 'CTR' }]
  const employees = [
    ['Joana Lima', 'Gerente', 'CTR'], ['Pedro Alves', 'Chapeiro', 'CTR'], ['Lucas Prado', 'Chapeiro', 'CTR'], ['Bia Souza', 'Atendente', 'CTR'],
    ['Rafael Melo', 'Gerente', 'SHN'], ['Carla Dias', 'Chapeira', 'SHN'], ['Davi Rocha', 'Atendente', 'SHN'],
  ].map(([name, role, unit]) => ({ name, role, unit, phone: '(11) 9xxxx-xxxx', status: 'ativo', admission: '2025-03-01' }))
  const shifts: any[] = []
  for (let d = 0; d < 7; d++) {
    const date = addDays(t, d)
    for (const e of employees) shifts.push({ employee: e.name, date, start: e.role === 'Gerente' ? '10:00' : '17:00', end: e.role === 'Gerente' ? '18:00' : '23:30', role: e.role, unit: e.unit })
  }
  shifts.push({ employee: 'Pedro Alves', date: addDays(t, 1), start: '11:00', end: '18:00', role: 'Chapeiro', unit: 'CTR' }) // conflito proposital
  const payroll: any[] = []
  for (let m = 2; m >= 0; m--) {
    const dt = new Date(end + 'T12:00:00'); dt.setMonth(dt.getMonth() - m)
    const ym = dt.toISOString().slice(0, 7)
    for (const e of employees) payroll.push({ month: ym, employee: e.name, type: 'salario', amount: e.role.startsWith('Gerente') ? 4200 : 2300, unit: e.unit })
  }
  const stamp = (d: string, h: number, m: number) => `${d} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  for (let i = 0; i < 40; i++) {
    const d = addDays(t, -Math.floor(i / 8)), h = 18 + (i % 4), m0 = Math.floor(r() * 20)
    const w = 2 + Math.floor(r() * 6), prep = 8 + Math.floor(r() * 14)
    const done = i >= 3
    orders.push({ code: `P${5000 + i}`, customer: `Cliente ${1 + (i % 25)}`, items: '1 Classic Burger, 1 Batata Média', total: 48, channel: pick(['salao', 'retirada', 'delivery_proprio']),
      status: done ? 'entregue' : pick(['novo', 'preparo']), createdAt: stamp(d, h, m0), startedAt: done ? stamp(d, h, m0 + w) : '', readyAt: done ? stamp(d, h, m0 + w + prep) : '', unit: 'CTR' })
  }
  const deliveries = [
    { supplier: 'Frigorífico Boi Bom', ingredient: 'Blend bovino 160g', expectedDate: addDays(t, -6), receivedDate: addDays(t, -6), expectedQty: 120, receivedQty: 120, receivedBy: 'Joana Lima' },
    { supplier: 'Hortifruti Verde', ingredient: 'Tomate', expectedDate: addDays(t, -5), receivedDate: addDays(t, -5), expectedQty: 10, receivedQty: 8.5, receivedBy: 'Joana Lima' },
    { supplier: 'Distribuidora Sul', ingredient: 'Batata congelada', expectedDate: addDays(t, 2), receivedDate: '', expectedQty: 40, receivedQty: '', receivedBy: '' },
  ]
  const loyaltyTx = [
    { customer: 'Cliente 2', date: addDays(t, -20), points: 120, reason: 'Compra de R$ 120' },
    { customer: 'Cliente 2', date: addDays(t, -5), points: 95, reason: 'Compra de R$ 95' },
    { customer: 'Cliente 5', date: addDays(t, -3), points: 60, reason: 'Compra de R$ 60' },
  ]
  return {
    deliveries, loyaltyTx,
    units, ingredients, products, recipes, sales, orders, expenses, payables, receivables, bankStatement, suppliers, supplierPrices,
    purchases, counts, lots, stockMoves, employees, shifts, payroll,
    fees: [{ channel: 'ifood', feePct: 23, fixedFee: 0 }, { channel: 'delivery_proprio', feePct: 0, fixedFee: 4 }, { channel: 'salao', feePct: 2.5, fixedFee: 0 }],
    goals: [{ month: end.slice(0, 7), target: 120000, unit: 'CTR' }, { month: end.slice(0, 7), target: 70000, unit: 'SHN' }],
    equipment: [
      { name: 'Chapa industrial', location: 'Cozinha', intervalDays: 90, lastMaintenance: addDays(t, -95), unit: 'CTR' },
      { name: 'Fritadeira 2 cubas', location: 'Cozinha', intervalDays: 60, lastMaintenance: addDays(t, -30), unit: 'CTR' },
      { name: 'Câmara fria', location: 'Estoque', intervalDays: 180, lastMaintenance: addDays(t, -176), unit: 'CTR' },
    ],
    maintenance: [{ equipment: 'Fritadeira 2 cubas', date: addDays(t, -30), description: 'Troca de termostato', cost: 380, doneBy: 'TecFrio', evidence: 'OS 4471' }],
    checklists: [
      { name: 'Abertura da cozinha', type: 'abertura', items: 'Ligar exaustão;Conferir temperatura da câmara fria;Higienizar bancadas;Conferir validade dos molhos' },
      { name: 'Fechamento', type: 'fechamento', items: 'Desligar chapa;Filtrar óleo;Retirar lixo;Trancar estoque' },
    ],
    documents: [
      { name: 'Alvará de funcionamento', type: 'alvara', issueDate: '2025-12-01', expiry: addDays(t, 20), confirmed: true, notes: '', unit: 'CTR' },
      { name: 'Licença sanitária', type: 'licenca', issueDate: '2025-06-01', expiry: addDays(t, 120), confirmed: false, notes: 'Data lida do PDF, confirmar', unit: 'CTR' },
      { name: 'AVCB Bombeiros', type: 'certificado', issueDate: '2024-11-01', expiry: addDays(t, -5), confirmed: true, notes: '', unit: 'SHN' },
    ],
    customers: Array.from({ length: 25 }, (_, i) => ({ name: `Cliente ${i + 1}`, phone: '', email: '', consent: i % 3 !== 0, createdAt: addDays(t, -80 + i) })),
    feedback: [
      { date: addDays(t, -2), customer: 'Cliente 4', rating: 5, type: 'elogio', text: 'Burger excelente e entrega rápida', status: 'resolvido', unit: 'CTR' },
      { date: addDays(t, -1), customer: 'Cliente 9', rating: 2, type: 'reclamacao', text: 'Batata chegou fria', status: 'aberto', unit: 'CTR' },
      { date: addDays(t, -6), customer: '', rating: 4, type: 'sugestao', text: 'Poderiam ter opção vegetariana', status: 'aberto', unit: 'SHN' },
    ],
    promotions: [{ name: 'Terça do Classic', product: 'Classic Burger', discountPct: 20, start: addDays(end, -40), end: addDays(end, -33) }],
    combos: [{ name: 'Combo Classic', items: 'Classic Burger;Batata Média;Refrigerante', price: 49 }],
  }
}
