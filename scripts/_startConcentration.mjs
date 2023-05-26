import {CONCENTRATION_REASON, MODULE} from "./settings.mjs";
import {_itemUseAffectsConcentration} from "./_helpers.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * Start the concentration when using an item if the actor is not concentrating at all, if they are concentrating
 * on a different item, or if it is the same item but cast at a different level.
 * @param {Item} item             The item being used. If a spell, this is the upscaled version.
 * @returns {ActiveEffect[]}      The active effect created on the actor, if any.
 */
export async function _startConcentration(item) {
  // item must be an owned item.
  if (!item.actor) return;

  // the actor must be able to concentrate.
  if (item.actor.flags.dnd5e?.concentrationUnfocused) return;

  // get whether and why to start or swap concentration.
  const reason = _itemUseAffectsConcentration(item);
  const conc = CONCENTRATION_REASON;
  const goodReason = [
    conc.NOT_CONCENTRATING,
    conc.DIFFERENT_ITEM,
    conc.DIFFERENT_LEVEL
  ].includes(reason);
  if (!goodReason) return [];

  // Break the current concentration, but do not display a message.
  await breakConcentration(item.actor, false);

  // Create the effect data and start concentrating on the new item.
  const effectData = await createEffectData(item);
  return item.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

/**
 * Create the data for a new concentration effect.
 * @param {Item} item     The item on which to start concentrating.
 * @returns {object}      An object of data for an active effect.
 */
async function createEffectData(item) {
  const baseItem = fromUuidSync(item.uuid);
  const itemData = game.items.fromCompendium(item, {addFlags: false});
  const castData = {itemUuid: item.uuid};
  if (item.type === "spell") {
    itemData.system.level = baseItem?.system.level;
    castData.baseLevel = baseItem?.system.level;
    castData.castLevel = item.system.level;
  }

  const prepend = game.settings.get(MODULE, "prepend_effect_labels");

  return {
    icon: getModuleImage(item),
    name: !prepend ? item.name : `${game.i18n.localize("DND5E.Concentration")} - ${item.name}`,
    origin: item.uuid,
    duration: getItemDuration(item),
    statuses: !API.isV10 ? ["concentration"] : undefined,
    description: game.i18n.format("CN.YouAreConcentratingOnItem", {name: item.name}),
    flags: {
      core: API.isV10 ? {statusId: "concentration"} : undefined,
      concentrationnotifier: {data: {itemData, castData}},
      "visual-active-effects": {data: {content: item.system.description.value}}
    }
  };
}

/**
 * Helper function to set the duration of the concentration effect to match its item.
 * @param {Item} item     The item being concentrated on.
 * @returns {object}      The duration object for an active effect.
 */
function getItemDuration(item) {
  const duration = item.system.duration;

  if (!duration?.value) return {};
  let {value, units} = duration;

  // do not bother for these duration types:
  if (["inst", "perm", "spec"].includes(units)) return {};

  // cases for the remaining units of time:
  if (units === "round") return {rounds: value};
  if (units === "turn") return {turns: value};
  value *= 60;
  if (units === "minute") return {seconds: value};
  value *= 60;
  if (units === "hour") return {seconds: value};
  value *= 24;
  if (units === "day") return {seconds: value};
  value *= 30;
  if (units === "month") return {seconds: value};
  value *= 12;
  if (units === "year") return {seconds: value};

  return {};
}

/**
 * Helper function to set the icon of the concentration effect.
 * @param {Item} item     The item being concentrated on.
 * @returns {string}      The asset path used for the effect icon.
 */
function getModuleImage(item) {
  // whether or not to use the item img instead.
  const useItemImage = game.settings.get(MODULE, "concentration_icon_item");

  // Case 1: the item has an image, and it is prioritised.
  if (useItemImage && item.img) return item.img;

  // the custom icon in the settings.
  const moduleImage = game.settings.get(MODULE, "concentration_icon")?.trim();

  // Case 2: there is no custom image in the settings, so use the default image.
  if (!moduleImage) return "icons/magic/light/orb-lightbulb-gray.webp";

  // Case 3: Use the custom image in the settings.
  return moduleImage;
}

/**
 * End all concentration effects on an actor.
 * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor that is concentrating.
 * @param {boolean} [message=true]                Whether to display a message when breaking concentration.
 * @returns {ActiveEffect[]}                      An array of deleted active effects.
 */
async function breakConcentration(caster, message = true) {
  const actor = caster.actor ?? caster;
  const ids = actor.effects.reduce((acc, e) => {
    if (API.isEffectConcentration(e)) acc.push(e.id);
    return acc;
  }, []);
  return actor.deleteEmbeddedDocuments("ActiveEffect", ids, {concMessage: message});
}

/**
 * Create buttons for Visual Active Effects, with support for 'Roll Groups' and 'Effective Transferral'.
 * @param {ActiveEffect} effect     The effect being displayed in VAE.
 * @param {object[]} buttons        The current array of buttons, each with 'label' and 'callback'.
 */
export function _vaeButtons(effect, buttons) {
  const isConc = CN.isEffectConcentration(effect);
  if (!isConc) return;
  const data = effect.flags.concentrationnotifier.data;
  const item = fromUuidSync(data.castData.itemUuid);
  const clone = item?.clone(data.itemData, {keepId: true}) ?? new Item.implementation(data.itemData, {parent: effect.parent});
  clone.prepareFinalAttributes();

  // Create attack roll button.
  if (clone.hasAttack) {
    buttons.push({
      label: game.i18n.localize("DND5E.Attack"),
      callback: (event) => clone.rollAttack({event, spellLevel: data.castData.castLevel})
    });
  }

  // Create damage buttons (optionally with Roll Groups).
  const rollGroups = game.modules.get("rollgroups")?.active;
  const groups = clone.flags.rollgroups?.config.groups ?? [];
  const parts = clone.system.damage.parts.filter(([f]) => f);
  if (rollGroups && groups.length && (parts.length > 1)) {
    for (let i = 0; i < groups.length; i++) {
      const types = groups[i].parts.map(t => parts[t][1]);
      const label = types.every(t => t in CONFIG.DND5E.damageTypes) ? "DAMAGE" : types.every(t => t in CONFIG.DND5E.damageTypes) ? "HEALING" : "MIXED";
      buttons.push({
        label: `${game.i18n.localize(`ROLLGROUPS.LABELS.${label}`)} (${groups[i].label})`,
        callback: (event) => clone.rollDamageGroup({event, rollgroup: i, spellLevel: data.castData.castLevel})
      });
    }
  } else if (clone.isHealing) {
    buttons.push({
      label: game.i18n.localize("DND5E.Healing"),
      callback: (event) => clone.rollDamage({event, spellLevel: data.castData.castLevel})
    })
  } else if (clone.hasDamage) {
    buttons.push({
      label: game.i18n.localize("DND5E.Damage"),
      callback: (event) => clone.rollDamage({event, spellLevel: data.castData.castLevel})
    })
  }

  // Create template button.
  if (clone.hasAreaTarget) {
    buttons.push({
      label: game.i18n.localize("DND5E.PlaceTemplate"),
      callback: (event) => dnd5e.canvas.AbilityTemplate.fromItem(clone).drawPreview()
    });
  }

  // Create redisplay button.
  buttons.push({
    label: game.i18n.localize("CN.DisplayItem"),
    callback: (event) => CN.redisplayCard(effect.parent)
  });

  // Create effect transfer button.
  const et = game.modules.get("effective-transferral")?.active;
  if (et) {
    const effects = clone.effects.filter(e => {
      const _et = e.transfer === false;
      const _st = game.settings.get("effective-transferral", "includeEquipTransfer");
      const _eb = e.flags["effective-transferral"]?.transferBlock?.button;
      const _nb = game.settings.get("effective-transferral", "neverButtonTransfer");
      return (_et || _st) && (!_eb && !_nb);
    });
    if (effects.length) {
      buttons.push({
        label: game.i18n.localize("ET.Button.Label"),
        callback: (event) => ET.effectTransferTrigger(clone, "button", data.castData.castLevel)
      });
    }
  }

  // Create concentration save button.
  buttons.push({
    label: game.i18n.localize("DND5E.Concentration"),
    callback: (event) => effect.parent.rollConcentrationSave(null, {event})
  });
}
