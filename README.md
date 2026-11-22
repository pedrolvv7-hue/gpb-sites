# RestauProfit Pro

Plataforma de gestão e inteligência para restaurantes: 70 abas em 10 categorias, AutoPilot AI, Central de Tutoriais com tour interativo, Importação Inteligente (CSV/XLSX) e gestão multiunidade. Interface em português.

## Executar

```bash
npm install --legacy-peer-deps
npm run dev        # desenvolvimento em http://localhost:5173
npm test           # 184 testes (Vitest + Testing Library)
npm run build      # gera dist/
```

Para experimentar: Configurações → "Carregar dados de demonstração" (dados fictícios, com faixa de aviso).

## Publicar na Vercel

1. Em vercel.com → Add New → Project → importe este repositório do GitHub.
2. Framework: **Vite**. Build: `npm run build`. Output: `dist`. Install command: `npm install --legacy-peer-deps`.
3. `vercel.json` já redireciona todas as rotas para `index.html` (SPA).
Cada push na branch configurada gera nova publicação automaticamente.

## Arquitetura

| Camada | Arquivo |
|---|---|
| Esquema de todas as entidades (formulários, importação, modelos, validação) | `src/data/schema.ts` |
| Estado, persistência, histórico de preços, auditoria, desfazer importação | `src/data/store.ts` |
| Serviço único de cálculos (decimal.js) | `src/lib/calc.ts` |
| Motor de alertas | `src/lib/alerts.ts` |
| SmartImport (CSV/XLSX, detecção, mapeamento, validação, duplicatas) | `src/lib/importer.ts` |
| RestauBrain (respostas determinísticas com fontes) | `src/lib/brain.ts` |
| AutoPilot (tarefas, modos, histórico) | `src/lib/autopilot.ts` |
| Registro das 70 abas + AutoPilot (rota, categoria, tour, entidades usadas) | `src/tabs/registry.tsx` |
| Telas por categoria | `src/tabs/*.tsx` |
| Tutoriais por aba, guias, Central e página de 20 seções | `src/tutorials/` |
| Esquema SQL com RLS para migrar ao Supabase | `supabase/schema.sql` |

Stack: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide, Zustand, PapaParse, SheetJS, decimal.js, Zod (dependência disponível; a validação atual usa as regras do esquema em `importer.ts`).
Não foi usado shadcn/ui: os componentes base estão em `src/components/ui.tsx`.

## Limitações importantes (versão atual)

- **Dados ficam no navegador** (localStorage, ~5 MB). Não há login em servidor, separação por empresa no backend nem sincronização entre dispositivos. Backup/restauração em JSON em Configurações.
- Para produção multiusuário: criar projeto Supabase, aplicar `supabase/schema.sql`, implementar a camada de persistência remota e o login (Supabase Auth). Isso exige credenciais que não estão configuradas.
- Integrações externas (plataformas de delivery, PDV/ERP, bancos, IA generativa) **não estão implementadas**; a Central de Integrações mostra isso. Toda entrada de dados é por planilha ou cadastro.
- PDF é gerado pela impressão do navegador. Leitura de PDF/imagem de documentos e leitura de código de barras por câmera não estão implementadas (leitor USB/Bluetooth que digita funciona).
- O cardápio digital público só é visível no próprio dispositivo até haver backend.

## Manutenção dos tutoriais

Ao criar ou alterar uma aba, atualize `src/tutorials/content.ts`. Os testes (`src/test/tabs.test.tsx`) falham se alguma aba ficar sem tutorial, se houver tutorial órfão ou se um passo do tour apontar para um elemento que não existe na tela com dados.
