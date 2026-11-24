# Arquitetura

## Fluxo de dados por quadro

```
câmera (celular/webcam/arquivo)
  └─ WebRTC P2P ─▶ <video> no computador central
                    └─ CameraPipeline (a cada intervalo adaptativo, round-robin entre câmeras)
                        1. detecção: COCO-SSD → pessoas + bola (coordenadas normalizadas)
                        2. filtro de área: pés fora da quadra calibrada são descartados
                        3. rastreamento: MultiTracker (IoU → reserva por distância) e BallTracker (Kalman)
                        4. equipes: cor mediana do tronco em LAB → votos acumulados
                        5. interpretação: detector do esporte (gol/cesta/rally, posse, passes)
                        6. validação: initialStatus() conforme modo assistido/experimental e limites
                        7. registro: addCandidate() (deduplicação + auditoria) → placar derivado
```

A reprodução do vídeo é independente da inferência. Se a inferência ficar mais lenta que o intervalo alvo, o intervalo cresce automaticamente.

## Separação de responsabilidades

- **Hospedagem do frontend** (Vercel): arquivos estáticos.
- **Sinalização** (Supabase Realtime): mensagens `join/approve/offer/answer/ice/ping/pong/stats/scoreboard` no canal `ssai:<sala>`. Câmeras só são aceitas com o token da sessão e aprovação manual.
- **Mídia**: P2P DTLS/SRTP. STUN público por padrão, TURN por variável de ambiente.
- **IA**: navegador do computador central.
- **Banco**: Supabase PostgreSQL com RLS (escola ↔ membros ↔ partidas).

## Endurecimento recomendado da sinalização

Canais broadcast públicos dependem do segredo da sala + token. Para produção:
1. Usar canais privados (`config: { private: true }`) e políticas RLS em `realtime.messages` que só permitam membros da escola da partida e câmeras com token emitido por uma Edge Function.
2. Expirar o token ao encerrar a partida.

## Escala

- P2P: cada câmera envia um fluxo ao computador central. Bom até ~4–6 câmeras numa rede Wi-Fi decente.
- Espectadores com vídeo: precisa de SFU (LiveKit/mediasoup/Janus). A interface `Signal` e o formato `scoreboard` foram mantidos simples para isso.
- Processamento em servidor (opcional, futuro): receber o fluxo no SFU e rodar o mesmo pipeline em Node/Python com GPU; o contrato de eventos (`Candidate`) não muda.

## Motores esportivos

Cada esporte implementa `SportEngine` (`src/sports/engine.ts`): regras padrão, tipos de evento, ações manuais, detector com estado próprio, estatísticas e rótulo de período. Nada de regra de um esporte é usado em outro (ex.: vôlei não usa posse).

## Limitações técnicas conhecidas

- Homografia vale só no chão. Projeção da bola no chão é usada apenas na posse do futsal (bola majoritariamente rasteira) e documentada como aproximação.
- Gol/cesta com uma câmera é análise 2D: sempre exige confirmação no modo assistido.
- COCO-SSD tem baixa revocação para bolas pequenas/rápidas.
