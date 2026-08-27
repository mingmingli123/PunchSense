# TPU Snake Path Labeling Rules

This document records the current rules for TPU serpentine path identity, length statistics, UI display, and exported G-code filenames.

## Goal

Each TPU snake path must keep its original user-facing identity even when another path fails to generate.

For example, if paths 1-5 exist and path 2 fails, generated paths may be:

- Path 1
- Path 3
- Path 4
- Path 5

They must not be compressed into paths 1-4.

## Source Of Truth

The source of truth for path identity is `state.tpuSnake.connections`.

Each connection has:

- `label`: user-facing label, such as `1`, `2`, or `SVG5`.
- array index: stable UI card position.
- `targetLength`: independent target length for that path.

Generated path arrays carry metadata:

- `sourceConnectionIndex`
- `sourceConnectionLabel`

These values are assigned in `js/snake/path.js` when a snake path is successfully generated.

## Statistics Alignment

`js/snake/layer_model.js` computes actual length statistics from final printable T0 paths.

The stats are then aligned back to `state.tpuSnake.connections`:

- match by `sourceConnectionIndex` first.
- fall back to `sourceConnectionLabel`.
- failed paths are omitted from `stats.items`, but UI cards still remain because cards are rendered from `state.tpuSnake.connections`.

This prevents later paths from shifting upward when an earlier path fails.

## UI Display

`js/snake/ui.js` renders one card per connection.

For each card:

- If a matching stats item exists, show actual length and error.
- If no matching stats item exists, show `未生成`.

This is intentional. A failed path should be visible as a failed path, not hidden by compacting the list.

## Filename Rule

`js/project/file_exports.js` exports G-code filenames with path labels included.

Expected format:

```text
YYYYMMDD_HHMMSS_EPI12_L1_Snake_PSVG1-48p7_PSVG3-87p5_PSVG4-58p8_PSVG5-518p1mm.gcode
```

Do not return to the old compact format:

```text
YYYYMMDD_HHMMSS_EPI12_L1_Snake48p7-87p5-58p8-518p1mm.gcode
```

The old format is ambiguous when one path fails.

## Cache Busting

When changing any module involved in path stats or filenames, update the version query in `index.html` and affected imports in `script.js`.

Important modules:

- `js/snake/path.js`
- `js/snake/layer_model.js`
- `js/snake/ui.js`
- `js/project/file_exports.js`
- `js/gcode_path_helpers.js`

Without cache busting, the browser may keep using stale filename or UI logic.
