import {
  removeDuplicatePolylinePoints as dedupePolylinePoints,
} from "./path_utils.js";
import { roundedWipeTowerPath as buildRoundedWipeTowerPath } from "./wipe_tower_geometry.js";

export function createWipeTowerWriter(deps) {
  const {
    wipeTowerRect,
    referenceBodyPaths,
    referenceBrimPaths,
    toolForMaterial,
    toolProfile,
    toolTemp,
    toolFanSpeed,
    toolAuxFanSpeed,
    toolStandbyTemp,
    toolRetractSpeed,
    toolDeretractSpeed,
    materialFlow,
    extrusion,
    distance,
    g1,
    addLine,
    addRetractForTravel,
    consumePrimeAmount,
    rememberExtrusionSegment,
    markExtrusionRetracted,
    markExtrusionUnretracted,
    constants,
  } = deps;

  const {
    WIPE_TOWER_PRIME_SPREAD_MM,
  } = constants;

  function addWipeTowerShell(lines, c, z, printHeight, material, layerIndex, options = {}) {
    const includeBrim = options.includeBrim ?? layerIndex === 1;
    const tower = wipeTowerRect(c);
    lines.push(`; WIPE_TOWER_SHELL layer ${layerIndex} T${material} X${tower.x.toFixed(2)} Y${tower.y.toFixed(2)} W${tower.w.toFixed(2)} H${tower.h.toFixed(2)}`);
    lines.push(";TYPE:Prime tower");
    lines.push(";WIDTH:0.500");
    lines.push(`; WIPE_TOWER_BODY T${material}`);
    addReferenceWipeTowerPaths(lines, c, tower, referenceBodyPaths, z, printHeight, material, 0.5);
    if (includeBrim) addWipeTowerBrim(lines, c, tower, z, printHeight, material);
  }

  function addWipeTowerBrim(lines, c, tower, z, printHeight, material) {
    lines.push("; WIPE_TOWER_BRIM_START");
    addReferenceWipeTowerPaths(lines, c, tower, referenceBrimPaths, z, printHeight, material, 0.5);
    lines.push("; WIPE_TOWER_BRIM_END");
  }

  function addReferenceWipeTowerPaths(lines, c, tower, paths, z, printHeight, material, width) {
    const primeState = {
      remaining: consumePrimeAmount(c, material),
      spreadRemaining: WIPE_TOWER_PRIME_SPREAD_MM,
    };
    if (primeState.remaining > 0.0001) {
      lines.push(`; WIPE_TOWER_RESTART_PRIME_SPREAD ${primeState.remaining.toFixed(3)}mm over ${WIPE_TOWER_PRIME_SPREAD_MM.toFixed(1)}mm`);
    }
    for (const path of paths) {
      const points = path.map(([x, y]) => ({ x: tower.x + x, y: tower.y + y }));
      addReferencePolyline(lines, c, points, z, width, printHeight, material, primeState);
    }
  }

  function takeSpreadPrime(primeState, len) {
    if (!primeState || primeState.remaining <= 0.0001 || primeState.spreadRemaining <= 0.0001) return 0;
    const usedLength = Math.min(len, primeState.spreadRemaining);
    const prime = primeState.remaining * (usedLength / primeState.spreadRemaining);
    primeState.remaining = Math.max(0, primeState.remaining - prime);
    primeState.spreadRemaining = Math.max(0, primeState.spreadRemaining - usedLength);
    return prime;
  }

  function addReferencePolyline(lines, c, points, z, width, printHeight, material, primeState = null) {
    if (points.length < 2) return;
    const feed = 2151;
    addRetractForTravel(lines, c, points[0], material);
    lines.push(g1({ x: points[0].x, y: points[0].y, f: 7200 }));
    lines.push(g1({ z, f: 30000 }));
    for (let i = 1; i < points.length; i += 1) {
      const len = distance(points[i - 1], points[i]);
      if (len <= 0.001) continue;
      const prime = takeSpreadPrime(primeState, len);
      lines.push(g1({
        x: points[i].x,
        y: points[i].y,
        e: extrusion(len, width, printHeight, materialFlow(c, material)) + prime,
        f: feed,
      }));
      rememberExtrusionSegment(points[i - 1], points[i], feed);
    }
    markExtrusionUnretracted();
  }

  function roundedWipeTowerPath(tower, inset, radius = 1) {
    return buildRoundedWipeTowerPath(tower, inset, radius, removeDuplicatePolylinePoints);
  }

  function removeDuplicatePolylinePoints(points) {
    return dedupePolylinePoints(points, distance);
  }

  function addWipeTowerSparseBody(lines, c, z, printHeight, material, layerIndex) {
    const tower = wipeTowerRect(c);
    const step = Math.max(1.0, c.beadWidth * 2.4);
    const x0 = tower.x + c.beadWidth * 2.5;
    const x1 = tower.x + tower.w - c.beadWidth * 2.5;
    const y0 = tower.y + c.beadWidth * 2.5;
    const y1 = tower.y + tower.h - c.beadWidth * 2.5;
    const rows = [];
    for (let y = y0; y <= y1 + 0.001; y += step) rows.push(y);
    if (layerIndex % 2 === 0) rows.reverse();
    let current = null;
    for (let i = 0; i < rows.length; i += 1) {
      const leftToRight = i % 2 === 0;
      const start = { x: leftToRight ? x0 : x1, y: rows[i] };
      const end = { x: leftToRight ? x1 : x0, y: rows[i] };
      if (current && distance(current, start) > 0.001) addLine(lines, c, current, start, z, 0.35, printHeight, material);
      addLine(lines, c, start, end, z, 0.55, printHeight, material);
      current = end;
    }
  }

  function addWipeTowerPurge(lines, c, z, printHeight, material, upward = true) {
    const tower = wipeTowerRect(c);
    const step = 0.5;
    const x0 = tower.x + 0.25;
    const xInset = tower.x + 1.0;
    const x1 = tower.x + tower.w - 0.25;
    const x1Inset = tower.x + tower.w - 1.0;
    const slot = wipeTowerPurgeSlot(material);
    const purgeBandHeight = 3.0;
    const y0 = tower.y + 7.8 - slot * purgeBandHeight;
    const y1 = Math.max(tower.y + 1.8, y0 - purgeBandHeight);
    const feedSchedule = [990, 1125, 1374, 2151];
    const rows = [];
    for (let y = y0; y >= y1 - 0.001; y -= step) rows.push(y);
    if (rows.length === 0) return;
    if (!upward) rows.reverse();
    lines.push(`; WIPE_TOWER_PURGE T${material}`);
    lines.push(";TYPE:Prime tower");
    lines.push(";WIDTH:0.500");
    const first = { x: upward ? x0 : x1, y: rows[0] ?? y0 };
    lines.push(g1({ x: first.x, y: first.y, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));
    let current = first;
    rows.forEach((row, index) => {
      const leftToRight = index % 2 === 0;
      const start = { x: leftToRight ? x0 : x1, y: row };
      const end = { x: leftToRight ? x1 : x0, y: row };
      const feed = feedSchedule[Math.min(index, feedSchedule.length - 1)];
      if (distance(current, start) > 0.001) {
        addPurgeSegment(lines, c, current, start, z, printHeight, material, 0.5, feed);
        markExtrusionUnretracted();
      }
      addPurgeSegment(lines, c, start, end, z, printHeight, material, 0.5, feed);
      markExtrusionUnretracted();
      current = end;
      if (index < rows.length - 1) {
        const connector = {
          x: leftToRight ? x1Inset : xInset,
          y: rows[index + 1],
        };
        addPurgeSegment(lines, c, current, connector, z, printHeight, material, 0.5, feed);
        current = connector;
      }
    });
    markExtrusionUnretracted();
  }

  function wipeTowerPurgeSlot(material) {
    const order = [3, 0, 2, 1];
    const index = order.indexOf(toolForMaterial(material));
    return index >= 0 ? index : 0;
  }

  function addPurgeSegment(lines, c, start, end, z, printHeight, material, width, feed) {
    const len = distance(start, end);
    if (len <= 0.001) return;
    lines.push(g1({
      x: end.x,
      y: end.y,
      z,
      e: extrusion(len, width, printHeight, materialFlow(c, material)),
      f: feed,
    }));
    rememberExtrusionSegment(start, end, feed);
  }

  function addToolchangeUnloadWipe(lines, c, z, printHeight, material, upward = true) {
    const tower = wipeTowerRect(c);
    const x0 = upward ? tower.x + 34.25 : tower.x + 0.75;
    const x1 = upward ? tower.x + 33.827 : tower.x + 1.173;
    const y0 = upward ? tower.y + 8.05 : tower.y + 1.55;
    const y1 = upward ? tower.y + 7.3 : tower.y + 2.3;
    const feed = 812;
    lines.push(";WIDTH:1");
    lines.push(g1({ x: x0, y: y0, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));
    lines.push("SET_PRESSURE_ADVANCE ADVANCE=0.0200");
    lines.push(`G1 F${Math.round(feed)}`);
    lines.push(g1({
      x: x1,
      e: extrusion(Math.abs(x1 - x0), 1.0, printHeight, materialFlow(c, material)),
    }));
    lines.push(";WIDTH:0.5");
    lines.push(g1({ y: y1, f: 2400 }));
    lines.push("G4 S0");
  }

  function addToolChange(lines, c, material, z, previousMaterial = null, printHeight = c.layerHeight, layerIndex = 1, initialTool = 0) {
    const tool = toolForMaterial(material);
    if (previousMaterial === tool) return tool;
    const tower = wipeTowerRect(c);
    const towerPark = { x: tower.x + c.beadWidth * 2, y: tower.y + c.beadWidth * 2 };
    lines.push(";TYPE:Prime tower");
    lines.push(";WIDTH:0.500");
    lines.push(";--------------------");
    lines.push("; CP TOOLCHANGE START");
    lines.push(`; toolchange layer ${layerIndex}`);
    lines.push(`; material : ${previousMaterial === null ? "START" : toolProfile(previousMaterial, c).type} -> ${toolProfile(tool, c).type}`);
    lines.push(";--------------------");
    lines.push("; WIPE_TOWER_START");
    lines.push("M220 B");
    lines.push("M220 S100");
    if (previousMaterial !== null) {
      lines.push("; CP TOOLCHANGE UNLOAD");
      addToolchangeUnloadWipe(lines, c, z, printHeight, previousMaterial, layerIndex % 2 === 1);
      lines.push(`G1 E-2 F${Math.round(toolRetractSpeed(previousMaterial, c) * 60)}`);
      markExtrusionRetracted("tower");
      lines.push("G91");
      lines.push("G1 Z1.5 F1800");
      lines.push("G90");
      lines.push("; filament end gcode");
      lines.push(`M104 S${toolStandbyTemp(previousMaterial, c)} T${previousMaterial} ; set nozzle temperature ;cooldown`);
      lines.push(`; Change Tool${previousMaterial} -> Tool${tool} (layer ${layerIndex - 1})`);
    } else {
      lines.push(`; Change START -> Tool${tool} (layer ${layerIndex - 1})`);
      lines.push(g1({ x: towerPark.x, y: towerPark.y, f: 21000 }));
      lines.push("G91");
      lines.push("G1 Z1.5 F1800");
      lines.push("G90");
    }
    lines.push("G1 F21000");
    lines.push("");
    lines.push(`; ${tool}`);
    lines.push(`M109 S${toolTemp(tool, c, layerIndex === 1)} T${tool}`);
    lines.push("M400");
    if (previousMaterial !== null) {
      lines.push(`T${tool}`);
      if (tool !== initialTool) lines.push(`SM_PRINT_PREEXTRUDE_FILAMENT INDEX=${tool}`);
    } else {
      lines.push(`T${tool}`);
    }
    lines.push("G90");
    lines.push("");
    lines.push(`M106 P2 S${toolAuxFanSpeed(tool, c)}`);
    lines.push(`M106 S${toolFanSpeed(tool, c)}`);
    lines.push("; filament start gcode");
    lines.push(`M104 S${toolTemp(tool, c, layerIndex === 1)} T${tool} ; set nozzle temperature`);
    lines.push("");
    lines.push("G1 F30000");
    lines.push(g1({ z, f: 30000 }));
    if (previousMaterial !== null && tool === initialTool) {
      lines.push(`G1 E2 F${Math.round(toolDeretractSpeed(tool, c) * 60)}`);
      markExtrusionUnretracted();
    }
    lines.push("G4 S0");
    lines.push("; CP TOOLCHANGE WIPE");
    lines.push("G92 E0");
    addWipeTowerPurge(lines, c, z, printHeight, tool, layerIndex % 2 === 1);
    lines.push("; WIPE_TOWER_END");
    lines.push("M220 R");
    lines.push("G1 F30000");
    lines.push("G4 S0");
    lines.push("G92 E0");
    lines.push("; CP TOOLCHANGE END");
    lines.push(";------------------");
    return tool;
  }

  return {
    addToolChange,
    addWipeTowerShell,
    addWipeTowerPurge,
    addWipeTowerSparseBody,
    roundedWipeTowerPath,
  };
}
