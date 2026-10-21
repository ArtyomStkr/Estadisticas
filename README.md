# Arancel Bolivia · Centro de control

Panel React + TypeScript para feedback, diagnóstico y cuestionarios de `arancel_bob_v2`. Conserva Firebase y el despliegue existente en GitHub Pages (`/Estadisticas/`).

## Desarrollo

```sh
npm ci
npm run dev
npm test
npm run build
```

Las pruebas usan Node 22.6 o superior (recomendado: 22.18 o 24). `index.html` es la entrada de desarrollo. `index.template.html` conserva la misma entrada para el flujo existente de GitHub Pages; mantener ambos sincronizados. No reemplazar la entrada con el HTML compilado de `dist/`.

## Contrato de la app

- `feedbacks`: `alias`, `comentario`, `tipo`, `estado`, `premium`, `versionApp`, `versionAndroid`, `sdkAndroid`, `marca`, `modelo`, `fecha`. `tipo: logs` identifica diagnósticos automáticos y su alias es el UUID de instalación. Los demás tipos actuales son `Error (Bugs)`, `Sugerencia` y `Otros`.
- `estadistica`: `uuid`, `premium`, `perfil`, `conoceTerminos`, `edad16Cumplida`, `versionApp`, `fecha`. La app actual escribe por UUID y actualiza el documento de la instalación. Los registros antiguos pueden tener otros IDs. La etiqueta se obtiene de `perfil`; no se exige `perfilEtiqueta`.

Ambas colecciones se escuchan en tiempo real, con errores independientes. Se conservan documentos sin fecha; los filtros por días excluyen estos registros. Las fechas se muestran en horario de Bolivia (UTC−4). Los booleanos ausentes, nulos o inválidos aparecen como **Sin dato**, sin contarlos como «No». El porcentaje de conocimiento usa respuestas con dato e indica las ausentes.

## Funciones

- Resumen con métricas, perfiles y actividad reciente.
- Feedback y logs separados, con búsqueda, filtros, tablero/lista y selector de estado para pantallas táctiles y teclado.
- Formularios con filtros por perfil, conocimiento y confirmación de 16 años; estadísticas y tabla de respuestas.
- Filtros generales por período, edición y versión. CSV con todos los resultados filtrados, más allá de la página visible.
- Detalles completos, mensajes multilínea, copia y descarga JSON; el JSON conserva campos adicionales recibidos.
- Tema claro, oscuro y automático, con preferencia persistente y adaptación a cambios del sistema.
- Logos WebP originales de la app móvil en `public/branding/`: jade para tema claro, bosque para oscuro y original para el favicon. Se reutilizan en la cabecera de navegación, el espacio de trabajo y el resumen, sin modificar los archivos de la app móvil.

La autenticación anónima y las reglas existentes deben permitir leer ambas colecciones y actualizar `estado` en `feedbacks`. Los fallos de escritura se muestran en pantalla y Firestore revierte los cambios rechazados. El panel no modifica reglas, servicios de la app ni documentos del cuestionario. No crea datos de ejemplo en producción.
