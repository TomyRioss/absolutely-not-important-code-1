# Auditoría E2E de PlatoRest

**Fecha:** 2026-09-28  
**Alcance:** Registro, login, onboarding, recuperación de contraseña, web pública, experiencia móvil y revisión estática de funcionalidades autenticadas.  
**Ejecución:** Chrome + Playwright a 320/390 px, revisión estática con seis agentes y análisis de seguridad Ruflo (119 archivos). Sin cambios de código ni comandos de base de datos/Prisma.

## Resumen

| Severidad | Cantidad |
|---|---:|
| Alta | 10 |
| Media | 13 |
| Baja | 0 |
| **Total** | **23** |

**Evaluación:** Hay fallos en dos rutas de alta/recuperación y riesgos importantes de integridad en pedidos. El navegador confirmó que onboarding deja avanzar sin sesión y termina en 401. El acceso a dashboard no pudo completarse con la cuenta de prueba disponible.

## Hallazgos

### 1. Onboarding permite completar formularios sin sesión y termina en 401

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Reproducido en navegador  
**URL:** `/onboarding`

Abrir la URL sin sesión, completar ambas contraseñas y pulsar **Continuar** deja el botón en “Guardando...” y finalmente muestra “No autenticado.”. La página debería pedir iniciar sesión antes de mostrar este paso o recuperar una sesión válida.

**Evidencia:** `MEDIA:dogfood-output/screenshots/onboarding-unauthenticated-401.png`  
**Código:** `app/onboarding/page.tsx:8-29`; la API exige sesión en `app/api/onboarding/route.ts:14-17`.

### 2. Recuperar contraseña conduce a 404

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Reproducido en navegador  
**URL:** `/login` → `/recuperar-password`

El enlace “¿Olvidaste tu contraseña?” abre una página 404. El flujo de recuperación no está disponible.

**Evidencia:** `MEDIA:dogfood-output/screenshots/forgot-password-404.png`  
**Código:** enlace en `app/login/page.tsx:194-200`; no existe una página para esa ruta.

### 3. El registro de clientes omite un teléfono que la API exige

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Hallazgo estático

El formulario de registro del menú envía nombre, email, contraseña y local, pero no `phone`. La API exige ese dato y responde 400, por lo que el cliente no puede crear su cuenta desde esa página.

**Código:** `app/menu/[restaurantSlug]/account/register/page.tsx`; validación en `app/api/customer/register/route.ts:7-10`.

### 4. Checkout descarta modificadores y sus precios

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Hallazgo estático

La ficha del producto suma y guarda modificadores en el carrito, pero checkout envía solo variante y cantidad. El pedido se recalcula con el precio base y omite las opciones elegidas; el total y el pedido final pueden diferir de lo que vio el cliente.

**Código:** `app/menu/[restaurantSlug]/[productId]/product-page.tsx:49-67`; `app/menu/[restaurantSlug]/checkout/page.tsx:56-64`; `app/menu/[restaurantSlug]/checkout/actions.ts:102-124`.

### 5. Checkout y POS aceptan cantidades negativas

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Hallazgo estático

Las acciones validan que haya líneas, pero no que cada cantidad sea finita, entera y positiva. Un envío manipulado con cantidad negativa puede producir un total negativo y pasar al decremento de stock, que termina aumentándolo.

**Código:** `app/menu/[restaurantSlug]/checkout/actions.ts:37-50`; `app/dashboard/pos/actions.ts:20+`; `lib/stock.ts:13`.

### 6. Guardado de variantes no confirma que pertenezcan al local actual

**Severidad:** Alta · **Categoría:** Funcional / integridad · **Estado:** Hallazgo estático, requiere validación de seguridad

La acción verifica el producto objetivo, pero actualiza variantes por ID sin comprobar que pertenezcan a ese producto o restaurante. Una llamada manipulada podría alterar variantes de otro negocio.

**Código:** `app/dashboard/menu/actions.ts:160-163,173,199-201`.

### 7. Un fallo intermedio durante el registro deja una cuenta parcial

**Severidad:** Alta · **Categoría:** Funcional · **Estado:** Hallazgo estático

El registro crea usuario, negocio, restaurante y datos iniciales en escrituras sucesivas. Si falla una etapa, queda una cuenta incompleta; el email ya ocupado impide reintentar el alta.

**Código:** `app/api/register/route.ts:20-23,36-131`; onboarding tiene escrituras sucesivas en `app/api/onboarding/route.ts:69-175`.

### 8. El alta de sucursal puede confirmar una ubicación que no se guardó

**Severidad:** Media · **Categoría:** Funcional / UX · **Estado:** Hallazgo estático

Si guardar dirección o coordenadas falla, la UI ignora el resultado, agrega la sucursal localmente y limpia el formulario. La ubicación parece persistida hasta recargar.

**Código:** `app/dashboard/menu/landing/design-client.tsx:202-210`.

### 9. Cambiar opciones del mismo producto puede hacer fallar checkout

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático

