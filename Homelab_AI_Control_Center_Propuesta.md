# Homelab AI Control Center

## Documento de concepto, arquitectura y planificación

**Versión:** 0.1\
**Fecha:** 30 de octubre de 2026\
**Estado:** Propuesta para análisis, no especificación cerrada

------------------------------------------------------------------------

## 1. Resumen ejecutivo

Homelab AI Control Center es una plataforma web para monitorizar,
diagnosticar y administrar servicios de un homelab desde una interfaz
unificada y mediante agentes de inteligencia artificial.

No pretende reemplazar herramientas especializadas como Portainer,
Uptime Kuma, Prometheus o Grafana. Su función es actuar como una capa de
integración y operación que reúne información de los servicios
existentes, facilita su consulta y permite ejecutar acciones
controladas.

La propuesta combina:

1.  **Observabilidad:** estado de servicios, métricas, disponibilidad,
    logs y eventos.
2.  **Administración:** operaciones permitidas sobre servicios y
    contenedores.
3.  **Asistencia con IA:** investigación de problemas, explicación de
    evidencias y recomendaciones.
4.  **Interoperabilidad con agentes:** WebMCP para agentes compatibles
    que interactúan desde el navegador y MCP tradicional para clientes
    externos.
5.  **Conocimiento operativo:** documentación, procedimientos y registro
    de incidentes.

La aplicación debe seguir siendo útil sin IA. La IA es una capa
adicional, no un requisito para consultar el estado ni administrar las
funciones básicas.

## 2. Problema que busca resolver

En un homelab, los servicios suelen tener interfaces, APIs, logs y
mecanismos de monitorización separados. Cuando ocurre un problema, el
administrador debe consultar varias herramientas y relacionar
manualmente la información.

Ejemplo: Jellyfin funciona lentamente. Para investigar puede ser
necesario revisar el estado del contenedor, CPU y memoria, logs,
sesiones activas, almacenamiento, red y eventos recientes.

El proyecto busca reducir esa fragmentación:

-   Centralizar el estado de servicios y contenedores.
-   Facilitar la búsqueda de logs y eventos.
-   Relacionar información de distintas integraciones.
-   Registrar incidentes y acciones.
-   Permitir que un agente consulte datos mediante herramientas
    explícitas.
-   Ejecutar operaciones con autorización y auditoría.

## 3. Objetivos

### 3.1 Objetivos principales

-   Proporcionar una vista unificada de la infraestructura.
-   Integrar servicios existentes mediante adaptadores independientes.
-   Consultar estado, métricas y logs sin depender de una IA.
-   Exponer operaciones mediante herramientas WebMCP y MCP.
-   Permitir investigaciones asistidas por IA con evidencias trazables.
-   Aplicar controles de seguridad antes de ejecutar acciones.
-   Mantener una arquitectura modular que permita incorporar
    integraciones nuevas.

### 3.2 Objetivos secundarios

-   Incorporar automatizaciones y reglas.
-   Mantener un historial de incidentes.
-   Consultar documentación operativa.
-   Permitir contribuciones comunitarias mediante integraciones.
-   Soportar modelos locales y proveedores remotos compatibles.

### 3.3 Fuera de alcance inicial

No se pretende:

-   Reemplazar Portainer como administrador completo de Docker.
-   Reemplazar Prometheus/Grafana como plataforma avanzada de métricas.
-   Crear un SIEM o sistema de observabilidad empresarial.
-   Ejecutar comandos arbitrarios de shell desde el agente.
-   Modificar libremente archivos Compose o variables de entorno.
-   Construir un agente autónomo con permisos administrativos
    ilimitados.
-   Implementar Kubernetes o microservicios sin una necesidad
    demostrada.

## 4. Usuarios y escenarios de uso

### 4.1 Usuario principal

Administrador de un homelab que utiliza varios servicios self-hosted y
necesita consultar su estado, diagnosticar problemas y ejecutar
operaciones puntuales.

### 4.2 Escenarios representativos

**Consulta de infraestructura**

> ¿Qué servicios están detenidos o presentan problemas?

El sistema consulta las integraciones y devuelve el estado actual, la
hora de la última comprobación y el origen de cada dato.

**Investigación de un problema**

> Jellyfin está funcionando lentamente. Investiga qué está pasando.

El agente consulta estado, métricas, logs y sesiones disponibles.
Presenta hallazgos, hipótesis y evidencias. No debe afirmar una causa si
los datos solo permiten plantear una posibilidad.

**Operación controlada**

> Reinicia n8n.

