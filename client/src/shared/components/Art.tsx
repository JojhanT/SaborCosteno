import { memo, type CSSProperties, type ReactNode } from 'react';

/*
 * Ilustraciones propias en SVG, estilo "sticker" con contorno café como el logo.
 * Todas usan un lienzo de 120 × 120.
 */

const K = '#2A1103'; // contorno café de la marca
const O = '#F38120'; // naranja
const OD = '#D9621A';
const T = '#C96C39'; // terracota
const Y = '#FFC53D';
const YL = '#FFE08A';
const CR = '#FFF1DC';
const W = '#FFFFFF';
const R = '#E0452B';
const G = '#6DB33F';
const GD = '#4E8F2A';
const BR = '#7A3A17';
const BUN = '#E9A04B';
const GOLD = '#EDA83C';
const GOLDD = '#C77A22';
const DK = '#3A1A0A';
const SEA = '#2EC4B6';

const stroke = { stroke: K, strokeWidth: 4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** Línea gruesa con contorno (salsas, pitillos, manijas). */
function Ln({ d, c, w = 5 }: { d: string; c: string; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={K} strokeWidth={w + 4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const G_ = ({ children }: { children: ReactNode }) => <g {...stroke}>{children}</g>;

/* --------------------------------------------------------------- comida */

function Salchipapa() {
  return (
    <G_>
      <rect x="28" y="30" width="11" height="46" rx="3" fill={Y} transform="rotate(-18 33 53)" />
      <rect x="43" y="20" width="11" height="54" rx="3" fill={Y} transform="rotate(-6 48 47)" />
      <rect x="58" y="16" width="11" height="58" rx="3" fill={YL} transform="rotate(4 63 45)" />
      <rect x="73" y="22" width="11" height="52" rx="3" fill={Y} transform="rotate(15 78 48)" />
      <rect x="86" y="34" width="10" height="42" rx="3" fill={YL} transform="rotate(27 91 55)" />
      <circle cx="38" cy="64" r="10" fill="#D2462E" />
      <ellipse cx="38" cy="64" rx="5" ry="4" fill="#F2866B" stroke="none" />
      <circle cx="60" cy="60" r="11" fill="#D2462E" />
      <ellipse cx="60" cy="60" rx="6" ry="4.5" fill="#F2866B" stroke="none" />
      <circle cx="82" cy="64" r="10" fill="#D2462E" />
      <ellipse cx="82" cy="64" rx="5" ry="4" fill="#F2866B" stroke="none" />
      <Ln d="M24 54 q8 -8 16 0 t16 0 t16 0 t16 0 t14 0" c="#F7A99C" w={4} />
      <rect x="47" y="46" width="6" height="6" rx="1.5" fill={CR} strokeWidth={2.5} transform="rotate(20 50 49)" />
      <rect x="70" y="48" width="6" height="6" rx="1.5" fill={CR} strokeWidth={2.5} transform="rotate(-15 73 51)" />
      <path d="M16 70 H104 L95 104 Q94 109 88 109 H32 Q26 109 25 104 Z" fill={O} />
      <rect x="12" y="66" width="96" height="10" rx="5" fill={OD} />
      <path d="M30 90 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" fill="none" stroke={CR} strokeWidth={3.2} />
      <path d="M29 82 H91 M31 97 H89" fill="none" stroke={CR} strokeWidth={2.4} />
    </G_>
  );
}

function Hamburguesa() {
  return (
    <G_>
      <path d="M20 88 H100 Q100 105 84 105 H36 Q20 105 20 88 Z" fill={BUN} />
      <rect x="15" y="72" width="90" height="17" rx="8.5" fill={BR} />
      <path d="M26 79 h10 M46 81 h12 M70 79 h12" fill="none" stroke="#5A2A0E" strokeWidth={2.5} />
      <path d="M15 67 H105 L97 76 L90 71 L82 82 L72 72 L58 80 L47 72 L36 80 L26 72 Z" fill={Y} />
      <rect x="19" y="60" width="82" height="10" rx="5" fill={R} />
      <path d="M13 61 Q19 52 25 60 Q31 52 37 60 Q43 52 49 60 Q55 52 61 60 Q67 52 73 60 Q79 52 85 60 Q91 52 97 60 Q103 52 107 60 L106 63 H14 Z" fill={G} />
      <path d="M17 56 Q17 21 60 21 Q103 21 103 56 Q103 60 98 60 H22 Q17 60 17 56 Z" fill={BUN} />
      <path d="M31 38 Q40 28 54 27" fill="none" stroke="#FBD08A" strokeWidth={4} />
      {[
        [46, 36, -20],
        [62, 31, 10],
        [77, 37, 30],
        [56, 45, -10],
        [87, 47, 40],
        [35, 48, -35],
        [71, 48, 15],
      ].map(([x, y, a]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3.6" ry="2.2" fill={CR} strokeWidth={2} transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </G_>
  );
}

function Perro() {
  return (
    <G_>
      <g transform="rotate(-9 60 66)">
        <path d="M16 62 Q16 46 34 48 H86 Q104 46 104 62 Z" fill="#F4BF72" />
        <rect x="6" y="54" width="108" height="17" rx="8.5" fill="#C8452B" />
        <path d="M16 58 H40" fill="none" stroke="#E7765C" strokeWidth={3} />
        <Ln d="M20 60 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5" c="#FFD23F" w={3.2} />
        <path d="M13 65 H107 Q107 91 84 91 H36 Q13 91 13 65 Z" fill={BUN} />
        <path d="M24 76 Q34 84 48 84" fill="none" stroke="#FBD08A" strokeWidth={4} />
        <rect x="36" y="44" width="6" height="6" rx="1.5" fill={CR} strokeWidth={2.5} transform="rotate(15 39 47)" />
        <rect x="58" y="42" width="6" height="6" rx="1.5" fill={YL} strokeWidth={2.5} transform="rotate(-20 61 45)" />
        <rect x="78" y="44" width="6" height="6" rx="1.5" fill={CR} strokeWidth={2.5} transform="rotate(30 81 47)" />
      </g>
    </G_>
  );
}

function Patacon() {
  return (
    <G_>
      <ellipse cx="60" cy="76" rx="50" ry="30" fill="#C98424" />
      <ellipse cx="60" cy="68" rx="50" ry="30" fill={GOLD} />
      <ellipse cx="60" cy="68" rx="38" ry="21" fill="none" stroke={GOLDD} strokeWidth={2.5} />
      <path d="M26 56 L20 50 M94 56 L100 50 M60 40 V36" fill="none" stroke={GOLDD} strokeWidth={2.5} />
      <path d="M34 66 Q40 52 56 56 Q70 48 84 58 Q94 66 84 76 Q70 86 54 82 Q36 80 34 66 Z" fill={YL} />
      <Ln d="M40 64 q6 -6 10 0 t10 0" c="#8A4A1F" w={3.5} />
      <Ln d="M62 72 q6 -6 10 0 t10 0" c="#8A4A1F" w={3.5} />
      <Ln d="M48 76 q5 -4 9 0" c="#8A4A1F" w={3.5} />
      <circle cx="66" cy="60" r="4" fill={Y} strokeWidth={2.5} />
      <circle cx="56" cy="67" r="3.6" fill={Y} strokeWidth={2.5} />
      <circle cx="76" cy="66" r="3.6" fill={Y} strokeWidth={2.5} />
      <path d="M42 56 l5 -3 l2 5 Z M82 76 l5 -2 l0 5 Z" fill={G} strokeWidth={2.5} />
      <rect x="70" y="51" width="8" height="5" rx="1.5" fill="#D2462E" strokeWidth={2.5} transform="rotate(-12 74 53)" />
      <Ln d="M30 70 q10 -12 22 -2 t24 -4 t18 2" c="#F7A99C" w={3} />
    </G_>
  );
}

function Arepa() {
  return (
    <G_>
      <circle cx="52" cy="68" r="38" fill={GOLD} />
      <circle cx="52" cy="68" r="29" fill="none" stroke={GOLDD} strokeWidth={2.5} />
      {[
        [38, 56, 4],
        [60, 50, 3],
        [44, 78, 3.5],
        [66, 80, 4],
        [30, 70, 2.8],
        [56, 66, 2.6],
        [72, 64, 3],
      ].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r * 0.75} fill={GOLDD} stroke="none" opacity={0.7} />
      ))}
      <path d="M70 26 Q80 12 96 18 Q112 22 109 38 Q110 55 94 55 Q78 60 71 48 Q61 37 70 26 Z" fill={W} />
      <circle cx="89" cy="37" r="9" fill="#FFB21A" />
      <circle cx="86" cy="34" r="2.6" fill={W} stroke="none" />
    </G_>
  );
}

function Papas() {
  return (
    <G_>
      <rect x="32" y="22" width="10" height="48" rx="3" fill={Y} transform="rotate(-14 37 46)" />
      <rect x="45" y="12" width="10" height="56" rx="3" fill={YL} transform="rotate(-4 50 40)" />
      <rect x="58" y="10" width="10" height="58" rx="3" fill={Y} transform="rotate(5 63 39)" />
      <rect x="71" y="16" width="10" height="52" rx="3" fill={YL} transform="rotate(13 76 42)" />
      <rect x="80" y="28" width="9" height="40" rx="3" fill={Y} transform="rotate(24 84 48)" />
      <path d="M26 48 Q43 58 60 58 Q77 58 94 48 L85 106 Q84 110 79 110 H41 Q36 110 35 106 Z" fill={R} />
      <path d="M36 80 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" fill="none" stroke={CR} strokeWidth={3.2} />
      <path d="M35 71 H85 M37 88 H83" fill="none" stroke={CR} strokeWidth={2.4} />
    </G_>
  );
}

function Pizza() {
  return (
    <G_>
      <path d="M22 36 Q60 18 98 36 L60 110 Z" fill={Y} />
      <path d="M16 30 Q60 6 104 30 L99 41 Q60 20 21 41 Z" fill="#D98F2B" />
      <path d="M34 60 q0 10 -4 14" fill="none" stroke={Y} strokeWidth={6} />
      {[
        [48, 50, 8],
        [72, 48, 8],
        [60, 74, 7.5],
        [58, 94, 5],
      ].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} fill="#D2462E" />
          <circle cx={x - 2} cy={y - 2} r={1.6} fill="#9E2A1B" stroke="none" />
          <circle cx={x + 2.5} cy={y + 1.5} r={1.3} fill="#9E2A1B" stroke="none" />
        </g>
      ))}
      <path d="M66 62 l4 -4 l3 4 Z M44 70 l4 -3 l2 4 Z M76 66 l4 -2 l1 4 Z" fill={G} strokeWidth={2.5} />
    </G_>
  );
}

function Chuzo() {
  const at = (t: number) => [14 + 92 * t, 106 - 92 * t] as const;
  const pieces: [number, number, string, boolean][] = [
    [0.33, 30, '#8A4A1F', true],
    [0.5, 22, CR, false],
    [0.65, 30, '#9A5424', true],
    [0.8, 21, R, false],
    [0.92, 18, G, false],
  ];
  return (
    <G_>
      <Ln d="M8 112 L110 10" c="#D9A066" w={6} />
      <ellipse cx="24" cy="96" rx="19" ry="12" fill={YL} transform="rotate(-45 24 96)" />
      <ellipse cx="24" cy="96" rx="11" ry="6" fill="none" stroke="#E6B24A" strokeWidth={2.5} transform="rotate(-45 24 96)" />
      {pieces.map(([t, s, fill, meat]) => {
        const [cx, cy] = at(t);
        return (
          <g key={t}>
            <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={s * 0.24} fill={fill} transform={`rotate(-45 ${cx} ${cy})`} />
            {meat && <path d={`M${cx - 9} ${cy - 3} L${cx - 1} ${cy + 5} M${cx - 3} ${cy - 9} L${cx + 5} ${cy - 1}`} fill="none" stroke="#4A200A" strokeWidth={2.6} />}
          </g>
        );
      })}
      <path d="M92 44 q10 -6 6 -18 M100 52 q12 -4 10 -18" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={3} />
    </G_>
  );
}

function Pollo() {
  return (
    <G_>
      <Ln d="M72 72 L98 98" c={CR} w={9} />
      <circle cx="101" cy="93" r="7" fill={CR} />
      <circle cx="93" cy="102" r="7" fill={CR} />
      <path d="M28 28 Q50 8 74 26 Q94 42 86 68 Q82 82 70 85 Q46 92 30 74 Q14 52 28 28 Z" fill="#D98A3D" />
      <path d="M38 38 q6 -6 12 -2 M58 30 q6 0 8 6 M36 60 q4 6 10 6 M62 52 q6 2 6 8" fill="none" stroke="#A85E1F" strokeWidth={3} />
      <path d="M34 34 Q42 22 56 22" fill="none" stroke="#F4B26A" strokeWidth={4} />
    </G_>
  );
}

function Sandwich() {
  return (
    <G_>
      <path d="M16 98 H104 V106 Q104 110 100 110 H20 Q16 110 16 106 Z" fill="#F4BF72" />
      <path d="M18 94 H102 L98 100 L90 96 L82 102 L72 96 L60 102 L48 96 L38 102 L28 96 Z" fill={Y} />
      <rect x="16" y="86" width="88" height="9" rx="4" fill="#F39A8B" />
      <path d="M12 86 Q18 78 24 86 Q30 78 36 86 Q42 78 48 86 Q54 78 60 86 Q66 78 72 86 Q78 78 84 86 Q90 78 96 86 Q102 78 108 86 L107 89 H13 Z" fill={G} />
      <path d="M18 80 L56 18 Q60 12 64 18 L102 80 Q104 84 99 84 H21 Q16 84 18 80 Z" fill="#F4BF72" />
      <path d="M30 76 L60 28 L90 76 Z" fill="#FBE3B8" stroke="none" />
      <circle cx="60" cy="58" r="2.4" fill="#E5B374" stroke="none" />
      <circle cx="52" cy="68" r="2" fill="#E5B374" stroke="none" />
      <circle cx="70" cy="66" r="2.2" fill="#E5B374" stroke="none" />
    </G_>
  );
}

function Mazorca() {
  const kernels: ReactNode[] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      const x = 47 + c * 8.6 + (r % 2 ? 2 : -2);
      const y = 25 + r * 9.4;
      kernels.push(<rect key={`${r}-${c}`} x={x - 3.8} y={y - 3.8} width="7.6" height="7.6" rx="3" fill={YL} stroke="#D99A1A" strokeWidth={1.6} />);
    }
  }
  return (
    <G_>
      <path d="M58 104 Q30 90 34 50 Q48 72 62 96 Z" fill={GD} />
      <path d="M60 14 Q82 14 83 44 L81 86 Q79 101 60 101 Q41 101 39 86 L37 44 Q38 14 60 14 Z" fill={Y} />
      {kernels}
      <path d="M40 110 Q16 80 26 44 Q44 78 64 102 Z" fill={G} />
      <path d="M82 110 Q104 80 94 46 Q78 78 58 102 Z" fill={G} />
      <path d="M30 60 Q34 80 48 96 M90 62 Q86 82 72 96" fill="none" stroke={GD} strokeWidth={2.5} />
    </G_>
  );
}

