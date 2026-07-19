// Shop / appearance catalog. Items bought with coins go into `ownedItems`;
// equipping applies to the avatar (one item per slot). `cost: 0` items are
// unlocked by default.
// NOTE: the shop is a placeholder (to be redesigned for real monetization),
// so item names are kept in English for now; slot labels are translated by the
// UI via locker.slot.<slot>. The `label` fields here are unused.

// Avatar slots (order shown in the shop).
export const CATEGORIES = [
  { slot: 'skin', label: 'Color', kind: 'color' },
  { slot: 'hair', label: 'Hair', kind: 'style' },
  { slot: 'band', label: 'Headband', kind: 'color' },
  { slot: 'gloves', label: 'Gloves', kind: 'color' },
  { slot: 'frame', label: 'Frame', kind: 'color' },
  { slot: 'theme', label: 'Theme', kind: 'color' },
];

export const SHOP_ITEMS = [
  // body color
  { id: 'skin_green', slot: 'skin', name: 'Green', cost: 0, value: '#4ade80' },
  { id: 'skin_blue', slot: 'skin', name: 'Blue', cost: 150, value: '#3b82f6' },
  { id: 'skin_orange', slot: 'skin', name: 'Orange', cost: 150, value: '#f97316' },
  { id: 'skin_purple', slot: 'skin', name: 'Purple', cost: 300, value: '#a78bfa' },
  { id: 'skin_gold', slot: 'skin', name: 'Gold', cost: 500, value: '#fbbf24' },

  // hair (style, fixed dark color)
  { id: 'hair_none', slot: 'hair', name: 'Bald', cost: 0, value: 'none' },
  { id: 'hair_short', slot: 'hair', name: 'Short', cost: 100, value: 'short' },
  { id: 'hair_mohawk', slot: 'hair', name: 'Mohawk', cost: 250, value: 'mohawk' },

  // headband
  { id: 'band_none', slot: 'band', name: 'None', cost: 0, value: 'none' },
  { id: 'band_red', slot: 'band', name: 'Red', cost: 120, value: '#ef4444' },
  { id: 'band_white', slot: 'band', name: 'White', cost: 120, value: '#ffffff' },
  { id: 'band_gold', slot: 'band', name: 'Golden', cost: 300, value: '#fbbf24' },

  // gloves
  { id: 'gloves_none', slot: 'gloves', name: 'None', cost: 0, value: 'none' },
  { id: 'gloves_black', slot: 'gloves', name: 'Black', cost: 150, value: '#1f2937' },
  { id: 'gloves_red', slot: 'gloves', name: 'Red', cost: 150, value: '#ef4444' },

  // frame (ring around the avatar)
  { id: 'frame_none', slot: 'frame', name: 'None', cost: 0, value: 'none' },
  { id: 'frame_bronze', slot: 'frame', name: 'Bronze', cost: 200, value: '#cd7f32' },
  { id: 'frame_silver', slot: 'frame', name: 'Silver', cost: 350, value: '#cbd5e1' },
  { id: 'frame_gold', slot: 'frame', name: 'Gold', cost: 600, value: '#fbbf24' },

  // theme (avatar background)
  { id: 'theme_dark', slot: 'theme', name: 'Dark', cost: 0, value: '#141414' },
  { id: 'theme_night', slot: 'theme', name: 'Night', cost: 200, value: '#12203a' },
  { id: 'theme_ember', slot: 'theme', name: 'Ember', cost: 200, value: '#2a1410' },
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

// Turns the avatar state (ids per slot) into the values used to draw it.
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
