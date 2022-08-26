// create the concentration flags on actor Special Traits.
Hooks.once("setup", () => {
    const section = game.i18n.localize("CN.NAME.CARD_NAME");
    const abilityScoreKeys = Object.keys(CONFIG.DND5E.abilities).map(i => `'${i}'`).join(", ");
    
    /* Add bonus on top of the saving throw. */
    CONFIG.DND5E.characterFlags["concentrationBonus"] = {
        name: game.i18n.localize("CN.CHARACTER_FLAGS.BONUS.NAME"),
        hint: game.i18n.localize("CN.CHARACTER_FLAGS.BONUS.HINT"),
        section,
        type: String
    }
    
    /* Change the ability being used for the saving throw. */
    CONFIG.DND5E.characterFlags["concentrationAbility"] = {
        name: game.i18n.localize("CN.CHARACTER_FLAGS.ABILITY.NAME"),
        hint: game.i18n.format("CN.CHARACTER_FLAGS.ABILITY.HINT", {keys: abilityScoreKeys}),
        section,
        type: String
    }
    
    /* Set a flag for having advantage on Concentration saves. */
    CONFIG.DND5E.characterFlags["concentrationAdvantage"] = {
        name: game.i18n.localize("CN.CHARACTER_FLAGS.ADVANTAGE.NAME"),
        hint: game.i18n.localize("CN.CHARACTER_FLAGS.ADVANTAGE.HINT"),
        section,
        type: Boolean
    }
    
    /* Set a flag for not being able to roll below 10. */
    CONFIG.DND5E.characterFlags["concentrationReliable"] = {
        name: game.i18n.localize("CN.CHARACTER_FLAGS.RELIABLE.NAME"),
        hint: game.i18n.localize("CN.CHARACTER_FLAGS.RELIABLE.HINT"),
        section,
        type: Boolean
    }
});
