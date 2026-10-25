# RentaMaq

Plataforma para publicar, buscar y alquilar maquinaria y equipos de construcción. Conecta a contratistas que necesitan equipos con proveedores que tienen maquinaria disponible.

El sitio es estático —HTML, CSS y JavaScript— y se publica directamente en GitHub Pages sin compilación. La autenticación, los datos y las fotografías se guardan en Supabase, por lo que una misma cuenta funciona desde cualquier dispositivo y cliente web.

- **Sitio publicado:** pendiente de subir a GitHub Pages.
- **Backend:** proyecto de Supabase ya vinculado en `assets/js/core/config.js`.
- **Cuentas Demo:** incluidas en `supabase/seed.sql`.
- **Requisitos:** ninguno para el visitante. Para publicar solo se necesitan una cuenta de GitHub y acceso al panel de Supabase.

---

## 1. Contenido del proyecto

```
RentaMaq/
├── index.html                  Estructura, pantalla de carga y orden de scripts
├── README.md                   Esta guía
├── LEEME.txt                   Guía rápida
├── assets/
│   ├── css/                    Estilos base, estructura, componentes y responsive
│   ├── img/                    Fotografías referenciales del catálogo inicial
│   └── js/
│       ├── app.js              Arranque, sesión y eventos globales
│       ├── core/
│       │   ├── config.js       URL y clave pública de Supabase, bucket y cuentas Demo
│       │   ├── utils.js        Formatos, validaciones, imágenes y mensajes de error
│       │   ├── store.js        Estado, consultas, sincronización y Realtime
│       │   ├── auth.js         Registro, acceso, recuperación, perfil y cuenta
│       │   └── data.js         Equipos, alquileres, mensajes, favoritos e incidencias
│       ├── ui/
│       │   ├── icons.js        Iconos SVG
│       │   └── shell.js        Navegación, encabezado y renderizado
│       ├── vendor/
│       │   └── supabase.js     Cliente oficial de Supabase
│       └── views/              Catálogo, alquileres, panel, equipos, mensajes, soporte,
│                               perfil y Acerca de RentaMaq
└── supabase/
    ├── schema.sql              Tablas, RLS, disparadores, Storage, Realtime y funciones
    └── seed.sql                Cuentas Demo, catálogo inicial y operaciones de ejemplo
```

No hay `package.json`, dependencias que instalar ni proceso de build. Los archivos se sirven tal como están.

---

## 2. Preparar Supabase

El proyecto ya está configurado en `assets/js/core/config.js`:

```js
const RM_SUPABASE_URL = 'https://laprapprjecryopmhzfr.supabase.co';
const RM_SUPABASE_ANON_KEY = 'eyJ...'; // clave pública anon
```

La clave `anon` es pública por diseño. Lo que protege los datos son las políticas RLS incluidas en `schema.sql`. **Nunca** copies la clave `service_role` a ningún archivo del frontend.

### 2.1. Ejecutar el esquema

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y abre el proyecto de RentaMaq.
2. Ve a **SQL Editor → New query**.
3. Copia todo el contenido de `supabase/schema.sql`, pégalo y pulsa **Run**.
4. Espera el mensaje de éxito. Si aparece un error, no continúes: corrige el punto indicado y vuelve a ejecutar el archivo completo.

El esquema es idempotente en su mayor parte: usa `create table if not exists`, `create or replace` y `drop policy if exists`, por lo que puede ejecutarse de nuevo para actualizar funciones y políticas.

### 2.2. Cargar las cuentas y los datos Demo

1. Abre **SQL Editor → New query**.
2. Pega todo el contenido de `supabase/seed.sql` y pulsa **Run**.
3. Verifica en **Table Editor** que existen las tablas y que `profiles` contiene las cuentas Demo.

`seed.sql` es idempotente: crea o actualiza las cuentas por correo, restablece su contraseña a `Demo1234`, confirma el correo y vuelve a cargar el catálogo inicial. Las cuentas y las operaciones existentes no se duplican.

> Si vas a publicar sin datos de ejemplo, ejecuta solo `schema.sql`, omite `seed.sql` y registra tu primera cuenta desde la pantalla de acceso. Para conservar las cuentas Demo y eliminar solo el catálogo de ejemplo, borra los registros desde **Table Editor** o ejecuta las sentencias `delete` que correspondan.

### 2.3. Verificar Storage

En **Storage** debe existir el bucket público **`equipment-images`**. `schema.sql` lo crea con:

- Lectura pública para mostrar las fotografías del catálogo.
- Carga, reemplazo y borrado solo para el usuario autenticado que es propietario del archivo.
- Límite de 5 MB y tipos `image/jpeg`, `image/png` y `image/webp`.

