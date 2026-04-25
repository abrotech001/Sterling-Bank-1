import { cn } from "@/lib/utils";

export function CrestfieldLogo({
  className,
  size = 36,
  showWordmark = false,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  if (showWordmark) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <img
          src="/logo.png"
          alt="Crestfield Bank"
          width={size}
          height={size}
          className="rounded-lg object-contain"
        />
        <span className="font-bold tracking-tight">Crestfield Bank</span>
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="Crestfield Bank"
      width={size}
      height={size}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}
