(function initializeCandidateAiAnalysis(root) {
  const VALID_STATES = new Set(["APAGAR", "MANTER", "REVISAR"]);

  function candidateAnalysisId(candidate) {
    return String(candidate?.id || "").trim();
  }

  function buildAnalysisPrompt(items, options = {}) {
    const candidates = (items || []).filter((item) => candidateAnalysisId(item));
    if (!candidates.length) return "";
    const lines = [options.intro || ""];
    candidates.forEach((item, index) => {
      lines.push("", `${options.itemLabel || "Item"} ${index + 1}: ${item.name || item.path || "-"}`);
      lines.push(`- ${options.idLabel || "ID"}: ${candidateAnalysisId(item)}`);
      const details = options.formatDetails?.(item) || [];
      lines.push(...(Array.isArray(details) ? details : [String(details)]));
    });
    for (const footerLine of options.footerLines || []) {
      if (footerLine) lines.push("", footerLine);
    }
    return lines.join("\n");
  }

  function parseAnalysisResponse(text) {
    const entries = [];
    let invalid = 0;
    for (const rawLine of String(text || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || !line.includes("|")) continue;
      const match = line.match(/^([^|]+?)\s*\|\s*(APAGAR|MANTER|REVISAR)\s*$/);
      if (!match) {
        invalid += 1;
        continue;
      }
      const id = match[1].trim();
      const state = match[2];
      if (!id || !VALID_STATES.has(state)) {
        invalid += 1;
        continue;
      }
      entries.push({ id, state });
    }
    return { entries, invalid };
  }

  function associateAnalysisResponse(text, candidates) {
    const parsed = parseAnalysisResponse(text);
    const candidatesById = new Map((candidates || [])
      .map((candidate) => [candidateAnalysisId(candidate), candidate])
      .filter(([id]) => id));
    const classifications = new Map();
    const seenIds = new Set();
    const counts = { APAGAR: 0, MANTER: 0, REVISAR: 0 };
    let notFound = parsed.invalid;

    for (const entry of parsed.entries) {
      if (seenIds.has(entry.id) || !candidatesById.has(entry.id)) {
        notFound += 1;
        continue;
      }
      seenIds.add(entry.id);
      classifications.set(entry.id, entry.state);
      counts[entry.state] += 1;
    }

    return { classifications, counts, notFound };
  }

  const api = {
    VALID_STATES,
    candidateAnalysisId,
    buildAnalysisPrompt,
    parseAnalysisResponse,
    associateAnalysisResponse
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.diskSnoopCandidateAiAnalysis = api;
})(typeof window !== "undefined" ? window : null);
