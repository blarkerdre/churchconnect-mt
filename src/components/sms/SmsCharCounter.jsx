import { smsSegments } from "@/lib/sms-segments";

export default function SmsCharCounter({ text }) {
  const { length, unicode, single, segments } = smsSegments(text || "");
  const near = segments <= 1 && length >= single - 20;
  const over = segments > 1;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between text-muted-foreground">
        <span>{length} / {single} characters{unicode ? " (special characters used - 70 per text)" : ""}</span>
        <span className={over ? "text-destructive font-medium" : ""}>{segments || 0} text{segments === 1 ? "" : "s"}</span>
      </div>
      {near && !over && (
        <p className="rounded bg-accent/20 px-2 py-1 text-accent-foreground">Nearly 2 texts - keep under {single} characters to send as one.</p>
      )}
      {over && (
        <p className="rounded bg-destructive/10 px-2 py-1 text-destructive">This will send as {segments} texts per person (costs {segments}x).</p>
      )}
    </div>
  );
}
