import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DnaPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">DNA Matches</h1>
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-lg">GEDCOM Import — Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Upload a GEDCOM file to import your family tree and find DNA matches.
          This feature is in development.
        </CardContent>
      </Card>
    </div>
  );
}
