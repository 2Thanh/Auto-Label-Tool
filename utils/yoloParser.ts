import { BoundingBox, LabelClass } from "../types";
import { LABEL_COLORS } from "../constants";

export const parseYoloFile = (
  content: string,
  availableClasses: LabelClass[]
): Omit<BoundingBox, 'id'>[] => {
  const lines = content.split('\n');
  const boxes: Omit<BoundingBox, 'id'>[] = [];

  // Create a map for faster lookup
  const idMap = new Map<number, string>();
  availableClasses.forEach(c => idMap.set(c.id, c.name));

  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const classId = parseInt(parts[0]);
      const xCenter = parseFloat(parts[1]);
      const yCenter = parseFloat(parts[2]);
      const width = parseFloat(parts[3]);
      const height = parseFloat(parts[4]);

      // Convert YOLO (center) to Box (top-left)
      const x = xCenter - width / 2;
      const y = yCenter - height / 2;

      // Look up the name by explicit ID, or fallback to generic
      const label = idMap.get(classId) || `class_${classId}`;
      
      boxes.push({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(1, width),
        height: Math.min(1, height),
        label,
        color: LABEL_COLORS[classId % LABEL_COLORS.length] || '#ccc'
      });
    }
  });

  return boxes;
};