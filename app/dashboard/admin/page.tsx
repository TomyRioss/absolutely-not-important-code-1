import { requirePlatformAdmin, getPlatformSnapshot } from "@/lib/platform-admin";
import { PlatformOverview } from "./platform-overview";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const snapshot = await getPlatformSnapshot();
  return <PlatformOverview initialSnapshot={snapshot} />;
}