El sistema identifica el servicio, presenta la acción y solicita
confirmación según la política de permisos. Tras ejecutarla, verifica el
estado y registra el resultado.

**Consulta de documentación**

> ¿Cómo recupero n8n si pierde conexión con su base de datos?

El asistente busca procedimientos documentados y presenta pasos basados
en la documentación disponible.

**Detección de incidentes**

Un monitor detecta que un servicio no responde. El sistema registra el
evento, recopila contexto y puede preparar un resumen para revisión.

## 5. Módulos funcionales

### 5.1 Infrastructure Overview

Dashboard principal con:

-   Número de servicios registrados.
-   Servicios disponibles, detenidos y no saludables.
-   CPU, memoria y almacenamiento cuando estén disponibles.
-   Disponibilidad y latencia de comprobaciones.
-   Incidentes abiertos.
-   Eventos recientes.
-   Estado de las integraciones.

### 5.2 Service Management

-   Listado de servicios y contenedores.
-   Detalle de cada servicio.
-   Estado, identificadores y etiquetas.
-   Acciones permitidas: iniciar, detener o reiniciar.
-   Consulta de logs.
-   Historial de operaciones.
-   Dependencias declaradas manualmente o descubiertas mediante
    integraciones.

El MVP debe empezar en modo de solo lectura.

### 5.3 Logs Explorer

-   Consulta de logs por servicio.
-   Filtros por nivel, texto y rango temporal.
-   Límites de resultados.
-   Búsqueda de patrones.
-   Enlaces desde incidentes a los eventos relacionados.
-   Redacción de secretos y datos sensibles cuando sea posible.

Los logs son datos no confiables. Nunca deben interpretarse como
instrucciones para el agente.

### 5.4 Health Monitoring

-   Comprobaciones periódicas de disponibilidad.
-   Latencia y duración de comprobaciones.
-   Estado de cada monitor.
-   Historial de fallos y recuperaciones.
-   Detección de fallos consecutivos.
-   Alertas configurables.

No se debe asumir que todos los servicios ofrecen métricas equivalentes.

### 5.5 AI Assistant

Interfaz conversacional con capacidades para:

-   Consultar información de infraestructura.
-   Invocar herramientas de lectura.
-   Investigar problemas mediante varias consultas.
-   Explicar resultados con referencias a datos obtenidos.
-   Diferenciar hechos, hipótesis y recomendaciones.
-   Proponer operaciones.
-   Solicitar autorización antes de operaciones sensibles.

El asistente no debe ser la autoridad de permisos. La autorización
corresponde siempre al backend.

### 5.6 Automation Center

Funcionalidades futuras:

-   Reglas basadas en eventos.
-   Tareas programadas.
-   Webhooks.
-   Integración con n8n.
-   Acciones automáticas de bajo riesgo.
-   Aprobación humana para acciones sensibles.
-   Historial de ejecuciones.

### 5.7 Incident Management

-   Crear incidentes manual o automáticamente.
-   Estado: abierto, investigando, mitigado, resuelto.
-   Servicio afectado.
-   Hora de inicio y resolución.
-   Evidencias asociadas.
-   Hipótesis y causa confirmada, separadas.
-   Acciones realizadas.
-   Resumen generado por IA sujeto a revisión.

### 5.8 Infrastructure Knowledge Base

-   Documentación por servicio.
-   Diagramas y dependencias.
-   Procedimientos de recuperación.
-   Configuración no secreta.
-   Notas operativas.
-   Búsqueda textual inicial.
-   Posible incorporación futura de embeddings/RAG.

La documentación puede mantenerse en Markdown y sincronizarse desde un
repositorio o una carpeta controlada. No es necesario implementar RAG en
el MVP.

## 6. Integraciones previstas

Las integraciones se implementarán mediante adaptadores. El núcleo no
debe depender de la API específica de un proveedor.

  -----------------------------------------------------------------------
  Servicio                Datos/capacidades       Consideraciones
                          posibles                
  ----------------------- ----------------------- -----------------------
  Docker Engine           Contenedores, estado,   Requiere acceso
                          estadísticas, logs y    cuidadosamente limitado
                          operaciones             

  Portainer               Información de          Evitar duplicar
                          entornos, stacks y      operaciones si Docker
                          contenedores según      API basta
                          API/permisos            

  Jellyfin                Estado, sesiones,       No asumir que ofrece
                          actividad y datos       métricas del host
                          disponibles en API      

  n8n                     Workflows y ejecuciones Proteger credenciales y
                          según API y versión     datos de workflows

  Uptime Kuma             Monitores,              Verificar API y método
                          disponibilidad e        de autenticación de la
                          historial mediante      versión elegida
                          integración compatible  

  Cloudflared             Métricas y logs         Evitar exponer métricas
                          disponibles             públicamente

  File Browser            Estado y datos          Restringir acceso a
                          disponibles en su API   archivos

  Tailscale               Dispositivos y          Proteger claves y
                          conectividad mediante   permisos
                          API/CLI autorizada      

  Grocy                   Estado y datos          Integración de baja
                          disponibles en API      prioridad

  Mealie                  Estado y datos          Integración de baja
                          disponibles en API      prioridad

  Prometheus              Consultas de métricas   Integración futura para
                                                  series históricas

  Proxmox                 Nodos, máquinas y       Integración futura
                          contenedores            
  -----------------------------------------------------------------------