function Empanada() {
  const crimps: ReactNode[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1.06 + (0.88 * i) / 12);
    crimps.push(<circle key={i} cx={60 + 47 * Math.cos(a)} cy={80 + 50 * Math.sin(a)} r="5" fill="#D98F2B" strokeWidth={2.5} />);
  }
  return (
    <G_>
      <path d="M12 80 Q18 28 60 28 Q102 28 108 80 Q60 96 12 80 Z" fill={GOLD} />
      {crimps}
      <path d="M26 74 Q60 86 94 74" fill="none" stroke={GOLDD} strokeWidth={2.5} />
      <circle cx="46" cy="56" r="3" fill={GOLDD} stroke="none" opacity={0.7} />
      <circle cx="68" cy="50" r="2.4" fill={GOLDD} stroke="none" opacity={0.7} />
      <circle cx="76" cy="64" r="3" fill={GOLDD} stroke="none" opacity={0.7} />
      <circle cx="56" cy="68" r="2.2" fill={GOLDD} stroke="none" opacity={0.7} />
    </G_>
  );
}

function Gaseosa() {
  return (
    <G_>
      <path d="M52 12 H68 V20 Q68 24 70 28 L73 40 Q87 50 87 66 V100 Q87 110 77 110 H43 Q33 110 33 100 V66 Q33 50 47 40 L50 28 Q52 24 52 20 Z" fill="#4A1A08" />
      <rect x="49" y="6" width="22" height="9" rx="2.5" fill={R} />
      <rect x="33" y="64" width="54" height="26" fill={O} />
      <path d="M38 80 q5 -6 11 0 t11 0 t11 0 t11 0" fill="none" stroke={CR} strokeWidth={3} />
      <path d="M41 96 V102 M41 46 Q38 52 38 58" fill="none" stroke={W} strokeOpacity={0.45} strokeWidth={4} />
      <circle cx="60" cy="34" r="2" fill={CR} stroke="none" opacity={0.7} />
      <circle cx="64" cy="46" r="1.6" fill={CR} stroke="none" opacity={0.7} />
      <circle cx="56" cy="52" r="2.2" fill={CR} stroke="none" opacity={0.7} />
    </G_>
  );
}

