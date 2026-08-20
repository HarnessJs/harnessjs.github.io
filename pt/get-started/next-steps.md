# Próximos passos

Você tem um agente, uma tool, um workflow e uma execução configurada. Essa é toda
a superfície necessária para algo de verdade — daqui para frente é profundidade.

## Leia isto em seguida

**[O que roda sem eu escrever?](/pt/help/faq#o-que-roda-sem-eu-escrever)** — todo
framework esconde alguma coisa. O problema não é esconder; é você não saber o quê.
Esta é a lista exata.

**[Problemas comuns](/pt/help/troubleshooting)** — os erros que as pessoas
realmente encontram nas primeiras execuções, e o que costuma causá-los.

**[Glossário](/pt/help/glossary)** — os termos usados nesta documentação, em
inglês e em português, para o vocabulário não oscilar.

## Coisas que vale saber que existem

Cada uma delas é uma funcionalidade real, já publicada. Até a página chegar aqui,
o [README](https://github.com/thenajs/ThenaJS#readme) documenta tudo em detalhe.

| | |
| --- | --- |
| **Hooks** | `beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError` na classe do agente — interceptar sem mexer no framework |
| **Injeção** | `@input()`, `@context()`, `@state()`, `@memory()` nos parâmetros de tools e agentes, para a ordem deixar de ser contrato |
| **Middleware e plugins** | `app.use({ name, tool, chat })` envolve cada execução de tool e cada chamada ao modelo — cache, rate limit, métrica |
| **Streaming** | `for await (const token of app.run({...}).textStream)` — os tokens conforme o modelo escreve |
| **Cancelamento** | o `abort()` chega no `fetch` da sua tool pelo `ctx.signal`; o `stop()` encerra graciosamente |
| **Memória vetorial** | `@thenajs/qdrant-client` mais `@memory()` para busca semântica |
| **Visão ao vivo** | `await app.use(thenaFlow())`, do `@thenajs/flow` — a execução como grafo no navegador |
| **Execuções aninhadas** | uma tool que dispara o próprio workflow, com histórico e orçamento próprios |

## Quando algo dá errado

1. Ligue `log: "verbose"` — ele mostra o prompt e o I/O das tools, o que
   normalmente já basta.
2. Ligue `report: true` e abra `report/index.html` — ele lista todas as execuções,
   e cada uma leva à própria árvore, com duração e custo em tokens.
3. Confira [Problemas comuns](/pt/help/troubleshooting).
4. Ainda travado: [peça ajuda](/pt/help/support).

## Contribuindo

O framework está na 0.9.x e em movimento. Issues, reproduções e pull requests são
bem-vindos em [thenajs/ThenaJS](https://github.com/thenajs/ThenaJS); a documentação
mora à parte, em
[thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io).
