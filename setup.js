import { CONSTANTS } from "./scripts/const.mjs";
import { registerSettings } from "./scripts/settings.mjs";
import { api } from "./scripts/api.mjs";
import { CN_MAIN, CN_SETUP } from "./scripts/main.mjs";

Hooks.once("init", () => {
    console.log(`${CONSTANTS.MODULE.SHORT} | Initializing ${CONSTANTS.MODULE.TITLE}`);
    registerSettings();
	api.register();
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
