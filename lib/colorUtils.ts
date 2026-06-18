import { formatCss, formatHex, oklch, parse } from "culori"

export function hexToOklch(hex: string): string {
  const color = parse(hex)
  if (!color) return hex
  const converted = oklch(color)
  if (!converted) return hex
  return formatCss(converted)
}

export function oklchToHex(oklchStr: string): string {
  const color = parse(oklchStr)
  if (!color) return "#000000"
  return formatHex(color) ?? "#000000"
}
