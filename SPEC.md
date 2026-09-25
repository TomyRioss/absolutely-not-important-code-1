# SPEC.md — PlatoRest

## §G Goal
MVP gestion restaurant: fidelizacion + inventario simple + POS liviano + sitio web delivery. Demostrable, no completo.

## §C Constraints
- Next.js 14+ App Router, Server Components default, Server Actions for mutations
- TS strict:true, no `any` w/o justif comment
- Prisma ORM
- Supabase: Postgres + Storage (product imgs). Auth: NextAuth (not Supabase Auth, amended)
- Tailwind, tokens not hardcoded colors
- Deploy target: Vercel
- Design: flat, no gradients/heavy shadows, sans-serif/Inter, mobile-first
- Palette tokens (Tailwind config):
  - background #FFFFFF, surface #FAFAFA, border #E5E5E5
  - primary #FF6B00, primary-hover #CC5600, primary-light #FFE4CC
  - text-primary #1C1917, text-secondary #78716C
  - success #16A34A, danger #DC2626
- Build order: schema+Supabase conn -> menu publico -> POS -> admin panel. Each step functional+tested before next.
- Anything "fuera de scope" added because required for dependency must be flagged w/ reason.

## §I External surfaces
- I.db: Postgres via Supabase, Prisma schema (see below)
- I.auth: NextAuth (credentials provider), admin routes gated
- I.storage: Supabase Storage, product images
- I.pay: cash checkout; Pro billing pending Rebill integration
- I.geo: Nominatim/OSM geocoding (free, no key) for delivery radius validation (V6). Restaurant gained lat/lng fields (flagged dependency, not in original model)
- I.routes:
  - / (landing page)
  - /funcionalidades (marketing)
  - /precios (marketing)
  - /testimonios (marketing)
  - /vision-mision (marketing)
  - /menu/[restaurantSlug] (public menu)
  - /checkout
  - /admin (dashboard, auth required)
  - /admin/pos
  - /admin/inventario
  - /admin/clientes
  - /admin/pedidos

## §V Invariants
V1: no `any` in TS w/o inline justif comment
V2: colors only via Tailwind tokens, never hardcoded hex in components
V3: order total = sum(orderItem.qty * unitPrice), server-computed not client-trusted
V4: stock auto-decrements on order CONFIRMED/completion, never goes negative (validate before commit)
V5: loyaltyPoints only awarded on completed paid order
V6: delivery order requires deliveryAddress within restaurant.deliveryRadiusKm (server-validated)
V7: /admin/* routes require NextAuth session, redirect if absent
V8: fuera-of-scope features (mesas, KDS, gift cards, marketplace integrations, etc) never implemented unless flagged+approved as dependency
V9: any secret/hash value in .env* files containing literal `$` must escape it as `\$` (Next's dotenv-expand strips unescaped `$var` patterns)

## §T Tasks
id|status|desc|cites
T1|x|Prisma schema (Restaurant,Product,Customer,Order,OrderItem,enums) + migrate|V1
T2|x|Supabase project conn, env vars, Prisma client singleton|I.db
T3|x|Tailwind config w/ color tokens (§C palette)|V2
T4|x|NextAuth setup (admin login, credentials)|I.auth,V7
T5|x|Public menu page /menu/[restaurantSlug], list active products|I.routes
T6|x|Checkout flow /checkout: cart, pickup/delivery, radius validation, cash payment|V6,I.pay
T7|x|POS screen /admin/pos: manual order entry, cash payment, simple receipt (no fiscal invoice)|V3,I.routes
T8|x|Inventory /admin/inventario: stock CRUD, low-stock alert, auto-decrement on order|V4
T9|x|Customers/loyalty /admin/clientes: customer by phone/email, points on purchase, order history|V5
T10|x|Orders panel /admin/pedidos: list/status updates across POS+WEB source|I.routes
T11|x|Deploy config for Vercel (env, build)|§C

## §B Bugs
id|date|cause|fix
B1|2026-07-06|Next.js env loader (dotenv-expand) treats `$` in .env values as var refs, silently emptied ADMIN_PASSWORD_HASH (bcrypt hash contains `$`)|escape as `\$` in .env files; see V9
