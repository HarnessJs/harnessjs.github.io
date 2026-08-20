# Suporte

## Antes de perguntar

Dois minutos aqui normalmente já respondem, e sempre melhoram a pergunta:

1. **Ligue `log: "verbose"`.** Ele imprime o prompt, a resposta e o I/O das tools.
   A maioria das perguntas do tipo "por que ele fez isso" acaba aqui.
2. **Ligue `report: true`** e abra `report/index.html`. A árvore mostra qual passo
   deu errado, quanto tempo levou e quanto custou.
3. **Confira [Problemas comuns](/pt/help/troubleshooting)** — cobre os erros que
   mais aparecem.
4. **Confira as [Perguntas frequentes](/pt/help/faq)** para comportamento que está
   funcionando como projetado.

## Onde perguntar

| | |
| --- | --- |
| **Bug, ou algo que parece um** | [github.com/thenajs/ThenaJS/issues](https://github.com/thenajs/ThenaJS/issues) |
| **Dúvida, ideia, "isso deveria…"** | [GitHub Discussions](https://github.com/thenajs/ThenaJS/discussions) |
| **Um problema nesta documentação** | [thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io/issues) |
| **Algo sensível de segurança** | veja o [SECURITY.md](https://github.com/thenajs/ThenaJS/blob/main/SECURITY.md) — não abra issue pública |

## O que faz um bom relato

Anexe o `report/<runId>/report.json` da execução. Ele carrega a árvore inteira —
cada agente, chamada ao modelo e chamada de tool, com duração, uso de tokens e
status — e é muito mais útil que uma descrição do que você viu.

::: warning Leia antes de anexar
O mascaramento de segredo vem ligado e pega os padrões conhecidos (`Bearer …`,
`sk-…`, `ghp_…`, JWT, connection string, campos nomeados como `api_key`). Ele não
pega o nome de um cliente nem uma URL interna. Se a execução tocou em dado real,
reproduza com `report: { content: false }` — isso mantém a árvore, as durações e a
telemetria, e descarta o texto.
:::

Também vale incluir:

- o **modelo e o provider** (`qwen2.5-coder:7b` no Ollama, `gpt-4o-mini`, …) —
  muito do comportamento do agente é comportamento do modelo;
- o seu **`ThenaConfig`** e a declaração do `@Workflow`;
- as **versões**: `node --version` e a versão dos `@thenajs/*` no seu
  `package.json`;
- o que você esperava no lugar.

## Contribuindo

O framework e a documentação são repositórios separados:

- **Framework** — [thenajs/ThenaJS](https://github.com/thenajs/ThenaJS). Comece
  pelo [CONTRIBUTING.md](https://github.com/thenajs/ThenaJS/blob/main/CONTRIBUTING.md).
- **Documentação** —
  [thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io). Toda
  página tem um link "Sugerir uma mudança nesta página" no rodapé, que abre o
  arquivo certo.

Uma página escrita num idioma precisa da contraparte no outro; o `npm run check`
no repositório da documentação cobra isso, junto da validação de links e de
estrutura.

## Situação do projeto

0.9.x, pré-1.0, e em movimento. A API descrita aqui é a que existe hoje. Espere
quebras entre versões menores, e leia as [notas de migração](/pt/help/migration) ao
subir de versão.

Publicado sob a licença MIT.
