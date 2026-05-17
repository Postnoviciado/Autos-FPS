-- ================================================
-- SCHEMA COMPLETO DEL PROYECTO - SUPABASE
-- Solo estructura, sin datos
-- Incluye tablas de public + referencia a auth.users
-- ================================================

-- ------------------------------------------------
-- NOTA PARA IA: Tabla de usuarios
-- La autenticación usa auth.users (esquema interno
-- de Supabase, no editable directamente).
-- Campos relevantes de auth.users:
--   id               uuid PRIMARY KEY
--   email            text
--   created_at       timestamp with time zone
--   updated_at       timestamp with time zone
-- Todas las tablas con user_id uuid hacen
-- REFERENCES auth.users(id)
-- ------------------------------------------------


-- ================================================
-- TABLA: vehicles
-- Vehículos registrados por cada usuario
-- ================================================
CREATE TABLE public.vehicles (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id),
  plate_number        text NOT NULL,
  brand               text,
  model               text,
  manufacture_year    integer NOT NULL,
  soat_expiry         timestamp with time zone,
  tech_review_next    timestamp with time zone,
  air_pressure        integer,
  extinguisher_renewal timestamp with time zone,
  current_mileage     integer NOT NULL,
  next_mileage        integer NOT NULL,
  -- Campos agregados en migración PocketBase
  photo               text,           -- nombre del archivo en storage
  property_card       text,           -- nombre del archivo en storage
  mileage_alert_km    integer,        -- km de anticipación para alerta
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone DEFAULT now(),
  CONSTRAINT vehicles_user_id_plate_number_key UNIQUE (user_id, plate_number)
);


-- ================================================
-- TABLA: maintenance
-- Registros de mantenimiento de cada vehículo
-- ================================================
CREATE TABLE public.maintenance (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('regular', 'additional')),
  date            timestamp with time zone NOT NULL,
  performed_by    text NOT NULL,
  location        text NOT NULL,
  services        text[],             -- array de servicios realizados
  current_mileage integer,
  next_mileage    integer,
  notes           text,
  -- Campos agregados en migración PocketBase
  receipt_photo   text,               -- nombre del archivo en storage
  detail_photo    text,               -- nombre del archivo en storage
  created_at      timestamp with time zone DEFAULT now()
);


-- ================================================
-- TABLA: observations
-- Observaciones o pendientes por usuario
-- ================================================
CREATE TABLE public.observations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  content     text NOT NULL,
  resolved    boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at  timestamp with time zone DEFAULT now()
);


-- ================================================
-- TABLA: reminders
-- Recordatorios de vencimientos por vehículo
-- ================================================
CREATE TABLE public.reminders (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id),
  vehicle_id            uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('soat', 'tech_review', 'mileage', 'extinguisher')),
  due_date              timestamp with time zone NOT NULL,
  days_before           integer NOT NULL,
  status                text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  is_auto               boolean DEFAULT false,
  reminder_key          text,
  notified_thresholds   integer[] DEFAULT '{}',
  last_notified_at      timestamp with time zone,
  created_at            timestamp with time zone DEFAULT now(),
  CONSTRAINT reminders_auto_key_unique UNIQUE (reminder_key) WHERE (is_auto)
);


-- ================================================
-- TABLA: contacts
-- Contactos del usuario (talleres, mecánicos, etc.)
-- NUEVA - agregada en migración PocketBase
-- ================================================
CREATE TABLE public.contacts (
  id                    text PRIMARY KEY DEFAULT substring(gen_random_uuid()::text from 1 for 15),
  user_id               uuid REFERENCES auth.users(id),
  name                  text,
  email                 text,
  phone                 text,
  type                  text CHECK (type IN ('provider', 'workshop', 'mechanic', 'responsable')),
  address               text,
  notes                 text,
  receive_notifications boolean DEFAULT false,
  created_at            timestamp with time zone DEFAULT now(),
  updated_at            timestamp with time zone DEFAULT now()
);


-- ================================================
-- TABLA: reminder_settings
-- Días de anticipación para cada tipo de alerta
-- NUEVA - agregada en migración PocketBase
-- ================================================
CREATE TABLE public.reminder_settings (
  id                  text PRIMARY KEY DEFAULT substring(gen_random_uuid()::text from 1 for 15),
  user_id             uuid REFERENCES auth.users(id) UNIQUE,
  soat_days           text,           -- JSON array e.g. "[15,7,2]"
  tech_review_days    text,           -- JSON array e.g. "[15,7,2]"
  extinguisher_days   text,           -- JSON array e.g. "[15]"
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone DEFAULT now()
);


-- ================================================
-- RESUMEN DE RELACIONES
-- ================================================
-- auth.users (1) ──< vehicles         (user_id)
-- auth.users (1) ──< observations     (user_id)
-- auth.users (1) ──< reminders        (user_id)
-- auth.users (1) ──< contacts         (user_id)
-- auth.users (1) ─── reminder_settings(user_id, único)
-- vehicles   (1) ──< maintenance      (vehicle_id, cascade delete)
-- vehicles   (1) ──< reminders        (vehicle_id, cascade delete)


-- ================================================
-- RESUMEN DE TIPOS DE DATOS USADOS
-- ================================================
-- uuid          → IDs principales (vehicles, maintenance, observations,
--                 reminders)
-- text          → IDs en contacts y reminder_settings (compatibilidad
--                 con PocketBase que usa IDs de 15 chars alfanuméricos)
-- text          → strings en general, nombres de archivos en storage
-- text[]        → arrays: services
-- integer       → números enteros: mileage, años, días, presión
-- boolean       → flags: resolved
-- timestamp with time zone → todas las fechas