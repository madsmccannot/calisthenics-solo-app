import React from 'react';
import Svg, { Rect, Circle, Path, G } from 'react-native-svg';
import { resolveAvatar } from '../config/shopCatalog';

const HAIR_COLOR = '#241a15';

// Desenha o avatar por camadas a partir do estado equipado (ids por slot).
// `avatar` é o objeto { skin, hair, band, gloves, frame, theme } com ids.
export default function Avatar({ avatar, size = 150 }) {
  const a = resolveAvatar(avatar || {});
  const w = size;
  const h = size * 1.2;

  // tom mais escuro do corpo para dar volume (torso/pernas)
  const bodyDark = shade(a.skin, -0.15);

  return (
    <Svg width={w} height={h} viewBox="0 0 100 120">
      {/* fundo (tema) */}
      <Rect x="0" y="0" width="100" height="120" rx="16" fill={a.theme} />

      {/* moldura */}
      {a.frame && (
        <Rect x="3" y="3" width="94" height="114" rx="14" fill="none" stroke={a.frame} strokeWidth="4" />
      )}

      {/* pernas */}
      <Rect x="39" y="88" width="9" height="24" rx="4" fill={bodyDark} />
      <Rect x="52" y="88" width="9" height="24" rx="4" fill={bodyDark} />

      {/* braços */}
      <Rect x="21" y="52" width="10" height="34" rx="5" fill={a.skin} />
      <Rect x="69" y="52" width="10" height="34" rx="5" fill={a.skin} />

      {/* mãos / luvas */}
      <Circle cx="26" cy="87" r="7" fill={a.gloves || a.skin} />
      <Circle cx="74" cy="87" r="7" fill={a.gloves || a.skin} />

      {/* torso */}
      <Rect x="33" y="50" width="34" height="42" rx="12" fill={a.skin} />

      {/* cabeça */}
      <Circle cx="50" cy="32" r="18" fill={a.skin} />

      {/* olhos */}
      <Circle cx="44" cy="32" r="2.4" fill="#0f0f0f" />
      <Circle cx="56" cy="32" r="2.4" fill="#0f0f0f" />

      {/* faixa (por cima da testa) */}
      {a.band && <Rect x="31.5" y="24" width="37" height="6" rx="2" fill={a.band} />}

      {/* cabelo (por cima do topo da cabeça) */}
      {a.hair === 'short' && (
        <Path d="M33 26 Q50 6 67 26 Q50 18 33 26 Z" fill={HAIR_COLOR} />
      )}
      {a.hair === 'mohawk' && (
        <G>
          <Path d="M46 26 Q50 4 54 26 Z" fill={HAIR_COLOR} />
          <Rect x="47.5" y="10" width="5" height="16" rx="2" fill={HAIR_COLOR} />
        </G>
      )}
    </Svg>
  );
}

// Escurece/clareia uma cor hex por um fator (-1..1). Simples, para volume.
function shade(hex, factor) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return hex;
  const adj = (c) => {
    const v = Math.round(parseInt(c, 16) * (1 + factor));
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };
  return `#${adj(m[1])}${adj(m[2])}${adj(m[3])}`;
}
