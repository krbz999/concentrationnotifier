export function setHooks_createSheetCheckBox(){

    Hooks.on("renderItemSheet", async (sheet, html) => {
        const item = sheet.object;
        if(item.type === "spell") return;
        const durationSelect = html[0].querySelector("[name='system.duration.units']");
        if(durationSelect){
            const innerHTML = await renderTemplate("modules/concentrationnotifier/templates/concentrationCheckbox.hbs", {
                requiresConcentration: !!item.getFlag("concentrationnotifier", "data.requiresConcentration")
            });
            const div = document.createElement("DIV");
            div.innerHTML = innerHTML;
            durationSelect.after(...div.children);
        }
    });
}
