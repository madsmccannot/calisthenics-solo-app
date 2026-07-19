// Central visual system. Before these constants, colors were copied by hand
// across every screen. New UI should use this to keep visual consistency.

export const colors = {
  // surfaces
  bg: '#0f0f0f',
  card: '#1e1e1e',
  cardInner: '#2a2a2a',
  border: '#333333',
  borderLight: '#444444',

  // accents
  primary: '#4ade80', // main green
  orange: '#f97316', // HIIT / streak / today
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e', // recovery
  gold: '#fbbf24', // XP / coins / level
  purple: '#a78bfa', // titles / rarity
  bronze: '#cd7f32', // bronze medal tier
  silver: '#cbd5e1', // silver medal tier

  // text
  text: '#ffffff',
  textMuted: '#aaaaaa',
  textFaint: '#666666',
  textDim: '#555555',
  onPrimary: '#000000', // text on green buttons

  overlay: 'rgba(0,0,0,0.75)',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  round: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Color associated with the workout type (used in Dashboard and workout engine).
export function typeColor(type) {
  switch (type) {
    case 'HIIT':
      return colors.orange;
    case 'Strength':
      return colors.blue;
    case 'Recovery':
      return colors.green;
    default:
      return colors.textMuted;
  }
}
