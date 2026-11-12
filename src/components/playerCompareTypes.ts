export interface PlayerThemeColor {
  stroke: string;
  fill: string;
  bg: string;
  text: string;
  border: string;
  hex: string;
}

export const PLAYER_COLORS: PlayerThemeColor[] = [
  { stroke: '#F43F5E', fill: '#FDA4AF', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', hex: '#F43F5E' }, // Rose / Pink (like image)
  { stroke: '#2563EB', fill: '#93C5FD', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', hex: '#2563EB' }, // Blue (like image)
  { stroke: '#059669', fill: '#6EE7B7', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', hex: '#059669' }, // Emerald
  { stroke: '#D97706', fill: '#FCD34D', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', hex: '#D97706' }, // Amber
];
