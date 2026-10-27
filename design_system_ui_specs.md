# Documentación de Diseño UI/UX: Descargador Premium

Este documento detalla la arquitectura de diseño, componentes, paleta de colores y micro-interacciones de la interfaz **Descargador Premium UI**, una herramienta profesional para la descarga de contenido de YouTube y YouTube Music.

---

## 1. Filosofía de Diseño

El rediseño se alejó de los degradados suaves, desenfoques (glassmorphism) y apariencias genéricas generadas por IA. En su lugar, adopta un enfoque **"Hardcore Profesional"**:
*   **Contraste Alto y Agresivo:** Uso de fondos ultra oscuros contrastados con un rojo carmesí puro para denotar velocidad, potencia y precisión.
*   **Profundidad Táctil:** En lugar de sombras difusas para elevar elementos, se utilizan sombras interiores (*inset shadows*) para crear receptáculos (inputs, barras) y bordes definidos para contenedores, dándole un aspecto de "panel de control" físico.
*   **Claridad de la Información:** Estructura en cuadrícula (grid) estricta, separando claramente la acción (izquierda) de la previsualización (derecha).

---

## 2. Paleta de Colores (Design Tokens)

El diseño utiliza una paleta de colores personalizada extendida sobre Tailwind CSS.

### Colores Base (Fondos y Paneles)
*   **Fondo Principal (`#0a0a0f`):** Un negro/zinc profundo (casi obsidiana) para minimizar la fatiga visual.
*   **Paneles Elevados (`#14141e`):** Ligeramente más claro para diferenciar las tarjetas del fondo.
*   **Bordes Base (`#262635`):** Subrayan la separación de elementos sin ser invasivos.
*   **Inputs y Receptáculos (`#0c0c12`):** Más oscuros que el fondo principal, simulando hundimiento en la interfaz.

### Colores de Acento
*   **Rojo Carmesí Primario (`#e50914`):** El color de acción principal, vibrante y enérgico.
*   **Rojo Claro / Hover (`#ff1e27`):** Utilizado para estados de interacción (hover) y barras de progreso activas.
*   **Rojo Oscuro (`#b20710`):** Usado para los contrastes en la barra de progreso animada.

### Texto
*   **Primario (`#e2e8f0`):** Blanco con un toque frío para legibilidad óptima.
*   **Secundario (`#94a3b8`):** Gris claro para metadatos y subtítulos.
*   **Silenciado (`#64748b`):** Para placeholders e información menos relevante.

---

## 3. Tipografía

*   **Fuente Principal:** `Plus Jakarta Sans`
*   **Justificación:** Es una fuente geométrica moderna que ofrece excelente legibilidad en tamaños pequeños (ideal para listas de canciones y metadatos) y un peso visual contundente en sus variantes `Bold` (700) y `ExtraBold` (800) para los títulos y botones.

---

## 4. Arquitectura de Layout (Grid System)

La aplicación utiliza un layout de ancho máximo (`max-w-[1300px]`) centrado, dividido en un **CSS Grid de 12 columnas** en pantallas grandes:

### Columna Izquierda (7 de 12 columnas) - Área Operativa
Contiene todo lo relacionado con la interacción directa del usuario.
1.  **Panel de Controles:**
    *   **Input de URL:** Un textarea con `shadow-inset-deep` para parecer hundido, ícono a la izquierda y un botón integrado de "Pegar" posicionado absolutamente en la esquina inferior derecha.
    *   **Selector de Formato:** Un control segmentado (*segmented control*) que simula pestañas físicas para cambiar entre Audio y Video.
    *   **Selector de Calidad:** Un menú desplegable estilizado que hace juego con el input de texto.
    *   **Botón de Acción (CTA):** Un botón masivo, con un sutil degradado de rojo carmesí a rojo claro, ícono prominente, y un ligero efecto de *glow* (resplandor). Al hacer clic, tiene un efecto físico (`active:scale-[0.98]`).
2.  **Cola de Descargas:**
    *   Lista de elementos en proceso o terminados.
    *   Incluye contadores de estado ("2 Activas") con estilos de etiqueta (píldora).

### Columna Derecha (5 de 12 columnas) - Previsualización (Contexto)
Una barra lateral que se mantiene fija (`sticky top-8`) mientras el usuario hace scroll en las descargas.
*   **Cabecera de Playlist (Hero):** Imagen de portada mezclada con el fondo (`mix-blend-luminosity`) y opacidad reducida para no competir con el texto. Al pasar el cursor, recupera su color.
*   **Lista de Pistas (Tracklist):** Diseño tabular optimizado para lectura rápida. Las filas reaccionan al hover mostrando un ícono de "Play" de color rojo intenso, sustituyendo el número de pista.
*   **Scroll Personalizado:** Una barra de desplazamiento delgada y oscura que no rompe la inmersión del diseño.

---

## 5. Micro-interacciones y Animaciones

### Barra de Progreso Avanzada
La barra de descarga activa es el elemento más dinámico de la UI:
*   **Estructura:** Está contenida en un receptáculo hundido (`shadow-inset-deep`).
*   **Animación de Franjas (Barber Pole):** Un patrón lineal creado con `linear-gradient` inclinado a `-45deg` que alterna entre el **Rojo Carmesí** y el **Rojo Oscuro** (sin blanco ni transparencias para evitar tonos rosas).
*   **Movimiento:** Utiliza `@keyframes moveStripes` animando el `background-position` de forma infinita y lineal durante `1s`, dando la sensación de alta velocidad y procesamiento continuo.
*   **Resplandor:** Se le aplica un `box-shadow` rojo sutil para denotar que el proceso está "caliente" o en curso.

### Estados de las Tarjetas de Descarga
*   **Activa:** Borde sutil, resalta ligeramente al hacer *hover*. Muestra velocidad (ej. 3.4 MB/s) y controles rápidos (pausar, cancelar).
*   **Completada:** La miniatura pasa a escala de grises (`grayscale`) y la opacidad general baja al 80%. La barra de progreso se vuelve un color sólido oscuro (`#262635`), indicando inactividad. El color del texto de estado cambia a un verde esmeralda (`#10b981`) para el "Completado".

---

## 6. Iconografía

El sistema utiliza **Phosphor Icons**, combinando variantes:
*   `ph-bold`: Para íconos estructurales y botones secundarios (claridad y peso).
*   `ph-fill`: Para indicar estado activo, botones primarios, y controles de medios (Play, Pausa, Notas Musicales).