function Glass({ drink, top, slice }: { drink: string; top: string; slice: ReactNode }) {
  return (
    <G_>
      <path d="M74 44 L90 6" fill="none" stroke={K} strokeWidth={10} />
      <path d="M74 44 L90 6" fill="none" stroke={W} strokeWidth={6} />
      <path d="M74 44 L90 6" fill="none" stroke={R} strokeWidth={6} strokeDasharray="5 5" strokeLinecap="butt" />
      <path d="M28 26 H92 L83 106 Q82 111 76 111 H44 Q38 111 37 106 Z" fill="#FFF7EC" />
      <path d="M31.5 44 H88.5 L81.8 104 Q81 107 76 107 H44 Q39 107 38.2 104 Z" fill={drink} stroke="none" />
      <path d="M31.5 44 q7 5 14 0 t14 0 t14 0 t15 0" fill="none" stroke={top} strokeWidth={3} />
      <rect x="44" y="58" width="14" height="14" rx="3" fill={W} stroke="none" opacity={0.45} transform="rotate(12 51 65)" />
      <rect x="62" y="70" width="12" height="12" rx="3" fill={W} stroke="none" opacity={0.4} transform="rotate(-10 68 76)" />
      <path d="M28 26 H92 L83 106 Q82 111 76 111 H44 Q38 111 37 106 Z" fill="none" />
      <path d="M40 34 L45 98" fill="none" stroke={W} strokeOpacity={0.6} strokeWidth={4} />
      {slice}
    </G_>
  );
}