Antes de implementar cada adaptador se debe verificar la documentación
oficial, versión, endpoints, permisos y límites de la API.

### 6.1 Contrato de integración

Cada adaptador debe declarar capacidades. No se debe obligar a todos los
servicios a implementar operaciones que no soportan.

Ejemplo conceptual en TypeScript:

``` typescript
interface HomelabIntegration {
  id: string;
  name: string;
  version: string;

  connect(): Promise<ConnectionResult>;
  getStatus(): Promise<ServiceStatus>;
  getMetrics?(): Promise<ServiceMetrics>;
  getLogs?(options: LogOptions): Promise<LogPage>;
  getCapabilities(): IntegrationCapabilities;
}
```

Las operaciones de escritura deben declararse separadamente y estar
sujetas a permisos explícitos. El contrato definitivo debe incluir
timeouts, errores tipados, paginación, cancelación y metadatos de
procedencia.

## 7. Arquitectura propuesta

### 7.1 Principios

-   Monolito modular inicialmente.
-   TypeScript en frontend y backend.
-   Separación entre interfaz, lógica de negocio e integraciones.
-   Un único núcleo de operaciones compartido por WebMCP, MCP y la API.
-   Autorización centralizada en backend.
-   Contratos tipados y validación de entrada.
-   Observabilidad de la propia aplicación.
-   Despliegue sencillo mediante Docker Compose.

### 7.2 Diagrama lógico

``` text
Browser
  |
  +-- Nuxt Web UI
  |     |
  |     +-- Dashboard
  |     +-- Logs Explorer
  |     +-- AI Assistant UI
  |     +-- WebMCP Adapter
  |
  +-- Compatible Browser Agent
          |
          +-- WebMCP tools
                  |
                  v
             Application Core
                  |
        +---------+----------+
        |                    |
     REST API            AI Orchestrator
        |                    |
        +---------+----------+
                  |
          Authorization Layer
                  |
          Tool/Use-case Layer
                  |
        +---------+----------+
        |                    |
  Integration Layer      Persistence
        |                    |
  Docker/Jellyfin/...     SQLite
        |
    Homelab services

External MCP Client
        |
    MCP Server
        |
    Same Application Core
```

### 7.3 Componentes

**Frontend: Nuxt 3 + TypeScript**

Responsable de las vistas, navegación, estado visual, formularios y
registro de herramientas WebMCP cuando el navegador lo soporte.

**Backend: Node.js + Fastify**

Responsable de REST API, autenticación, autorización, validación,
operaciones, auditoría y comunicación con integraciones.

**Worker**

Responsable de comprobaciones periódicas, recolección de datos, tareas
programadas y procesamiento de eventos. En el MVP puede ser un proceso
separado dentro del mismo repositorio.

**Application Core**

Contiene casos de uso y reglas de negocio independientes de Docker,
WebMCP o un proveedor de IA.

**Integration Layer**

Adaptadores para APIs y servicios externos.

**AI Orchestrator**

Conecta con el modelo, define herramientas disponibles, gestiona
llamadas a herramientas y limita iteraciones. El modelo no recibe
credenciales ni acceso directo a infraestructura.

**MCP Server**

Expone un subconjunto autorizado de los casos de uso a clientes MCP
externos.

**Persistence**

SQLite para configuración, inventario, incidentes, auditoría y datos
operativos de bajo volumen. Las métricas de alta frecuencia o larga
retención pueden delegarse a Prometheus u otro sistema especializado.

