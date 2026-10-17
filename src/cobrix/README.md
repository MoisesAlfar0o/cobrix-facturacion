# Integración de Cobrix

Este módulo contiene la lógica del lado de Cobrix. La API del administrador se trata como un servicio externo: el cliente la consulta por HTTP y no lee ni modifica directamente su base de datos.

- `client.ts`: inicio de sesión y consultas de contratos, cuotas y libro de pagos.
- `import.ts`: simulación e importación idempotente de clientes y facturas.
- `payment.ts`: comparación del libro de pagos con las facturas abiertas.
- `config.ts`: valores por defecto y opciones de la integración.
- `store.ts`: almacenamiento local de Cobrix en SQLite.
- `service.ts`: funciones que conectan la configuración con el cliente y las corridas automáticas.

Las reglas de negocio y los criterios de aceptación están en [el enunciado](../../docs/ENUNCIADO.md). Para arrancar el proyecto, sigue las instrucciones del [README principal](../../README.md).
