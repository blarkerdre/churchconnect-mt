import { getEnvironmentLabel } from "@/lib/environment";

export default function EnvironmentBadge() {
  const label = getEnvironmentLabel();
  const isTest = label === "Test";

  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        isTest
          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      }`}
    >
      {label}
    </span>
  );
}
