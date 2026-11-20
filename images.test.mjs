import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { Window } from "happy-dom";

test("image history is previewed and copied as an image, while data-URL text stays text", async () => {
  const window = new Window({ settings: { disableJavaScriptFileLoading: true } });
  try {
    window.document.write(readFileSync(new URL("index.html", import.meta.url), "utf8").replace(/<script[\s\S]*?<\/script>/g, ""));
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const entries = [
      { id: 1, kind: "text", content: png, created_at: "2026-11-19T00:00:00Z" },
      { id: 2, kind: "image", content: png, created_at: "2026-11-19T00:00:00Z" },
    ];
    const requests = [];
    let ready;
    window.mytools = { onPluginReady(callback) { ready = callback; }, async call(id, args) {
      requests.push({ id, args });
      if (id === "clipboard.history") return entries;
      return null;
    }};
    const context = vm.createContext({ window, document: window.document, Image: window.Image,
      localStorage: window.localStorage, matchMedia: window.matchMedia.bind(window), setTimeout, clearTimeout });
    vm.runInContext(readFileSync(new URL("common.mjs", import.meta.url), "utf8").replace(/export /g, ""), context);
    vm.runInContext(readFileSync(new URL("app.mjs", import.meta.url), "utf8").replace(/import[\s\S]*?from\s+"[^"]+";/g, ""), context);
    await ready();
    assert.equal(window.document.querySelectorAll(".record img").length, 1);
    assert.equal(window.document.querySelector('[data-id="1"] pre').textContent, png);
    window.document.querySelector('[data-id="2"]').onclick(new window.MouseEvent("click"));
    assert.equal(window.document.querySelector("#detail img").getAttribute("src"), png);
    await window.document.querySelector("#copy").onclick();
    assert.equal(requests.at(-1).id, "clipboard.write");
    assert.equal(requests.at(-1).args.dataUrl, png);
    assert.equal(requests.at(-1).args.text, undefined);
    window.document.querySelector('[data-type="image"]').click();
    assert.equal(window.document.querySelectorAll(".record").length, 1);
    assert.equal(window.document.querySelector(".record").dataset.id, "2");
    window.document.querySelector('[data-type="text"]').click();
    assert.equal(window.document.querySelector(".record").dataset.id, "1");
  } finally { window.close(); }
});
