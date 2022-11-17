import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

// send a message when an actor GAINS concentration.
export async function _gainConcentration(effect, context, userId) {
  if (userId !== game.user.id) return;

  // get whether the effect being created is a concentration effect.
  const isConcentration = API.isEffectConcentration(effect);
  if (!isConcentration) return;

  // effect might be on an unowned item.
  if (effect.parent instanceof Item) return;

  const data = {
    details: game.i18n.format("CN.CARD.GAIN.DETAILS", {
      itemName: effect.getFlag(MODULE, "data.itemData.name"),
      actorName: effect.parent.name
    }),
    itemImg: effect.getFlag(MODULE, "data.itemData.img"),
    itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
  }
  const template = `modules/${MODULE}/templates/concentrationGain.hbs`;
  const content = await renderTemplate(template, data);
  const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
  const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

  let whisper;
  if (publicMode && !alwaysWhisper) whisper = [];
  else whisper = Object.entries(effect.parent.ownership).filter(([id, level]) => {
    if (!game.users.get(id)) return false;
    return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  }).map(([id]) => id);

  const messageData = {
    content,
    flags: { core: { canPopout: true } },
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.SPEAKER")
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

  const data = {
    details: game.i18n.format("CN.CARD.LOSS.DETAILS", {
      itemName: effect.getFlag(MODULE, "data.itemData.name"),
      actorName: effect.parent.name
    }),
    itemImg: effect.getFlag(MODULE, "data.itemData.img"),
    itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
  }
  const template = `modules/${MODULE}/templates/concentrationLoss.hbs`;
  const content = await renderTemplate(template, data);
  const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
  const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

  let whisper;
  if (publicMode && !alwaysWhisper) whisper = [];
  else whisper = Object.entries(effect.parent.ownership).filter(([id, level]) => {
    if (!game.users.get(id)) return false;
    return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  }).map(([id]) => id);

  const messageData = {
    content,
    flags: { core: { canPopout: true } },
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.SPEAKER")
    }),
  }
  return ChatMessage.create(messageData);
}
