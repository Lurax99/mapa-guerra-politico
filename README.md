# ⚔️ GUERRA DIGITAL · Radar político de España

Mapa de guerra interactivo y **en tiempo real** que muestra, comunidad autónoma por
comunidad autónoma, la reacción de las redes cada vez que alguien menciona a un
partido político en España.

Hecho solo con **HTML + CSS + JavaScript** puros: sin build, sin dependencias, sin
npm. Se abre haciendo doble clic en `index.html`.

---

## Qué hace

| Zona | Contenido |
|------|-----------|
| **Mapa** | España real (17 comunidades + Ceuta y Melilla + recuadro de Canarias), coloreado por el partido dominante en cada sector y con la intensidad proporcional al volumen de menciones. Portugal, Francia, Andorra y Marruecos aparecen de contexto. |
| **Efectos** | Cada tuit dispara una onda de radar en su comunidad. Los tuits virales generan explosión, destello, temblor del mapa y un **rastro que viaja hasta Madrid**. |
| **Flujo en vivo** | Tuit a tuit, con autor, hashtags resaltados, sentimiento, engagement y sector de origen. |
| **Panel izquierdo** | Control de intensidad, sensibilidad del radar, ranking de partidos en vivo, filtros por partido y por texto, ranking de comunidades más activas. |
| **Panel derecho** | Flujo en vivo + dossier de la comunidad seleccionada (dominancia, reparto por partido, trending hashtags). |
| **Gráfica inferior** | Evolución apilada de las menciones por partido, últimos 90 s. |
| **Cinta inferior** | Alertas: tuits virales y cambios de tendencia. |
| **HUD** | Tendencia activa, zona caliente, tuits/min, reloj, estado de conexión. |

### Atajos de teclado
- `Espacio` — pausar / reanudar el frente.
- `Esc` — cerrar el dossier del sector o el panel de ayuda.

---

## Cómo usarla

```bash
# opción 1: abrir directamente
index.html          # doble clic

# opción 2: servirla (recomendado si vas a enchufar un WebSocket local)
python -m http.server 8099      # o cualquier servidor estático
# → http://localhost:8099/index.html
```

### Parámetros de arranque
```
index.html?rate=3                                   # 3 tuits/segundo
index.html?ws=ws://localhost:8787/tweets            # arrancar directamente en modo WebSocket
index.html?ws=wss://mi-servidor/tweets&rate=2
```

---

## Datos en tiempo real

Esta web **no tiene servidor propio** y no incluye claves de la API de X (su uso
requiere una cuenta de pago). Por eso arranca en **modo simulación** y trae un
conector genérico de WebSocket para que le lleguen tuits reales desde *tu* backend.

### Tubería recomendada

```
API de X (filtered stream)  →  TU BACKEND  →  WebSocket  →  esta web
   reglas: #PSOE OR #PP OR #VOX              puerto 8787      modo WEBSOCKET
           OR #Sumar OR #Podemos lang:es
```

En el panel izquierdo: **FUENTE DE DATOS → WEBSOCKET**, pega la URL y pulsa
`CONECTAR`. El cliente reintenta la conexión automáticamente.

### Formato del mensaje

Todo es opcional salvo `text`:

```json
{
  "text": "Basta ya, en Madrid la vivienda no la paga nadie. #PP",
  "id": "1234567890",
  "ts": "2026-10-17T19:24:01Z",
  "user": { "name": "Ana Ruiz", "handle": "@anaruiz" },
  "location": "Madrid",
  "party": "pp",
  "region": "madrid",
  "hashtags": ["#PP", "#Vivienda"],
  "sentiment": "neg",
  "engagement": { "likes": 1240, "rts": 302, "replies": 88 },
  "viral": false
}
```

- **`party` ausente** → se infiere del texto (`#psoe`, `feijoo`, `sánchez`, `abascal`…).
- **`region` ausente** → se infiere de `location` o del propio texto
  («Barcelona», «Sevilla», «Bilbao»…). Si no, se asigna al azar ponderado por población.
- **`sentiment` ausente** → se infiere con un léxico simple.
- También acepta el formato nativo de X (`full_text`, `user.screen_name`,
  `favorite_count`…) dentro del JSON.
- Puedes enviar **un objeto o un array de objetos** por mensaje.

---

## Estructura de archivos

```
mapa-guerra-politico/
├── index.html            estructura y paneles
├── css/styles.css        estética de sala de guerra + responsive
└── js/
    ├── spain-geo.js      GeoJSON de las comunidades (geoBoundaries / IGN, CC-BY 4.0)
    ├── context-geo.js    contornos de PRT / FRA / AND / MAR (mismo origen)
    ├── config.js         partidos, colores, sectores, pesos y textos de la simulación
    ├── stream.js         motor de simulación + normalizador + WebSocket
    ├── map.js            proyección de Mercator, Douglas-Peucker, SVG y efectos canvas
    └── app.js            estado, interfaz, gráfica, filtros y orquestación
```

### Notas técnicas
- Proyección **de Mercator** con `viewBox` fijo de 1200×1001; el SVG y el `<canvas>`
  de efectos comparten exactamente el mismo *letterbox*, así que las ondas caen donde
  toca en cualquier tamaño de ventana.
- Los contornos se simplifican en tiempo real con **Douglas-Peucker** (tolerancia
  0,9 px) para que el mapa quede limpio sin perder costa.
- Los rótulos y trazos se dimensionan en píxeles de pantalla (`--u`), no en unidades
  del mapa, para que se lean igual de bien con cualquier zoom.
- Animaciones: `requestAnimationFrame` para el canvas, transiciones CSS para el mapa.

---

## Personalizar

En `js/config.js`:

- **`PARTIES`** — partidos, colores (`color`), hashtags y palabras clave (`keys`) para
  la inferencia. Añade o quita los que quieras.
- **`REGIONS`** — `w` es el peso poblacional de origen; `b` es el sesgo de cada
  territorio por partido (porcentajes aproximados de las últimas elecciones).
- **`TEMPLATES` / `TOPICS`** — los textos del modo simulación (`{tag}`, `{topic}`,
  `{region}`, `{pct}` se sustituyen al vuelo).

---

## ⚠️ Aviso importante

- El modo **simulación** genera mensajes ficticios con fines de demostración.
  Los pesos por comunidad son una **aproximación orientativa**, no una medición de la
  opinión pública: no es una encuesta, no representa resultados electorales ni refleja
  necesariamente el sentimiento real de la ciudadanía.
- La clasificación de sentimiento es heurística (léxico simple) y se equivoca: úsala
  como señal visual, no como dato.
- Los textos simulados son genéricos y no provienen de usuarios reales.

## Fuentes de datos geográficos

Mapa de España y contornos de países vecinos: **geoBoundaries (gbOpen)** a partir del
Instituto Geográfico Nacional de España — licencia **CC BY 4.0**.
Si publicas algo con este código, atribuye la fuente.
