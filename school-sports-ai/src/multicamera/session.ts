// Sessão de fontes de vídeo da partida (mantida em memória enquanto a aba estiver aberta).
import { create } from 'zustand'
import { HostCameras } from './hostCameras'
import { shortCode } from '../lib/util'
import { detectCapabilities, recommendedStreams } from '../lib/capabilities'

export interface Source {
  id: string
  name: string
  role: string
  kind: 'local' | 'arquivo' | 'remota'
  stream?: MediaStream
  fileUrl?: string
  active: boolean // incluída na análise
}

interface SessionState {
  matchId: string | null
  room: string | null
  token: string | null
  host: HostCameras | null
  locals: Source[]
  tick: number
  error: string | null
  ensure: (matchId: string) => void
  addWebcam: (deviceId?: string) => Promise<void>
  addFile: (f: File) => void
  remove: (id: string) => void
  toggle: (id: string) => void
  rename: (id: string, name: string, role: string) => void
  startRemote: () => Promise<void>
  sources: () => Source[]
}

export const useSession = create<SessionState>((set, get) => ({
  matchId: null, room: null, token: null, host: null, locals: [], tick: 0, error: null,
  ensure: (matchId) => {
    if (get().matchId === matchId) return
    get().host?.stop()
    get().locals.forEach((s) => s.stream?.getTracks().forEach((t) => t.stop()))
    set({ matchId, room: shortCode(), token: shortCode() + shortCode(), host: null, locals: [], error: null })
  },
  addWebcam: async (deviceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      const n = get().locals.length + 1
      set((s) => ({ error: null, locals: [...s.locals, { id: `local-${n}-${Date.now()}`, name: stream.getVideoTracks()[0]?.label || `Webcam ${n}`, role: 'principal', kind: 'local', stream, active: true }] }))
    } catch (e) {
      const name = (e as DOMException).name
      set({ error: name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.' : name === 'NotFoundError' ? 'Nenhuma câmera encontrada neste dispositivo.' : name === 'NotReadableError' ? 'A câmera está em uso por outro aplicativo.' : `Câmera indisponível (${name || 'erro desconhecido'}).` })
    }
  },
  addFile: (f) => {
    if (!f.type.startsWith('video/')) { set({ error: 'Arquivo inválido: selecione um vídeo (MP4, WebM ou MOV).' }); return }
    if (f.size > 4 * 1024 ** 3) { set({ error: 'Vídeo maior que 4 GB não é suportado no navegador.' }); return }
    set((s) => ({ error: null, locals: [...s.locals, { id: `file-${Date.now()}`, name: f.name, role: 'principal', kind: 'arquivo', fileUrl: URL.createObjectURL(f), active: true }] }))
  },
  remove: (id) => set((s) => {
    const x = s.locals.find((l) => l.id === id)
    x?.stream?.getTracks().forEach((t) => t.stop()); if (x?.fileUrl) URL.revokeObjectURL(x.fileUrl)
    if (!x) s.host?.disconnect(id)
    return { locals: s.locals.filter((l) => l.id !== id), tick: s.tick + 1 }
  }),
  toggle: (id) => set((s) => ({ locals: s.locals.map((l) => (l.id === id ? { ...l, active: !l.active } : l)), tick: s.tick + 1 })),
  rename: (id, name, role) => {
    set((s) => ({ locals: s.locals.map((l) => (l.id === id ? { ...l, name, role } : l)), tick: s.tick + 1 }))
    get().host?.setRole(id, role)
  },
  startRemote: async () => {
    const { room, token, host } = get()
    if (host || !room || !token) return
    const h = new HostCameras(room, token, Math.max(2, recommendedStreams(detectCapabilities()) + 2))
    h.onChange = () => set((s) => ({ tick: s.tick + 1 }))
    set({ host: h })
    try { await h.start() } catch (e) { set({ error: e instanceof Error ? e.message : 'Falha na sinalização.', host: null }) }
  },
  sources: () => {
    const { locals, host } = get()
    const remotes: Source[] = host ? [...host.cams.values()].filter((c) => c.state === 'ao_vivo' && c.stream).map((c) => ({ id: c.camId, name: c.name, role: c.role, kind: 'remota', stream: c.stream, active: true })) : []
    return [...locals, ...remotes]
  },
}))
