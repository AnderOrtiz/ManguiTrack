# ManguiTrack

Prototipo de gestión integral de inventario, ventas y distribución de **Los Manguitos · Chivo NET**, construido con HTML, CSS y JavaScript puro, empaquetado con [Vite](https://vite.dev/).

Incluye catálogo indexado por SKU, existencias por ubicación, árbol de categorías, cálculo de rutas (Dijkstra y BFS), cola de pedidos FIFO y pila de deshacer LIFO.

## Requisitos

- [Node.js](https://nodejs.org/) 20.19+ o 22.12+ (se probó con v24.11.1)
- npm 7+ (se probó con 11.6.2)

## Instalación

```bash
npm install
```

## Uso

```bash
npm run dev      # inicia el servidor de desarrollo en http://localhost:5173
npm run build    # genera la versión de producción en dist/
npm run preview  # sirve localmente el contenido de dist/
```

El servidor de desarrollo recarga la página automáticamente al guardar cambios en `src/index.html`, `src/index.js` o `src/styles.css`.

Vite toma `src/` como raíz (configurado en `vite.config.js`) y deja el build en `dist/`, en la raíz del proyecto.

Para probar la versión de producción:

```bash
npm run build
npm run preview
```

## Estructura del proyecto

```
ManguiTrack/
├── src/
│   ├── index.html   # markup de la app; carga index.js como módulo
│   ├── index.js     # datos, algoritmos, vistas y delegación de eventos
│   └── styles.css   # estilos, variables de tema claro/oscuro y diseño responsive
├── vite.config.js   # raíz en src/ y salida del build en ../dist
├── package.json     # metadatos, scripts y dependencias
├── package-lock.json # versiones exactas del árbol de dependencias
├── .gitignore       # excluye node_modules/, dist/ y archivos locales
├── node_modules/    # dependencias instaladas (no versionar)
└── dist/            # salida de producción generada por npm run build (no versionar)
```

## Dependencias

El proyecto no tiene dependencias en tiempo de ejecución: todo el funcionamiento es HTML, CSS y JavaScript nativo.

| Dependencia | Tipo | Versión declarada | Versión instalada | Uso |
| --- | --- | --- | --- | --- |
| [vite](https://vite.dev/) | `devDependencies` | `^7.1.7` | `7.3.8` | Servidor de desarrollo, empaquetado y build de producción |

El `^` en la versión declarada permite actualizaciones compatibles dentro de la serie 7.x; `package-lock.json` fija la versión exacta instalada para que todos los entornos obtengan el mismo resultado.

Para actualizar Vite a la última versión compatible:

```bash
npm update vite
```

Para verificar las dependencias instaladas:

```bash
npm ls
```
