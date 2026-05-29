import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Trees</h1>
        <Button asChild>
          <Link href="/trees/new">New Tree</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-2 flex items-center justify-center min-h-40 cursor-pointer hover:border-amber-400">
          <CardContent className="text-center pt-6">
            <p className="text-muted-foreground">+ Create your first tree</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
