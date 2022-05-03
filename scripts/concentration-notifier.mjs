import { CONST } from "./const.mjs";
import { SETTING_NAMES } from "./settings.mjs";

Hooks.on("preCreateChatMessage", async (msg, caster) => {
	const html = await msg.getHTML();
	const cardData = html[0].querySelector(".dnd5e.chat-card.item-card");
	const tokenId = caster.speaker?.token;
	const itemId = cardData?.getAttribute("data-item-id");
	const spellLevel = Number(cardData?.getAttribute("data-spell-level"));
	const message = msg.toObject();
	
	if(!tokenId || !itemId || isNaN(spellLevel)) return;
	
	const token = canvas.tokens.placeables.find(i => i.id === tokenId);
	if(!token || !token?.actor) return ui.notifications.error("Could not find token.");
	
	const item = token.actor.items.get(itemId);
	
	const itemChatData = item?.getChatData();
	if(!itemChatData?.components?.concentration) return;
	
	const school = itemChatData.school;
	const components = itemChatData.components;
	const duration = itemChatData.duration;
	const baseLevel = itemChatData.level;
	
	/* Create the effect. */
	const details = {spellLevel, school, components, duration, baseLevel, message};
	ConcentrationNotifier.applyConcentrationOnItem(item, details);
});

Hooks.on("preDeleteActiveEffect", async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME) ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} lost concentration on ${concentrating}.`,
		"speaker.alias": CONST.MODULE.SPEAKER
	});
});

Hooks.on("preCreateActiveEffect", async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME) ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} is concentrating on ${concentrating}.`,
		"speaker.alias": CONST.MODULE.SPEAKER
	});
});

Hooks.on("preUpdateActor", (actor, data, dmg) => {
	/* Store values for use in "updateActor" hook if HP has changed. */
	if(data.data?.attributes?.hp?.temp || data.data?.attributes?.hp?.temp === null || data.data?.attributes?.hp?.value){
		let {temp, value} = actor.getRollData().attributes.hp; // old values before updating
		temp = temp || 0;
		dmg.storedValues = {temp, value};
	}
});

Hooks.on("updateActor", async (actor, data, dmg) => {
	if(!game.user.isGM) return;
	
	/* Compute DC from the damage taken. */
	if(!dmg.storedValues) return;
	let {temp, value} = actor.getRollData().attributes.hp;
	temp = temp || 0;
	const damageTaken = (dmg.storedValues.temp + dmg.storedValues.value) - (temp + value);
	
	const effect = actor.effects.find(i => i.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME)) ?? false;
	if(!effect || damageTaken <= 0) return;
	
	const itemName = effect.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME);
	const dc = Math.max(10, Math.floor(Math.abs(damageTaken) / 2));
	const {abilityShort, abilityLong} = ConcentrationNotifier._getConcentrationAbility(actor);
	
	const cardContent = `${actor.name} has taken ${Math.abs(damageTaken)} damage and must make a DC ${dc} ${abilityLong} saving throw to maintain concentration on ${itemName}.`;
	
	ConcentrationNotifier.triggerSavingThrow(actor, dc, {cardContent});
});

Hooks.on("ready", () => {
	const section = "Concentration";
	const abilityScoreKeys = Object.keys(CONFIG.DND5E.abilities).map(i => `'${i}'`).join(", ");
	
	/* Add bonus on top of the saving throw. */
	CONFIG.DND5E.characterFlags[CONST.FLAG.CONCENTRATION_BONUS] = {
		name: "Concentration Bonus",
		hint: `A bonus to saving throws to maintain concentration. This field supports dynamic values such as @classes.sorcerer.levels as well as dice expressions.`,
		section,
		type: String
	};
	
	/* Change the ability being used for the saving throw. */
	CONFIG.DND5E.characterFlags[CONST.FLAG.CONCENTRATION_ABILITY] = {
		hint: `The ability this character uses for saving throws to maintain concentration. The possible values are ${abilityScoreKeys}.`,
		name: "Concentration Ability",
		section,
		type: String
	};
	
	/* Set a flag for not being able to roll below 10. */
	CONFIG.DND5E.characterFlags[CONST.FLAG.CONCENTRATION_RELIABLE] = {
		hint: "This character cannot roll below 10 to maintain concentration.",
		name: "Reliable Concentration",
		section,
		type: Boolean
	};
	
	/* Set a flag for having advantage on Concentration saves. */
	CONFIG.DND5E.characterFlags[CONST.FLAG.CONCENTRATION_ADVANTAGE] = {
		hint: "This character rolls with advantage to maintain concentration.",
		name: "Concentration Advantage",
		section,
		type: Boolean
	};
});

