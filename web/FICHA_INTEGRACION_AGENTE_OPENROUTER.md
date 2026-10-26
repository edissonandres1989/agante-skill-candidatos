# Ficha de integración: agente con OpenRouter y tarea de plantilla PDF

| Campo | Detalle |
|---|---|
| Estado | Integración actual en frontend; backend propuesto para una etapa posterior |
| Frontend actual | React + TypeScript + Vite |
| Backend propuesto | Node.js con JavaScript/TypeScript y API HTTP |
| Proveedor de modelos | OpenRouter, invocado exclusivamente desde el backend |
| Flujo funcional | Chat persistente y generación de plantilla para el requisito de periferia |

## 1. Resumen

Se conservará la estructura y experiencia de la interfaz React existente (por ejemplo, `Generate.tsx`) y se independizarán sus responsabilidades. El frontend gestionará la vista, el estado de la conversación y la presentación de resultados. Un cliente de API enviará los mensajes al backend. El backend validará solicitudes, mantendrá o recuperará el historial, seleccionará la tarea solicitada, construirá el contexto del modelo, invocará OpenRouter y devolverá una respuesta estructurada.

La implementación actual mantiene el servicio solicitado en el frontend: `src/services/prom.service.ts` usa `streamText({ model: openRouter("nvidia/nemotron-3.5-lightning:free"), prompt: message })`. `src/components/Generate.tsx` incorpora el historial al texto enviado. La clave se lee desde `VITE_OPENROUTER_KEY` en `.env`; en este modo queda incluida en el bundle. Usa una clave restringida y revocable. Las dependencias `ai` y OpenRouter ya están en el proyecto padre. El diagrama de esta ficha describe la arquitectura objetivo con backend.

### Responsabilidades sugeridas

- **Frontend:** conservar componentes y estilos, mostrar mensajes y estados de carga/error, y mantener los mensajes visibles en estado de aplicación. Cada envío agrega el mensaje del usuario y luego la respuesta, sin reemplazar el arreglo de conversación por el último turno.
- **Backend:** exponer endpoints versionados, validar y limitar entradas, administrar el historial por conversación, ejecutar tareas permitidas, llamar a OpenRouter y normalizar errores.
- **Persistencia:** guardar conversaciones en una base de datos para recuperarlas entre recargas o sesiones. El estado React solo conserva el historial durante la vida de la página; no es persistencia duradera.
- **Separación modular:** organizar rutas/controladores, servicio de agente, adaptador OpenRouter, servicio de tareas PDF y repositorio de conversaciones como módulos independientes.

## 2. Diagrama de secuencia

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant UI as Frontend React
    participant API as Backend API
    participant DB as Repositorio de conversaciones
    participant AG as Orquestador del agente
    participant OR as OpenRouter
    participant PDF as Generador de plantilla PDF

    U->>UI: Escribe mensaje y selecciona tarea (chat o plantilla PDF)
    UI->>UI: Agrega mensaje al historial local sin borrar turnos previos
    UI->>API: POST /api/agent/turns {conversationId, message, history, intent}
    API->>API: Valida sesión, tamaño, historial e intención permitida
    API->>DB: Carga historial persistido de conversationId
    DB-->>API: Historial previo (o conversación nueva)
    API->>AG: Procesa mensaje + historial + intención
    alt Intención = generar plantilla PDF de requisito de periferia
        AG->>OR: Solicita datos estructurados para la plantilla
        OR-->>AG: Campos sugeridos / preguntas faltantes
        AG->>PDF: Valida campos y genera documento o plantilla
        PDF-->>AG: Resultado y metadatos del archivo
    else Intención = conversación
        AG->>OR: Envía contexto conversacional y mensaje
        OR-->>AG: Respuesta conversacional
    end
    AG-->>API: Respuesta, tarea ejecutada y resultado opcional
    API->>DB: Guarda mensaje del usuario y respuesta del agente
    DB-->>API: Confirmación de guardado
    API-->>UI: 200 {conversationId, assistantMessage, taskResult?}
    UI->>UI: Agrega respuesta al historial visible
    UI-->>U: Muestra respuesta o enlace/acción para el PDF

    alt Sin conectividad o proveedor/backend no disponible
        UI--xAPI: Solicitud falla por red / timeout
        UI->>UI: Conserva el mensaje pendiente y el historial existente
        UI-->>U: Muestra error recuperable y opción de reintentar
    else Error validado del backend o de OpenRouter
        API-->>UI: Error normalizado {code, message, retryable}
        UI->>UI: No elimina mensajes previos; marca el turno como fallido
        UI-->>U: Informa el problema sin exponer claves ni datos internos
    end
