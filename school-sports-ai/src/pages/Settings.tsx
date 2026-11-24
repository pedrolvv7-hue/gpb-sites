import { useStore, defaultSettings } from '../store/store'
import { Card, Field, Notice } from '../components/ui'

export default function SettingsPage() {
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  return (
    <div className="space-y-4">
      <h1 className="h1">Configurações</h1>
      <Card title="Geral">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tema"><select className="input" value={s.theme} onChange={(e) => set({ theme: e.target.value as 'dark' })}><option value="dark">Escuro</option><option value="light">Claro</option></select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} />Reduzir animações</label>
        </div>
      </Card>
      <Card title="Inteligência artificial">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Perfil" hint="Leve: modelo menor e mais rápido. Avançado: modelo maior (mais preciso, mais lento). Estimativa de pose não está integrada nesta versão.">
            <select className="input" value={s.aiProfile} onChange={(e) => set({ aiProfile: e.target.value as 'leve', inferFps: e.target.value === 'leve' ? 5 : e.target.value === 'avancado' ? 12 : 8 })}><option value="leve">Leve</option><option value="equilibrado">Equilibrado</option><option value="avancado">Avançado</option></select></Field>
          <Field label={`Inferências por segundo (alvo): ${s.inferFps}`} hint="O sistema reduz automaticamente se o dispositivo não acompanhar."><input type="range" min={1} max={20} value={s.inferFps} onChange={(e) => set({ inferFps: +e.target.value })} className="w-full" /></Field>
          <Field label={`Score mínimo de detecção de pessoas: ${s.detectScore.toFixed(2)}`}><input type="range" min={0.2} max={0.8} step={0.05} value={s.detectScore} onChange={(e) => set({ detectScore: +e.target.value })} className="w-full" /></Field>
          <Field label={`Limite para confirmação automática: ${s.thresholds.auto.toFixed(2)}`} hint="Só usado no modo automático experimental, e só com 2+ câmeras concordando."><input type="range" min={0.5} max={0.99} step={0.01} value={s.thresholds.auto} onChange={(e) => set({ thresholds: { ...s.thresholds, auto: +e.target.value } })} className="w-full" /></Field>
          <Field label={`Abaixo disto, evento é indeterminado: ${s.thresholds.min.toFixed(2)}`}><input type="range" min={0} max={0.5} step={0.01} value={s.thresholds.min} onChange={(e) => set({ thresholds: { ...s.thresholds, min: +e.target.value } })} className="w-full" /></Field>
        </div>
        <div className="mt-3"><Notice kind="warn">Os limites de confiança ainda não foram calibrados com vídeos anotados. A "confiança" mostrada é uma pontuação interna dos detectores, não uma probabilidade de acerto.</Notice></div>
      </Card>
      <Card title="Vídeo e replay">
        <Field label={`Duração do buffer de replay: ${s.replaySeconds} s`} hint="Cada clipe cobre aproximadamente entre metade e o valor total antes do evento."><select className="input" value={s.replaySeconds} onChange={(e) => set({ replaySeconds: +e.target.value })}>{[10, 20, 30, 60].map((x) => <option key={x} value={x}>{x} s</option>)}</select></Field>
        <p className="mt-2 text-sm text-muted">Gravação: {s.recordingAllowed ? 'autorizada' : 'desligada'} (altere em Privacidade).</p>
      </Card>
      <button className="btn-ghost" onClick={() => set(defaultSettings)}>Restaurar padrões</button>
    </div>
  )
}
