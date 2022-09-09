import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

export function setHooks_promptCreator(){

    // store values for use in "updateActor" hook if HP has changed.
    Hooks.on("preUpdateActor", (actor, data, context) => {
        // get old values. These always exist, but temp is null when 0.
        const old_temp = foundry.utils.getProperty(actor, "system.attributes.hp.temp") ?? 0;
        const old_value = foundry.utils.getProperty(actor, "system.attributes.hp.value");
        
        // get new values. If they are undefined, there was no change to them, so we use old values.
        const dataTemp = foundry.utils.getProperty(data, "system.attributes.hp.temp");
        const new_temp = (dataTemp === undefined) ? old_temp : (dataTemp ?? 0);
        const new_value = foundry.utils.getProperty(data, "system.attributes.hp.value") ?? old_value;
        
        // calculate health difference.
        const damage = (old_temp + old_value) - (new_temp + new_value);
        
        // if damageTaken > 0, tag context for a saving throw.
        context[MODULE] = {save: damage > 0, damage};
    });

    // if the user is concentrating, and has taken damage, build a chat card, and call for a saving throw.
    Hooks.on("updateActor", async (actor, data, context, userId) => {
        // only do this for the one doing the update.
        if ( userId !== game.user.id ) return;
        
        // bail out if there is no save needed, and get the damage taken.
        const cn = context[MODULE];
        if ( !cn ) return;
        const {save, damage} = cn;
        if ( !save ) return;
        // calculate DC from the damage taken.
        const dc = Math.max(10, Math.floor(Math.abs(damage) / 2));

        // find a concentration effect.
        const effect = API.isActorConcentrating(actor);
        // bail out if actor is not concentrating.
        if ( !effect ) return;
        // get the name of the item being concentrated on.
        const name = effect.getFlag(MODULE, "data.itemData.name");
        // get the ability being used for concentration saves.
        const abilityKey = actor.getFlag("dnd5e", "concentrationAbility") ?? "con";
        // get whisper targets.
        const whisper = Object.entries(actor.ownership).filter(([id,level]) => {
            if ( !game.users.get(id) ) return false;
            return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }).map(([id]) => id);
        
        // the chat message contents.
        const template = "modules/concentrationnotifier/templates/savingThrowPrompt.hbs";
        const content = await renderTemplate(template, {
            details: game.i18n.format("CN.CARD.PROMPT.DETAILS", {
                dc, itemName: name, damage,
                saveType: CONFIG.DND5E.abilities[abilityKey],
                actorName: actor.name,
                itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
            }),
            buttonSaveLabel: game.i18n.format("CN.CARD.PROMPT.SAVE", {
                dc, saveType: CONFIG.DND5E.abilities[abilityKey]
            }),
            ability: abilityKey,
            actorUuid: actor.uuid,
            effectUuid: effect.uuid,
            dc,
        });
        
        const messageData = {
            content,
            whisper,
            speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("CN.SPEAKER") }),
            flags: {
                core: { canPopout: true },
                concentrationnotifier: { prompt: true }
            }
        }
        
        // create chat card.
        return ChatMessage.create(messageData);
    });
}

export async function promptConcentrationSave(caster, {saveDC = 10, message} = {}){
    const actor = caster.actor ?? caster;
    // find a concentration effect.
    const effect = API.isActorConcentrating(actor);
    // bail out if actor is not concentrating.
    if ( !effect ) {
        ui.notifications.warn(game.i18n.format("CN.ACTOR_NOT_CONCENTRATING", {
            name: actor.name
        }));
        return null;
    }
    // get the name of the item being concentrated on.
    const name = effect.getFlag(MODULE, "data.itemData.name");
    // get the ability being used for concentration saves.
    const abilityKey = actor.getFlag("dnd5e", "concentrationAbility") ?? "con";
    // get whisper targets.
    const whisper = Object.entries(actor.ownership).filter(([id,level]) => {
        if ( !game.users.get(id) ) return false;
        return level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }).map(([id]) => id);

    // the chat message contents.
    const template = "modules/concentrationnotifier/templates/savingThrowPrompt.hbs";
    const content = await renderTemplate(template, {
        details: game.i18n.format("CN.CARD.PROMPT.DETAILS_MANUAL", {
            dc: saveDC,
            itemName: name,
            saveType: CONFIG.DND5E.abilities[abilityKey],
            actorName: actor.name,
            itemUuid: effect.getFlag(MODULE, "data.castData.itemUuid")
        }),
        buttonSaveLabel: game.i18n.format("CN.CARD.PROMPT.SAVE", {
            dc: saveDC,
            saveType: CONFIG.DND5E.abilities[abilityKey]
        }),
        dc: saveDC,
        ability: abilityKey,
        actorUuid: actor.uuid,
        effectUuid: effect.uuid,
        description: message
    });

    const messageData = {
        content,
        whisper,
        speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("CN.SPEAKER") }),
        flags: {
            core: { canPopout: true },
            concentrationnotifier: { prompt: true }
        }
    }
    
    // create chat card.
    return ChatMessage.create(messageData);
}
