// Sinalização WebRTC via Supabase Realtime (broadcast). A mídia vai ponto a ponto (P2P);
// o Supabase só transporta mensagens pequenas de negociação. Sem Supabase configurado,
// a conexão entre dispositivos fica indisponível (o sistema informa isso, não simula).
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type SignalMsg =
  | { kind: 'join'; camId: string; name: string; role: string; token: string; ua: string }
  | { kind: 'approve'; camId: string } | { kind: 'deny'; camId: string; reason: string }
  | { kind: 'offer'; camId: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; camId: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; camId: string; from: 'host' | 'cam'; cand: RTCIceCandidateInit }
  | { kind: 'ping'; camId: string; t0: number } | { kind: 'pong'; camId: string; t0: number; t1: number; t2: number }
  | { kind: 'stats'; camId: string; w: number; h: number; fps: number; battery?: number; hidden: boolean }
  | { kind: 'bye'; camId: string }
  | { kind: 'role'; camId: string; role: string }
  | { kind: 'scoreboard'; data: unknown } // apenas leitura para espectadores

export const signalingAvailable = !!supabase

export function iceServers(): RTCIceServer[] {
  const s: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const url = import.meta.env.VITE_TURN_URL as string | undefined
  if (url) s.push({ urls: url, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL })
  return s
}

export class Signal {
  private ch: RealtimeChannel | null = null
  private handlers: ((m: SignalMsg) => void)[] = []
  status: 'desconectado' | 'conectando' | 'conectado' | 'erro' | 'indisponivel' = 'desconectado'
  onStatus?: (s: Signal['status']) => void

  constructor(public room: string) {}

  connect(): Promise<void> {
    if (!supabase) { this.setStatus('indisponivel'); return Promise.reject(new Error('Sinalização indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')) }
    this.setStatus('conectando')
    return new Promise((res, rej) => {
      this.ch = supabase!.channel(`ssai:${this.room}`, { config: { broadcast: { self: false, ack: false } } })
      this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this.handlers.forEach((h) => h(payload as SignalMsg)))
      this.ch.subscribe((st) => {
        if (st === 'SUBSCRIBED') { this.setStatus('conectado'); res() }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { this.setStatus('erro'); rej(new Error(st)) }
        else if (st === 'CLOSED') this.setStatus('desconectado')
      })
    })
  }
  private setStatus(s: Signal['status']) { this.status = s; this.onStatus?.(s) }
  on(h: (m: SignalMsg) => void) { this.handlers.push(h); return () => { this.handlers = this.handlers.filter((x) => x !== h) } }
  send(m: SignalMsg) { this.ch?.send({ type: 'broadcast', event: 'm', payload: m }) }
  close() { if (this.ch) supabase?.removeChannel(this.ch); this.ch = null; this.setStatus('desconectado') }
}

/** Estatísticas do receptor: fps, perda de pacotes, jitter e RTT. */
export async function readInboundStats(pc: RTCPeerConnection) {
  const r = await pc.getStats()
  let fps: number | null = null, lost = 0, recv = 0, w = 0, h = 0, rtt: number | null = null, jitter: number | null = null
  r.forEach((s) => {
    if (s.type === 'inbound-rtp' && s.kind === 'video') { fps = s.framesPerSecond ?? null; lost = s.packetsLost ?? 0; recv = s.packetsReceived ?? 0; w = s.frameWidth ?? 0; h = s.frameHeight ?? 0; jitter = s.jitter != null ? s.jitter * 1000 : null }
    if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime != null) rtt = s.currentRoundTripTime * 1000
  })
  return { fps, lossPct: recv + lost > 0 ? (lost / (recv + lost)) * 100 : null, w, h, rtt, jitter }
}