export class ConcentrationNotifier {
	
	
	/** Method to apply concentration when using a specific item.
	 *
	 * @function applyConcentrationOnItem
	 * @param {item5e} item			The item to concentrate on.
	 * @param {Object} [details]		Additional details to save in the effect.
	 * 
	 * @return {Document[]}			Array with the created effect.
	 */
	static applyConcentrationOnItem = async (item = null, details = {})  => {
		if(item instanceof Item.implementation){
			const origin = item.uuid;
			const concentrating = item.parent?.effects?.find(i => i.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME)) ?? false;
			if(!concentrating || concentrating?.data.origin !== origin){
				if(concentrating) await concentrating?.delete();
				const effectData = this._createEffectData(item, details);
				return item.parent?.createEmbeddedDocuments("ActiveEffect", [effectData]);
			}
		}
		return [];
	};
	
	/** Method to request a save for concentration.
	 ** Produces error message if target is not concentrating.
	 *
	 * @function triggerSavingThrow
	 * @param {actor5e} actor			The actor or token concentrating.
	 * @param {Number} [dc]				The DC for the saving throw. Default 10.
	 * @param {Object} [options]		The message content (full html).
	 * 
	 * @return {ChatMessage}			The chat message produced.
	 */
	static triggerSavingThrow = (actor, dc = 10, options = {}) => {
		if(!actor) return ui.notifications.error("You must provide an actor to perform the saving throw.");
		if(actor instanceof Token || actor instanceof TokenDocument) actor = actor.actor;
		
		const effect = actor.effects.find(i => i.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME)) ?? false;
		if(!effect) return ui.notifications.error("The provided actor is not concentrating on anything.");
		
		const itemName = effect.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME);
		
		const {abilityShort, abilityLong} = this._getConcentrationAbility(actor);
		const name = "Concentration";
		const fakeMessage = new ChatMessage();
		const messageData = fakeMessage.toObject();
		
		messageData.flags[`dnd5e.itemData`] = {name, type: "loot"};
		messageData.flags[`${CONST.MODULE.NAME}.effectUuid`] = effect.uuid;
		messageData.flags[`${CONST.MODULE.NAME}.actorUuid`] = actor.uuid;
		messageData.flags[`${CONST.MODULE.NAME}.saveDC`] = dc;
		
		const moduleImage = this._getModuleImage();
		
		const cardContent = options.cardContent ?? `${actor.name} is being prompted for a DC ${dc} ${abilityLong} saving throw to maintain concentration on ${itemName}.`;
		messageData.content = `
			<div class="dnd5e chat-card item-card" data-actor-id="${actor.id}">
			<header class="card-header flexrow">
				<img src="${moduleImage}" title="${name}" width="36" height="36"/>
				<h3 class="item-name">${name}</h3>
			</header>
			<div class="card-content">
				${cardContent}
			</div>
			<div class="card-buttons">
				<button data-action="concentrationsave">Saving Throw DC ${dc} ${abilityLong}</button>
				<button data-action="removeeffect">Remove Concentration</button>
			</div>`;
		const owners = Object.entries(actor.data.permission).filter(i => i[0] !== "default" && i[1] === 3).map(i => i[0]); // array of users with owner permission
		const playerOwners = owners.filter(i => !game.users.get(i).isGM);
		messageData.speaker.alias = CONST.MODULE.SPEAKER;
		messageData.whisper = owners;
		messageData.user = playerOwners.length > 0 ? playerOwners[0] : game.user.id;
		return ChatMessage.create(messageData);
	};
	
	static _createEffectData = (item = null, details = {}) => {
		
		const moduleImage = this._getModuleImage();
		
		const name = item?.name;
		const origin = item?.uuid;
		
		const effectData = {
			icon: moduleImage,
			label: `Concentration - ${name}`,
			origin,
			tint: "#000000",
			flags: {
				[CONST.MODULE.NAME]: {[CONST.FLAG.SPELL_NAME]: name},
				core: {statusId: `Concentration - ${name}`},
				convenientDescription: `You are concentrating on ${name}.`
			}
		};
		return mergeObject(expandObject(effectData), {flags: {[CONST.MODULE.NAME]: details}});
	};
	
	static _getConcentrationAbility = (actor = null) => {
		const abilities = CONFIG.DND5E.abilities;
		const concentrationAbility = actor?.getFlag("dnd5e", CONST.FLAG.CONCENTRATION_ABILITY) ?? "con";
		const abilityShort = Object.keys(abilities).includes(concentrationAbility) ? concentrationAbility : "con";
		const abilityLong = abilities[abilityShort] ?? "Constitution";
		return {abilityShort, abilityLong};
	};
	
	static _onClickDeleteButton = (_chatLog, html) => {
		html.on("click", "button[data-action='removeeffect']", async (event) => {
			const button = event.currentTarget;
			const card = button.closest(".chat-card");
			const messageId = card.closest(".message").dataset.messageId;
			const message = game.messages.get(messageId);
			
			const effectUuid = message.getFlag(CONST.MODULE.NAME, "effectUuid") ?? false;
			if(!effectUuid) return;
			
			const effect = await fromUuid(effectUuid);
			if(!effect) return;
			
			if(event.shiftKey) effect.delete();
			else{
				const spellName = effect.getFlag(CONST.MODULE.NAME, CONST.FLAG.SPELL_NAME);
				return Dialog.confirm({
					title: `End concentration on ${spellName}?`,
					content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>This will end concentration on ${spellName}.</p>`,
					yes: effect.delete.bind(effect),
					options: {}
				});
			}
		});
	};
	
	static _onClickSaveButton = (_chatLog, html) => {
		html.on("click", "button[data-action='concentrationsave']", async (event) => {
			const button = event.currentTarget;
			const card = button.closest(".chat-card");
			const messageId = card.closest(".message").dataset.messageId;
			const message = game.messages.get(messageId);
			
			const actorUuid = message.getFlag(CONST.MODULE.NAME, "actorUuid") ?? false;
			if(!actorUuid) return;
			
			let actor = await fromUuid(actorUuid);
			if(actor instanceof TokenDocument) actor = actor.actor;
			if(!actor) return;
			
			const concentrationBonus = actor.getFlag("dnd5e", CONST.FLAG.CONCENTRATION_BONUS) ?? false;
			const concentrationReliable = actor.getFlag("dnd5e", CONST.FLAG.CONCENTRATION_RELIABLE) ?? false;
			const concentrationAdvantage = actor.getFlag("dnd5e", CONST.FLAG.CONCENTRATION_ADVANTAGE) ?? false;
			const saveDC = message.getFlag(CONST.MODULE.NAME, "saveDC") ?? false;
			
			const parts = concentrationBonus ? [concentrationBonus] : [];
			const targetValue = saveDC ? saveDC : [];
			const reliableTalent = concentrationReliable;
			
			const {abilityShort} = this._getConcentrationAbility(actor);
			const saveModifiers = {parts, targetValue, reliableTalent, fumble: -1, critical: 21, event};
			if(concentrationAdvantage) saveModifiers.advantage = true;
			
			actor.rollAbilitySave(abilityShort, saveModifiers);
		});
	};
	
	static _getModuleImage = () => {
		const moduleImage = game.settings.get(CONST.MODULE.NAME, SETTING_NAMES.CONCENTRATION_ICON);
		if(!moduleImage) return CONST.MODULE.IMAGE;
		return moduleImage;
	};
}

Hooks.on("renderChatLog", ConcentrationNotifier._onClickDeleteButton);
Hooks.on("renderChatPopout", ConcentrationNotifier._onClickDeleteButton);

Hooks.on("renderChatLog", ConcentrationNotifier._onClickSaveButton);
Hooks.on("renderChatPopout", ConcentrationNotifier._onClickSaveButton);