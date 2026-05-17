# AutoControl — Gestión de Mantenimiento Vehicular

App React/Vite para gestión de flota vehicular con PocketBase.

## Stack
- **Frontend**: React 18 + TypeScript + Vite → desplegado en Vercel
- **Backend**: PocketBase → desplegado en Render
- **Anti-sleep**: UptimeRobot (pings cada 5 min a Render)

---

## 🚀 Guía de despliegue completa

### 1. Backend — PocketBase en Render

#### Preparar PocketBase
1. Descarga PocketBase para Linux desde https://pocketbase.io/docs/
2. Crea un `Dockerfile` en una carpeta vacía:

```dockerfile
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /pb
COPY pocketbase .
COPY pb_data ./pb_data
EXPOSE 8090
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

3. Sube la carpeta a GitHub (incluye tu `pb_data` con la BD existente)

#### Desplegar en Render
1. Ve a https://render.com → New → Web Service
2. Conecta tu repositorio de GitHub con el Dockerfile
3. Configuración:
   - **Name**: `autocontrol-api`
   - **Region**: Oregon (o la más cercana)
   - **Branch**: main
   - **Runtime**: Docker
   - **Plan**: Free
4. **Variables de entorno** (en Render): ninguna requerida
5. Copia la URL que te da Render: `https://autocontrol-api.onrender.com`

---

### 2. Frontend — React en Vercel

#### Subir código a GitHub
```bash
cd vehicle-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/autocontrol-frontend.git
git push -u origin main
```

#### Desplegar en Vercel
1. Ve a https://vercel.com → New Project
2. Importa tu repositorio de GitHub
3. **Framework Preset**: Vite (detecta automáticamente)
4. **Variables de entorno**:
   ```
   VITE_POCKETBASE_URL=https://autocontrol-api.onrender.com
   ```
5. Click en **Deploy** → en ~2 min tendrás tu URL

---

### 3. Anti-sleep — UptimeRobot

El plan gratuito de Render duerme el servidor si no hay tráfico en 15 minutos. UptimeRobot lo mantiene despierto.

1. Ve a https://uptimerobot.com → Sign up (gratis)
2. New Monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: AutoControl API
   - **URL**: `https://autocontrol-api.onrender.com/api/health`
   - **Monitoring Interval**: Every 5 minutes
3. ¡Listo! Tu backend nunca dormirá.

---

## 💻 Desarrollo local

```bash
# Instalar dependencias
npm install

# Asegúrate de tener PocketBase corriendo en local
# ./pocketbase serve

# Copiar variables de entorno
cp .env.example .env
# Edita .env: VITE_POCKETBASE_URL=http://127.0.0.1:8090

# Iniciar desarrollo
npm run dev
```

## Colecciones PocketBase requeridas

| Colección | Campos principales |
|---|---|
| `users` | email, name, password (auth) |
| `vehicles` | user, plate_number, manufacture_year, soat_expiry, tech_review_last, tech_review_next, extinguisher_renewal, air_pressure, current_mileage, next_mileage |
| `maintenance` | vehicle, type, date, performed_by, location, services (JSON), current_mileage, next_mileage, notes |
| `observations` | user, content, resolved, resolved_at |
| `reminders` | user, vehicle, type, due_date, status, days_before |

## Reglas de API en PocketBase

En el panel admin de PocketBase (`/_/`), asegúrate de configurar las reglas:
- **List/View/Create/Update/Delete**: `@request.auth.id != ""`
- Para vehicles/maintenance/observations: agrega `user = @request.auth.id` o `vehicle.user = @request.auth.id`
