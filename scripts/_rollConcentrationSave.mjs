import {MODULE} from "./settings.mjs";

// Roll for concentration. This will be added to the Actor prototype.
export const rollConcentrationSave = async function(ability, options = {}) {
  if (!this.isOwner) return;

  const dnd = this.flags.dnd5e ?? {};

  // Default ability. This *should* always be passed in the event listeners.
  const abl = ability ?? dnd.concentrationAbility ?? game.settings.get(MODULE, "defaultConcentrationAbility");

  // Basic options.
  const rollConfig = {
    fumble: null,
    critical: null,
    isConcSave: true,
    targetValue: 10,
    parts: []
  };

  // Minimum of 10.
  const reliableTalent = dnd.concentrationReliable;
  if (reliableTalent) rollConfig.reliableTalent = reliableTalent;

  // Determine advantage.
  const advantage = dnd.concentrationAdvantage && !options.event?.ctrlKey;
  if (advantage) rollConfig.advantage = true;

  // Merge with any options passed in.
  foundry.utils.mergeObject(rollConfig, options);

  // Determine concentration bonus.
  const bonus = dnd.concentrationBonus && Roll.validate(dnd.concentrationBonus);
  if (bonus) rollConfig.parts.push(dnd.concentrationBonus);

  // Hook event for users to modify the saving throw before it is passed to the regular roll.
  if (Hooks.call(`${MODULE}.preRollConcentrationSave`, this, rollConfig, abl) === false) return;

  const roll = await this.rollAbilitySave(abl, rollConfig);

  // Hook event that fires after the concentration save has been completed.
  if (roll) Hooks.callAll(`${MODULE}.rollConcentrationSave`, this, roll, abl);

  return roll;
}
