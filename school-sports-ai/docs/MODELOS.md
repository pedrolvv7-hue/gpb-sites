# Modelos de IA

## Em uso

| Modelo | Tarefa | Licença | Origem dos pesos |
|---|---|---|---|
| COCO-SSD lite_mobilenet_v2 / mobilenet_v2 | pessoas e "sports ball" | Apache-2.0 | baixados em tempo de execução pelo pacote `@tensorflow-models/coco-ssd` |

## Como trocar o detector

Implemente `ObjectDetector` (`src/vision/detector.ts`) retornando `Detection[]` com caixas normalizadas e classes `person`/`ball`. Exemplos: um modelo ONNX via `onnxruntime-web` (WebGPU/WASM) ou um modelo TF.js convertido.

### Atenção a licenças

- Ultralytics YOLOv5/v8/v11: AGPL-3.0 (código e pesos). Uso em produto fechado exige licença comercial.
- Alternativas permissivas a avaliar: RT-DETR (Apache-2.0, implementação do PaddleDetection), YOLOX (Apache-2.0), modelos MediaPipe (Apache-2.0, pesos com termos próprios).
- Sempre verifique a licença do **conjunto de dados** usado para treinar os pesos.

## Validação (pendente)

Nenhuma métrica de precisão foi medida: não há vídeos anotados. Protocolo proposto:
1. Gravar partidas reais com autorização (5–10 por esporte, câmeras em posições do guia).
2. Anotar manualmente: gols/cestas/pontos (instante e equipe), saídas de bola, passes (amostra).
3. Rodar a análise offline (vídeo enviado) e exportar o JSON do relatório.
4. Casar eventos com janela de ±1,5 s e medir precisão, revocação, falsos positivos/negativos, trocas de ID, latência e cobertura.
5. Calibrar `thresholds.auto` e `thresholds.min` a partir das curvas obtidas.

## Futuro

- Detector de bola especializado (treinado em quadras escolares).
- MoveNet/BlazePose para pose (fundamentos, saltos, análise corporal).
- OCR de número de camisa.