El carrito permite varias líneas de una misma variante con distintos modificadores. La búsqueda del servidor deduplica IDs y compara el número de variantes con el número de líneas; al no coincidir, responde que el producto ya no está disponible.

**Código:** `app/menu/[restaurantSlug]/[productId]/product-page.tsx:60`; `app/menu/[restaurantSlug]/checkout/actions.ts:43-49`.

### 10. Inventario no permite gestionar variantes no predeterminadas

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático

La página carga solo la variante marcada como predeterminada y descarta productos que no tengan una. Productos con varias presentaciones no pueden gestionar stock por cada una.

**Código:** `app/dashboard/inventario/page.tsx:14-16,31-39`.

### 11. Editor de pedidos no valida cantidades enteras ni variantes repetidas

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático

La acción rechaza cantidades menores que uno, pero acepta decimales y no consolida IDs repetidos. Esto permite guardar líneas duplicadas o fraccionarias desde una llamada manipulada.

**Código:** `app/dashboard/pedidos/actions.ts:72-104`.

### 12. Casilla legal aparece marcada por defecto

**Severidad:** Media · **Categoría:** UX · **Estado:** Confirmado en navegador/código

La casilla de aceptación de términos y privacidad llega marcada al formulario. El usuario puede enviar el alta sin una acción explícita de aceptación.

**Código:** `app/register/page.tsx:40,328-345`.  
**Evidencia visual:** `MEDIA:dogfood-output/screenshots/register-320.png`.

### 13. Botones de mostrar contraseña tienen objetivo táctil de 20 × 20 px

**Severidad:** Media · **Categoría:** Accesibilidad / móvil · **Estado:** Medido en navegador

Los controles de visibilidad de contraseña miden 20 × 20 px en onboarding, por debajo del mínimo de 24 × 24 px de WCAG 2.2 AA para objetivos no espaciados. Son difíciles de tocar en móvil.

**Código:** `app/onboarding/_components/onboarding-form.tsx:173-180,201-208`; `app/register/page.tsx:265-305`.  
**Evidencia:** `MEDIA:dogfood-output/screenshots/onboarding-320.png`.

### 14. Menú móvil cerrado conserva controles accesibles al teclado

**Severidad:** Media · **Categoría:** Accesibilidad · **Estado:** Hallazgo estático

El drawer cerrado se oculta con opacidad y `pointer-events`, pero sus enlaces siguen en el DOM sin `inert` ni `tabIndex` condicional. Tampoco gestiona Escape ni restaura el foco al cerrar; el foco puede llegar al contenido oculto o pasar detrás del overlay.

**Código:** `app/dashboard/mobile-nav.tsx:44-69,91-93`.

### 15. El enlace de soporte pierde su nombre accesible en móvil

**Severidad:** Media · **Categoría:** Accesibilidad · **Estado:** Hallazgo estático

En pantallas pequeñas se oculta el texto “Soporte”, pero el enlace conserva solo un icono y no tiene `aria-label`.

**Código:** `app/dashboard/layout.tsx:105-113`.

### 16. El acceso por email puede fallar si el email se registra con mayúsculas

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático, depende de la colación de email

El endpoint persiste el email original y el login lo normaliza a minúsculas. En almacenamiento sensible a mayúsculas, el alta se crea pero el auto-login falla; el siguiente intento de registro devuelve email existente.

**Código:** `app/api/register/route.ts:20,36-42`; `lib/auth.ts:30`; `app/register/page.tsx:63-90`.

### 17. Las acciones de fidelización permiten actualizar variantes y categorías de otro negocio

**Severidad:** Alta · **Categoría:** Funcional / integridad · **Estado:** Hallazgo estático, requiere validación de seguridad

Al guardar premios se actualizan variantes por ID sin acotar por premio/restaurante. También se acepta una categoría de otro negocio. Una llamada manipulada podría cambiar datos ajenos o mover un premio a otra categoría.

**Código:** `app/dashboard/fidelizacion/tienda-puntos/actions.ts:124-158`.

### 18. Las acciones de grupos de modificadores no acotan IDs al grupo/local

**Severidad:** Alta · **Categoría:** Funcional / integridad · **Estado:** Hallazgo estático, requiere validación de seguridad

La acción valida el premio principal, pero actualiza y elimina grupos/opciones por IDs recibidos sin comprobar que pertenezcan a ese premio o negocio. IDs manipulados pueden alcanzar registros ajenos.

**Código:** `app/dashboard/fidelizacion/tienda-puntos/actions.ts:313-340`.

### 19. Pedidos pendientes o cancelados cuentan para regalos por visita

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático

El cálculo de visitas no filtra el estado del pedido. Un pedido pendiente o cancelado puede habilitar un regalo; los puntos, en cambio, se otorgan solo al completar el pedido.

**Código:** `app/menu/[restaurantSlug]/tienda-puntos/regalos/page.tsx:27`; `app/menu/[restaurantSlug]/tienda-puntos/regalos/actions.ts:25-28`; contraste en `app/dashboard/pedidos/actions.ts:43-47`.

