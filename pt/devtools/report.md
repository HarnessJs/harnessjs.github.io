# Report

Agente é difícil de depurar porque a decisão é do modelo. O report existe para
isso: ao final da execução, um HTML com a árvore inteira — o que foi enviado, o
que ele decidiu, quanto durou e quanto custou.

```ts
// src/config.ts
export const config: ThenaConfig = {
  log: true, // árvore ao vivo no terminal
  report: true, // HTML + JSON no fim
};
```

Rode e abra `report/index.html`.

::: tip Para ver enquanto acontece
O report é o depois. Para acompanhar em tempo real, num grafo no navegador, veja
[Flow](/pt/devtools/flow).
:::

## Onde os arquivos caem

```
report/
  index.html              ← índice de todas as execuções
  <runId>/
    index.html            ← a árvore desta execução
    report.json           ← o mesmo, estruturado
```

::: warning Isso mudou na 0.9
Cada execução agora ganha a própria subpasta. Scripts que liam um
`report/index.html` fixo como *o* report da execução precisam ser ajustados —
aquele caminho agora é o índice de todas.
:::

## Opções

```ts
report: { dir: "report", format: "both", content: true }
```

| Opção | Default | Observações |
| --- | --- | --- |
| `dir` | `"report"` | pasta de saída |
| `format` | `"both"` | `"html"`, `"json"` ou `"both"` |
| `content` | `true` | gravar prompt, resposta e I/O das tools |

`content: false` mantém a árvore, as durações e a telemetria, e descarta o texto.
É a saída para quem trata dado pessoal — os segredos conhecidos já são mascarados
pelo mascaramento, mas não existe regex para nome ou
endereço.

## O que dá para medir

Cada nó carrega dados estruturados. A ideia é que medir uma execução não exija
procurar padrão em texto:

| Nó | Campos |
| --- | --- |
| `workflow` | `chatCalls`, `toolCalls`, `tokens`, `costUsd`, `elapsedMs`, `exceeded` |
| `loop` | `iterations`, `exhausted`, `maxIterations` |
| `chat` | `toolCallSource`, `promptTokens`, `completionTokens`, `costUsd`, `attempts` |
| `tool` | `isError` (e o nó fica com status de erro) |

Na prática:

- **taxa de erro de tool** — contar nós `tool` com status de erro
- **laços que não convergiram** — `exhausted: true`
- **instabilidade da API** — `attempts` presente, que só aparece quando houve
  retry
- **fragilidade do modelo** — `toolCallSource: "rescued"`, que significa que ele
  escreveu a chamada como texto em vez de usar o formato estruturado

Esse último é um bom termômetro: se sobe muito, o modelo está no limite da
tarefa.

## Acrescentando telemetria própria

O `ctx.meta()` grava no nó deste passo, então aparece no `report.json` e no grafo
do Flow:

```ts
async execute(@input() args, @context() ctx: Context) {
  const linhas = await db.query(args.sql);
  ctx.meta({ rowCount: linhas.length, cached: false });
  return formatar(linhas);
}
```

Middleware tem o mesmo, como `inv.meta()` — é como um cache que acerta em 4ms diz
isso, em vez de deixar você deduzir pela duração.

## Lendo o JSON

```ts
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(`report/${runId}/report.json`, "utf8"));

const erros = contarNos(report, (n) => n.kind === "tool" && n.status === "error");
```

```ts
interface ExecutionNode {
  id: string;
  kind: "workflow" | "loop" | "parallel" | "agent" | "chat" | "tool";
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: "ok" | "error";
  error?: string;
  data: Record<string, unknown>;
  children: ExecutionNode[];
}
```

É isso que se anexa a um relato de bug — carrega muito mais que uma descrição do
que você viu.

## Custo

Tokens aparecem sem configuração — Ollama e OpenAI reportam. Para custo em
dinheiro, informe o preço no provider:

```ts
super({ apiKey, model, costPer1kTokens: { input: 0.00015, output: 0.0006 } });
```

Não há tabela embutida, de propósito: preço muda, e uma tabela desatualizada
mente com confiança.

## Opt-in, custo zero

Sem `report` e sem `log`, nada é capturado e não há sobrecarga — a instrumentação
é no-op, e a execução nem constrói a árvore. Vale cerca de 2× em tempo de CPU por
execução.

Não há serviço externo nem telemetria. O report é um arquivo local.

## Execuções aninhadas

Um sub-workflow disparado por uma tool aparece aninhado dentro do nó da tool:

```
workflow WorkflowPai
  agent AgentePai
    chat
      tool deploy
        workflow DeployWorkflow
          agent DeployAgent
```

Isolar uma subtarefa custa o contexto compartilhado, não a observabilidade.

## Relacionado

- [Flow](/pt/devtools/flow) — a mesma execução, ao vivo
- [Log](/pt/devtools/logging)
- [Depuração](/pt/devtools/debugging)
- [`ThenaConfig`](/pt/reference/thena-config)
