(function initializeLargeFolderTree(root) {
  const MB = 1024 * 1024;

  function normalizeFolderPath(value) {
    return String(value || "")
      .replaceAll("/", "\\")
      .replace(/\\+$/, "")
      .toLowerCase();
  }

  function parentFolderPath(value) {
    const normalized = normalizeFolderPath(value);
    const separator = normalized.lastIndexOf("\\");
    if (separator <= 0) return "";
    return normalized.slice(0, separator);
  }

  function folderNodeKey(item) {
    return String(item?.id || normalizeFolderPath(item?.path));
  }

  function compareFolderSize(left, right) {
    const sizeDifference = Number(right?.item?.size || 0) - Number(left?.item?.size || 0);
    if (sizeDifference) return sizeDifference;
    return normalizeFolderPath(left?.item?.path).localeCompare(normalizeFolderPath(right?.item?.path));
  }

  function buildLargeFolderTree(items, rootComparator) {
    const nodes = (items || [])
      .filter((item) => item?.path)
      .map((item) => ({
        item,
        pathKey: normalizeFolderPath(item.path),
        children: [],
        originalChildCount: 0,
        matched: true
      }));
    const nodeByPath = new Map();
    for (const node of nodes) {
      if (!nodeByPath.has(node.pathKey)) nodeByPath.set(node.pathKey, node);
    }

    const roots = [];
    for (const node of nodes) {
      let ancestorPath = parentFolderPath(node.pathKey);
      let parent = null;
      while (ancestorPath) {
        parent = nodeByPath.get(ancestorPath) || null;
        if (parent) break;
        const nextPath = parentFolderPath(ancestorPath);
        if (!nextPath || nextPath === ancestorPath) break;
        ancestorPath = nextPath;
      }
      if (parent && parent !== node) parent.children.push(node);
      else roots.push(node);
    }

    const sortChildren = (node) => {
      node.children.sort(compareFolderSize);
      node.originalChildCount = node.children.length;
      node.children.forEach(sortChildren);
    };
    roots.forEach(sortChildren);
    roots.sort((left, right) => rootComparator?.(left.item, right.item) || compareFolderSize(left, right));
    return roots;
  }

  function filterLargeFolderTree(roots, predicate) {
    const filterNode = (node) => {
      const children = node.children.map(filterNode).filter(Boolean);
      const matched = predicate(node.item);
      if (!matched && !children.length) return null;
      return { ...node, children, matched };
    };
    return (roots || []).map(filterNode).filter(Boolean);
  }

  function approximatelyEqualFolderSizes(left, right, options = {}) {
    const first = Math.max(0, Number(left || 0));
    const second = Math.max(0, Number(right || 0));
    const toleranceRatio = Number(options.toleranceRatio ?? 0.02);
    const minimumTolerance = Number(options.minimumTolerance ?? 64 * MB);
    return Math.abs(first - second) <= Math.max(minimumTolerance, Math.max(first, second) * toleranceRatio);
  }

  function compressLargeFolderNode(node, options = {}) {
    const nodes = [node];
    let terminal = node;
    while (terminal.children.length === 1 && terminal.originalChildCount === 1) {
      const child = terminal.children[0];
      if (child.originalChildCount > 1) break;
      if (!approximatelyEqualFolderSizes(terminal.item.size, child.item.size, options)) break;
      nodes.push(child);
      terminal = child;
    }
    return {
      nodes,
      item: terminal.item,
      children: terminal.children,
      label: nodes.map((entry) => entry.item.name || entry.item.path).join(" › ")
    };
  }

  function flattenLargeFolderTree(roots, expandedIds, options = {}) {
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds || []);
    const rows = [];
    const visit = (node, depth) => {
      const visual = compressLargeFolderNode(node, options);
      const key = folderNodeKey(visual.item);
      const hasChildren = visual.children.length > 0;
      const contextExpanded = options.revealContext === true && visual.nodes.some((entry) => entry.matched === false);
      const isExpanded = hasChildren && (expanded.has(key) || contextExpanded);
      rows.push({
        ...visual,
        key,
        depth,
        hasChildren,
        expanded: isExpanded,
        contextExpanded
      });
      if (isExpanded) visual.children.forEach((child) => visit(child, depth + 1));
    };
    (roots || []).forEach((rootNode) => visit(rootNode, 0));
    return rows;
  }

  function collectLargeFolderTreeItems(roots) {
    const items = [];
    const visit = (node) => {
      items.push(node.item);
      node.children.forEach(visit);
    };
    (roots || []).forEach(visit);
    return items;
  }

  const api = {
    normalizeFolderPath,
    buildLargeFolderTree,
    filterLargeFolderTree,
    compressLargeFolderNode,
    flattenLargeFolderTree,
    collectLargeFolderTreeItems,
    approximatelyEqualFolderSizes
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.diskSnoopLargeFolderTree = api;
})(typeof window !== "undefined" ? window : null);
