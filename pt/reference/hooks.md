# Hooks

Métodos opcionais na classe do agente. O runtime chama só o que existir.

```ts
import type { AgentHooks } from "@thenajs/core";

export class RevisorAgent implements AgentHooks {
  async afterResponse(resposta: string, ctx: Context) {
    ctx.aprovado = resposta.includes("APROVADO");
  }
}
```

`implements AgentHooks` é opcional e só checa as assinaturas.

## O contrato

**Retornar um valor substitui. Retornar `undefined` mantém o original.** É por
isso que um hook que só observa pode simplesmente não retornar nada.

Todos os cinco podem ser `async`.

## Ordem

```
beforePrompt → chamada ao modelo → beforeTool → execute → afterTool → afterResponse
                                        qualquer throw → onError
```

Veja [A execução](/pt/fundamentals/the-run#um-turno-de-agente-em-detalhe).

## `beforePrompt(prompt, ctx)`

```ts
beforePrompt?(prompt: string, ctx: Context): string | void | Promise<string | void>;
```

Transforma o prompt final antes de ele ir ao provider.

## `beforeTool(call, ctx)`

```ts
beforeTool?(call: ToolCall, ctx: Context): ToolCall | void | Promise<ToolCall | void>;

interface ToolCall {
  name: string;
  args: unknown;
}
```

Devolva um `ToolCall` novo para trocar os argumentos. **Um `throw` cancela a
execução.**

Para negar de forma que o modelo se recupere, use um
[middleware de tool](/pt/fundamentals/middleware) devolvendo
`{ content, isError: true }`.

## `afterTool(result, ctx)`

```ts
afterTool?(result: ToolResult, ctx: Context):
  string | ToolOutput | void | Promise<string | ToolOutput | void>;

interface ToolResult {
  name: string;
  args: unknown;
  output: string;
  isError?: boolean;
}
```

Devolver uma **string** troca só o texto e **preserva** o `isError`. Para mudar a
marca de erro, devolva um `ToolOutput` completo.

## `afterResponse(response, ctx)`

```ts
afterResponse?(response: string, ctx: Context): string | void | Promise<string | void>;
```

O uso mais comum não retorna nada e existe puramente pelo efeito colateral —
registrar uma decisão que um `until` posterior vai ler:

```ts
async afterResponse(resposta: string) {
  this.state.aprovado = /\bAPROVADO\b/.test(resposta);
}
```

## `onError(error, ctx)`

```ts
onError?(error: Error, ctx: Context): string | void | Promise<string | void>;
```

Pega qualquer coisa lançada no turno. Devolver um valor o torna a saída do agente
— um crash vira resposta degradada. Não retornar nada deixa o erro seguir
propagando.

## Não são chamados quando o agente define `run`

Uma classe de agente com método `run(input, ctx)` é dona do passo inteiro. Nenhum
hook dispara.

## Hooks e middleware

| | Hooks | Middleware |
| --- | --- | --- |
| Escopo | uma classe de agente | todo agente do app |
| Registro | um método na classe | `app.use({ tool, chat })` |
| Enxerga | as etapas do turno | a execução inteira, com `next()` |

Um hook copiado para todos os agentes quer ser um
[middleware](/pt/fundamentals/middleware).

## Relacionado

- [Hooks](/pt/fundamentals/hooks) — o conceito
- [Contexto](/pt/reference/context)
- [`@Agent`](/pt/reference/agent)
