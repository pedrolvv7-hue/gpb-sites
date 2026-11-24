# Custos potenciais

Não há custo zero garantido para qualquer escala. Estimativas qualitativas:

| Item | Quando surge | Observação |
|---|---|---|
| Hospedagem do frontend | sempre | Planos gratuitos de Vercel/Netlify costumam bastar para uso escolar. |
| Supabase (banco, auth, realtime) | contas e celulares remotos | Plano gratuito tem limites de conexões realtime e armazenamento; escolas com muito uso precisarão de plano pago. |
| Armazenamento de vídeo | se gravações forem enviadas à nuvem | Não implementado; hoje clipes ficam no dispositivo. Vídeo é o maior custo potencial. |
| Servidor TURN | redes 4G/corporativas | Tráfego de vídeo passa pelo servidor; cobra-se por GB. Pode ser coturn próprio. |
| SFU (espectadores com vídeo) | transmissões abertas | Servidor dedicado ou serviço gerenciado; custo cresce com espectadores. |
| Processamento em nuvem | se adotado no futuro | GPU por hora. Não é necessário na versão atual. |
| Treinamento de modelos | modelo especializado | GPU + horas de anotação (o maior custo é humano). |

A IA atual roda no dispositivo e não usa nenhuma API paga.
