# Agentes

Um agente é um passo do workflow: um provider, um conjunto de tools e um prompt.

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
  sampling: { temperature: 0 },
})
export class ExplorerAgent {}
```

## O que é

Uma classe decorada com `@Agent`. O corpo da classe normalmente fica vazio — o
que interessa está no decorator e no markdown ao lado.

O projeto é esse: um agente é uma *declaração*, não uma implementação. O laço do
turno (chamar o modelo, perceber uma tool call, validar, executar, devolver o
resultado) é do framework e é idêntico para todo agente que você escreve.

## Configuração

| Chave | Obrigatória | O que é |
| --- | --- | --- |
| `provider` | sim | quem conversa com o modelo — uma instância, uma classe ou uma factory |
| `prompt` | sim | caminho do prompt em markdown, ou uma `URL` |
| `tools` | não | as ações que este agente pode tomar |
| `sampling` | não | sobrescreve o sampling do provider, chave a chave |

### `prompt`

O prompt mora em markdown, ao lado da classe:

```
src/agents/explorer/
  explorer.agent.ts
  explorer.agent.md
```

Um caminho relativo é resolvido a partir do **arquivo do agente**, e não do
diretório de trabalho. Caminho absoluto e `URL` também funcionam:

```ts
prompt: new URL("./explorer.agent.md", import.meta.url);
```

A forma com `URL` vale conhecer: o caminho relativo é resolvido lendo um stack
trace, o que funciona mas não é de graça. Com `URL`, isso é dispensado.

::: warning Em build compilado, o `.md` precisa chegar ao `dist/`
O prompt é lido em tempo de execução, do caminho ao lado do `.js` compilado.
Projetos criados pelo `thena create` já copiam.
:::

### `provider`

Três formas, e elas são um mecanismo de **escopo** — quem escolhe o eixo é você:

```ts
provider: instanciaCompartilhada;      // uma instância para todas as execuções
provider: LocalOllamaProvider;         // `new` por app, sem argumentos
provider: () => new OpenAIProvider({   // chamada uma vez por execução
  apiKey: chaveDe(context().data),
});
```

A factory roda **dentro do escopo da execução**, então pode ler `context()` — que
é como chave, modelo e endpoint saem dos dados daquela execução. É a base do
multi-tenancy.

### `sampling`

Sobrescreve o sampling do provider chave a chave, então um provider só atende um
agente determinístico e um criativo:

```ts
@Agent({ provider: Compartilhado, prompt: "./escritor.agent.md",
         sampling: { temperature: 0.8 } })
export class EscritorAgent {}
```

## Por que o prompt é um arquivo à parte

Prompt muda o tempo todo, e por motivos diferentes dos que fazem o código mudar.
Uma palavra aqui, um exemplo ali — movidos pelo que o modelo errou ontem, não por
uma mudança nos seus tipos.

Manter no `.md` faz um ajuste de prompt virar um diff de prompt. Ele é revisado
como prosa, porque é prosa. E ninguém precisa escapar uma crase dentro de um
template literal para acrescentar um exemplo.

## Acrescentando comportamento

O corpo da classe é para onde você vai quando declarar não basta.

**Hooks** interceptam o turno — veja [Hooks](/pt/fundamentals/hooks):

```ts
export class RevisorAgent {
  async afterResponse(resposta: string) {
    this.state.aprovado = resposta.includes("APROVADO");
  }
}
```

**Injeção no construtor** traz o estado do workflow e a memória vetorial — veja
[Injeção de dependência](/pt/fundamentals/dependency-injection):

```ts
export class RevisorAgent {
  constructor(
    @state() private readonly s: RevisaoState,
    @memory(QdrantOpenAI) private readonly vetores: VectorMemory,
  ) {}
}
```

## Assumindo o turno inteiro

Se a classe define `run(input, ctx)`, ela é dona do passo: o framework a chama em
vez de rodar um turno, e **nenhum hook dispara**.

```ts
export class AgenteCustomizado {
  async run(input: string, ctx: Context) {
    return `tratei ${input} por conta própria`;
  }
}
```

É o escape hatch total. É a ferramenta certa quando o passo não é bem um agente —
uma transformação determinística que você quer dentro da mesma execução, com o
mesmo estado, orçamento e report — e a errada para qualquer coisa que um hook
resolveria.

## Erros comuns

**Esperar que um agente dê várias voltas.** Um passo de agente é *um* turno: uma
chamada ao modelo e no máximo uma tool. Investigar antes de responder exige um
laço.

**Esquecer que o modelo lê a `description`, não a sua intenção.** Se o agente
descreve uma ação em vez de executá-la, a `description` da tool costuma ser a
causa.

**Deixar o sampling solto enquanto itera.** Sem `temperature: 0` você não
distingue melhoria de sorte.

## Relacionado

- [Tools](/pt/fundamentals/tools) — o que um agente consegue fazer
- [Workflows](/pt/fundamentals/workflows) — como os agentes são ordenados
- [Hooks](/pt/fundamentals/hooks) — interceptar o turno
