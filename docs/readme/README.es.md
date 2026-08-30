<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Guarda una imagen, un clip o su sonido de Instagram y TikTok con un solo clic. Una pequeña extensión de navegador para reunir referencias.**

[![Última versión](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licencia](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Navegadores](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Deutsch](README.de.md) · [English](../../README.md) · **Español** · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt.md) · [Русский](README.ru.md)

</div>

Abre una publicación y aparecerá un botón redondo en la esquina. Al pulsarlo, lo que hay en pantalla acaba en tu carpeta de descargas. Eso es toda la herramienta.

## Instalación

### Chrome

Chrome no permite instalar extensiones fuera de su propia tienda, y esa tienda no publica extensiones de este tipo. La instalación es manual:

1. Descarga `stash-chrome-x.y.z.zip` de la [última versión](https://github.com/antonyshakirov/stash/releases/latest) y descomprímelo.
2. Abre `chrome://extensions` y activa el modo de desarrollador.
3. Pulsa «Cargar descomprimida» y elige la carpeta descomprimida.

La actualización también es manual. Las extensiones descomprimidas nunca se actualizan solas: Chrome no tiene ningún mecanismo para ello. Descarga la nueva versión y pulsa «Actualizar» en esa misma página.

### Firefox

[Instalar Stash](https://antonshakirov.com/stash/stash-latest.xpi) con un clic. El paquete está firmado por Mozilla, así que no hacen falta ni tienda ni modo de desarrollador, y se actualiza solo. Requiere Firefox 140 o posterior.

Recarga las pestañas que ya tuvieras abiertas: la extensión no llega a ellas.

## Cómo funciona

Abre la publicación o el clip por completo. En Instagram es una dirección del tipo `/p/…` o `/reel/…`; en TikTok, `/@autor/video/…` o `/@autor/photo/…`. Abajo a la derecha aparece un botón redondo y, junto a él, otro con una nota musical cuando hay sonido que tomar.

Las imágenes se guardan de una en una. En un carrusel, desplázate hasta la diapositiva que quieras y pulsa: se guarda exactamente esa. Tres de siete significa pulsar tres veces.

En el feed y en la cuadrícula del perfil no hay botón, y es deliberado. Ahí lo que hay bajo el cursor es una miniatura, y el archivo saldría peor que el original.

El sonido se extrae del propio clip y dura exactamente lo mismo que él. Diez segundos de una canción en el clip son diez segundos en el archivo.

Guardar dos veces la misma imagen no crea un duplicado: la extensión recuerda lo que ya tiene y lo dice. Si aun así quieres la copia, pulsa una segunda vez seguida.

## Dónde acaban los archivos

| Qué | Dónde | Ejemplo de nombre |
|---|---|---|
| Clips | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Imágenes | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Sonido | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

El número final es el de la diapositiva dentro del carrusel. Una publicación normal no lo lleva.

Los nombres de las carpetas se pueden cambiar: clic derecho en el icono de Stash en la barra y «Opciones». Un campo vacío restablece el nombre por defecto. Una barra indica anidamiento: `Refs/Saved Reels` mete una carpeta dentro de otra.

## Lo que Stash no hace

Stash no envía por su cuenta ni una sola petición a Instagram o TikTok. La extensión lee los datos que la página ya ha recibido para mostrarte la publicación, y cuando no están, lo dice en lugar de ir a buscarlos. No se envía nada a ninguna parte: el archivo viaja del CDN de la plataforma al disco de la misma persona que está mirando la publicación.

No se elude ninguna firma ni protección, no se automatiza ningún inicio de sesión, no se toca ninguna cuenta ajena y no se recoge ninguna estadística.

No hay descarga masiva de carruseles, perfiles ni colecciones, ni cola de descargas, ni selección manual de calidad. El sonido se copia tal cual.

YouTube no es compatible.

## Derechos y responsabilidad

Stash no está afiliado a Instagram, TikTok ni Meta, ni cuenta con su aprobación. Sus nombres aparecen aquí solo para indicar dónde funciona la extensión.

Los derechos sobre lo que guardes pertenecen a quienes lo publicaron. Esta extensión no concede ningún derecho sobre el material ajeno. Guardar el trabajo de otra persona para verlo y reunir referencias es una cosa; volver a publicarlo o usarlo comercialmente es otra, y responde quien lo guardó.

## Más

La compilación, la arquitectura del código y la resolución de problemas están en el [README en inglés](../../README.md).

## Licencia

[MIT](../../LICENSE).
