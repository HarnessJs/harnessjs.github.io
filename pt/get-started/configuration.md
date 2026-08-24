# Configuração

Há dois lugares para configurar uma aplicação ThenaJS, e a diferença entre eles é
o tempo de vida:

- **`ThenaConfig`** — passado ao `Thena.create(...)`. Vale para o app, e para toda
  execução que ele abrir.
- **Opções de execução** — passadas ao `app.run({ ... })`. Valem para aquela
  execução.

Os dois são inteiramente opcionais. Um agente que só conversa não precisa de
nenhum.

## `ThenaConfig`

```ts
// src/config.ts
import type { ThenaConfig } from "@thenajs/core";

export const config: ThenaConfig = {
  // Loga ao vivo o que está sendo executado (agentes, chats, tools).
  log: true,
  // Grava um report em HTML + JSON em `report/` ao final de cada execução.
  report: true,
};
```

```ts
const app = Thena.create(MeuWorkflow, config);
```

| Opção | O que faz |
| --- | --- |
| `log` | `true` para a árvore indentada no console, `"verbose"` para incluir o conteúdo, ou uma função `(event) => void` como sink próprio |
| `report` | `true` para os defaults, ou `{ dir, format, content }` |
| `stores` | classes de banco vetorial, instanciadas uma vez e compartilhadas por todos os agentes |
| `redact` | mascaramento de segredo no conteúdo capturado — **vem ligado** |

### `log`

`true` imprime a árvore da execução conforme ela acontece:

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]     ◂ chat  1.81s ✓
```

`"verbose"` acrescenta o prompt, a resposta e o I/O das tools. Uma função recebe
cada `ExecutionEvent` e deixa você mandar tudo para pino, winston, um arquivo ou
JSON lines.

### `report`

Grava um report no estilo do Playwright ao final da execução:

```ts
report: { dir: "report", format: "both", content: true }
```

- `dir` — pasta de saída, default `"report"`
- `format` — `"html"`, `"json"` ou `"both"` (default)
- `content` — gravar prompt, resposta e I/O das tools de cada passo (default
  `true`). `false` mantém a árvore, as durações e a telemetria, e descarta o
  texto.

Cada execução ganha a própria subpasta: `report/<runId>/index.html` e
`report/<runId>/report.json`. O `report/index.html` lista todas elas.

### `redact`

O mascaramento de segredo roda **por padrão** em tudo que é capturado — prompt,
resposta, I/O das tools e mensagem de erro — antes de chegar ao report, ao log ou
a um plugin. Ele conhece `Bearer …`, connection string com senha, `sk-…`, `ghp_…`,
JWT, e campos nomeados como `api_key` ou `password`.

`false` desliga. Uma função substitui o default; use o `redactSecrets` exportado
para acrescentar padrões sem perder os de fábrica.

## Opções de execução

```ts
await app.run({
  prompt: "Revise o diretório src/",
  state: { memory: ["userId: 123"] },
  budget: { maxChatCalls: 20, maxCostUsd: 0.5 },
  signal: AbortSignal.timeout(30_000),
});
```

| Opção | O que faz |
| --- | --- |
| `prompt` | a primeira mensagem `user` da execução — o que o modelo lê antes de tudo o mais |
| `state` | de onde a execução parte: `history`, `tasks`, `memory`. O `tasks` e o `memory` são serializados na mensagem `system` — **o modelo lê** |
| `data` | o seu canal de dados, disponível em `ctx.data` — **nunca vai para o modelo** |
| `budget` | o teto da execução inteira: tempo, chamadas, tokens, custo |
| `signal` | cancela a execução de fora |
| `observe` | liga a observação ao vivo mesmo sem report, log ou plugin |
| `report` / `log` | sobrescrevem o `ThenaConfig` só nesta execução |

### `state.memory` e `data`

Parecem a mesma coisa e são opostos. Os dois viajam com a execução; só um chega ao
modelo.

```ts
await app.run({
  prompt: "Qual é o meu plano?",
  state: { memory: ["plano: pro"] }, // o modelo lê isto
  data: { contaId: "acme" }, // o modelo nunca vê isto
});
```

Use `state.memory` para o contexto que o modelo **deve** ler. Use `data` para o que a
execução precisa carregar e o modelo não deve ver — um id de tenant, um token
interno, um id de correlação. O `data` também fica fora do report.

### `budget`

Sem `budget`, nada é medido nem checado.

```ts
budget: {
  maxDurationMs: 60_000,
  maxChatCalls: 20,
  maxToolCalls: 50,
  maxTokens: 100_000,
  maxCostUsd: 0.5,
  mode: "stop",              // default; "throw" lança BudgetExceededError
  onExceeded: (info) => console.warn(`estourou em ${info.reason}`),
}
```

`mode: "stop"` é o default e encerra a execução **graciosamente** — os passos
seguintes são pulados e a execução devolve a saída que já tinha. `"throw"` lança
`BudgetExceededError`.

`maxCostUsd` só funciona se o provider recebeu `costPer1kTokens`; `maxTokens` só
conta o que o provider realmente reporta.

::: warning O teto é uma barreira, não um corte no meio da frase
A parada é checada **entre** unidades de trabalho, e uma chamada ao modelo só é
contabilizada depois de responder. A execução pode gastar mais uma chamada além do
limite antes de parar.
:::

## Variáveis de ambiente

O ThenaJS não lê variável de ambiente nenhuma — não existe `THENA_*` para
aprender. Credencial vai onde você puser:

```ts
super({ apiKey: process.env.OPENAI_API_KEY! });
```

Isso é deliberado: o framework nunca busca um global, então dois providers no
mesmo processo podem usar duas chaves diferentes.

**Próximo: [próximos passos](/pt/get-started/next-steps).**
