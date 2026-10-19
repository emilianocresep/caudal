# Caudal · tu administrador financiero personal

App web instalable (PWA) para llevar tus cuentas, movimientos, pagos periódicos, MSI, presupuestos y gráficas.
Funciona sin conexión y se sincroniza entre tu celular y tu computadora.
Todo vive en tu cuenta gratuita de **Cloudflare**: un Worker sirve la app, D1 guarda la base de datos y Access se encarga del inicio de sesión.

---

## Guía de publicación (unos 20 minutos, una sola vez)

### 1. Sube el código a GitHub

1. Entra a <https://github.com/new>, ponle de nombre `caudal`, márcalo como **Private** y crea el repositorio.
2. En la página del repositorio, haz clic en **uploading an existing file** (o **Add file → Upload files** si ya tiene archivos).
3. Descomprime `caudal.zip` y **arrastra todo el contenido de la carpeta `caudal`** (no la carpeta en sí).
   En la raíz del repositorio deben quedar `package.json`, `wrangler.jsonc`, `index.html`, `src/`, `worker/`, `server/`, etc.
4. Haz clic en **Commit changes**.

### 2. Crea el Worker en Cloudflare

1. En <https://dash.cloudflare.com> ve a **Workers & Pages → Create → Import a repository** (o *Connect to Git*).
2. Elige el repositorio `caudal`.
3. Configuración:
   - **Project name:** `caudal`. Debe coincidir con `"name"` en `wrangler.jsonc`; si eliges otro nombre, cámbialo también ahí.
   - **Build command:** `npm run build` (o déjalo vacío; `wrangler.jsonc` ya lo ejecuta).
   - **Deploy command:** `npx wrangler deploy`
4. **Deploy**. En el primer despliegue Cloudflare **crea solo la base de datos D1** `caudal-db` y la conecta.
5. Al terminar verás tu dirección, algo como `https://caudal.TU-SUBDOMINIO.workers.dev`. Anótala.

### 3. Protección (opcional)

La app funciona **sin inicio de sesión**: abres la dirección y listo.
Si quieres que nadie más pueda ver tus datos aunque conozca la dirección, pon una clave:

1. En GitHub abre `wrangler.jsonc`, haz clic en el lápiz y escribe tu clave entre las comillas de `"APP_KEY": ""`.
2. **Commit changes**. Cloudflare publica de nuevo solo.
3. La app te pedirá la clave una vez en cada dispositivo (también se puede cambiar en **Ajustes → Sincronización**).

> Alternativa avanzada: Cloudflare Access (código por correo). Si defines `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD`, la app usa ese modo en lugar de la clave.

### 4. Instálala en tu celular

1. Abre tu dirección `https://caudal.TU-SUBDOMINIO.workers.dev` y entra con el código que te llega al correo.
2. **Android (Chrome):** menú ⋮ → **Instalar app**. **iPhone (Safari):** botón Compartir → **Agregar a pantalla de inicio**.
3. En la computadora, Chrome o Edge muestran un ícono de instalar en la barra de direcciones.

Listo. En **Ajustes → Sincronización** debe aparecer el punto verde *Sincronizado*.
Si aparece *No se pudo conectar con el servidor*, revisa en Ajustes el motivo que muestra.

Cada vez que subas cambios a GitHub, Cloudflare vuelve a publicar la app sola.

---

## Cómo usarla

- **Primero tus cuentas:** en Inicio toca *Crear las 3 sugeridas* (Débito, Tarjeta de crédito, Cartera) y edita cada una para poner su saldo actual. En la tarjeta de crédito escribe lo que debes hoy.
- **Registrar rápido:** botón **+** → monto → categoría → Guardar. Recuerda la última cuenta que usaste. En la computadora también puedes presionar la tecla **N**.
- **Transferencias:** para pagar la tarjeta, retirar efectivo o mandar dinero a tu ahorro. No cuentan como gasto ni como ingreso.
- **Periódicos:** activa *Movimiento periódico* y elige la frecuencia (semanal, quincenal, mensual o anual) y la duración (sin fin, 3/6/12/24 meses o un número de pagos).
- **Compras a MSI de hace tiempo:** pon la fecha del **primer pago** en el pasado y activa *El monto es el total de la compra*. La app calcula cuántos pagos ya pasaron y cuántos faltan; la tarjeta te muestra el **MSI por pagar**.
  Los pagos anteriores a la fecha del saldo inicial de la cuenta quedan en tu historial pero no vuelven a restarse, porque ya estaban incluidos en ese saldo.
- **Un pago distinto:** al abrir una ocurrencia de un periódico puedes *Omitir solo este pago* o *Terminar en este pago*.
- **Presupuesto:** toca el lápiz para definir grupos con porcentaje y prioridad (por ejemplo Ahorro 60%, Necesarios 20%, Placer 20%), asignar categorías a cada grupo y elegir tu cuenta de ahorro como destino. Se calcula con los ingresos del mes, incluidos los periódicos, y te dice cuánto te queda y cuánto puedes gastar por día.
- **Respaldo:** en Ajustes puedes descargar un archivo JSON con todos tus datos y volver a importarlo.

## Desarrollo local (opcional)

```bash
npm install
npm test              # pruebas de la lógica financiera
npm run preview       # compila y levanta la app + API + D1 local en http://localhost:8788
```

`npm run preview` usa `DEV_BYPASS=1`, que desactiva el inicio de sesión **solo en tu computadora**. Nunca agregues esa variable en Cloudflare.

## Estructura

```
wrangler.jsonc                 configuración del Worker (app, base de datos D1, variables)
worker/index.js                entrada del Worker: sirve la app y la API /api/*
server/auth.js                 verificación del token de Cloudflare Access
server/sync.js                 sincronización con D1 (gana la versión más reciente)
src/lib/finance.js             saldos, periódicos, MSI y presupuestos (lógica pura con pruebas)
src/lib/store.js               almacenamiento local (IndexedDB) y sincronización sin conexión
src/pages/                     Inicio, Cuenta, Historial, Análisis, Presupuesto, Ajustes
src/components/                formularios, íconos y piezas de interfaz
```

## Límites del plan gratuito (aproximados)

Workers: 100,000 peticiones al día. D1: 5 GB y millones de lecturas al mes. Access: hasta 50 usuarios.
Para una persona, eso alcanza para muchísimos años de movimientos.
