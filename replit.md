# Mayoli Joias Finas

Sistema completo de gestão comercial (ERP / Frente de Caixa) para joalheria de luxo, 100% offline com persistência via localStorage.

## Run & Operate

- `pnpm --filter @workspace/mayoli run dev` — inicia o app (porta variável via $PORT)
- `pnpm --filter @workspace/mayoli run typecheck` — typecheck do frontend
- `pnpm --filter @workspace/mayoli run build` — build de produção

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite 7 + Tailwind CSS v4 + shadcn/ui
- Routing: wouter
- Charts: Recharts (PieChart, BarChart)
- Animations: framer-motion
- Toasts: sonner
- Persistência: localStorage (sem backend, sem banco de dados)
- PWA: manifest.json + service worker (sw.js) — instalável na tela inicial

## Where things live

```
artifacts/mayoli/
  src/
    context/StoreContext.tsx   ← estado global + toda a lógica de persistência localStorage
    lib/types.ts               ← todos os tipos TypeScript (Product, Customer, Sale, …)
    lib/utils.ts               ← formatBRL, formatDate, isToday, isThisMonth
    pages/
      Home.tsx                 ← dashboard + modal despesa rápida + bloco condicionais
      Catalog.tsx              ← vitrine automática + catálogos personalizados
      Sales.tsx                ← frente de caixa + condicional ("malinha")
      Inventory.tsx            ← gestão de estoque + upload de fotos
      Customers.tsx            ← lista CRM
      CustomerProfile.tsx      ← perfil + histórico + amortização de parcelas
      Finance.tsx              ← indicadores financeiros + meta mensal + backup/restore
    components/layout/
      AppShell.tsx             ← shell com header fixo + sidebar retrátil
      Header.tsx               ← logotipo MAYOLI em Cormorant Garamond dourado
      Sidebar.tsx              ← navegação lateral
  public/
    manifest.json              ← PWA manifest (display: standalone)
    sw.js                      ← service worker (cache-first)
    icon-192.png / icon-512.png ← ícones PWA gerados programaticamente
  index.html                   ← meta tags PWA + apple-mobile-web-app-capable
```

## Architecture decisions

- **localStorage-only**: sem backend, sem chamadas de API. Todo o estado vive no `StoreContext` e é serializado em 6 chaves (`mayoli_products`, `mayoli_customers`, `mayoli_sales`, `mayoli_catalogs`, `mayoli_expenses`, `mayoli_settings`).
- **Status de estoque calculado automaticamente**: a regra "Acabando" (initialQuantity > 1 && quantity === 1) é recalculada em todo `addProduct` / `updateProduct`, nunca salva manualmente.
- **Condicional ("malinha")**: ao enviar como condicional, a quantidade dos produtos é decrementada normalmente no estoque; ao encerrar via reconciliação, os devolvidos têm a quantidade restaurada e os comprados geram uma nova `Sale`.
- **Backup/Restore**: exporta todas as chaves localStorage como JSON versionado; importação valida `_mayoli_backup_version: 1` antes de sobrescrever.
- **PWA standalone**: `display: standalone` no manifest + `apple-mobile-web-app-capable` ocultam a barra de URL do Chrome/Safari ao abrir pela tela inicial.

## Product

Módulos completos:
1. **Home** — dashboard com vendas do dia, gráfico de pizza do estoque, condicionais ativas com reconciliação, aniversariantes do mês, alertas de cobrança vencida (vermelho rubi), botão "Lançar Despesa" rápido
2. **Catálogo** — vitrine automática + catálogos personalizados nomeáveis
3. **Vendas** — POS com carrinho, múltiplos pagamentos, parcelamento manual (fiado), fluxo de condicional, geração de recibo e certificado de garantia
4. **Estoque** — cadastro com até 3 fotos (base64), categorias customizáveis, código sequencial automático, status dinâmico
5. **Clientes** — CRM com histórico de compras e amortização parcial de parcelas
6. **Finanças** — capital investido, faturamento potencial, fluxo de caixa, meta mensal inteligente, backup/restore JSON

## User preferences

- Idioma da interface: português brasileiro
- Sem emojis na UI
- Identidade visual: rosé (#E8C5C1), off-white (#F9F9FB), rubi (#C94A4A apenas alertas), dourado (#D4AF37 apenas logotipo)
- Tipografia: Cormorant Garamond (logotipo) + Inter (corpo)

## Gotchas

- Fotos em base64 no localStorage: imagens grandes podem atingir o limite de 5–10 MB do browser. Orientar a usuária a usar fotos comprimidas.
- O service worker usa cache-first; em produção, bumpar `CACHE_NAME` em `sw.js` a cada deploy para forçar atualização.
- `pnpm --filter @workspace/mayoli run build` requer as env vars `PORT` e `BASE_PATH` fornecidas pelo workflow — não executar diretamente via bash.
