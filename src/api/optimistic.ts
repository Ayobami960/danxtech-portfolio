export const applyOrder = <T extends { id: string }>(
  items: T[],
  ids: string[],
): T[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item));
  const remaining = items.filter((item) => !ids.includes(item.id));
  return [...ordered, ...remaining];
};

export const replaceEntity = <T extends { id: string }>(
  items: T[],
  entity: T,
): T[] => items.map((item) => (item.id === entity.id ? entity : item));
