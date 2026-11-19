# MiSalud · portal del paciente de iMedic

Portal donde el paciente ve, con su DNI, la información clínica que publican las clínicas que usan iMedic SaaS:
atenciones, historia clínica de ingreso, diagnósticos y epicrisis. Es **solo lectura** y no reemplaza a iMedic.

```
frontend/   Next.js 16 + TypeScript + Tailwind 4 + motion  → Vercel
backend/    Node + Express + mssql (BFF)                   → Railway, con su propia base SQL Server
```

El navegador habla solo con el frontend: Next reenvía `/api/*` al backend, así las cookies de sesión son
first-party (`SameSite=Strict`). El backend lee cada clínica directo de su SQL Server, con un login de solo
lectura, y nunca escribe en las bases de iMedic.

## Correr todo en modo mock (sin acceso a las clínicas)

Requiere Node 20 o más nuevo.

```bash
# Terminal 1: backend en http://localhost:5010 (todo en memoria; RENAPER, clínicas y emails simulados)
cd backend && npm install && npm run mock

# Terminal 2: frontend en http://localhost:3000
cd frontend && npm install && npm run dev
```

- **Cuenta demo:** DNI `30123456`, contraseña `MiSalud2026!`. Tiene fichas en Güemes (dos fichas duplicadas)
  y en Sarmiento, más un homónimo descartado.
- **Registro:** cualquier DNI que no termine en 0 (los que terminan en 0 simulan "RENAPER no lo encontró").
  El código de verificación aparece en pantalla y en la consola del backend. Al validar la identidad, el mock
  crea fichas de ejemplo en ambas clínicas para que el portal tenga datos.
- **Clínica caída:** `MOCK_CLINICA_CAIDA=101 npm run mock` muestra el aviso de clínica no disponible.
- Tests del backend: `cd backend && npm test`.

## Qué hace el MVP

1. **Registro:** DNI, sexo, nombre, email y contraseña. Se verifica el email con un código de 6 dígitos.
2. **Identidad:** validación contra RENAPER **solo con el número de DNI** (a través del endpoint de iMedic SaaS).
   La validación con foto del DNI ya tiene lugar en la API (`metodo: "renaper_foto"`) y responde 501 por ahora.
3. **Vínculos:** busca el DNI en cada clínica habilitada y confirma la ficha solo si coinciden DNI, sexo y fecha de
   nacimiento. Los homónimos y los casos dudosos no muestran datos.
4. **Portal:** inicio, atenciones de todas las clínicas con filtros, detalle con resumen, historia de ingreso,
   diagnóstico y epicrisis, clínicas vinculadas y perfil.

## Seguridad

Parte de la base de auth y del motor de emails de IOSCOR, sin sus fallas:

- Sesión con cookie httpOnly de acceso (JWT de 10 min) y refresh rotativo guardado como hash en la base;
  inactividad de 30 min, máximo 12 h, revocación en cada pedido.
- CSRF de doble cookie con header `x-csrf-token` y control de `Origin`.
- Contraseñas con argon2id; códigos con HMAC + pepper, 10 min y 5 intentos; respuestas uniformes (no revelan si un
  DNI o email existe) y rate limit por IP y por DNI.
- Los ids que ve el navegador son opacos (AES-256-GCM) y atados a la cuenta: no se puede pedir la atención de otro.
- Auditoría de cada lectura de datos clínicos.
- `MOCK_MODE` está prohibido con `NODE_ENV=production`.

### Integración con iMedic SaaS ([iMedicSaaSBack#3](https://github.com/isource2025/iMedicSaaSBack/pull/3))

- **Clínicas (SQL Server):** login `misalud_portal_ro` (script S4), contraseña distinta por clínica en
  `CLINICA_<ID>_DB_PASSWORD`. Las tablas que el rol no puede leer se detectan con `HAS_PERMS_BY_NAME` y se omiten
  (por ejemplo, nombres de profesionales de `imPersonal`/`imPassword`).
- **Catálogo (MySQL de plataforma):** vista `vw_MiSaludEmpresas` con el usuario `misalud_catalogo_ro` (script S5),
  nunca la tabla `Empresas`. Aporta nombre, servidor/base SQL, `FileServerUrl` y `PacsUrl`. Qué clínica se publica
  lo decide `EmpresasPortal` del portal.
- **File server / PACS (Fase 2):** pedidos firmados con `x-imedic-sig`, mismo esquema y mismas claves que iMedic
  (`backend/src/lib/signedFileToken.js` es copia textual del de iMedic; no se edita acá).
- **Fotos:** las URLs firmadas de iMedic vencen en 2–3 h; el portal no las guarda en ningún lado.

## Variables y migraciones

- `backend/.env.example` documenta todas las variables (base del portal, clínicas, catálogo, firma, RENAPER,
  email, sesión).
- `frontend/.env.example`: `BACKEND_URL`.
- Migraciones en `backend/db/migrations/*.sql` (separadas por `GO`). `npm run migrate` aplica las pendientes y las
  registra en `SchemaMigraciones`.

## Despliegue

**Backend en Railway**

1. Servicio desde este repo con *root directory* `backend/` (usa `backend/railway.json`: Railpack, `npm run migrate`
   antes de cada deploy, healthcheck en `/api/health`).
2. Base del portal: SQL Server propio (servicio de Railway con la imagen `mcr.microsoft.com/mssql/server` o un SQL
   gestionado). Cargar `PORTAL_DB_*`.
3. Secretos: `SESSION_JWT_SECRET`, `CODE_PEPPER`, `OPAQUE_ID_KEY` (ver `.env.example`).
4. `FRONTEND_URL` con la URL de Vercel, `NODE_ENV=production`, `TRUST_PROXY=2` (Vercel + proxy de Railway).
5. Clínicas, catálogo, RENAPER, email y claves de firma según `.env.example`.

**Frontend en Vercel**

Proyecto con *root directory* `frontend/` y `BACKEND_URL` apuntando al servicio de Railway.

## Pendiente

- Confirmar el `IDEMPRESA` de Güemes (Sanatorio Materno Infantil) y habilitarlo en `EmpresasPortal`
  (ver `backend/db/migrations/002_empresas_piloto.sql`). No es 102: ese es Colman.
- El script S4 de iMedic deja `imHCI` en Fase 2, pero el MVP muestra la historia clínica de ingreso. Hasta que
  `imHCI` pase a la lista del MVP, esa pestaña queda vacía con el login de solo lectura.
- Adjuntos e imágenes (PACS) en Fase 2, usando `backend/src/clinicas/clinicaHttp.js`.
- Panel de administración de clínicas (lo maneja el super admin de iMedic).
- Rate limit compartido (Redis) si el backend corre con más de una instancia.
- Las migraciones y consultas SQL no se probaron contra un SQL Server real.
