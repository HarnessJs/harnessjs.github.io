# Injeção de dependência

Decorators de parâmetro que dizem o que cada argumento deve receber. Como cada um
se declara, **a ordem não importa** — e dois parâmetros do mesmo tipo deixam de
ser ambíguos.

```ts
import { input, context, state, memory } from "@thenajs/core";
```

| Decorator | Onde | O que entrega |
| --- | --- | --- |
| `@input()` | `execute` de tool | os argumentos já validados pelo schema |
| `@context()` | `execute` de tool | o `Context` da execução |
| `@state()` | construtor de agente, `execute` de tool | o estado declarado em `@Workflow({ state })` |
| `@memory(Store?)` | construtor de agente | uma `VectorMemory`; com a classe, a do store correspondente |

## Em tools

```ts
@Tool({ name: "ler", description: "…", schema: z.object({ path: z.string() }) })
export class LerTool {
  async execute(
    @input() { path }: { path: string },
    @context() ctx: Context,
    @state() s: RevisaoState,
  ) {
    s.arquivosLidos.push(path);
    return readFile(path, "utf8", { signal: ctx.signal });
  }
}
```

Sem decorator nenhum, o `execute` recebe só os argumentos — que continua sendo o
caso comum, e o mais simples:

```ts
async execute({ path }: { path: string }) { … }
```

## Em agentes

```ts
@Agent({ provider: MeuProvider, prompt: "./a.agent.md" })
export class MeuAgente {
  constructor(
    @state() private readonly s: RevisaoState,
    @memory(QdrantOpenAI) private readonly vetores: VectorMemory,
  ) {}
}
```

`@memory(Store)` identifica a memória pela classe do store, o que dispensa
depender da ordem de `ThenaConfig.memory`. Sem argumento, entrega a primeira
registrada.

Sem o decorator vale o contrato posicional: as memórias chegam na ordem em que os
stores foram registrados — que é por que reordenar aquele array muda o
comportamento em silêncio, e por que nomear o store é melhor.

::: warning `@context()` não funciona em construtor
O agente é instanciado antes de a execução começar — o contexto ainda não existe.
O runtime falha com essa explicação, em vez de injetar `undefined` em silêncio.
Use no `execute` de uma tool, ou receba o `ctx` como parâmetro do hook.
:::

## `context()` como função

O mesmo nome também é chamável, e devolve o contexto de onde você estiver:

```ts
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

Os dois devolvem o mesmo objeto. A diferença é **quando**: dentro de um passo vem
o ctx do passo, com `state` e `turn`; fora dele — numa factory de provider, que
roda na compilação — vem o da execução, e tocar em `state` lança com a
explicação.

## Por que não por tipo

O `reflect-metadata` lê os **tipos** dos parâmetros e dispensaria os decorators.
Não é usado porque o esbuild — que o `tsx` usa em dev — não emite
`design:paramtypes`: injeção por tipo compilaria e quebraria em silêncio no
`npm start`.

As chamadas dos decorators, por outro lado, são emitidas nos dois caminhos.

## Construtores de tool

Tools são instanciadas pelo framework, então os construtores delas também podem
receber dependências — mais utilmente o `WorkflowRuntime`, que é como uma tool
dispara o próprio workflow:

```ts
export class PesquisaTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## Se você não declarar estado

Declarar `state` no `@Workflow` é opcional, e quem não usa não paga nada:

| Situação | O que acontece |
| --- | --- |
| ninguém pede estado | funciona normal |
| um agente pede com `@state()` | erro apontando a classe e o parâmetro |
| uma tool pede com `@state()` | erro apontando o método e o parâmetro |
| o `until` declara o 2º parâmetro | erro dizendo para acrescentar `state` |

O último é detectado **antes de rodar**, pela quantidade de parâmetros que o
`until` declara. Sem essa checagem, o estado chegaria `undefined` e o erro sairia
como um `TypeError` na primeira leitura de campo — sem dizer o que faltou.

Um `until` de um parâmetro só (`untilAnswered`, ou `(ctx) => …`) nunca dispara
essa checagem.

## Erros

Injeção que não pode ser satisfeita falha na hora, apontando a classe e o índice
do parâmetro:

```
[thena] @state() em RevisorAgent (parâmetro 0): nenhum estado declarado.
        Acrescente `state: MinhaClasse` no @Workflow.

[thena] @memory(QdrantOpenAI) em MeuAgente: esse store não está registrado em
        ThenaConfig.memory.
```

## Relacionado

- [Estado e contexto](/pt/fundamentals/state-and-context)
- [Memória](/pt/fundamentals/memory)
- [Tools](/pt/fundamentals/tools)