function Jugo() {
  return (
    <Glass
      drink="#FF9F2E"
      top="#FFC36B"
      slice={
        <g>
          <circle cx="32" cy="26" r="15" fill={Y} />
          <circle cx="32" cy="26" r="10" fill={YL} strokeWidth={2.5} />
          <path d="M32 16 V36 M22 26 H42 M25 19 L39 33 M39 19 L25 33" fill="none" stroke={Y} strokeWidth={2} />
        </g>
      }
    />
  );
}

function Limonada() {
  return (
    <Glass
      drink="#F4EAD5"
      top={W}
      slice={
        <g>
          <circle cx="32" cy="26" r="15" fill={G} />
          <circle cx="32" cy="26" r="10" fill="#C6EA8E" strokeWidth={2.5} />
          <path d="M32 16 V36 M22 26 H42 M25 19 L39 33 M39 19 L25 33" fill="none" stroke={G} strokeWidth={2} />
          <circle cx="54" cy="88" r="2" fill="#E6D6B8" stroke="none" />
          <circle cx="66" cy="94" r="2" fill="#E6D6B8" stroke="none" />
          <circle cx="60" cy="80" r="1.6" fill="#E6D6B8" stroke="none" />
        </g>
      }
    />
  );
}

function Agua() {
  return (
    <G_>
      <rect x="50" y="6" width="20" height="10" rx="2.5" fill={SEA} />
      <path d="M52 16 H68 V24 Q80 30 80 44 V100 Q80 110 70 110 H50 Q40 110 40 100 V44 Q40 30 52 24 Z" fill="#CDEFF5" />
      <path d="M40 50 H80 M40 58 H80" fill="none" stroke="#9ADCE6" strokeWidth={2.5} />
      <rect x="40" y="66" width="40" height="24" fill={SEA} />
      <path d="M44 80 q4 -5 8 0 t8 0 t8 0 t8 0" fill="none" stroke={W} strokeWidth={3} />
      <path d="M47 96 V102 M47 34 Q45 40 45 44" fill="none" stroke={W} strokeOpacity={0.7} strokeWidth={4} />
    </G_>
  );
}

