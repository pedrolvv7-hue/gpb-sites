import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine, ZAxis, LineChart, Line, Legend } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, PeriodPicker, usePeriod, DataTable, ChartBox, Badge } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import { menuEngineering, money, pct, recipeCosts, norm, productRanking, salesSummary, lineRevenue, isValidSale } from '../lib/calc'

export function EngenhariaCardapio() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = useMemo(() => menuEngineering(data, p), [data, p])
  const color: Record<string, string> = { Estrela: '#10b981', 'Burro de carga': '#0ea5e9', 'Quebra-cabeça': '#eab308', Cão: '#ef4444' }
  const advice: Record<string, string> = { Estrela: 'Manter qualidade e destaque.', 'Burro de carga': 'Popular, mas com contribuição baixa: revisar custo ou preço.', 'Quebra-cabeça': 'Boa contribuição, pouca venda: testar divulgação ou posição no cardápio.', Cão: 'Baixa venda e contribuição: analisar se vale manter.' }
  if (!rows.length) return <Page><Empty action={{ to: '/fichas-tecnicas', label: 'Cadastrar fichas técnicas' }}>São necessárias vendas e fichas técnicas com custo para montar a matriz.</Empty></Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>Matriz popularidade x margem de contribuição (método Kasavana e Smith). Popular = participação ≥ 70% da média ({pct(rows[0].popThreshold)}). Lucrativo = contribuição ≥ média ponderada ({money(rows[0].avgCM)}). As classes indicam pratos a analisar, não decisões automáticas.</Notice>
      <Section title="Matriz">
        <ChartBox height={320}><ResponsiveContainer><ScatterChart margin={{ left: 10 }}><XAxis type="number" dataKey="mix" name="Participação %" fontSize={11} unit="%" /><YAxis type="number" dataKey="cm" name="Contribuição" fontSize={11} /><ZAxis range={[80, 80]} /><Tooltip formatter={(v: any, n: any) => (n === 'Contribuição' ? money(Number(v)) : `${Number(v).toFixed(1)}%`)} labelFormatter={() => ''} content={({ payload }: any) => payload?.[0] ? <div className="rounded bg-white p-2 text-xs shadow dark:bg-slate-800"><b>{payload[0].payload.product}</b><br />{payload[0].payload.cls}</div> : null} />
          <ReferenceLine x={rows[0].popThreshold} stroke="#94a3b8" strokeDasharray="4 4" /><ReferenceLine y={rows[0].avgCM} stroke="#94a3b8" strokeDasharray="4 4" />
          {Object.keys(color).map((c) => <Scatter key={c} name={c} data={rows.filter((r) => r.cls === c)} fill={color[c]} />)}<Legend />
        </ScatterChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename="engenharia-cardapio" filters={[{ key: 'cls', label: 'Classe', options: Object.keys(color) }]} cols={[
        { key: 'product', label: 'Produto' }, { key: 'qty', label: 'Vendidos', align: 'right' }, { key: 'mix', label: 'Participação', align: 'right', render: (r) => pct(r.mix) },
        { key: 'cm', label: 'Contribuição unit.', align: 'right', render: (r) => money(r.cm) }, { key: 'cls', label: 'Classe', render: (r) => <Badge tone={r.cls === 'Estrela' ? 'green' : r.cls === 'Cão' ? 'red' : r.cls === 'Burro de carga' ? 'blue' : 'amber'}>{r.cls}</Badge> },
        { key: 'adv', label: 'Sugestão de análise', csv: (r) => advice[r.cls], render: (r) => <span className="text-xs">{advice[r.cls]}</span> },
      ]} />
    </Page>
  )
}

