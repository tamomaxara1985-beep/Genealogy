declare module "culori" {
  export interface Color {
    mode: string;
    [key: string]: string | number | boolean | undefined;
  }

  export interface Oklch extends Color {
    mode: "oklch";
    l: number;
    c: number;
    h: number;
    alpha?: number;
  }

  export function parse(input: string): Color | undefined;
  export function oklch(color: Color): Oklch | undefined;
  export function formatCss(color: Color): string;
  export function formatHex(color: Color): string | undefined;
}
