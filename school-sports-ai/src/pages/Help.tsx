import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import { FAQ } from '../lib/faq'

// Estado honesto de cada recurso nesta versão.
const STATUS: [string, 'funcional' | 'experimental' | 'não implementado', string][] = [
  ['Criar partidas, regras, equipes, uniformes', 'funcional', ''],
  ['Webcam local e análise de vídeo gravado', 'funcional', ''],
  ['Celulares como câmera via QR (WebRTC)', 'funcional', 'Exige Supabase configurado; redes restritivas podem exigir TURN.'],
  ['Detecção de pessoas e bola (COCO-SSD)', 'funcional', 'Modelo genérico; revocação da bola limitada.'],
  ['Rastreamento com IDs e correção manual', 'funcional', ''],
  ['Classificação de equipes por cor', 'funcional', ''],
  ['Calibração por homografia, mapa tático, mapa de calor', 'funcional', ''],
  ['Placar, eventos, confirmação, correção, auditoria', 'funcional', ''],
  ['Gols (futsal), cestas (basquete), fim de rally (vôlei)', 'experimental', 'Candidatos para confirmação; não validados com vídeos anotados.'],
  ['Posse e passes estimados (futsal)', 'experimental', 'Usa projeção da bola no chão.'],
  ['Valor 2/3 automático no basquete', 'experimental', 'Função existe e é testada; associação do arremessador ainda não está ligada ao detector.'],
  ['Fusão multicâmera e diretor automático', 'experimental', ''],
  ['Replays (buffer circular) e School VAR', 'funcional', 'Clipes só na memória da sessão.'],
  ['Placar remoto para espectadores e telão', 'funcional', 'Sem vídeo para espectadores (exige SFU).'],
  ['Relatório, PDF, CSV, JSON, imagem', 'funcional', ''],
  ['Treinos com contadores, editor de atividades, simulador tático', 'funcional', ''],
  ['Estimativa de pose, manchetes, saques, bloqueios automáticos', 'não implementado', 'Requer modelo de pose (ex.: MoveNet) e dados anotados.'],
  ['Leitura de número de camisa', 'não implementado', 'Requer OCR especializado.'],
  ['Triangulação 3D da bola', 'não implementado', 'Requer calibração intrínseca multicâmera.'],
  ['Sincronização do histórico com Supabase', 'não implementado', 'Esquema SQL pronto em supabase/migrations; dados ficam locais.'],
  ['Desfoque de rostos em exportações', 'não implementado', ''],
]

export default function Help() {
  return (
    <div className="space-y-4">
      <h1 className="h1">Central de ajuda</h1>
      <Card title="Estado dos recursos nesta versão">
        <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{STATUS.map(([f, s, n]) => <tr key={f} className="border-b border-line/50"><td className="p-2">{f}</td><td className="p-2"><span className={`chip ${s === 'funcional' ? 'bg-neon/20 text-neon' : s === 'experimental' ? 'bg-pend/20 text-pend' : 'bg-line text-muted'}`}>{s}</span></td><td className="p-2 text-xs text-muted">{n}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Problemas comuns">
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li><b>Câmera não abre:</b> o site precisa estar em HTTPS e a permissão liberada no navegador. Feche outros apps que usam a câmera.</li>
          <li><b>Modelo não carrega:</b> o primeiro carregamento baixa ~5 MB; verifique a internet. Depois fica em cache.</li>
          <li><b>Bola quase nunca detectada:</b> aproxime a câmera, use 1080p, melhore a iluminação e use uma bola de cor contrastante. Registre o placar manualmente.</li>
          <li><b>Equipes trocadas:</b> ajuste as cores na configuração ou defina a equipe clicando no jogador.</li>
          <li><b>Celular não conecta:</b> confira o código da sala, mantenha a tela ligada; em 4G pode ser necessário TURN (veja o README).</li>
        </ul>
      </Card>
      <Card title="Perguntas frequentes">{FAQ.map(([q, a]) => <details key={q} className="border-b border-line py-2"><summary className="cursor-pointer text-sm font-medium">{q}</summary><p className="mt-1 text-sm text-muted">{a}</p></details>)}</Card>
      <Link to="/tutoriais" className="btn-ghost">Ver tutoriais</Link>
    </div>
  )
}
