import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ProgressTrackerSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Goal card */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Photo timeline */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-16 space-y-1">
            <Skeleton className="h-20 w-16 rounded-md" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Log entries */}
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
