# `ThenaConfig`

Passado ao `Thena.create(...)`. Tudo é opcional.

```ts
import type { ThenaConfig } from "@thenajs/core";

export const config: ThenaConfig = {
  log: true,
  report: true,
  memory: [MeuQdrant],
  redact: true,
};

const app = Thena.create(MeuWorkflow, config);
```

| Chave | Tipo | Default |
| --- | --- | --- |
| `log` | `boolean \| "verbose" \| (e: ExecutionEvent) => void` | desligado |
| `report` | `boolean \| ReportOptions` | desligado |
| `memory` | `VectorStoreCtor[]` | — |
| `redact` | `RedactConfig` | **ligado** |

## `log`

```ts
type LogConfig = boolean | "verbose" | ((event: ExecutionEvent) => void);
```

| Valor | Efeito |
| --- | --- |
| `true` | árvore indentada no console, com duração |
| `"verbose"` | o mesmo, mais o conteúdo (resposta, I/O das tools) |
| função | seu próprio sink — pino, winston, arquivo, JSON lines |

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]     ◂ chat  1.81s ✓
```

## `report`

```ts
interface ReportOptions {
  dir?: string; // default "report"
  format?: "html" | "json" | "both"; // default "both"
  content?: boolean; // default true
}
```

`content: false` mantém a árvore, as durações e a telemetria, e descarta o texto.
É a saída para quem trata dado pessoal: os segredos conhecidos já são mascarados
pelo `redact`, mas não existe regex para nome ou endereço.

Cada execução grava `<dir>/<runId>/index.html` e `<dir>/<runId>/report.json`. O
`<dir>/index.html` é um índice de todas as execuções.

## `memory`

```ts
memory: [QdrantNomic, QdrantOpenAI];
```

**Classes** de banco vetorial. Cada uma é instanciada **uma vez** e compartilhada
por todos os agentes — uma conexão e um preparo de collection, independente de
quantos agentes existem.

A injeção é posicional: a ordem do array é a ordem dos parâmetros do construtor
dos agentes.

::: warning Reordenar muda o comportamento em silêncio
Os parâmetros têm o mesmo tipo, então o TypeScript não acusa. Trate a ordem como
contrato — acrescente no fim, nunca no meio. Ou nomeie o store:
`@memory(QdrantOpenAI)`.
:::

Vários stores fazem sentido quando são incompatíveis entre si — tipicamente
modelos de embedding de dimensões diferentes, que não cabem na mesma collection.

Os embeddings saem do `provider` de cada agente, que tem `embed()` público e
aceita `embedModel`.

## `redact`

**Vem ligado.** Mascara segredos conhecidos em tudo que é capturado — prompt,
resposta, I/O das tools e mensagem de erro — antes de chegar ao report, ao log ou
a um plugin: `Bearer …`, connection string com senha, `sk-…`, `ghp_…`, JWT, e
campos nomeados como `api_key` ou `password`.

Um arquivo em disco, sem retenção nem controle de acesso, é o pior lugar para um
segredo aparecer por descuido.

```ts
redact: false;                        // desliga
redact: (texto) => meuMascaramento(texto);    // substitui o default
```

Para acrescentar padrões sem perder os de fábrica, use o `redactSecrets`
exportado. Veja [Mascaramento](/pt/advanced/redaction).

## Sobrescrita por execução

`report` e `log` podem ser sobrescritos numa única execução, porque cada uma tem
o próprio contexto:

```ts
await app.run({ input, report: false, log: "verbose" });
```

Veja [Configuração por execução](/pt/techniques/per-run-configuration).

## Relacionado

- [Configuração](/pt/get-started/configuration) — a versão guiada
- [Run e RunHandle](/pt/reference/run)
- [Report](/pt/devtools/report)