## 8. Stack tecnológico recomendado

  Área                     Tecnología                        Motivo
  ------------------------ --------------------------------- ------------------------------
  Frontend                 Nuxt 3                            Aplicación Vue modular
  Lenguaje                 TypeScript                        Tipado compartido
  Backend                  Fastify                           API ligera
  Base de datos            SQLite                            Simplicidad del MVP
  ORM                      Drizzle ORM                       Esquemas y migraciones
  Validación               Zod                               Validación de entradas
  Comunicación             REST + SSE                        API y eventos en tiempo real
  Gráficos                 ECharts                           Métricas
  IA                       Ollama o proveedor compatible     Modelos locales/remotos
  Integración de agentes   WebMCP + MCP SDK                  Agentes web y externos
  Despliegue               Docker Compose                    Operación sencilla
  Pruebas                  Vitest + pruebas de integración   Validación de módulos

No introducir Redis, Kubernetes o microservicios en la primera versión
sin una necesidad demostrable.

## 9. WebMCP y MCP

### 9.1 WebMCP

WebMCP permite que una página web exponga herramientas estructuradas a
agentes compatibles que interactúan desde el navegador.

Se deben evaluar dos modalidades:

-   **Declarativa:** formularios HTML que describen acciones mediante
    atributos compatibles.
-   **Imperativa:** registro programático de herramientas JavaScript
    mediante la API WebMCP disponible en el navegador.

La API y su disponibilidad pueden cambiar mientras la tecnología
evoluciona. Antes de implementar, consultar la especificación y
documentación vigentes, comprobar soporte del navegador y probar en un
entorno aislado.

Referencias iniciales:

-   https://developer.chrome.com/docs/ai/webmcp
-   https://webmachinelearning.github.io/webmcp/
-   https://github.com/webmachinelearning/webmcp

WebMCP no es un mecanismo para conceder privilegios al agente. Solo
expone herramientas. Cada ejecución debe pasar por el backend y sus
controles.

### 9.2 MCP tradicional

Un servidor MCP permitiría a clientes externos utilizar las mismas
capacidades sin abrir la interfaz web.

Ejemplos de clientes potenciales: Claude Code y otros clientes
compatibles con MCP.

El servidor MCP no debe duplicar la lógica de negocio. Debe llamar a los
mismos casos de uso que utiliza la API y el adaptador WebMCP.

### 9.3 Catálogo inicial de herramientas

**Herramientas de lectura**

  ------------------------------------------------------------------------
  Nombre                   Parámetros orientativos Descripción
  ------------------------ ----------------------- -----------------------
  `list_services`          status, tags, limit     Lista servicios
                                                   registrados

  `get_service_details`    service_id              Obtiene detalle de un
                                                   servicio

  `get_service_status`     service_id              Consulta estado actual

  `get_container_stats`    container_id            Consulta estadísticas
                                                   disponibles

  `get_service_logs`       service_id, since,      Obtiene logs limitados
                           limit                   

  `search_logs`            query, service_id,      Busca coincidencias
                           time_range              

  `get_system_metrics`     metric, time_range      Consulta métricas
                                                   disponibles

  `get_failed_workflows`   time_range              Consulta ejecuciones
                                                   fallidas de n8n

  `list_open_incidents`    severity, service_id    Lista incidentes
                                                   abiertos
  ------------------------------------------------------------------------

**Herramientas de escritura**

  ---------------------------------------------------------------------------
  Nombre                      Parámetros orientativos Política
  --------------------------- ----------------------- -----------------------
  `restart_service`           service_id, reason      Confirmación

  `start_service`             service_id, reason      Confirmación según
                                                      política

  `stop_service`              service_id, reason      Confirmación reforzada

  `run_health_check`          service_id              Puede ser automática

  `create_incident`           title, description,     Permiso de escritura
                              service_id              

  `execute_recovery_action`   action_id               Aprobación explícita
  ---------------------------------------------------------------------------

Los nombres y parámetros son propuestas. Cada herramienta debe tener
descripción clara, esquema validado, límites de salida y errores
definidos.

### 9.4 Ejemplo conceptual de herramienta

``` typescript
const listServicesTool = {
  name: "list_services",
  description:
    "Returns registered homelab services and their current status.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["running", "stopped", "unhealthy", "all"]
      }
    }
  },
  execute: async ({ status }) => {
    const result = await serviceManager.list({ status });
    return result;
  }
};
```

Este fragmento ilustra la lógica y no constituye por sí solo un registro
WebMCP completo. El adaptador debe utilizar la API exacta soportada por
el navegador o SDK elegido.

## 10. Diseño de interfaz

### 10.1 Navegación

-   Overview
-   Services
-   Monitoring
-   Logs
-   AI Assistant
-   Incidents
-   Automations
-   Knowledge
-   Settings

### 10.2 Overview

Indicadores principales:

-   Services Online.
-   Services Unhealthy.
-   CPU Usage.
-   Memory Usage.

Secciones adicionales:

