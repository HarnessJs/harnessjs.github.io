# `@Agent`

Registra uma classe como agente e carrega o prompt do markdown.

```ts
import { Agent } from "@thenajs/core";

@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
  sampling: { temperature: 0 },
})
export class ExplorerAgent {}
```

## `AgentConfig`

| Chave | Tipo | Obrigatória | Default |
| --- | --- | --- | --- |
| `provider` | `Providers \| ProviderCtor \| () => Providers` | sim | — |
| `prompt` | `string \| URL` | sim | — |
| `tools` | `(ToolType \| ToolClass)[]` | não | `[]` |
| `sampling` | `SamplingParams` | não | o do provider |

### `provider`

Três formas, resolvidas de modo diferente:

| Forma | Quando é construído | Lê `context()`? |
| --- | --- | --- |
| instância | uma vez, por você | — |
| classe | `new ProviderCtor()`, sem argumentos | não |
| factory | **uma vez por execução**, dentro do escopo dela | sim |

```ts
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

### `prompt`

- **caminho relativo** — resolvido a partir do arquivo do agente, lendo um stack
  trace
- **caminho absoluto**
- **`URL`** — `new URL("./x.agent.md", import.meta.url)`, sem stack trace

Lido em tempo de execução, então em build compilado o `.md` precisa chegar ao
`dist/`.

### `sampling`

Sobrescreve o sampling do provider **chave a chave** — as chaves não informadas
mantêm o valor do provider. Veja
[Providers](/pt/reference/providers#samplingparams).

## `AgentMetadata`

O que o decorator registra, legível com `getAgentMetadata(ClasseDoAgente)`:

```ts
interface AgentMetadata {
  provider: ProviderInput;
  tools: ToolInput[];
  prompt: string; // já carregado do .md
  sampling?: SamplingParams;
}
```

## Membros da classe

Todos opcionais. O runtime chama o que existir.

| Membro | Para que serve |
| --- | --- |
| `constructor(@state() …, @memory() …)` | [injeção](/pt/reference/injection) |
| `beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError` | [hooks](/pt/reference/hooks) |
| `run(input, ctx)` | assume o passo inteiro — **nenhum hook dispara** |

### `run(input, ctx)`

```ts
export class AgenteCustomizado {
  async run(input: string, ctx: Context): Promise<string> {
    return `tratei ${input}`;
  }
}
```

O escape hatch total. O framework chama isso em vez de rodar um turno: sem
chamada ao modelo, sem laço de tool, sem hooks.

## Erros

```
[@Agent] Prompt markdown não encontrado: /caminho/…
```

O caminho relativo é resolvido a partir do arquivo do agente. Mover o `.ts` sem o
`.md` quebra.

## Relacionado

- [Agentes](/pt/fundamentals/agents) — o conceito
- [`@Tool`](/pt/reference/tool)
- [`@Workflow`](/pt/reference/workflow)
- [Hooks](/pt/reference/hooks)