function Cerveza() {
  return (
    <G_>
      <Ln d="M84 52 H94 Q104 52 104 62 V76 Q104 88 94 88 H84" c="#FFE6B0" w={7} />
      <rect x="24" y="36" width="62" height="72" rx="9" fill="#FFB62E" />
      <path d="M38 50 V96 M54 50 V96 M70 50 V96" fill="none" stroke="#FFD27A" strokeWidth={4} />
      <circle cx="46" cy="84" r="2.4" fill={W} stroke="none" opacity={0.7} />
      <circle cx="62" cy="72" r="2" fill={W} stroke="none" opacity={0.7} />
      <circle cx="74" cy="90" r="2.2" fill={W} stroke="none" opacity={0.7} />
      <path d="M20 42 Q16 26 32 26 Q38 12 54 18 Q66 8 78 20 Q94 18 91 36 Q92 46 82 46 L82 56 Q82 62 77 62 Q72 62 72 56 V46 H30 Q20 48 20 42 Z" fill={W} />
    </G_>
  );
}

function Postre() {
  return (
    <G_>
      <path d="M36 60 L60 112 L84 60 Z" fill={BUN} />
      <path d="M44 66 L66 104 M56 64 L74 86 M40 76 L58 106 M70 64 L50 100 M80 66 L62 106 M60 64 L46 88" fill="none" stroke="#B86A26" strokeWidth={2} />
      <circle cx="44" cy="56" r="16" fill={CR} />
      <circle cx="76" cy="56" r="16" fill={BR} />
      <circle cx="60" cy="38" r="21" fill="#F39A8B" />
      <path d="M48 30 Q54 22 64 22" fill="none" stroke="#FBC4BA" strokeWidth={4} />
      <path d="M60 17 Q62 8 70 6" fill="none" strokeWidth={3} />
      <circle cx="60" cy="16" r="6.5" fill={R} />
    </G_>
  );
}

function Cup() {
  return (
    <G_>
      <path d="M62 30 L74 2" fill="none" stroke={K} strokeWidth={10} />
      <path d="M62 30 L74 2" fill="none" stroke={W} strokeWidth={6} />
      <path d="M62 30 L74 2" fill="none" stroke={O} strokeWidth={6} strokeDasharray="5 5" strokeLinecap="butt" />
      <path d="M26 34 H94 L86 108 Q85 112 80 112 H40 Q35 112 34 108 Z" fill={R} />
      <rect x="22" y="26" width="76" height="12" rx="6" fill={CR} />
      <path d="M36 72 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6" fill="none" stroke={CR} strokeWidth={3.2} />
      <path d="M34 62 H86 M36 82 H84" fill="none" stroke={CR} strokeWidth={2.4} />
    </G_>
  );
}

function Combo() {
  return (
    <>
      <g transform="translate(58 4) scale(0.56)">
        <Cup />
      </g>
      <g transform="translate(2 12) scale(0.56)">
        <Papas />
      </g>
      <g transform="translate(16 38) scale(0.74)">
        <Hamburguesa />
      </g>
    </>
  );
}

function Salsa() {
  return (
    <G_>
      <g transform="rotate(-10 40 70)">
        <path d="M34 12 L38 30 H30 Z" fill={CR} />
        <path d="M24 42 L28 28 H40 L44 42 Z" fill={CR} />
        <rect x="16" y="40" width="36" height="68" rx="11" fill={R} />
        <circle cx="34" cy="72" r="9" fill={CR} strokeWidth={3} />
        <path d="M22 50 V96" fill="none" stroke={W} strokeOpacity={0.4} strokeWidth={4} />
      </g>
      <g transform="rotate(10 80 70)">
        <path d="M80 12 L84 30 H76 Z" fill={CR} />
        <path d="M70 42 L74 28 H86 L90 42 Z" fill={CR} />
        <rect x="62" y="40" width="36" height="68" rx="11" fill={Y} />
        <circle cx="80" cy="72" r="9" fill={CR} strokeWidth={3} />
        <path d="M68 50 V96" fill="none" stroke={W} strokeOpacity={0.5} strokeWidth={4} />
      </g>
    </G_>
  );
}

