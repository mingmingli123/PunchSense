// PCB profiles extracted from reference 3MF models.
// Coordinates are local millimeters from the board lower-left bounding-box corner.

export const PCB_PROFILES = {
  xiaoEsp32c3: {
    id: "xiao-esp32c3",
    name: "Seeed Studio XIAO ESP32C3",
    source: "Seeed Studio XIAO ESP32C3.3mf",
    board: {
      width: 20.955,
      height: 17.782,
      thickness: 1.825,
    },
    selectableHoles: [
      { id: "bottom_1", label: "Bottom 1", x: 2.794, y: 1.270, diameter: 0.85 },
      { id: "bottom_2", label: "Bottom 2", x: 5.334, y: 1.270, diameter: 0.85 },
      { id: "bottom_3", label: "D2 / GPIO4 / SEND", pinName: "D2", gpio: "GPIO4", role: "send", x: 7.874, y: 1.270, diameter: 0.85 },
      { id: "bottom_4", label: "Bottom 4", x: 10.414, y: 1.270, diameter: 0.85 },
      { id: "bottom_5", label: "Bottom 5", x: 12.954, y: 1.270, diameter: 0.85 },
      { id: "bottom_6", label: "Bottom 6", x: 15.494, y: 1.270, diameter: 0.85 },
      { id: "bottom_7", label: "Bottom 7", x: 18.034, y: 1.270, diameter: 0.85 },
      { id: "top_1", label: "D7 / GPIO20 / RECEIVE", pinName: "D7", gpio: "GPIO20", role: "receive", x: 2.794, y: 16.510, diameter: 0.85 },
      { id: "top_2", label: "Top 2", x: 5.334, y: 16.510, diameter: 0.85 },
      { id: "top_3", label: "Top 3", x: 7.874, y: 16.510, diameter: 0.85 },
      { id: "top_4", label: "Top 4", x: 10.414, y: 16.510, diameter: 0.85 },
      { id: "top_5", label: "Top 5", x: 12.954, y: 16.510, diameter: 0.85 },
      { id: "top_6", label: "GND / Ground", pinName: "GND", role: "ground", x: 15.494, y: 16.510, diameter: 0.85 },
      { id: "top_7", label: "Top 7", x: 18.034, y: 16.510, diameter: 0.85 },
    ],
    notes: [
      "Board object bounding box in the 3MF is 20.955 x 17.782 mm.",
      "Selectable holes are the two 7-position side rows detected from 0.85 mm openings in the Board mesh.",
      "D2 / GPIO4 is currently mapped to bottom_3 as SEND; D7 / GPIO20 is mapped to top_1 as RECEIVE; GND is mapped to top_6. Flip these labels if the placed board orientation is physically reversed.",
    ],
  },
};

export function pcbProfileById(id) {
  return PCB_PROFILES[id] ?? null;
}