export function FichasTecnicas() {
  const data = useData()
  const rc = useMemo(() => recipeCosts(data), [data])
  const [sel, setSel] = useState<string>('')
  const recipe = sel ? rc.get(norm(sel)) : null
  return (
    <Page>
      <Notice>Quantidades de ingredientes nunca são inventadas: o custo só é calculado quando todos os itens têm ingrediente cadastrado e unidade compatível.</Notice>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={`Receitas (${rc.size})`}>
          <ul className="max-h-96 space-y-1 overflow-auto text-sm" data-tour="list">
            {[...rc.values()].map((r) => (
              <li key={r.product}><button className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${sel === r.product ? 'bg-brand-50 dark:bg-slate-800' : ''}`} onClick={() => setSel(r.product)}>
                {r.product} <span className="float-right">{r.complete ? money(r.costPerPortion) : <Badge tone="amber">incompleta</Badge>}</span></button></li>
            ))}
            {data.products.filter((pr) => !rc.has(norm(pr.name))).map((pr) => <li key={pr.id} className="px-2 py-1 text-slate-400">{pr.name} <span className="float-right text-xs">sem ficha</span></li>)}
          </ul>
        </Section>
        <div className="lg:col-span-2">
          {recipe ? (
            <Section title={`Ficha técnica: ${recipe.product}`}>
              <Grid cols={4}>
                <Kpi label="Custo da receita" value={money(recipe.totalCost)} />
                <Kpi label="Rendimento" value={`${recipe.yield} porção(ões)`} />
                <Kpi label="Perda de preparo" value={pct(recipe.lossPct)} />
                <Kpi label="Custo por porção" value={money(recipe.costPerPortion)} help={{ title: 'Custo por porção', what: 'Quanto custa produzir uma porção.', how: 'custo da receita ÷ rendimento ÷ (1 - perda%).' }} />
              </Grid>
              <table className="mt-3 min-w-full text-sm"><thead><tr><th className="th">Ingrediente</th><th className="th text-right">Qtd</th><th className="th text-right">Custo unit.</th><th className="th text-right">Custo</th><th className="th">Problema</th></tr></thead>
                <tbody>{recipe.items.map((it, i) => <tr key={i}><td className="td">{it.ingredient}</td><td className="td text-right">{it.qty} {it.measure}</td><td className="td text-right">{it.unitCost != null ? money(it.unitCost) : '-'}</td><td className="td text-right">{it.cost != null ? money(it.cost) : 'n/d'}</td><td className="td text-red-600">{it.problem}</td></tr>)}</tbody></table>
            </Section>
          ) : <Empty>Selecione uma receita à esquerda para ver o detalhamento de custos.</Empty>}
        </div>
      </div>
      <EntityManager entity="recipes" title="Editor de itens das fichas técnicas" filters={[{ key: 'product', label: 'Prato', options: [...new Set(data.recipes.map((r) => r.product))] }]} />
      <EntityManager entity="products" title="Produtos do cardápio" />
    </Page>
  )
}

export function CustoReceitas() {
  const data = useData()
  const rc = useMemo(() => [...recipeCosts(data).values()], [data])
  const prices = new Map(data.products.map((x) => [norm(x.name), Number(x.price)]))
  return (
    <Page>
      <Notice>Ao alterar o custo de um ingrediente abaixo, todas as receitas, margens, simuladores e alertas são recalculados na hora. O custo anterior fica no histórico de preços.</Notice>
      <DataTable rows={rc.map((r) => ({ ...r, price: prices.get(norm(r.product)) }))} filename="custo-receitas" cols={[
        { key: 'product', label: 'Receita' }, { key: 'totalCost', label: 'Custo total', align: 'right', render: (r) => money(r.totalCost) },
        { key: 'costPerPortion', label: 'Custo/porção', align: 'right', render: (r) => money(r.costPerPortion) },
        { key: 'price', label: 'Preço', align: 'right', render: (r) => (r.price ? money(r.price) : 'n/d') },
        { key: 'cmv', label: 'CMV %', align: 'right', render: (r) => (r.price ? pct((r.costPerPortion / r.price) * 100) : 'n/d') },
        { key: 'complete', label: 'Status', render: (r) => (r.complete ? <Badge tone="green">completa</Badge> : <Badge tone="amber">incompleta</Badge>) },
      ]} />
      <EntityManager entity="ingredients" title="Ingredientes e custos (edite o custo para recalcular)" />
    </Page>
  )
}

export function CriadorCombos() {
  const data = useData()
  const rc = useMemo(() => recipeCosts(data), [data])
  const price = new Map(data.products.map((x) => [norm(x.name), Number(x.price)]))
  const rows = data.combos.map((c) => {
    const items = String(c.items).split(';').map((s) => s.trim()).filter(Boolean)
    const full = items.reduce((a, i) => a + (price.get(norm(i)) || 0), 0)
    const costs = items.map((i) => rc.get(norm(i))?.costPerPortion)
    const cost = costs.every((x) => x != null) ? costs.reduce((a: number, x) => a + (x as number), 0) : null
    const missing = items.filter((i) => !price.has(norm(i)))
    return { ...c, full, cost, discount: full ? ((full - c.price) / full) * 100 : null, margin: cost != null ? ((c.price - cost) / c.price) * 100 : null, missing: missing.join(', ') }
  })
  return (
    <Page>
      <Notice>Resultado hipotético: preço cheio, desconto concedido e margem estimada a partir das fichas técnicas. Margem só aparece se todos os itens tiverem ficha.</Notice>
      <DataTable rows={rows} filename="combos" empty={<Empty>Nenhum combo. Adicione abaixo (itens separados por ponto e vírgula).</Empty>} cols={[
        { key: 'name', label: 'Combo' }, { key: 'items', label: 'Itens' }, { key: 'price', label: 'Preço', align: 'right', render: (r) => money(r.price) },
        { key: 'full', label: 'Preço cheio', align: 'right', render: (r) => money(r.full) }, { key: 'discount', label: 'Desconto', align: 'right', render: (r) => pct(r.discount) },
        { key: 'cost', label: 'Custo', align: 'right', render: (r) => (r.cost != null ? money(r.cost) : 'n/d') }, { key: 'margin', label: 'Margem', align: 'right', render: (r) => pct(r.margin) },
        { key: 'missing', label: 'Itens não cadastrados', render: (r) => r.missing && <Badge tone="red">{r.missing}</Badge> },
      ]} />
      <EntityManager entity="combos" title="Combos" />
    </Page>
  )
}

export function Promocoes() {
  const data = useData()
  const rc = useMemo(() => recipeCosts(data), [data])
  const analysis = data.promotions.map((pr) => {
    const len = Math.max(1, (new Date(pr.end).getTime() - new Date(pr.start).getTime()) / 86400000 + 1)
    const before = { from: new Date(new Date(pr.start).getTime() - len * 86400000).toISOString().slice(0, 10), to: new Date(new Date(pr.start).getTime() - 86400000).toISOString().slice(0, 10) }
    const qty = (p: { from: string; to: string }) => data.sales.filter((s) => isValidSale(s) && norm(s.product) === norm(pr.product) && s.date >= p.from && s.date <= p.to).reduce((a, s) => a + Number(s.qty), 0)
    const rev = (p: { from: string; to: string }) => data.sales.filter((s) => isValidSale(s) && norm(s.product) === norm(pr.product) && s.date >= p.from && s.date <= p.to).reduce((a, s) => a + lineRevenue(s), 0)
    const q1 = qty({ from: pr.start, to: pr.end }), q0 = qty(before)
    return { ...pr, q0, q1, lift: q0 ? ((q1 - q0) / q0) * 100 : null, r0: rev(before), r1: rev({ from: pr.start, to: pr.end }) }
  })
  const [prod, setProd] = useState(data.products[0]?.name || '')
  const [disc, setDisc] = useState(15)
  const [lift, setLift] = useState(20)
  const P = Number(data.products.find((x) => x.name === prod)?.price || 0), C = rc.get(norm(prod))?.costPerPortion
  const q = data.sales.filter((s) => isValidSale(s) && norm(s.product) === norm(prod)).reduce((a, s) => a + Number(s.qty), 0) / 12 // média semanal aprox (90 dias)
  return (
    <Page>
      <Notice>Simulações não alteram preços reais. Para aplicar, edite o produto manualmente em Fichas Técnicas.</Notice>
      <Section title="Promoções anteriores (vendas do produto durante x período anterior de mesma duração)">
        <DataTable rows={analysis} filename="promocoes" empty={<Empty>Nenhuma promoção registrada.</Empty>} cols={[
          { key: 'name', label: 'Promoção' }, { key: 'product', label: 'Produto' }, { key: 'discountPct', label: 'Desc.', align: 'right', render: (r) => `${r.discountPct}%` },
          { key: 'start', label: 'Início' }, { key: 'end', label: 'Fim' }, { key: 'q0', label: 'Qtd antes', align: 'right' }, { key: 'q1', label: 'Qtd durante', align: 'right' },
          { key: 'lift', label: 'Variação', align: 'right', render: (r) => pct(r.lift) }, { key: 'r1', label: 'Receita durante', align: 'right', render: (r) => money(r.r1) },
        ]} />
      </Section>
      <Section title="Simular nova promoção">
        <div className="grid gap-3 md:grid-cols-4" data-tour="form">
          <label><span className="label">Produto</span><select className="input" value={prod} onChange={(e) => setProd(e.target.value)}>{data.products.map((x) => <option key={x.id}>{x.name}</option>)}</select></label>
          <label><span className="label">Desconto %</span><input className="input" type="number" value={disc} onChange={(e) => setDisc(Number(e.target.value))} /></label>
          <label><span className="label">Aumento de volume esperado %</span><input className="input" type="number" value={lift} onChange={(e) => setLift(Number(e.target.value))} /></label>
        </div>
        {C == null ? <Notice tone="warn">Produto sem ficha técnica: não é possível estimar a margem.</Notice> : (
          <div className="mt-3"><Grid cols={4}>
            <Kpi label="Preço promocional" value={money(P * (1 - disc / 100))} />
            <Kpi label="Margem na promoção" value={pct(((P * (1 - disc / 100) - C) / (P * (1 - disc / 100))) * 100)} sub={`normal ${pct(((P - C) / P) * 100)}`} />
            <Kpi label="Contribuição semanal estimada" value={money((P * (1 - disc / 100) - C) * q * (1 + lift / 100))} sub={`sem promoção: ${money((P - C) * q)}`} />
            <Kpi label="Aumento de volume para empatar" value={P * (1 - disc / 100) - C > 0 ? pct(((P - C) / (P * (1 - disc / 100) - C) - 1) * 100) : 'impossível'} />
          </Grid></div>
        )}
      </Section>
      <EntityManager entity="promotions" title="Registro de promoções" />
    </Page>
  )
}

export function AnalisePrecos() {
  const data = useData()
  const items = [...new Set(data.priceHistory.map((h) => `${h.kind}:${h.item}`))]
  const [sel, setSel] = useState(items[0] || '')
  const [kind, item] = sel.split(':')
  const series = data.priceHistory.filter((h) => h.kind === kind && h.item === item).sort((a, b) => a.date.localeCompare(b.date))
  const changes = items.map((k) => {
    const [kd, it] = k.split(':')
    const s = data.priceHistory.filter((h) => h.kind === kd && h.item === it).sort((a, b) => a.date.localeCompare(b.date) || a._createdAt.localeCompare(b._createdAt))
    const first = s[0]?.value, last = s[s.length - 1]?.value
    return { kind: kd, item: it, first, last, n: s.length, var: first ? ((last - first) / first) * 100 : null }
  })
  return (
    <Page>
      <Notice>O histórico registra automaticamente cada alteração de preço de venda e de custo de ingrediente (inclusive por importação). Valores antigos nunca são sobrescritos.</Notice>
      <DataTable rows={changes} filename="analise-precos" filters={[{ key: 'kind', label: 'Tipo', options: ['venda', 'custo'] }]} empty={<Empty>Sem histórico ainda.</Empty>} cols={[
        { key: 'kind', label: 'Tipo' }, { key: 'item', label: 'Item' }, { key: 'first', label: 'Primeiro valor', align: 'right', render: (r) => money(r.first) },
        { key: 'last', label: 'Valor atual', align: 'right', render: (r) => money(r.last) }, { key: 'n', label: 'Registros', align: 'right' },
        { key: 'var', label: 'Variação', align: 'right', render: (r) => <span className={(r.var || 0) > 0 ? (r.kind === 'custo' ? 'text-red-600' : 'text-emerald-600') : ''}>{pct(r.var)}</span> },
      ]} />
      {items.length > 0 && (
        <Section title="Evolução" actions={<select className="input w-auto" value={sel} onChange={(e) => setSel(e.target.value)}>{items.map((i) => <option key={i}>{i}</option>)}</select>}>
          <ChartBox height={220}><ResponsiveContainer><LineChart data={series}><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Line dataKey="value" stroke="#f97316" /></LineChart></ResponsiveContainer></ChartBox>
        </Section>
      )}
    </Page>
  )
}

export function CardapioDigital() {
  const data = useData()
  const { update, settings, setSettings } = useStore()
  const pub = data.products.filter((x) => x.published && x.active !== false)
  const cats = [...new Set(pub.map((x) => x.category || 'Outros'))]
  return (
    <Page actions={<Link className="btn-primary" to="/cardapio-publico" target="_blank" data-tour="preview">Abrir visualização pública</Link>}>
      <Notice tone="warn">Nesta versão os dados ficam no navegador. A página pública funciona como pré-visualização neste dispositivo; para publicar na internet para clientes, é preciso ativar o banco de dados em nuvem (ver documentação). Nenhuma alteração é publicada sem você marcar o produto como "No cardápio digital".</Notice>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Personalização">
          <div className="space-y-2" data-tour="form">
            <label className="block"><span className="label">Título</span><input className="input" value={settings.menuTheme.title} onChange={(e) => setSettings({ menuTheme: { ...settings.menuTheme, title: e.target.value } })} /></label>
            <label className="block"><span className="label">Cor</span><input type="color" value={settings.menuTheme.color} onChange={(e) => setSettings({ menuTheme: { ...settings.menuTheme, color: e.target.value } })} /></label>
          </div>
        </Section>
        <div className="lg:col-span-2"><Section title="Produtos (sincronizados com o cadastro)">
          <DataTable rows={data.products} filename="cardapio" cols={[
            { key: 'name', label: 'Produto' }, { key: 'category', label: 'Categoria' }, { key: 'price', label: 'Preço', align: 'right', render: (r) => money(Number(r.price)) },
            { key: 'active', label: 'Disponível', render: (r) => <input type="checkbox" aria-label="Disponível" checked={r.active !== false} onChange={(e) => update('products', r.id, { active: e.target.checked })} /> },
            { key: 'published', label: 'Publicar', render: (r) => <input type="checkbox" aria-label="Publicar" checked={!!r.published} onChange={(e) => update('products', r.id, { published: e.target.checked })} /> },
          ]} />
        </Section></div>
      </div>
      <p className="text-sm text-slate-500">{pub.length} produto(s) visíveis em {cats.length} categoria(s).</p>
    </Page>
  )
}

export function CardapioPublico() {
  const products = useStore((s) => s.data.products).filter((x) => x.published && x.active !== false)
  const t = useStore((s) => s.settings.menuTheme)
  const name = useStore((s) => s.settings.companyName)
  const cats = [...new Set(products.map((x) => x.category || 'Outros'))]
  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white p-4 dark:bg-slate-900">
      <h1 className="text-3xl font-bold" style={{ color: t.color }}>{t.title}</h1>
      <p className="text-slate-500">{name}</p>
      {cats.map((c) => (
        <div key={c} className="mt-6"><h2 className="border-b pb-1 text-xl font-semibold" style={{ borderColor: t.color }}>{c}</h2>
          {products.filter((x) => (x.category || 'Outros') === c).map((x) => (
            <div key={x.id} className="flex gap-3 border-b py-3 dark:border-slate-800">
              {x.photoUrl && <img src={x.photoUrl} alt={x.name} className="h-16 w-16 rounded object-cover" />}
              <div className="flex-1"><div className="font-medium">{x.name}</div><div className="text-sm text-slate-500">{x.description}</div></div>
              <div className="font-semibold">{money(Number(x.price))}</div>
            </div>
          ))}
        </div>
      ))}
      {!products.length && <p className="mt-6 text-slate-500">Nenhum produto publicado.</p>}
    </div>
  )
}
