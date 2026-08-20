# Hooks

Na maioria dos casos a classe do agente fica vazia. Hooks são como você entra no
meio de um turno quando declarar não basta.

São métodos opcionais comuns na classe do agente. O runtime chama os que
existirem.

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./revisor.agent.md" })
export class RevisorAgent {
  async afterResponse(resposta: string, ctx: Context) {
    ctx.aprovado = resposta.includes("APROVADO");
  }
}
```

`implements AgentHooks` está disponível se você quiser as assinaturas checadas,
mas não é obrigatório.

## Os cinco hooks

| Hook | Quando | Retornar um valor… |
| --- | --- | --- |
| `beforePrompt(prompt, ctx)` | antes da chamada ao modelo | substitui o prompt |
| `beforeTool(call, ctx)` | antes de uma tool rodar | substitui o `ToolCall`; `throw` cancela |
| `afterTool(result, ctx)` | depois de a tool rodar | substitui a saída |
| `afterResponse(response, ctx)` | depois da resposta do turno | substitui a resposta |
| `onError(error, ctx)` | em qualquer throw acima | vira a saída do agente |

Onde eles ficam no turno está em
[A execução](/pt/fundamentals/the-run#um-turno-de-agente-em-detalhe).

::: tip O contrato
Retornar um valor **substitui**. Retornar `undefined` **mantém** o original. É
por isso que um hook que só quer observar pode simplesmente não retornar nada.
:::

## `beforePrompt`

O lugar de acrescentar contexto recuperado, um horário, ou qualquer coisa que o
modelo deva saber e não esteja no markdown:

```ts
async beforePrompt(prompt: string, ctx: Context) {
  const achados = await this.vetores.recall(ctx.state.history.at(-1)?.content ?? "");
  if (!achados.length) return;                    // mantém o original
  return `${prompt}\n\n## Relacionado\n${achados.map((a) => a.text).join("\n")}`;
}
```

## `beforeTool`

Inspecionar, reescrever ou barrar. Devolver um `ToolCall` novo troca os
argumentos:

```ts
async beforeTool(call: ToolCall, ctx: Context) {
  if (call.name === "deploy" && !ctx.data.podeFazerDeploy) {
    throw new Error("esta execução não pode fazer deploy");   // cancela a run
  }
  return { ...call, args: { ...(call.args as object), dryRun: true } };
}
```

Um `throw` aqui encerra a execução. Para negar de forma que o modelo **se
recupere** — ele lê a recusa e tenta outra coisa — use um
[middleware de tool](/pt/fundamentals/middleware) devolvendo
`{ content, isError: true }`.

::: warning Não use `beforeTool` para autorização
Este hook roda **acima** do seu middleware na cadeia, então um `beforeTool`
posterior ainda consegue reescrever os argumentos depois de a sua checagem
passar. Decisão de segurança pertence a um middleware de tool, que enxerga os
argumentos que realmente vão executar. Veja
[Onde a sua camada entra](/pt/fundamentals/middleware#onde-a-sua-camada-entra).

O exemplo acima está ok como *comportamento próprio deste agente*. Ele não é um
controle.
:::

## `afterTool`

Transformar o que o modelo vai ver. Devolver uma string troca só o texto e
**preserva** o `isError`; devolva um `ToolOutput` completo para mudar a marca de
erro:

```ts
async afterTool(result: ToolResult, ctx: Context) {
  if (result.output.length > 4000) {
    return `${result.output.slice(0, 4000)}\n… [truncado]`;
  }
}
```

O `result` traz `name`, `args`, `output` e `isError`.

## `afterResponse`

Onde um passo registra a decisão dele para um `until` ou um passo posterior:

```ts
export class RevisorAgent {
  constructor(@state() private readonly s: RevisaoState) {}

  async afterResponse(resposta: string) {
    this.s.rodadas++;
    this.s.aprovado = /\bAPROVADO\b/.test(resposta);
  }
}
```

Repare que não retorna nada — a resposta segue intacta, e o hook existe puramente
pelo efeito colateral. É o uso mais comum.

É também onde se promove uma saída de *fala* para *contexto*:

```ts
afterResponse(plano: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.state.append("memory", `Plano a seguir:\n${plano}`);
}
```

## `onError`

Pega qualquer coisa lançada no turno. Devolver um valor o torna a saída do
agente, o que transforma um crash numa resposta degradada:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ falhou: error.name });
  return "Não consegui completar esse passo.";
}
```

Não retornar nada deixa o erro seguir propagando.

## Hooks e middleware

Os dois interceptam. A diferença é o escopo:

| | Hooks | [Middleware](/pt/fundamentals/middleware) |
| --- | --- | --- |
| Escopo | uma classe de agente | todo agente do app |
| Registro | um método na classe | `app.use({ tool, chat })` |
| Enxerga | as etapas do turno | a execução de tool / chamada ao modelo inteira, com `next()` |
| Bom para | o comportamento deste agente | preocupações transversais — cache, métrica, rate limit |

Se você se pegar copiando um hook para todos os agentes, ele quer ser um
middleware.

## Erros comuns

**Retornar um valor de um hook que era só para observar.** Um `afterResponse` que
retorna algo substitui a resposta. Se você só queria registrar uma decisão, não
retorne nada.

**Esperar que os hooks disparem quando a classe define `run`.** Um agente com
`run(input, ctx)` é dono do passo inteiro — nenhum hook é chamado.

**Lançar no `beforeTool` para negar de forma recuperável.** Isso encerra a
execução. Use um middleware de tool devolvendo `isError` se o modelo deve ter
outra chance.

## Relacionado

- [A execução](/pt/fundamentals/the-run) — onde cada hook se encaixa
- [Middleware e plugins](/pt/fundamentals/middleware)
- [Agentes](/pt/fundamentals/agents)
