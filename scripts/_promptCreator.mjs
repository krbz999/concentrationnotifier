import {MODULE} from "./settings.mjs";
import {API} from "./_publicAPI.mjs";

// store values for use in "updateActor" hook if HP has changed.
export function _prePromptCreator(actor, data, context, userId) {
  // Get old values. These always exist, but temp is null when 0.
  const hpOld = actor.system.attributes?.hp ?? {};

  // Get new values. If they are undefined, there was no change to them, so we use old values.
  const hpNew = data.system?.attributes?.hp ?? {};

  // Calculate health difference.
  const oldTotal = (hpOld.temp ?? 0) + (hpOld.value ?? 0);
  const newTotal = (hpNew.temp ?? hpOld.temp ?? 0) + (hpNew.value ?? hpOld.value ?? 0);
  const damage = oldTotal - newTotal;

  // if damageTaken > 0, tag context for a saving throw.
  context[MODULE] = {save: damage > 0, damage};
  if (damage > 0) {
    /** A hook that is called when an actor's hit points are reduced. Returning false does not do anything here. */
    Hooks.call(`${MODULE}.preDamageActor`, actor, data, context, userId);
  } else if (damage < 0) {
    /** A hook that is called when an actor's hit points are increased. Returning false does not do anything here. */
    Hooks.call(`${MODULE}.preHealActor`, actor, data, context, userId);
  }
}

// if the user is concentrating, and has taken damage, build a chat card, and call for a saving throw.
export async function _promptCreator(actor, update, context, userId) {
  // only do this for the one doing the update.
  if (userId !== game.user.id) return;

  // bail out if there is no save needed, and get the damage taken.
  const {save, damage} = context[MODULE] ?? {};
  if (!save) return;
  // calculate DC from the damage taken.
  const dc = Math.max(10, Math.floor(Math.abs(damage) / 2));

  // find a concentration effect.
  const effect = API.isActorConcentrating(actor);
  if (!effect) return;

  const data = effect.flags[MODULE].data;

  // Bail out if this concentration cannot be broken by damage.
  if (data.castData.unbreakable) return;

  // get the ability being used for concentration saves.
  const abilityKey = actor.flags.dnd5e?.concentrationAbility ?? game.settings.get(MODULE, "defaultConcentrationAbility");

  // get whisper targets.
  const whisper = game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id);

  // the chat message contents.
  const template = `modules/${MODULE}/templates/savingThrowPrompt.hbs`;
  const content = await renderTemplate(template, {
    details: game.i18n.format("CN.NotifyConcentrationChallengeDamaged", {
      dc,
      itemName: data.itemData.name,
      damage,
      saveType: CONFIG.DND5E.abilities[abilityKey],
      actorName: actor.name,
      itemUuid: data.castData.itemUuid
    }),
    buttonSaveLabel: game.i18n.format("CN.ButtonSavingThrow", {
      dc,
      saveType: CONFIG.DND5E.abilities[abilityKey]
    }),
    hasTemplates: !!canvas?.scene.templates.find(t => t.flags?.dnd5e?.origin === data.castData.itemUuid),
    origin: data.castData.itemUuid,
    ability: abilityKey,
    actorUuid: actor.uuid,
    effectUuid: effect.uuid,
    dc
  });

  const messageData = {
    content,
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.ModuleTitle")
    }),
    flags: {
      core: {canPopout: true},
      [MODULE]: {prompt: true, damage}
    }
  };

  if (damage > 0) {
    /** A hook that is called when an actor's hit points are reduced. */
    Hooks.callAll(`${MODULE}.damageActor`, actor, update, context, userId);
  } else if (damage < 0) {
    /** A hook that is called when an actor's hit points are increased. */
    Hooks.callAll(`${MODULE}.healActor`, actor, update, context, userId);
  }

  // Create chat card.
  return ChatMessage.create(messageData);
}

export async function promptConcentrationSave(caster, {saveDC = 10, message} = {}) {
  const actor = caster.actor ?? caster;
  // find a concentration effect.
  const effect = API.isActorConcentrating(actor);
  // bail out if actor is not concentrating.
  if (!effect) {
    const locale = game.i18n.format("CN.WarningActorNotConcentrating", {name: actor.name});
    ui.notifications.warn(locale);
    return null;
  }

  // Get saved effect data.
  const data = effect.flags[MODULE]?.data;

  // Get the ability being used for concentration saves.
  const abilityKey = actor.flags.dnd5e?.concentrationAbility ?? game.settings.get(MODULE, "defaultConcentrationAbility");

  // Get whisper targets.
  const whisper = game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id);

  // The chat message contents.
  const template = `modules/${MODULE}/templates/savingThrowPrompt.hbs`;
  const content = await renderTemplate(template, {
    details: game.i18n.format("CN.NotifyConcentrationChallengeManual", {
      dc: saveDC,
      itemName: data.itemData.name,
      saveType: CONFIG.DND5E.abilities[abilityKey],
      actorName: actor.name,
      itemUuid: data.castData.itemUuid
    }),
    buttonSaveLabel: game.i18n.format("CN.ButtonSavingThrow", {
      dc: saveDC,
      saveType: CONFIG.DND5E.abilities[abilityKey]
    }),
    hasTemplates: !!canvas?.scene.templates.find(t => t.flags?.dnd5e?.origin === data.castData.itemUuid),
    origin: data.castData.itemUuid,
    dc: saveDC,
    ability: abilityKey,
    actorUuid: actor.uuid,
    effectUuid: effect.uuid,
    description: message
  });

  const messageData = {
    content,
    whisper,
    speaker: ChatMessage.getSpeaker({
      alias: game.i18n.localize("CN.ModuleTitle")
    }),
    flags: {
      core: {canPopout: true},
      [MODULE]: {prompt: true}
    }
  };

  // Create chat card.
  return ChatMessage.create(messageData);
}
