import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, ListChecks } from "lucide-react";

const Attendance = lazy(() => import("@/pages/Attendance"));
const UnitTasks = lazy(() => import("@/pages/UnitTasks"));

function Fallback() {
  return (
    <div className="min-h-[30vh] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

export default function ChurchUnit() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "tasks" ? "tasks" : "attendance";

  const handleChange = (value) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Church Unit</h1>
      </div>

      <Tabs value={tab} onValueChange={handleChange} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
            <span className="sm:hidden">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListChecks className="h-4 w-4" />
            <span>Unit Tasks</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Suspense fallback={<Fallback />}>
            <Attendance />
          </Suspense>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <Suspense fallback={<Fallback />}>
            <UnitTasks />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
