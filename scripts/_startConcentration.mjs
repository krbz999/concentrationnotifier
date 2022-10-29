import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

export function setHooks_startConcentration() {

  Hooks.on("dnd5e.useItem", async (item) => {
    // item must be an owned item.
    const actor = item.parent;
    if (!actor) return;

    // item must require concentration.
    let requiresConc;
    if (item.type === "spell") {
      const path = "system.components.concentration";
      requiresConc = foundry.utils.getProperty(item, path);
    }
    else {
      const path = "data.requiresConcentration";
      requiresConc = item.getFlag(MODULE, path);
    }
    if (!requiresConc) return;

    // get spell levels.
    const castLevel = item.system.level;
    const baseLevel = fromUuidSync(item.uuid)?.system.level;
    const itemUuid = item.uuid;

    // create castingData.
    const data = {
      itemData: item.toObject(),
      castData: { baseLevel, castLevel, itemUuid }
    }

    // apply concentration.
    return applyConcentration(actor, item, data);
  });
}

// apply concentration when using a specific item.
async function applyConcentration(actor, item, data) {
  // get whether and why to start or swap concentration.
  const reason = _itemUseAffectsConcentration(actor, item, data);
  if (!reason) return [];

  // break concentration if different item or different level.
  if (["DIFFERENT", "LEVEL"].includes(reason)) await breakConcentration(actor, false);

  // create effect data and start concentrating.
  const effectData = await createEffectData(actor, item, data);
  return actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

/**
 * Returns whether and why an item being used should affect concentration.
 * Used to determine if concentration should be changed, or for the
 * ability use dialog to determine if it should display a warning.
 * The returned value is either false or truthy.
 * @param {Actor5e} actor     The actor using the item.
 * @param {Item5e} item       The item being used right now.
 * @param {Object} data       Small object with cast data.
 * @param {Boolean} isDialog  Whether the function is being used for the AbilityUseDialog.
 * @returns {String|Boolean}  Truthy string, or false if the items are the same.
 */
export function _itemUseAffectsConcentration(actor, item, data, isDialog = false) {
  // new item requires concentration:
  let requiresConc;
  if (item.type === "spell") {
    const path = "system.components.concentration";
    requiresConc = foundry.utils.getProperty(item, path);
  } else {
    const path = "data.requiresConcentration";
    requiresConc = item.getFlag(MODULE, path);
  }
  if (!requiresConc) return false;

  // if you are not concentrating:
  const isConc = API.isActorConcentrating(actor);
  if (!isConc) return "FREE";

  // if you are concentrating on an entirely different item:
  const concDiff = isConc.getFlag(MODULE, "data.castData.itemUuid") !== item.uuid;
  if (concDiff) return "DIFFERENT";

  // if you are concentrating on the same item but at a different level:
  const concNotSame = isConc.getFlag(MODULE, "data.castData.castLevel") !== data.castData.castLevel;
  if (concNotSame) return "LEVEL";

  // For AbilityUseDialog warning, only show it for spells of 1st level or higher.
  if (isDialog && item.type === "spell" && item.system.level > 0) return "LEVEL";

  return false;
}

// create the data for the new concentration effect.
async function createEffectData(actor, item, data) {

  const verbose = game.settings.get(MODULE, "verbose_tooltips");
  const prepend = game.settings.get(MODULE, "prepend_effect_labels");

  // create description.
  let description = game.i18n.format("CN.CONCENTRATING_ON_ITEM", {
    name: item.name
  });
  const intro = description;
  const content = item.system.description.value;
  const template = `modules/${MODULE}/templates/effectDescription.hbs`;
  if (verbose) description = await renderTemplate(template, {
    description,
    itemDescription: item.system.description.value
  });

  // set up flags of the effect.
  const flags = {
    core: { statusId: "concentration" },
    convenientDescription: description,
    concentrationnotifier: { data },
    "visual-active-effects": { data: { intro, content } }
  }

  // get effect label, depending on settings.
  let label = item.name;
  if (prepend) {
    label = `${game.i18n.localize("CN.CONCENTRATION")} - ${label}`;
  }

  // return constructed effect data.
  return {
    icon: getModuleImage(item),
    label,
    origin: item.uuid ?? actor.uuid,
    duration: getItemDuration(item),
    flags
  }
}

// set up the duration of the effect depending on the item.
function getItemDuration(item) {
  const duration = item.system.duration;

  if (!duration?.value) return {};
  let { value, units } = duration;

  // do not bother for these duration types:
  if (["inst", "perm", "spec"].includes(units)) return {};

  // cases for the remaining units of time:
  if (units === "round") return { rounds: value };
  if (units === "turn") return { turns: value };
  value *= 60;
  if (units === "minute") return { seconds: value };
  value *= 60;
  if (units === "hour") return { seconds: value };
  value *= 24;
  if (units === "day") return { seconds: value };
  value *= 30;
  if (units === "month") return { seconds: value };
  value *= 12;
  if (units === "year") return { seconds: value };

  return {};
}

// get the image used for the effect.
function getModuleImage(item) {
  // the custom icon in the settings.
  const moduleImage = game.settings.get(MODULE, "concentration_icon");

  // whether or not to use the item img instead.
  const useItemImage = game.settings.get(MODULE, "concentration_icon_item");

  // Case 1: the item has an image, and it is prioritised.
  if (useItemImage && item.img) return item.img;

  // Case 2: there is no custom image in the settings, so use the default image.
  if (!moduleImage) return "icons/magic/light/orb-lightbulb-gray.webp";

  // Case 3: Use the custom image in the settings.
  return moduleImage;
}

// end all concentration effects on an actor.
async function breakConcentration(caster, message = true) {
  const actor = caster.actor ?? caster;
  const deleteIds = actor.effects.filter(eff => {
    return API.isEffectConcentration(eff);
  }).map(i => i.id);
  return actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds, {
    concMessage: message
  });
}
