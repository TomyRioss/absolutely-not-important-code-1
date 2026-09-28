import Link from "next/link";
import { signOut } from "@/lib/auth";

export function PlatformAdminShell({ children, name, email }: { children: React.ReactNode; name: string; email: string }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-8">
        <Link className="text-xl font-bold tracking-tight text-primary" href="/dashboard/admin">
          PlatoRest <span className="text-sm font-medium text-text-secondary">/ Plataforma</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <div className="hidden text-right sm:block">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-text-secondary">{email}</p>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="min-h-10 rounded-md border border-border px-3 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="submit">Salir</button>
          </form>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