Si el bucket no aparece, revisa que `schema.sql` haya terminado sin errores en la sección de Storage.

---

## 3. Configurar autenticación y enlaces

En Supabase entra a **Authentication → URL Configuration**.

### Site URL

Escribe la dirección pública del sitio, incluyendo el nombre del repositorio si corresponde:

```
https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/
```

### Redirect URLs

Agrega las direcciones exactas que usará la aplicación. La app toma `location.origin + location.pathname`, así que si se abre `index.html`, el enlace incluye ese archivo:

```
https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/
https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/index.html
```

Si usas un dominio propio, agrega también:

```
https://tu-dominio.com/
https://tu-dominio.com/index.html
```

Estas entradas permiten:

- Confirmar el correo de una cuenta nueva.
- Restablecer la contraseña desde el enlace enviado por correo.
- Volver correctamente al sitio después de la verificación.

### Proveedor Email

En **Authentication → Providers → Email**:

- **Enable Email provider:** activado.
- **Confirm email:** puedes dejarlo activado. Cada cuenta nueva deberá abrir el enlace enviado a su correo antes de ingresar. Las cuentas Demo ya están confirmadas.
- **Secure email change:** si está activado, un cambio de correo requiere confirmación en la dirección anterior y en la nueva.
- **Minimum password length:** 8 caracteres, igual que la validación del formulario.

### Plantillas de correo (opcional)

Puedes personalizar las plantillas en **Authentication → Email Templates**. Mantén las variables `{{ .ConfirmationURL }}` o `{{ .TokenHash }}` según corresponda; si las eliminas, los enlaces dejarán de funcionar.

---

## 4. Publicar en GitHub Pages

1. Crea un repositorio público en GitHub.
2. Sube **el contenido** de esta carpeta, no la carpeta contenedora:
   - `index.html`
   - `README.md`
   - `LEEME.txt`
   - `assets/` completa (incluye `vendor/supabase.js` e `img/`)
   - `supabase/` (opcional, pero recomendable para conservar el SQL)
3. En el repositorio entra a **Settings → Pages**.
4. En **Build and deployment** elige **Deploy from a branch**.
5. Selecciona la rama **main** y la carpeta **/ (root)**. Guarda.
6. Espera uno o dos minutos. GitHub mostrará la dirección publicada:

```
https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/
```

7. Copia esa dirección y configúrala en **Authentication → URL Configuration** como se explica en la sección 3.
8. Abre la dirección en una ventana privada y comprueba que aparece la pantalla de acceso.

### Actualizaciones

Sube los archivos modificados al repositorio. GitHub Pages publica el cambio en uno o dos minutos. Si el cliente conserva una versión anterior, recarga con `Ctrl + F5`.

### Dominio propio (opcional)

En **Settings → Pages → Custom domain** escribe el dominio y sigue las instrucciones de GitHub. Después agrega ese dominio a **Site URL** y **Redirect URLs** en Supabase. El certificado HTTPS puede tardar unos minutos.

---

## 5. Cuentas Demo

Todas usan la contraseña **`Demo1234`**. Están confirmadas y no requieren revisar el correo.

| Rol | Correo | Nombre / negocio |
|---|---|---|
| Contratista | `contratista@rentamaq.pe` | Anderson Castro · Constructora Horizonte |
| Proveedor | `proveedor@rentamaq.pe` | Miguel Sánchez |
| Proveedor | `norte@rentamaq.pe` | Maquinarias del Norte |
| Proveedor | `geo@rentamaq.pe` | GeoEquipos Trujillo |
| Proveedor | `rental@rentamaq.pe` | Norte Rental |
| Proveedor | `huanchaco@rentamaq.pe` | Equipos Huanchaco |
| Proveedor | `energia@rentamaq.pe` | Energía para Obras |

La pantalla de acceso muestra botones directos para las dos cuentas principales. La sección **Acerca de RentaMaq → Cuentas Demo** lista todas.

### Flujo recomendado para probar

1. Entra como **contratista** y abre la ficha de un equipo.
2. Calcula el periodo, guarda una cotización o envía una solicitud.
3. Abre **Mensajes** y consulta al proveedor.
4. Cierra sesión y entra como **proveedor**.
5. Revisa la solicitud en **Solicitudes y alquileres**, confirma, registra la entrega y la devolución.
6. Vuelve como contratista para registrar la forma de pago y valorar el servicio.
7. Abre el sitio en otro dispositivo con la misma cuenta: los cambios deben aparecer.

### Cambiar la contraseña de una cuenta Demo

Entra con la cuenta, abre **Mi cuenta → Seguridad de la cuenta** y actualízala. Si vuelves a ejecutar `seed.sql`, la contraseña regresa a `Demo1234`.

