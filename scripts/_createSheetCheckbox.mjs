import { MODULE } from "./settings.mjs";

export async function _createSheetCheckBox(sheet, html) {
  const item = sheet.document;
  if (item.type === "spell") return;
  const selector = "[name='system.duration.units']";
  const durationSelect = html[0].querySelector(selector);
  if (!durationSelect) return;

  const div = document.createElement("DIV");
  const template = `modules/${MODULE}/templates/concentrationCheckbox.hbs`;
  div.innerHTML = await renderTemplate(template, {
    requiresConcentration: !!item.flags[MODULE]?.data?.requiresConcentration
  });
  durationSelect.after(...div.children);
}
