import { createImportedSvgGuideConnections } from "./svg_guide_import.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createImportHandlers(deps) {
  const {
    state,
    controls,
    svgImport,
    projectImport,
    config,
    extractSvgGeometry,
    fitSvgGeometryToBed,
    applyProjectData,
    createImportedPolygonShape,
    pushUndoSnapshot,
    setSelectedShapes,
    setSvgImportStatus,
    draw,
    updateWorkflowSections,
    baseMaterialGridSegments,
    tpuSnakePreviewLayer,
    tpuBoundaryEdges,
    nearestTpuSnakeGridEndpoint,
    nearestTpuRegionGuideEndpoint,
    createGuidedTpuSnakeConnection,
    removeConsecutiveDuplicateMmPoints,
    polygonArea,
    firstLayerMaterial,
  } = deps;

  const FIRST_LAYER_MATERIAL = firstLayerMaterial;

  async function importSvgFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const result = extractSvgGeometry(text, { simplifyGuidePoints: simplifyOrthogonalGuidePoints });
      if (result.polygons.length === 0) {
        setSvgImportStatus(`没有找到可导入的闭合轮廓；跳过 ${result.skipped} 个元素。`);
        return;
      }
      const fittedGeometry = fitSvgGeometryToBed(result, config(), { simplifyGuidePoints: simplifyOrthogonalGuidePoints });
      const material = Number(controls.shapeMaterial.value);
      const fallbackMaterial = result.guidePaths.length > 0 ? FIRST_LAYER_MATERIAL : material;
      const importGroupId = `svg_import_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fitted = fittedGeometry.polygons
        .map((points, index) => ({ points, material: fittedGeometry.polygonMaterials?.[index] ?? fallbackMaterial }))
        .sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
      const shapes = fitted.map(({ points, material: shapeMaterial }) => createImportedPolygonShape(points, shapeMaterial, importGroupId));
      const firstIndex = state.shapes.length;
      pushUndoSnapshot();
      state.shapeMode = "empty";
      controls.drawMode.value = "rect";
      state.frame = { x: 0, y: 0, w: 0, h: 0 };
      state.path = [];
      state.polylineClosed = false;
      state.activeVertexIndex = -1;
      state.materialGridCache.clear();
      state.gridRasterCache.clear();
      state.shapes.push(...shapes);
      const importConfig = config();
      const guideConnections = createImportedSvgGuideConnections(fittedGeometry, importConfig, importGroupId, {
        baseMaterialGridSegments,
        tpuSnakePreviewLayer,
        tpuBoundaryEdges,
        nearestTpuSnakeGridEndpoint,
        nearestTpuRegionGuideEndpoint,
        createGuidedTpuSnakeConnection,
      });
      if (guideConnections.length > 0) {
        controls.tpuSnakeEnabled.checked = true;
        controls.workflowMode.value = "design";
        state.tpuSnake.connections.push(...guideConnections);
        state.tpuSnake.selectedConnectionIndex = state.tpuSnake.connections.length - 1;
        state.tpuSnake.endpoints = [];
        state.tpuSnake.picking = false;
        state.tpuSnake.editingConnectionIndex = -1;
        state.tpuSnake.conflict = null;
        updateWorkflowSections?.();
      }
      setSelectedShapes(shapes.map((_, index) => firstIndex + index), firstIndex);
      state.draftShape = null;
      state.pendingShape = null;
      controls.shapeMaterial.value = String(material);
      const guideText = guideConnections.length > 0 ? `，并从红色线生成 ${guideConnections.length} 条 TPU guide 路径` : "";
      setSvgImportStatus(`已导入 ${shapes.length} 个闭合轮廓${guideText}；跳过 ${result.skipped} 个非闭合/不支持元素。点击轮廓后可指定材料。`);
      draw();
    } catch (error) {
      setSvgImportStatus(`导入失败：${error.message}`);
    } finally {
      svgImport.value = "";
    }
  }

  async function importProjectFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importProjectData(data);
    } catch (error) {
      setSvgImportStatus(`加载保存图形失败：${error.message}`);
    } finally {
      projectImport.value = "";
    }
  }

  function importProjectData(data) {
    const result = applyProjectData(data);
    setSvgImportStatus(`已加载 ${result.shapeCount} 个保存图形；尺寸按文件中的 mm 坐标恢复，没有重新缩放。`);
    return result;
  }


  function simplifyOrthogonalGuidePoints(points) {
    const cleaned = removeConsecutiveDuplicateMmPoints(points);
    if (cleaned.length <= 2) return cleaned;
    const result = [cleaned[0]];
    for (let i = 1; i < cleaned.length - 1; i += 1) {
      const prev = result[result.length - 1];
      const point = cleaned[i];
      const next = cleaned[i + 1];
      const sameX = Math.abs(prev.x - point.x) <= 0.01 && Math.abs(point.x - next.x) <= 0.01;
      const sameY = Math.abs(prev.y - point.y) <= 0.01 && Math.abs(point.y - next.y) <= 0.01;
      if (!sameX && !sameY) result.push(point);
    }
    result.push(cleaned[cleaned.length - 1]);
    return result;
  }

  return {
    importSvgFile,
    importProjectFile,
    importProjectData,
    simplifyOrthogonalGuidePoints,
  };
}
