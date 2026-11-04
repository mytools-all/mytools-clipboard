import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("confirmation waits for the user's choice and Esc cancels", async () => {
  let dialog;
  const element = () => ({style:{},children:[],append(...items){this.children.push(...items);},showModal(){},close(){},remove(){this.removed=true;},focus(){}});
  const source = (await readFile(new URL("common.mjs", import.meta.url), "utf8")).replace(/export /g, "") + "\nglobalThis.confirmAction = confirmAction;";
  const context = {document:{querySelector:()=>null,documentElement:{dataset:{}},body:{append(value){dialog=value;}},createElement:element},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false})};
  vm.runInNewContext(source, context);
  let resolved = false;
  const accepted = context.confirmAction("测试确认").then(value=>{resolved=true;return value;});
  await Promise.resolve();
  assert.equal(resolved, false);
  dialog.children[2].onclick();
  assert.equal(await accepted, true);
  assert.equal(dialog.removed, true);
  const cancelled = context.confirmAction("测试取消");
  dialog.oncancel({preventDefault(){}});
  assert.equal(await cancelled, false);
  const buttonCancelled = context.confirmAction("按钮取消");
  dialog.children[1].onclick();
  assert.equal(await buttonCancelled, false);
});
