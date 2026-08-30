<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Salva uma imagem, um clipe ou o som dele do Instagram e do TikTok com um clique. Uma pequena extensão de navegador para juntar referências.**

[![Versão mais recente](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licença](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Navegadores](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · **Português** · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Abra uma publicação e um botão redondo aparece no canto. Ao pressioná-lo, o que está na tela vai para a sua pasta de downloads. É toda a ferramenta.

## Instalação

### Chrome

O Chrome não permite instalar extensões fora da sua própria loja, e essa loja não publica extensões deste tipo. A instalação é manual:

1. Baixe `stash-chrome-x.y.z.zip` da [versão mais recente](https://github.com/antonyshakirov/stash/releases/latest) e descompacte.
2. Abra `chrome://extensions` e ative o modo de desenvolvedor.
3. Clique em «Carregar sem compactação» e escolha a pasta descompactada.

A atualização também é manual. Extensões descompactadas nunca se atualizam sozinhas — o Chrome não tem mecanismo para isso. Baixe a nova versão e clique em «Atualizar» na mesma página.

### Firefox

[Instalar o Stash](https://antonshakirov.com/stash/stash-latest.xpi) com um clique. O pacote é assinado pela Mozilla, então não precisa de loja nem de modo de desenvolvedor, e ele se atualiza sozinho. Requer Firefox 140 ou mais recente.

Recarregue as abas que já estavam abertas: a extensão não chega até elas.

## Como funciona

Abra a publicação ou o clipe por inteiro. No Instagram é um endereço como `/p/…` ou `/reel/…`; no TikTok, `/@autor/video/…` ou `/@autor/photo/…`. Um botão redondo aparece no canto inferior direito e, ao lado, outro com uma nota musical sempre que houver som a pegar.

As imagens são salvas uma de cada vez. Num carrossel, vá até o slide que quiser e pressione: sai exatamente aquele. Três slides de sete significam três toques.

No feed e na grade do perfil não há botão, e isso é proposital. Ali o que está sob o cursor é uma miniatura, e o arquivo sairia pior do que o original.

O som é extraído do próprio clipe e dura exatamente o mesmo que ele. Dez segundos de uma música no clipe são dez segundos no arquivo.

Salvar a mesma imagem duas vezes não cria duplicata: a extensão lembra o que já tem e avisa. Se ainda assim quiser a cópia, pressione uma segunda vez seguida.

## Para onde vão os arquivos

| O quê | Onde | Exemplo de nome |
|---|---|---|
| Clipes | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Imagens | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Som | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

O número no fim é o do slide dentro do carrossel. Uma publicação comum não tem.

Os nomes das pastas podem ser mudados: clique com o botão direito no ícone do Stash na barra e escolha «Opções». Um campo vazio restaura o nome padrão. A barra indica aninhamento: `Refs/Saved Reels` coloca uma pasta dentro de outra.

## O que o Stash não faz

O Stash não envia por conta própria nenhuma requisição ao Instagram ou ao TikTok. A extensão lê os dados que a página já recebeu para mostrar a publicação e, quando eles não estão lá, diz isso em vez de ir buscá-los. Nada é enviado a lugar nenhum: o arquivo vai do CDN da plataforma para o disco da mesma pessoa que está vendo a publicação.

Nenhuma assinatura ou proteção é contornada, nenhum login é automatizado, nenhuma conta alheia é tocada e nenhuma estatística é coletada.

Não há download em massa de carrosséis, perfis ou coleções, nem fila de downloads, nem escolha manual de qualidade. O som é copiado como está.

O YouTube não é suportado.

## Direitos e responsabilidade

O Stash não tem vínculo com o Instagram, o TikTok ou a Meta, nem aprovação deles. Os nomes aparecem aqui apenas para dizer onde a extensão funciona.

Os direitos sobre o que você salvar pertencem a quem publicou. Esta extensão não concede nenhum direito sobre material alheio. Salvar o trabalho de outra pessoa para ver e juntar referências é uma coisa; republicar ou usar comercialmente é outra, e responde quem salvou.

## Mais

Compilação, arquitetura do código e solução de problemas estão no [README em inglês](../../README.md).

## Licença

[MIT](../../LICENSE).
