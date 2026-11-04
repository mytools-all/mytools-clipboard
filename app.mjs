import {
  $,
  $$,
  action,
  copy,
  status,
  ready,
  call,
  escapeHtml,
  confirmAction,
} from "./common.mjs";
let entries = [],
  selected = new Set(),
  hidden = new Set(),
  kind = "all",
  cursor = 0;
const isImage = (e) =>
  /^data:image\/(png|jpeg|bmp);base64,/.test(e.content || "");
const visible = () =>
  entries.filter(
    (e) =>
      !hidden.has(e.id) &&
      (kind === "all" || (kind === "image" ? isImage(e) : !isImage(e))) &&
      String(e.content || "")
        .toLowerCase()
        .includes($("#search").value.toLowerCase()),
  );
function showDetail() {
  const chosen = entries.filter((e) => selected.has(e.id));
  $("#count").textContent = "已选 " + chosen.length + " 条";
  const el = $("#detail");
  el.replaceChildren();
  if (!chosen.length) {
    el.innerHTML = '<div class="empty">选择一条记录预览</div>';
    return;
  }
  for (const e of chosen) {
    if (isImage(e)) {
      const img = new Image();
      img.src = e.content;
      img.alt = "剪贴板图片";
      el.append(img);
    } else {
      const pre = document.createElement("pre");
      pre.textContent = e.content;
      el.append(pre);
    }
  }
}
function render() {
  const list = visible();
  cursor = Math.max(0, Math.min(cursor, list.length - 1));
  $("#records").innerHTML = list.length
    ? list
        .map(
          (e, i) =>
            '<div class="record ' +
            (selected.has(e.id) ? "selected" : "") +
            '" data-id="' +
            e.id +
            '" tabindex="0">' +
            (isImage(e)
              ? '<img src="' + escapeHtml(e.content) + '" alt="剪贴板图片">'
              : "<pre>" + escapeHtml(e.content) + "</pre>") +
            "<small>" +
            new Date(e.created_at || e.createdAt).toLocaleString() +
            " · " +
            (isImage(e) ? "图片" : (e.content || "").length + " 字符") +
            "</small></div>",
        )
        .join("")
    : '<div class="empty">无匹配记录' +
      (kind === "image" ? " · 当前宿主仅采集文本历史" : "") +
      "</div>";
  $$(".record").forEach((el) => {
    el.onclick = (e) => {
      const id = Number(el.dataset.id);
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
      } else selected = new Set([id]);
      cursor = list.findIndex((x) => x.id === id);
      render();
    };
    el.ondblclick = action(copySelection);
  });
  showDetail();
}
async function refresh() {
  entries = await call("clipboard.history", { limit: 500 });
  selected = new Set(
    [...selected].filter((id) => entries.some((e) => e.id === id)),
  );
  render();
  status(entries.length + " 条历史 · Shift/Ctrl 多选 · Ctrl+C 合并复制");
}
async function copySelection() {
  const chosen = entries.filter((e) => selected.has(e.id));
  if (!chosen.length) throw Error("请先选择记录");
  if (chosen.some(isImage)) {
    if (chosen.length !== 1) throw Error("图片记录不能与文本合并");
    await call("clipboard.write", { dataUrl: chosen[0].content });
    status("图片已复制");
  } else
    await copy(
      chosen
        .map((e) => e.content)
        .join($("#separator").value === "newline" ? "\n" : $("#separator").value),
    );
}
$("#refresh").onclick = action(refresh);
$("#search").oninput = render;
$("#copy").onclick = action(copySelection);
$("#hide").onclick = () => {
  for (const id of selected) hidden.add(id);
  selected.clear();
  render();
  status("已隐藏，重新打开插件后恢复");
};
$("#delete").onclick = action(async () => {
  if (!selected.size) throw Error("请先选择记录");
  if (!await confirmAction("确定删除选中的 " + selected.size + " 条记录？")) return;
  for (const id of selected) await call("clipboard.remove", { id });
  selected.clear();
  await refresh();
});
$$("#types button").forEach(
  (b) =>
    (b.onclick = () => {
      kind = b.dataset.type;
      $$("#types button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    }),
);
document.addEventListener(
  "keydown",
  action(async (e) => {
    if (e.target.matches("input,textarea,select")) return;
    const list = visible();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      await copySelection();
    } else if (["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
      e.preventDefault();
      cursor =
        (cursor + (e.key === "ArrowUp" || e.shiftKey ? -1 : 1) + list.length) %
        Math.max(1, list.length);
      if (list[cursor]) {
        selected = new Set([list[cursor].id]);
        render();
        $('[data-id="' + list[cursor].id + '"]')?.scrollIntoView({
          block: "nearest",
        });
      }
    } else if (e.key === "Delete" || e.key === "Backspace")
      $("#delete").click();
    else if (e.key === "Enter") await copySelection();
    else if (
      e.key === "/" ||
      ((e.ctrlKey || e.metaKey) && ["f", "l"].includes(e.key))
    ) {
      e.preventDefault();
      $("#search").focus();
    }
  }),
);
ready(refresh);
