export interface Tutorial { id: string; title: string; steps: string[]; link?: string }
export const TUTORIALS: { cat: string; items: Tutorial[] }[] = [
  { cat: 'Primeiros passos', items: [
    { id: 'conta', title: 'Criar uma conta', steps: ['Clique em Entrar → Criar conta.', 'Informe e-mail e senha (mín. 8 caracteres).', 'Confirme pelo link enviado ao e-mail.', 'Sem Supabase configurado, use o modo local: os dados ficam no navegador.'], link: '/cadastro' },
    { id: 'iniciar', title: 'Iniciar uma partida', steps: ['Painel → Nova partida.', 'Escolha o esporte.', 'Preencha nome e data (obrigatórios) e ajuste as regras.', 'Configure equipes e câmeras e clique em Criar.'], link: '/nova' },
    { id: 'equipes', title: 'Configurar equipes e uniformes', steps: ['Dê um nome a cada equipe.', 'Escolha a cor principal do uniforme (a da camisa, região do tronco).', 'Se o sistema alertar cores parecidas, use coletes contrastantes.', 'Cadastro de jogadores é opcional: só número e apelido, nunca nome completo.'] },
  ] },
  { cat: 'Câmeras', items: [
    { id: 'qr', title: 'Usar celulares como câmera (QR Code)', steps: ['Na Central de câmeras, clique em "Conectar celulares por QR Code".', 'No celular, escaneie o QR Code e toque em "Permitir câmera e conectar".', 'No computador, clique em Aprovar.', 'Requer o site em HTTPS e a sinalização (Supabase) configurada.'] },
    { id: 'multi', title: 'Conectar múltiplas câmeras', steps: ['Repita o QR Code em cada celular.', 'Defina a função de cada câmera (principal, gol A, cesta B, rede…).', 'Respeite o limite recomendado de câmeras analisadas para o seu computador.', 'Se uma câmera cair, as outras continuam; o celular pode reconectar pelo mesmo link.'] },
    { id: 'posicionar', title: 'Posicionar corretamente', steps: ['Fora da área de jogo, em local seguro e autorizado.', 'O mais alto possível, estável (tripé ou suporte).', 'Evite contraluz (janelas atrás da quadra).', 'Veja os diagramas no Guia de posicionamento.'], link: '/posicionamento/futsal' },
    { id: 'conexao', title: 'Resolver problemas de conexão', steps: ['Celular e computador na mesma rede Wi-Fi ajudam.', 'Redes móveis (4G) podem exigir um servidor TURN.', 'Mantenha a tela do celular ligada e o navegador em primeiro plano.', 'Use "Reconectar" no celular ou no computador.'] },
    { id: 'resolucao', title: 'Escolher resolução', steps: ['Equilibrada (720p) é o padrão recomendado.', 'Alta (1080p) melhora a detecção da bola, mas aumenta rede e bateria.', 'Economia de bateria para treinos longos.'] },
  ] },
  { cat: 'Calibração', items: [
    { id: 'quadra', title: 'Calibrar a quadra', steps: ['Abra Calibração e escolha a câmera.', 'Clique nos 4 cantos na ordem indicada.', 'Marque as duas pontas da linha central para medir a qualidade.', 'Erro abaixo de 0,3 m é bom. Salve.'] },
    { id: 'gols', title: 'Calibrar gols, cestas e rede', steps: ['Futsal: aba Gols, clique nos dois postes e no travessão; escolha a equipe que defende.', 'Basquete: aba Cestas, clique no centro e na borda do aro.', 'Vôlei: aba Rede, clique nas duas pontas superiores.'] },
    { id: 'recalibrar', title: 'Recalibrar após movimentação', steps: ['Se a câmera for tocada ou movida, as linhas desenhadas não coincidirão com as reais.', 'Abra Calibração e remarque. Use desfazer/refazer à vontade.'] },
  ] },
  { cat: 'Inteligência artificial', items: [
    { id: 'jogadores', title: 'Como os jogadores são detectados', steps: ['Modelo COCO-SSD (TensorFlow.js) detecta pessoas em cada quadro analisado.', 'Pessoas com os pés fora da quadra calibrada são ignoradas (espectadores).', 'Um rastreador associa detecções entre quadros e mantém IDs temporários.', 'Clique em um jogador para renomear, definir equipe ou trocar identidades confundidas.'] },
    { id: 'equipes-ia', title: 'Como as equipes são identificadas', steps: ['A cor mediana do tronco é comparada com as cores cadastradas (espaço LAB, tolerante a sombras).', 'A equipe só é definida após vários quadros concordarem.', 'Sem concordância: "Equipe indefinida".'] },
    { id: 'bola', title: 'Como a bola é rastreada', steps: ['O modelo genérico detecta "bola esportiva" com baixa frequência em bolas pequenas e rápidas.', 'Um filtro de Kalman estima a posição por poucos quadros quando ela some (marcador tracejado).', 'Depois disso: "bola não detectada". Nenhum evento é criado com posições estimadas.'] },
    { id: 'confianca', title: 'Como funciona a confiança e como corrigir erros', steps: ['Cada evento tem uma pontuação interna; ela não é probabilidade de acerto.', 'No modo assistido, todo ponto aguarda sua confirmação.', 'Na Central de acontecimentos, corrija equipe, jogador ou pontuação; tudo fica no histórico.'] },
  ] },
  { cat: 'Por esporte', items: [
    { id: 'futsal', title: 'Futsal: gols, posse e passes', steps: ['Gol candidato: bola vista cruzando a linha entre os postes e permanecendo dentro.', 'Posse: jogador a até 1 m da bola por 0,4 s. Tempo disputado, livre ou sem bola não é distribuído.', 'Passe: controle muda entre jogadores da mesma equipe; interceptação, entre equipes.'] },
    { id: 'basquete', title: 'Basquete: cestas e pontuação', steps: ['Cesta candidata: bola vista acima do aro e depois abaixo, dentro da largura do aro.', 'O valor (2 ou 3) deve ser confirmado; a sugestão usa a posição dos pés quando calibrada.', 'Lances livres pelo controle manual (+1).'] },
    { id: 'volei', title: 'Vôlei: rallies, pontos e sets', steps: ['Rally começa quando a bola se move; travessias da rede são contadas.', 'Termina quando a bola para ou some por mais de 2,5 s.', 'O ponto é sugerido pelo último lado observado e sempre aguarda confirmação.', 'Sets são calculados pelas regras configuradas (pontos, diferença mínima, set decisivo).'] },
  ] },
  { cat: 'Recursos adicionais', items: [
    { id: 'replay', title: 'Replays e School VAR', steps: ['Autorize a gravação em Privacidade.', 'Pontos candidatos geram clipe automaticamente; use "Salvar replay" para jogadas manuais.', 'Na Central de acontecimentos: velocidades de 0,25x a 2x, quadro a quadro e zoom.'] },
    { id: 'telao', title: 'Modo telão e transmissão privada', steps: ['Na central ao vivo, clique em Telão para abrir o placar em outra janela (projetor).', 'Espectadores remotos entram em Assistir transmissão com o código da sala.', 'Eles veem apenas placar e eventos confirmados.'] },
    { id: 'relatorio', title: 'Exportar relatórios', steps: ['Ao encerrar, o relatório abre automaticamente.', 'Exporte PDF (impressão), CSV, JSON ou imagem do placar.'] },
    { id: 'dados', title: 'Proteger os dados dos alunos', steps: ['Configure retenção automática em Privacidade.', 'Exclua partidas individualmente no relatório ou tudo de uma vez.', 'Não use vídeos de alunos para treinar modelos sem autorização específica.'] },
  ] },
]
