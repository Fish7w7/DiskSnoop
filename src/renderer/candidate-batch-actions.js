(function initializeCandidateBatchActions(root) {
  async function processItemsIndependently(items, moveItem) {
    const successes = [];
    const failures = [];
    for (const item of items || []) {
      try {
        const value = await moveItem(item);
        successes.push({ item, value });
      } catch (error) {
        failures.push({ item, error });
      }
    }
    return {
      successes,
      failures,
      movedCount: successes.length,
      failedCount: failures.length
    };
  }

  function replaceSelectionWithAiDelete(selectedIds, candidates, classifications, canMove) {
    selectedIds.clear();
    let total = 0;
    let protectedCount = 0;
    for (const item of candidates || []) {
      if (classifications.get(String(item.id)) !== "APAGAR") continue;
      total += 1;
      if (!canMove(item)) {
        protectedCount += 1;
        continue;
      }
      selectedIds.add(item.id);
    }
    return { total, selectedCount: selectedIds.size, protectedCount };
  }

  function moveFailureKind(message) {
    const normalized = String(message || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalized.includes("ebusy")
      || normalized.includes("enotempty")
      || normalized.includes("resource busy")
      || normalized.includes("em uso")
      || normalized.includes("usado por outro processo")) return "in-use";
    if (normalized.includes("eacces")
      || normalized.includes("eperm")
      || normalized.includes("access denied")
      || normalized.includes("permission denied")
      || normalized.includes("acesso negado")
      || normalized.includes("permissao")) return "access-denied";
    if (normalized.includes("protegido")
      || normalized.includes("sensivel")
      || normalized.includes("dados internos")
      || normalized.includes("disksnoop nao move")
      || normalized.includes("bloqueia isso por seguranca")) return "protected";
    return "other";
  }

  const api = {
    processItemsIndependently,
    replaceSelectionWithAiDelete,
    moveFailureKind
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.diskSnoopCandidateBatchActions = api;
})(typeof window !== "undefined" ? window : null);