### 20. Regalos e historial de puntos no tienen enlaces visibles

**Severidad:** Media · **Categoría:** UX · **Estado:** Hallazgo estático

La navegación del cliente solo muestra Tienda, Encuestas y Tarjeta. Las páginas de regalos e historial existen, pero no se pueden descubrir navegando normalmente.

**Código:** `app/menu/[restaurantSlug]/tienda-puntos/tienda-puntos-navbar.tsx:14-18`.

### 21. QR de fidelización y tarjeta virtual siguen como “Próximamente”

**Severidad:** Media · **Categoría:** Funcional · **Estado:** Hallazgo estático

El QR y la tarjeta virtual no están implementados. Los usuarios que lleguen a esas pantallas no pueden usar esas funciones.

**Código:** `app/dashboard/fidelizacion/qr/page.tsx:1-6`; `app/dashboard/fidelizacion/tarjeta/page.tsx:5-13`; `app/menu/[restaurantSlug]/tienda-puntos/tarjeta/page.tsx:5-10`.

### 22. El canje no valida en servidor una opción obligatoria

**Severidad:** Media · **Categoría:** Funcional / integridad · **Estado:** Hallazgo estático

La UI impide continuar sin la opción requerida, pero la acción del servidor no vuelve a validar ese requisito. Un envío manipulado puede crear un canje incompleto.

**Código:** validación de UI en `app/menu/[restaurantSlug]/tienda-puntos/[rewardId]/reward-detail.tsx:56-57`; acción en `app/menu/[restaurantSlug]/tienda-puntos/actions.ts:28-38`.

### 23. Datos del menú permiten inyectar etiquetas HTML desde JSON-LD

**Severidad:** Alta · **Categoría:** Seguridad / funcional · **Estado:** Hallazgo estático (Ruflo lo señaló; riesgo confirmado por revisión de serialización)

El JSON-LD del menú serializa nombre, descripción y datos de productos editables por el restaurante con `JSON.stringify` y los inserta directamente en un elemento `<script>`. El serializador no escapa `</script>`; contenido especialmente preparado podría salir del bloque JSON e inyectar markup/script en la página pública del menú.

**Código:** `app/menu/[restaurantSlug]/page.tsx:109-133`; datos del negocio y productos se pasan desde `:93-128`.

## Tabla de hallazgos

| # | Hallazgo | Severidad |
|---|---|---|
| 1 | Onboarding sin sesión termina en 401 | Alta |
| 2 | Recuperación de contraseña 404 | Alta |
| 3 | Registro de cliente omite teléfono obligatorio | Alta |
| 4 | Checkout descarta modificadores | Alta |
| 5 | POS/checkout aceptan cantidades negativas | Alta |
| 6 | Guardado de menú no acota variantes al negocio | Alta |
| 7 | Registro parcial bloquea reintentos | Alta |
| 17 | Acciones de fidelización no acotan variantes/categorías | Alta |
| 18 | Acciones de grupos no acotan IDs al local | Alta |
| 23 | JSON-LD del menú permite inyección de script | Alta |
| 8 | Sucursal puede aparentar dirección no guardada | Media |
| 9 | Configuraciones repetidas de variante fallan en checkout | Media |
| 10 | Inventario oculta variantes no predeterminadas | Media |
| 11 | Edición de pedido acepta cantidades fraccionarias/IDs repetidos | Media |
| 12 | Aceptación legal preseleccionada | Media |
| 13 | Controles de contraseña de 20 × 20 px | Media |
| 14 | Drawer móvil sin gestión de foco/Escape | Media |
| 15 | Enlace de soporte sin nombre accesible en móvil | Media |
| 16 | Login puede fallar con email en mayúsculas | Media |
| 19 | Pedidos cancelados cuentan para regalos por visita | Media |
| 20 | Regalos e historial no tienen enlaces visibles | Media |
| 21 | QR/tarjeta de fidelización no implementados | Media |
| 22 | Canje no valida opciones obligatorias en servidor | Media |

## Cobertura y límites

### Probado en navegador

- Home y formularios públicos de registro y login.
- Recuperación de contraseña (404).
- Onboarding sin sesión hasta la respuesta 401.
- Revisión estática de administración, POS, menú, inventario, pedidos, sucursales, checkout y fidelización por agentes.
- Capturas a 320 px; registro sin overflow horizontal y onboarding con controles de contraseña de 20 × 20 px.
- Envío de login con las credenciales de prueba: el sitio respondió “Email o contraseña incorrectos”.

### No probado en navegador

- Dashboard, POS, menú/checkout autenticados, inventario, fidelización y administración: no se pudo iniciar sesión con la cuenta de prueba. No inspeccioné ni modifiqué datos de base de datos.
- Flujos dinámicos que requieren un restaurante existente: el acceso depende de la sesión no disponible.

Los hallazgos marcados como estáticos provienen de revisión de código y deben reproducirse en un entorno con sesión de prueba válida antes de cerrar los bugs.
