---
layout: home

hero:
  name: ThenaJS
  text: O framework TypeScript para agentes de LLM
  tagline: Declare um agente como classe e o prompt dele como markdown. Execute com isolamento, orçamento e cancelamento já embutidos.
  image:
    src: /assets/logo.png
    alt: ThenaJS
  actions:
    - theme: brand
      text: Criar seu primeiro agente
      link: /pt/get-started/first-agent
    - theme: alt
      text: Introdução
      link: /pt/get-started/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/thenajs/ThenaJS

features:
  - icon: 🛡️
    title: O limite faz parte da API
    details: Orçamento de tempo, de chamadas, de tokens e de dinheiro. Cancelamento que chega dentro das suas tools, e não só entre os passos.
    link: /pt/get-started/configuration
    linkText: Configurar uma execução

  - icon: 🧵
    title: Um processo, muitas execuções
    details: Cada execução tem o próprio contexto, orçamento e gravador. Requisições concorrentes nunca enxergam o estado uma da outra.
    link: /pt/get-started/first-workflow
    linkText: Orquestrar agentes

  - icon: 🔍
    title: Dá para ver o que aconteceu
    details: Toda execução pode gerar um report em HTML e JSON — a árvore inteira de agentes, chamadas ao modelo e tools, com duração e custo em tokens.
    link: /pt/get-started/configuration
    linkText: Ligar o report
---

## Trinta segundos

```bash
npm install -g @thenajs/cli
thena create meu-agente
cd meu-agente && npm install && npm start
```

Um agente é isto:

```ts
// src/agents/explorer/explorer.agent.ts
import { Agent } from "@thenajs/core";
import { ShellTool } from "@thenajs/tools";
import { LocalOllamaProvider } from "../../providers/ollama.provider";

@Agent({
  provider: LocalOllamaProvider,
  tools: [ShellTool],
  prompt: "./explorer.agent.md", // o comportamento mora no markdown
})
export class ExplorerAgent {}
```

```md
<!-- src/agents/explorer/explorer.agent.md -->

Você explora projetos de software.

Use o shell para investigar antes de responder. Prefira comandos de leitura.
```

Nenhuma linha para tratar mensagem, chamar a API, perceber uma chamada de tool ou
validar argumento. Isso é trabalho do framework.

## Por que esse nome

**Thena** vem de **Atena** — e não por acaso.

Atena não é a deusa da guerra. Essa é Ares. Atena é a deusa da guerra
*estratégica*, da sabedoria e do ofício. É ela quem planeja antes de agir, quem
entrega as ferramentas ao herói e quem aparece para dizer a hora de parar.

O projeto inteiro é isso. O ThenaJS não deixa o seu agente mais inteligente. Ele
o deixa **governado**: planeja (`@Workflow`), age pelo que você entregou
(`@Tool`), conhece o próprio teto (`budget`) e pode ouvir que é hora de parar
(`abort`, `stop`).

## Por onde começar

| Se você quer… | Vá para |
| --- | --- |
| saber se serve para o seu caso | [Introdução](/pt/get-started/introduction) |
| colocar para rodar | [Instalação](/pt/get-started/installation) |
| construir algo de ponta a ponta | [Seu primeiro agente](/pt/get-started/first-agent) |
| descobrir o que ler depois | [Próximos passos](/pt/get-started/next-steps) |
