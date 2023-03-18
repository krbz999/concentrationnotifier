import {MODULE} from "./settings.mjs";

/**
 * Hook function to add a checkbox for concentration on non-spell items.
 * @param {ItemSheet5e} sheet     The item sheet.
 * @param {html} html             The element of the sheet.
 */
export async function _createSheetCheckBox(sheet, html) {
  const item = sheet.document;
  if (item.type === "spell") return;
  const durationSelect = html[0].querySelector("[name='system.duration.units']");
  if (!durationSelect) return;

  const div = document.createElement("DIV");
  const template = `modules/${MODULE}/templates/concentrationCheckbox.hbs`;
  div.innerHTML = await renderTemplate(template, {
    requiresConcentration: item.flags[MODULE]?.data?.requiresConcentration
  });
  durationSelect.after(...div.children);
}
