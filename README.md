# ManguiTrack

Aplicación web para la gestión integral de inventario, ventas, pedidos y distribución de **Los Manguitos · Chivo NET**. Construida con Vite y JavaScript vanilla (sin frameworks ni dependencias en tiempo de ejecución).

## Funcionalidades

- **Productos e inventario:** CRUD de productos, categorías (árbol) y proveedores; existencias por ubicación; entradas y salidas con validación de stock y alertas de stock bajo.
- **Bodegas y sucursales:** CRUD de ubicaciones (central, bodega, sucursal); control de existencias por ubicación; transferencias con validación de stock y cálculo de ruta.
- **Clientes y ventas:** CRUD de clientes; ventas de varios productos con precios tomados del catálogo, cantidades, total e historial detallado.
- **Pedidos:** creación en cola FIFO, estados (pendiente → en camino → entregado, o cancelado), historial por pedido con línea de tiempo y despacho desde la bodega con stock más cercana.
- **Logística:** grafo editable de conexiones entre central, bodegas y sucursales; consulta de rutas con Dijkstra (menor distancia) y BFS (menos tramos); seguimiento de entregas con kilómetros recorridos.
- **Seguimiento:** bitácora de todos los movimientos, filtros, exportación CSV, deshacer operaciones (hasta 30 niveles) y respaldos JSON.
- **Interfaz:** navegación superior (sin menú lateral), diseño responsive, tema claro/oscuro/automático, tablas con búsqueda, modales, notificaciones y estados vacíos. Textos e iconos en lugar de emojis.

## Requisitos

- [Node.js](https://nodejs.org/) 20.19+ o 22.12+ (probado con v24.11.1)
- npm 7+ (probado con 11.6.2)

## Instalación y uso

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # genera la versión de producción en dist/
npm run preview  # sirve localmente dist/
```

## Estructura del proyecto

```
ManguiTrack/
├── src/
│   ├── index.html        # cargador de la app, modal y contenedor de notificaciones
│   ├── index.js          # punto de entrada: eventos globales y enrutamiento de acciones
│   ├── state.js          # estado, localStorage, transacciones/deshacer, consultas y algoritmos
│   ├── ui.js             # componentes: formularios, modales, tablas, toasts y tema
│   ├── views.js          # navegación, resumen, catálogos, inventario y transferencias
│   ├── views-op.js       # ventas, pedidos, entregas, rutas, bitácora y ajustes
│   ├── actions-catalog.js# acciones de productos, categorías, proveedores, clientes y stock
│   ├── actions-op.js     # acciones de carrito, ventas, pedidos, entregas y ajustes
│   └── styles.css        # sistema de diseño, temas y media queries
├── vite.config.js        # raíz en src/ y salida del build en ../dist
├── package.json          # scripts y dependencias
├── package-lock.json     # versiones exactas del árbol de dependencias
├── .gitignore            # excluye node_modules/, dist/ y archivos locales
├── node_modules/         # dependencias instaladas (no versionar)
└── dist/                 # salida de producción (no versionar)
```

Vite usa `src/` como raíz (configurado en `vite.config.js`), por lo que el build se genera en `dist/`, en la raíz del repositorio.

## Datos y persistencia

Los datos se guardan automáticamente en `localStorage` bajo la clave `manguitrack.v1` después de cada operación. No hay backend. En **Ajustes** puedes exportar/importar un respaldo JSON, restaurar los datos de ejemplo y cambiar el tema. El primer inicio carga un catálogo de demostración.

## Dependencias

No hay dependencias en tiempo de ejecución: todo es HTML, CSS y JavaScript nativo.

| Dependencia | Tipo | Versión declarada | Versión instalada | Uso |
| --- | --- | --- | --- | --- |
| [vite](https://vite.dev/) | `devDependencies` | `^7.1.7` | `7.3.8` | Servidor de desarrollo y empaquetado |

Para verificar o actualizar:

```bash
npm ls
npm update vite
```

## Verificación

Se validaron los flujos principales en un navegador real (Chrome headless): ventas con descuento de stock, creación/despacho/entrega/cancelación de pedidos, entradas y salidas, transferencias, rutas Dijkstra/BFS, CRUDs, deshacer, cambio de tema y persistencia tras recarga. El build de producción compila sin errores.
