export const CHART_COLOR_TOKENS = [
  '--bs-primary',
  '--bs-secondary',
  '--bs-success',
  '--bs-danger',
  '--bs-warning',
  '--bs-info',
];

export function themeColors(styles: CSSStyleDeclaration): string[] {
  return CHART_COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
}

export function bodyColor(styles: CSSStyleDeclaration): string {
  return styles.getPropertyValue('--bs-body-color').trim();
}

// A single-slot, signature-keyed cache: setting a new signature discards whatever was cached for
// any other signature. Used by chart widgets whose `data` @Input is reset on every gridstack
// load()/live-polling tick even when nothing visibly changed - returning the SAME cached object
// reference for an unchanged signature stops ng2-charts' ngOnChanges-driven redraw from firing.
export function memoizeBySignature<TResult>(): {
  get: (signature: string) => TResult | undefined;
  set: (signature: string, value: TResult) => void;
} {
  let cachedSignature: string | null = null;
  let cachedValue: TResult | null = null;

  return {
    get: (signature: string) =>
      cachedSignature === signature ? (cachedValue as TResult) : undefined,
    set: (signature: string, value: TResult) => {
      cachedSignature = signature;
      cachedValue = value;
    },
  };
}
