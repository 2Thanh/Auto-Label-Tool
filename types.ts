export interface BoundingBox {
  id: string;
  x: number; // Percentage 0-1
  y: number; // Percentage 0-1
  width: number; // Percentage 0-1
  height: number; // Percentage 0-1
  label: string;
  color: string;
}

export interface LabelClass {
  id: number;
  name: string;
}

export interface DatasetImage {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  boxes: BoundingBox[];
}

export interface ClassStat {
  name: string;
  count: number;
  color: string;
  [key: string]: any;
}

// Format expected from external Python scripts or Gemini
export interface ExternalModelPrediction {
  label: string;
  ymin: number; // 0-1
  xmin: number; // 0-1
  ymax: number; // 0-1
  xmax: number; // 0-1
  score?: number;
}