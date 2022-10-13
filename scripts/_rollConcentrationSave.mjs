import { MODULE } from "./settings.mjs";

export function setHooks_rollConcentrationSave() {

  /* If the saving throw is for concentration, add the bonus on top in the pre-hook. */
  Hooks.on("dnd5e.preRollAbilitySave", (actor, rollConfig, saveType) => {
    const { isConcSave, concentrationBonus } = rollConfig;
    if (isConcSave && !!concentrationBonus) {
      rollConfig.parts.push(...rollConfig.concentrationBonus);
    }
  });
}

// roll for concentration. This will be added to the Actor prototype.
export const rollConcentrationSave = async function (ability, options = {}) {
  if (!this.isOwner) return;

  const abl = ability ?? this.getFlag("dnd5e", "concentrationAbility");

  const rollConfig = { fumble: null, critical: null, event, isConcSave: true };
  const reliableTalent = this.getFlag("dnd5e", "concentrationReliable");
  if (reliableTalent) rollConfig.reliableTalent = reliableTalent;
  const advantage = this.getFlag("dnd5e", "concentrationAdvantage") && !event?.ctrlKey;
  if (advantage) rollConfig.advantage = advantage;
  const concentrationBonus = this.getFlag("dnd5e", "concentrationBonus");
  if (concentrationBonus && Roll.validate(concentrationBonus)) {
    rollConfig.concentrationBonus = [concentrationBonus];
  } else rollConfig.concentrationBonus = [];

  const parts = foundry.utils.duplicate(options.parts ?? []);
  foundry.utils.mergeObject(rollConfig, options);
  delete options.parts;

  // battle the clobbering.
  if (parts?.length > 0) rollConfig.concentrationBonus.concat(...parts);

  // options should always have 'targetValue'.
  // ability is always passed in the event listeners.

  if (Hooks.call(`${MODULE}.preRollConcentrationSave`, this, rollConfig, abl) === false) return;

  return this.rollAbilitySave(abl, rollConfig);
}