-   Lista de servicios con estado.
-   Alertas activas.
-   Actividad reciente.
-   Resumen de disponibilidad.
-   Estado de integraciones.

### 10.3 Vista de servicio

Cada servicio debería tener:

-   Nombre, descripción y etiquetas.
-   Integración de origen.
-   Estado actual y hora de actualización.
-   Métricas disponibles.
-   Logs recientes.
-   Historial de incidentes.
-   Acciones permitidas.
-   Panel de IA contextual.

### 10.4 AI Assistant

-   Conversaciones e historial.
-   Herramientas utilizadas.
-   Parámetros relevantes, con secretos ocultos.
-   Resultado de cada herramienta.
-   Evidencias utilizadas.
-   Confirmaciones pendientes.
-   Errores de ejecución.
-   Indicador de datos desactualizados.

El usuario debe poder distinguir una respuesta generada por el modelo de
los datos devueltos directamente por una herramienta.

### 10.5 Estilo visual

Se recomienda una interfaz oscura, sobria y funcional, con jerarquía
visual clara. Evitar saturar el dashboard con gráficos que no aporten
decisiones. Los estados deben comunicarse con texto además del color.

## 11. Modelo de datos inicial

Modelo conceptual, sujeto a revisión durante el diseño técnico.

### 11.1 Entidades

**Service**

-   id
-   name
-   description
-   integration_id
-   external_id
-   endpoint interno opcional
-   status
-   tags
-   enabled
-   created_at
-   updated_at

**Integration**

-   id
-   type
-   name
-   configuration_reference
-   enabled
-   last_connection_status
-   last_checked_at

Los secretos no deben almacenarse en texto plano dentro de registros
ordinarios. Utilizar un mecanismo de secretos o cifrado adecuado.

**HealthCheck**

-   id
-   service_id
-   status
-   latency_ms
-   checked_at
-   error_code

**Incident**

-   id
-   service_id
-   title
-   description
-   severity
-   status
-   started_at
-   resolved_at
-   resolution_notes

**AuditEvent**

-   id
-   actor_type
-   actor_id
-   action
-   target_type
-   target_id
-   outcome
-   metadata_redacted
-   created_at

**ToolExecution**

-   id
-   tool_name
-   actor
-   input_redacted
-   status
-   result_summary
-   started_at
-   completed_at
-   approval_id

**KnowledgeDocument**

-   id
-   title
-   source
-   content_reference
-   tags
-   updated_at

**AutomationRule** (fase futura)

-   id
-   name
-   trigger
-   conditions
-   action
-   enabled
-   approval_policy

### 11.2 Retención

Definir límites de retención desde el principio:

-   Logs: preferiblemente consultados desde la fuente, no duplicados
    indefinidamente.
-   Health checks: retención configurable.
-   Auditoría: retención más larga y protegida.
-   Métricas: evitar almacenar muestras de alta frecuencia en SQLite.
-   Conversaciones: retención configurable y con controles de
    privacidad.

## 12. API del backend

Rutas iniciales orientativas:

``` text
GET    /api/health
GET    /api/services
GET    /api/services/:id
GET    /api/services/:id/status
GET    /api/services/:id/stats
GET    /api/services/:id/logs
POST   /api/services/:id/health-check

GET    /api/incidents
POST   /api/incidents
GET    /api/incidents/:id
PATCH  /api/incidents/:id

GET    /api/integrations
POST   /api/integrations/:id/test

GET    /api/audit
GET    /api/tools
POST   /api/operations/:id/approve
POST   /api/operations/:id/execute

GET    /api/events/stream
```

Las rutas de escritura requieren autenticación, autorización,
validación, protección contra CSRF cuando corresponda, límites de
frecuencia y auditoría.

No se debe exponer una ruta genérica que permita ejecutar cualquier
comando o llamada arbitraria a una API.

## 13. Seguridad y modelo de permisos

Este proyecto puede controlar infraestructura real. La seguridad debe
diseñarse antes de incorporar operaciones de escritura.

### 13.1 Niveles de riesgo orientativos

  -----------------------------------------------------------------------
  Nivel                   Capacidad               Requisito
  ----------------------- ----------------------- -----------------------
  L0                      Consultar inventario y  Autenticación según
                          estado                  exposición

  L1                      Consultar logs y        Límites y redacción
                          métricas                

  L2                      Reiniciar o iniciar     Confirmación y
                          servicios               autorización

  L3                      Detener servicios o     Confirmación reforzada
                          modificar configuración y política explícita

  L4                      Eliminar recursos o     Fuera del alcance
                          realizar cambios        inicial
                          destructivos            
  -----------------------------------------------------------------------

