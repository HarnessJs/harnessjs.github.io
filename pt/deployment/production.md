# Produção

Um agente atrás de HTTP é um processo de vida longa servindo requisições
concorrentes, cada uma lenta, cara e cancelável. É essa combinação que esta
página trata.

## O formato

```ts
import express from "express";
import { Thena } from "@thenajs/core";

const app = Thena.create(AssistantWorkflow, config); // uma vez, na subida
const server = express();

server.post("/runs", async (req, res) => {
  try {
    const resposta = await app.run({
      prompt: req.body.message,
      data: { requestId: req.id },
      signal: req.signal,
      budget: { maxDurationMs: 120_000, maxCostUsd: 0.5 },
    });
    res.json({ resposta });
  } catch (err) {
    if (req.signal.aborted) return; // o cliente foi embora
    req.log.error(err);
    res.status(500).json({ error: "a execução falhou" });
  }
});
```

**Crie o app uma vez.** O `Thena.create` é síncrono e não faz I/O, mas o workflow
compila uma vez e os bancos vetoriais conectam uma vez. Criar por requisição joga
isso fora.

**O `run` é seguro para concorrência.** Cada chamada abre o próprio contexto,
estado, orçamento e gravador. Duas requisições em voo nunca se enxergam.

## Inegociáveis

Quatro coisas separam uma demo de um serviço:

```ts
budget: { maxDurationMs: 120_000, maxCostUsd: 0.5 }   // não roda para sempre
signal: req.signal                                     // para quando o cliente sai
```

```ts
maxIterations: 8                                       // o laço tem teto
```

```ts
process.on("SIGTERM", async () => {
  await app.dispose();
  process.exit(0);
});
```

Sem orçamento, uma execução ruim consome o gasto de API de um dia. Sem `signal`,
o trabalho continua para um cliente que já desligou. Sem `dispose`, um deploy
mata execuções em voo no meio do turno.

## Execuções longas: POST e depois SSE

Responder de forma síncrona só funciona enquanto as execuções são curtas. Além
disso, devolva o id na hora:

```ts
const execucoes = new Map<string, RunHandle<string>>();

server.post("/runs", (req, res) => {
  const exec = app.run({
    prompt: req.body.message,
    observe: true, // ← obrigatório: o handle é o único consumidor
    budget: { maxDurationMs: 300_000 },
  });
  execucoes.set(exec.runId, exec);
  exec.result.finally(() => setTimeout(() => execucoes.delete(exec.runId), 60_000));
  res.status(202).json({ runId: exec.runId }); // síncrono
});

server.get("/runs/:id/stream", async (req, res) => {
  const exec = execucoes.get(req.params.id);
  if (!exec) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  for await (const evento of exec.eventStream) {
    res.write(`data: ${JSON.stringify(evento)}\n\n`);
  }
  res.end();
});

server.delete("/runs/:id", (req, res) => {
  execucoes.get(req.params.id)?.abort(new Error("cancelado pelo cliente"));
  res.status(204).end();
});
```

O `runId` está disponível de forma síncrona, antes do primeiro turno. Um cliente
que conecta ao stream três segundos depois ainda vê a execução inteira, porque
quem assina atrasado recebe o histórico bufferizado.

::: warning `observe: true` não é opcional aqui
Sem `report`, `log` ou plugin, uma execução não observada não emite nada e o
`eventStream` nunca rende. Você recebe um aviso único em vez de silêncio.
:::

Repare na expiração: sem ela, aquele `Map` é vazamento de memória.

## Configuração por requisição

Mantenha o serviço quieto e suba o volume de uma execução quando precisar:

```ts
await app.run({
  prompt,
  log: req.header("x-debug") ? "verbose" : false,
  report: req.header("x-debug") ? { dir: `report/${req.id}` } : false,
});
```

Sem redeploy, sem flag global. Veja
[Configuração por execução](/pt/techniques/per-run-configuration).

## Observabilidade

`report: true` grava uma pasta por execução. Isso é certo em desenvolvimento e
errado num serviço movimentado — é crescimento ilimitado de disco com arquivos
que ninguém lê.

Em produção, encaminhe os eventos:

```ts
await app.use(otelPlugin()); // o seu, veja Escrever plugins
```

Mantenha o report como opt-in por requisição, como acima. Veja
Observabilidade.

::: warning O Flow não é ferramenta de produção
O `thenaFlow()` mantém execuções em memória e serve uma página sem autenticação.
O lugar dele é a sua máquina.
:::

## Docker

Não há nada específico do ThenaJS aqui — é um serviço Node comum. Dois detalhes
fáceis de errar:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
# Os prompts dos agentes são .md lidos em runtime, ao lado do .js compilado
CMD ["node", "dist/main.js"]
```

**Os prompts `.md` precisam estar na imagem.** Eles são lidos em runtime, ao lado
do `.js` compilado. Um build que copia só `*.js` produz
`[@Agent] Prompt markdown não encontrado` na primeira execução.

**Node 20.19 ou mais novo**, que é o que o `engines` dos pacotes pede.

Se você usa um Ollama local, ele é um serviço à parte — o contêiner precisa
alcançá-lo, e `localhost` dentro de um contêiner não é a sua máquina.

## Health checks

Uma sonda de liveness não deve chamar o modelo. Custa dinheiro e vai ser lenta o
suficiente para reprovar a sonda.

```ts
server.get("/healthz", (_req, res) => res.status(200).end());
```

Para readiness, verifique do que a execução realmente depende — o host do
provider e o banco vetorial — com um ping curto seu, e não através de um agente.

## Modos de falha que você deve esperar

| Sintoma | Causa usual |
| --- | --- |
| `fetch failed` depois de ~300s | sem `timeoutMs`; a requisição pendurou e o retry nunca disparou |
| memória cresce ao longo de dias | um `Map` de handles sem expiração, ou um plugin retendo nós |
| custo dispara de madrugada | um laço sem teto, ou sem `budget` |
| o processo não encerra | um plugin segurando servidor aberto; chame `app.dispose()` |
| funciona sozinho, quebra sob carga | estado mutável em nível de módulo nas suas tools |

Esta última vale repetir: o framework isola execuções, mas não consegue isolar um
`let` no escopo de módulo do seu próprio código.

## Relacionado

- [Escala](/pt/deployment/scaling)
- [Variáveis de ambiente](/pt/deployment/environment-variables)
- [Multi-tenancy](/pt/deployment/multi-tenancy)
- [Streaming](/pt/fundamentals/streaming)
