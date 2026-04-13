import { BoundingBox, DatasetImage, LabelClass, ReviewRules, RuleViolation } from '../types';

export const DEFAULT_REVIEW_RULES: ReviewRules = {
  minBoxCount: 1,
  maxBoxCount: 0,
  minConfidenceScore: 0,
  requiredClasses: [],
  forbiddenClasses: [],
};

export function countsByClass(boxes: BoundingBox[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const box of boxes) {
    counts[box.label] = (counts[box.label] || 0) + 1;
  }
  return counts;
}

export function checkRulesForImage(
  image: DatasetImage,
  rules: ReviewRules
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const { boxes } = image;

  // Min box count
  if (rules.minBoxCount > 0 && boxes.length < rules.minBoxCount) {
    violations.push({
      rule: 'Min box count',
      detail: `Requires at least ${rules.minBoxCount} box(es), found ${boxes.length}.`,
    });
  }

  // Max box count
  if (rules.maxBoxCount > 0 && boxes.length > rules.maxBoxCount) {
    violations.push({
      rule: 'Max box count',
      detail: `Allows at most ${rules.maxBoxCount} box(es), found ${boxes.length}.`,
    });
  }

  // Min confidence score — only checked on boxes that have a score
  if (rules.minConfidenceScore > 0) {
    const scoredBoxes = boxes.filter(b => b.score !== undefined);
    const failing = scoredBoxes.filter(b => (b.score as number) < rules.minConfidenceScore);
    if (failing.length > 0) {
      violations.push({
        rule: 'Min confidence score',
        detail: `${failing.length} box(es) below confidence threshold ${rules.minConfidenceScore.toFixed(2)}.`,
      });
    }
  }

  // Required classes
  if (rules.requiredClasses.length > 0) {
    const presentLabels = new Set(boxes.map(b => b.label));
    const missing = rules.requiredClasses.filter(cls => !presentLabels.has(cls));
    if (missing.length > 0) {
      violations.push({
        rule: 'Required classes',
        detail: `Missing required class(es): ${missing.join(', ')}.`,
      });
    }
  }

  // Forbidden classes
  if (rules.forbiddenClasses.length > 0) {
    const presentLabels = new Set(boxes.map(b => b.label));
    const found = rules.forbiddenClasses.filter(cls => presentLabels.has(cls));
    if (found.length > 0) {
      violations.push({
        rule: 'Forbidden classes',
        detail: `Contains forbidden class(es): ${found.join(', ')}.`,
      });
    }
  }

  return violations;
}

function generateYoloLine(box: BoundingBox, classes: LabelClass[]): string | null {
  const cls = classes.find(c => c.name === box.label);
  if (!cls) return null;
  const xc = Math.max(0, Math.min(1, box.x + box.width / 2));
  const yc = Math.max(0, Math.min(1, box.y + box.height / 2));
  const w = Math.max(0, Math.min(1, box.width));
  const h = Math.max(0, Math.min(1, box.height));
  return `${cls.id} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
}

/**
 * Export an approved image + its YOLO label file to a directory.
 * Uses File System Access API when available; falls back to ZIP download.
 */
export async function exportApprovedImage(
  image: DatasetImage,
  classes: LabelClass[],
  dirHandle?: FileSystemDirectoryHandle
): Promise<void> {
  const baseName = image.file.name.substring(0, image.file.name.lastIndexOf('.')) || image.file.name;
  const txtName = `${baseName}.txt`;
  const labelLines = image.boxes
    .map(b => generateYoloLine(b, classes))
    .filter((l): l is string => l !== null);
  const labelContent = labelLines.join('\n');

  if (dirHandle) {
    // Write image file
    const imgHandle = await dirHandle.getFileHandle(image.file.name, { create: true });
    const imgWritable = await imgHandle.createWritable();
    await imgWritable.write(image.file);
    await imgWritable.close();

    // Write label .txt file
    const txtHandle = await dirHandle.getFileHandle(txtName, { create: true });
    const txtWritable = await txtHandle.createWritable();
    await txtWritable.write(labelContent);
    await txtWritable.close();

    // Upsert classes.txt
    try {
      const clsHandle = await dirHandle.getFileHandle('classes.txt', { create: true });
      const clsWritable = await clsHandle.createWritable();
      const sortedClasses = [...classes].sort((a, b) => a.id - b.id);
      await clsWritable.write(sortedClasses.map(c => c.name).join('\n'));
      await clsWritable.close();
    } catch {
      // Non-fatal — classes.txt update failure shouldn't block export
    }
    return;
  }

  // Fallback: zip download
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(image.file.name, image.file);
  zip.file(txtName, labelContent);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `approved_${baseName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
