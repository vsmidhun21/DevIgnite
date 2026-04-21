const TAG_COLORS = {
  'Client': '#1d4ed8',
  'Personal': '#047857',
  'Work': '#c2410c',
  'Learning': '#6d28d9',
};

export function getTagColor(tag) {
  if (!tag) return null;
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  // Hash custom tag to a color
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i);
    hash = hash & hash;
  }
  const colors = ['#be185d', '#0f766e', '#a16207', '#4338ca', '#0369a1'];
  return colors[Math.abs(hash) % colors.length];
}

export const DEFAULT_TAGS = ['Client', 'Personal', 'Work', 'Learning'];