function Queso() {
  return (
    <G_>
      <path d="M14 62 L80 30 L106 60 Z" fill={YL} />
      <path d="M14 62 H106 V94 Q106 98 102 98 H18 Q14 98 14 94 Z" fill={Y} />
      <ellipse cx="34" cy="78" rx="6" ry="5" fill="#E8A81E" stroke="none" />
      <ellipse cx="60" cy="84" rx="4.5" ry="4" fill="#E8A81E" stroke="none" />
      <ellipse cx="84" cy="74" rx="7" ry="6" fill="#E8A81E" stroke="none" />
      <ellipse cx="66" cy="50" rx="5" ry="3" fill="#F2C94C" stroke="none" />
    </G_>
  );
}

/* ---------------------------------------------------------- operación */

function Mesa() {
  return (
    <G_>
      <rect x="6" y="36" width="10" height="60" rx="4" fill={T} />
      <rect x="6" y="70" width="30" height="9" rx="4" fill={T} />
      <path d="M12 79 V104 M31 79 V104" fill="none" strokeWidth={4.5} />
      <rect x="104" y="36" width="10" height="60" rx="4" fill={T} />
      <rect x="84" y="70" width="30" height="9" rx="4" fill={T} />
      <path d="M108 79 V104 M89 79 V104" fill="none" strokeWidth={4.5} />
      <rect x="54" y="60" width="12" height="40" fill="#8A4A1F" />
      <rect x="38" y="98" width="44" height="9" rx="4" fill="#8A4A1F" />
      <rect x="22" y="54" width="76" height="11" rx="4" fill={O} />
      <path d="M50 54 L60 30 L70 54 Z" fill={CR} />
      <path d="M56 44 H64" fill="none" stroke={O} strokeWidth={3} />
    </G_>
  );
}

function Llevar() {
  return (
    <G_>
      <Ln d="M44 44 Q44 16 60 16 Q76 16 76 44" c={CR} w={5} />
      <path d="M24 44 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 L90 108 Q89 111 86 111 H34 Q31 111 30 108 Z" fill="#D9A066" />
      <path d="M26 54 H94" fill="none" stroke="#B9824A" strokeWidth={3} />
      <circle cx="60" cy="80" r="17" fill={O} />
      <path d="M53 81 Q53 69 60 69 Q67 69 67 81 Z" fill={CR} strokeWidth={2.5} />
      <ellipse cx="60" cy="83" rx="13" ry="4" fill={CR} strokeWidth={2.5} />
    </G_>
  );
}

function Domicilio() {
  return (
    <G_>
      <path d="M2 64 H14 M6 74 H16 M0 84 H12" fill="none" strokeOpacity={0.45} strokeWidth={3.5} />
      <rect x="16" y="22" width="38" height="34" rx="5" fill={T} />
      <path d="M16 36 H54" fill="none" stroke={CR} strokeWidth={3} />
      <path d="M22 46 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke={CR} strokeWidth={2.6} />
      <path d="M18 88 Q18 64 42 64 H60 Q66 64 66 70 V82 H46 Q32 82 30 92 H18 Z" fill={O} />
      <path d="M30 64 Q30 56 38 56 H62 Q66 56 66 60 V64 H30 Z" fill={DK} />
      <rect x="44" y="82" width="36" height="8" rx="3" fill={OD} />
      <Ln d="M76 88 L86 42" c="#8A4A1F" w={5} />
      <path d="M78 58 Q94 60 99 86 L88 90 Q86 72 74 70 Z" fill={O} />
      <Ln d="M80 40 H96" c={DK} w={4} />
      <circle cx="97" cy="56" r="4.5" fill={YL} strokeWidth={3} />
      <circle cx="34" cy="94" r="14" fill={DK} />
      <circle cx="34" cy="94" r="5" fill="#C9C0B6" strokeWidth={3} />
      <circle cx="94" cy="94" r="14" fill={DK} />
      <circle cx="94" cy="94" r="5" fill="#C9C0B6" strokeWidth={3} />
    </G_>
  );
}

function Efectivo() {
  return (
    <G_>
      <rect x="10" y="34" width="80" height="46" rx="6" fill="#4FA36A" transform="rotate(-10 50 57)" />
      <rect x="18" y="44" width="80" height="46" rx="6" fill="#7CC98E" />
      <rect x="25" y="51" width="66" height="32" rx="4" fill="none" stroke="#3E8A56" strokeWidth={2.5} />
      <circle cx="58" cy="67" r="10" fill="#A9DDB5" strokeWidth={3} />
      <circle cx="92" cy="90" r="17" fill={Y} />
      <circle cx="92" cy="90" r="11.5" fill="none" stroke="#D99A1A" strokeWidth={2.5} />
      <text x="92" y="97" textAnchor="middle" fontFamily="'Baloo 2', system-ui, sans-serif" fontWeight={800} fontSize="20" fill={K} stroke="none">
        $
      </text>
    </G_>
  );
}

