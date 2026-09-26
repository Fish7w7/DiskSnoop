(function initializeContentBrowser(root) {
  function normalizeBrowserPath(value) {
    const raw = String(value || "").replaceAll("/", "\\").replace(/\\+$/, "");
    const segments = raw.split("\\");
    const normalized = [];
    for (const segment of segments) {
      if (!segment || segment === ".") continue;
      if (segment === "..") normalized.pop();
      else normalized.push(segment);
    }
    const prefix = raw.startsWith("\\\\") ? "\\\\" : "";
    return `${prefix}${normalized.join("\\")}`.toLowerCase();
  }

  function cleanDisplayPath(value) {
    const raw = String(value || "").replaceAll("/", "\\");
    return raw.length > 3 ? raw.replace(/\\+$/, "") : raw;
  }

  function canNavigateWithinRoot(rootPath, targetPath) {
    const rootKey = normalizeBrowserPath(rootPath);
    const targetKey = normalizeBrowserPath(targetPath);
    return Boolean(rootKey && targetKey && (targetKey === rootKey || targetKey.startsWith(`${rootKey}\\`)));
  }

  function createContentNavigation(rootPath) {
    const path = cleanDisplayPath(rootPath);
    return { rootPath: path, currentPath: path, history: path ? [path] : [] };
  }

  function navigateContentPath(navigation, targetPath) {
    const target = cleanDisplayPath(targetPath);
    if (!navigation || !canNavigateWithinRoot(navigation.rootPath, target)) return false;
    navigation.currentPath = target;
    navigation.history = contentBreadcrumbs(navigation).map((crumb) => crumb.path);
    return true;
  }

  function canGoBackContent(navigation) {
    if (!navigation || !canNavigateWithinRoot(navigation.rootPath, navigation.currentPath)) return false;
    return normalizeBrowserPath(navigation.currentPath) !== normalizeBrowserPath(navigation.rootPath);
  }

  function backContentPath(navigation) {
    if (!canGoBackContent(navigation)) return null;
    const ancestors = contentBreadcrumbs(navigation);
    ancestors.pop();
    navigation.currentPath = ancestors.at(-1)?.path || navigation.rootPath;
    navigation.history = ancestors.map((crumb) => crumb.path);
    return navigation.currentPath;
  }

  function contentBreadcrumbs(navigation) {
    if (!navigation?.rootPath || !navigation?.currentPath) return [];
    const rootPath = cleanDisplayPath(navigation.rootPath);
    const currentPath = cleanDisplayPath(navigation.currentPath);
    if (!canNavigateWithinRoot(rootPath, currentPath)) return [];
    const rootParts = rootPath.split("\\").filter(Boolean);
    const crumbs = [{ label: rootParts.at(-1) || rootPath, path: rootPath }];
    const relative = currentPath.slice(rootPath.length).replace(/^\\+/, "");
    let runningPath = rootPath;
    for (const segment of relative.split("\\").filter(Boolean)) {
      runningPath = `${runningPath}\\${segment}`;
      crumbs.push({ label: segment, path: runningPath });
    }
    return crumbs;
  }

  function compactContentBreadcrumbs(crumbs, maxVisible = 6) {
    const list = [...(crumbs || [])];
    const limit = Math.max(3, Number(maxVisible) || 6);
    if (list.length <= limit) return list;
    const tailCount = limit - 2;
    const hidden = list.slice(1, -tailCount);
    return [
      list[0],
      {
        label: "…",
        path: "",
        isEllipsis: true,
        hiddenLabels: hidden.map((crumb) => crumb.label)
      },
      ...list.slice(-tailCount)
    ];
  }

  function knownLargeFolderSizes(items) {
    const sizes = new Map();
    for (const item of items || []) {
      const key = normalizeBrowserPath(item?.path);
      if (key && Number.isFinite(Number(item?.size))) sizes.set(key, Number(item.size));
    }
    return sizes;
  }

  function decorateContentItems(items, scanSizes = new Map(), measuredSizes = new Map()) {
    return (items || []).map((item) => {
      const key = normalizeBrowserPath(item.path);
      const isFolder = item.type === "Pasta" || item.kind === "directory";
      if (!isFolder) {
        return { ...item, sizeKnown: true, displaySize: Number(item.size || 0) };
      }
      if (measuredSizes.has(key)) {
        return { ...item, sizeKnown: true, displaySize: Number(measuredSizes.get(key) || 0) };
      }
      if (scanSizes.has(key)) {
        return { ...item, sizeKnown: true, displaySize: Number(scanSizes.get(key) || 0) };
      }
      return { ...item, sizeKnown: false, displaySize: null };
    });
  }

  function sortContentItems(items, field = "name", direction = "asc") {
    const factor = direction === "desc" ? -1 : 1;
    return [...(items || [])].sort((left, right) => {
      if (field === "size" && left.sizeKnown !== right.sizeKnown) return left.sizeKnown ? -1 : 1;
      let comparison = 0;
      if (field === "size") comparison = Number(left.displaySize || 0) - Number(right.displaySize || 0);
      else if (field === "modified") comparison = new Date(left.modifiedAt || 0) - new Date(right.modifiedAt || 0);
      else if (field === "type") comparison = String(left.type || "").localeCompare(String(right.type || ""));
      else comparison = String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
      if (comparison) return comparison * factor;
      return String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
    });
  }

  function unknownContentFolders(items) {
    return (items || []).filter((item) => (item.type === "Pasta" || item.kind === "directory") && !item.sizeKnown);
  }

  async function measureUnknownContentFolders(items, measure, onProgress) {
    const targets = unknownContentFolders(items);
    const successes = [];
    const failures = [];
    let completed = 0;
    for (const item of targets) {
      try {
        const result = await measure(item);
        successes.push({ item, size: Number(result?.size || 0) });
        completed += 1;
        onProgress?.({ item, ok: true, size: Number(result?.size || 0), completed, total: targets.length });
      } catch (error) {
        failures.push({ item, error });
        completed += 1;
        onProgress?.({ item, ok: false, error, completed, total: targets.length });
      }
    }
    return { total: targets.length, successes, failures };
  }

  const api = {
    normalizeBrowserPath,
    canNavigateWithinRoot,
    createContentNavigation,
    navigateContentPath,
    canGoBackContent,
    backContentPath,
    contentBreadcrumbs,
    compactContentBreadcrumbs,
    knownLargeFolderSizes,
    decorateContentItems,
    sortContentItems,
    unknownContentFolders,
    measureUnknownContentFolders
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.diskSnoopContentBrowser = api;
})(typeof window !== "undefined" ? window : null);