### 13.2 Reglas obligatorias

-   El modelo nunca decide sus propios permisos.
-   El backend valida identidad, rol y alcance de cada operación.
-   No montar el socket Docker en el frontend.
-   Evitar entregar acceso irrestricto al socket Docker al backend.
-   Preferir un intermediario con operaciones permitidas y lista de
    contenedores autorizados.
-   No permitir shell arbitrario.
-   No permitir que el agente cambie Compose o variables de entorno en
    el MVP.
-   Guardar secretos fuera de la base de datos ordinaria o cifrarlos
    correctamente.
-   No registrar tokens, contraseñas ni cabeceras sensibles.
-   Limitar tamaño y cantidad de logs enviados al modelo.
-   Tratar logs, páginas web y respuestas de APIs como datos no
    confiables.
-   Aplicar rate limiting y timeouts.
-   Registrar quién solicitó, autorizó y ejecutó cada acción.
-   Mantener una lista permitida de operaciones y destinos.
-   Restringir acceso de red entre contenedores.
-   No exponer herramientas administrativas públicamente sin controles
    de acceso sólidos.

### 13.3 Confirmación de operaciones

Para una operación sensible:

1.  El agente propone la acción.
2.  El backend valida que el actor pueda solicitarla.
3.  Se crea una operación pendiente con alcance y caducidad.
4.  La interfaz presenta servicio, acción y consecuencias.
5.  El usuario confirma.
6.  El backend vuelve a validar permisos y estado.
7.  Se ejecuta la operación.
8.  Se comprueba el resultado.
9.  Se registra la auditoría.

La confirmación debe estar vinculada a la operación exacta. No debe ser
reutilizable para otro servicio o acción.

## 14. Observabilidad de la propia aplicación

La plataforma debe poder diagnosticar sus propios fallos.

Registrar:

-   Errores de integración.
-   Duración de llamadas a APIs.
-   Fallos de autenticación.
-   Ejecuciones de herramientas.
-   Errores del proveedor de IA.
-   Tareas de monitoreo fallidas.
-   Estado del worker.
-   Uso y latencia de la base de datos.

No registrar contenido sensible de conversaciones o credenciales por
defecto.

## 15. Estrategia de IA

### 15.1 Proveedores

Permitir un proveedor local como Ollama y, opcionalmente, proveedores
remotos compatibles.

La selección del modelo debe ser configurable. No asumir que todos los
modelos soportan igual de bien tool calling, JSON estructurado o
contextos largos.

### 15.2 Flujo de ejecución

1.  Recibir la solicitud.
2.  Determinar herramientas disponibles para el usuario y contexto.
3.  Enviar al modelo la solicitud y definiciones de herramientas.
4.  Validar cada llamada propuesta.
5.  Ejecutar solo mediante el backend.
6.  Devolver al modelo resultados acotados.
7.  Limitar iteraciones y tiempo total.
8.  Generar respuesta con evidencias.
9.  Registrar la ejecución sin almacenar secretos.

### 15.3 Calidad de los diagnósticos

Las respuestas deben separar:

-   **Hechos:** datos observados directamente.
-   **Hipótesis:** explicaciones posibles.
-   **Evidencias:** logs, métricas y marcas temporales.
-   **Recomendaciones:** siguientes pasos.
-   **Acciones ejecutadas:** operaciones confirmadas y sus resultados.

No presentar correlación temporal como causalidad demostrada.

## 16. Despliegue

Despliegue inicial mediante Docker Compose.

Componentes previstos:

``` text
homelab-ai-control-center
  ├── web
  ├── api
  ├── worker
  ├── mcp-server (opcional)
  └── database volume

External services
  ├── Docker Engine / restricted gateway
  ├── Jellyfin
  ├── n8n
  ├── Uptime Kuma
  ├── Cloudflared
  └── Ollama (opcional)
```

Consideraciones:

-   No publicar la API administrativa directamente en Internet.
-   Utilizar red privada entre servicios.
-   Mantener volúmenes persistentes y copias de seguridad.
-   Configurar health checks de los componentes propios.
-   Separar credenciales por integración.
-   Usar un proxy de acceso seguro si se necesita acceso remoto.
-   Evitar montar directorios del host sin necesidad.
-   Documentar recuperación y actualización.

## 17. Estructura de repositorio propuesta

