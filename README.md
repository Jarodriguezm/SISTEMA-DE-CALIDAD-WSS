# WSS Sistema de Calidad — Portal Web

Portal moderno para World Survey Services S.A., División Inspección Industrial.
Stack: React 18 + Vite + Supabase + Vercel

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales Supabase

# 3. Correr en desarrollo
npm run dev
```

## Variables de entorno requeridas

```env
VITE_SUPABASE_URL=https://labxvesmcfbrdtftkwtg.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

## Deploy en Vercel

1. Sube el proyecto a GitHub (sin el archivo .env)
2. Conecta el repo en vercel.com
3. En Vercel → Settings → Environment Variables, agrega:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
4. Deploy automático

## Estructura del proyecto

```
src/
├── lib/
│   ├── supabase.js      # Cliente Supabase + helpers
│   └── AuthContext.jsx  # Context de autenticación global
├── pages/
│   ├── Login.jsx        # Pantalla de acceso
│   ├── Dashboard.jsx    # KPIs y acceso rápido
│   └── OTs.jsx          # Listado de órdenes de trabajo
├── components/
│   └── layout/
│       └── Layout.jsx   # Sidebar + Header + shell
└── styles/
    └── global.css       # Variables y estilos globales WSS
```

## Fases del proyecto

- [x] Fase 1: Scaffolding + Supabase client + Login + Layout + Dashboard + OTs
- [ ] Fase 2: Detalle OT + Crear OT + Módulos internos
- [ ] Fase 3: Asignaciones, Actas, Reservas ESI/EAI
- [ ] Fase 4: Auditoría + Administración
- [ ] Fase 5: Seguridad RLS + hardening
- [ ] Fase 6: Cutover desde Apps Script
