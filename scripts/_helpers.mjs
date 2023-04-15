import {MODULE} from "./settings.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * Returns whether an item or spell requires concentration.
 * @param {Item5e} item     The item or spell.
 * @returns {boolean}       Whether it requires concentration.
 */
export function _requiresConcentration(item) {
  if (item.type === "spell") return !!item.system.components.concentration;
  return !!item.flags[MODULE]?.data.requiresConcentration;
}

/**
 * Returns whether and why an item being used should affect current concentration. Used to determine
 * if concentration should be changed, and for the ability use dialog to determine if it should
 * display a warning. The returned value is either false or truthy.
 * @param {Item5e} item                   The item being used right now.
 * @param {boolean} [isDialog=false]      Whether the function is being used for the AbilityUseDialog.
 * @returns {string|boolean}              Truthy string, or false if the items are the same.
 */
export function _itemUseAffectsConcentration(item, isDialog = false) {
  // new item requires concentration:
  if (!_requiresConcentration(item)) return false;

  // if you are not concentrating:
  const isConc = API.isActorConcentrating(item.parent);
  if (!isConc) return "FREE";

  // if you are concentrating on an entirely different item:
  const concDiff = isConc.flags[MODULE].data.castData.itemUuid !== item.uuid;
  if (concDiff) return "DIFFERENT";

  // if you are concentrating on the same item but at a different level:
  const concNotSame = isConc.flags[MODULE].data.castData.castLevel !== item.system.level;
  if (concNotSame) return "LEVEL";

  // For AbilityUseDialog warning, only show it for spells of 1st level or higher.
  if (isDialog && (item.type === "spell") && (item.system.level > 0)) return "LEVEL";

  return false;
}
