import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";
import { _itemUseAffectsConcentration } from "./_startConcentration.mjs";

export function setHooks_abilityUseDialog() {
  /**
   * When using an item that requires concentration,
   * if the setting is enabled, force the abilityUseDialog
   * to display a warning about loss of concentration.
   */
  Hooks.on("dnd5e.preUseItem", (item, config) => {
    if (!game.settings.get(MODULE, "show_ability_use_warning")) return;
    const isConc = item.type === "spell" ? item.system.components.concentration : item.getFlag(MODULE, "data.requiresConcentration");
    if (!isConc) return;

    const data = { castData: { castLevel: item.system.level } };
    const mustConc = _itemUseAffectsConcentration(item.parent, item, data);
    if (mustConc && mustConc !== "FREE") config.needsConfiguration = true;
  });

  /**
   * Inject the warning into the DOM.
   */
  Hooks.on("renderAbilityUseDialog", (dialog, html, dialogData) => {
    if (!game.settings.get(MODULE, "show_ability_use_warning")) return;
    const item = dialog.item;
    const isConc = API.isActorConcentrating(item.parent);
    if (!isConc) return;
    const data = { castData: { castLevel: item.system.level } };
    const reason = _itemUseAffectsConcentration(item.parent, item, data, true);
    if (!reason || reason === "FREE") return;
    const notes = html[0].querySelector(".notes"); // insert below this.
    const locale = _getWarning(reason, item, isConc);
    const DIV = document.createElement("DIV");
    DIV.innerHTML = `<p class="notification info">${locale}</p>`;
    notes.after(...DIV.children);
    dialog.setPosition({ height: "auto" });
  });
}

/**
 * Helper method for localization string in the abilityUseDialog warning,
 * depending on the reason that the new item may end concentration.
 */
function _getWarning(reason, item, effect) {
  let string = "";
  if (reason === "DIFFERENT") {
    if (item.type === "spell") {
      string = "CN.ABILITY_DIALOG_WARNING.SPELL_DIFF";
    }
    else string = "CN.ABILITY_DIALOG_WARNING.ITEM";
  } else if (reason === "LEVEL") {
    string = "CN.ABILITY_DIALOG_WARNING.SPELL_SAME";
  }
  const oldItemName = effect.getFlag(MODULE, "data.itemData.name");
  const oldLevel = effect.getFlag(MODULE, "data.castData.castLevel");
  return game.i18n.format(string, { item: oldItemName, level: oldLevel });
}
