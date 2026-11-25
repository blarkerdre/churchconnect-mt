// Folders are unique per church, so the same folder name can exist in two
// churches. When a person sees all their folders together, the duplicated
// names need the church they came from so they are not confused with each other.
export function sermonFolderLabels(folders = [], tenantNames = {}) {
  const nameCount = {};
  folders.forEach((f) => {
    if (!f || !f.name) return;
    nameCount[f.name] = (nameCount[f.name] || 0) + 1;
  });

  const labels = {};
  folders.forEach((f) => {
    if (!f || !f.id) return;
    const church = tenantNames[f.tenant_id];
    labels[f.id] = nameCount[f.name] > 1 && church ? `${f.name} (${church})` : f.name;
  });
  return labels;
}