``` text
homelab-ai-control-center/
├── apps/
│   ├── web/                  # Nuxt 3
│   ├── api/                  # Fastify
│   └── worker/               # tareas y monitoreo
│
├── packages/
│   ├── core/                 # casos de uso y reglas
│   ├── integrations/         # adaptadores
│   ├── tools/                # contratos y handlers
│   ├── webmcp/               # adaptador WebMCP
│   ├── mcp-server/           # servidor MCP
│   ├── ai/                   # orquestación de modelos
│   ├── database/             # SQLite y Drizzle
│   └── shared/               # tipos y schemas
│
├── docker/
├── docs/
│   ├── architecture/
│   ├── integrations/
│   ├── security/
│   ├── api/
│   └── development/
│
├── tests/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

La estructura puede ajustarse si el proyecto demuestra que necesita
menos paquetes. No dividir módulos solo por estética.

## 18. Roadmap

Las estimaciones son orientativas para una persona trabajando
parcialmente en el proyecto. Deben revisarse después de validar el
entorno, las APIs y el soporte real de WebMCP.

### Etapa 0. Investigación y decisiones

-   Verificar documentación y soporte actual de WebMCP.
-   Elegir navegador de pruebas y agente compatible.
-   Revisar APIs de Docker y servicios prioritarios.
-   Definir modelo de permisos.
-   Crear diagramas y decisiones arquitectónicas.

**Criterio de salida:** decisiones técnicas documentadas y prueba mínima
de WebMCP ejecutada.

### Etapa 1. Dashboard y lectura

Estimación orientativa: 1--2 semanas.

-   Crear monorepo y entorno de desarrollo.
-   Implementar backend y SQLite.
-   Crear inventario de servicios.
-   Integrar Docker en modo lectura.
-   Mostrar estado y estadísticas disponibles.
-   Consultar logs con límites.
-   Registrar eventos básicos.

**Criterio de salida:** dashboard útil sin IA, con datos reales de
Docker.

### Etapa 2. WebMCP

Estimación orientativa: alrededor de 1 semana, sujeta a compatibilidad.

-   Crear adaptador WebMCP.
-   Registrar `list_services`.
-   Registrar `get_service_status`.
-   Registrar `search_logs`.
-   Validar parámetros y resultados.
-   Probar descubrimiento y ejecución desde un agente compatible.
-   Documentar limitaciones del navegador.

**Criterio de salida:** un agente puede descubrir y ejecutar las tres
herramientas de lectura.

### Etapa 3. AI Assistant

Estimación orientativa: 1--2 semanas.

-   Integrar proveedor local o remoto.
-   Crear interfaz de chat.
-   Implementar tool calling.
-   Limitar iteraciones y tiempo.
-   Mostrar herramientas ejecutadas.
-   Generar diagnósticos con evidencias.
-   Añadir confirmaciones para acciones permitidas.

**Criterio de salida:** el asistente puede investigar un problema
mediante varias herramientas.

### Etapa 4. Integraciones y operaciones

Estimación orientativa: 2--4 semanas.

-   Añadir Uptime Kuma.
-   Añadir n8n.
-   Implementar operaciones controladas de Docker.
-   Añadir auditoría completa.
-   Crear gestión básica de incidentes.
-   Añadir servidor MCP.

**Criterio de salida:** operaciones autorizadas, verificables y
auditadas.

### Etapa 5. Automatización y conocimiento

-   Reglas y tareas programadas.
-   Integración con n8n.
-   Documentación operativa.
-   Búsqueda de conocimiento.
-   Procedimientos de recuperación.
-   Más integraciones.

## 19. Criterios de aceptación del MVP 0.1

El MVP se considera terminado cuando:

1.  La aplicación inicia mediante Docker Compose.
2.  El usuario puede registrar y consultar servicios.
3.  La integración Docker obtiene estados reales.
4.  El dashboard muestra estado y métricas disponibles.
5.  Se pueden consultar logs con filtros y límites.
6.  Los errores de integración se muestran sin bloquear toda la
    aplicación.
7.  Las tres herramientas WebMCP iniciales se registran correctamente en
    un navegador compatible.
8.  Un agente compatible puede descubrirlas y utilizarlas.
9.  Las herramientas solo permiten operaciones de lectura.
10. Las entradas inválidas son rechazadas.
11. No se exponen credenciales en interfaz, logs o resultados.
12. Existe documentación para instalación, configuración y pruebas.

## 20. Plan de pruebas

  -----------------------------------------------------------------------
  Escenario                           Resultado esperado
  ----------------------------------- -----------------------------------
  Listar servicios                    Devuelve servicios registrados y
                                      estado con marca temporal

  Consultar servicio inexistente      Error controlado

  Buscar logs                         Resultados limitados y filtrados

  Logs con texto malicioso            Se tratan como datos, no
                                      instrucciones

  Docker inaccesible                  Integración marcada como no
                                      disponible

  API externa lenta                   Timeout y error controlado

  Agente sin permisos                 Operación rechazada

  Herramienta desconocida             No se ejecuta

  Parámetros inválidos                Validación rechaza la llamada

  Servicio caído                      Se registra el estado y, si
                                      corresponde, incidente

  Reinicio autorizado                 Acción auditada y estado verificado

  Reinicio no autorizado              Acción bloqueada
  -----------------------------------------------------------------------

Las pruebas de escritura deben ejecutarse primero contra contenedores
desechables, nunca contra servicios críticos.

## 21. Riesgos y decisiones pendientes

### Riesgos

-   WebMCP puede cambiar y su soporte puede ser limitado.
-   Las APIs de servicios self-hosted varían entre versiones.
-   Los modelos locales pueden tener capacidades débiles de tool
    calling.
-   Los logs pueden contener secretos o instrucciones maliciosas.
-   Dar acceso a Docker puede equivaler a otorgar privilegios muy
    elevados.
-   Una colección de métricas de alta frecuencia puede crecer demasiado.
-   Una IA puede producir diagnósticos incorrectos si no se obliga a
    citar evidencias.

### Decisiones que deben resolverse antes de implementar

1.  ¿Qué navegador y agente se utilizarán para probar WebMCP?
2.  ¿Se utilizará Docker Engine directamente o un gateway de operaciones
    restringido?
3.  ¿Qué modelo local se utilizará para las pruebas de tool calling?
4.  ¿La primera versión será solo para una instancia de Docker?
5.  ¿Qué servicios se integrarán después de Docker?
6.  ¿La autenticación inicial será local o mediante un proxy de acceso?
7.  ¿Qué datos se guardarán y durante cuánto tiempo?
8.  ¿El servidor MCP se incluirá en el MVP o en una etapa posterior?

## 22. Recomendación de alcance

Para evitar que el proyecto se vuelva demasiado grande, la primera
entrega debe limitarse a:

-   Nuxt 3 + TypeScript.
-   Fastify.
-   SQLite.
-   Docker en modo lectura.
-   Dashboard de servicios.
-   Métricas básicas disponibles.
-   Logs Explorer.
-   Tres herramientas WebMCP de lectura.
-   Prueba con un agente compatible.

No incluir inicialmente:

-   Operaciones destructivas.
-   Automatizaciones autónomas.
-   RAG y embeddings.
-   Integraciones con todos los servicios.
-   Prometheus propio.
-   Kubernetes.
-   Gestión completa de stacks.

El primer objetivo no es tener un asistente que administre todo el
homelab. Es demostrar que una aplicación web puede exponer capacidades
útiles mediante WebMCP y que un agente puede utilizarlas de forma fiable
y segura.

## 23. Referencias técnicas iniciales

Estas referencias son puntos de partida. Consultar siempre la
documentación correspondiente a la versión que se vaya a utilizar.

-   WebMCP, documentación de Chrome:
    https://developer.chrome.com/docs/ai/webmcp
-   WebMCP, especificación: https://webmachinelearning.github.io/webmcp/
-   WebMCP, repositorio: https://github.com/webmachinelearning/webmcp
-   Docker Engine API: https://docs.docker.com/reference/api/engine/
-   Nuxt: https://nuxt.com/docs
-   Fastify: https://fastify.dev/docs/latest/
-   Drizzle ORM: https://orm.drizzle.team/docs/overview
-   Ollama: https://docs.ollama.com/
-   Model Context Protocol: https://modelcontextprotocol.io/
-   n8n API: https://docs.n8n.io/api/
-   Jellyfin API: https://api.jellyfin.org/

------------------------------------------------------------------------

## Conclusión

Homelab AI Control Center debe ser una capa de administración,
observabilidad y diagnóstico sobre las herramientas que ya existen en el
homelab.

Su valor diferencial no está en sustituir Docker, Portainer, Uptime Kuma
o Prometheus. Está en unificar sus datos y operaciones, ofrecer una
interfaz consistente y permitir que agentes de IA interactúen con
capacidades explícitas, limitadas y auditables.

La estrategia recomendada es construir primero una aplicación funcional
sin IA, después integrar WebMCP con herramientas de lectura y,
finalmente, incorporar diagnóstico asistido, operaciones controladas y
MCP tradicional.

**Principio rector:** la aplicación debe funcionar sin IA; la IA debe
mejorar la forma de utilizarla, nunca convertirse en un requisito ni en
una autoridad con acceso irrestricto a la infraestructura.
