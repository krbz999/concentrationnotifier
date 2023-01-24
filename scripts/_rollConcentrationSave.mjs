import { MODULE } from "./settings.mjs";

export function _preRollConcentrationSave(actor, rollConfig, saveType) {
  const { isConcSave, concentrationBonus } = rollConfig;
  if (isConcSave && !!concentrationBonus) {
    rollConfig.parts.push(...rollConfig.concentrationBonus);
  }
}

// roll for concentration. This will be added to the Actor prototype.
export const rollConcentrationSave = async function(ability, options = {}) {
  if (!this.isOwner) return;

  const abl = ability ?? this.getFlag("dnd5e", "concentrationAbility") ?? game.settings.get(MODULE, "defaultConcentrationAbility");

  const rollConfig = { fumble: null, critical: null, event, isConcSave: true };
  const reliableTalent = this.getFlag("dnd5e", "concentrationReliable");
  if (reliableTalent) rollConfig.reliableTalent = reliableTalent;
  const advantage = this.getFlag("dnd5e", "concentrationAdvantage") && !event?.ctrlKey;
  if (advantage) rollConfig.advantage = true;
  const concentrationBonus = this.getFlag("dnd5e", "concentrationBonus");
  if (concentrationBonus && Roll.validate(concentrationBonus)) {
    rollConfig.concentrationBonus = [concentrationBonus];
  } else rollConfig.concentrationBonus = [];
  if (options.parts?.length) rollConfig.concentrationBonus.push(...options.parts);
  delete options.parts;
  foundry.utils.mergeObject(rollConfig, options);

  // options should always have 'targetValue'.
  // ability is always passed in the event listeners.

  if (Hooks.call(`${MODULE}.preRollConcentrationSave`, this, rollConfig, abl) === false) return;

  return this.rollAbilitySave(abl, rollConfig);
}
