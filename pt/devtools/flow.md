# Flow

O [report](/pt/devtools/report) conta a história depois que ela acabou. O Flow
mostra enquanto acontece: um site local que desenha a árvore da execução em tempo
real, com o prompt e a resposta de cada passo a um clique.

```bash
npm install @thenajs/flow
```

```ts
import { Thena } from "@thenajs/core";
import { thenaFlow } from "@thenajs/flow";
import { MeuWorkflow } from "./workflows/meu.workflow";

const app = Thena.create(MeuWorkflow, { log: true });
await app.use(thenaFlow());

await app.run({ input: { message: "Olá" } });
```

Abra <http://127.0.0.1:4100>. Os nós vão aparecendo conforme a execução avança.

## O que aparece na tela

Cada nó é um passo, com o mesmo vocabulário do report:

| Ícone | Passo | O que é |
| --- | --- | --- |
| `▣` | `workflow` | a execução inteira |
| `↻` | `loop` | um bloco `loop({ ... })` |
| `⇉` | `parallel` | um bloco `parallel([ ... ])` |
| `◆` | `agent` | um passo de agente |
| `✦` | `chat` | uma chamada ao modelo |
| `⚙` | `tool` | uma tool executada |

A borda esquerda dá o estado — azul pulsando enquanto roda, verde no fim,
vermelho quando falha. Clicar num nó abre o painel com o prompt enviado, a
resposta, a entrada e a saída da tool, os tokens e o erro, se houve.

A lista lateral guarda as execuções da sessão. O Flow acompanha a mais recente
sozinho; clicar numa antiga congela nela até você voltar.

## Junto com o resto

O Flow **não toma o lugar do seu `log`**. Os dois recebem o mesmo stream:

```ts
const app = Thena.create(MeuWorkflow, {
  log: true, // continua imprimindo no terminal
  report: true, // continua gerando o HTML no fim
});
await app.use(thenaFlow());
```

Uma diferença útil: o `log: true` mostra só a estrutura, e é preciso `"verbose"`
para ver o conteúdo. O Flow liga a captura de conteúdo sozinho — senão os painéis
viriam vazios.

## Opções

```ts
await app.use(
  thenaFlow({
    port: 4100, // porta do site
    host: "127.0.0.1", // interface de escuta
    maxRuns: 20, // execuções mantidas em memória
    log: true, // imprime a URL ao subir
  }),
);
```

## O que saber antes

**Nada é persistido.** O histórico vive na memória do processo — fechou, acabou.
Para algo que sobreviva à execução, é o [report](/pt/devtools/report) que serve.

**O processo fica aberto depois do `run`.** É o que dá tempo de olhar o
resultado. Encerre com `Ctrl+C`, ou chame `await app.dispose()` quando quiser que
o script termine sozinho:

```ts
await app.run({ input: { message: "Olá" } });
await app.dispose(); // fecha o site e libera o processo
```

**Escuta só em `127.0.0.1`.** O prompt e a resposta de cada passo passam por ali,
e isso costuma incluir dado sensível. Mudar o `host` expõe tudo isso na rede —
faça só se souber por quê.

::: warning Ferramenta de desenvolvimento
O Flow mantém as execuções em memória e serve uma página sem autenticação. O
lugar dele é a sua máquina, não a produção. Para observabilidade em produção, use
um plugin que encaminhe os eventos para a sua
stack.
:::

## O mesmo stream, para onde você quiser

O `thenaFlow()` não é um caso especial: é um `ThenaPlugin`, e a interface é
pequena de propósito. O mesmo fluxo de eventos serve para mandar a execução à sua
plataforma de observabilidade, a um arquivo, a um webhook:

```ts
import type { ThenaPlugin } from "@thenajs/core";

export function meuPlugin(): ThenaPlugin {
  return {
    name: "meu-plugin",
    async setup() {
      await conectar();
    },
    onEvent(evento) {
      enviar(evento);
    },
    async dispose() {
      await fechar();
    },
  };
}
```

```ts
await app.use(thenaFlow());
await app.use(meuPlugin());
```

Vários plugins convivem, e nenhum desloca o `log` do config. O `evento` é o mesmo
`ExecutionEvent` que uma função em `log` recebe — com `id`, `parentId` e `runId`,
que é o que torna a árvore reconstruível e mantém execuções concorrentes
separadas.

## Relacionado

- [Report](/pt/devtools/report) — a mesma execução, depois
- [Log](/pt/devtools/logging)
- [Escrever plugins](/pt/advanced/writing-plugins)
