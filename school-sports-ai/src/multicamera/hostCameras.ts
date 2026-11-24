// Lado do computador central: recebe câmeras remotas por WebRTC, com aprovação manual,
// reconexão e medição de latência/sincronização. A queda de uma câmera não afeta as outras.
import { Signal, iceServers, readInboundStats, type SignalMsg } from '../streaming/signaling'
import { estimateOffset, type PingSample } from './sync'

export interface RemoteCam {
  camId: string
  name: string
  role: string
  ua: string
  state: 'pendente' | 'conectando' | 'ao_vivo' | 'desconectada' | 'recusada'
  stream?: MediaStream
  pc?: RTCPeerConnection
  lastFrameAt?: number
  fps?: number | null
  w?: number
  h?: number
  lossPct?: number | null
  rtt?: number | null
  hidden?: boolean
  pings: PingSample[]
  offsetMs?: number
  jitterMs?: number
}

export class HostCameras {
  cams = new Map<string, RemoteCam>()
  signal: Signal
  private timers: number[] = []
  onChange?: () => void

  constructor(public room: string, public token: string, public maxCams: number) { this.signal = new Signal(room) }

  async start() {
    await this.signal.connect()
    this.signal.on((m) => this.handle(m))
    this.timers.push(window.setInterval(() => this.poll(), 2000))
  }

  private emit() { this.onChange?.() }

  private handle(m: SignalMsg) {
    if (!('camId' in m)) return
    const cam = this.cams.get(m.camId)
    switch (m.kind) {
      case 'join': {
        if (m.token !== this.token) { this.signal.send({ kind: 'deny', camId: m.camId, reason: 'Token inválido. Escaneie o QR Code atual.' }); return }
        const live = [...this.cams.values()].filter((c) => c.state === 'ao_vivo' || c.state === 'conectando').length
        if (live >= this.maxCams && !cam) { this.signal.send({ kind: 'deny', camId: m.camId, reason: 'Limite de câmeras atingido para este computador.' }); return }
        this.cams.set(m.camId, { ...(cam ?? { pings: [] }), camId: m.camId, name: m.name, role: m.role, ua: m.ua, state: cam?.state === 'ao_vivo' ? 'ao_vivo' : 'pendente', pings: cam?.pings ?? [] })
        // reconexão de uma câmera já aprovada: aprova automaticamente
        if (cam && cam.state !== 'recusada' && cam.state !== 'pendente') this.approve(m.camId)
        break
      }
      case 'offer': this.onOffer(m.camId, m.sdp); break
      case 'ice': if (m.from === 'cam' && cam?.pc) cam.pc.addIceCandidate(m.cand).catch(() => {}); break
      case 'pong': if (cam) { cam.pings = [...cam.pings.slice(-9), { t0: m.t0, t1: m.t1, t2: m.t2, t3: Date.now() }]; const o = estimateOffset(cam.pings); if (o) { cam.offsetMs = o.offsetMs; cam.jitterMs = o.jitterMs } } break
      case 'stats': if (cam) { cam.hidden = m.hidden } break
      case 'bye': if (cam) { cam.state = 'desconectada'; cam.pc?.close(); cam.stream = undefined } break
    }
    this.emit()
  }

  approve(camId: string) {
    const c = this.cams.get(camId); if (!c) return
    c.state = 'conectando'
    this.signal.send({ kind: 'approve', camId })
    this.emit()
  }
  deny(camId: string) {
    const c = this.cams.get(camId); if (!c) return
    c.state = 'recusada'
    this.signal.send({ kind: 'deny', camId, reason: 'Conexão recusada pelo professor.' })
    this.emit()
  }
  disconnect(camId: string) {
    const c = this.cams.get(camId); if (!c) return
    c.pc?.close(); c.stream = undefined; c.state = 'desconectada'
    this.signal.send({ kind: 'deny', camId, reason: 'Desconectada pelo professor.' })
    this.emit()
  }
  setRole(camId: string, role: string) { const c = this.cams.get(camId); if (c) { c.role = role; this.signal.send({ kind: 'role', camId, role }); this.emit() } }

  private async onOffer(camId: string, sdp: RTCSessionDescriptionInit) {
    const c = this.cams.get(camId); if (!c || c.state === 'recusada' || c.state === 'pendente') return
    c.pc?.close()
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    c.pc = pc
    pc.ontrack = (e) => { c.stream = e.streams[0]; c.state = 'ao_vivo'; c.lastFrameAt = Date.now(); this.emit() }
    pc.onicecandidate = (e) => { if (e.candidate) this.signal.send({ kind: 'ice', camId, from: 'host', cand: e.candidate.toJSON() }) }
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) { c.state = 'desconectada'; this.emit() } }
    await pc.setRemoteDescription(sdp)
    const ans = await pc.createAnswer()
    await pc.setLocalDescription(ans)
    this.signal.send({ kind: 'answer', camId, sdp: ans })
  }

  private async poll() {
    for (const c of this.cams.values()) {
      if (c.state !== 'ao_vivo' || !c.pc) continue
      this.signal.send({ kind: 'ping', camId: c.camId, t0: Date.now() })
      try {
        const s = await readInboundStats(c.pc)
        c.fps = s.fps; c.lossPct = s.lossPct; c.rtt = s.rtt; c.w = s.w; c.h = s.h
        if (s.fps && s.fps > 0) c.lastFrameAt = Date.now()
      } catch { /* conexão encerrando */ }
    }
    this.emit()
  }

  broadcastScoreboard(data: unknown) { this.signal.send({ kind: 'scoreboard', data }) }

  stop() { this.timers.forEach(clearInterval); for (const c of this.cams.values()) c.pc?.close(); this.signal.close() }
}
