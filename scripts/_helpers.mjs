import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

// returns whether an item or spell requires concentration.
export function _requiresConcentration(item) {
  if (item.type === "spell") return !!item.system.components.concentration;
  return !!item.getFlag(MODULE, "data.requiresConcentration");
}

/**
 * Returns whether and why an item being used should affect current concentration.
 * Used to determine if concentration should be changed, and for the
 * ability use dialog to determine if it should display a warning.
 * The returned value is either false or truthy.
 * @param {Item5e} item       The item being used right now.
 * @param {Boolean} isDialog  Whether the function is being used for the AbilityUseDialog.
 * @returns {String|Boolean}  Truthy string, or false if the items are the same.
 */
export function _itemUseAffectsConcentration(item, isDialog = false) {
  // new item requires concentration:
  if (!_requiresConcentration(item)) return false;

  // if you are not concentrating:
  const isConc = API.isActorConcentrating(item.parent);
  if (!isConc) return "FREE";

  // if you are concentrating on an entirely different item:
  const concDiff = isConc.getFlag(MODULE, "data.castData.itemUuid") !== item.uuid;
  if (concDiff) return "DIFFERENT";

  // if you are concentrating on the same item but at a different level:
  const concNotSame = isConc.getFlag(MODULE, "data.castData.castLevel") !== item.system.level;
  if (concNotSame) return "LEVEL";

  // For AbilityUseDialog warning, only show it for spells of 1st level or higher.
  if (isDialog && item.type === "spell" && item.system.level > 0) return "LEVEL";

  return false;
}

// Compatibility with Roll Groups + Visual Active Effects.
export function _rollGroupDamageButtons(item) {
  const groups = item.getFlag("rollgroups", "config.groups");
  const validParts = item.system.damage?.parts.filter(([f]) => !!f) ?? [];
  if (!groups?.length || validParts.length < 2) return false;

  return groups.reduce((acc, { label, parts }, i) => {
    const r = "rollgroups-damage";
    const u = item.parent.uuid;
    const types = parts.map(t => validParts[t][1]);
    const isDamage = types.every(t => t in CONFIG.DND5E.damageTypes);
    const isHealing = types.every(t => t in CONFIG.DND5E.healingTypes);
    const lab = isDamage ? "DAMAGE" : isHealing ? "HEALING" : "MIXED";
    const l = `${game.i18n.localize(`ROLLGROUPS.LABELS.${lab}`)} (${label})`;
    return acc + `<a data-cn="${r}" data-uuid="${u}" data-rollgroup="${i}">${l}</a>`;
  }, "");
}

// Compatibility with Effective Transferal + Visual Active Effects.
export function _effectiveTransferralTransferButton(item) {
  const ET_ID = "effective-transferral";
  const newer = foundry.utils.isNewerVersion("1.3.0", game.modules.get(ET_ID).version);
  if (newer) return false;
  const setting = game.settings.get(ET_ID, "includeEquipTransfer");

  const effects = item.effects.filter(effect => {
    const et = effect.transfer === false;
    const eb = effect.getFlag(ET_ID, "transferBlock.button");
    const nbt = game.settings.get(ET_ID, "neverButtonTransfer");
    return (et || setting) && (!eb && !nbt);
  });

  if (!effects.length) return false;

  const A = "effective-transferral-transfer";
  const B = item.parent.uuid;
  const C = item.uuid;
  const D = game.i18n.localize("ET.Button.Label");

  return `<a data-cn="${A}" data-uuid="${B}" data-item="${C}">${D}</a>`;
}
