(function initCustomSelect(globalScope) {
  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function escapeMarkup(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function calculateMenuPosition(triggerRect, menuSize, viewport, margin = 8, gap = 6) {
    const width = Math.min(Math.max(triggerRect.width, 160), Math.max(160, viewport.width - margin * 2));
    const left = clamp(triggerRect.left, margin, Math.max(margin, viewport.width - width - margin));
    const roomBelow = viewport.height - triggerRect.bottom - margin - gap;
    const roomAbove = triggerRect.top - margin - gap;
    const wantedHeight = Math.min(menuSize.height, 320);
    const opensUp = roomBelow < wantedHeight && roomAbove > roomBelow;
    const availableHeight = Math.max(72, opensUp ? roomAbove : roomBelow);
    const height = Math.min(wantedHeight, availableHeight);
    const top = opensUp
      ? Math.max(margin, triggerRect.top - gap - height)
      : Math.min(viewport.height - margin - height, triggerRect.bottom + gap);
    return { left, top, width, maxHeight: height, opensUp };
  }

  function needsMenuScroll(naturalHeight, maxHeight) {
    return naturalHeight > maxHeight + 0.5;
  }

  function nextEnabledIndex(options, startIndex, direction) {
    if (!options.length) return -1;
    let index = startIndex;
    for (let attempt = 0; attempt < options.length; attempt += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return startIndex;
  }

  function createCustomSelectController(doc = globalScope.document, view = globalScope) {
    let active = null;
    let idCounter = 0;

    function close({ restoreFocus = false } = {}) {
      if (!active) return false;
      const { trigger, menu, shell } = active;
      active = null;
      menu.remove();
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      shell.classList.remove("is-open", "opens-up");
      if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
      return true;
    }

    function positionActiveMenu() {
      if (!active) return;
      const { trigger, menu, shell } = active;
      const triggerRect = trigger.getBoundingClientRect();
      const borderHeight = Math.max(0, menu.offsetHeight - menu.clientHeight);
      const naturalHeight = menu.scrollHeight + borderHeight;
      const position = calculateMenuPosition(
        triggerRect,
        { height: naturalHeight },
        { width: view.innerWidth, height: view.innerHeight }
      );
      menu.classList.toggle("is-scrollable", needsMenuScroll(naturalHeight, position.maxHeight));
      menu.style.left = `${position.left}px`;
      menu.style.top = `${position.top}px`;
      menu.style.width = `${position.width}px`;
      menu.style.maxHeight = `${position.maxHeight}px`;
      menu.style.visibility = "visible";
      shell.classList.toggle("opens-up", position.opensUp);
    }

    function syncActiveOption({ scroll = true } = {}) {
      if (!active) return;
      const buttons = [...active.menu.querySelectorAll(".custom-select-option")];
      buttons.forEach((button, index) => {
        const isActive = index === active.activeIndex;
        const isSelected = index === active.select.selectedIndex;
        button.classList.toggle("is-active", isActive);
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-selected", String(isSelected));
      });
      const current = buttons[active.activeIndex];
      if (current) {
        active.trigger.setAttribute("aria-activedescendant", current.id);
        if (scroll) current.scrollIntoView({ block: "nearest" });
      }
    }

    function choose(index) {
      if (!active) return;
      const { select, trigger } = active;
      const option = select.options[index];
      if (!option || option.disabled) return;
      select.selectedIndex = index;
      trigger.querySelector(".custom-select-value").textContent = option.textContent;
      close();
      select.dispatchEvent(new globalScope.Event("change", { bubbles: true }));
    }

    function moveActive(direction) {
      if (!active) return;
      const options = [...active.select.options];
      active.activeIndex = nextEnabledIndex(options, active.activeIndex, direction);
      syncActiveOption();
    }

    function handleMenuKeydown(event) {
      if (!active) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        moveActive(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        const options = [...active.select.options];
        active.activeIndex = event.key === "Home"
          ? options.findIndex((option) => !option.disabled)
          : options.findLastIndex((option) => !option.disabled);
        syncActiveOption();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        choose(active.activeIndex);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: true });
        return;
      }
      if (event.key === "Tab") close();
    }

    function open(select, trigger) {
      if (active?.trigger === trigger) {
        close({ restoreFocus: true });
        return;
      }
      close();
      const options = [...select.options];
      if (!options.length || select.disabled) return;
      const menu = doc.createElement("div");
      const menuId = `custom-select-menu-${++idCounter}`;
      menu.id = menuId;
      menu.className = "custom-select-menu";
      menu.setAttribute("role", "listbox");
      menu.setAttribute("tabindex", "-1");
      menu.setAttribute("aria-label", select.getAttribute("aria-label") || trigger.textContent.trim());
      menu.style.visibility = "hidden";
      menu.innerHTML = options.map((option, index) => `
        <button id="${menuId}-option-${index}" class="custom-select-option" type="button" role="option" data-option-index="${index}" ${option.disabled ? "disabled" : ""}>
          <span>${escapeMarkup(option.textContent)}</span>
          <svg class="custom-select-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>
        </button>
      `).join("");
      doc.body.append(menu);
      const shell = select.closest(".select-shell");
      active = {
        select,
        trigger,
        shell,
        menu,
        activeIndex: select.selectedIndex >= 0 ? select.selectedIndex : nextEnabledIndex(options, -1, 1)
      };
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("aria-controls", menuId);
      shell.classList.add("is-open");
      menu.addEventListener("keydown", handleMenuKeydown);
      menu.addEventListener("pointermove", (event) => {
        const option = event.target.closest(".custom-select-option:not([disabled])");
        if (!option || !active) return;
        active.activeIndex = Number(option.dataset.optionIndex);
        syncActiveOption({ scroll: false });
      });
      menu.addEventListener("click", (event) => {
        const option = event.target.closest(".custom-select-option:not([disabled])");
        if (option) choose(Number(option.dataset.optionIndex));
      });
      positionActiveMenu();
      syncActiveOption({ scroll: false });
      menu.focus({ preventScroll: true });
    }

    function enhance(root) {
      root.querySelectorAll("select:not([data-custom-select-ready])").forEach((select) => {
        const shell = select.closest(".select-shell");
        if (!shell) return;
        select.dataset.customSelectReady = "true";
        select.classList.add("native-select-hidden");
        select.setAttribute("tabindex", "-1");
        select.setAttribute("aria-hidden", "true");
        shell.classList.add("is-custom-select");
        const trigger = doc.createElement("button");
        trigger.type = "button";
        trigger.className = "custom-select-trigger";
        trigger.disabled = select.disabled;
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.innerHTML = `
          <span class="custom-select-value"></span>
          <svg class="icon custom-select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5"/></svg>
        `;
        trigger.querySelector(".custom-select-value").textContent = select.selectedOptions[0]?.textContent || "";
        trigger.addEventListener("click", () => open(select, trigger));
        trigger.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            if (!active || active.trigger !== trigger) open(select, trigger);
            else moveActive(event.key === "ArrowDown" ? 1 : -1);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            open(select, trigger);
            return;
          }
          if (event.key === "Escape" && active?.trigger === trigger) {
            event.preventDefault();
            event.stopPropagation();
            close({ restoreFocus: true });
          }
        });
        select.insertAdjacentElement("afterend", trigger);
      });
    }

    doc.addEventListener("pointerdown", (event) => {
      if (active && !active.menu.contains(event.target) && !active.trigger.contains(event.target)) close();
    }, true);
    doc.addEventListener("scroll", (event) => {
      if (active && !active.menu.contains(event.target)) close();
    }, true);
    view.addEventListener("resize", () => close());

    return { enhance, close };
  }

  const exported = { calculateMenuPosition, needsMenuScroll, nextEnabledIndex, createCustomSelectController };
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (globalScope.document) globalScope.DiskSnoopCustomSelect = createCustomSelectController();
})(typeof window !== "undefined" ? window : globalThis);
