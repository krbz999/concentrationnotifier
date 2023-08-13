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

  // The current duration type must be in `CONFIG.DND5E.scalarTimePeriods`.
  const unit = foundry.utils.getProperty(sheet.document, "system.duration.units");
  if(!(unit in CONFIG.DND5E.scalarTimePeriods)) return;

  const div = document.createElement("DIV");
  const template = `modules/${MODULE}/templates/concentrationCheckbox.hbs`;
  div.innerHTML = await renderTemplate(template, {
    requiresConcentration: item.flags[MODULE]?.data?.requiresConcentration
  });
  durationSelect.after(...div.children);
}

/**
 * Hook function to add the concentration value to created scrolls.
 * @param {Item5e|object} spell         The spell or item data to be made into a scroll.
 * @param {object} spellScrollData      The final item data used to make the scroll.
 */
export function _addScrollConcentration(spell, spellScrollData) {
  const conc = foundry.utils.getProperty(spell, "system.components.concentration");
  if (conc) foundry.utils.setProperty(spellScrollData, `flags.${MODULE}.data.requiresConcentration`, true);
}
