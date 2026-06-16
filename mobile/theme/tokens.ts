/** Tokens invariantes entre fantasía y space opera. */
export const tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  touchMin: 48,
  typography: {
    bodySm: 14,
    body: 16,
    bodyLg: 18,
    title: 22,
    display: 32,
    logo: 40,
  },
  frame: {
    cornerSize: 28,
    borderWidth: 2,
  },
  loader: {
    durationMs: 2500,
    ringSize: 120,
    ringStroke: 6,
  },
} as const;
