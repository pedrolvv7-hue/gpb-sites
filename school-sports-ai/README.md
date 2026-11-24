# School Sports AI

**Inteligência esportiva em tempo real.** Tecnologia profissional para o esporte escolar.

Plataforma web para futsal, basquete e vôlei escolares: celulares viram câmeras, o computador detecta jogadores e bola com um modelo de IA que roda no próprio navegador, e o professor confirma gols, cestas e pontos. Sem aplicativo, sem sensores, sem API paga.

Estado detalhado de cada recurso (funcional, experimental, não implementado): [`PROGRESS.md`](PROGRESS.md) e a página **Ajuda** do site.

## Executar localmente

Requer Node 20+.

```bash
cd school-sports-ai
npm install
npm run dev          # http://localhost:5173
npm test             # testes unitários (Vitest)
npm run typecheck    # TypeScript
npm run build        # gera dist/
```

A câmera só funciona em `localhost` ou HTTPS. Para testar com um celular na rede local, use HTTPS (por exemplo `npx vite --host` atrás de um túnel HTTPS) e configure o Supabase.

Sem nenhuma variável de ambiente, o site funciona em **modo local**: partidas no navegador, webcam do computador e vídeos gravados. Conectar celulares, contas e transmissões exigem o Supabase.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

| Variável | Uso |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Login e sinalização WebRTC (Realtime). A chave anon é pública; a proteção vem do RLS. **Nunca** use a `service_role` no frontend. |
| `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` | Servidor TURN opcional para redes com NAT restritivo (4G, redes corporativas). |

## Supabase

1. Crie um projeto em supabase.com.
2. SQL Editor → execute `supabase/migrations/0001_schema.sql` (tabelas, índices, restrições, RLS, funções de placar público e retenção).
3. Authentication → URL Configuration → Site URL = endereço do site.
4. Realtime já vem habilitado; a sinalização usa canais *broadcast* `ssai:<sala>`. Para endurecer, ative canais privados com políticas em `realtime.messages` (ver `docs/ARQUITETURA.md`).

Observação: nesta versão a interface ainda salva as partidas no navegador. O esquema está pronto para a sincronização (próxima etapa).

## Modelo de IA

- **COCO-SSD** (`@tensorflow-models/coco-ssd`, Apache-2.0), classes `person` e `sports ball`.
- Os pesos são baixados no primeiro uso (~5 MB `lite_mobilenet_v2`, maior no perfil Avançado) dos servidores do TensorFlow e ficam em cache do navegador.
- Para trocar por um modelo especializado (por exemplo um detector de bola treinado em vídeos escolares exportado para ONNX/TF.js), implemente a interface `ObjectDetector` em `src/vision/detector.ts`. Antes de usar pesos YOLO, verifique a licença: várias versões são AGPL-3.0 e exigem licença comercial para uso fechado. Detalhes em `docs/MODELOS.md`.

## Publicar

**Frontend (Vercel ou similar):** importe o repositório, defina *Root Directory* = `school-sports-ai`, framework Vite, build `npm run build`, saída `dist`. O `vercel.json` já faz o redirecionamento de SPA. Configure as variáveis de ambiente no painel. HTTPS é automático.

A Vercel hospeda só os arquivos estáticos. Ela **não** é servidor de mídia nem TURN. A arquitetura separa:

| Peça | Onde roda |
|---|---|
| Interface + IA | Navegador (arquivos estáticos na Vercel) |
| Sinalização WebRTC | Supabase Realtime |
| Mídia câmera → computador | P2P (WebRTC), com TURN opcional (coturn próprio ou serviço gerenciado) |
| Vídeo para muitos espectadores | Não implementado: exige SFU (LiveKit, mediasoup, Janus) |
| Banco e autenticação | Supabase (PostgreSQL + RLS) |

Custos possíveis: `docs/CUSTOS.md`.

## Estrutura

```
src/
  app/            rotas, layout, autenticação
  pages/          telas (ao vivo, câmeras, calibração, relatório, VAR…)
  components/     UI, quadra SVG, overlays, simulação de demonstração
  sports/         motores: futsal/, basketball/, volleyball/ (regras, detectores, estatísticas)
  vision/         detector (COCO-SSD), cor de uniforme (LAB), pipeline por câmera
  tracking/       rastreador multiobjeto (estilo ByteTrack) e Kalman da bola
  calibration/    homografia (DLT), qualidade, ponto dos pés
  multicamera/    sincronização de relógios, buffer temporal, fusão, sessão de câmeras
  streaming/      sinalização e estatísticas WebRTC
  events/         registro de eventos, placar derivado, auditoria
  analytics/      distância, velocidade, mapa de calor
  replay/         buffer circular de vídeo (MediaRecorder)
  store/          estado (zustand), separação real × demonstração
  tests/          testes
supabase/migrations/  esquema SQL
docs/             arquitetura, modelos, custos
```

Para adicionar um esporte: crie `src/sports/<esporte>/index.ts` implementando `SportEngine` (`src/sports/engine.ts`) e registre em `src/sports/index.ts`.
