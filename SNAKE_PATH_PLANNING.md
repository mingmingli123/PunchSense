# TPU Snake Path Planning Notes

This document describes the intended planning pipeline for black TPU serpentine paths.

## Core Principles

TPU snake paths are conductive traces. Their generated geometry should be stable, inspectable, and printable.

Required rules:

- The final path must lie on the EPI grid.
- The path should be orthogonal: horizontal and vertical segments only.
- The path should not self-intersect.
- The path should not reuse the same grid edge.
- Multiple snake paths should not share grid intersections.
- Failed paths must remain visible in the UI as failed paths instead of causing later paths to shift identity.

## Data Flow

The current path planning flow is:

```text
User/SVG endpoints
  -> connection records in state.tpuSnake.connections
  -> endpoint resolution on snapped T0 boundary/grid
  -> local corridor calculation
  -> source EPI grid bucket inside corridor
  -> candidate serpentine generation
  -> conflict and clearance validation
  -> final T0 path metadata
  -> material segment clipping
  -> G-code
```

## Endpoint Model

Original endpoint positions are only design intent.

The printable endpoint should be recomputed from snapped T0 geometry:

- start from the selected/raw endpoint.
- find the nearest suitable snapped T0 boundary/grid position.
- preserve or recompute a boundary normal.
- round the normal lead distance to whole EPI pitch when possible.

The relevant code lives in:

- `js/snake/endpoints.js`
- `js/snake/model.js`

Important endpoint metadata:

- `rawPoint`: original selected/imported point.
- `boundaryPoint`: intended boundary point.
- `normal`: preferred exit direction.
- `normalLeadLength`: requested perpendicular lead-in distance.

## Corridor Model

A corridor is the planning area for one snake path.

The corridor should be computed before generating the serpentine body. It should not depend on the final selected candidate length in a way that makes it shift unpredictably during target length edits.

The relevant code lives in:

- `js/snake/corridor.js`

The UI can visualize corridors to explain why a path can or cannot grow in a given direction.

## Regular Two-Endpoint Paths

For two endpoints without an explicit guide polyline:

- choose a corridor.
- build a source grid bucket inside that corridor.
- resolve endpoints onto that source grid.
- generate candidate serpentine paths.
- score by target length, endpoint direction, and uniformity.
- reject candidates that self-intersect, reuse edges, or conflict with occupied paths.

The current main generator remains in:

- `js/snake/path.js`

## SVG Guide Paths

Red open SVG strokes are treated as guide paths.

Guide paths are not final printable traces. They express routing intent.

Expected behavior:

- guide start/end should resolve to snapped T0 boundary/grid endpoints.
- guide intermediate points should be snapped to the printable EPI grid.
- guide-derived output should remain orthogonal.
- for long straight guide segments, the regular serpentine generator should be reused when possible.

## Conflict Handling

Conflict checks live in:

- `js/snake/conflicts.js`

Current checks include:

- overlap with blocked black TPU grid points.
- insufficient clearance from black TPU grid points.
- sharing grid points with previous snake paths.

When a path fails, its connection remains in `state.tpuSnake.connections`, but it has no matching stats item. The UI should show the card as `未生成`.

## Length Statistics

Length is computed from final printable path geometry, not from the original guide line.

Each generated path must carry:

- `sourceConnectionIndex`
- `sourceConnectionLabel`

See:

- `SNAKE_PATH_LABELS.md`
- `js/snake/layer_model.js`
- `js/project/file_exports.js`

## Future Algorithm Work

Known future improvements:

- make endpoint resolution consistently use snapped T0 boundary cells. Raw SVG or manually selected points are only intent; final endpoint coordinates, normals, and lead anchors should all be recomputed from the snapped T0 grid boundary.
- separate corridor selection from target-length fitting.
- generate uniform serpentine templates analytically rather than relying on many ad hoc candidates.
- support two-sided corridor use around the endpoint connecting line.
- make SVG guide segments delegate to regular serpentine planning for straight sections.
- expose useful debug data for selected path: endpoint, corridor, target, actual, and failure reason.
- treat any off-grid endpoint lead, diagonal connector, self-intersection, or repeated grid edge as an algorithm failure, not as geometry that should be hidden by G-code post-processing.
