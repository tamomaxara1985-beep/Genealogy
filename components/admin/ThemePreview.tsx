import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const FONT_SIZE_MAP: Record<string, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
}

interface ThemePreviewProps {
  primaryColor: string
  fontFamily: string
  fontSize: "sm" | "md" | "lg" | "xl"
  borderRadius: number
}

export function ThemePreview({ primaryColor, fontFamily, fontSize, borderRadius }: ThemePreviewProps) {
  return (
    <div
      style={
        {
          "--primary": primaryColor,
          "--radius": `${borderRadius}rem`,
          fontFamily: `'${fontFamily}', sans-serif`,
          fontSize: FONT_SIZE_MAP[fontSize],
        } as React.CSSProperties
      }
      className="border rounded-xl p-4 bg-background space-y-3"
    >
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</p>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>FamilyRoots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Discover your family history.</p>
          <div className="flex gap-2">
            <Button size="sm">Get Started</Button>
            <Button size="sm" variant="outline">Learn More</Button>
          </div>
          <div className="flex gap-2">
            <Badge>Admin</Badge>
            <Badge variant="secondary">User</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
