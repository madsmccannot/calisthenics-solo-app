// Catálogo da loja / aparência. Itens comprados com moedas ficam em `ownedItems`;
// equipar aplica ao avatar (um item por slot). Itens `cost: 0` já vêm
// desbloqueados por defeito.

// Slots do avatar (ordem de apresentação na loja).
export const CATEGORIES = [
  { slot: 'skin', label: 'Cor', kind: 'color' },
  { slot: 'hair', label: 'Cabelo', kind: 'style' },
  { slot: 'band', label: 'Faixa', kind: 'color' },
  { slot: 'gloves', label: 'Luvas', kind: 'color' },
  { slot: 'frame', label: 'Moldura', kind: 'color' },
  { slot: 'theme', label: 'Tema', kind: 'color' },
];

export const SHOP_ITEMS = [
  // cor do corpo
  { id: 'skin_green', slot: 'skin', name: 'Verde', cost: 0, value: '#4ade80' },
  { id: 'skin_blue', slot: 'skin', name: 'Azul', cost: 150, value: '#3b82f6' },
  { id: 'skin_orange', slot: 'skin', name: 'Laranja', cost: 150, value: '#f97316' },
  { id: 'skin_purple', slot: 'skin', name: 'Roxo', cost: 300, value: '#a78bfa' },
  { id: 'skin_gold', slot: 'skin', name: 'Ouro', cost: 500, value: '#fbbf24' },

  // cabelo (estilo, cor fixa escura)
  { id: 'hair_none', slot: 'hair', name: 'Careca', cost: 0, value: 'none' },
  { id: 'hair_short', slot: 'hair', name: 'Curto', cost: 100, value: 'short' },
  { id: 'hair_mohawk', slot: 'hair', name: 'Moicano', cost: 250, value: 'mohawk' },

  // faixa
  { id: 'band_none', slot: 'band', name: 'Nenhuma', cost: 0, value: 'none' },
  { id: 'band_red', slot: 'band', name: 'Vermelha', cost: 120, value: '#ef4444' },
  { id: 'band_white', slot: 'band', name: 'Branca', cost: 120, value: '#ffffff' },
  { id: 'band_gold', slot: 'band', name: 'Dourada', cost: 300, value: '#fbbf24' },

  // luvas
  { id: 'gloves_none', slot: 'gloves', name: 'Nenhumas', cost: 0, value: 'none' },
  { id: 'gloves_black', slot: 'gloves', name: 'Pretas', cost: 150, value: '#1f2937' },
  { id: 'gloves_red', slot: 'gloves', name: 'Vermelhas', cost: 150, value: '#ef4444' },

  // moldura (anel à volta do avatar)
  { id: 'frame_none', slot: 'frame', name: 'Nenhuma', cost: 0, value: 'none' },
  { id: 'frame_bronze', slot: 'frame', name: 'Bronze', cost: 200, value: '#cd7f32' },
  { id: 'frame_silver', slot: 'frame', name: 'Prata', cost: 350, value: '#cbd5e1' },
  { id: 'frame_gold', slot: 'frame', name: 'Ouro', cost: 600, value: '#fbbf24' },

  // tema (fundo do avatar)
  { id: 'theme_dark', slot: 'theme', name: 'Escuro', cost: 0, value: '#141414' },
  { id: 'theme_night', slot: 'theme', name: 'Noite', cost: 200, value: '#12203a' },
  { id: 'theme_ember', slot: 'theme', name: 'Brasa', cost: 200, value: '#2a1410' },
];

export const SLOTS = CATEGORIES.map((c) => c.slot);

export const DEFAULT_OWNED = SHOP_ITEMS.filter((i) => i.cost === 0).map((i) => i.id);

export function getItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export function itemsBySlot(slot) {
  return SHOP_ITEMS.filter((i) => i.slot === slot);
}

export function defaultItemForSlot(slot) {
  return SHOP_ITEMS.find((i) => i.slot === slot && i.cost === 0)?.id;
}

// Converte o estado do avatar (ids por slot) nos valores usados para desenhar.
export function resolveAvatar(avatar = {}) {
  const val = (id) => getItem(id)?.value;
  const opt = (id) => {
    const v = val(id);
    return v && v !== 'none' ? v : null;
  };
  return {
    skin: val(avatar.skin) || '#4ade80',
    hair: val(avatar.hair) || 'none',
    band: opt(avatar.band),
    gloves: opt(avatar.gloves),
    frame: opt(avatar.frame),
    theme: val(avatar.theme) || '#141414',
  };
}
