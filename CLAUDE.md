# Herramienta de Planos Residenciales

PWA para dibujar planos de vivienda (1 o más pisos + azotea) por capas —
arquitectónica, drenaje, hidráulica y eléctrica — con exportación a PDF y
JSON. Pensada para un solo usuario (el dueño de la herramienta), instalable
en escritorio y móvil.

## Stack técnico

- **React 19 + TypeScript**, compilado con **Vite** (`@vitejs/plugin-react`).
- **Tailwind CSS v4** (`@tailwindcss/vite`, sin `tailwind.config.js` — v4 se
  configura vía CSS en `src/index.css`).
- **Zustand** para todo el estado de la app (`src/store/`) — no hay Redux ni
  Context API para esto.
- **Firebase**: Auth (login) + Firestore (persistencia de proyectos).
- **vite-plugin-pwa**: manifest + service worker, app instalable.
- **jsPDF + html2canvas**: exportación a PDF (carga perezosa, solo al
  exportar — ver `src/lib/exportPdf.tsx`).
- **oxlint** para linting (`npm run lint`).

Comandos: `npm run dev`, `npm run build` (corre `tsc -b` primero), `npm run
preview`, `npm run lint`.

## Estructura del código

```
src/
  types.ts              Modelo de datos central (ver abajo)
  App.tsx                Enrutamiento de alto nivel: auth → proyectos → editor
  main.tsx
  index.css               Tokens de tema (:root, [data-theme="..."])
  store/
    useProjectStore.ts    Estado del proyecto/editor (la mayor parte de la app)
    useThemeStore.ts      Tema claro/intermedio/oscuro (persistido en localStorage)
  lib/
    firebase.ts           Inicializa Firebase solo si hay env vars (ver Auth)
    projectRepo.ts         Firestore o localStorage según haya Firebase o no
    localProjectStore.ts   Respaldo en localStorage (modo sin Firebase)
    wallEdit.ts             Geometría de abrir puertas/ventanas en un muro
    hitTest.ts               Selección por clic, "manijas" de edición, imán a puntas
    stamps.ts / symbols.tsx  Catálogo de símbolos colocables (equipos, piezas…) — fuente única para Toolbar y SymbologyPanel
    quantify.ts              Cuantificación real (m de muro/tubería, piezas…)
    exportQuantities.ts      Cuantificación de todo el proyecto como CSV descargable
    rooms.ts                 Detecta habitaciones cerradas y calcula su área (m²)
    exportPdf.tsx             Exportación a PDF
  components/
    ProjectsScreen.tsx      Lista de proyectos, crear/abrir/borrar/importar
    TopBar.tsx, Toolbar.tsx, LayersPanel.tsx, CanvasViewport.tsx, PlanCanvas.tsx
    PropertiesPanel.tsx      Editor de propiedades del objeto seleccionado (o barra de selección múltiple)
    SymbologyPanel.tsx       Leyenda de símbolos por capa (icono real + nombre), colapsable
    CircuitsPanel.tsx        Panel de circuitos derivados (etapa 2 eléctrica)
    ExportModal.tsx, Login.tsx, ThemeToggle.tsx
  data/
    seedProject.ts          Proyecto de ejemplo + fábricas de proyecto/nivel en blanco
```

## Modelo de datos (`src/types.ts`)

- **`Project`**: `{ id, name, scaleLabel, levels[], createdAt, updatedAt }`.
- **`Level`**: un piso/nivel — `{ key, label, layers, circuits[] }`. Los
  niveles son una lista dinámica (`LevelKey` es `string`, no un enum): un
  proyecto nuevo arranca con un solo nivel y se agregan los que hagan falta
  desde el "+" junto al selector de nivel.
- **`layers`**: `Record<'base' | 'drenaje' | 'hidraulica' | 'electrica',
  DrawObject[]>` — cada capa es simplemente un arreglo de objetos dibujables.
  El orden de capas es fijo (base → drenaje → hidráulica → eléctrica).
