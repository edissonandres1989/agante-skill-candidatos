# Pruebas documentadas: agente y Excel_periferia

## Alcance implementado

- El historial del chat se guarda en `localStorage` y se incorpora al prompt de cada conversación.
- OpenRouter se invoca desde `src/services/prom.service.ts`; la configuración actual usa `VITE_OPENROUTER_KEY`.
- `Excel_periferia` procesa la primera hoja de archivos `.xlsx` o `.xls` en el navegador con `xlsx`.
- El archivo exige exactamente los encabezados `nombre`, `cargo`, `habilidades`, `industria`.
- Las filas completas se registran en la consola y se muestran con enlaces de vacantes a LinkedIn Jobs y al portal de Periferia IT.
- Un error de red conserva el turno e informa una opción de reintento.

## Preparación

1. Copiar `.env.example` a `.env` y configurar `VITE_OPENROUTER_KEY`.
2. Ejecutar `npm run dev`.
3. Ejecutar `npm test`, `npm run lint` y `npm run build`.
4. Abrir DevTools del navegador para revisar la consola.
5. Crear archivos de prueba con la estructura requerida:

```text
nombre | cargo | habilidades | industria
```

## Pruebas automatizadas ejecutables

| ID | Caso | Comando | Resultado esperado |
|---|---|---|---|
| SRV-01 | Serializa historial y mensaje actual | `npm test` | `server/agent.js` conserva el orden de los turnos al construir el prompt. |
| SRV-02 | Rechaza roles o mensajes inválidos | `npm test` | El helper de servidor rechaza entradas no permitidas. |
| QLT-01 | Revisión estática | `npm run lint` | ESLint finaliza sin errores. |
| BLD-01 | Compilación de producción | `npm run build` | TypeScript y Vite compilan la aplicación. |

> Las pruebas SRV validan la API Node disponible; el frontend actual todavía llama OpenRouter directamente.

## Casos manuales

| ID | Entrada / acción | Resultado esperado |
|---|---|---|
| UI-01 | Enviar dos mensajes conversacionales consecutivos | Los mensajes y respuestas anteriores continúan visibles; el segundo envío usa el contexto previo. |
| UI-02 | Recargar la página después de conversar | El historial visible se restaura desde `localStorage`. |
| UI-03 | Desactivar conectividad y enviar un mensaje | Se informa el problema; el turno no desaparece y queda disponible el enlace Reintentar. |
| XLS-01 | Escribir `Excel_periferia` | Se abre el selector para adjuntar un Excel. |
| XLS-02 | Adjuntar `.pdf` o `.txt` | Muestra `Selecciona un archivo .xlsx o .xls.` |
| XLS-03 | Adjuntar Excel sin filas | Muestra que el archivo no contiene filas de candidatos. |
| XLS-04 | Excel con encabezados exactos y dos filas completas | Muestra dos candidatos, registra el arreglo con `[Excel_periferia] Candidatos validados:` y presenta los dos enlaces por candidato. |
| XLS-05 | Excel sin `industria` | Muestra `Campos faltantes: industria.` y no lista candidatos. |
| XLS-06 | Excel con columna adicional `empresa` | Muestra `Campos sobrantes: empresa.` y no lista candidatos. |
| XLS-07 | Excel que omite `industria` e incluye `empresa` | Muestra a la vez campos faltantes y sobrantes. |
| XLS-08 | Excel con los cuatro encabezados requeridos y una columna vacía adicional | La columna vacía se ignora; si los cuatro requeridos están presentes, el archivo se procesa. |
| XLS-09 | Una fila completa y otra con `habilidades` vacías | Acepta solo la completa e informa una fila omitida. |
| XLS-10 | Excel con encabezados válidos pero todas las filas incompletas | Muestra que no encontró candidatos con los cuatro campos requeridos. |
| XLS-11 | Excel dañado | Muestra que no se pudo leer el archivo y la interfaz permanece disponible. |
| LNK-01 | Pulsar Buscar empleos en LinkedIn | Abre una pestaña nueva de LinkedIn Jobs con `cargo,habilidades` como palabras clave; no incluye `cliente`, `tecnología` ni `industria`. |
| LNK-02 | Pulsar Vacante Periferia | Abre una pestaña nueva del portal `jobs.periferiaitgroup.com/jobs` filtrada por las habilidades del candidato. |
| LNK-03 | Revisar estilo de ambos enlaces | Los enlaces de LinkedIn y Vacante Periferia usan texto azul claro y subrayado. |

## Criterios de aceptación

1. El Excel se rechaza si no contiene exactamente las columnas requeridas.
2. El mensaje de validación identifica de manera explícita cuáles campos faltan y cuáles sobran.
3. No se procesan ni muestran candidatos cuando los encabezados no son válidos.
4. Solo se muestran candidatos cuyas cuatro columnas requeridas tienen valor.
5. Cada candidato válido conserva los enlaces de LinkedIn Jobs y Vacante Periferia.
6. Los enlaces no realizan scraping, postulación ni transferencia automática de datos del Excel.
7. El historial no se borra cuando falla la conversación.

## Privacidad y límites

El Excel puede contener información personal. En la implementación actual se procesa localmente y los candidatos válidos se muestran en la consola del navegador. Las búsquedas externas se activan solo al pulsar un enlace; el archivo y sus filas no se envían de forma automática a LinkedIn, Periferia u OpenRouter.

La búsqueda de Periferia usa el resultado de búsqueda del portal según las habilidades. No garantiza una coincidencia exacta ni selecciona una vacante específica. La persona usuaria revisa y decide la pertinencia de cada resultado.
