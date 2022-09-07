import { MODULE } from "./settings.mjs";

export function setHooks_createSheetCheckBox(){

    Hooks.on("renderItemSheet", async (sheet, html) => {
        const item = sheet.object;
        if ( item.type === "spell" ) return;
        const durationSelect = html[0].querySelector("[name='system.duration.units']");
        if ( durationSelect ) {
            const template = "modules/concentrationnotifier/templates/concentrationCheckbox.hbs";
            const requiresConcentration = !!item.getFlag(MODULE, "data.requiresConcentration");
            const innerHTML = await renderTemplate(template, { requiresConcentration });
            const div = document.createElement("DIV");
            div.innerHTML = innerHTML;
            durationSelect.after(...div.children);
        }
    });
}
