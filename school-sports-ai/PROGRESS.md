# Acompanhamento do projeto

Critério: um item só é "funcional" quando lógica, integração com a interface e teste (unitário ou no navegador) existem. Interface sem lógica não conta.

Última verificação: testes unitários (42 passando), `tsc` sem erros, build de produção ok, teste de ponta a ponta no Chromium (Playwright): todas as rotas carregam sem erro de console; criação de partida; placar manual; carregamento real do COCO-SSD (backend WebGL); análise de um vídeo com pessoas reais, com detecção e rastreamento exibidos no overlay.

## Análise do ambiente e decisões

- O repositório já continha outro projeto (RestauProfit Pro, na raiz). O School Sports AI foi criado em `school-sports-ai/` para não apagá-lo.
- Stack: **Vite + React 18 + TypeScript + Tailwind**, em vez de Next.js. Motivo: o produto é uma SPA que roda IA e WebRTC no cliente; não há renderização no servidor útil, e Vite simplifica hospedagem estática. Componentes próprios em vez de shadcn/ui (mesmo resultado, menos dependências).
- IA: TensorFlow.js + COCO-SSD (Apache-2.0). Não foi incorporado YOLO por causa de licença (AGPL) e porque não há pesos especializados em bola escolar disponíveis com licença clara.
- Sinalização: Supabase Realtime broadcast. Mídia: P2P WebRTC.
- Persistência: local-first (localStorage), com demonstração em memória separada.

## Fases

| Fase | Estado | Observações |
|---|---|---|
| 1 Fundação | Funcional | Rotas, layout retrátil, tema claro/escuro, auth Supabase (login, cadastro, recuperação, troca de senha), assistente de partida com validação Zod, perfis de regras editáveis por esporte. |
| 2 Vídeo | Funcional | Webcam, escolha de dispositivo, upload de vídeo (validação de tipo/tamanho), erros de permissão tratados, modo câmera no celular (qualidade, troca frontal/traseira, zoom/foco/exposição só quando o aparelho oferece, Wake Lock, alerta de segundo plano, microfone nunca ativado), QR Code, aprovação manual, token por sessão, reconexão, estatísticas WebRTC (fps, perda, RTT). WebRTC remoto não foi testado aqui com dois aparelhos reais (requer Supabase configurado). |
| 3 Visão computacional | Funcional (com limites) | COCO-SSD real, rastreador em dois estágios com predição e associação de reserva por distância, Kalman da bola com estados detectada/estimada/perdida/fora/recuperada, equipes por cor LAB com votação acumulada, filtro de espectadores por área calibrada, correção manual de ID/equipe e troca de identidades. Inferência no thread principal (Web Worker com OffscreenCanvas é melhoria futura). |
| 4 Calibração | Funcional | 4 cantos + 2 pontos da linha central, homografia DLT/mínimos quadrados, erro de reprojeção, validação de quadrilátero, desfazer/refazer, por câmera, gols/cestas/rede. Detecção automática de câmera movida: não implementada (o usuário recalibra). |
| 5 Futsal | Parcial | Gol candidato por cruzamento completo entre postes, travessão, trave, retorno, cooldown anti-duplicação (testados). Posse com histerese e estados disputada/livre/não detectada sem redistribuir tempo (testado). Passes e interceptações estimados. Finalizações, defesas, faltas, cartões etc.: registro manual. |
| 6 Basquete | Parcial | Cesta candidata (acima → abaixo do aro, dentro da largura, descendo), aro-saiu, passagem por baixo rejeitada (testados). Classificação 2/3 pelos pés com zona de dúvida (testada) ainda não ligada à identificação do arremessador. Rebotes, assistências, roubos, tocos: manual. |
| 7 Vôlei | Parcial | Máquina de rally (perda momentânea não encerra), travessias da rede, sets com diferença mínima e set decisivo, anti-duplicação por rally (testados). Saques, manchetes, levantamentos, ataques, bloqueios: manual (sem modelo de pose). |
| 8 Multicâmeras | Parcial | Offset de relógio estilo NTP, nível de sincronização, buffer temporal, fusão de eventos com conflito → revisão, associação global de jogadores (testados). Diretor automático com histerese. O buffer temporal e a associação global ainda não estão ligados ao laço ao vivo. |
| 9 Replays e transmissão | Funcional | Buffer circular com MediaRecorder (segmentos completos), clipe automático em eventos de pontuação, School VAR (0,25x–2x, quadro a quadro, zoom, lado a lado, exportação), placar remoto somente leitura, modo telão. Sem vídeo para espectadores (exige SFU). Melhores momentos com edição/legendas: não implementado. |
| 10 Pedagógico | Parcial | Treinos com contadores e aproveitamento, editor de atividades, histórico, simulador tático com quadros animados e jogadas salvas, comparação entre sessões com avisos de comparabilidade. Análise corporal (pose) não implementada. |
| 11 Qualidade | Parcial | 42 testes unitários dos núcleos; e2e manual via Playwright. Acessibilidade: foco visível, rótulos, equipes com forma + letra além de cor, movimento reduzido. Faltam testes e2e automatizados no repositório e auditoria completa de acessibilidade. |
| 12 Publicação | Pronto para deploy | README, `.env.example`, `vercel.json`, PWA com service worker, migração SQL com RLS. Deploy não foi executado nesta sessão. |

## Bloqueado por dependências externas

- Validação dos detectores com vídeos escolares anotados (precisão, revocação, falsos positivos): **não há conjunto de dados**; nenhum número de desempenho foi publicado ou inventado.
- Modelo especializado de bola, modelo de pose, OCR de camisa: exigem escolha de modelos com licença adequada e/ou treinamento.
- TURN e SFU: exigem infraestrutura própria ou paga.

## Próximos passos sugeridos

1. Gravar 5–10 partidas reais por esporte, anotar eventos e medir os detectores (`docs/MODELOS.md`).
2. Mover inferência para Web Worker.
3. Sincronizar partidas com as tabelas do Supabase.
4. Integrar MoveNet (pose) para fundamentos do vôlei e análise corporal.
5. Ligar `JitterBuffer` e `associateGlobal` ao laço multicâmera.