```

### Contrato HTTP propuesto

- `POST /api/agent/turns`: recibe un turno, el identificador de conversación y la intención (`chat` o `periferia_pdf`). Devuelve la respuesta y, para la tarea, el resultado estructurado o la referencia al archivo.
- `GET /api/conversations/:id`: recupera mensajes para reconstruir el historial al abrir o recargar la interfaz.
- `GET /api/conversations`: lista las conversaciones disponibles para el usuario autenticado.
- El backend debe tratar su historial persistido como fuente de verdad. Si acepta historial enviado por el cliente, valida que pertenezca a la conversación y aplica límites de longitud y cantidad para evitar manipulación y exceso de contexto.

## 3. Tabla de datos intercambiados

| Dirección | Dato | Tipo / ejemplo | Uso y validación |
|---|---|---|---|
| Frontend → Backend | `conversationId` | UUID o `null` al iniciar | Identifica el hilo; el servidor crea uno si es nuevo y verifica autorización. |
| Frontend → Backend | `message` | Texto: “Necesito la plantilla del requisito de periferia” | Turno actual; texto no vacío, con longitud máxima configurada. |
| Frontend → Backend | `history` | `[{ role: "user", content: "..." }, { role: "assistant", content: "..." }]` | Contexto conversacional; roles permitidos, tamaño limitado y asociación al hilo verificada. Idealmente se carga desde el repositorio del servidor. |
| Frontend → Backend | `intent` | `chat` | `periferia_pdf` | Selecciona explícitamente conversación o tarea especializada; el servidor aplica una lista permitida. |
| Frontend → Backend | `taskInput` | Objeto JSON con datos del requisito | Entradas de la plantilla: nombre del sistema, periférico, propósito, requisitos funcionales/no funcionales, interfaces, restricciones y criterios de aceptación. Se solicitan campos faltantes. |
| Backend → OpenRouter | Mensajes/contexto | Mensajes de sistema, historial relevante y turno actual | Construcción del prompt en servidor; no se envían secretos ni datos que no sean necesarios. |
| Backend → OpenRouter | Selección de modelo | Identificador configurable | El modelo y parámetros se configuran en servidor; clave privada mediante `OPENROUTER_API_KEY`. |
| Backend → Frontend | `assistantMessage` | `{ role: "assistant", content: "..." }` | Respuesta visible para la conversación; texto saneado y tipado. |
| Backend → Frontend | `taskResult` | `{ type: "periferia_pdf_template", status, fields, fileUrl? }` | Resultado de la tarea específica; `fileUrl` debe ser temporal y protegido si se entrega un archivo. |
| Backend → Frontend | Error | `{ code, message, retryable }` | Códigos estables como `NETWORK_ERROR`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `VALIDATION_ERROR`; mensaje seguro y accionable. |
| Backend ↔ Repositorio | Conversación y turnos | ID, usuario, rol, contenido, intención, fecha, estado | Persistencia del historial; autorización por usuario, política de retención y protección de datos. |

### Ejemplo de solicitud

```json
{
  "conversationId": "c7df4fc8-8533-4bd7-8d1c-9a5600d7d5c1",
  "message": "Vamos a trabajar el PDF con el requisito de periferia; hazme la plantilla.",
  "intent": "periferia_pdf",
  "taskInput": {
    "peripheralName": "",
    "purpose": "",
    "functionalRequirements": [],
    "interfaces": [],
    "acceptanceCriteria": []
  }
}
```

La respuesta del agente debe pedir los datos que falten o devolver un resultado con estructura definida. Si se requiere un PDF descargable, una etapa del backend debe renderizar esa estructura con una biblioteca PDF y entregar una referencia segura al archivo. Una respuesta de texto que solo describa una plantilla no equivale a generar el documento.

## 4. Aviso crítico: la tarea del PDF es un requisito funcional

El agente puede conversar, pero **debe ejecutar la tarea específica de preparar la plantilla PDF del requisito de periferia** cuando el usuario seleccione esa opción o la solicite. No basta con responder de forma general sobre el tema.

La intención `periferia_pdf` debe activar un flujo especializado: recopilar y validar los datos requeridos, pedir aclaraciones cuando falten campos, producir una plantilla coherente y devolverla como documento PDF o como estructura explícitamente lista para su renderizado. El historial de conversación aporta contexto y debe conservarse en cada turno; no se debe reemplazar por el arreglo de datos del mensaje actual.

## 5. Manejo de errores y continuidad del historial

- Mantener el historial existente aunque falle una solicitud; marcar el turno actual como pendiente o fallido en vez de reiniciar la conversación.
- Reintentar con límite y espera progresiva para fallos transitorios, evitando enviar turnos duplicados (usar un `requestId` o clave de idempotencia).
- Distinguir falta de conexión, timeout, límite del proveedor, respuesta inválida y error de validación. Mostrar un mensaje claro y permitir reintento cuando corresponda.
- No afirmar que el historial está guardado hasta recibir confirmación del backend. Si se necesita continuidad durante una desconexión, conservar temporalmente mensajes sin sincronizar y reconciliarlos al reconectar.
- No devolver al navegador stack traces, prompts internos, tokens ni la clave de OpenRouter.

## 6. Criterios de aceptación de la integración

1. La interfaz conserva su presentación actual y puede enviar múltiples turnos manteniendo visible todo el historial.
2. Al recargar y recuperar una conversación, sus turnos siguen disponibles desde el backend.
3. La credencial de OpenRouter solo existe en el entorno del servidor y ninguna llamada del navegador contiene esa clave.
4. Una solicitud con intención `periferia_pdf` inicia la tarea, recopila campos faltantes y genera o prepara explícitamente la plantilla solicitada.
5. Ante errores de red o del proveedor, el historial no se pierde y la interfaz informa si puede reintentar.
