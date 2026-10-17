# Cobrix: integración de facturación

Este proyecto conecta Cobrix con la API de un administrador de facturas de un proveedor de internet. Importa clientes y cuotas pendientes, y luego compara el libro de pagos del proveedor para actualizar las facturas que el ISP ya cobró.

El alcance y las reglas originales están en [el enunciado](docs/ENUNCIADO.md). Las decisiones de implementación y el uso de herramientas de IA se explican en [la nota técnica](docs/DECISIONES_TECNICAS.md).

## Requisitos

- Node.js 24 o posterior.
- pnpm.

## Arrancar el proyecto

Instala las dependencias y compila el panel una vez:

```bash
pnpm install
pnpm run build:web
```

Después, inicia el backend:

```bash
pnpm start
```

Al iniciar, el servidor muestra la dirección del panel y de la API simulada. Normalmente son:

| Servicio | Dirección |
| --- | --- |
| Panel compilado y API de Cobrix | http://127.0.0.1:4300 |
| API simulada del administrador | http://127.0.0.1:4310/api/v1 |
| Swagger de la API simulada | http://127.0.0.1:4310/docs |

Para desarrollar el frontend con recarga automática, deja `pnpm start` corriendo en una terminal y ejecuta en otra:

```bash
pnpm run dev:web
```

Abre http://127.0.0.1:5173. Vite reenvía las peticiones del panel al backend de Cobrix en el puerto 4300.

La API simulada incluye una caja de pruebas en Swagger. Las credenciales son usuario `cobrix` y contraseña `cobrix-sandbox`.

## Pruebas y validaciones

```bash
pnpm test
pnpm run typecheck
pnpm run typecheck:web
pnpm run build:web
```

Las pruebas de integración ejercitan el ciclo importar → registrar un pago en el simulador → actualizar facturas pagadas. También se comprueban las reglas de normalización y el servicio del panel.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/billing-api/` | API y caja simuladas del administrador; el panel se comunica con ellas por HTTP. |
| `src/cobrix/` | Cliente de la API, reglas de importación y pagos, configuración y almacenamiento local. |
| `src/server/` | API JSON de Cobrix y servidor que entrega el panel React. |
| `src/web/` | Aplicación React, componentes, páginas y estilos. |
| `data/` | Bases SQLite de la prueba y de Cobrix. |
| `docs/ENUNCIADO.md` | Requisitos y criterios de aceptación originales. |
| `docs/API.md` | Guía de la API simulada. |
| `docs/DECISIONES_TECNICAS.md` | Decisiones del proyecto, alcance, mejoras posibles y declaración de uso de IA. |
