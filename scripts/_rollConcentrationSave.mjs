/* If the saving throw is for concentration, add the bonus on top in the pre-hook. */
Hooks.once("dnd5e.preRollAbilitySave", (actor, rollConfig, saveType) => {
    if ( !foundry.utils.getProperty(rollConfig, "concentrationnotifier.isConcSave") ) return;
    rollConfig.parts = rollConfig.parts.concat(rollConfig.concentrationBonus);
});

// roll for concentration. This will be added to the Actor prototype.
export const rollConcentrationSave = async function(ability, options = {}){

    let rollConfig = {
        fumble: -1,
        critical: 21,
        event,
        reliableTalent: this.getFlag("dnd5e", "concentrationReliable"),
        advantage: this.getFlag("dnd5e", "concentrationAdvantage"),
        isConcSave: true,
        concentrationBonus: [this.getFlag("dnd5e", "concentrationBonus")]
    }
    rollConfig = foundry.utils.mergeObject(rollConfig, options);
    // options should always have 'targetValue'.
    // ability is always passed in the event listeners.
    return this.rollAbilitySave(ability, rollConfig);
}
