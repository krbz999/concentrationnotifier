import { MODULE } from "./settings.mjs";
import {
  _effectiveTransferralTransferButton,
  _itemUseAffectsConcentration,
  _requiresConcentration,
  _rollGroupDamageButtons
} from "./_helpers.mjs";
import { API } from "./_publicAPI.mjs";

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

  const verbose = game.settings.get(MODULE, "verbose_tooltips");
  const prepend = game.settings.get(MODULE, "prepend_effect_labels");

  // create description.
  let description = game.i18n.format("CN.YouAreConcentratingOnItem", {
    name: item.name
  });
  const intro = await TextEditor.enrichHTML(_createIntro(item), { async: true });
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
    concentrationnotifier: {
      data: {
        itemData: item.toObject(),
        castData: {
          baseLevel: fromUuidSync(item.uuid)?.system.level,
          castLevel: item.system.level,
          itemUuid: item.uuid
        }
      }
    },
    "visual-active-effects": { data: { intro, content } }
  }

  // get effect label, depending on settings.
  let label = item.name;
  if (prepend) {
    label = `${game.i18n.localize("DND5E.Concentration")} - ${label}`;
  }

  // return constructed effect data.
  return {
    icon: getModuleImage(item),
    label,
    origin: item.uuid ?? item.parent.uuid,
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
  const deleteIds = actor.effects.filter(eff => {
    return API.isEffectConcentration(eff);
  }).map(i => i.id);
  return actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds, {
    concMessage: message
  });
}

function _createIntro(item) {
  let description = "<p>" + game.i18n.format("CN.YouAreConcentratingOnItem", { name: item.name }) + "</p>";

  const vae = game.settings.get(MODULE, "create_vae_quickButtons");
  const rg = game.modules.get("rollgroups");
  const et = game.modules.get("effective-transferral");

  if (vae) {
    const uuid = item.parent.uuid;

    description += "<div class='cn-vae-buttons'>";

    // Add attack button.
    if (item.hasAttack) description += `<a data-cn="attack" data-uuid="${uuid}">${game.i18n.localize("DND5E.Attack")}</a>`;

    // Add normal or rollgroups damage buttons.
    const rollGroups = rg?.active && _rollGroupDamageButtons(item);
    if (rollGroups) description += rollGroups;
    else {
      if (item.isHealing) description += `<a data-cn="damage" data-uuid="${uuid}">${game.i18n.localize("DND5E.Healing")}</a>`;
      else if (item.hasDamage) description += `<a data-cn="damage" data-uuid="${uuid}">${game.i18n.localize("DND5E.Damage")}</a>`;
    }

    // Add template buttons.
    if (item.hasAreaTarget) description += `<a data-cn="template" data-uuid="${uuid}">${game.i18n.localize("DND5E.PlaceTemplate")}</a>`;

    // Add redisplay button.
    description += `<a data-cn="redisplay" data-uuid="${uuid}">${game.i18n.localize("CN.DisplayItem")}</a>`;

    // Add effect transfer button.
    const effTran = et?.active && _effectiveTransferralTransferButton(item);
    if (effTran) description += effTran;

    // Add concentration save button.
    description += `<a data-cn="concsave" data-uuid="${uuid}">${game.i18n.localize("DND5E.Concentration")}</a>`;

    return description + "</div>";
  }
  return description;
}

export function _applyButtonListeners() {
  document.addEventListener("click", async (event) => {
    const a = event.target.closest(".cn-vae-buttons a");
    if (!a) return;
    const data = a.dataset;

    const caster = await fromUuid(data.uuid);
    const actor = caster.actor ?? caster;

    const isConc = CN.isActorConcentrating(actor);
    const { itemData, castData } = isConc.getFlag(MODULE, "data");
    const item = fromUuidSync(castData.itemUuid) ?? new Item.implementation(itemData, { parent: actor });
    const clone = item?.clone(itemData, { keepId: true }) ?? new Item.implementation(itemData, { parent: actor });

    const config = { event, rollgroup: data.rollgroup, spellLevel: castData.castLevel };

    if (data.cn === "attack") return clone.rollAttack(config);
    else if (data.cn === "rollgroups-damage") return item.rollDamageGroup(config);
    else if (data.cn === "damage") return item.rollDamage(config);
    else if (data.cn === "template") {
      return dnd5e.canvas.AbilityTemplate.fromItem(item)?.drawPreview();
    } else if (data.cn === "redisplay") return CN.redisplayCard(actor);
    else if (data.cn === "effective-transferral-transfer") {
      return ET.effectTransferTrigger(item, "button", castData.castLevel);
    } else if (data.cn === "concsave") return actor.rollConcentrationSave();
  });
}
