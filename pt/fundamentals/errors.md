# Erros

A coisa mais importante a saber: **falha de tool é observação, não exceção.**

O modelo pediu `READMEE.md`. Sua tool lançou `ENOENT`. No ThenaJS isso não
encerra a execução — o erro volta ao modelo como resultado da tool, e ele ganha
outro turno:

```
[thena]   ▸ tool read_file
[thena]   ◂ tool read_file  2ms ✗   ENOENT: no such file or directory, 'READMEE.md'
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓

É um framework TypeScript para construir agentes de LLM.
```

Ele errou o nome, foi avisado, e corrigiu. Essa decisão sozinha é o que faz um
laço de investigar-agir-olhar-de-novo funcionar.

## As quatro formas de uma tool falhar

Todas terminam igual: o modelo lê o que deu errado.

| Como | O que o modelo vê |
| --- | --- |
| o `execute` lança | a mensagem do erro |
| o `execute` devolve `{ content, isError: true }` | o seu texto |
| o modelo chama uma tool que não existe | uma nota dizendo isso |
| o modelo manda argumentos fora do schema | o erro do Zod |

Nada a configurar. O nó `tool` no report é marcado com `status: "error"`, o hook
`afterTool` recebe `isError`, e o `ctx.turn.toolError` fica `true` — então
"com que frequência as tools falham" é uma contagem de nós, e não um regex sobre
texto.

## Escreva a mensagem que o modelo lê

Devolver `isError` é melhor que lançar, porque você escolhe as palavras:

```ts
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
  }
}
```

A diferença não é cosmética. `ENOENT: no such file or directory, open
'READMEE.md'` descreve uma syscall. `Não existe arquivo em "READMEE.md". Confira
o caminho.` diz ao modelo o que fazer em seguida.

## Falhas que o modelo não conserta

Um bug no seu código, uma credencial expirada, um banco fora do ar — nenhum deles
melhora com retentativa. O modelo não tem como consertar, cada volta custa uma
chamada, e a mensagem original pode trazer coisa que não deveria chegar nem ao
contexto do modelo nem ao seu report em disco: uma connection string, um host
interno.

Lance `FatalToolError`. Ela atravessa o agente e encerra a execução:

```ts
import { FatalToolError } from "@thenajs/core";

async execute({ query }: { query: string }) {
  try {
    return await db.query(query);
  } catch (err) {
    // O modelo não conserta um banco fora do ar — e a mensagem original não
    // vai para o contexto dele.
    throw new FatalToolError("banco indisponível", { cause: err });
  }
}
```

O `cause` é preservado para os seus próprios logs. O que a execução reporta é a
mensagem que você escreveu.

::: tip Escolhendo entre as duas
Pergunte: *uma próxima ação diferente teria chance de dar certo?* Um caminho
errado, um 404, uma query malformada — sim, faça observação. Uma credencial que
falta, um bug de null, uma dependência morta — não, faça fatal.
:::

## Erros em outros lugares

Erro de tool é o caso especial. Todo o resto propaga normalmente.

| Onde | O que acontece |
| --- | --- |
| um hook lança | o hook `onError` roda; se não retornar nada, a execução falha |
| um middleware lança | a execução falha |
| o provider lança | retentado se transitório, senão a execução falha |
| o orçamento estoura | `mode: "stop"` encerra graciosamente; `"throw"` lança `BudgetExceededError` |
| `ctx.abort(reason)` | a execução rejeita com a sua `reason` |
| `ctx.stop()` | a execução resolve com a saída que já havia |

## `onError`

A última chance do agente de transformar um crash numa resposta degradada.
Devolver um valor o torna a saída do agente:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ falhou: error.name });   // visível no report
  return "Não consegui completar esse passo.";
}
```

Não retornar nada deixa o erro seguir propagando.

## O `app.run()` rejeita

Desde a 0.9, uma execução que falha chega até você:

```ts
try {
  await app.run({ input });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.warn(`estourou ${err.info.reason}: ${err.info.value} de ${err.info.limit}`);
  }
}
```

Antes, a falha sumia em silêncio. O framework não imprime, não engole e não marca
o processo por baixo dos panos — imprimir é trabalho da sua aplicação.

## Limpando

O `ctx.onDispose(fn)` registra uma limpeza para o fim da execução — sucesso, erro
ou abort. Elas rodam na ordem inversa do registro, como um `defer`:

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

É o lugar certo para qualquer coisa que uma execução falha vazaria.

## Erros comuns

**Lançar no `beforeTool` para negar de forma recuperável.** Isso encerra a
execução. Use um [middleware de tool](/pt/fundamentals/middleware) devolvendo
`isError` se o modelo deve ter outra chance.

**Deixar a mensagem de erro de um driver virar a observação.** Ela é verbosa,
escrita para humano, e pode carregar detalhe interno. Capture e escreva a sua.

**Supor que um erro de tool matou a execução.** Quase certamente não matou —
procure um `FatalToolError`, ou um erro lançado fora de uma tool.

## Relacionado

- [Tools](/pt/fundamentals/tools)
- [A execução](/pt/fundamentals/the-run)
- [Problemas comuns](/pt/help/troubleshooting)
