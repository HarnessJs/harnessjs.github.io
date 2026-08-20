# CLI

```bash
npm install -g @thenajs/cli
```

Dois comandos. O CLI faz scaffold; ele não roda nem gerencia o seu projeto.

```
thena create <nome>        Cria um projeto novo em ./<nome>
thena g agent <nome>       Gera um agente em src/agents/<nome>/

  -v, --version            Mostra a versão
  -h, --help               Mostra a ajuda
```

## `thena create`

```bash
thena create meu-agente
cd meu-agente
npm install
npm start
```

Gera um projeto pronto para editar:

```
meu-agente/
  package.json
  tsconfig.json
  README.md
  .gitignore
  src/
    main.ts                     # ponto de entrada
    config.ts                   # log e report
    providers/
      ollama.provider.ts        # qual modelo usar
    agents/
      assistant/
        assistant.agent.ts      # a lógica
        assistant.agent.md      # o prompt
    workflows/
      assistant.workflow.ts     # a ordem dos passos
```

Ele se recusa a sobrescrever: se o diretório existe, sai com erro.

O projeto gerado aponta para um Ollama local. Troque o modelo em
`src/providers/ollama.provider.ts`.

::: tip Projetos gerados são CommonJS
Desde a 0.9, no padrão do `nest new`. Isso afeta só projeto novo — o seu `.ts`
continua usando sintaxe `import`, e o TypeScript compila.
:::

## `thena g agent`

Rode **dentro de um projeto**:

```bash
thena g agent explorer
```

```
CREATE src/agents/explorer/explorer.agent.ts
CREATE src/agents/explorer/explorer.agent.md
```

O par é o ponto: a classe e o prompt dela, lado a lado. Ele também se recusa a
sobrescrever um agente existente.

O que ele **não** faz é registrar o agente — você o acrescenta aos `steps` de um
workflow:

```ts
@Workflow({ steps: [ExplorerAgent] })
export class ExplorerWorkflow {}
```

Não existe `thena g tool`, `thena g workflow` nem `thena g provider`. Uma tool é
uma classe com três campos; o scaffold não economizaria muito.

## Dentro do monorepo

Quem contribui com o próprio ThenaJS roda via npm:

```bash
npm run thena -- g agent explorer
```

## O que o CLI não é

Ele não roda o seu app (`npm start` faz isso), não compila, não gerencia
migrações, e não tem sistema de plugin. Ele escreve arquivos e para.

::: warning O CLI ainda imprime em português
O `thena create` e o `thena g` emitem o texto de uso e os erros em português
(`Uso:`, `Erro:`, `Criando o projeto…`) mesmo depois de as strings de usuário do
resto do framework terem ido para o inglês na 0.9. Os comandos e as flags são em
inglês e funcionam como documentado aqui.
:::

## Relacionado

- [Instalação](/pt/get-started/installation)
- [Seu primeiro agente](/pt/get-started/first-agent)
- [Depuração](/pt/devtools/debugging)
