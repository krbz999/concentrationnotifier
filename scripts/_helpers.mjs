import {CONCENTRATION_REASON, MODULE} from "./settings.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * Returns whether and why an item being used should affect current concentration. Used to determine if concentration
 * should be changed, and for the ability use dialog to determine if it should display a warning. If no specific reason
 * for one or other other is found, the function returns false.
 * @param {Item5e} item           The item being used.
 * @returns {number|boolean}      An integer from 'CONCENTRATION_REASON' or false.
 */
export function _itemUseAffectsConcentration(item) {
  const isSpell = item.type === "spell";

  // Case 0: Does this item even require concentration? (Do Nothing)
  const requires = itemRequiresConcentration(item);
  if (!requires) return CONCENTRATION_REASON.NOT_REQUIRED;

  /* The concentration effect already on the actor, if any. */
  const effect = API.isActorConcentrating(item.actor);

  // Case 1: Are you concentrating on something else?
  if (!effect) return CONCENTRATION_REASON.NOT_CONCENTRATING;

  // Case 2: Are you concentrating on an entirely different item?
  if (effect.flags[MODULE].data.castData.itemUuid !== item.uuid) return CONCENTRATION_REASON.DIFFERENT_ITEM;

  // Case 3: Are you concentrating on the same item at a different spell level?
  if (effect.flags[MODULE].data.castData.castLevel !== item.system.level) return CONCENTRATION_REASON.DIFFERENT_LEVEL;

  // Case 4: You are concentrating on the same item, at the same level, but it can be upcast.
  const canUpcast = isSpell && (item.system.level > 0) && CONFIG.DND5E.spellUpcastModes.includes(item.system.preparation.mode);
  if (canUpcast) return CONCENTRATION_REASON.UPCASTABLE;

  // None of the above are true, so the usage is 'free' far as concentration is concerned.
  return false;
}

function itemRequiresConcentration(item) {
  const isSpell = item.type === "spell";
  if (isSpell) return item.system.components.concentration;

  const units = item.system.duration?.units;
  return (units in CONFIG.DND5E.scalarTimePeriods) && !!item.flags[MODULE]?.data.requiresConcentration;
}