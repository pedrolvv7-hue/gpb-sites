import { useStore, useDemo } from '../store/store'
import { clipStore } from '../replay/ringRecorder'
import { Card, Field, Notice } from '../components/ui'
import { download } from '../lib/util'

export default function Privacy() {
  const s = useStore((x) => x.settings)
  const set = useStore((x) => x.setSettings)
  const matches = useStore((x) => x.matches)
  const deleteAll = useStore((x) => x.deleteAll)
  return (
    <div className="space-y-4">
      <h1 className="h1">Privacidade e proteção dos alunos</h1>
      <Notice kind="info">Sem reconhecimento facial, sem biometria, sem reconhecimento de emoções. Jogadores são identificados por IDs temporários e, opcionalmente, número de camisa e apelido. A escola é responsável por definir sua política de uso conforme a LGPD e as regras de proteção de menores, incluindo autorização dos responsáveis para gravação.</Notice>
      <Card title="Gravação">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.recordingAllowed} onChange={(e) => set({ recordingAllowed: e.target.checked })} /><span><b>Gravação de replays autorizada</b><br /><span className="text-muted">Confirme que há autorização da escola e dos responsáveis. Clipes ficam somente na memória desta aba e são descartados ao fechá-la, a menos que você exporte um arquivo.</span></span></label>
        <p className="mt-2 text-xs text-muted">Clipes em memória agora: {[...clipStore.values()].reduce((a, c) => a + c.length, 0)}</p>
        <button className="btn-ghost btn-sm mt-2" onClick={() => { for (const c of clipStore.values()) c.forEach((x) => URL.revokeObjectURL(x.url)); clipStore.clear() }}>Apagar todos os clipes</button>
      </Card>
      <Card title="Retenção">
        <Field label="Excluir partidas encerradas automaticamente após" hint="Aplicado ao abrir o site."><select className="input w-48" value={s.retentionDays} onChange={(e) => set({ retentionDays: +e.target.value })}>{[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}</select></Field>
        <p className="mt-2 text-xs text-muted">Dados salvos: {Object.keys(matches).length} partida(s), somente neste navegador. Nenhum quadro de vídeo é salvo; apenas eventos e posições agregadas (1 por segundo).</p>
      </Card>
      <Card title="Transmissões">
        <p className="text-sm text-muted">Transmissões são privadas por padrão: só acessa quem tem o código da sala. Espectadores recebem apenas placar e acontecimentos confirmados, sem vídeo individual e sem dados dos alunos. Não há publicação automática em redes sociais.</p>
      </Card>
      <Card title="Seus dados">
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => download('school-sports-ai-dados.json', JSON.stringify({ matches, settings: s }, null, 2))}>Exportar todos os dados</button>
          <button className="btn-danger" onClick={() => { if (confirm('Excluir TODAS as partidas deste navegador? Não pode ser desfeito.')) { deleteAll(); useDemo.getState().clear(); clipStore.clear() } }}>Excluir todos os dados</button>
        </div>
        <p className="mt-2 text-xs text-muted">Desfoque de rostos em exportações: não implementado nesta versão (exigiria um detector de rostos adicional). Exporte clipes apenas com autorização.</p>
      </Card>
    </div>
  )
}
