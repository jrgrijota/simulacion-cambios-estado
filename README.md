# Cambios de Estado — Simulación Interactiva

Simulación para **Física y Química de la ESO** sobre los cambios de estado de la materia
(fusión, solidificación, vaporización, condensación, sublimación y sublimación inversa) desde
el **modelo de partículas**.

## Modos

- **Calentar y enfriar (curva de calentamiento):** calienta o enfría una sustancia y observa,
  a la vez, el recipiente, sus partículas y la gráfica temperatura–tiempo. Durante un cambio de
  estado la temperatura no varía: la energía se usa para separar (o unir) las partículas.
- **Presión y temperatura (diagrama de fases):** mueve un punto por el diagrama de fases del agua
  o del dióxido de carbono y descubre por qué el agua hierve a unos 72 °C en el Everest o por qué el
  hielo seco pasa directamente a gas.

## Criterio didáctico

Se prioriza la **claridad pedagógica** frente a la exactitud numérica: las temperaturas de
fusión y ebullición son reales, pero los tiempos y energías están escalados para que cada tramo
de la curva se vea con claridad en el aula. El diagrama de fases es esquemático (no a escala).

## Uso

Abre `index.html` en un navegador. No necesita instalación ni conexión: incluye [p5.js](https://p5js.org/)
en `js/vendor/`. Incluye temas oscuro, claro y alto contraste (botón del engranaje).
Con `?lang=en` en la dirección (`index.html?lang=en`) muestra la interfaz en inglés.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Panel de controles de los dos modos |
| `css/style.css` | Estilos y temas (mismo sistema visual que el resto de simulaciones) |
| `js/sketch.js` | Modo calentar y enfriar: modelo de energía, recipiente, partículas, gráfica y mensajes |
| `js/fases.js` | Modo diagrama de fases: curvas, interacción y mensajes |
| `js/i18n.js`, `js/i18n-en.js` | Idioma de la interfaz (`?lang=en`) y traducciones al inglés |
