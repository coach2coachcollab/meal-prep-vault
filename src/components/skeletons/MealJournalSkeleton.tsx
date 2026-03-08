import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function MealJournalSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Macro summary bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meal type sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-12" />
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Daily note */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
