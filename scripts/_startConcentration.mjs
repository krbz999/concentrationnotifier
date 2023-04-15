import {MODULE} from "./settings.mjs";
import {_itemUseAffectsConcentration, _requiresConcentration} from "./_helpers.mjs";
import {API} from "./_publicAPI.mjs";

/**
 * Start the concentration when using an item.
 * @param {Item} item           The item being used. If a spell, this is the upscaled version.
 * @returns {ActiveEffect}      The active effect created on the actor, if any.
 */
export async function _startConcentration(item) {
  // item must be an owned item.
  if (!item.parent) return;

  // item must require concentration.
  if (!_requiresConcentration(item)) return;

  // apply concentration.
  return applyConcentration(item);
}

// apply concentration when using a specific item.
async function applyConcentration(item) {
  // get whether and why to start or swap concentration.
  const reason = _itemUseAffectsConcentration(item);
  if (!reason) return [];

  // break concentration if different item or different level.
  await breakConcentration(item.parent, false);

  // create effect data and start concentrating.
  const effectData = await createEffectData(item);
  return item.parent.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

// create the data for the new concentration effect.
async function createEffectData(item) {
  const baseItem = fromUuidSync(item.uuid);
  const itemData = game.items.fromCompendium(item, {addFlags: false});
  const castData = {itemUuid: item.uuid};
  if (item.type === "spell") {
    itemData.system.level = baseItem?.system.level;
    castData.baseLevel = baseItem?.system.level;
    castData.castLevel = item.system.level;
  }

  const vaeIntro = "<p>" + game.i18n.format("CN.YouAreConcentratingOnItem", {name: item.name}) + "</p>";
  const vaeContent = item.system.description.value;
  const prepend = game.settings.get(MODULE, "prepend_effect_labels");

  return {
    icon: getModuleImage(item),
    label: !prepend ? item.name : `${game.i18n.localize("DND5E.Concentration")} - ${item.name}`,
    origin: item.uuid ?? item.actor.uuid,
    duration: getItemDuration(item),
    flags: {
      core: {statusId: "concentration"},
      concentrationnotifier: {data: {itemData, castData}},
      "visual-active-effects": {data: {intro: await TextEditor.enrichHTML(vaeIntro, {async: true}), content: vaeContent}}
    }
  };
}

// set up the duration of the effect depending on the item.
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

// get the image used for the effect.
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

// end all concentration effects on an actor.
async function breakConcentration(caster, message = true) {
  const actor = caster.actor ?? caster;
  const deleteIds = actor.effects.filter(eff => API.isEffectConcentration(eff)).map(i => i.id);
  return actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds, {concMessage: message});
}

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
      callback: () => clone.rollAttack({event, spellLevel: data.castData.castLevel})
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
        callback: () => clone.rollDamageGroup({event, rollgroup: i, spellLevel: data.castData.castLevel})
      });
    }
  } else if (clone.isHealing) {
    buttons.push({
      label: game.i18n.localize("DND5E.Healing"),
      callback: () => clone.rollDamage({event, spellLevel: data.castData.castLevel})
    })
  } else if (clone.hasDamage) {
    buttons.push({
      label: game.i18n.localize("DND5E.Damage"),
      callback: () => clone.rollDamage({event, spellLevel: data.castData.castLevel})
    })
  }

  // Create template button.
  if (clone.hasAreaTarget) {
    buttons.push({
      label: game.i18n.localize("DND5E.PlaceTemplate"),
      callback: () => dnd5e.canvas.AbilityTemplate.fromItem(clone).drawPreview()
    });
  }

  // Create redisplay button.
  buttons.push({
    label: game.i18n.localize("CN.DisplayItem"),
    callback: () => CN.redisplayCard(effect.parent)
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
        callback: () => ET.effectTransferTrigger(clone, "button", data.castData.castLevel)
      });
    }
  }

  // Create concentration save button.
  buttons.push({
    label: game.i18n.localize("DND5E.Concentration"),
    callback: () => effect.parent.rollConcentrationSave()
  });
}
