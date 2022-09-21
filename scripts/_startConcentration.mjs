import { MODULE } from "./settings.mjs";
import { API } from "./_publicAPI.mjs";

export function setHooks_startConcentration(){

    Hooks.on("dnd5e.useItem", async (item) => {
        // item must be an owned item.
        const actor = item.parent;
        if ( !actor ) return;

        // item must require concentration.
        let requiresConc;
        if ( item.type === "spell" ) {
            const path = "system.components.concentration";
            requiresConc = foundry.utils.getProperty(item, path);
        }
        else requiresConc = item.getFlag(MODULE, "data.requiresConcentration");
        if ( !requiresConc ) return;
        
        // get spell levels.
        const castLevel = item.system.level;
        const baseLevel = fromUuidSync(item.uuid)?.system.level;
        const itemUuid = item.uuid;
        
        // create castingData.
        const data = {
            itemData: item.toObject(),
            castData: { baseLevel, castLevel, itemUuid }
        }
        
        // apply concentration.
        return applyConcentration(actor, item, data);
    });
}

// apply concentration when using a specific item.
async function applyConcentration(actor, item, data){
    
    // get whether the caster is already concentrating.
    const isConc = API.isActorConcentrating(actor);
    
    // create effect data.
    const effectData = await createEffectData(actor, item, data);
    
    // get some needed properties for the following cases.
    const newUuid = item.uuid;
    const castLevel = data.castData.castLevel;
    
    // case 1: not concentrating.
    if ( !isConc ) {
        return actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    
    // case 2: concentrating on a different item.
    if ( isConc.getFlag(MODULE, "data.castData.itemUuid") !== newUuid ) {
        await breakConcentration(actor, false);
        return actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    
    // case 3: concentrating on the same item but at a different level.
    if ( isConc.getFlag(MODULE, "data.castData.castLevel") !== castLevel ) {
        await breakConcentration(actor, false);
        return actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    
    // case 4: concentrating on the same item at the same level.
    return [];
}

// create the data for the new concentration effect.
async function createEffectData(actor, item, data){
    
    const verbose = game.settings.get(MODULE, "verbose_tooltips");
    const prepend = game.settings.get(MODULE, "prepend_effect_labels");

    // create description.
    let description = game.i18n.format("CN.CONCENTRATING_ON_ITEM", {
        name: item.name
    });
    const intro = description;
    const content = item.system.description.value;
    const template = "modules/concentrationnotifier/templates/effectDescription.hbs";
    if ( verbose ) description = await renderTemplate(template, {
        description,
        itemDescription: item.system.description.value
    });
    
    // set up flags of the effect.
    const flags = {
        core: { statusId: "concentration" },
        convenientDescription: description,
        concentrationnotifier: { data },
        "visual-active-effects": { data: { intro, content } }
    }
    
    // get effect label, depending on settings.
    let label = item.name;
    if ( prepend ) {
        label = `${game.i18n.localize("CN.CONCENTRATION")} - ${label}`;
    }
    
    // return constructed effect data.
    return {
        icon: getModuleImage(item),
        label,
        origin: item.uuid ?? actor.uuid,
        duration: getItemDuration(item),
        flags
    }
}

// set up the duration of the effect depending on the item.
function getItemDuration(item){
    const duration = item.system.duration;

    if ( !duration?.value ) return {};
    const { value, units } = duration;
    
    // do not bother for these duration types:
    if ( ["inst", "perm", "spec"].includes(units) ) return {};
    
    // cases for the remaining units of time:
    if ( units === "round" ) return { rounds: value };
    if ( units === "turn" ) return { turns: value };
    if ( units === "minute" ) return { seconds: value * 60 };
    if ( units === "hour" ) return { seconds: value * 60 * 60 };
    if ( units === "day" ) return { seconds: value * 24 * 60 * 60 };
    if ( units === "month" ) return { seconds: value * 30 * 24 * 60 * 60 };
    if ( units === "year" ) return { seconds: value * 12 * 30 * 24 * 60 * 60 };
}

// get the image used for the effect.
function getModuleImage(item){
    // the custom icon in the settings.
    const moduleImage = game.settings.get(MODULE, "concentration_icon");
    
    // whether or not to use the item img instead.
    const useItemImage = game.settings.get(MODULE, "concentration_icon_item");
    
    // Case 1: the item has an image, and it is prioritised.
    if ( useItemImage && item.img ) return item.img;
    
    // Case 2: there is no custom image in the settings, so use the default image.
    if ( !moduleImage ) return "icons/magic/light/orb-lightbulb-gray.webp";
    
    // Case 3: Use the custom image in the settings.
    return moduleImage;
}

// end all concentration effects on an actor.
async function breakConcentration(caster, message = true){
    const actor = caster.actor ?? caster;
    const deleteIds = actor.effects.filter(eff => {
        return API.isEffectConcentration(eff);
    }).map(i => i.id);
    return actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds, {
        concMessage: message
    });
}
