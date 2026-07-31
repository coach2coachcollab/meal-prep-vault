import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>

      {/* Macro Ring Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>

      {/* Habits & Water */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      </div>

      {/* Daily Tip */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

export function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <DashboardSkeleton />
      </main>
      {/* Bottom nav skeleton */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card safe-area-bottom">
        <div className="max-w-4xl mx-auto flex justify-around py-2 px-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
