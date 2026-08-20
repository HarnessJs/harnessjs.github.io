---
layout: page
title: ThenaJS
titleTemplate: false
aside: false
editLink: false
lastUpdated: false
prev: false
next: false
head:
  - - meta
    - name: robots
      content: noindex
  - - link
    - rel: alternate
      hreflang: en
      href: https://thenajs.github.io/en/
  - - link
    - rel: alternate
      hreflang: pt
      href: https://thenajs.github.io/pt/
  - - link
    - rel: alternate
      hreflang: x-default
      href: https://thenajs.github.io/en/
  - - meta
    - http-equiv: refresh
      content: 0; url=/en/
---

<div style="max-width: 30rem; margin: 6rem auto; padding: 0 1.5rem; text-align: center">

# ThenaJS

Choose a language — escolha um idioma.

<p>
  <a href="/en/" style="font-weight:600">English</a>
  &nbsp;·&nbsp;
  <a href="/pt/" style="font-weight:600">Português</a>
</p>

</div>

<script setup>
import { onMounted } from 'vue'

// O `meta refresh` acima já resolve sem JavaScript — GitHub Pages não faz
// redirecionamento no servidor. Isto só melhora o palpite: quem tem o navegador
// em português cai no português, e não no inglês.
onMounted(() => {
  const pt = (navigator.languages ?? [navigator.language ?? ''])
    .some((l) => l.toLowerCase().startsWith('pt'))
  location.replace(pt ? '/pt/' : '/en/')
})
</script>
