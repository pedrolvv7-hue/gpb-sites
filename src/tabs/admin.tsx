import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Upload, FileDown, Undo2, CheckCircle2, Play } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useData, useStore, uid, nowISO, Data } from '../data/store'
import { ENTITIES, ENTITY_LIST, EntityKey } from '../data/schema'
import { Page, Kpi, Grid, Section, Empty, Notice, DataTable, ChartBox, Badge, usePeriod, PeriodPicker } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import { parseFile, autoMap, detectEntity, prepare, templateCSV, download, toCSV, ParsedFile, Prepared } from '../lib/importer'
import { money, pct, salesSummary, grossMargin, expensesTotal, previousPeriod } from '../lib/calc'
import { TASKS, runTask, runAll } from '../lib/autopilot'
import { TABS } from './registry'
import { buildDemo } from '../data/demo'
import { TutorialCenter } from '../tutorials/TutorialCenter'

// ------------------------------------------------------------------ 65 SmartImport
interface Job { id: string; parsed: ParsedFile; entity: EntityKey; map: Record<string, string>; confidence: number; unit: string; onlyValid: boolean; done?: string }

export function SmartImport() {
  const data = useData()
  const { bulkAdd, logImport, undoImport, imports } = useStore()
  const [params] = useSearchParams()
  const forced = params.get('tipo') as EntityKey | null
  const [jobs, setJobs] = useState<Job[]>([])
  const [err, setErr] = useState('')
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    setErr('')
    const out: Job[] = []
    for (const f of Array.from(files)) {
      try {
        const parsed = await parseFile(f)
        if (!parsed.rows.length) { setErr((e) => `${e} ${f.name}: arquivo vazio.`); continue }
        const det = detectEntity(parsed.headers)
        const entity = forced && ENTITIES[forced] ? forced : det.entity
        out.push({ id: uid(), parsed, entity, map: autoMap(parsed.headers, entity), confidence: forced ? 1 : det.confidence, unit: '', onlyValid: true })
      } catch (e: any) { setErr((x) => `${x} ${f.name}: ${e.message}`) }
    }
    setJobs((j) => [...j, ...out])
  }
  const setJob = (id: string, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)))
  return (
    <Page>
      <Section title="1. Selecione os arquivos (CSV ou XLSX, vários de uma vez)">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-400 p-8 text-center hover:bg-brand-50 dark:hover:bg-slate-800" data-tour="upload">
          <Upload className="text-brand-500" />
          <span className="font-medium">Toque ou clique para escolher arquivos</span>
          <span className="text-xs text-slate-500">No celular, escolha "Arquivos" ou o app de armazenamento. Separadores ; , e tab são reconhecidos. Datas em DD/MM/AAAA e valores como 1.234,56.</span>
          <input type="file" multiple accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} aria-label="Selecionar arquivos" />
        </label>
        {forced && <p className="mt-2 text-sm">Tipo pré-selecionado: <b>{ENTITIES[forced]?.label}</b></p>}
        {err && <Notice tone="error">{err}</Notice>}
      </Section>
      {jobs.map((j) => <ImportJob key={j.id} job={j} data={data} onChange={(p) => setJob(j.id, p)} onRemove={() => setJobs((js) => js.filter((x) => x.id !== j.id))}
        onConfirm={(prep) => {
          const rows = prep.rows.filter((r) => !r.errors.length && !r.duplicate).map((r) => ({ ...r.record, ...(j.unit && 'unit' in r.record && !r.record.unit ? { unit: j.unit } : {}) }))
          if (!j.onlyValid && prep.invalid) return alert('Há linhas com erro. Corrija o arquivo ou marque "importar somente linhas válidas". Nada foi importado.')
          const importId = uid()
          bulkAdd(j.entity, rows, importId) // operação única: todas as linhas entram juntas
          logImport({ id: importId, at: nowISO(), fileName: j.parsed.name, entity: j.entity, kind: prep.kind, inserted: rows.length, duplicates: prep.duplicates, errors: prep.invalid, errorRows: prep.rows.filter((r) => r.errors.length).slice(0, 200).map((r) => ({ row: r.row, message: r.errors.join('; ') })) })
          setJob(j.id, { done: importId })
        }} />)}
      <Section title="Histórico de importações">
        <DataTable rows={imports} filename="historico-importacoes" empty={<Empty>Nenhuma importação ainda.</Empty>} cols={[
          { key: 'at', label: 'Quando', render: (r) => new Date(r.at).toLocaleString('pt-BR') }, { key: 'fileName', label: 'Arquivo' }, { key: 'entity', label: 'Tipo', render: (r) => ENTITIES[r.entity as EntityKey].label },
          { key: 'kind', label: 'Formato' }, { key: 'inserted', label: 'Inseridos', align: 'right' }, { key: 'duplicates', label: 'Duplicados ignorados', align: 'right' }, { key: 'errors', label: 'Erros', align: 'right' },
          { key: 'act', label: '', csv: () => '', render: (r) => r.undone ? <Badge>desfeita</Badge> : <button className="btn-ghost text-xs" data-tour="undo" onClick={() => confirm(`Remover os ${r.inserted} registros desta importação? Registros editados depois também serão removidos.`) && alert(`${undoImport(r.id)} registros removidos.`)}><Undo2 size={12} /> Desfazer</button> },
        ]} />
      </Section>
      <Section title="Modelos de planilha e arquivos de exemplo">
        <p className="mb-2 text-sm text-slate-500">Modelos vazios com os cabeçalhos reconhecidos. Os arquivos de exemplo contêm dados fictícios, só para treinar: importe-os apenas em ambiente de demonstração.</p>
        <div className="flex flex-wrap gap-2" data-tour="template">
          {ENTITY_LIST.filter((e) => e.fields.some((f) => f.aliases)).map((e) => <button key={e.key} className="btn-ghost text-xs" onClick={() => download(`modelo-${e.key}.csv`, templateCSV(e.key))}><FileDown size={12} /> {e.label}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['sales', 'ingredients', 'recipes', 'expenses', 'suppliers'] as EntityKey[]).map((k) => (
            <button key={k} className="btn-ghost text-xs" onClick={() => { const d: any = buildDemo(); download(`EXEMPLO-${k}.csv`, toCSV(d[k].slice(0, 60), ENTITIES[k].fields.map((f) => ({ key: f.key, label: f.label })))) }}>Exemplo: {ENTITIES[k].label}</button>
          ))}
        </div>
      </Section>
    </Page>
  )
}

