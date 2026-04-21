const TAG_COLORS = {
  'Client': '#3b82f6',    // Blue
  'Personal': '#10b981',  // Green
  'Work': '#f97316',      // Orange
  'Learning': '#8b5cf6',  // Purple
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
  const colors = ['#ec4899', '#06b6d4', '#eab308', '#6366f1', '#14b8a6'];
  return colors[Math.abs(hash) % colors.length];
}

export const DEFAULT_TAGS = ['Client', 'Personal', 'Work', 'Learning'];
