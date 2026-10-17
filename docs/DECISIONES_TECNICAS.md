# Decisiones técnicas y alcance

Esta nota acompaña la implementación del enunciado. Resume cómo está organizada, por qué se eligieron estas soluciones y qué aspectos se dejarían para una siguiente etapa.

## Decisiones de implementación

### Separar al proveedor de Cobrix

La API simulada del administrador se consume exclusivamente por HTTP, igual que un servicio externo. Cobrix mantiene su propia base SQLite y no consulta directamente la base del proveedor. Así, la integración depende de los contratos publicados por la API y no de detalles internos de su almacenamiento.

### Node.js, TypeScript y SQLite

Se conserva Node.js 24 y TypeScript para el backend. SQLite guarda la configuración, los clientes, los contratos, las facturas y el historial de corridas sin requerir un servicio de base de datos aparte. Los importes se guardan en centavos para evitar errores de redondeo.

### React y Vite para el panel

El panel está hecho con React y TypeScript. Vite sirve el frontend durante el desarrollo; en producción, `pnpm run build:web` lo compila en `src/web/public`. El servidor de Cobrix entrega esa aplicación y la API JSON desde el puerto 4300. En desarrollo, Vite reenvía las llamadas `/api` al mismo backend.

La tipografía Arial y la paleta clara se eligieron para acercar el panel a las referencias del enunciado y mantener tablas y estados legibles. La vista de clientes incluye filtros rápidos además de la búsqueda, sin reemplazar ninguna de las columnas pedidas.

### Corridas seguras y verificables

La importación es idempotente: repetirla no debe crear otra factura para la misma cuota. La simulación calcula qué cambios se harían sin escribirlos. Para actualizar pagos, una factura se marca pagada solo cuando los datos del libro del proveedor respaldan esa decisión; los abonos parciales y las respuestas inconsistentes se reportan sin convertirlos en pagos completos.

El detalle de cada corrida conserva el resultado y el motivo de cada cuota. Los motivos que se muestran al operador están redactados en español; los nombres técnicos de contadores se mantienen cuando ayudan a relacionar el panel con el sync.

## Alcance

Se implementan las funciones funcionales descritas en el enunciado: configuración, prueba de conexión, importación y simulación, actualización y simulación de pagos, historial de corridas, búsqueda y filtros de clientes, expediente, resumen y corrida automática configurable.

Esta entrega es un entorno de prueba local, no una instalación lista para operar en producción. Antes de desplegarla con datos reales harían falta, entre otras cosas, autenticación y permisos para operadores, gestión segura de credenciales, copias de seguridad, métricas y alertas, además de una estrategia de despliegue y recuperación.

El panel activo es la aplicación React de `src/web`. El chequeo de tipos cubre las carpetas del backend, el panel React y las pruebas vigentes.

## Qué mejoraría con más tiempo

- Añadir pruebas de interfaz y accesibilidad con recorridos completos del operador.
- Añadir una vista de progreso para corridas largas y opciones para cancelar o reintentar de forma segura.
- Preparar un despliegue reproducible con persistencia y copias de seguridad de SQLite.
- Revisar con operadores de cobranza los textos, los filtros y las alertas usando datos reales anonimizados.

## Punto diferencial

La integración prioriza explicar por qué se importó, excluyó o dejó abierta cada cuota. El operador puede revisar el detalle de una corrida en lugar de depender de un total agregado, y puede simular los cambios antes de escribirlos.

## Uso de herramientas de IA

Se utilizó IA generativa como apoyo durante el desarrollo para revisar errores, proponer ajustes de interfaz y ayudar a redactar y actualizar documentación. También se usó para detectar inconsistencias entre rutas, comandos y archivos del proyecto.

La IA se trató como una herramienta de asistencia, no como fuente de requisitos ni como sustituto de las pruebas. Las reglas de negocio se contrastaron con el enunciado; los cambios se validaron con las pruebas de integración, el chequeo de tipos y la compilación del panel. La responsabilidad de revisar y aceptar las decisiones y el resultado final corresponde a quien entrega el proyecto.
