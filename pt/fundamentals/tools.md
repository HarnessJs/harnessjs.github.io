# Tools

Uma tool é uma ação que o modelo pode pedir. Você descreve o que ela faz e quais
argumentos aceita; o framework cuida de tudo entre o pedido do modelo e o seu
código rodar.

```ts
@Tool({
  name: "read_file",
  description: "Lê um arquivo do projeto. Use antes de responder sobre código.",
  schema: z.object({
    path: z.string().describe("caminho relativo, ex.: src/main.ts"),
  }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## As três coisas que o modelo vê

| Campo | Para que serve |
| --- | --- |
| `name` | o que o modelo escreve para chamar |
| `description` | como o modelo decide *se* chama |
| `schema` | um objeto Zod dizendo quais argumentos são válidos |

Os três são prompt. A `description` principalmente: é a maior alavanca sobre a
tool ser usada ou não, e o `.describe()` de um campo do schema também é lido.

## O que acontece em volta do seu `execute`

```
o modelo pede read_file
  → o schema valida os argumentos        ← inválido nunca chega em você
  → hook beforeTool (se houver)
  → seu execute(args)
  → hook afterTool (se houver)
  → o resultado volta como mensagem `tool`
  → o modelo ganha outro turno
```

Seu `execute` recebe argumentos já parseados e tipados. Se o modelo mandar
`{ file: "x" }` contra um schema que quer `{ path: string }`, seu código não é
chamado — o modelo é informado do erro e tenta de novo.

## Valores de retorno

Devolva uma string e ela vira a observação que o modelo lê. Devolva um
`ToolOutput` para mais controle:

```ts
return {
  content: "texto que o modelo lê",
  isError: true, // marca o nó como `status: "error"` e liga ctx.turn.toolError
  data: { linhas: 42 }, // estruturado, ignorado pelo modelo, visível aos hooks
};
```

O `data` é o canal para telemetria e hooks — algo que você quer no report ou num
`afterTool` sem gastar o contexto do modelo com isso.

## Falha é observação

Uma tool que lança **não** encerra a execução. O texto do erro volta como
resultado da tool e o modelo ganha outro turno para corrigir. Essa decisão
sozinha é o que faz um laço de investigar-agir-olhar-de-novo funcionar.

Prefira devolver o erro a lançá-lo, porque aí você escolhe as palavras:

```ts
return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
```

Para falhas que o modelo não conserta — um bug, uma credencial expirada, um banco
fora do ar — lance `FatalToolError`. Ela atravessa o agente e encerra a execução,
e a mensagem original nunca chega ao contexto do modelo nem ao report:

```ts
throw new FatalToolError("banco indisponível", { cause: err });
```

Veja [Erros](/pt/fundamentals/errors).

## Alcançando a execução de dentro de uma tool

Por padrão o `execute` recebe só os argumentos validados, o que mantém a tool uma
função pura e trivial de testar. Quando ela precisa de mais, os parâmetros dizem
o que querem:

```ts
async execute(
  @input() { path }: { path: string },
  @context() ctx: Context,
  @state() s: RevisaoState,
) {
  s.arquivosLidos.push(path);
  return readFile(path, "utf8", { signal: ctx.signal });
}
```

Como cada parâmetro se declara, **a ordem não importa**. Veja
[Injeção de dependência](/pt/fundamentals/dependency-injection).

Use com parcimônia: uma tool que lê o contexto deixa de ser testável
isoladamente.

## Cancelamento

Uma tool longa deve repassar o signal da execução, senão o `abort()` só terá
efeito entre passos, e não dentro do seu trabalho:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
  return res.text();
}
```

## Injeção no construtor

Uma tool é instanciada pelo framework, então o construtor dela pode receber
dependências — inclusive o `WorkflowRuntime`, que é como uma tool dispara o
próprio workflow:

```ts
export class PesquisaTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## Erros comuns

**Uma `description` vaga.** `"Operações de arquivo."` não diz nada ao modelo
sobre quando recorrer a ela. Diga quando usar.

**Devolver saída enorme.** Saída de tool é a forma mais rápida de entupir a
janela de contexto. Trunque, e diga que truncou:

```ts
return texto.length <= MAX ? texto : `${texto.slice(0, MAX)}\n… [truncado]`;
```

**Nomear o método de `run`.** É `execute`. O framework falha alto nisso, mas é um
erro comum de primeira vez.

**Achar que decorator faltando é pego pelos tipos.** Uma classe sem `@Tool()` é
rejeitada na subida:

```
[thena] A classe "MinhaTool" não está decorada com @Tool().
```

## Tools prontas

O `@thenajs/tools` publica tools que dependem de coisas do framework que um
trecho copiado não alcança. Hoje isso quer dizer a
[`ParallelTool`](/pt/techniques/batched-tool-calls), que empacota várias chamadas
num turno só.

Tool que você escreve em dez minutos não está lá — está nas
[Receitas de tools](/pt/techniques/tool-recipes), para copiar e ser sua.

## Relacionado

- [Erros](/pt/fundamentals/errors) — recuperável e fatal
- [Agentes](/pt/fundamentals/agents)
- [Injeção de dependência](/pt/fundamentals/dependency-injection)