function Tarjeta() {
  return (
    <G_>
      <g transform="rotate(-8 60 62)">
        <rect x="12" y="30" width="96" height="62" rx="10" fill={O} />
        <path d="M12 44 H108" fill="none" strokeWidth={0} />
        <rect x="24" y="46" width="20" height="15" rx="3" fill={YL} strokeWidth={2.6} />
        <path d="M24 53 H44 M34 46 V61" fill="none" strokeWidth={2} />
        <path d="M24 76 H44 M52 76 H66 M74 76 H88" fill="none" stroke={CR} strokeWidth={4} />
        <path d="M84 48 q5 5 0 10 M90 44 q9 9 0 18" fill="none" stroke={CR} strokeWidth={3} />
      </g>
    </G_>
  );
}

function Movil() {
  return (
    <G_>
      <rect x="32" y="8" width="56" height="104" rx="12" fill={DK} />
      <rect x="38" y="20" width="44" height="78" rx="5" style={{ fill: 'var(--art-accent, #F38120)' }} />
      <rect x="52" y="12" width="16" height="4" rx="2" fill="#6B4A36" stroke="none" />
      <circle cx="60" cy="56" r="14" fill={W} strokeWidth={3} />
      <path d="M53 56 L58 61 L68 50" fill="none" strokeWidth={4} style={{ stroke: 'var(--art-accent, #F38120)' }} />
      <path d="M46 84 H74" fill="none" stroke={W} strokeOpacity={0.7} strokeWidth={4} />
      <path d="M96 30 l4 -4 M100 42 h6 M18 34 l-4 -4 M16 48 h-6" fill="none" strokeWidth={3.5} />
    </G_>
  );
}

function Banco() {
  return (
    <G_>
      <path d="M12 44 L60 14 L108 44 Z" fill={O} />
      <circle cx="60" cy="33" r="5" fill={CR} strokeWidth={3} />
      <rect x="16" y="44" width="88" height="8" rx="2" fill={CR} />
      {[24, 44, 64, 84].map((x) => (
        <rect key={x} x={x} y="52" width="12" height="40" fill={CR} />
      ))}
      <rect x="10" y="92" width="100" height="10" rx="3" fill={T} />
      <rect x="6" y="102" width="108" height="8" rx="3" fill={BR} />
    </G_>
  );
}

function Caja() {
  return (
    <G_>
      <rect x="28" y="20" width="18" height="30" fill={W} />
      <path d="M32 28 H42 M32 34 H42 M32 40 H40" fill="none" stroke="#C9B9A6" strokeWidth={2.4} />
      <rect x="70" y="42" width="12" height="8" fill={DK} />
      <rect x="54" y="18" width="44" height="26" rx="5" fill={DK} />
      <text x="76" y="38" textAnchor="middle" fontFamily="'Baloo 2', system-ui, sans-serif" fontWeight={800} fontSize="17" fill={O} stroke="none">
        $
      </text>
      <path d="M20 80 L27 48 H93 L100 80 Z" fill={O} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} x={36 + c * 13 - r * 1.2} y={54 + r * 8} width="9" height="5" rx="1.5" fill={CR} strokeWidth={2} />),
      )}
      <rect x="12" y="80" width="96" height="26" rx="5" fill="#8A4A1F" />
      <path d="M22 92 H98" fill="none" stroke="#5A2A0E" strokeWidth={3} />
      <rect x="50" y="95" width="20" height="5" rx="2.5" fill={Y} strokeWidth={2.4} />
    </G_>
  );
}

function Cocina() {
  return (
    <G_>
      <path d="M30 70 Q12 66 16 48 Q20 32 38 36 Q40 16 60 16 Q80 16 82 36 Q100 32 104 48 Q108 66 90 70 Z" fill={W} />
      <path d="M44 40 Q46 30 56 28 M76 44 Q82 40 86 44" fill="none" stroke="#E6DCCF" strokeWidth={4} />
      <rect x="30" y="68" width="60" height="30" rx="4" fill={CR} />
      <rect x="30" y="80" width="60" height="9" fill={O} />
      <path d="M36 84.5 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3" fill="none" stroke={CR} strokeWidth={2} />
      <path d="M44 106 Q40 98 46 94 Q48 100 52 98 Q50 92 56 88 Q58 96 62 96 Q64 92 66 90 Q72 98 68 106 Z" fill={R} strokeWidth={3} transform="translate(0 6) scale(1 0.9)" />
    </G_>
  );
}

