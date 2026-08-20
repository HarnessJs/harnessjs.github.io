# Log

```ts
export const config: ThenaConfig = { log: true };
```

```
[thena] ▸ workflow RevisaoWorkflow
[thena]   ▸ agent PlannerAgent
[thena]     ▸ chat
[thena]     ◂ chat  1.20s ✓
[thena]   ◂ agent PlannerAgent  1.21s ✓
[thena]   ▸ loop
[thena]     ▸ agent RevisorAgent
[thena]       ▸ chat
[thena]         ▸ tool read_file
[thena]         ◂ tool read_file  8ms ✓
```

`▸` abre um passo, `◂` fecha com a duração e o status.

## Três modos

```ts
type LogConfig = boolean | "verbose" | ((event: ExecutionEvent) => void);
```

| Valor | O que você recebe |
| --- | --- |
| `true` | a estrutura — quais passos rodaram, quanto tempo, ok ou erro |
| `"verbose"` | o mesmo, mais o prompt, a resposta e o I/O das tools |
| função | cada evento, para o seu próprio sink |

`"verbose"` é o default de depuração. É também a forma mais rápida de responder
"por que ele fez isso", porque mostra o prompt que o modelo **de fato** recebeu —
incluindo o que o `beforePrompt` acrescentou.

## Seu próprio sink

```ts
import pino from "pino";
const logger = pino();

export const config: ThenaConfig = {
  log: (evento) => {
    if (evento.phase !== "end") return;
    logger.info({
      runId: evento.runId,
      kind: evento.kind,
      name: evento.name,
      durationMs: evento.durationMs,
      status: evento.status,
    });
  },
};
```

```ts
interface ExecutionEvent {
  phase: "start" | "end";
  kind: "workflow" | "loop" | "parallel" | "agent" | "chat" | "tool";
  name: string;
  runId: string;
  depth: number; // 0 = raiz, útil para indentação
  id: string;
  parentId?: string;
  durationMs?: number; // no `end`
  status?: "ok" | "error"; // no `end`
  error?: string; // no `end`
  data?: Record<string, unknown>; // no `end`
}
```

`id` e `parentId` são o que tornam a árvore reconstruível. O `runId` é o que
mantém execuções concorrentes separadas — sem ele, um consumidor que recebe
eventos de várias execuções não tem como distingui-las.

::: warning Uma função em `log` é chamada no caminho quente
Ela é síncrona e roda dentro da execução. Mantenha barata: empurre para uma fila,
não dê `await` numa chamada de rede. Uma exceção lançada aqui **não** é isolada
como a de um `onEvent` de plugin.
:::

## Por execução

O `log` é uma das opções que dá para sobrescrever por execução, que é como se
depura uma requisição em produção sem deixar o serviço inteiro barulhento:

```ts
await app.run({
  input,
  log: req.header("x-debug") ? "verbose" : false,
});
```

Veja [Configuração por execução](/pt/techniques/per-run-configuration).

## Logar é observar

Ligar o `log` também liga a **observação** — a execução constrói a árvore e pede
streaming ao provider. É esse o mecanismo por trás de `onEvent`/`textStream`
funcionarem sem um `observe: true` explícito.

O contrário também importa: sem `log`, sem `report` e sem plugin, uma execução
não emite absolutamente nada. Veja [Streaming](/pt/fundamentals/streaming).

## Log ou plugin?

Os dois recebem o mesmo stream. A diferença:

| | Função em `log` | `onEvent` de plugin |
| --- | --- | --- |
| Quantos | um | quantos você quiser |
| Se lançar | propaga | engolido, execução intacta |
| Ciclo de vida | nenhum | `setup()` e `dispose()` |

Para qualquer coisa que abra conexão, use um
plugin. Para um ajuste de formatação ou um cano
rápido até um logger existente, o `log` basta.

## Segredos

Tudo que é capturado passa antes pelo mascaramento, que
vem ligado e conhece `Bearer …`, `sk-…`, `ghp_…`, JWT, connection string e campos
nomeados como `api_key`.

Isso é uma rede de proteção, não uma garantia. O `"verbose"` imprime prompts e
I/O de tools, então uma execução sobre dado real de cliente imprime dado real de
cliente.

## Relacionado

- [Report](/pt/devtools/report) — os mesmos eventos, persistidos
- [Flow](/pt/devtools/flow) — os mesmos eventos, como grafo ao vivo
- [Depuração](/pt/devtools/debugging)