### Eliminar las cuentas Demo en producción

Desde **Authentication → Users** puedes eliminar cada cuenta. Al borrar el usuario se eliminan en cascada su perfil, sus equipos, sus conversaciones y sus favoritos; los alquileres compartidos conservan el historial para la otra parte.

---

## 6. Modelo de datos y seguridad

### Tablas

| Tabla | Contenido |
|---|---|
| `profiles` | Nombre, rol, empresa, teléfono, ciudad, RUC y sello comercial. El correo vive en `auth.users` y solo lo ve su propietario. |
| `equipment` | Catálogo: ficha técnica, tarifa, condiciones, fotografía y disponibilidad. |
| `bookings` | Cotizaciones y alquileres con importes calculados, estado, forma de pago y valoración. |
| `threads` | Conversaciones entre dos cuentas, opcionalmente asociadas a un equipo. |
| `messages` | Mensajes de cada conversación. |
| `tickets` | Incidencias vinculadas a un alquiler. |
| `reviews` | Valoraciones del contratista al finalizar el alquiler. |
| `favorites` | Equipos guardados por cada cuenta. |
| `profiles_public` (vista) | Nombre, rol, empresa, ciudad y sello comercial. Excluye correo y teléfono. |

### Reglas RLS

- **Perfiles:** cada cuenta solo lee y actualiza su propia fila. Nombre, empresa, teléfono y ciudad son los únicos campos editables directamente; el rol, RUC y sello comercial cambian solo mediante funciones controladas.
- **Equipos:** lectura pública. Solo una cuenta con rol `proveedor` puede crear, editar o eliminar sus propios equipos.
- **Alquileres:** visibles solo para el contratista y el proveedor de la operación. El contratista crea la solicitud; el proveedor gestiona la confirmación, entrega y devolución.
- **Conversaciones y mensajes:** visibles solo para los dos participantes. Un usuario solo puede escribir en sus propios hilos.
- **Incidencias:** visibles para las partes del alquiler; las crea el contratista o el proveedor y las resuelve cualquiera de las dos partes.
- **Valoraciones:** lectura pública; solo el contratista de un alquiler finalizado puede crear la suya, una vez.
- **Favoritos:** cada cuenta administra solo los suyos.
- **Storage:** lectura pública de las fotografías; escritura y borrado solo en la carpeta del usuario autenticado.

### Funciones controladas

`schema.sql` crea funciones `security definer` para las operaciones sensibles:

- `become_provider(company, ruc, phone)` — convierte una cuenta de contratista en proveedor.
- `confirm_commercial_data(company, ruc, phone)` — confirma los datos comerciales y activa el sello.
- `delete_own_account()` — elimina la cuenta autenticada y sus datos asociados.

Los importes, las fechas, las transiciones de estado y el promedio de valoraciones se calculan en la base de datos, no se aceptan desde el cliente.

### Realtime

El esquema agrega las tablas a la publicación `supabase_realtime`. La aplicación combina suscripciones en tiempo real con una actualización al recuperar el foco de la ventana, de modo que los cambios se reflejan en otros dispositivos sin recargar manualmente.

---

## 7. Funciones de la plataforma

### Contratistas

- Catálogo con búsqueda por texto, ciudad, categoría, rango de precio, disponibilidad y ordenamiento.
- Favoritos y comparación de hasta tres equipos.
- Cotización con jornadas de 8 horas, operador, traslado, servicio y garantía.
- Solicitud de alquiler, seguimiento de estados y registro de la forma de pago acordada.
- Mensajería con el proveedor, incidencias y valoración al finalizar.
- Exportación de alquileres a CSV y respaldo JSON.

### Proveedores

- Conversión de cuenta y confirmación de datos comerciales.
- Publicación de equipos con fotografía optimizada antes de subirla a Storage.
- Edición, pausa, activación y eliminación de anuncios.
- Panel con solicitudes, alquileres activos e importes estimados.
- Confirmación de fechas, registro de entrega y devolución.
- Atención de incidencias y sello de confianza en el catálogo.

### Pagos

RentaMaq **no procesa cobros** ni solicita números de tarjeta o claves bancarias. Cuando el proveedor confirma la solicitud, el contratista registra el medio acordado —transferencia, Yape/Plin, efectivo, cheque u otro— y ambas partes ven la constancia en el resumen del alquiler. La garantía se muestra aparte como importe reembolsable.

### Sello “Datos comerciales confirmados”

Indica que la cuenta completó la revisión básica de nombre comercial, RUC y teléfono. No acredita una inspección técnica del equipo ni una revisión documental completa. La plataforma lo muestra con esa explicación en el catálogo y en la ficha del equipo.

