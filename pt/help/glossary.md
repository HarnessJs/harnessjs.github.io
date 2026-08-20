# Glossário

O vocabulário usado nesta documentação. Ele também é o contrato de tradução: as
páginas em inglês usam exatamente os equivalentes da última coluna, e nunca
alternam entre duas palavras para a mesma coisa.

## Conceitos centrais

| Termo | O que significa | Inglês |
| --- | --- | --- |
| **Agente** | Uma classe decorada com `@Agent`, que junta um provider, um conjunto de tools e um prompt em markdown. Um passo do workflow. | Agent |
| **Tool** | Uma classe decorada com `@Tool`. Uma ação que o modelo pode pedir, descrita por nome, descrição e schema Zod. | Tool |
| **Workflow** | Uma classe decorada com `@Workflow`. Declara a ordem dos passos e o estado compartilhado. | Workflow |
| **Provider** | Quem conversa com o modelo. `OllamaProvider`, `OpenAIProvider`, ou o seu. | Provider |
| **Execução** | Uma rodada do workflow, do `app.run(...)` até o resultado. Tem contexto, orçamento, cancelamento e gravador próprios. | Run |
| **Passo** | Uma unidade dentro de `@Workflow({ steps })`: um agente, um bloco `parallel` ou um bloco `loop`. | Step |
| **Turno** | Uma volta do agente: uma chamada ao modelo mais a tool que ela porventura disparou. Resumido em `ctx.turn`. | Turn |

## Execução

| Termo | O que significa | Inglês |
| --- | --- | --- |
| **Contexto** (`ctx`) | O objeto que atravessa todos os passos de uma execução. Carrega `state`, `output`, `turn`, `data`, `signal` e os controles da execução. | Context |
| **Estado** | A classe declarada em `@Workflow({ state })`, instanciada uma vez por execução e injetada com `@state()`. | State |
| **Memória** | A memória de trabalho do agente: o `run({ memory })`, lido pelo modelo em todo turno desta execução, e que acaba com ela. | Memory |
| **Memória vetorial** | Memória de longo prazo: a `VectorMemory`, injetada pelo `@memory()`, buscada por similaridade e que sobrevive à execução. Os bancos por trás dela são o `ThenaConfig.stores`. | Vector memory |
| **Data** | O `run({ data })`. O canal de dados da execução. Nunca vai para o modelo, nunca chega ao report. | Data |
| **Orçamento** | O teto da execução inteira — tempo, chamadas, tokens, custo. | Budget |
| **Hook** | Um método opcional na classe do agente (`beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError`). | Hook |
| **Middleware** | Uma função que envolve cada execução de tool (`tool`) ou cada chamada ao modelo (`chat`), registrada pelo `app.use`. | Middleware |
| **Plugin** | Um objeto passado ao `app.use`. Observa (`onEvent`) e/ou intercepta (`tool`, `chat`). | Plugin |
| **Runtime** | A camada que compila um workflow e roda os passos dele. Alcançável como `WorkflowRuntime` para execuções aninhadas. | Runtime |

## Observabilidade

| Termo | O que significa | Inglês |
| --- | --- | --- |
| **Report** | O registro em HTML + JSON gravado ao final de uma execução. | Report |
| **Gravador** | Quem monta a árvore de execução enquanto a execução acontece. | Recorder |
| **Evento de execução** | Um `ExecutionEvent`: o início ou o fim de um passo, entregue ao `onEvent`, ao `log` e aos plugins. | Execution event |
| **Nó** | Uma entrada na árvore de execução — `workflow`, `agent`, `chat`, `tool`, `loop`, `parallel`. | Node |
| **Mascaramento** | Esconder segredos conhecidos no conteúdo capturado, antes de ele chegar ao report, ao log ou a um plugin. | Redaction |
| **Resgate** | Recuperar uma tool call que o modelo escreveu como texto em vez de usar o campo estruturado. Aparece como `toolCallSource: "rescued"`. | Rescue |

## Memória vetorial

| Termo | O que significa | Inglês |
| --- | --- | --- |
| **Banco vetorial** | O banco por trás. `VectorStore` é o contrato; o `@thenajs/qdrant-client` é uma implementação. | Vector store |
| **Collection** | Onde os documentos moram no store. Guarda um tamanho de embedding só. | Collection |
| **Dataset** | Uma partição lógica dentro da collection, escolhida a cada `remember` / `recall`. | Dataset |
| **Embedding** | A representação vetorial de um texto, produzida pelo `embed()` do provider. | Embedding |
| **Recall** | Recuperar por similaridade. | Recall |
| **Remember** | Gravar um documento no store. | Remember |

## Palavras que deliberadamente não usamos

- **"Chain"** / "cadeia" — o framework tem workflows e passos. Não tem chains.
- **"Prompt engineering"** — o prompt é um arquivo markdown que você edita. A
  gente diz escrever um prompt.
- **"LLM"** no corpo do texto — a gente diz **modelo**. `LLM` só aparece onde nomeia
  a categoria, como em "um framework para agentes de LLM".
- **"Sessão"** — execução é execução. O que persiste entre execuções é memória.

## Notas de tradução

As páginas em português mantêm a forma em inglês dos termos que já são nome de um
símbolo da API — `Tool`, `Workflow`, `Provider`, `Hook`, `Middleware`, `Plugin`,
`Runtime`, `Report`, `Dataset`, `Embedding`. Traduzir isso quebraria o vínculo
entre o texto e o código que o leitor tem na frente.

Os termos que nomeiam um *conceito*, e não um símbolo, são traduzidos: Agent →
Agente, Run → Execução, Step → Passo, State → Estado, Context → Contexto, Budget →
Orçamento.

`Agente` é a única exceção à regra acima, e é deliberada: a palavra é
esmagadoramente usada em texto técnico em português, e o `@Agent` continua em
inglês no código de qualquer forma.
