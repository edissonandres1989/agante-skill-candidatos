# Pruebas documentadas: agente y Excel_periferia

## Alcance implementado

- El frontend conserva turnos del chat en `localStorage` y agrega el historial al prompt.
- OpenRouter se invoca desde `src/services/prom.service.ts` con `streamText`; la clave es `VITE_OPENROUTER_KEY` en `.env`.
- `Excel_periferia` solicita un archivo `.xlsx` o `.xls`, comprueba nombre más cargo/habilidades/sector, registra filas aceptadas mediante `console.log` y presenta búsquedas manuales en LinkedIn usando cargo/habilidades/sector como criterios orientativos de posible cliente.
- Los errores de red dejan el mensaje en el historial para que el usuario lo copie y reenvíe. La API no devuelve credenciales.

## Preparación

1. Copiar `.env.example` a `.env` y configurar `VITE_OPENROUTER_KEY`.
2. Ejecutar `npm run dev`.
3. Ejecutar `npm test` y `npm run build`.
4. Para las pruebas manuales, abrir DevTools del navegador y preparar una hoja Excel con encabezados `nombre`, `cargo`, `empresa`, `habilidades`.

## Pruebas automatizadas

| ID | Caso | Resultado esperado |
|---|---|---|
| SRV-01 | Historial user/assistant y mensaje actual en `server/agent.js` | El helper del backend propuesto conserva el orden al construir el prompt. Esta prueba no representa el flujo activo del frontend. |
| SRV-02 | Historial con rol inválido en el helper del backend | El helper rechaza roles fuera de `user` y `assistant`. Esta prueba no representa el flujo activo del frontend. |

## Casos manuales esperados e inesperados

| ID | Entrada / acción | Resultado esperado |
|---|---|---|
| UI-01 | Enviar “Hola”, recibir respuesta y enviar un segundo turno | Ambos turnos y respuestas siguen visibles; el segundo turno usa el contexto previo. |
| UI-02 | Recargar la página | El historial visible se restaura desde `localStorage`. |
| UI-03 | Desactivar la conexión y enviar un mensaje | Se informa que no hay conexión; el mensaje previo no desaparece y se ofrece reintento. |
| XLS-01 | Escribir `Excel_periferia` y adjuntar Excel con nombres válidos | Se listan candidatos aceptados y aparece el registro `[Excel_periferia] Candidatos validados` en la consola del navegador. |
| XLS-02 | Encabezados `nombre`, `cargo`, `empresa`, filas completas | Cada candidato tiene un vínculo de búsqueda LinkedIn con nombre/cargo como consulta. |
| XLS-03 | Seleccionar un PDF o TXT | Se rechaza con “Selecciona un archivo .xlsx o .xls.” |
| XLS-04 | Adjuntar hoja vacía o sin `nombre`/`name`, o sin cargo/habilidades/sector | Se informa que no hay filas o candidatos válidos; no se imprime una lista vacía como válida. |
| XLS-05 | Adjuntar archivo Excel dañado | Se informa que no se pudo leer y la interfaz sigue disponible. |
| XLS-06 | Una fila tiene nombre y cargo; otra solo nombre | La primera se conserva para búsqueda, la segunda se omite con aviso de fila inválida. |

## Límites conocidos y siguiente paso

La búsqueda proporcionada usa cargo, habilidades y sector para abrir resultados de personas de LinkedIn con “cliente” en la consulta. El operador valida manualmente cuáles resultados son posibles clientes; esta versión no los determina automáticamente, no extrae perfiles ni consulta datos privados. LinkedIn requiere OAuth y permisos aprobados para las APIs de perfiles; la documentación oficial también limita el uso y almacenamiento de esos datos. Para automatizar una búsqueda autorizada, primero se necesita acceso al producto/API de LinkedIn aplicable (por ejemplo, programa Talent aprobado) y definir formalmente qué significa “posible cliente” (sector, cargo, ubicación u otros filtros). Una vez habilitado, el backend debe integrar esa API y mantener la clave OAuth en servidor.

Fuentes oficiales:

- [Acceso a las APIs de LinkedIn](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [People APIs](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/overview)
- [LinkedIn Talent Solutions](https://learn.microsoft.com/en-us/linkedin/talent)

## Nota de privacidad

El Excel puede incluir datos personales. En esta versión, las filas procesadas aparecen en la consola local del navegador, no se envían a LinkedIn ni al servicio OpenRouter. Evita compartir capturas de consola o archivos con datos reales. Para una futura sincronización externa, define consentimiento, minimización, retención y acceso.