function ImportJob({ job, data, onChange, onRemove, onConfirm }: { job: Job; data: Data; onChange: (p: Partial<Job>) => void; onRemove: () => void; onConfirm: (p: Prepared) => void }) {
  const def = ENTITIES[job.entity]
  const units = useStore((s) => s.data.units)
  const prep = useMemo(() => prepare(job.entity, job.parsed, job.map, data, job.unit ? { unit: job.unit } : {}), [job, data])
  const affected = TABS.filter((t) => t.uses?.includes(job.entity))
  if (job.done) return (
    <Notice tone="ok"><CheckCircle2 size={14} className="inline" /> <b>{job.parsed.name}</b>: {prep.valid === 0 ? 'importado' : 'importação concluída'}. Abas atualizadas: {affected.map((t) => <Link key={t.id} className="mr-2 underline" to={t.route}>{t.name}</Link>)}
      <button className="ml-2 underline" onClick={onRemove}>fechar</button></Notice>
  )
  return (
    <Section title={`2. ${job.parsed.name} · ${job.parsed.rows.length} linhas`} actions={<button className="btn-ghost text-xs" onClick={onRemove}>Remover</button>}>
      <div className="grid gap-3 md:grid-cols-3" data-tour="detect">
        <label><span className="label">Tipo de relatório {job.confidence < 0.6 && <Badge tone="amber">confirme: confiança baixa</Badge>}</span>
          <select className="input" value={job.entity} onChange={(e) => { const en = e.target.value as EntityKey; onChange({ entity: en, map: autoMap(job.parsed.headers, en) }) }}>
            {ENTITY_LIST.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select></label>
        {def.fields.some((f) => f.key === 'unit') && units.length > 0 && (
          <label><span className="label">Unidade (para linhas sem unidade)</span><select className="input" value={job.unit} onChange={(e) => onChange({ unit: e.target.value })}><option value="">Nenhuma</option>{units.map((u) => <option key={u.id} value={u.code}>{u.name}</option>)}</select></label>
        )}
        <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={job.onlyValid} onChange={(e) => onChange({ onlyValid: e.target.checked })} /> Importar somente linhas válidas</label>
      </div>
      <h4 className="mb-1 mt-4 text-sm font-semibold">3. Mapeamento de colunas</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-tour="mapping">
        {def.fields.map((f) => (
          <label key={f.key}><span className="label">{f.label}{f.required && ' *'}</span>
            <select className={`input ${f.required && !job.map[f.key] ? 'border-red-400' : ''}`} value={job.map[f.key] || ''} onChange={(e) => onChange({ map: { ...job.map, [f.key]: e.target.value } })}>
              <option value="">(não importar)</option>{job.parsed.headers.map((h) => <option key={h}>{h}</option>)}
            </select></label>
        ))}
      </div>
      <h4 className="mb-1 mt-4 text-sm font-semibold">4. Diagnóstico</h4>
      <div className="flex flex-wrap gap-2 text-sm" data-tour="diagnosis">
        <Badge tone="green">{prep.valid} válidas</Badge><Badge tone="red">{prep.invalid} com erro</Badge><Badge tone="amber">{prep.duplicates} duplicadas (serão ignoradas)</Badge>
        {job.entity === 'sales' && <Badge tone="blue">Formato: {prep.kind}</Badge>}
      </div>
      {prep.warnings.map((w) => <div key={w} className="mt-2"><Notice tone="warn">{w}</Notice></div>)}
      <div className="mt-2 max-h-64 overflow-auto rounded border dark:border-slate-800">
        <table className="min-w-full text-xs"><thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr><th className="th">Linha</th>{def.fields.slice(0, 7).map((f) => <th key={f.key} className="th">{f.label}</th>)}<th className="th">Situação</th></tr></thead>
          <tbody>{prep.rows.slice(0, 50).map((r) => <tr key={r.row} className={r.errors.length ? 'bg-red-50 dark:bg-red-950' : r.duplicate ? 'bg-amber-50 dark:bg-amber-950' : ''}><td className="td">{r.row}</td>{def.fields.slice(0, 7).map((f) => <td key={f.key} className="td">{String(r.record[f.key] ?? '')}</td>)}<td className="td">{r.errors.join('; ') || (r.duplicate ? 'duplicada' : 'ok')}</td></tr>)}</tbody></table>
      </div>
      {prep.invalid > 0 && <button className="btn-ghost mt-2 text-xs" onClick={() => download(`erros-${job.parsed.name}.csv`, toCSV(prep.rows.filter((r) => r.errors.length).map((r) => ({ row: r.row, msg: r.errors.join('; ') })), [{ key: 'row', label: 'Linha' }, { key: 'msg', label: 'Erro' }]))}>Baixar relatório de erros</button>}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" data-tour="confirm" disabled={!prep.valid} onClick={() => onConfirm(prep)}>5. Confirmar importação de {prep.valid} registros</button>
        <span className="text-xs text-slate-500">Abas que serão atualizadas: {affected.map((t) => t.name).join(', ') || 'nenhuma'}</span>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------------ 66 Integrações
const CONNECTORS = [
  { name: 'Importação por planilha (CSV/XLSX)', status: 'disponível', note: 'Funciona com qualquer sistema que exporte relatórios.' },
  { name: 'Banco em nuvem (Supabase)', status: 'requer credenciais', note: 'Necessário para login real, multiusuário e tempo real. Esquema SQL com políticas de acesso incluído em supabase/schema.sql.' },
  { name: 'Plataformas de delivery (API oficial)', status: 'não integrado', note: 'Exige cadastro como parceiro e credenciais da plataforma. Até lá, importe os relatórios exportados.' },
  { name: 'Sistemas de PDV / ERP', status: 'não integrado', note: 'Cada fornecedor tem API própria. Use a exportação de relatórios do seu sistema.' },
  { name: 'Open Finance / extratos bancários', status: 'não integrado', note: 'Importe o extrato em CSV/OFX convertido para CSV.' },
  { name: 'IA generativa (opcional)', status: 'não configurado', note: 'O RestauBrain funciona sem ela. Uma chave de API precisaria ficar em um servidor, nunca no navegador.' },
]
export function Integracoes() {
  const imports = useStore((s) => s.imports)
  return (
    <Page>
      <Notice>Só aparecem como "disponível" os conectores que realmente funcionam nesta versão. Nenhuma compatibilidade é alegada sem integração implementada.</Notice>
      <div className="grid gap-3 md:grid-cols-2" data-tour="table">
        {CONNECTORS.map((c) => (
          <div key={c.name} className="card">
            <div className="flex items-center justify-between"><b>{c.name}</b><Badge tone={c.status === 'disponível' ? 'green' : c.status === 'requer credenciais' ? 'amber' : 'slate'}>{c.status}</Badge></div>
            <p className="mt-1 text-sm text-slate-500">{c.note}</p>
            {c.status === 'disponível' && <p className="mt-1 text-xs">Última sincronização: {imports[0] ? new Date(imports[0].at).toLocaleString('pt-BR') : 'nunca'} · Falhas recentes: {imports.slice(0, 10).reduce((a, i) => a + i.errors, 0)} linha(s)</p>}
          </div>
        ))}
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------ 67 Unidades
export function Unidades() {
  const data = useStore((s) => s.data)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <Page>
      <Notice>Cada registro com o campo "Unidade" pertence a uma unidade. O seletor no topo filtra todas as abas. Registros sem unidade aparecem em todas.</Notice>
      <EntityManager entity="units" extraCols={[
        { key: 'sales', label: 'Linhas de venda', align: 'right', render: (r) => data.sales.filter((s) => s.unit === r.code).length },
        { key: 'emp', label: 'Funcionários', align: 'right', render: (r) => data.employees.filter((s) => s.unit === r.code).length },
      ]} rowActions={(r) => <button className="btn-ghost px-2 text-xs" onClick={() => setSettings({ unitFilter: r.code })}>Ver unidade</button>} />
    </Page>
  )
}

// ------------------------------------------------------------------ 68 Comparação entre unidades
export function ComparacaoUnidades() {
  const all = useStore((s) => s.data)
  const [p, setP] = usePeriod()
  const rows = all.units.map((u) => {
    const d = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, (v as any[]).filter((r) => !r.unit || r.unit === u.code || k === 'recipes' || k === 'ingredients' || k === 'products' || k === 'fees')])) as Data
    d.sales = all.sales.filter((s) => s.unit === u.code)
    d.expenses = all.expenses.filter((s) => s.unit === u.code)
    const s = salesSummary(d, p), prev = salesSummary(d, previousPeriod(p)), gm = grossMargin(d, p), ex = expensesTotal(d, p)
    return { unit: u.name, revenue: s.revenue, orders: s.orders, ticket: s.ticket, var: prev.revenue ? ((s.revenue - prev.revenue) / prev.revenue) * 100 : null, margin: gm.grossPct, cmv: gm.cmv, expenses: ex, expPct: s.revenue ? (ex / s.revenue) * 100 : null, perSeat: u.seats ? s.revenue / Number(u.seats) : null }
  })
  if (all.units.length < 2) return <Page><Empty action={{ to: '/unidades', label: 'Cadastrar unidades' }}>Cadastre ao menos duas unidades para comparar.</Empty></Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>Indicadores proporcionais (ticket, margem %, despesas % do faturamento, faturamento por lugar) permitem comparar unidades de tamanhos diferentes.</Notice>
      <Section title="Faturamento por unidade"><ChartBox height={220}><ResponsiveContainer><BarChart data={rows}><XAxis dataKey="unit" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="revenue" fill="#2563eb" /></BarChart></ResponsiveContainer></ChartBox></Section>
      <DataTable rows={rows} filename="comparacao-unidades" cols={[
        { key: 'unit', label: 'Unidade' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) }, { key: 'var', label: 'Variação', align: 'right', render: (r) => pct(r.var) },
        { key: 'orders', label: 'Pedidos', align: 'right', render: (r) => r.orders ?? 'n/d' }, { key: 'ticket', label: 'Ticket', align: 'right', render: (r) => (r.ticket ? money(r.ticket) : 'n/d') },
        { key: 'margin', label: 'Margem bruta', align: 'right', render: (r) => pct(r.margin) }, { key: 'expenses', label: 'Despesas', align: 'right', render: (r) => money(r.expenses) },
        { key: 'expPct', label: 'Despesas % fat.', align: 'right', render: (r) => pct(r.expPct) }, { key: 'perSeat', label: 'Fat. por lugar', align: 'right', render: (r) => (r.perSeat ? money(r.perSeat) : 'n/d') },
      ]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 69 Tutorial completo
export function TutorialCompleto() {
  return <Page><TutorialCenter /></Page>
}

// ------------------------------------------------------------------ 70 Configurações
export function Configuracoes() {
  const st = useStore()
  const s = st.settings
  const T = s.thresholds
  const exportAll = () => download(`restauprofit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ data: st.data, settings: s, imports: st.imports, audit: st.audit }, null, 2), 'application/json')
  const restore = async (f: File) => {
    try {
      const j = JSON.parse(await f.text())
      if (!j.data) throw new Error('Arquivo sem dados')
      if (!confirm('Substituir todos os dados atuais pelo backup?')) return
      useStore.setState({ data: { ...st.data, ...j.data }, imports: j.imports || [], audit: j.audit || [] })
      alert('Backup restaurado.')
    } catch (e: any) { alert(`Não foi possível restaurar: ${e.message}`) }
  }
  return (
    <Page>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Perfil e empresa">
          <div className="space-y-2" data-tour="form">
            {(['ownerName', 'ownerEmail', 'companyName'] as const).map((k) => (
              <label key={k} className="block"><span className="label">{{ ownerName: 'Nome do proprietário', ownerEmail: 'E-mail', companyName: 'Nome da empresa' }[k]}</span><input className="input" value={s[k]} onChange={(e) => st.setSettings({ [k]: e.target.value })} /></label>
            ))}
          </div>
        </Section>
        <Section title="Preferências">
          <label className="block"><span className="label">Tema</span><select className="input" value={s.theme} onChange={(e) => st.setSettings({ theme: e.target.value as any })}><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.generativeAI} onChange={(e) => st.setSettings({ generativeAI: e.target.checked })} /> Desejo usar IA generativa (requer servidor com chave de API, não incluído)</label>
          <label className="mt-2 block"><span className="label">Notificações</span><span className="text-sm text-slate-500">Os alertas aparecem no sino do topo e na Central de Alertas. Notificações por e-mail ou celular exigem o banco em nuvem.</span></label>
        </Section>
        <Section title="Limites dos alertas">
          <div className="grid grid-cols-2 gap-2" data-tour="thresholds">
            {([['salesDropPct', 'Queda de vendas semanal (%)'], ['minMarginPct', 'Margem mínima por prato (%)'], ['expiryDays', 'Aviso de validade (dias)'], ['staleDays', 'Dados desatualizados após (dias)'], ['expenseZ', 'Sensibilidade de despesas (desvios)'], ['docDays', 'Aviso de documentos (dias)']] as const).map(([k, l]) => (
              <label key={k}><span className="label">{l}</span><input className="input" type="number" step="any" value={T[k]} onChange={(e) => st.setSettings({ thresholds: { ...T, [k]: Number(e.target.value) } })} /></label>
            ))}
          </div>
        </Section>
        <Section title="Dados e segurança">
          <div className="space-y-2 text-sm">
            <Notice tone="warn">Nesta versão os dados ficam somente neste navegador (armazenamento local), separados por dispositivo. Não há login em servidor. Para várias pessoas, login seguro e separação por empresa no servidor, ative o Supabase (ver README e supabase/schema.sql). Faça backups regulares.</Notice>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" data-tour="export" onClick={exportAll}>Exportar todos os dados (JSON)</button>
              <label className="btn-ghost cursor-pointer">Restaurar backup<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              {!s.demo ? <button className="btn-ghost" onClick={() => { if (Object.values(st.data).some((v) => v.length) && !confirm('Carregar a demonstração SUBSTITUI os dados atuais. Exporte um backup antes. Continuar?')) return; st.replaceAll(buildDemo() as any, true) }}>Carregar dados de demonstração</button>
                : <button className="btn-ghost" onClick={() => confirm('Remover os dados de demonstração?') && st.clearAll()}>Sair da demonstração (apagar dados fictícios)</button>}
              <button className="btn-danger" onClick={() => { if (prompt('Para apagar TODOS os dados deste navegador, digite APAGAR') === 'APAGAR') st.clearAll() }}>Excluir todos os dados</button>
            </div>
          </div>
        </Section>
      </div>
      <Section title="Registro de operações (auditoria)"><DataTable rows={st.audit} filename="auditoria" cols={[{ key: 'at', label: 'Quando', render: (r) => new Date(r.at).toLocaleString('pt-BR') }, { key: 'action', label: 'Ação' }, { key: 'detail', label: 'Detalhe' }]} /></Section>
    </Page>
  )
}

// ------------------------------------------------------------------ AutoPilot
export function AutoPilot() {
  const { automation, settings, setSettings } = useStore()
  const [busy, setBusy] = useState(false)
  const modes = [
    { k: 'automatico', t: 'Automático', d: 'Executa cálculos e organização dos dados. Ações externas viram rascunhos.' },
    { k: 'aprovacao', t: 'Com aprovação', d: 'Executa cálculos e prepara ações financeiras para você aprovar.' },
    { k: 'monitoramento', t: 'Monitoramento', d: 'Somente analisa e recomenda. Não cria nada.' },
  ] as const
  return (
    <Page actions={<button className="btn-primary" data-tour="run" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { runAll(); setBusy(false) }, 10) }}><Play size={14} /> Executar todas agora</button>}>
      <Notice>O AutoPilot executa ao abrir o sistema (modo automático) e quando você clica em executar. Ele nunca paga contas, faz compras, envia mensagens ou altera preços: no máximo prepara rascunhos que aguardam sua aprovação.</Notice>
      <div className="grid gap-3 md:grid-cols-3" data-tour="mode">
        {modes.map((m) => (
          <button key={m.k} className={`card text-left ${settings.autopilotMode === m.k ? 'ring-2 ring-brand-500' : ''}`} onClick={() => setSettings({ autopilotMode: m.k })}>
            <b>{m.t}</b><p className="text-sm text-slate-500">{m.d}</p>
          </button>
        ))}
      </div>
      <Section title="Tarefas">
        <div className="divide-y dark:divide-slate-800" data-tour="table">
          {TASKS.map((t) => { const last = automation.find((a) => a.task === t.name)
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="flex-1"><b className="text-sm">{t.name}</b> {t.kind === 'externo' && <Badge tone="amber">exige aprovação</Badge>}<div className="text-xs text-slate-500">{t.describe}</div>
                  {last && <div className="text-xs">Última: {new Date(last.at).toLocaleString('pt-BR')} · <Badge tone={last.status === 'ok' ? 'green' : last.status === 'erro' ? 'red' : 'amber'}>{last.status}</Badge> {last.result}</div>}</div>
                <button className="btn-ghost text-xs" onClick={() => runTask(t.id)}>{last ? 'Reprocessar' : 'Executar'}</button>
              </div>) })}
        </div>
      </Section>
      <Section title="Histórico de execuções">
        <DataTable rows={automation} filename="autopilot" cols={[
          { key: 'at', label: 'Horário', render: (r) => new Date(r.at).toLocaleString('pt-BR') }, { key: 'task', label: 'Tarefa' }, { key: 'mode', label: 'Modo' },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'ok' ? 'green' : r.status === 'erro' ? 'red' : 'amber'}>{r.status}</Badge> },
          { key: 'source', label: 'Origem dos dados' }, { key: 'result', label: 'Resultado', render: (r) => <span className="whitespace-normal text-xs">{r.result}{r.error && <span className="text-red-600"> {r.error}</span>}</span> },
        ]} />
      </Section>
    </Page>
  )
}
