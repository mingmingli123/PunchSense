export function createDomRefs(controlIds, doc = document) {
  const canvas = doc.getElementById("bedCanvas");
  return {
    canvas,
    ctx: canvas?.getContext("2d") ?? null,
    readout: doc.getElementById("readout"),
    svgImport: doc.getElementById("svgImport"),
    projectImport: doc.getElementById("projectImport"),
    svgImportStatus: doc.getElementById("svgImportStatus"),
    tpuSnakeStatus: doc.getElementById("tpuSnakeStatus"),
    tpuSnakeList: doc.getElementById("tpuSnakeList"),
    snakeManager: doc.querySelector(".snakeManager"),
    shapeSizeEditor: doc.getElementById("shapeSizeEditor"),
    controls: Object.fromEntries(controlIds.map((id) => [id, doc.getElementById(id)])),
  };
}
