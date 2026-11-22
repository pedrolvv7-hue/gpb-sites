import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, DataTable, ChartBox, Badge, usePeriod, PeriodPicker } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import { money, num, today, addDays, daysBetween, groupSum, inPeriod, validSales, lineRevenue, salesSummary, pct, norm, mean } from '../lib/calc'

// ------------------------------------------------------------------ 54 Funcionários
export function Funcionarios() {
  const data = useData()
  return (
    <Page>
      <Notice>Telefones são mascarados nas listagens. Registre apenas dados necessários à gestão (LGPD). Documentos pessoais e dados de saúde não devem ser armazenados aqui.</Notice>
      <Grid cols={4}>{['ativo', 'ferias', 'afastado', 'desligado'].map((s) => <Kpi key={s} label={s} value={data.employees.filter((e) => (e.status || 'ativo') === s).length} />)}</Grid>
      <EntityManager entity="employees" filters={[{ key: 'role', label: 'Função', options: [...new Set(data.employees.map((e) => e.role))] }, { key: 'unit', label: 'Unidade', options: data.units.map((u) => u.code) }, { key: 'status', label: 'Status', options: ['ativo', 'ferias', 'afastado', 'desligado'] }]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 55 Escalas
export function shiftConflicts(shifts: any[]) {
  const out: { employee: string; date: string; a: string; b: string }[] = []
  const byKey = new Map<string, any[]>()
  for (const s of shifts) { const k = `${s.employee}|${s.date}`; byKey.set(k, [...(byKey.get(k) || []), s]) }
  for (const list of byKey.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]
      if (a.start < b.end && b.start < a.end) out.push({ employee: a.employee, date: a.date, a: `${a.start}-${a.end}`, b: `${b.start}-${b.end}` })
    }
  }
  return out
}

export function Escalas() {
  const data = useData()
  const add = useStore((s) => s.add)
  const [start, setStart] = useState(today())
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const conflicts = useMemo(() => shiftConflicts(data.shifts), [data.shifts])
  const [rec, setRec] = useState({ employee: '', weekdays: [] as number[], start: '18:00', end: '23:00', weeks: 4 })
  const genRecurring = () => {
    if (!rec.employee || !rec.weekdays.length) return alert('Escolha funcionário e dias da semana.')
    let n = 0
    for (let d = 0; d < rec.weeks * 7; d++) {
      const date = addDays(start, d)
      if (rec.weekdays.includes(new Date(date + 'T12:00:00').getDay())) { add('shifts', { employee: rec.employee, date, start: rec.start, end: rec.end, role: data.employees.find((e) => e.name === rec.employee)?.role || '', unit: data.employees.find((e) => e.name === rec.employee)?.unit || '' }); n++ }
    }
    alert(`${n} turno(s) criados conforme a regra definida por você. Verifique conflitos.`)
  }
  return (
    <Page>
      {conflicts.length > 0 && <Notice tone="error">{conflicts.length} conflito(s) de horário: {conflicts.slice(0, 3).map((c) => `${c.employee} em ${c.date} (${c.a} e ${c.b})`).join('; ')}</Notice>}
      <Notice>As escalas seguem apenas as regras que você define. O sistema não distribui horários sozinho. Verifique a legislação e a convenção coletiva aplicáveis.</Notice>
      <Section title="Calendário semanal" actions={<input type="date" className="input w-auto" value={start} onChange={(e) => setStart(e.target.value)} />}>
        <div className="overflow-x-auto" data-tour="table"><table className="min-w-full text-xs"><thead><tr><th className="th">Funcionário</th>{days.map((d) => <th key={d} className="th">{d.slice(5).split('-').reverse().join('/')}</th>)}</tr></thead>
          <tbody>{data.employees.filter((e) => e.status !== 'desligado').map((e) => (
            <tr key={e.id} className="border-t dark:border-slate-800"><td className="td font-medium">{e.name}<div className="text-slate-400">{e.role}</div></td>
              {days.map((d) => { const s = data.shifts.filter((x) => x.employee === e.name && x.date === d); const c = conflicts.some((x) => x.employee === e.name && x.date === d)
                return <td key={d} className={`td ${c ? 'bg-red-50 dark:bg-red-950' : ''}`}>{s.map((x) => <div key={x.id}>{x.start}-{x.end}</div>)}</td> })}
            </tr>))}</tbody></table></div>
      </Section>
      <Section title="Gerar escala recorrente">
        <div className="flex flex-wrap items-end gap-2" data-tour="form">
          <label><span className="label">Funcionário</span><select className="input" value={rec.employee} onChange={(e) => setRec({ ...rec, employee: e.target.value })}><option value="">Selecione</option>{data.employees.map((e) => <option key={e.id}>{e.name}</option>)}</select></label>
          <div><span className="label">Dias</span><div className="flex gap-1">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => <button key={i} type="button" className={rec.weekdays.includes(i) ? 'btn-primary px-2' : 'btn-ghost px-2'} onClick={() => setRec({ ...rec, weekdays: rec.weekdays.includes(i) ? rec.weekdays.filter((x) => x !== i) : [...rec.weekdays, i] })}>{l}</button>)}</div></div>
          <label><span className="label">Início</span><input type="time" className="input" value={rec.start} onChange={(e) => setRec({ ...rec, start: e.target.value })} /></label>
          <label><span className="label">Fim</span><input type="time" className="input" value={rec.end} onChange={(e) => setRec({ ...rec, end: e.target.value })} /></label>
          <label><span className="label">Semanas</span><input type="number" className="input w-20" value={rec.weeks} onChange={(e) => setRec({ ...rec, weeks: Number(e.target.value) })} /></label>
          <button className="btn-primary" onClick={genRecurring}>Gerar</button>
        </div>
      </Section>
      <EntityManager entity="shifts" title="Todos os turnos (editar, trocar ou excluir)" />
    </Page>
  )
}