- **`DrawObject`**: unión discriminada por `kind`. Los tipos relevantes:
  - `wall`, `path` (tuberías/ductos/pincel/cotas — línea de 2 puntos con
    color/grosor propios; `material?: HidraulicaMaterial` en piezas
    hidráulicas; `groupId?: string` opcional para ligar dos objetos que
    deben borrarse juntos — hoy solo lo usa "cota", ver más abajo),
    `doorArc`, `window` (movible/redimensionable, ver Edición y selección),
    `dome`, `circle`, `rect`, `text` (también con `groupId?`).
  - **`symbol`**: el tipo genérico para todo lo que debe poder
    seleccionarse/rotarse/moverse/**redimensionarse** después de colocado
    (equipos hidráulicos, piezas de tubería, dispositivos y tablero
    eléctrico). Guarda `{ shape, x, y, rotation, color, label?, scale? }`
    — la geometría real de cada `shape` vive en `src/lib/symbols.tsx` y se
    dibuja con un `<g transform="translate(x,y) rotate(rotation)
    scale(scale)">`, así que rotar/mover/agrandar un objeto ya colocado es
    solo cambiar esos números, nunca recalcular coordenadas absolutas.
- **`Circuit`**: `{ id, name, type }` (`type` = `contactos | iluminacion |
  fuerza`), vive en `Level.circuits`. Los `path` de la capa eléctrica cargan
  un `circuitIds?: string[]` opcional — de ahí sale el contador de cables
  por ducto en la etapa "Cableado".

### Edición y selección

`useProjectStore` trae `past`/`future` (arreglos de snapshots de `Project`)
para deshacer/rehacer — **toda** mutación de geometría pasa por
`applyEdit()`/`addObject()`, nunca se muta `layers` directamente, así el
historial queda consistente sin que cada herramienta lo maneje aparte.

La herramienta "Seleccionar" permite: clic para seleccionar, arrastrar un
símbolo/pieza/ventana para moverlo, arrastrar los extremos (manijas) de un
muro/tubería/ducto para estirarlo (un domo también tiene manija — en su
esquina inferior derecha, para redimensionarlo), `R` para rotar (símbolos),
flechas del teclado para mover de a 10 unidades, `Supr`/`Backspace` para
borrar, `Ctrl/Cmd+D` para duplicar (`duplicateSelected()` en el store,
offset fijo de 24 unidades, limpia `groupId` del clon para no encadenarlo
al original). Redimensionar: domo/ventana por manija o campo ANCHO/ALTO en
`PropertiesPanel.tsx`; símbolos por el campo TAMAÑO (%) del mismo panel
(mueve `scale`, ver arriba). Esa lógica de arrastre vive en
`CanvasViewport.tsx` (necesita el pan/zoom para convertir coordenadas de
pantalla a espacio del SVG vía `getScreenCTM()`); también soporta pellizcar
para hacer zoom (dos dedos — `activePointers`/`pinch` en ese archivo,
escala por razón de distancias, paneo por el punto medio, ambos en px de
pantalla para no tener que invertir la transformación CSS).

**Mantener la barra espaciadora activa el paneo** aunque haya otra
herramienta de dibujo activa (como en Photoshop) — `CanvasViewport.tsx`,
`spacePanning` (estado, para que el cursor cambie a manito) +
`onPointerDown` lo revisa ANTES que la lógica propia de `activeTool`,
así que space manda sobre cualquier herramienta. Un listener de teclado a
nivel `window` ignora la tecla si el foco está en un `<input>`/`<textarea>`/
contenteditable (renombrar nivel, etiqueta, presión…), para no robarle el
espacio literal que el usuario esté escribiendo ahí. Al soltar el paneo,
el navegador dispara igual un `click` de verdad sobre el `<svg>` de abajo
(con mouse real ese `click` NO es un evento sintético de compatibilidad
como con touch, así que `preventDefault()` en el `pointerdown` no lo
evita — se probó, seguía colando el primer punto de un tramo como "click
fantasma" al soltar el mouse). Se resuelve con `suppressNextClick` (ref) +
un `onClickCapture` en el contenedor que se traga ESE click en fase de
captura, antes de que le llegue al `onClick` de `PlanCanvas`.

**Arrastrar prioriza al objeto ya seleccionado** sobre "el más cercano al
clic" (`CanvasViewport.tsx`, `onPointerDown`) — domo/ventana/rect usan un
hit-test de caja que regresa distancia `0` si el clic cae dentro (no una
distancia real), así que si dos de ellos se solapan (típicamente un domo
recién duplicado, a solo 24 unidades del original) el empate lo ganaba
SIEMPRE el primero en el arreglo por orden de inserción — es decir, el
original, no el clon recién seleccionado. Arrastrar el clon en realidad
movía el original por debajo mientras el clon (el que se veía
seleccionado) se quedaba quieto — se sentía como "lo dupliqué, lo
arrastré y desapareció" (bug real, reportado). Ahora, si el objeto en
`selection` también cae bajo el clic (`hitDistance()` de `hitTest.ts`,
exportada para esto), gana él sin importar el orden del arreglo.

**Selección múltiple**: Shift+clic agrega/quita un objeto de
`store.multiSelection` (`{ layer, ids[] }`, separado de `selection` a
propósito — `selection` sigue siendo "el objeto principal" que usan las
manijas y el panel de propiedades, que no tiene sentido para varios
objetos de tipos distintos a la vez). Con 2+ objetos en `multiSelection`,
**todas** las acciones de teclado tienen su versión "multi" (`Supr`→
`deleteMultiSelection()`, flechas→`nudgeMultiSelection()`, `R`→
`rotateMultiSelection()`, `Ctrl/Cmd+D`→`duplicateMultiSelection()`) — la
decisión de cuál llamar vive en `PlanCanvas.tsx` (`isMulti =
multiSelection.ids.length > 1`), no en el store; si agregas una acción de
teclado nueva, replica el patrón o se te va a quedar "coja" para
selección múltiple (ya pasó una vez con rotar/duplicar). Arrastrar
cualquiera de los objetos del grupo los mueve juntos (`DragPreview` de
kind `translate` carga `ids: string[]`, no un solo `id`).
`PropertiesPanel.tsx` muestra una barra compacta ("N objetos
seleccionados" + duplicar/borrar) en vez del editor de un solo objeto. No
hay selección por rectángulo (arrastrar en vacío sigue siendo paneo) —
solo Shift+clic uno por uno. Un detalle importante: el "click" nativo del
navegador llega DESPUÉS del pointerdown/up de `CanvasViewport` (haya
arrastre o no) y burbujea hasta el `onClick` de `PlanCanvas` — ese
handler solo debe actuar sobre tipos NO arrastrables (rect/doorArc); para
los arrastrables, `CanvasViewport` ya resolvió la selección/multiselección
por completo, y dejar que el click también corra ahí pisa lo que se
acaba de armar (fue un bug real: perdía la selección múltiple justo
después de arrastrar el grupo).

**`PlanCanvas` está envuelto en `React.memo`** — el zoom/paneo vive como
estado local en `CanvasViewport.tsx` (`scale`/`tx`/`ty`) y se aplica con un
`transform` de CSS al contenedor, sin pasárselo a `PlanCanvas` como prop;
sin `memo`, cada tick de la rueda del mouse y cada pixel de un arrastre de
paneo disparaban un re-render completo del plano (cada muro, tubería,
símbolo…), lo cual con un plano de tamaño normal saturaba el hilo
principal — se sentía como "el contenedor cambia de tamaño pero el
contenido se atora" (bug real, reportado y corregido). Si alguna vez
`PlanCanvas` necesita saber la escala/paneo, pásaselo por prop explícito
en vez de leerlo de otro lado, para no romper el memo sin querer.

**El bloqueo de capa (candado) protege cualquier mutación por selección**,
no solo evita empezar a dibujar/arrastrar — `deleteSelected`,
`nudgeSelected`, `rotateSelected`, `duplicateSelected`, `setHandlePoint` y
sus cuatro equivalentes "multi" revisan `layerState[layer].locked` al
entrar (antes solo bloqueaba iniciar el arrastre; un objeto ya
seleccionado ANTES de bloquear la capa se podía seguir borrando/moviendo
por teclado — bug real, corregido). Si agregas una acción nueva que mute
por `selection`/`multiSelection`, agrégale ese mismo guard.

**Duplicar** (`duplicateObject()` en el store) regresa `null` para
`doorArc` — su geometría (hinge/leaf + el radio y el punto final metidos
en el string de `sweep`) no encaja en el desplazamiento genérico por
`DUP_OFFSET`, y duplicarla sin el hueco real en un muro no tiene mucho
sentido de todas formas; `duplicateSelected`/`duplicateMultiSelection`
manejan ese `null` sin crear nada, y `PropertiesPanel.tsx` ni muestra el
botón para ese tipo.

**`doorArc` sí se puede seleccionar/borrar/editar** (bug real, corregido:
`hitDistance()` en `hitTest.ts` regresaba `null` siempre para este tipo,
así que un clic nunca la encontraba — ni para seleccionarla ni, por lo
tanto, para borrarla con Supr). El hit-test ahora mide contra la hoja
(línea bisagra→hoja, la que sí se dibuja), contra el segmento
bisagra→extremo del hueco (el otro lado, reconstruido del final del
string `sweep`) y contra el círculo del radio de barrido — lo que quede
más cerca. `renderObject()` (`PlanCanvas.tsx`) tampoco tenía resaltado de
selección para este tipo (los demás casos sí dibujan un `sel-highlight`
cuando `selected`, pero `doorArc` no traía ese `if` — bug real, corregido:
se veía "seleccionada" solo por `PropertiesPanel.tsx`, sin ninguna marca
en el lienzo). `PropertiesPanel.tsx` expone ANCHO y **dos** inversiones
independientes para una puerta ya colocada, cada una un eje distinto de
la geometría (`wallEdit.ts`):
- **"Invertir apertura"** (`flipDoorObject`) — hacia qué lado del muro se
  abre la hoja; refleja la hoja al otro lado de la línea bisagra→extremo
  (2·bisagra − hoja, válido porque la hoja siempre está a exactamente 90°
  de esa línea por construcción).
- **"Invertir bisagra"** (`swapDoorHinge`) — cuál extremo del hueco es la
  bisagra, o sea el sentido hacia el que gira/cierra la hoja; intercambia
  bisagra y extremo conservando el mismo lado del muro (la perpendicular
  se calcula con la dirección bisagra→extremo ORIGINAL, antes de
  intercambiarlos — recalcularla después invertiría el lado también,
  pisando lo que hace "Invertir apertura"; las dos inversiones deben
  quedar independientes entre sí).

Redimensionar (`resizeDoorObject`) mantiene la bisagra fija y recalcula
el extremo/hoja a partir de ahí. Ninguna de las tres operaciones toca el
hueco real recortado en el muro (el objeto `doorArc` no guarda a qué
muro pertenece) — mismo alcance que ya tenía el campo ANCHO de `window`
(tampoco mueve el muro), así que una puerta bastante más ancha que su
hueco original puede verse encimada al muro; es una limitación conocida
y consistente entre los dos tipos, no un descuido.

**Precisión del trazo** (`store.gridSnap`, botón "10 cm"/"1 cm" en el
`TopBar`): al dibujar, cada clic redondea a este paso (10 unidades por
defecto, 1 en modo fino) — también rige el paso de las flechas del
teclado sobre un objeto seleccionado y el punto donde se abre una puerta/
ventana sobre un muro. En modo fino el radio del imán a puntas cercanas
(siguiente punto) baja de 16 a 6 unidades, si no un clic a propósito a
pocos centímetros de una esquina existente siempre terminaría saltando a
ella.

**Imán a puntas ya dibujadas**: mientras se traza con una herramienta de
varios tramos, el punto del clic hace snap al extremo más cercano de un
objeto ya existente **en la misma capa** (`findNearbyEndpoint()` en
`hitTest.ts`, radio 16 unidades) antes de caer al snap plano de la
cuadrícula de 10 — necesario para que las uniones en T cierren de verdad
(ver `computeRooms()` más abajo, que depende de esto).

**Preview de distancia al dibujar**: con una herramienta de tramos activa,
un recuadro junto al cursor muestra la distancia del tramo en curso y,
desde el segundo tramo en adelante, también la distancia en línea recta
desde el origen de toda la cadena (`chainOrigin` en `PlanCanvas.tsx`,
independiente de `chainStart` que se mueve a cada tramo).

## Capas y sus herramientas

Cada capa (salvo base) tiene su propia sección en `Toolbar.tsx`, visualmente
diferenciada con el color de esa capa. Todas las piezas/equipos/dispositivos
colocables están definidos una sola vez en `src/lib/stamps.ts` (`PIEZA_DEFS`,
`PIEZA_HIDRAULICA_DEFS`, `EQUIPO_DEFS`, `DISPOSITIVO_DEFS`, `PRINCIPAL_DEFS`)
— los botones de `Toolbar.tsx` **y** el panel "Simbología" de
`SymbologyPanel.tsx` (`LayersPanel.tsx`, colapsable, icono real + nombre por
capa) leen de ahí, así que agregar una pieza nueva a esos `Record` la hace
aparecer en ambos lugares sola, sin tocar más archivos que `types.ts`
(nuevo `SymbolShape`) y `symbols.tsx` (su glifo).

- **Base / Arquitectónica**: muro (cualquier ángulo, ya no solo
  ortogonal), puerta y ventana (ancho, bisagra y lado de apertura
  configurables **al colocarlas** desde `Toolbar.tsx` — ver `wallEdit.ts`;
  ya colocadas, también se pueden reseleccionar y editar desde
  `PropertiesPanel.tsx`: ventana con ANCHO, puerta con ANCHO e "Invertir
  apertura"), domo, cota (medición real en metros, y borrar la línea o el
  texto borra la cota completa gracias a `groupId`), pincel (trazo libre)
  y etiqueta (texto libre). El **área habitable** de cada cuarto se
  calcula sola (`src/lib/rooms.ts`, `computeRooms()` — detecta las caras
  cerradas del grafo de muros, resuelve uniones en T y cruces en X, y
  "tapa" huecos de puertas/ventanas solo para efectos de cerrar el
  polígono) y se dibuja en el centroide de cada cuarto, con un relleno
  pastel muy difuminado (`ROOM_FILL_COLORS` en `PlanCanvas.tsx`, un color
  por índice de cuarto solo para diferenciarlos a simple vista, sin
  significado semántico) sobre el polígono real (`RoomPolygon.points`);
  ambos —relleno y etiqueta de m²— salen del mismo arreglo `rooms`, así
  que el botón "Área" del `TopBar.tsx` los oculta juntos sin lógica
  aparte.
- **Drenaje**: tubería (2"/4", flujo animado con dirección invertible desde
  `PropertiesPanel.tsx`), piezas — codo 90°, codo 45° (mismo `SymbolShape`
  `codo45` que ya usaba hidráulica, ver nota de `bajante`/`montante` más
  abajo sobre glifos compartidos entre capas), tee, Y, reducción, coladera,
  registro, salida a calle (drenaje municipal, se autoetiqueta), ventila
  (tubo de venteo), trampa/sifón, **bajante** (baja a un nivel inferior, se
  autoetiqueta "BAJA" — ver más abajo).
- **Hidráulica**: tubería fría/caliente (color) con diámetro 1/2"·3/4",
  material (cobre/PPR/CPVC/manguera) y flujo animado; piezas — codo 90°,
  codo 45°, tee, llave de paso, llave nariz (exterior), toma municipal,
  válvula check, conector, tuerca unión, medidor de agua, filtro/
  purificador, **montante** (sube a un nivel superior, se autoetiqueta
  "SUBE") — **todas coloreadas según fría/caliente** (toggle arriba de
  la lista de piezas) salvo la toma, que siempre es la entrada fría de la
  red; equipos con silueta propia y rotables — tinaco, cisterna, calentador
  de paso, calentador solar, bomba presurizadora, bomba de llenado; y
  "Presión" para anotar PSI en un punto de la tubería.

  **Bajante/montante** (`shape: 'bajante'` en `symbols.tsx`, círculo con
  punto central relleno — la convención de plano para "la tubería sigue
  verticalmente por este punto", no termina aquí): en planta, una tubería
  vertical se ve de punta (un punto, no una línea), así que se representa
  con un símbolo puntual en vez de dibujar la caída/subida literal. Es la
  misma `SymbolShape` reusada en las dos capas (igual que `codo`/`tee` ya
  se comparten entre drenaje e hidráulica) — lo único que cambia es bajo
  cuál `_DEFS` vive (`PIEZA_DEFS.bajante` en `stamps.ts` vs
  `PIEZA_HIDRAULICA_DEFS.bajante`) y la etiqueta automática que le pone
  cada `make*Object()` ("BAJA" vs "SUBE"), ya que un bajante (drenaje)
  siempre baja y un montante (hidráulica) siempre sube — a diferencia de
  la escalera de la capa base, no hace falta rotarlo para indicar
  dirección.

  **Piezas escaladas por diámetro**: un codo/tee/etc. sale más grande si se
  coloca con el diámetro de tubería más grueso seleccionado en ese momento
  — antes cualquier pieza salía del mismo tamaño sin importar el diámetro,
  así que no había forma de distinguir a simple vista para qué grosor de
  tubo era (a petición explícita del usuario). Reusa el campo `scale` que
  ya existía para redimensionar símbolos a mano (`makeSymbol()` en
  `stamps.ts` ahora acepta un `scale` opcional); `DRENAJE_DIAMETER_SCALE`/
  `HIDRAULICA_DIAMETER_SCALE` (mismo archivo) mapean 2"→1×, 4"→1.35× y
  1/2"→1×, 3/4"→1.2×. Es solo el tamaño INICIAL al colocarla — el campo
  TAMAÑO (%) de `PropertiesPanel.tsx` la sigue pudiendo ajustar después
  igual que a cualquier símbolo, sin tratamiento especial. El selector de
  diámetro vive en la vista de la herramienta de TUBERÍA, no en la de
  PIEZA (`Toolbar.tsx`) — cambiarlo ahí y luego cambiar a la herramienta de
  pieza aplica el diámetro ya seleccionado, porque `pipeDiameter`/
  `hidraulicaDiameter` son campos del store compartidos entre ambas
  herramientas, no algo que se reinicie al cambiar de herramienta.

  **Dirección de flujo**: DOS cosas a la vez sobre el mismo tramo, no una
  o la otra — (1) el guion animado de siempre (`.flow-line`/`@keyframes
  flowdash` en `index.css`), que es el que se ve bien en vivo, y (2)
  flechitas ESTÁTICAS encima (`flowArrowMarks()` en `PlanCanvas.tsx`, una
  `<path>` en forma de chevron cada ~36 unidades, o una sola si el tramo
  es corto), ambas apuntando siempre del primer punto clicado al segundo
  (mismo origen que ya usa `PropertiesPanel.tsx` para "Invertir
  dirección"). La razón de las flechas: `src/lib/exportPdf.tsx` exporta
  con `html2canvas`, una sola foto estática de un instante cualquiera de
  la animación, así que el guion animado SOLO no comunica nada ahí (a
  veces ni se notaba) — bug real, reportado, y la primera corrección
  (quitar la animación y dejar solo flechas) se sintió como una regresión
  ("ya no se ve el flujo como antes" — otro reporte real). Las flechas son
  geometría fija que sale igual en vivo y en el PDF; el guion animado se
  queda además, solo para la vista en vivo.
- **Eléctrica** — dos etapas:
  1. **Trazado**: tablero/acometida/tierra (selector de 3 piezas), ducto
     (sirve igual para techo que para bajadas por muro, flujo animado
     opcional), dispositivos — contacto sencillo/doble/+apagador, apagador
     sencillo/3 vías, lámpara, tapa ciega, fotocelda, salida 220V
     (estufa/secadora), salida para minisplit, salida de datos/TV. Los
     símbolos de apagador/contacto/tapa/fotocelda son deliberadamente
     literales (interruptor de palanca, rejilla de contacto, sol para
     fotocelda…) en vez de seguir la norma NOM al pie de la letra — la
     prioridad es que se entiendan a simple vista.
  2. **Cableado**: se crean "circuitos derivados" (nombre + tipo) y se
     asignan a cada ducto desde `CircuitsPanel.tsx`; el plano muestra un
     contador de cables sobre cada ducto seleccionado. Seleccionar el
     símbolo de tablero también muestra la lista de circuitos del nivel en
     `PropertiesPanel.tsx` (de solo lectura, la edición sigue siendo en
     `CircuitsPanel.tsx`).

Si una capa está oculta o bloqueada, elegir una de sus herramientas lo
avisa arriba del lienzo (banner ámbar/rojo en `CanvasViewport.tsx`, clic
para arreglarlo al instante) — antes solo se avisaba el bloqueo, y
dibujar en una capa oculta "no se veía" y parecía que la herramienta no
funcionaba.

Las cuatro capas arrancan **visibles** por defecto (`defaultLayerState` en
`useProjectStore.ts`) — antes hidráulica y eléctrica arrancaban ocultas, a
petición explícita se cambió para que un proyecto nuevo (o recién
abierto) muestre todo de entrada; solo bloqueadas siguen arrancando
`false` las cuatro.

## Autenticación y datos (Firebase)

- **Un solo usuario**, dado de alta manualmente desde la consola de
  Firebase — el formulario de login (`Login.tsx`) **no** registra cuentas
  nuevas, solo autentica.
- Si no hay variables de entorno de Firebase configuradas (`firebaseEnabled
  = false` en `src/lib/firebase.ts`), la app cae a un **modo local**: login
  con botón "Entrar en modo local" y los proyectos se guardan en
  `localStorage` (`src/lib/localProjectStore.ts`) en vez de Firestore. Esto
  permite levantar y probar la app sin credenciales.
- **Firestore**: colección `projects`, un documento por proyecto
  (`src/lib/projectRepo.ts`). Las reglas de seguridad están restringidas al
  UID del único usuario dado de alta — no se gestionan desde el código, se
  configuran directamente en la consola de Firebase.
- **Nunca** debe existir en el repo una service account key ni ningún
  archivo de credenciales de administrador — la config de cliente
  (`apiKey`, etc.) va en variables de entorno (`.env`, ver
  `.env.example` para los nombres), y ni siquiera esa es realmente secreta
  (es normal que vaya en el bundle del cliente); lo que protege los datos
  son las reglas de Firestore, no ocultar esta config.
- **"Local (sin Firebase)" en el `TopBar` NO siempre significa que falta el
  `.env`** — ese mismo texto podía salir con credenciales completas y
  correctas si Firestore rechazaba el guardado (reglas de seguridad,
  base de datos de Firestore nunca creada en la consola para ese
  proyecto, etc.), porque `App.tsx` atrapaba CUALQUIER error de
  `saveProject()` y lo colapsaba al mismo estado `'local'` sin loguear
  nada — indistinguible en la UI de "nunca hubo Firebase configurado"
  (bug real, reportado: usuario con `.env` válido viendo "Local"). Ahora
  hay un estado `'error'` aparte (punto rojo, "Error al guardar (ver
  consola)") solo para cuando `firebaseEnabled` es `true` pero la
  operación de verdad falló, y ese error se loguea a consola con
  `console.error` — el código de Firestore ahí (`permission-denied`,
  `not-found`, etc.) dice exactamente qué revisar en la consola de
  Firebase. `ProjectsScreen.tsx` (`listProjects()`) recibió el mismo
  logueo por la misma razón.

## PWA

`vite-plugin-pwa` genera manifest + service worker en el build
(`npm run build`). Íconos en `public/icons/`. Instalable en escritorio y
móvil (Android/desktop vía el prompt del navegador; iOS vía "Agregar a
inicio" de Safari).

## Decisiones de diseño / UX ya tomadas

- **Tema**: tres opciones — oscuro (neón, el original), intermedio (dusk/
  slate, contraste medio) y claro — se ciclan con el botón de tema
  (`ThemeToggle.tsx` + `useThemeStore.ts`), persistido en `localStorage`.
  Los tokens de color de cada tema están en `src/index.css` bajo
  `:root[data-theme="..."]`. **Cualquier color de texto/ícono fijo (no
  token) hay que revisarlo contra los tres temas antes de darlo por
  bueno** — hubo dos bugs reales de contraste por esto: (1) las insignias
  del logo (`TopBar.tsx`, `ProjectsScreen.tsx`, `Login.tsx`) usaban un
  fondo degradado cian→morado TRANSLÚCIDO (`/35` de opacidad) que en tema
  claro se mezclaba con el fondo claro de atrás y dejaba un ícono casi del
  mismo tono ("blanco sobre blanco") — se corrigió con el fondo a opacidad
  completa (mismo patrón que los botones "Exportar"/"+ Nuevo proyecto") e
  ícono `#0a0a10` fijo, contraste garantizado sin importar el tema; el
  avatar "CG" del `TopBar` tenía el problema inverso (fondo fijo oscuro
  `indigo-900/purple-900` pero el texto heredaba `var(--text-primary)`,
  que en tema claro es casi negro — "negro sobre negro"), se corrigió
  fijando el texto a `#e9e8f5`. (2) Insignias/estados con texto Tailwind
  claro tipo `text-amber-200`/`text-red-300`/`text-purple-200` (aviso de
  Firebase, "Sí" de confirmar borrado, toggles activos como "1 cm"/"Ref.
  inferior", enlaces al pasar el mouse) se ven bien en fondo oscuro pero
  se pierden en tema claro porque el fondo detrás de esas insignias
  también es claro — se agregaron tokens `--warn-text`/`--danger-text`/
  `--accent-purple-text`/`--link-hover-text` en `index.css` (versión clara
  para temas oscuros, versión bastante más oscura del mismo tono solo
  para `[data-theme="light"]`) y se reemplazaron esas clases por
  `text-[color:var(--...)]` en los componentes.
- **Lienzo**: tamaño por nivel, no fijo — `Level.bounds` (`{minX,minY,maxX,
  maxY}`, opcional en `types.ts`) define el rectángulo dibujable de ese
  nivel; 1 unidad ≈ 1 cm. Si un nivel no trae `bounds` (proyectos viejos,
  niveles recién creados) se usa `DEFAULT_CANVAS_BOUNDS` (0,0,1600,1100),
  el tamaño histórico — no hace falta migrar datos guardados. Cada lado del
  lienzo tiene un botón "−/+" (en `PlanCanvas.tsx`, `ResizeControls`/
  `ResizePill`) para reducirlo 1 m o agrandarlo 10 m de ese lado;
  `store.resizeCanvas(side, deltaUnits)` hace el cambio (no pasa por
  `applyEdit`/deshacer, igual que renombrar/borrar nivel) con un mínimo de
  200 unidades (2 m) por lado para no dejarlo en un tamaño degenerado. El
  `viewBox` del SVG ya no arranca en 0,0 — usa `minX minY ancho alto`,
  así que cualquier código que asuma un origen fijo (posición de la letra
  "N", del texto de escala, etc.) tiene que calcularse relativo a
  `bounds`, no a una constante. Al abrir un proyecto o cambiar de nivel el
  plano se ajusta automáticamente al espacio disponible (`fitToContainer`
  en `CanvasViewport.tsx`, ahora lee el `bounds` del nivel activo en vez de
  una constante) — pero agrandar/reducir desde los botones NO reencuadra
  solo, a propósito, para no perder la referencia de dónde estabas
  parado; hay que hacer scroll/zoom manual hacia la parte nueva. El `<svg>`
  ya NO lleva `max-w-full max-h-full` (bug real, corregido): esas clases
  hacían que el navegador ignorara los atributos `width`/`height` reales
  del SVG y lo estirara al espacio disponible del contenedor flex, así que
  cambiar `bounds` no cambiaba el tamaño renderizado en pantalla — se
  sentía como "reducir un lado encoge todo el lienzo". El div que envuelve
  el SVG se centra con flexbox (`items-center justify-center`), así que
  cambiar su ancho/alto SIEMPRE recorre ambos lados la mitad del delta en
  pantalla (geometría del centrado, no evitable sin quitar el centrado) —
  por eso `resizeCanvas` no solo cambia `bounds`, `CanvasViewport.tsx`
  también compensa `tx`/`ty` (`handleResizeSide`, mitad del delta en
  screen-px según el lado) para que el lado opuesto al que se tocó quede
  fijo en pantalla. Ese callback usa `useCallback` con un `scaleRef` (no
  `[scale]` en las deps) para no cambiar de identidad en cada tick de zoom,
  si no rompería el memo de `PlanCanvas` (ver nota de rendimiento abajo).
  Zoom manual con rueda del mouse, pellizco con dos dedos, o los botones
  +/−/ajustar. El panel de capas es colapsable para ganar espacio.
  `--bg-canvas` es deliberadamente más oscuro que `--bg-app` en
  los tres temas (antes casi idénticos) para que el lienzo se distinga del
  resto de la UI a simple vista. `src/lib/exportPdf.tsx` exporta **siempre
  en tema claro** (aspecto tipo plano impreso consistente, a petición
  explícita), sin importar qué tema tenga activo la UI en ese momento —
  antes exportaba siempre en oscuro con los mismos colores fijos a mano.
  Los objetos del plano se colorean vía `var(--ink-wall)`/etc., que leen
  del tema puesto en `<html>` (`document.documentElement.dataset.theme`,
  ver `useThemeStore.ts`), así que fijar solo el fondo del host/PDF a
  blanco NO bastaba — sin forzar también el tema de `<html>`, las líneas
  del plano se seguían coloreando con el tema que la UI tuviera activo en
  ese momento (con dark activo, tinta casi blanca sobre un PDF de fondo
  blanco — invisible). Por eso `exportPlanToPdf` guarda
  `htmlEl.dataset.theme` antes de empezar, lo pone en `'light'` mientras
  arma el snapshot fuera de pantalla y captura con `html2canvas`, y lo
  restaura en el `finally` — es un cambio real, aunque breve, del tema de
  toda la UI (el host está fuera de pantalla con `left: -10000px`, pero
  `<html>` es compartido con la UI visible), así que puede verse un
  parpadeo muy breve al tema claro durante la exportación; se acepta
  porque exportar es una acción explícita y puntual del usuario, no algo
  continuo. Los tres literales de color (fondo del `<div>` host,
  `html2canvas`, `pdf.setFillColor`) ahora son blanco en vez del oscuro
  fijo de antes, y los colores de texto/borde del bloque de título del PDF
  (`setTextColor`/`setDrawColor`) se cambiaron a sus equivalentes de tema
  claro — si el tema claro (`:root[data-theme="light"]` en `index.css`)
  cambia de paleta más adelante, hay que revisar que sigan viéndose bien
  contra el fondo blanco fijo del PDF.
- **Referencia fantasma**: al ver un nivel que no es el primero, se puede
  superponer en baja opacidad el nivel anterior de la lista (no un nombre
  fijo tipo "piso1") — útil para alinear escaleras/bajantes entre niveles.
  Los niveles se pueden renombrar (doble clic en su pestaña del `TopBar`)
  o borrar (ícono ✕ al pasar el mouse, con confirmación inline — no se
  puede borrar el último nivel que quede).
- **Cuantificación**: el panel de capas muestra métricas calculadas de
  verdad a partir de la geometría (longitud de muros/tuberías, conteo de
  piezas) — nunca números de ejemplo fijos. Se puede descargar como CSV de
  todo el proyecto (todos los niveles, desglosado por tipo de pieza) desde
  el ícono junto a "CUANTIFICACIÓN" — `src/lib/exportQuantities.ts`.
- **Autoguardado** (`App.tsx`): debounce de 700ms desde el último cambio al
  proyecto abierto — cierra/actualiza estado, dispara `saveProject()` un
  ratito después, no en cada tecla/pixel de arrastre. Eso deja una ventana
  real de pérdida de datos: si la pestaña se cierra o recarga ANTES de que
  el debounce dispare, esos últimos cambios nunca se guardan (bug real,
  reportado: "a veces pierdo datos"). Un listener de `beforeunload` cubre
  esa ventana (activo mientras `syncState === 'saving'`, que dura todo el
  debounce en espera MÁS el guardado ya en curso): en modo local hace un
  `localSaveProject()` síncrono ahí mismo (`localStorage` es síncrono, así
  que si hay tiempo de correr el handler, el guardado sale de verdad,
  aunque sea 0ms después del último cambio); con Firebase una petición de
  red a medio vuelo del cierre no es confiable (el navegador puede
  cortarla), así que en su lugar se muestra el diálogo nativo de "¿seguro
  que quieres salir?" (`e.preventDefault()` + `e.returnValue`), dándole al
  usuario la oportunidad de cancelar y dejar que el guardado normal
  termine solo.
- **Confirmación por toast** (`Toast.tsx`, `store.toast` + `pushToast()`):
  solo para acciones puntuales del usuario (exportar PDF/CSV/JSON,
  restaurar respaldo) — **no** para el autoguardado continuo, que ya tiene
  su punto de estado discreto en el `TopBar`; un toast en cada edición
  autoguardada sería demasiado ruido.
- **Deliberadamente fuera de alcance por ahora** (decisión explícita, no
  olvido): el grafo conectable de tuberías (que el diámetro/tipo tenga que
  coincidir entre piezas conectadas).

## Convenciones al tocar este código

- Toda mutación de geometría de un proyecto abierto pasa por
  `useProjectStore().applyEdit()` o `addObject()` — nunca mutar
  `project.levels` a mano, o se rompe deshacer/rehacer.
- Los objetos colocables nuevos (equipos, piezas, dispositivos) deberían
  ser `kind: 'symbol'` con su geometría en `src/lib/symbols.tsx`, no un
  grupo de primitivas sueltas — así salen gratis la selección, rotación,
  el arrastre y el redimensionado (`scale`).
- `PiezaKey`/`PiezaHidraulicaKey` viven **solo** en `src/lib/stamps.ts` —
  ya hubo una copia vieja duplicada en `useProjectStore.ts` que quedó
  desincronizada (le faltaban piezas nuevas) sin que `tsc` lo marcara,
  porque `Object.keys(...) as PiezaKey[]` es un cast, no una validación.
  Si algo necesita ese tipo, se importa de `stamps.ts`.
- No commitear `.env`, `.env.local` ni ninguna key de service account —
  ver `.gitignore`.

## Pendientes

Todo lo que se había puesto en orden aquí ya está implementado y verificado
(quedó documentado en las secciones de arriba en vez de en una lista de
historial). Quedan dos puntos pospuestos **a propósito**, no por olvido —
no los arranques sin que el usuario lo pida explícitamente:

- [ ] **Reglas de validación NOM para eléctrico** — pendiente del criterio
      del usuario (es su especialidad) — no intentar adivinar reglas
      normativas sin pedírselas primero.
- [ ] **Grafo conectable de tuberías** (que el diámetro/tipo tenga que
      coincidir entre piezas conectadas) — no es un pendiente urgente, solo
      queda anotado por si se retoma más adelante.

Si te piden "continuar" sin más contexto y no hay nada más específico que
seguir, pregunta antes de adivinar cuál de estos dos abordar — ambos
requieren criterio del usuario, no son un pendiente técnico mecánico.

Antes de dar cualquiera de estos por "terminado": correr `npx tsc --noEmit
-p tsconfig.app.json`, probar con Playwright en una sesión fresca (matar
cualquier servidor de prueba viejo en el puerto que se use, o usar
`--force` para invalidar caché de Vite), y confirmar cero errores de
consola antes de reportarlo como resuelto — varias veces en este proyecto
un cambio "parecía roto" y en realidad era una pestaña del navegador con
una versión vieja cargada (Vite HMR no siempre aplica bien cambios grandes
de store) — no asumas que un reporte de bug es un bug real hasta
verificarlo en una sesión 100% fresca.
