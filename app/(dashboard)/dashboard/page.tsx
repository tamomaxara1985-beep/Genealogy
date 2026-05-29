"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTrees } from "@/hooks/useTrees";

export default function DashboardPage() {
  const router = useRouter();
  const { trees, isLoading, mutate } = useTrees();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTree(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const tree = await res.json();
      await mutate();
      setShowForm(false);
      setName("");
      router.push(`/trees/${tree._id}`);
    }
    setCreating(false);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Trees</h1>
        <Button onClick={() => setShowForm(true)}>+ New Tree</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create a tree</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTree} className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="treeName">Tree name</Label>
                <Input
                  id="treeName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Smith Family Tree"
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-muted-foreground">Loading your trees…</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trees.map((tree) => (
          <Card
            key={tree._id}
            className="cursor-pointer hover:border-amber-400 transition-colors"
            onClick={() => router.push(`/trees/${tree._id}`)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{tree.name}</CardTitle>
            </CardHeader>
            {tree.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {tree.description}
                </p>
              </CardContent>
            )}
          </Card>
        ))}

        {!isLoading && trees.length === 0 && (
          <Card
            className="border-dashed border-2 flex items-center justify-center min-h-40 cursor-pointer hover:border-amber-400"
            onClick={() => setShowForm(true)}
          >
            <CardContent className="text-center pt-6">
              <p className="text-muted-foreground">+ Create your first tree</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
