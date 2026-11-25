(function initializeCandidateSpace(root) {
  const CLEANUP_CONTEXT_VERSION = 3;
  const riskOrder = { low: 0, review: 1, high: 2, protected: 3 };

  function riskLevel(item) {
    if (Object.hasOwn(riskOrder, item?.riskLevel)) return item.riskLevel;
    if (["Sensivel", "Sensível"].some((value) => item?.risk === value || item?.security === value)) {
      return "protected";
    }
    return "review";
  }

  function pathKey(value) {
    let raw = String(value || "").replaceAll("/", "\\").toLowerCase();
    if (raw.startsWith("\\\\?\\unc\\")) raw = "\\\\" + raw.slice(8);
    else if (raw.startsWith("\\\\?\\")) raw = raw.slice(4);
    const prefix = raw.startsWith("\\\\") ? "\\\\" : raw.startsWith("\\") ? "\\" : "";
    const parts = [];
    const minimum = prefix === "\\\\" ? 2 : /^[a-z]:\\/.test(raw) ? 1 : 0;
    for (const part of raw.split("\\")) {
      if (!part || part === ".") continue;
      if (part === ".." && parts.length > minimum) parts.pop();
      else if (part !== "..") parts.push(part);
    }
    return prefix + parts.join("\\");
  }

  function parentKey(key) {
    const separator = key.lastIndexOf("\\");
    return separator > 0 ? key.slice(0, separator) : "";
  }

  function isDescendant(child, parent) {
    const root = pathKey(parent);
    return Boolean(root && pathKey(child).startsWith(`${root}\\`));
  }

  function deduplicatePaths(items) {
    const byPath = new Map();
    for (const item of items) {
      const key = pathKey(item?.path);
      if (!key) continue;
      const previous = byPath.get(key);
      if (!previous
        || riskOrder[riskLevel(item)] > riskOrder[riskLevel(previous)]
        || (riskLevel(item) === riskLevel(previous) && Number(item.size) > Number(previous.size))) {
        byPath.set(key, item);
      }
    }
    return [...byPath.values()];
  }

  function isDirectory(item) {
    return item.kind === "directory" || (!item.kind && (Array.isArray(item.children) || item.type === "Pasta"));
  }

  function removeCoveredItems(items, covers = () => true) {
    const unique = deduplicatePaths(items);
    const directories = new Map(unique.filter(isDirectory).map((item) => [pathKey(item.path), item]));
    return unique.filter((item) => {
      for (let parent = parentKey(pathKey(item.path)); parent; parent = parentKey(parent)) {
        const directory = directories.get(parent);
        if (directory && covers(directory, item)) return false;
      }
      return true;
    });
  }

  function uniqueBytes(items) {
    return removeCoveredItems(items).reduce((sum, item) => sum + Math.max(0, Number(item.size) || 0), 0);
  }

  function isReviewable(item) {
    return ["low", "review"].includes(riskLevel(item));
  }

  function spaceTotals(candidates, selected) {
    const unique = deduplicatePaths(candidates);
    return {
      occupied: uniqueBytes(unique),
      recoverable: uniqueBytes(unique.filter(isReviewable)),
      selected: uniqueBytes(selected.filter(isReviewable))
    };
  }

  function reliableModifiedTime(date, now = Date.now()) {
    if (date == null || date === "") return null;
    const time = new Date(date).getTime();
    return time >= Date.UTC(1990, 0, 1) && time <= now + 86400000 ? time : null;
  }

  const api = { CLEANUP_CONTEXT_VERSION, riskLevel, pathKey, isDescendant, deduplicatePaths, removeCoveredItems, uniqueBytes, isReviewable, spaceTotals, reliableModifiedTime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.diskSnoopCandidateSpace = api;
})(typeof window !== "undefined" ? window : null);
