# CivicSurge — Smart City Emergency Volunteer Mobilization

> Built for PickHacks 2026 · Theme: Smart Cities

CivicSurge mobilizes pre-registered volunteers to emergencies in real-time. IoT sensors auto-trigger events, a smart matching engine assigns the right people, and Socket.io delivers instant coordination across admin dashboard, volunteer app, and public live map.

---

## Full Demo Setup Guide

### Step 1 — Install Dependencies

```bash
cd civicsurge
npm install
```

---

### Step 2 — Set Up PostgreSQL Database

**Option A: Neon (Recommended — Free, instant setup)**
1. Go to [neon.tech](https://neon.tech) → Create account → New Project
2. Copy the **Connection String** (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)

**Option B: Supabase**
1. Go to [supabase.com](https://supabase.com) → New Project
2. Settings → Database → Copy **Connection string** (Transaction mode, port 6543)

**Option C: Local PostgreSQL**
```bash
createdb civicsurge
# Connection string: postgresql://localhost:5432/civicsurge
```

---

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL=postgresql://your-connection-string-here
NEXTAUTH_SECRET=any-random-32-character-string-here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — Twilio SMS (app works fully without these)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# MQTT (default is fine for demo)
MQTT_BROKER_URL=mqtt://test.mosquitto.org:1883
```

Generate a NEXTAUTH_SECRET quickly:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 4 — Run Database Migration & Seed

```bash
# Push schema to database
npm run db:push

# Seed with 5 zones + 1 admin + 20 volunteers
npm run db:seed
```

You should see:
```
✅ Seed complete!
════════════════════════════════════════════
  Admin Login:     admin@civicsurge.com
  Admin Password:  admin123
  Volunteer Login: alex.rivera@volunteer.civicsurge.com
  Volunteer Password: volunteer123
════════════════════════════════════════════
```

---

### Step 5 — Start the Dev Server

```bash
npm run dev
```

Opens at **http://localhost:3000**

The custom server starts Next.js + Socket.io + MQTT subscriber all in one process.

---

## Full Demo Flow

### Demo 1: Manual Admin Surge

1. **Open** http://localhost:3000/dashboard/admin (log in as admin)
2. **Open** in another tab: http://localhost:3000/dashboard/volunteer
   (log in as `alex.rivera@volunteer.civicsurge.com` / `volunteer123`)
3. In admin dashboard → **Declare Event** tab:
   - Title: "Flash Flood — Downtown Corridor"
   - Type: FLOOD, Severity: 4
   - Zone Need: Zone 1 — Downtown, Skills: Flood Control + First Aid, Headcount: 3
   - Click **🚨 DECLARE & MOBILIZE**
4. **Watch**: Volunteer dashboard shows alert card instantly (Socket.io)
5. On volunteer tab: click **✅ ACCEPT**
6. **Watch**: Admin map updates, deployment feed shows "Accepted"
7. **Try declining**: Open another volunteer account, click ❌ DECLINE — backfill logic runs automatically

---

### Demo 2: IoT Auto-Trigger (No Admin Action Required)

1. In admin dashboard → **IoT Sensors** tab
2. Find **Wind Speed** sensor
3. Drag slider above 95 mph OR click the 🚨 button
4. **Watch everything happen automatically**:
   - Server creates TORNADO surge event
   - Matching engine runs
   - Volunteers get notified
   - Live map updates with zone overlay
   - Stats bar refreshes
5. Check the volunteer dashboard — alert appears with "IoT Triggered" badge

---

### Demo 3: Standalone IoT Script

In a separate terminal:
```bash
npm run iot:simulate
```

Runs a live ASCII dashboard showing sensor values escalating. After ~30-60 seconds, a dominant sensor crosses its threshold and triggers the full auto-response pipeline via MQTT → API → matching engine → Socket.io.

---

### Demo 4: Public Map

Open **http://localhost:3000/map** — no login required.

Shows the live city dashboard with colored zone overlays, volunteer markers, and event status in real time.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Custom Node Server                    │
│  server.ts: Next.js + Socket.io + MQTT subscriber        │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
    ┌──────▼──────┐      ┌────────▼────────┐
    │  Socket.io  │      │  MQTT Subscriber │
    │  Real-time  │      │  civicsurge/     │
    │  updates    │      │  sensors/#       │
    └──────┬──────┘      └────────┬────────┘
           │                      │
    ┌──────▼──────────────────────▼────────────────────┐
    │                 Next.js App Router                │
    │  /api/surge-events   → create events              │
    │  /api/surge-events/[id]/mobilize → match engine  │
    │  /api/sensors/reading → IoT thresholds           │
    │  /api/deployments/[id]/respond → accept/decline  │
    └──────────────────────┬───────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────────────┐
    │              Matching Engine                       │
    │  1. Query available volunteers                     │
    │  2. Score by zone + distance + skill overlap       │
    │  3. Create Deployment records                      │
    │  4. Send SMS via Twilio (optional)                 │
    │  5. Emit surge:mobilized via Socket.io             │
    └──────────────────────┬────────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────────────┐
    │              PostgreSQL (Prisma ORM)               │
    │  Users, Volunteers, Zones, SurgeEvents,            │
    │  Deployments, ZoneNeeds, SensorReadings            │
    └───────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, React, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (route handlers) |
| Real-time | Socket.io (custom server) |
| Database | PostgreSQL + Prisma ORM |
| Maps | Leaflet + React-Leaflet (free, no API key) |
| Map Tiles | CartoDB Dark Matter (free) |
| SMS | Twilio (optional) |
| IoT | MQTT.js → test.mosquitto.org |
| Auth | NextAuth.js (credentials + JWT) |

---

## Project Structure

```
civicsurge/
├── server.ts                     # Custom server: Next.js + Socket.io + MQTT
├── prisma/
│   └── schema.prisma             # Database schema
├── scripts/
│   ├── seed.ts                   # Database seeding
│   └── iot-simulator.ts          # Standalone MQTT IoT simulator
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── auth/login/           # Login page
│   │   ├── auth/register/        # Registration (volunteer + admin)
│   │   ├── dashboard/volunteer/  # Volunteer home
│   │   ├── dashboard/admin/      # Admin command center
│   │   ├── map/                  # Public live map
│   │   └── api/                  # All API routes
│   ├── components/
│   │   ├── LiveMap.tsx           # Leaflet map (dark tiles, zone polygons, markers)
│   │   ├── SurgeEventForm.tsx    # Admin declare + mobilize form
│   │   ├── SensorSimulator.tsx   # IoT panel in admin dashboard
│   │   ├── DeploymentFeed.tsx    # Real-time volunteer response feed
│   │   ├── VolunteerAlert.tsx    # Accept/decline mobilization card
│   │   ├── StatsBar.tsx          # Live stats dashboard
│   │   ├── ZoneCard.tsx          # Zone coverage status
│   │   └── SkillBadge.tsx        # Skill tag component
│   ├── lib/
│   │   ├── matching-engine.ts    # Core volunteer matching algorithm
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── socket.ts             # Socket.io client helper
│   │   ├── mqtt.ts               # MQTT subscriber
│   │   └── twilio.ts             # SMS helper
│   └── types/
│       └── index.ts              # Shared TypeScript types + constants
```

---

## Matching Algorithm

When a surge event is mobilized, for each zone need:

```
Score =
  +100 if volunteer is in the exact zone
  +0-50 based on proximity (haversine distance, closer = more)
  +10 per matching skill

Sort by score descending → select top N (headcount)
```

Backfill: if a volunteer declines, the next highest-scored non-deployed volunteer is automatically notified.

---

## Sensor Auto-Trigger Thresholds

| Sensor | Threshold | Triggers |
|--------|-----------|---------|
| water_level | ≥ 80% | FLOOD event |
| wind_speed | ≥ 95 mph | TORNADO event |
| temperature | ≥ 110°F | WILDFIRE event |
| snow_depth | ≥ 24 in | SNOW event |

A cooldown prevents duplicate auto-trigger events within 10 minutes for the same zone + type.

---

## Notes for Vercel Deployment

Socket.io requires persistent connections. For production Vercel deployment, replace Socket.io with:
- [Pusher](https://pusher.com) (free tier available)
- [Ably](https://ably.com)
- [Vercel KV + Server-Sent Events](https://vercel.com/docs/storage/vercel-kv)

For the hackathon demo, the custom server (`npm run dev`) works perfectly on localhost.

---

## Seeded Test Accounts

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@civicsurge.com | admin123 |
| Volunteer | alex.rivera@volunteer.civicsurge.com | volunteer123 |
| Volunteer | jordan.chen@volunteer.civicsurge.com | volunteer123 |
| Volunteer | sam.patel@volunteer.civicsurge.com | volunteer123 |
| *(17 more)* | *\<name\>@volunteer.civicsurge.com* | volunteer123 |
