# MacServicios — experimento visual, Fase 1

Implementado el 19 de octubre de 2026. Sin despliegue ni cambios en backend, base de datos, permisos o fórmulas financieras.

## Ramas y conservación del trabajo

- Rama inicial: `master`, con cambios locales ya existentes.
- Respaldo del estado real previo: `respaldo/antes-ux-fase1-20261019`, commit `cf2a4de`. Incluye los cambios de `src` que estaban sin confirmar antes del experimento.
- Rediseño: `experimental/macservicios-ux-fase1`.
- El respaldo tiene una copia independiente en `E:\ventas\macsomenos\servicios\revision-visual\fase1-original`. Comparte únicamente las dependencias instaladas mediante una unión de directorio; sus fuentes siguen siendo las anteriores.

## Cambios implementados

### Navegación y base visual

`src/App.js`, `src/index.css`, `src/styles/experimental-ux.css` y `src/components/ui/VisualUI.js`.

- Menú agrupado en Operaciones, Finanzas, Herramientas y Administración, con todos los destinos anteriores.
- Identidad y cierre del menú fuera del área desplazable; accesos rápidos conservados y plegables.
- Cabecera independiente del contenido cuando el menú está oculto. En móvil reserva 64 px para evitar cubrir títulos.
- Menú móvil inicialmente cerrado, cierre con Escape, foco limitado al menú mientras está abierto y restauración del desplazamiento al volver a escritorio.
- El menú oculto usa `inert` para evitar tabular por controles fuera de pantalla.
- Tokens neutros, acción principal azul oscuro, espaciado y componentes compartidos: PageHeader, ActionButton, StatCard, Disclosure, LoadingState y ErrorState.
- Formato monetario exclusivamente de presentación, con PEN/US$, separadores de miles y dos decimales.

### Productos

`src/pages/Productos.js`.

- Alta de producto en el encabezado con el mismo controlador existente; se deshabilita durante una selección, cuando antes no estaba disponible.
- Seis indicadores compactos: dos columnas en teléfono, tres en tablet y seis en escritorio.
- Búsqueda con etiqueta permanente y todos los filtros anteriores conservados. Los filtros condicionales por tipo siguen disponibles.
- Herramientas agrupadas en un desplegable: Análisis, Adelantar venta, Recojo, Personal, Venta, Fotos, Scan SN/IMEI, Marca de agua, DEC, FACU y asignación de vendedor cuando corresponda.
- Identificación con código MS y características; estados legibles y cantidades monetarias alineadas.
- Tabla con desplazamiento localizado, encabezado fijo y acceso por teclado. Conserva todas sus columnas y operaciones.
- Casilleros, resumen económico y ventas del catálogo en desplegables secundarios. Se conserva el componente original de cada operación y hay un acceso directo desde la cabecera.
- Se conservan los accesos existentes a fotografías; no se añadieron consultas a Inventario para cargar miniaturas en Productos.

### Ganancias

`src/pages/Ganancias.js`.

- Indicadores y filtros en filas independientes, tanto globales como por vendedor.
- Tarjetas con ancho suficiente para sus importes; los vendedores se apilan hasta que hay espacio para dos paneles.
- Ancho mínimo de tablas reducido a 720 px, con desplazamiento dentro de cada panel.
- Números tabulares y moneda sin saltos de línea.
- Etiquetas de filtros vinculadas a sus controles. Conservados los filtros independientes global/Gonzalo/Renato.
- Carga y error explícitos: no se muestran ceros como resultados definitivos durante la consulta o después de un error sin datos.
- No se modificaron normalizadores, costos, ganancias, fechas, porcentajes ni distribución entre vendedores.

## Validación

