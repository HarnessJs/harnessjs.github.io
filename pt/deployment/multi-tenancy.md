# Multi-tenancy

Um processo, um app, muitos tenants — cada um com credenciais, modelo e dados
próprios, e nenhum capaz de enxergar o do outro.

O mecanismo inteiro são duas peças: **`run({ data })`** carrega o tenant, e uma
**factory de provider** o lê.

Há um exemplo completo funcionando em
[`examples/multi-tenancy`](https://github.com/thenajs/ThenaJS/tree/main/examples/multi-tenancy).

## Tipe os dados da execução

```ts
// src/execucao.ts
export type DadosDaConta = {
  tenantId: string;
};
```

::: tip `type`, e não `interface extends`
Os dois compilam, mas uma interface que estende a forma de `RunData` herda o
índice livre — e aí `ctx.data.campoQueNaoExiste` passa como `unknown` em vez de
dar erro. Com `type`, o typo é pego na compilação.
:::

## O provider vira factory

```ts
// src/providers/tenant.provider.ts
import { OllamaProvider, context } from "@thenajs/core";
import type { DadosDaConta } from "../execucao";

const MODELO: Record<string, string> = {
  acme: "qwen2.5:3b",
  globex: "qwen2.5-coder:1.5b",
};

export const providerDoTenant = () => {
  const { tenantId } = context<DadosDaConta>().data;
  return new OllamaProvider({
    host: "http://localhost:11434",
    model: MODELO[tenantId],
  });
};
```

```ts
@Agent({ provider: providerDoTenant, prompt: "./assistant.agent.md" })
export class AssistantAgent {}
```

A factory é chamada **uma vez por execução**, já dentro do escopo da run — que é
exatamente por que ela consegue ler o `context()`. Antes do primeiro passo, mas
depois de a execução existir.

O genérico é o que faz o `tenantId` chegar como `string`. Sem ele, `data` é
`Record<string, unknown>` e todo acesso precisa de cast.

## Executando

```ts
const app = Thena.create<string, DadosDaConta>(AssistantWorkflow, config);

const acme = await app.run({
  prompt: "…",
  data: { tenantId: "acme" },
});

const globex = await app.run({
  prompt: "…",
  data: { tenantId: "globex" },
});
```

O genérico vale para as duas pontas: o `data` é checado aqui, e o
`context<DadosDaConta>()` devolve os campos tipados lá dentro.

Chamadas concorrentes são seguras. Cada `run` abre o próprio `RunContext`, então
requisições de dois tenants em voo ao mesmo tempo não enxergam `data`, estado,
orçamento nem histórico uma da outra.

## Alcançando o tenant de dentro de uma tool

`context()` e `@context()` são duas portas para o mesmo objeto:

```ts
@Tool({ name: "quem_sou", description: "…", schema: z.object({}) })
export class QuemSouTool {
  execute(@input() _args: unknown, @context() ctx: Context<DadosDaConta>) {
    return `Esta execução é da conta ${ctx.data.tenantId}.`;
  }
}
```

O `ctx` aqui é o **mesmo objeto** que a factory do provider leu. A forma
decorator dentro da tool, a forma função em qualquer outro lugar da execução.

## Por que `data` e não `memory`

```ts
data: { tenantId: "acme" }; // nunca chega ao modelo, nunca ao report
state: { memory: ["plano: pro"] }; // serializado no `system` — o modelo lê
```

Um id de tenant no `memory` iria para o prompt e para o report em disco. Pior, o
modelo poderia repeti-lo — e um modelo que consegue dizer um id de tenant é um
modelo que pode ser convencido a dizer o errado.

O `data` é transportado e nunca interpretado. É essa a fronteira de isolamento.

## Credenciais por tenant

O mesmo padrão, com a chave vindo do seu próprio store:

```ts
export const providerDoTenant = () => {
  const { tenantId } = context<DadosDaConta>().data;
  const conta = contas.get(tenantId); // a sua busca

  return new OpenAIProvider({
    apiKey: conta.apiKey,
    model: conta.plano === "pro" ? "gpt-4o" : "gpt-4o-mini",
    costPer1kTokens: PRECOS[conta.model],
  });
};
```

::: warning A factory roda por execução, não por turno
Ela é chamada uma vez, quando a execução é compilada. Rotacionar uma credencial
no meio da execução não é possível — e não deveria ser. Um cache de instâncias de
provider por tenant, de vida longa, está ok, contanto que a busca em si aconteça
na factory.
:::

## Orçamentos por tenant

Orçamentos são por execução, então são por tenant de graça:

```ts
await app.run({
  prompt,
  data: { tenantId },
  budget: {
    maxCostUsd: conta.creditoRestante,
    mode: "stop",
    onExceeded: (info) => cobranca.marcar(tenantId, info),
  },
});
```

É o lugar natural para aplicar o limite de um plano — e o `"stop"` devolve a
resposta parcial em vez de falhar a requisição.

## Memória por tenant

Bancos vetoriais são de nível de app e compartilhados, então isole com um
dataset:

```ts
await vetores.remember(texto, { dataset: `tenant:${tenantId}` });
await vetores.recall(consulta, { dataset: `tenant:${tenantId}` });
```

::: warning Nunca `dataset: null` num app multi-tenant
Ele busca em **todos** os datasets, o que significa em todos os tenants. É um
vazamento de dado sem mensagem de erro nenhuma.
:::

Como o dataset precisa vir do `ctx.data` e não de um argumento que o modelo
controla, não o exponha no schema de uma tool.

## O que é compartilhado

| | Escopo |
| --- | --- |
| `data`, estado, histórico, orçamento, gravador | **por execução** |
| formato do workflow, agentes, tools | por app |
| plugins | por app |
| instâncias de banco vetorial | por app |
| variáveis de nível de módulo no seu código | por processo |

A última linha é a que morde. Um `let tenantAtual` no escopo do módulo é
compartilhado por todas as execuções concorrentes, e vai se intercalar. Tudo que
é específico de tenant passa pelo `ctx.data`.

## Isolando o report

Sobrescritas por execução mantêm os prompts de um tenant fora da pasta de outro:

```ts
await app.run({
  prompt,
  data: { tenantId },
  report: { dir: `report/${tenantId}` },
});
```

Ou, para tenants cujos dados não podem ser gravados de jeito nenhum:

```ts
report: conta.privacidadeEstrita ? { content: false } : true;
```

## Relacionado

- [Configuração por execução](/pt/techniques/per-run-configuration)
- [Estado e contexto](/pt/fundamentals/state-and-context) — `data` e `memory`
- [Produção](/pt/deployment/production)
- [Segurança](/pt/best-practices/security)
