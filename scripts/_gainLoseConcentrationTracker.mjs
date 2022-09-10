import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

export function setHooks_gainLoseConcentrationTracker(){

    // send a message when an actor GAINS concentration.
    Hooks.on("createActiveEffect", async (effect, context, userId) => {
        if ( userId !== game.user.id ) return;

        // get whether the effect being created is a concentration effect.
        const isConcentration = API.isEffectConcentration(effect);
        if ( !isConcentration ) return;

        // effect might be on an unowned item.
        if ( !effect.modifiesActor ) return;

        const data = {
            details: game.i18n.format("CN.CARD.GAIN.DETAILS", {
                itemName: effect.getFlag(MODULE, "data.itemData.name"),
                actorName: effect.parent.name
            }),
            itemImg: effect.getFlag(MODULE, "data.itemData.img"),
            itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
        }
        const content = await renderTemplate("modules/concentrationnotifier/templates/concentrationGain.hbs", data);
        const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
        const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

        const whisper = (publicMode && !alwaysWhisper) ? [] : Object.entries(effect.parent.ownership).filter(([id, level]) => {
            if ( !game.users.get(id) ) return false;
            return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }).map(([id]) => id);

        const messageData = {
            content,
            flags: { core: { canPopout: true } },
            whisper,
            speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("CN.SPEAKER") }),
        }
        return ChatMessage.create(messageData);
    });

    // send a message when an actor LOSES concentration.
    Hooks.on("deleteActiveEffect", async (effect, context, userId) => {
        if ( userId !== game.user.id ) return;

        if ( context.concMessage === false ) return;

        // get whether the effect being deleted is a concentration effect.
        const isConcentration = API.isEffectConcentration(effect);
        if ( !isConcentration ) return;

        // effect might be on an unowned item.
        if ( !effect.modifiesActor ) return;

        const data = {
            details: game.i18n.format("CN.CARD.LOSS.DETAILS", {
                itemName: effect.getFlag(MODULE, "data.itemData.name"),
                actorName: effect.parent.name
            }),
            itemImg: effect.getFlag(MODULE, "data.itemData.img"),
            itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
        }
        const content = await renderTemplate("modules/concentrationnotifier/templates/concentrationLoss.hbs", data);
        const publicMode = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
        const alwaysWhisper = game.settings.get(MODULE, "always_whisper_messages");

        const whisper = (publicMode && !alwaysWhisper) ? [] : Object.entries(effect.parent.ownership).filter(([id, level]) => {
            if ( !game.users.get(id) ) return false;
            return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }).map(([id]) => id);

        const messageData = {
            content,
            flags: { core: { canPopout: true } },
            whisper,
            speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("CN.SPEAKER") }),
        }
        return ChatMessage.create(messageData);
    });
}
