// Add plan links without modifying Case records or waveform evidence.
(() => {
  "use strict";

  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  async function start() {
    const list = document.querySelector("#caseList");
    if (!list) return;
    const response = await fetch("plans/manifest.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Plan manifest unavailable");
    const manifest = await response.json();
    if (manifest.version !== 1 || !Array.isArray(manifest.attachments)) {
      throw new Error("Plan manifest format is invalid");
    }
    const plans = new Map(manifest.attachments.map(item => [item.caseId, item]));
    if (Array.isArray(manifest.unlinkedPlans) && manifest.unlinkedPlans.length) {
      const registerLink = document.querySelector(".register-side-link");
      if (registerLink && !document.querySelector(".case-plan-library-link")) {
        const library = text("a", `待关联验证计划 · ${manifest.unlinkedPlans.length} 份`, "case-plan-library-link");
        library.href = "plans/library.html";
        library.target = "_blank";
        library.rel = "noopener";
        registerLink.after(library);
      }
    }

    function decorate() {
      for (const card of list.querySelectorAll(".case-card")) {
        const plan = plans.get(card.dataset.caseId);
        if (!plan) continue;
        const grid = card.querySelector(".detail-grid");
        const existing = card.querySelector(".case-plan-attachment");
        if (existing) {
          if (existing.previousElementSibling !== grid) grid.after(existing);
          continue;
        }
        const section = document.createElement("section");
        section.className = "case-plan-attachment";
        section.setAttribute("aria-label", "验证计划附件");
        section.append(text("strong", "验证计划附件"));
        const label = plan.category === "historical" ? "历史参考" :
          plan.category === "recovered" ? "可读副本" : "当前版本";
        section.append(text("span", label, "case-plan-source"));
        const links = document.createElement("span");
        links.className = "case-plan-links";
        const id = encodeURIComponent(plan.caseId);
        const view = text("a", "查看计划");
        view.href = `plans/${id}.html`;
        view.target = "_blank";
        view.rel = "noopener";
        const download = text("a", "下载原文件");
        download.href = `plans/${id}.md`;
        download.download = `${plan.name}_VERIFICATION_PLAN.md`;
        links.append(view, download);
        section.append(links);
        grid.after(section);
      }
    }

    decorate();
    new MutationObserver(decorate).observe(list, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { start().catch(console.error); }, { once: true });
  } else {
    start().catch(console.error);
  }
})();