- `npx eslint src/App.js src/App.test.js src/pages/Productos.js src/pages/Ganancias.js src/components/ui/VisualUI.js src/pages/Ganancias.ux.test.js`: sin errores ni advertencias de código.
- `npm test -- --watchAll=false --runInBand`: 39 suites y 265 pruebas aprobadas.
- `npm run build` con `CI=true`: compilación satisfactoria.
- El proyecto no dispone de script de comprobación de tipos; el frontend es JavaScript.
- Persisten avisos de herramientas sobre antigüedad de Browserslist y una deprecación de Node; no impiden compilar y no se actualizaron dependencias en este experimento.
- Pruebas nuevas: carga/error de Ganancias, monedas, independencia de filtros y liberación del bloqueo de desplazamiento al pasar de móvil a escritorio.
- Las pruebas existentes de ventas, gastos, tracking, inventario, filtros y componentes continuaron aprobando con sus dependencias simuladas.
- Revisión local con datos existentes a 390, 768, 1280 y 1440 px: títulos, cifras, filtros, tablas y navegación. Sin desbordamiento horizontal de página en Productos y Ganancias; las tablas mantienen su propio desplazamiento.
- Comprobado en navegador: búsqueda exacta por SKU, apertura y cierre del alta sin guardar, acceso a herramientas y entrada/salida de selección para adelantos sin confirmar.
- No se realizaron ventas, gastos, altas o ediciones reales para probar. No se certifican envíos reales ni integraciones externas como parte de esta fase.
- No se afirma conformidad WCAG.

## Cómo probar

El backend local debe estar disponible en `http://localhost:3001`.

Experimental, actualmente disponible en `http://localhost:3000`:

```powershell
Set-Location 'E:\ventas\macsomenos\servicios\frontend-tailwind'
git switch experimental/macservicios-ux-fase1
$env:PORT = '3000'
$env:BROWSER = 'none'
npm start
```

Diseño anterior, actualmente disponible en `http://localhost:3002`:

```powershell
Set-Location 'E:\ventas\macsomenos\servicios\revision-visual\fase1-original'
$env:PORT = '3002'
$env:BROWSER = 'none'
npm start
```

Si un servidor ya está iniciado, basta abrir su dirección; no hace falta iniciar otro. La navegación real usa estado React: abrir `/` y elegir Productos o Ganancias desde el menú. No se crearon rutas URL ficticias.

Comparar los mismos filtros: búsqueda vacía, Estado/Tipo Todos, indicadores de selección sin marcar, mes Todos y año actual en Ganancias. Al cargar se pueden ver cachés previas; esperar a que termine la actualización.

## Cómo volver al diseño anterior

La forma más sencilla de comparar es mantener las dos direcciones abiertas. Para cambiar el checkout principal después de detener su servidor, guardar primero cualquier cambio nuevo que se haya hecho tras esta entrega y comprobar `git status`.

```powershell
Set-Location 'E:\ventas\macsomenos\servicios\frontend-tailwind'
git status
git switch --detach respaldo/antes-ux-fase1-20261019
npm start
```

Se utiliza HEAD separado porque la rama de respaldo está abierta en la copia de comparación. Para regresar al experimento:

```powershell
git switch experimental/macservicios-ux-fase1
```

No usar `reset --hard`, borrar archivos ni sobrescribir cambios para comparar. `master` por sí sola no contiene los cambios que originalmente estaban sin confirmar; el respaldo sí conserva ese estado.

## Comparaciones y siguientes fases

Las capturas, mediciones y galería están en `E:\ventas\macsomenos\servicios\revision-visual\fase1`.

La búsqueda de Productos en teléfono pasa aproximadamente de 1868 px a 588 px desde el inicio; el listado, de 2536 px a 965 px. Mediciones con la página al inicio, sin filtros y el menú oculto. La barra de desplazamiento reserva 15 px del ancho emulado.

Esta entrega termina en la Fase 1 solicitada. El rediseño específico de Inventario, Gastos, Análisis, Calculadora, Servicios, Inicio y las familias de modales queda para las fases 2 y 3, después de revisar esta versión. Esos módulos conservan su contenido y reciben únicamente la navegación/cabecera compartida.

### Ajuste del panel rápido

Los accesos a Eshopex, Calcular compra, Calculadora y eBay se colocaron inmediatamente debajo de la identidad del sistema, en un bloque plegable independiente del desplazamiento de los módulos. La calculadora rápida se compactó en una sola acción. Comprobado visualmente en escritorio y teléfono; pruebas de App y build aprobados.