function Turnos() {
  return (
    <G_>
      <path d="M42 108 L50 92 M78 108 L70 92" fill="none" strokeWidth={5} />
      <rect x="8" y="16" width="104" height="76" rx="10" fill={DK} />
      <rect x="16" y="24" width="88" height="60" rx="5" fill={O} />
      <text x="60" y="74" textAnchor="middle" fontFamily="'Baloo 2', system-ui, sans-serif" fontWeight={800} fontSize="44" fill={CR} stroke="none">
        24
      </text>
      <path d="M22 32 H40" fill="none" stroke={CR} strokeOpacity={0.7} strokeWidth={3} />
      <circle cx="98" cy="18" r="11" fill={Y} />
      <path d="M94 18 H102 M98 14 V22" fill="none" strokeWidth={3} />
    </G_>
  );
}

function Menu() {
  return (
    <G_>
      <rect x="18" y="16" width="72" height="94" rx="8" fill="#8A4A1F" />
      <rect x="26" y="26" width="56" height="76" rx="4" fill={CR} />
      <rect x="40" y="10" width="28" height="12" rx="4" fill={O} />
      <path d="M34 42 H58 M34 56 H72 M34 70 H64 M34 84 H54" fill="none" stroke="#C9B39A" strokeWidth={4} />
      <circle cx="70" cy="42" r="4" fill={O} strokeWidth={2.5} />
      <g transform="rotate(38 88 70)">
        <rect x="82" y="30" width="12" height="62" rx="2" fill={Y} />
        <path d="M82 92 L88 104 L94 92 Z" fill={CR} />
        <rect x="82" y="30" width="12" height="9" rx="2" fill="#F39A8B" />
      </g>
    </G_>
  );
}

function Campana() {
  return (
    <G_>
      <path d="M22 26 L14 18 M98 26 L106 18 M60 12 V4" fill="none" strokeWidth={4} />
      <rect x="52" y="24" width="16" height="9" rx="3" fill={Y} />
      <path d="M20 84 Q20 34 60 32 Q100 34 100 84 Z" fill={Y} />
      <path d="M34 72 Q34 48 54 42" fill="none" stroke="#FFE7A1" strokeWidth={5} />
      <rect x="10" y="84" width="100" height="12" rx="5" fill={O} />
      <rect x="18" y="96" width="84" height="12" rx="4" fill="#8A4A1F" />
    </G_>
  );
}

const ARTS: Record<string, () => ReactNode> = {
  salchipapa: Salchipapa,
  hamburguesa: Hamburguesa,
  perro: Perro,
  patacon: Patacon,
  arepa: Arepa,
  papas: Papas,
  pizza: Pizza,
  chuzo: Chuzo,
  pollo: Pollo,
  sandwich: Sandwich,
  mazorca: Mazorca,
  empanada: Empanada,
  combo: Combo,
  gaseosa: Gaseosa,
  jugo: Jugo,
  limonada: Limonada,
  agua: Agua,
  cerveza: Cerveza,
  postre: Postre,
  vaso: Cup,
  salsa: Salsa,
  queso: Queso,
  mesa: Mesa,
  llevar: Llevar,
  domicilio: Domicilio,
  efectivo: Efectivo,
  tarjeta: Tarjeta,
  movil: Movil,
  banco: Banco,
  caja: Caja,
  cocina: Cocina,
  turnos: Turnos,
  menu: Menu,
  campana: Campana,
};

/** Ilustraciones disponibles para productos y categorías (selector en administración). */
export const FOOD_ART: { key: string; label: string }[] = [
  { key: 'salchipapa', label: 'Salchipapa' },
  { key: 'hamburguesa', label: 'Hamburguesa' },
  { key: 'perro', label: 'Perro caliente' },
  { key: 'patacon', label: 'Patacón' },
  { key: 'arepa', label: 'Arepa de huevo' },
  { key: 'empanada', label: 'Empanada' },
  { key: 'chuzo', label: 'Chuzo' },
  { key: 'mazorca', label: 'Mazorca' },
  { key: 'papas', label: 'Papas' },
  { key: 'pollo', label: 'Pollo' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'sandwich', label: 'Sándwich' },
  { key: 'combo', label: 'Combo' },
  { key: 'gaseosa', label: 'Gaseosa' },
  { key: 'vaso', label: 'Vaso' },
  { key: 'jugo', label: 'Jugo' },
  { key: 'limonada', label: 'Limonada' },
  { key: 'agua', label: 'Agua' },
  { key: 'cerveza', label: 'Cerveza' },
  { key: 'postre', label: 'Postre' },
  { key: 'salsa', label: 'Salsas' },
  { key: 'queso', label: 'Queso' },
];

export const Art = memo(function Art({ name, className, accent, title }: { name: string; className?: string; accent?: string; title?: string }) {
  const Comp = ARTS[name] ?? Salchipapa;
  return (
    <svg
      viewBox="0 0 120 120"
      className={className ? `art ${className}` : 'art'}
      style={accent ? ({ '--art-accent': accent } as CSSProperties) : undefined}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <Comp />
    </svg>
  );
});
