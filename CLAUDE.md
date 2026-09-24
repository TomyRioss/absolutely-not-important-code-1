@AGENTS.md

Cuenta de testing: `docs/CREDENTIALS.md` (archivo ignorado por Git).

# Reglas de proyecto

## Modo comunicación
- Usar siempre skill `/caveman ultra` (respuestas comprimidas, sustancia técnica intacta).

## Errores y feedback
- Todo error debe catchearse. Loguear en consola Y dar feedback visual (UX/UI) correspondiente al usuario.

## Librerías y componentes
- Antes de escribir lógica/UI custom, investigar si existe librería de terceros que resuelva el problema. Plantear opción antes de implementar.
- Usar shadcn para componentes prefabricados generales.
- Usar TailwindCSS para todo el CSS. Nunca CSS puro. Nunca tocar `global.css`.

## Imágenes
- Toda imagen del proyecto se guarda en Supabase Storage. Nunca persistir base64 en DB ni en `src` de imágenes. Subir a bucket, guardar solo la URL pública.

## Base de datos
- Nunca tocar DB/Prisma sin permiso explícito del usuario en ese mensaje puntual (regla ya en CLAUDE.md global, se reafirma acá).
- Para tareas de DB, usar skill `supabase/agent-skills` + MCP Supabase, modelo Sonnet.

## Diseño
- Siempre responsive (mobile + desktop).
- Metodología MVC, componentes modulares.
- Ningún componente mayor a 500 líneas — modularizar si se excede.

## Investigación
- Para problemas desconocidos, buscar en internet/redes (Stack Overflow, Reddit, etc.) antes de improvisar.

## Skills por tarea
- Testing/browser: skill Playwright, modelo Haiku, minimizar tokens (combinar con `/caveman ultra` en Haiku).
- Code review/auditoría: skills `code-simplifier` y `code-review`, modelo Haiku.
- Commits/GitHub: skills `commit-commands` y MCP GitHub.
- Componentes y diseño: skill `frontend-design`, `superpowers` (brainstorming para pensar diseños), `ui-ux-pro-max`, `expo-design`.