---

## 8. Cambiar de proyecto de Supabase

Si quieres usar otro proyecto:

1. Crea el proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` y, si quieres las cuentas Demo, `supabase/seed.sql`.
3. En `assets/js/core/config.js` reemplaza `RM_SUPABASE_URL` y `RM_SUPABASE_ANON_KEY` por los del nuevo proyecto. La clave debe ser la **anon public**, no la `service_role`.
4. Configura **Site URL** y **Redirect URLs** del nuevo proyecto con la dirección publicada.
5. Recarga el sitio.

No es necesario cambiar nada más: las tablas, políticas y funciones ya están definidas en el SQL.

---

## 9. Solución de problemas

### “Falta preparar la base de datos”

La aplicación no encuentra las tablas. Ejecuta `supabase/schema.sql` completo en el SQL Editor del proyecto configurado en `config.js`. Si ya lo ejecutaste, confirma que no hubo errores y que estás en el proyecto correcto.

### “No se pudo validar la sesión” o el registro no continúa

- Revisa **Authentication → URL Configuration**. La dirección publicada debe estar en **Site URL** y **Redirect URLs**, con y sin `index.html`.
- Si **Confirm email** está activo, la cuenta debe abrir el enlace enviado a su correo antes de ingresar. Revisa también la carpeta de spam.
- Si el correo nunca llega, revisa **Authentication → Logs** y la configuración SMTP. El servicio de correo de Supabase tiene límites de envío.

### El enlace de recuperación abre otra página o muestra un error

Agrega la dirección exacta a **Redirect URLs**. Si el sitio está en `https://usuario.github.io/repositorio/`, deben estar:

```
https://usuario.github.io/repositorio/
https://usuario.github.io/repositorio/index.html
```

### “Correo o contraseña incorrectos”

Verifica la contraseña. Las cuentas Demo usan `Demo1234`. Si cambiaste la contraseña y no la recuerdas, usa **¿Olvidaste tu contraseña?** o vuelve a ejecutar `seed.sql` para restablecer las cuentas Demo.

### No aparecen las fotografías nuevas

- Confirma que el bucket `equipment-images` existe y es público.
- Revisa que el archivo se haya subido en **Storage → equipment-images**.
- Si la imagen se subió pero la ficha no se guardó, vuelve a editar el equipo.
- Formatos admitidos: JPG, PNG y WebP, hasta 5 MB después de la optimización.

### Los cambios no se ven en otro dispositivo

- Inicia sesión con la misma cuenta en ambos dispositivos.
- Recarga la página o cambia de sección para forzar una actualización.
- Confirma que el proyecto tiene Realtime activo y que las tablas están en la publicación `supabase_realtime`.
- Si el problema continúa, cierra sesión y vuelve a entrar.

### Error al ejecutar `seed.sql`

- Ejecuta primero `schema.sql`.
- El script usa las extensiones y funciones del esquema `auth`; debe ejecutarse desde el **SQL Editor** del proyecto, no desde un cliente restringido.
- Si una cuenta ya existe con otro identificador, el script la actualiza por correo. Revisa que el correo no esté duplicado en mayúsculas o minúsculas.

### La página se ve sin estilos o sin iconos

Comprueba que subiste la carpeta `assets` completa y que `index.html` está en la raíz del repositorio. Las rutas son relativas y distinguen mayúsculas y minúsculas.

### GitHub Pages muestra 404

- Confirma que `index.html` está en la raíz de la rama publicada.
- Revisa **Settings → Pages** y espera a que termine el despliegue.
- Si el repositorio es privado, GitHub Pages requiere un plan que lo permita.

---

## 10. Privacidad y mantenimiento

- El correo y el teléfono no se publican en el catálogo ni en la vista pública de perfiles.
- Cada cuenta solo accede a sus operaciones, mensajes y datos privados.
- La eliminación de cuenta es permanente y se ejecuta desde **Mi cuenta → Privacidad y eliminación**.
- Los respaldos JSON no incluyen contraseñas ni claves.
- Revisa periódicamente **Authentication → Users**, **Storage** y los registros de Supabase.
- Mantén actualizado `assets/js/vendor/supabase.js` si el proveedor publica correcciones de seguridad. El archivo actual es el cliente UMD oficial.

---

## 11. Créditos

Fotografías referenciales del catálogo inicial:

- Excavadora: [OperatorPro](https://operatorpro.co.uk/)
- Mezcladora: [Mr. Bricolage](https://www.mr-bricolage.be/betonniere/85389-betonniere-140-l-5411074216160.html)
- Estación total: [Zenith Equipments](https://zenithequipments.com/product/leica-flexline-ts06plus-total-station/)

RentaMaq · 2026
