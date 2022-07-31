import { CONSTS } from "./scripts/const.mjs";
import { registerSettings } from "./scripts/settings.mjs";
import { api } from "./scripts/api.mjs";
import { CN } from "./scripts/concentration-notifier.mjs";

Hooks.once("init", () => {
    console.log(`${CONSTS.MODULE.SHORT} | Initializing ${CONSTS.MODULE.TITLE}`);
    registerSettings();
	api.register();
});

// button-click hooks:
Hooks.on("renderChatLog", CN._onClickDeleteButton);
Hooks.on("renderChatPopout", CN._onClickDeleteButton);
Hooks.on("renderChatLog", CN._onClickSaveButton);
Hooks.on("renderChatPopout", CN._onClickSaveButton);

// functionality hooks:
Hooks.on("preCreateChatMessage", CN._getMessageDetails);
Hooks.on("preUpdateActor", CN._storeOldValues);
Hooks.on("updateActor", CN._buildSavingThrowData);
Hooks.once("ready", CN._createActorFlags);

// gain and loss messages.
Hooks.on("preDeleteActiveEffect", CN._messageConcLoss);
Hooks.on("preCreateActiveEffect", CN._messageConcGain);
