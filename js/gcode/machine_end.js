export function buildMachineEndLines({ g1 }) {
  return [
    g1({ z: 5, f: 30000 }),
    "M106 S0",
    "M106 P2 S0",
    ";TYPE:Custom",
    "; filament end gcode",
    "PRINT_END",
    "TIMELAPSE_STOP",
    "M73 P100 R0",
    "; EXECUTABLE_BLOCK_END",
  ];
}
