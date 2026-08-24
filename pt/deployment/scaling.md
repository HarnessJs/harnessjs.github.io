# Escala

Um serviço de agente é incomum: requisições levam segundos a minutos, custam
dinheiro de verdade, e passam quase todo o tempo esperando a API de outra pessoa.
Isso muda o que "escalar" significa.

## O gargalo quase nunca é o Node

Uma execução é quase toda `await` num modelo. Um processo aguenta muitas
execuções concorrentes com folga, porque todas estão ociosas ao mesmo tempo.

Os tetos reais, na ordem em que você vai encontrá-los:

1. **o rate limit do provider** — `429`s, sobre os quais o retry faz backoff
2. **custo** — dinheiro, muito antes de CPU
3. **a vazão do próprio modelo** — um Ollama local serve mais ou menos uma
   geração por vez
4. **memória**, se você retém handles ou reports
5. **CPU**, por último, e normalmente só por conta da observação

Meça antes de escalar horizontalmente. Acrescentar processos contra um rate limit
compartilhado torna os `429`s mais frequentes, não menos.

## Concorrência é de graça; segurança é sua

```ts
const app = Thena.create(MeuWorkflow, config); // uma vez
await Promise.all(requisicoes.map((r) => app.run({ prompt: r })));
```

Cada execução abre o próprio `RunContext` — estado, orçamento, histórico,
gravador, signal. Nada é compartilhado.

::: warning O que o framework não consegue isolar
Estado mutável de nível de módulo no **seu** código:

```ts
let ultimoTenant = ""; // compartilhado por todas as execuções concorrentes
```

Tudo que é por execução passa pelo `ctx.data` ou pelo estado do workflow. Esta é
a causa número um de "funciona sozinho, quebra sob carga".
:::

## Limite a concorrência de propósito

Concorrência sem limite contra um provider com rate limit produz uma rajada de
`429`s, sobre os quais o retry então faz backoff — transformando uma sobrecarga
rápida numa lenta.

Ponha uma fila na frente:

```ts
import pLimit from "p-limit";
const limite = pLimit(10);

await Promise.all(requisicoes.map((r) => limite(() => app.run({ prompt: r }))));
```

Para um Ollama local, o número útil é pequeno — muitas vezes 1 ou 2. Ele serve uma
geração por vez, então mais concorrência só acrescenta fila que você não enxerga.

## Desligue a observação onde não precisar

Uma execução sem `report`, `log`, plugin ou `observe: true` pula a construção da
árvore, a emissão de eventos e o pedido de streaming. Isso vale cerca de **2× em
tempo de CPU por execução**.

Para um serviço de volume alto, é a maior alavanca dentro do framework:

```ts
await app.run({
  prompt,
  log: false,
  report: debug ? { dir: `report/${req.id}` } : false,
});
```

Amostre, em vez de gravar tudo.

## As alavancas de custo, por ordem de efeito

**Menos turnos.** Um `maxIterations` de 8 que normalmente termina em 3 está ok;
um que normalmente termina em 8 significa que a condição de parada não está
funcionando. Confira o `exhausted` no report.

**Menos agentes.** Toda divisão acrescenta pelo menos uma chamada ao modelo por
execução. Veja [Sistemas multiagente](/pt/techniques/multi-agent-systems).

**Histórico menor.** Todo turno reenvia a conversa inteira, então um histórico
inchado se multiplica ao longo dos turnos. Veja
[Janela de contexto](/pt/techniques/context-management).

**Um modelo menor onde couber.** `provider` por agente significa que um passo de
classificação não precisa do modelo que o passo de raciocínio precisa.

**Cache.** Um middleware `chat` que memoiza chamadas idênticas são poucas linhas,
e execuções determinísticas (`temperature: 0`) acertam muito mais do que se
espera:

```ts
chat: async (inv, next) => {
  const chave = hash(inv.messages);
  return (await cache.get(chave)) ?? cache.set(chave, await next());
};
```

## Escala horizontal

O processo não tem estado entre execuções, então escala como qualquer serviço
Node — desde que você não tenha posto estado numa variável de módulo.

O que não escala automaticamente:

| Coisa | Observação |
| --- | --- |
| o `Map` de handles do POST+SSE | é em processo; o stream precisa cair na mesma instância (sticky sessions) |
| rate limits | compartilhados entre instâncias; limites por instância se multiplicam |
| `report/` em disco | local a cada instância, e normalmente não é o que você quer |
| banco vetorial | genuinamente compartilhado, e a única coisa que precisa ser externa |

Execuções longas também complicam o deploy — drene com `app.dispose()` no
`SIGTERM` e dê ao contêiner um `terminationGracePeriod` maior que o seu
`maxDurationMs`.

## Latência

A maior parte é o modelo. O que você controla:

- **`parallel`** para ramos independentes — três chamadas de 2s viram ~2s, não 6s
- **streaming**, para o usuário ver tokens em vez de esperar a resposta inteira
- **menos chamadas de tool, maiores**, em vez de muitas idas e voltas pequenas
- **cache de prompt**, que é por que o `contextWindow()` nunca corta o começo — um
  prefixo estável mantém o desconto do provider

## O que acompanhar

Do report ou do seu plugin:

| Métrica | Sinal de alerta |
| --- | --- |
| `chatCalls` por execução | subindo significa laços que não convergem |
| taxa de `exhausted: true` | a condição de parada não está funcionando |
| `toolCallSource: "rescued"` | o modelo está no limite da tarefa |
| `attempts` presente | instabilidade do provider |
| `costUsd` por execução | o número que decide todo o resto |

## Relacionado

- [Produção](/pt/deployment/production)
- [Desempenho](/pt/best-practices/performance)
- [Orçamentos](/pt/techniques/budgets)
- [Observabilidade](/pt/best-practices/observability)
