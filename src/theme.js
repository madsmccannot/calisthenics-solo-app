// Sistema visual central da app. Antes destas constantes, as cores estavam
// copiadas à mão em todos os ecrãs. Todo o UI novo (gamificação) deve usar isto
// para manter a coerência visual; os ecrãs antigos migram aos poucos.

export const colors = {
  // superfícies
  bg: '#0f0f0f',
  card: '#1e1e1e',
  cardInner: '#2a2a2a',
  border: '#333333',
  borderLight: '#444444',

  // acentos
  primary: '#4ade80', // verde principal
  orange: '#f97316', // HIIT / streak / hoje
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e', // recovery
  gold: '#fbbf24', // XP / moedas / nível
  purple: '#a78bfa', // títulos / raridade
  bronze: '#cd7f32', // medalha tier bronze
  silver: '#cbd5e1', // medalha tier prata

  // texto
  text: '#ffffff',
  textMuted: '#aaaaaa',
  textFaint: '#666666',
  textDim: '#555555',
  onPrimary: '#000000', // texto sobre botões verdes

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

// cor associada ao tipo de treino (usada no Dashboard e no motor de treino)
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
