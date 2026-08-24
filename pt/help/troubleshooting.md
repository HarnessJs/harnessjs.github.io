# Problemas comuns

Sintomas reais e o que costuma causá-los. Se o seu não estiver aqui, ligar
`report: true` e abrir `report/index.html` quase sempre mostra onde a execução saiu
do trilho. Aquela página lista todas as execuções; cada uma também grava o próprio
`report/<runId>/index.html` e `report/<runId>/report.json`.

## O agente responde em texto em vez de usar a tool

Sintoma: você pediu algo que exige a tool, e ele descreveu o que faria.

**Causa mais comum: a `description` não diz quando usar.** É prompt, e o modelo lê
literalmente.

```ts
description: "Operações de arquivo."                    // vago
description: "Lê um arquivo do projeto. Use antes de responder sobre código."
```

**Segunda causa: o prompt não instrui a agir.** Diga explicitamente no markdown:
*"Antes de responder, leia os arquivos relevantes."*

**Terceira: o modelo é pequeno demais para a tarefa.** Abra o report e olhe o campo
`toolCallSource` nos nós `chat`. Se aparecer `rescued`, ele está emitindo a chamada
como texto e o framework recuperando — funciona, mas é sinal de que está no limite.

## O laço encerra na primeira volta

Sintoma: o agente chama uma tool e a execução termina, sem ele interpretar o
resultado.

Quase sempre é `untilAnswered` com um modelo que devolveu **resposta vazia** — ela
conta como "respondeu". Seja mais exigente:

```ts
import { turnOf } from "@thenajs/core";

until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

O outro caso é o modelo ter escrito a chamada em prosa, sem JSON nenhum — o
resgate não recupera porque não há chamada ali. Veja o item anterior.

## O laço nunca termina

Sintoma: bate no `maxIterations` toda vez.

Confirme que é isso, em vez de supor:

```ts
loop({
  steps: [MeuAgent],
  until: minhaCondicao,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`parou no teto após ${n}`),
});
```

Se dispara, o `until` nunca ficou verdadeiro. Os motivos usuais: o campo lido pelo
`until` nunca é gravado (typo, ou o hook que grava não roda), ou a condição está
invertida — lembre que **`true` significa parar**.

## O segundo agente responde vazio

Sintoma: `steps: [PlannerAgent, ExecutorAgent]`, e o executor devolve nada ou
encerra de imediato.

A saída do primeiro entrou no histórico como fala do **assistente**. O segundo lê o
mesmo histórico e conclui que já respondeu.

Se a saída do primeiro é *contexto* e não *fala*, promova:

```ts
export class PlannerAgent {
  afterResponse(plano: string, ctx: AgentContext) {
    ctx.state.set("history", ctx.state.history.slice(0, -1));
    ctx.state.append("memory", `Plano a seguir:\n${plano}`);
  }
}
```

## `recall` volta vazio

Ordem de verificação:

1. **Você gravou no mesmo dataset em que está buscando?** `remember` sem `dataset`
   grava em `"default"`; `recall` com `{ dataset: "persistent" }` não acha. Para
   buscar em todos: `{ dataset: null }`.
2. **O `scoreThreshold` está alto?** Comece sem ele e olhe os scores reais.
3. **A collection existe?** Ela é criada na primeira gravação, não na leitura.

## Erro de dimensão no banco vetorial

```
Este store já foi preparado com 768 dimensões, mas agora recebeu embeddings de 1536.
```

Dois agentes com modelos de embedding diferentes apontando para o mesmo store. Uma
collection guarda um tamanho só — cada modelo precisa do seu:

```ts
stores: [QdrantNomic, QdrantOpenAI];
```

E o agente de 1536 pega o segundo parâmetro do construtor. A injeção pelo
`ThenaConfig.stores` é **posicional**, então reordenar aquele array troca
silenciosamente qual store cada agente usa. Use `@memory(QdrantOpenAI)` para
nomear em vez de depender da ordem.

## A execução morre com `fetch failed`

Se demorou uns 300 segundos antes de falhar, foi o limite do runtime — a requisição
ficou pendurada e o retry nunca disparou, porque nada rejeitou.

Ligue o timeout por tentativa:

```ts
super({ host, model, retry: { maxAttempts: 3, timeoutMs: 120_000 } });
```

Escolha um valor acima do que seu modelo leva no pior caso: um teto curto demais
aborta trabalho legítimo.

## Erro de tool derrubou a execução inteira

Esse não é o padrão — erro de tool normalmente vira observação, que o modelo lê e
da qual se recupera. Uma execução que morre de verdade significa uma de duas
coisas:

- o seu `execute` lançou `FatalToolError`, que existe justamente para encerrar a
  execução;
- o erro escapou de um lugar que não é tool — um hook, um middleware ou o provider.

Para escolher a mensagem que o modelo lê, em vez de lançar, devolva um resultado de
erro:

```ts
return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
```

## O prompt não foi encontrado

```
[@Agent] Prompt markdown não encontrado: /caminho/…
```

O caminho relativo é resolvido a partir do **arquivo do agente**. Se você move o
`.ts` sem mover o `.md`, quebra. Em build compilado, confirme que os `.md` são
copiados para o `dist/` — o projeto do CLI já faz isso.

## Uma tool não é reconhecida

```
[thena] A classe "MinhaTool" não está decorada com @Tool().
[thena] A classe "MinhaTool" não implementa execute(input).
```

A primeira é decorator faltando; a segunda é o método com nome errado (`run` em
vez de `execute`, por exemplo).

## Nada compila, e os erros falam de decorator

O `experimentalDecorators` está desligado. O ThenaJS usa os decorators legados do
TypeScript porque precisa de decorators de **parâmetro**, que a proposta Stage 3
não tem.

```json
{ "compilerOptions": { "experimentalDecorators": true } }
```

## `onEvent` / `textStream` nunca disparam

Você deve ter visto este aviso:

```
[thena] onEvent() will receive nothing: this run is not being observed.
```

Uma execução sem observador não constrói a árvore, não emite eventos e não pede
streaming ao provider — é o caminho de custo zero, e vale cerca de 2× em tempo de
CPU por execução. Ligue a observação explicitamente:

```ts
const exec = app.run({ prompt, observe: true });
```

Ou ligue `report`, `log`, ou um plugin com `onEvent` — qualquer um deles liga a
observação por tabela.

## Resultados diferentes a cada execução

Esperado sem `sampling`. Fixe enquanto você itera:

```ts
sampling: { temperature: 0, seed: 42 };
```

## Ainda travado

Abra uma issue no [GitHub](https://github.com/thenajs/ThenaJS/issues) com o
`report/<runId>/report.json` da execução — ele tem a árvore completa e é o que mais
ajuda. Veja [Suporte](/pt/help/support).
