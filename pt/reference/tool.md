# `@Tool`

Registra uma classe como tool. A lógica fica em `execute`.

```ts
import { Tool, input, context, state } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Lê um arquivo do projeto. Use antes de responder sobre código.",
  schema: z.object({ path: z.string().describe("caminho relativo") }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## `ToolConfig`

| Chave | Tipo | Obrigatória |
| --- | --- | --- |
| `name` | `string` | sim |
| `description` | `string` | sim |
| `schema` | um objeto Zod | sim |

Os três vão para o modelo. A `description` e qualquer `.describe()` nos campos do
schema são prompt — o modelo decide a partir deles.

## `execute`

O único membro obrigatório. Os parâmetros são resolvidos por decorator:

```ts
async execute(
  @input()   args: { path: string },   // validados contra o schema
  @context() ctx: Context,             // o contexto da execução
  @state()   s: MeuState,              // o estado do workflow
) { … }
```

Sem decorator nenhum, o `execute` recebe só os argumentos validados:

```ts
async execute({ path }: { path: string }) { … }
```

Como cada parâmetro se declara, a ordem não importa. Veja
[Injeção](/pt/reference/injection).

## Valor de retorno

| Retorno | Efeito |
| --- | --- |
| `string` | vira a observação que o modelo lê |
| `ToolOutput` | controle completo |
| qualquer outra coisa | serializado |

```ts
interface ToolOutput {
  /** O texto que volta para o modelo como observação. */
  content: string;
  /** Marca como falha — o nó `tool` vira `status: "error"`. */
  isError?: boolean;
  /** Carga estruturada livre, ignorada pelo modelo — para hooks e telemetria. */
  data?: unknown;
}
```

## Falha

Um throw vira observação da qual o modelo se recupera. Para encerrar a execução:

```ts
import { FatalToolError } from "@thenajs/core";

throw new FatalToolError("banco indisponível", { cause: err });
```

O `FatalToolError` atravessa o agente e encerra a execução, e a mensagem original
nunca chega ao contexto do modelo nem ao report. Veja
[Erros](/pt/fundamentals/errors).

## Construtor

Instanciada pelo framework, então pode receber dependências:

```ts
export class PesquisaTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

Veja [Execuções aninhadas](/pt/techniques/nested-runs).

## Registrando

Listada no agente que pode usá-la:

```ts
@Agent({ provider: P, tools: [ReadFileTool], prompt: "./a.agent.md" })
```

O `tools` também aceita um objeto `ToolType` cru, para uma tool construída sem o
decorator.

## Erros

```
[thena] A classe "MinhaTool" não está decorada com @Tool().
[thena] A classe "MinhaTool" não implementa execute(input).
```

A primeira é decorator faltando; a segunda é o método com nome errado.

## Relacionado

- [Tools](/pt/fundamentals/tools) — o conceito
- [Projetar tools](/pt/techniques/tool-design)
- [Injeção](/pt/reference/injection)
