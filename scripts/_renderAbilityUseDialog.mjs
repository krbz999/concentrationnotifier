import {CONCENTRATION_REASON, MODULE} from "./settings.mjs";
import {_itemUseAffectsConcentration} from "./_helpers.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * When using an item that requires concentration, force the AbilityUseDialog to display a warning about loss of
 * concentration if the item being used is an entirely different item than the one being concentrated on, if it's the same
 * item but at a different level, or if it's the same item but it can be upcast naturally.
 * Hooks on 'dnd5e.preUseItem'.
 * @param {Item} item         The item about to be used.
 * @param {object} config     The item usage configuration.
 */
export function _preAbilityUseDialog(item, config) {
  const reason = _itemUseAffectsConcentration(item);
  const conc = CONCENTRATION_REASON;
  const force = [conc.DIFFERENT_ITEM, conc.DIFFERENT_LEVEL, conc.UPCASTABLE].includes(reason);
  const unfocused = item.actor.flags.dnd5e?.concentrationUnfocused;
  if (force || unfocused) config.needsConfiguration = true;
}

/**
 * If a reason was found to warn about the potential loss (or lack) of concentration as a result of
 * using this item (potentially at only a different level), inject the warning into the DOM.
 * Hooks on 'renderAbilityUseDialog'.
 * @param {AbilityUseDialog} dialog     The dialog application instance.
 * @param {HTMLElement[]} html          The html of the dialog.
 */
export function _abilityUseDialog(dialog, html) {
  // Retrieve the reason this could affect concentration.
  const reason = _itemUseAffectsConcentration(dialog.item);
  const conc = CONCENTRATION_REASON;

  // If the item does not require concentration, do nothing.
  if (reason === conc.NOT_REQUIRED) return;

  /* Can this actor concentrate on an item? */
  const unfocused = dialog.item.actor.flags.dnd5e?.concentrationUnfocused;

  // If the actor is able to concentrate on an item, but aren't, do nothing.
  if ((reason === conc.NOT_CONCENTRATING) && !unfocused) return;

  // construct warning.
  const notes = html[0].querySelector(".notes"); // insert below this.
  const effect = API.isActorConcentrating(dialog.item.actor);
  const locale = _getWarning(reason, dialog.item, effect);
  const div = document.createElement("DIV");
  div.innerHTML = `<p class="notification concentrationnotifier">${locale}</p>`;
  notes.after(...div.children);
  dialog.setPosition({height: "auto"});
}

/**
 * Helper method for localization string in the AbilityUseDialog warning,
 * depending on the reason that the new item may end concentration.
 * @param {number} reason           An integer from 'CONCENTRATION_REASON'.
 * @param {Item} item               The item triggering the AbilityUseDialog.
 * @param {ActiveEffect} effect     The actor's current concentration effect.
 * @returns {string}                The warning message to display.
 */
function _getWarning(reason, item, effect) {
  let string = "";
  const conc = CONCENTRATION_REASON;
  const unfocused = item.actor.flags.dnd5e?.concentrationUnfocused;
  if (unfocused) {
    string = `CN.AbilityDialogWarningUnfocused${(item.type === "spell") ? "Spell" : "Item"}`;
  } else if (reason === conc.DIFFERENT_ITEM) {
    // This will end concentration on a different item.
    string = `CN.AbilityDialogWarning${(item.type === "spell") ? "Spell" : "Item"}`;
  } else if ([conc.DIFFERENT_LEVEL, conc.UPCASTABLE].includes(reason)) {
    // This will end concentration on the same item, unless cast at the same level.
    string = "CN.AbilityDialogWarningSpellLevel";
  }

  const data = {};
  if (!unfocused) {
    const _data = effect.flags[MODULE].data;
    data.item = _data.itemData.name;
    data.level = _data.castData.castLevel?.ordinalString();
  }
  return game.i18n.format(string, data);
}
