// create the concentration flags on actor Special Traits.
export function _characterFlags() {
  const section = game.i18n.localize("DND5E.Concentration");

  /* Add bonus on top of the saving throw. */
  CONFIG.DND5E.characterFlags["concentrationBonus"] = {
    name: game.i18n.localize("CN.FlagConcentrationBonusName"),
    hint: game.i18n.localize("CN.FlagConcentrationBonusHint"),
    section,
    type: String
  };

  /* Change the ability being used for the saving throw. */
  CONFIG.DND5E.characterFlags["concentrationAbility"] = {
    name: game.i18n.localize("CN.FlagConcentrationAbilityName"),
    hint: game.i18n.localize("CN.FlagConcentrationAbilityHint"),
    section,
    type: String,
    choices: {'': null, ...CONFIG.DND5E.abilities} // TODO: change in 2.2.x
  };

  /* Set a flag for having advantage on Concentration saves. */
  CONFIG.DND5E.characterFlags["concentrationAdvantage"] = {
    name: game.i18n.localize("CN.FlagConcentrationAdvantageName"),
    hint: game.i18n.localize("CN.FlagConcentrationAdvantageHint"),
    section,
    type: Boolean
  };

  /* Set a flag for not being able to roll below 10. */
  CONFIG.DND5E.characterFlags["concentrationReliable"] = {
    name: game.i18n.localize("CN.FlagConcentrationReliableName"),
    hint: game.i18n.localize("CN.FlagConcentrationReliableHint"),
    section,
    type: Boolean
  };
}
