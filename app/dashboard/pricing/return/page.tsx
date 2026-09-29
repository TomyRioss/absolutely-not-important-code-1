import { PaymentReturn } from "./payment-return";

export default async function PaymentReturnPage({ searchParams }: {
  searchParams: Promise<{ status?: string; checkout?: string }>;
}) {
  const { status, checkout } = await searchParams;
  return <PaymentReturn rejected={status === "rejected"} checkout={checkout} />;
}
