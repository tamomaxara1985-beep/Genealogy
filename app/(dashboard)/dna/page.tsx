import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DnaPage() {
  const [tNav, t] = await Promise.all([
    getTranslations("nav"),
    getTranslations("dna"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{tNav("dna")}</h1>
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-lg">{t("gedcomTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("gedcomDesc")}
        </CardContent>
      </Card>
    </div>
  );
}
