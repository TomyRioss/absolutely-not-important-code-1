import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TarjetaFidelizacionPage() {
  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <h1 className="mb-4 text-xl font-semibold text-text-primary">Tarjeta de Fidelización</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background py-16 text-center">
        <Wallet className="h-8 w-8 text-text-secondary" />
        <p className="text-sm text-text-secondary">
          Tarjeta virtual en Google Wallet. Próximamente.
        </p>
      </div>
    </main>
  );
}
