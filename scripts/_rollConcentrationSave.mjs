export function setHooks_rollConcentrationSave(){
    
    /* If the saving throw is for concentration, add the bonus on top in the pre-hook. */
    Hooks.on("dnd5e.preRollAbilitySave", (actor, rollConfig, saveType) => {
        if ( foundry.utils.hasProperty(rollConfig, "isConcSave") ) {
            if ( !!rollConfig.concentrationBonus ) {
                rollConfig.parts.push(rollConfig.concentrationBonus);
            }
        }
    });
}

// roll for concentration. This will be added to the Actor prototype.
export const rollConcentrationSave = async function(ability, options = {}){
    if ( !this.isOwner ) return;

    let abl = ability ?? this.getFlag("dnd5e", "concentrationAbility");

    let rollConfig = {
        fumble: null,
        critical: null,
        event,
        reliableTalent: this.getFlag("dnd5e", "concentrationReliable"),
        advantage: this.getFlag("dnd5e", "concentrationAdvantage"),
        isConcSave: true,
        concentrationBonus: this.getFlag("dnd5e", "concentrationBonus")
    }
    rollConfig = foundry.utils.mergeObject(rollConfig, options);
    
    // options should always have 'targetValue'.
    // ability is always passed in the event listeners.

    if ( Hooks.call("concentrationnotifier.preRollConcentrationSave", this, rollConfig, abl) === false ) return;
    
    return this.rollAbilitySave(abl, rollConfig);
}
