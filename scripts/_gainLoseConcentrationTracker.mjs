import {MODULE} from "./settings.mjs";
import {API} from "./_publicAPI.mjs";

// send a message when an actor GAINS concentration.
export async function _gainConcentration(effect, context, userId) {
  if (userId !== game.user.id) return;

  // get whether the effect being created is a concentration effect.
  const isConcentration = API.isEffectConcentration(effect);
  if (!isConcentration) return;

  // effect might be on an unowned item.
  if (effect.parent instanceof Item) return;

  const data = effect.flags[MODULE].data;

  const templateData = {
    details: game.i18n.format("CN.NotifyConcentrationHasBegun", {
      itemName: data.itemData.name,
      actorName: effect.parent.name
    }),
    itemImg: data.itemData.img,
    itemUuid: data.castData.itemUuid
  }
  const template = `modules/${MODULE}/templates/concentrationGain.hbs`;
  const content = await renderTemplate(template, templateData);
  const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
  const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

  let whisper;
  if (publicMode && !alwaysWhisper) whisper = [];
  else whisper = game.users.filter(user => effect.parent.testUserPermission(user, "OWNER")).map(u => u.id);

  const messageData = {
    content,
    flags: {core: {canPopout: true}},
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.ModuleTitle")
    }),
  }
  return ChatMessage.create(messageData);
}

// send a message when an actor LOSES concentration.
export async function _loseConcentration(effect, context, userId) {
  if (userId !== game.user.id) return;

  if (context.concMessage === false) return;

  // get whether the effect being deleted is a concentration effect.
  const isConcentration = API.isEffectConcentration(effect);
  if (!isConcentration) return;

  // effect might be on an unowned item.
  if (effect.parent instanceof Item) return;

  const data = effect.flags[MODULE].data;

  const templateData = {
    details: game.i18n.format("CN.NotifyConcentrationHasEnded", {
      itemName: data.itemData.name,
      actorName: effect.parent.name
    }),
    itemImg: data.itemData.img,
    itemUuid: data.castData.itemUuid
  }
  const template = `modules/${MODULE}/templates/concentrationLoss.hbs`;
  const content = await renderTemplate(template, templateData);
  const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
  const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

  let whisper;
  if (publicMode && !alwaysWhisper) whisper = [];
  else whisper = game.users.filter(user => effect.parent.testUserPermission(user, "OWNER")).map(u => u.id);

  const messageData = {
    content,
    flags: {core: {canPopout: true}},
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.ModuleTitle")
    }),
  }
  return ChatMessage.create(messageData);
}
