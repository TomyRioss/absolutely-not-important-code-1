import { HiWallet } from "react-icons/hi2";

export const dynamic = "force-dynamic";

export default function TarjetaFidelizacionPage() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
      <HiWallet className="h-8 w-8 text-text-secondary" />
      <p className="text-sm text-text-secondary">Tu tarjeta de fidelización en Google Wallet llega pronto.</p>
    </div>
  );
}
