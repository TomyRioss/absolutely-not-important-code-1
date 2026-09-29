import { PaymentReturn } from "./payment-return";

export default async function PaymentReturnPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <PaymentReturn rejected={status === "rejected"} />;
}
