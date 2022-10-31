import { MODULE } from "./settings.mjs";
import {
  _itemUseAffectsConcentration,
  _requiresConcentration
} from "./_helpers.mjs";
import { API } from "./_publicAPI.mjs";

export function setHooks_abilityUseDialog() {
  /**
   * When using an item that requires concentration, force the
   * AbilityUseDialog to display a warning about loss of concentration.
   */
  Hooks.on("dnd5e.preUseItem", (item, config) => {
    if (!_requiresConcentration(item)) return;
    const reason = _itemUseAffectsConcentration(item);
    if (reason && reason !== "FREE") {
      config.needsConfiguration = true;
    }
  });

  /**
   * Inject the warning into the DOM.
   */
  Hooks.on("renderAbilityUseDialog", (dialog, html) => {
    // does the item being used require concentration?
    const item = dialog.item;
    if (!_requiresConcentration(item)) return;

    // get the reason this could affect concentration.
    const reason = _itemUseAffectsConcentration(item, true);

    // if it won't affect it:
    if (!reason || reason === "FREE") return;

    // construct warning.
    const notes = html[0].querySelector(".notes"); // insert below this.
    const effect = API.isActorConcentrating(item.parent);
    const locale = _getWarning(reason, item, effect);
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
    } else string = "CN.ABILITY_DIALOG_WARNING.ITEM";
  } else if (reason === "LEVEL") {
    string = "CN.ABILITY_DIALOG_WARNING.SPELL_SAME";
  }
  const oldItemName = effect.getFlag(MODULE, "data.itemData.name");
  const oldLevel = effect.getFlag(MODULE, "data.castData.castLevel");
  return game.i18n.format(string, { item: oldItemName, level: oldLevel });
}
