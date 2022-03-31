import { MODULE_NAME } from "./const.mjs";
import { SETTING_NAMES } from "./settings.mjs";

// Add 'dawn' and 'dusk' recharge methods
Hooks.on("ready", () => {
	if(!game.settings.get(MODULE_NAME, SETTING_NAMES.FORMULA_RECHARGE)) return;
	CONFIG.DND5E.limitedUsePeriods.dawn = 'Dawn';
	CONFIG.DND5E.limitedUsePeriods.dusk = 'Dusk';
});

// Add a charge recovery field
Hooks.on("renderItemSheet5e", (itemSheet, html, _) => {
	if(!game.settings.get(MODULE_NAME, SETTING_NAMES.FORMULA_RECHARGE)) return;
	if(!['dawn', 'dusk'].includes(itemSheet.item.data.data.uses?.per)) return;
	
	const div = document.createElement('div');
	div.setAttribute('class', 'form-group recharge-formula');
	div.innerHTML = `
		<label>Charge recovery formula</label>
		<div class="form-fields">
			<input type="text" name="flags.zhell-recharge.recovery-formula" value="${itemSheet.document.data.flags["zhell-recharge"]?.["recovery-formula"] ?? ''}">
		</div>`;
	
	let per = html[0].querySelector(".form-group.uses-per");
	per.parentNode.insertBefore(div, per.nextSibling);
});

// recharge magic items on New Day, using data.flags["zhell-recharge"]["recovery-formula"]
Hooks.on("restCompleted", async (actor, data) => {
	if(!game.settings.get(MODULE_NAME, SETTING_NAMES.FORMULA_RECHARGE)) return;
	
	if(!data.newDay || !actor) return;
	let rechargingItems = actor.items.filter(i => i.data?.data?.activation?.type
		&& i.data.flags["zhell-recharge"]?.["recovery-formula"]
		&& Roll.validate(i.data.flags["zhell-recharge"]["recovery-formula"])
		&& i.data.data.uses.value < i.data.data.uses.max
		&& ['dawn', 'dusk'].includes(i.data.data.uses.per));
	
	if(!rechargingItems.length) return;
	
	const flavor = `${actor.name}'s magic items recharge:`;
	let content = `<table style="width: 100%; border: none"><thead><tr><th style="width: 60%; text-align: center">Magic Item</th><th style="width: 20%; text-align: center">Old</th><th style="width: 20%; text-align: center">New</th></tr></thead><tbody>`;
	const speaker = {alias: 'Magic Items'}
	const updates = rechargingItems.map(i => {
		let uses = i.data.data.uses;
		let rec = i.data.flags["zhell-recharge"]["recovery-formula"] ?? '0';
		rec = Roll.replaceFormulaData(rec, actor.getRollData());
		let iRoll = new Roll(rec).evaluate({async: false});
		game.dice3d?.showForRoll(iRoll, game.user, true);
		content += `<tr><td>${i.name}</td><td style="text-align: center">${uses.value}</td><td style="text-align: center">${Math.min(uses.value + iRoll.total, uses.max)}</td></tr>`;
		return {_id: i.id, 'data.uses.value': Math.min(uses.max, uses.value + iRoll.total)};
	});

	content += `</tbody></table>`;

	await actor.updateEmbeddedDocuments('Item', updates);
	const chatData = {flavor, content, speaker};
	await ChatMessage.create(chatData);
});