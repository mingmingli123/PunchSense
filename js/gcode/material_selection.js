export function activeMaterialsForGcode({
  c,
  state,
  firstLayerMaterial,
  materialRegions,
  toolForMaterial,
}) {
  if (c.exposedSnakeMode) {
    const materials = new Set();
    if (c.polygons.length > 0) materials.add(firstLayerMaterial);
    if (c.tpuSnakeLayerCount > 0) materials.add(0);
    return [...materials].sort((a, b) => a - b);
  }
  const materials = new Set();
  for (const region of materialRegions(c)) {
    if (Number(region.material) >= 0) materials.add(toolForMaterial(region.material));
  }
  for (const material of state.regionMaterialOverrides.values()) {
    if (Number(material) >= 0) materials.add(toolForMaterial(material));
  }
  if (c.tpuSnakeEnabled && Number(c.tpuSnakeRemainderMaterial) >= 0) materials.add(toolForMaterial(c.tpuSnakeRemainderMaterial));
  if (c.polygons.length > 0) materials.add(firstLayerMaterial);
  if (materials.size === 0) materials.add(toolForMaterial(c.tool));
  return [...materials].sort((a, b) => a - b);
}

export function materialToolsForLayer({
  c,
  layerIndex,
  materialGridSegments,
  toolForMaterial,
}) {
  const segments = materialGridSegments(c, layerIndex);
  const tools = [];
  for (const [material, bucket] of segments) {
    if (Number(material) < 0) continue;
    if (!bucket) continue;
    const hasGeometry = bucket.horizontal.length > 0
      || bucket.vertical.length > 0
      || (bucket.paths?.length ?? 0) > 0
      || (bucket.solidPaths?.length ?? 0) > 0;
    if (hasGeometry) tools.push(toolForMaterial(material));
  }
  return [...new Set(tools)].sort((a, b) => a - b);
}
