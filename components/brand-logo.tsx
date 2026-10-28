import Image from "next/image";

export function BrandLogo({ className }: { className: string }) {
  return (
    <Image
      src="/platorest-brand.png"
      alt="PlatoRest"
      width={2079}
      height={756}
      unoptimized
      className={className}
    />
  );
}
