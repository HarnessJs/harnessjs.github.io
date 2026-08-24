# Configuração por execução

Um app, muitas execuções, configurações diferentes. Possível porque cada execução
abre o próprio contexto — nada é global.

```ts
const app = Thena.create(MeuWorkflow, { log: true, report: true });

await app.run({ prompt, report: false }); // esta não grava nada
await app.run({ prompt, log: "verbose" }); // esta é barulhenta
```

## O que varia por execução

| Opção | Observações |
| --- | --- |
| `report` | `boolean \| ReportOptions` — sobrescreve o `ThenaConfig.report` |
| `log` | `boolean \| "verbose" \| fn` — sobrescreve o `ThenaConfig.log` |
| `budget` | não existe orçamento em nível de app; ele só existe por execução |
| `signal` | cancelamento |
| `observe` | força a observação ligada |
| `state` | de onde a execução parte — o `history`, o `tasks` e o `memory` que ela herda |
| `data` | o seu canal, que o modelo nunca vê |

O `stores` do `ThenaConfig` é outra coisa — as classes de banco vetorial — e não é
por execução.

## Depurando uma requisição em produção

A aplicação mais útil. Mantenha o app quieto, e suba o volume de uma execução:

```ts
app.post("/runs", async (req, res) => {
  const debug = req.header("x-debug") === "1";

  const resposta = await agente.run({
    prompt: req.body.message,
    log: debug ? "verbose" : false,
    report: debug ? { dir: `report/${req.id}` } : false,
  });

  res.json({ resposta });
});
```

Sem redeploy, sem flag global, sem barulho das outras requisições em voo.

## Execuções com dado sensível

```ts
await app.run({
  prompt,
  report: { content: false }, // mantém a árvore, descarta o texto
});
```

Os segredos conhecidos já são mascarados pelo `redact`, mas não existe regex para
o nome de um cliente. O `content: false` mantém o formato, as durações e a
telemetria da execução, sem gravar nenhum texto em disco.

## O provider também varia

O `@Agent({ provider })` aceita uma factory, chamada **uma vez por execução**
dentro do escopo dela — então ela pode ler `context()`:

```ts
@Agent({
  provider: () => new OpenAIProvider({
    apiKey: chaveDe(context<MinhaExecucao>().data.tenantId),
    model: context<MinhaExecucao>().data.plano === "pro" ? "gpt-4o" : "gpt-4o-mini",
  }),
  prompt: "./assistant.agent.md",
})
export class AssistantAgent {}
```

```ts
await app.run({ prompt, data: { tenantId: "acme", plano: "pro" } });
```

É esse o mecanismo por trás do multi-tenancy: um
app, um processo, credenciais e modelo escolhidos por requisição.

::: tip Uma factory roda na compilação, antes do primeiro passo
O `context()` ali dá o contexto da **execução** — `data`, `runId`, `signal` —, mas
não o de um passo. Tocar em `state` lança com a explicação.
:::

## `data` e `memory`

Os dois viajam com a execução; só um chega ao modelo.

```ts
await app.run({
  prompt,
  state: { memory: ["plano: pro"] }, // serializado no `system` — o modelo lê
  data: { tenantId: "acme" }, // nunca serializado, nunca no report
});
```

Um id de tenant, um token interno, um id de correlação pertencem ao `data`. O que
o modelo precisa saber para responder pertence ao `state.memory`.

Tipe uma vez e fica tipado:

```ts
type MinhaExecucao = { tenantId: string; plano: "free" | "pro" };
const app = Thena.create<string, MinhaExecucao>(MeuWorkflow, config);

context<MinhaExecucao>().data.plano; // "free" | "pro", sem cast
```

## O que **não** varia por execução

O formato do workflow — passos, classe de estado, tools, classes de agente — é
compilado quando o app é criado. Uma execução não acrescenta um passo nem troca
um agente.

Se dois tipos de requisição precisam de formatos diferentes, monte dois apps.
Eles são baratos: o `Thena.create` é síncrono e não faz I/O.

```ts
const rapido = Thena.create(RapidoWorkflow, config);
const profundo = Thena.create(ProfundoWorkflow, config);
```

Plugins também são de nível de app: o `app.use()` precisa ser chamado antes do
`run`, e vale para todas as execuções. Um middleware que só deve agir às vezes
consulta a própria execução:

```ts
tool: async (inv, next) => {
  if (!inv.run.data.auditando) return next();
  return auditado(inv, next);
};
```

## Relacionado

- [Configuração](/pt/get-started/configuration)
- [`ThenaConfig`](/pt/reference/thena-config)
- [Multi-tenancy](/pt/deployment/multi-tenancy)
- [Estado e contexto](/pt/fundamentals/state-and-context)
