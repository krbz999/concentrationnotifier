import {MODULE} from "./settings.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * Create and send a message when an actor gains or loses concentration.
 * @param {ActiveEffect} effect     An active effect that is created on an actor.
 * @param {object} context          An object of creation options.
 * @param {string} userId           The id of the user that created the effect.
 * @param {number} type             Whether the effect is gained (1) or lost (0).
 * @returns {ChatMessage}           The created chat message.
 */
async function displayConcentrationMessage(effect, context, userId, type) {
  // Only run this script for the initiating user.
  if (userId !== game.user.id) return;
  // Do not run this script if explicitly blocked.
  if (context.concMessage === false) return;
  // Do not run this script if the effect is not a concentration effect.
  if (!API.isEffectConcentration(effect)) return;
  // Do not run this script if the effect is on an unowned item.
  if (effect.parent instanceof Item) return;

  // ----------

  const data = effect.flags[MODULE].data;
  const templateData = {
    details: game.i18n.format(`CN.NotifyConcentrationHas${type === 1 ? "Begun" : "Ended"}`, {
      itemName: data.itemData.name, actorName: effect.parent.name
    }),
    itemImg: data.itemData.img,
    itemUuid: data.castData.itemUuid,
    effectUuid: effect.uuid,
    showUtilButtons: game.settings.get(MODULE, "show_util_buttons")
  };
  const template = `modules/${MODULE}/templates/concentration${type === 1 ? "Gain" : "Loss"}.hbs`;
  const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
  const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

  let whisper;
  if (publicMode && !alwaysWhisper) whisper = [];
  else whisper = game.users.reduce((acc, u) => {
    if (effect.parent.testUserPermission(u, "OWNER")) acc.push(u.id);
    return acc;
  }, []);

  const messageData = {
    content: await renderTemplate(template, templateData),
    whisper,
    flags: {core: {canPopout: true}},
    speaker: {alias: game.i18n.localize("CN.ModuleTitle")}
  };
  return ChatMessage.create(messageData);
}

// send a message when an actor GAINS concentration.
export async function _gainConcentration(effect, context, userId) {
  return displayConcentrationMessage(effect, context, userId, 1);
}

// send a message when an actor LOSES concentration.
export async function _loseConcentration(effect, context, userId) {
  return displayConcentrationMessage(effect, context, userId, 0);
}
