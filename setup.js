import { CONSTANTS } from "./scripts/const.mjs";
import { registerSettings } from "./scripts/settings.mjs";
import { CN_MAIN, CN_SETUP, CN_HELPERS } from "./scripts/main.mjs";

Hooks.once("init", () => {
    console.log(`${CONSTANTS.MODULE.SHORT} | Initializing ${CONSTANTS.MODULE.TITLE}`);
    registerSettings();
	
    Actor.prototype.rollConcentrationSave = CN_MAIN.roll_concentration_save;
    globalThis.ConcentrationNotifier = {
        beginConcentration: CN_HELPERS.start_concentration_on_item_API,
        breakConcentration: CN_HELPERS.end_concentration_on_actor,
        breakConcentrationForItem: CN_HELPERS.end_concentration_on_item,
        isActorConcentrating: CN_HELPERS.actor_is_concentrating_on_anything,
        isActorConcentratingOnItem: CN_HELPERS.actor_is_concentrating_on_item,
        promptConcentrationSave: CN_HELPERS.request_saving_throw,
        isEffectConcentration: CN_HELPERS.effect_is_concentration_effect,
        waitForConcentrationStart: CN_HELPERS.wait_for_concentration_to_begin
    }
});

// button-click hooks:
Hooks.on("renderChatLog", CN_MAIN._onClickDeleteButton);
Hooks.on("renderChatPopout", CN_MAIN._onClickDeleteButton);
Hooks.on("renderChatLog", CN_MAIN._onClickSaveButton);
Hooks.on("renderChatPopout", CN_MAIN._onClickSaveButton);

// functionality hooks:
Hooks.on("preCreateChatMessage", CN_MAIN._getMessageDetails);
Hooks.on("preUpdateActor", CN_MAIN._storeOldValues);
Hooks.on("updateActor", CN_MAIN._buildSavingThrowData);
Hooks.once("ready", CN_SETUP._createActorFlags);

// gain and loss messages.
Hooks.on("preDeleteActiveEffect", CN_MAIN._messageConcLoss);
Hooks.on("preCreateActiveEffect", CN_MAIN._messageConcGain);