// ------------------------------------------------------------------ 56 Custos de pessoal
export function CustosPessoal() {
  const data = useData()
  const byMonth = [...groupSum(data.payroll, (r) => r.month, (r) => Number(r.amount)).entries()].sort().map(([m, v]) => {
    const rev = salesSummary(data, { from: `${m}-01`, to: `${m}-31` }).revenue
    return { m, v, rev, pct: rev ? (v / rev) * 100 : null }
  })
  return (
    <Page>
      <Notice>Custos de pessoal vêm dos relatórios de folha que você importar ou cadastrar. Valores individuais só são visíveis para quem acessa esta conta.</Notice>
      {byMonth.length > 0 && <Section title="Custo de pessoal x faturamento por mês"><ChartBox height={220}><ResponsiveContainer><BarChart data={byMonth}><XAxis dataKey="m" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="v" name="Pessoal" fill="#8b5cf6" /></BarChart></ResponsiveContainer></ChartBox>
        <DataTable rows={byMonth} filename="pessoal-mes" cols={[{ key: 'm', label: 'Mês' }, { key: 'v', label: 'Custo', align: 'right', render: (r) => money(r.v) }, { key: 'rev', label: 'Faturamento', align: 'right', render: (r) => money(r.rev) }, { key: 'pct', label: '% do faturamento', align: 'right', render: (r) => pct(r.pct) }]} /></Section>}
      <EntityManager entity="payroll" filters={[{ key: 'month', label: 'Mês', options: [...new Set(data.payroll.map((r) => r.month))] }, { key: 'type', label: 'Tipo', options: ['salario', 'encargos', 'beneficios', 'extras', 'outros'] }]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 57 Produtividade
export function Produtividade() {
  const data = useData()
  const [p, setP] = usePeriod()
  const turno = (t?: string) => (!t ? null : t < '16:00' ? 'Almoço (até 16h)' : 'Jantar (16h em diante)')
  const v = validSales(data, p)
  const rows = ['Almoço (até 16h)', 'Jantar (16h em diante)'].map((tn) => {
    const s = v.filter((x) => turno(x.time) === tn)
    const days = new Set(s.map((x) => x.date)).size
    const hours = data.shifts.filter((x) => inPeriod(x.date, p) && (tn.startsWith('Almoço') ? x.start < '16:00' : x.end > '16:00')).reduce((a, x) => {
      const [h1, m1] = x.start.split(':').map(Number), [h2, m2] = x.end.split(':').map(Number)
      return a + Math.max(0, h2 + m2 / 60 - (h1 + m1 / 60))
    }, 0)
    const rev = s.reduce((a, x) => a + lineRevenue(x), 0)
    return { tn, rev, items: s.reduce((a, x) => a + Number(x.qty), 0), days, hours, perHour: hours ? rev / hours : null }
  })
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice tone="warn">Análise por <b>turno e equipe</b>, não por pessoa. Avaliações individuais exigem critérios justos e dados suficientes, que vendas agregadas não fornecem. Faturamento por hora trabalhada só aparece quando há escalas registradas no período.</Notice>
      <DataTable rows={rows} filename="produtividade" cols={[
        { key: 'tn', label: 'Turno' }, { key: 'rev', label: 'Faturamento', align: 'right', render: (r) => money(r.rev) }, { key: 'items', label: 'Itens', align: 'right' },
        { key: 'days', label: 'Dias', align: 'right' }, { key: 'hours', label: 'Horas escaladas', align: 'right', render: (r) => num(r.hours, 1) },
        { key: 'perHour', label: 'Faturamento / hora escalada', align: 'right', render: (r) => (r.perHour ? money(r.perHour) : 'n/d') },
      ]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 58 Manutenção
export function Manutencao() {
  const data = useData()
  const rows = data.equipment.map((e) => {
    const last = [e.lastMaintenance, ...data.maintenance.filter((m) => m.equipment === e.name).map((m) => m.date)].filter(Boolean).sort().pop()
    const next = last && e.intervalDays ? addDays(last, Number(e.intervalDays)) : null
    return { ...e, last, next, daysTo: next ? daysBetween(today(), next) : null }
  })
  return (
    <Page>
      <Notice>Uma manutenção só conta como realizada quando registrada com responsável e evidência (nº da OS, nota fiscal). Alertas são gerados conforme o intervalo de revisão.</Notice>
      <DataTable rows={rows} filename="equipamentos" empty={<Empty>Cadastre equipamentos abaixo.</Empty>} cols={[
        { key: 'name', label: 'Equipamento' }, { key: 'location', label: 'Local' }, { key: 'last', label: 'Última registrada' }, { key: 'next', label: 'Próxima revisão' },
        { key: 'daysTo', label: 'Situação', render: (r) => (r.daysTo == null ? <Badge>sem intervalo</Badge> : r.daysTo < 0 ? <Badge tone="red">atrasada {-r.daysTo}d</Badge> : r.daysTo <= 7 ? <Badge tone="amber">em {r.daysTo}d</Badge> : <Badge tone="green">em {r.daysTo}d</Badge>) },
      ]} />
      <EntityManager entity="equipment" title="Equipamentos" />
      <EntityManager entity="maintenance" title="Registro de manutenções executadas" />
    </Page>
  )
}

// ------------------------------------------------------------------ 59 Checklist
export function Checklist() {
  const data = useData()
  const add = useStore((s) => s.add)
  const [sel, setSel] = useState('')
  const [who, setWho] = useState('')
  const cl = data.checklists.find((c) => c.name === sel)
  const items = cl ? String(cl.items).split(';').map((s) => s.trim()).filter(Boolean) : []
  const doneToday = data.checklistRuns.filter((r) => r.checklist === sel && r.date === today())
  const confirmItem = (item: string) => {
    if (!who.trim()) return alert('Informe seu nome antes de confirmar.')
    add('checklistRuns', { checklist: sel, date: today(), item, responsible: who, at: new Date().toLocaleTimeString('pt-BR') })
  }
  return (
    <Page>
      <Notice>Cada item só é marcado quando uma pessoa toca em "Confirmar". Nada é concluído automaticamente.</Notice>
      <div className="card space-y-3" data-tour="form">
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className="label">Checklist</span><select className="input" value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Selecione</option>{data.checklists.map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
          <label><span className="label">Seu nome *</span><input className="input" value={who} onChange={(e) => setWho(e.target.value)} /></label>
        </div>
        {cl && <>
          <div className="text-sm">{doneToday.length} de {items.length} itens confirmados hoje</div>
          <ul className="divide-y dark:divide-slate-800">{items.map((it) => { const d = doneToday.find((r) => r.item === it)
            return <li key={it} className="flex items-center justify-between py-3"><span className={d ? 'text-slate-400 line-through' : ''}>{it}</span>
              {d ? <span className="text-xs text-emerald-600">✓ {d.responsible} às {d.at}</span> : <button className="btn-primary" onClick={() => confirmItem(it)}>Confirmar</button>}</li> })}</ul>
        </>}
      </div>
      <EntityManager entity="checklists" title="Modelos de checklist" />
      <Section title="Histórico de execuções"><DataTable rows={data.checklistRuns} filename="checklist-historico" cols={[{ key: 'date', label: 'Data' }, { key: 'at', label: 'Hora' }, { key: 'checklist', label: 'Checklist' }, { key: 'item', label: 'Item' }, { key: 'responsible', label: 'Responsável' }]} /></Section>
    </Page>
  )
}

// ------------------------------------------------------------------ 60 Documentos
/** Procura datas no texto de um documento digital e sugere vencimento (requer confirmação). */
export function extractDates(text: string) {
  const out: string[] = []
  const re = /(\d{2})[/.-](\d{2})[/.-](\d{4})/g
  let m
  while ((m = re.exec(text))) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`
    if (!isNaN(new Date(iso).getTime()) && !out.includes(iso)) out.push(iso)
  }
  return out.sort()
}

export function Documentos() {
  const data = useData()
  const { add, update } = useStore()
  const [found, setFound] = useState<{ name: string; dates: string[] } | null>(null)
  const onFile = async (f: File) => {
    if (!/\.(txt|csv|xml|html?)$/i.test(f.name)) return setFound({ name: f.name, dates: [] })
    setFound({ name: f.name, dates: extractDates(await f.text()) })
  }
  return (
    <Page>
      <Notice>Para arquivos de texto (TXT, XML, HTML) as datas são extraídas automaticamente e você confirma qual é o vencimento. PDFs e imagens ainda não são lidos automaticamente: preencha as datas e marque "Datas confirmadas".</Notice>
      <Section title="Ler datas de um arquivo digital">
        <input type="file" data-tour="upload" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {found && (found.dates.length ? (
          <div className="mt-2 space-y-1 text-sm">Datas encontradas em <b>{found.name}</b>. Qual é o vencimento?
            <div className="flex flex-wrap gap-2">{found.dates.map((d) => <button key={d} className="btn-ghost" onClick={() => { add('documents', { name: found.name, type: 'outro', expiry: d, confirmed: true, issueDate: '', notes: 'Data extraída do arquivo e confirmada pelo usuário' }); setFound(null) }}>{d}</button>)}</div>
          </div>) : <Notice tone="warn">Nenhuma data legível automaticamente em {found.name}. Cadastre manualmente abaixo.</Notice>)}
      </Section>
      <EntityManager entity="documents" extraCols={[{ key: 'st', label: 'Situação', render: (r) => { if (!r.expiry) return <Badge>sem vencimento</Badge>; const d = daysBetween(today(), r.expiry); return d < 0 ? <Badge tone="red">vencido</Badge> : d <= 30 ? <Badge tone="amber">{d} dias</Badge> : <Badge tone="green">{d} dias</Badge> } }]}
        rowActions={(r) => !r.confirmed && <button className="btn-ghost px-2 text-xs" onClick={() => update('documents', r.id, { confirmed: true })}>Confirmar datas</button>} />
    </Page>
  )
}

// ------------------------------------------------------------------ Clientes
export function Clientes() {
  const data = useData()
  return (
    <Page>
      <Notice>LGPD: cadastre apenas clientes com base legal (ex.: consentimento). Contatos ficam mascarados nas listas. Use "Exportar dados" em Configurações para atender pedidos de acesso e a exclusão para pedidos de remoção.</Notice>
      <Grid cols={3}><Kpi label="Clientes" value={data.customers.length} /><Kpi label="Com consentimento" value={data.customers.filter((c) => c.consent).length} /><Kpi label="Sem consentimento" value={data.customers.filter((c) => !c.consent).length} tone="warn" /></Grid>
      <EntityManager entity="customers" filters={[{ key: 'consent', label: 'Consentimento', options: ['true', 'false'] }]} />
    </Page>
  )
}

export function Fidelidade() {
  const data = useData()
  const { settings, setSettings, add } = useStore()
  const L = settings.loyalty
  const balances = [...groupSum(data.loyaltyTx, (t) => t.customer, (t) => Number(t.points)).entries()].map(([customer, points]) => ({ customer, points, eligible: points >= L.rewardPoints })).sort((a, b) => b.points - a.points)
  const [f, setF] = useState({ customer: '', amount: '' })
  return (
    <Page>
      <Section title="Regras do programa (opcional)">
        <div className="grid gap-2 sm:grid-cols-4" data-tour="form">
          <label className="flex items-center gap-2"><input type="checkbox" checked={L.enabled} onChange={(e) => setSettings({ loyalty: { ...L, enabled: e.target.checked } })} /> Programa ativo</label>
          <label><span className="label">Pontos por R$ 1</span><input className="input" type="number" value={L.pointsPerReal} onChange={(e) => setSettings({ loyalty: { ...L, pointsPerReal: Number(e.target.value) } })} /></label>
          <label><span className="label">Pontos para recompensa</span><input className="input" type="number" value={L.rewardPoints} onChange={(e) => setSettings({ loyalty: { ...L, rewardPoints: Number(e.target.value) } })} /></label>
          <label><span className="label">Recompensa</span><input className="input" value={L.rewardLabel} onChange={(e) => setSettings({ loyalty: { ...L, rewardLabel: e.target.value } })} /></label>
        </div>
      </Section>
      {L.enabled && <Section title="Lançar compra">
        <div className="flex flex-wrap gap-2"><select className="input w-auto" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}><option value="">Cliente</option>{data.customers.filter((c) => c.consent).map((c) => <option key={c.id}>{c.name}</option>)}</select>
          <input className="input w-32" placeholder="Valor R$" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <button className="btn-primary" onClick={() => { if (!f.customer || !f.amount) return; add('loyaltyTx', { customer: f.customer, date: today(), points: Math.floor(Number(f.amount.replace(',', '.')) * L.pointsPerReal), reason: `Compra de R$ ${f.amount}` }); setF({ customer: '', amount: '' }) }}>Lançar pontos</button></div>
      </Section>}
      <DataTable rows={balances} filename="fidelidade" empty={<Empty>Nenhum ponto lançado.</Empty>} cols={[{ key: 'customer', label: 'Cliente' }, { key: 'points', label: 'Saldo', align: 'right' },
        { key: 'eligible', label: 'Recompensa', render: (r) => (r.eligible ? <button className="btn-ghost text-xs" onClick={() => add('loyaltyTx', { customer: r.customer, date: today(), points: -L.rewardPoints, reason: `Resgate: ${L.rewardLabel}` })}>Registrar resgate</button> : `faltam ${L.rewardPoints - r.points}`) }]} />
      <EntityManager entity="loyaltyTx" title="Extrato de pontos" />
    </Page>
  )
}

export function ClientesRecorrentes() {
  const data = useData()
  const v = validSales(data).filter((s) => s.customer)
  const orders = new Map<string, Set<string>>()
  const rev = new Map<string, number>(), last = new Map<string, string>(), first = new Map<string, string>()
  for (const s of v) {
    const k = s.customer
    if (!orders.has(k)) orders.set(k, new Set())
    orders.get(k)!.add(s.orderId || `${s.date}-${s.id}`)
    rev.set(k, (rev.get(k) || 0) + lineRevenue(s))
    if (!last.get(k) || s.date > last.get(k)!) last.set(k, s.date)
    if (!first.get(k) || s.date < first.get(k)!) first.set(k, s.date)
  }
  const rows = [...orders.entries()].map(([c, o]) => ({ customer: c, orders: o.size, revenue: rev.get(c)!, first: first.get(c)!, last: last.get(c)!, daysSince: daysBetween(last.get(c)!, today()) })).sort((a, b) => b.orders - a.orders)
  const recurrent = rows.filter((r) => r.orders >= 2)
  return (
    <Page>
      <Notice>Somente vendas com cliente identificado (coluna "Cliente") entram aqui. {data.sales.length ? pct((v.length / Math.max(1, validSales(data).length)) * 100) : '0%'} das linhas de venda têm cliente.</Notice>
      <Grid cols={4}><Kpi label="Clientes identificados" value={rows.length} /><Kpi label="Recorrentes (2+ pedidos)" value={recurrent.length} /><Kpi label="Taxa de recorrência" value={pct(rows.length ? (recurrent.length / rows.length) * 100 : null)} /><Kpi label="Pedidos por recorrente" value={recurrent.length ? num(mean(recurrent.map((r) => r.orders)), 1) : 'n/d'} /></Grid>
      <DataTable rows={rows} filename="clientes-recorrentes" empty={<Empty>Nenhuma venda com cliente identificado.</Empty>} cols={[{ key: 'customer', label: 'Cliente' }, { key: 'orders', label: 'Pedidos', align: 'right' }, { key: 'revenue', label: 'Gasto total', align: 'right', render: (r) => money(r.revenue) }, { key: 'first', label: 'Primeira compra' }, { key: 'last', label: 'Última compra' }, { key: 'daysSince', label: 'Dias sem comprar', align: 'right' }]} />
    </Page>
  )
}

export function Feedback() {
  const data = useData()
  const { add, update } = useStore()
  const [f, setF] = useState({ customer: '', rating: 5, type: 'elogio', text: '' })
  const avg = data.feedback.filter((x) => x.rating).length ? mean(data.feedback.filter((x) => x.rating).map((x) => Number(x.rating))) : null
  return (
    <Page>
      <Notice>Formulário próprio para registrar feedback recebido no balcão, por telefone ou por mensagem. Avaliações de outras fontes podem ser importadas por planilha. Conexões automáticas com sites de avaliação não estão configuradas.</Notice>
      <Grid cols={4}><Kpi label="Nota média" value={avg != null ? num(avg, 1) : 'n/d'} /><Kpi label="Reclamações abertas" value={data.feedback.filter((x) => x.type === 'reclamacao' && x.status !== 'resolvido').length} tone="warn" /><Kpi label="Sugestões" value={data.feedback.filter((x) => x.type === 'sugestao').length} /><Kpi label="Total" value={data.feedback.length} /></Grid>
      <form className="card grid gap-2 sm:grid-cols-5" data-tour="form" onSubmit={(e) => { e.preventDefault(); if (!f.text) return; add('feedback', { ...f, date: today(), status: 'aberto' }); setF({ customer: '', rating: 5, type: 'elogio', text: '' }) }}>
        <input className="input" placeholder="Cliente (opcional)" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
        <select className="input" value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select>
        <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="elogio">elogio</option><option value="sugestao">sugestão</option><option value="reclamacao">reclamação</option></select>
        <input className="input" placeholder="Comentário *" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <button className="btn-primary">Registrar</button>
      </form>
      <EntityManager entity="feedback" canAdd={false} filters={[{ key: 'type', label: 'Tipo', options: ['elogio', 'sugestao', 'reclamacao'] }, { key: 'status', label: 'Status', options: ['aberto', 'em_andamento', 'resolvido'] }]}
        rowActions={(r) => r.status !== 'resolvido' && <button className="btn-ghost px-2 text-xs" onClick={() => update('feedback', r.id, { status: 'resolvido' })}>Resolver</button>} />
    </Page>
  )
}
