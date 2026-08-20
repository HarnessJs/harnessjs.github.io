# Depuração

Depurar um agente é diferente de depurar um programa: o controle de fluxo é uma
decisão do modelo, e ele muda entre execuções. O método abaixo está ordenado por
custo — cada passo diz de quais dos seguintes você vai precisar.

## 1. Torne repetível

Nada mais funciona enquanto a mesma entrada não produzir a mesma execução:

```ts
sampling: { temperature: 0, seed: 42 }
```

Sem isso você não distingue "minha mudança ajudou" de "deu sorte". É a primeira
coisa a definir e a última a remover.

## 2. Suba o volume

```ts
export const config: ThenaConfig = { log: "verbose", report: true };
```

O `"verbose"` imprime o prompt que o modelo **de fato** recebeu — depois do
`beforePrompt`, depois da projeção do estado, depois de qualquer middleware. A
maioria das perguntas do tipo "por que ele fez isso" acaba aqui, porque a
resposta costuma ser que o prompt não dizia o que você achava que dizia.

## 3. Leia a árvore

Abra `report/<runId>/index.html`. O formato da árvore responde às perguntas
estruturais antes de você ler qualquer texto:

| O que você vê | O que significa |
| --- | --- |
| um `chat`, nenhuma `tool` | o modelo nunca chamou a tool — problema de `description` |
| `tool` com status de erro | ele chamou e falhou; leia a observação |
| `loop` com `exhausted: true` | o `until` nunca ficou verdadeiro |
| `loop` com `iterations: 1` | parou de imediato — muitas vezes resposta vazia |
| `attempts` num `chat` | a rede retentou; o provider está instável |
| `toolCallSource: "rescued"` | o modelo escreveu a chamada como texto — está no limite |

## 4. Isole a camada

Depois de saber *onde*, a pergunta é *qual camada*.

**É o prompt?** Copie o prompt do report direto para o modelo. Se ele se comporta
mal ali também, é problema de prompt, e nenhuma configuração do framework
resolve.

**É a tool?** Uma tool sem `@context()` nem `@state()` é uma função comum:

```ts
const tool = new ReadFileTool();
expect(await tool.execute({ path: "README.md" })).toContain("ThenaJS");
```

**É o schema?** Desligue o resgate e veja o que o modelo realmente emite:

```ts
super({ host, model, rescueToolCalls: false });
```

Sem o resgate, uma chamada escrita como texto permanece resposta final — o que
deixa evidente que o modelo não está usando o formato nativo.

**É o fluxo?** Um método `run(input, ctx)` na classe do agente assume o passo
inteiro, sem chamada ao modelo. Stubar temporariamente um agente assim diz se o
problema está antes ou depois dele.

## 5. Veja ao vivo

Quando a falha é intermitente ou lenta, o report chega tarde demais:

```ts
await app.use(thenaFlow());
```

O [Flow](/pt/devtools/flow) desenha a árvore conforme acontece, então dá para ver
*onde* uma execução travou, em vez de esperar para descobrir que travou.

## Formatos comuns

**"Ele responde em vez de agir."** A `description` da tool não diz *quando* usar,
ou o prompt não manda agir. Veja
[Projetar tools](/pt/techniques/tool-design).

**"O segundo agente devolve vazio."** A saída do primeiro entrou no histórico
como turno `assistant`, então o segundo leu e concluiu que já tinha respondido.
Veja [Estado e contexto](/pt/fundamentals/state-and-context).

**"O laço nunca termina."** Acrescente `onExhausted` para confirmar que é o teto,
e então confira se alguém realmente grava o que o `until` lê.

**"O `onEvent` não dispara nada."** A execução não está sendo observada.
Acrescente `observe: true`, ou `report`/`log`/um plugin.

**"Morre com `fetch failed` depois de ~300s."** A requisição ficou pendurada e o
retry nunca disparou, porque nada rejeitou. Defina `timeoutMs`.

**"Funciona sozinho, quebra sob carga."** Quase nunca é o framework — cada
execução tem o próprio contexto e elas não compartilham estado. Olhe o que as
suas tools tocam: estado mutável em nível de módulo é compartilhado; `ctx` e o
estado do workflow não são.

## Testes

O ciclo de feedback mais rápido deixa o modelo de fora. Tools são classes comuns,
e um passo determinístico pode ser stubado com `run`:

```ts
export class StubPlanner {
  async run() {
    return "1. ler o README\n2. resumir";
  }
}

@Workflow({ steps: [StubPlanner, ExecutorAgent] })
export class TesteWorkflow {}
```

Para a camada do modelo em si, um middleware `chat` devolve uma resposta pronta
sem chamada de rede:

```ts
await app.use({
  name: "modelo-falso",
  chat: async () => ({ content: "APROVADO", toolCalls: [] }),
});
```

Veja [Testes](/pt/best-practices/testing).

## Relacionado

- [Report](/pt/devtools/report)
- [Log](/pt/devtools/logging)
- [Flow](/pt/devtools/flow)
- [Problemas comuns](/pt/help/troubleshooting)
