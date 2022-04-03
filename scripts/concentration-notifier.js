Hooks.on("preCreateChatMessage", async (msg, caster) => {
	const html = await msg.getHTML();
	const cardData = html[0].querySelector('.dnd5e.chat-card.item-card');
	const tokenId = caster.speaker?.token;
	const itemId = cardData?.getAttribute('data-item-id');
	const spellLevel = cardData?.getAttribute('data-spell-level');
	
	if(!tokenId || !itemId || !spellLevel) return;
	
	/* Create the effect. */
	const token = canvas.tokens.placeables.find(i => i.id === tokenId);
	if(!token || !token?.actor) return ui.notifications.error("Could not find token.");
	
	const item = token.actor.items.get(itemId);
	if(!item?.data.data.components?.concentration) return;
	
	ConcentrationNotifier.applyConcentrationOnItem(item);
});

Hooks.on("preDeleteActiveEffect", async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.data.flags?.concentrationNotifier?.spellName ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} lost concentration on ${concentrating}.`,
		"speaker.alias": 'Concentration Notifier'
	});
});

Hooks.on("preCreateActiveEffect", async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.data.flags?.concentrationNotifier?.spellName ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} is concentrating on ${concentrating}.`,
		"speaker.alias": 'Concentration Notifier'
	});
});

Hooks.on("updateActor", async (actor, data, dmg) => {
	if(!game.user.isGM) return;
	
	const damageTaken = dmg.dhp ?? 0;
	const effect = actor.effects.find(i => i.data.flags?.concentrationNotifier?.spellName) ?? false;
	if(!effect || damageTaken >= 0) return;
	
	const itemName = effect.data.flags.concentrationNotifier.spellName;
	const dc = Math.max(10, Math.floor(Math.abs(damageTaken) / 2));
	
	const {abilityShort, abilityLong} = ConcentrationNotifier.getConcentrationAbility(actor);
	const actorId = actor.id;
	const name = "Concentration";
	const fakeMessage = new ChatMessage();
	const messageData = fakeMessage.toObject();
	
	messageData.flags['dnd5e.itemData'] = {name, type: "loot"};
	messageData.flags["concentrationNotifier.effectUuid"] = effect.uuid;
	messageData.flags["concentrationNotifier.actorUuid"] = actor.uuid;
	messageData.flags["concentrationNotifier.saveDC"] = dc;
	messageData.content = `
		<div class="dnd5e chat-card item-card" data-actor-id="${actorId}">
		<header class="card-header flexrow">
			<img src="icons/magic/light/orb-lightbulb-gray.webp" title="${name}" width="36" height="36"/>
			<h3 class="item-name">${name}</h3>
		</header>
		<div class="card-content">
			${actor.name} has taken ${Math.abs(damageTaken)} damage and must make a DC ${dc} ${abilityLong} saving throw to maintain concentration on ${itemName}.
		</div>
		<div class="card-buttons">
			<button data-action="concentrationsave">Saving Throw DC ${dc} ${abilityLong}</button>
			<button data-action="removeeffect">Remove Concentration</button>
		</div>`;
	const owners = Object.entries(actor.data.permission).filter(i => i[0] !== "default" && i[1] === 3).map(i => i[0]); // array of users with owner permission
	const playerOwners = owners.filter(i => !game.users.get(i).isGM);
	messageData.speaker.alias = 'Concentration Notifier';
	messageData.whisper = owners;
	messageData.user = playerOwners.length > 0 ? playerOwners[0] : game.user.id;
	ChatMessage.create(messageData);
});

Hooks.on("ready", () => {
	/* Add bonus on top of the saving throw. */
	CONFIG.DND5E.characterFlags.concentrationBonus = {
		name: 'Concentration Bonus',
		hint: 'Bonus to saving throws to maintain concentration.',
		section: 'DND5E.Feats',
		type: String
	};
	
	/* Change the ability being used for the saving throw. */
	CONFIG.DND5E.characterFlags.concentrationAbility = {
		hint: "The ability this character uses for saving throws to maintain concentration. Use a three-letter shorthand such as 'str' or 'cha'. Default: 'con'.",
		name: "Concentration Ability",
		section: "DND5E.Feats",
		type: String
	};
	
	/* Set a flag for not being able to roll below 10. */
	CONFIG.DND5E.characterFlags.concentrationReliable = {
		hint: "This character cannot roll below 10 to maintain concentration.",
		name: "Reliable Concentration",
		section: "DND5E.Feats",
		type: Boolean
	};
});

const onClickDeleteButton = (_chatLog, html) => {
	html.on("click", "button[data-action='removeeffect']", async (event) => {
		const button = event.currentTarget;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		
		const effectUuid = message.data.flags?.concentrationNotifier?.effectUuid ?? "";
		if(!effectUuid) return;
		
		const effect = await fromUuid(effectUuid);
		if(!effect) return;
		
		effect.delete();
	});
};

const onClickSaveButton = (_chatLog, html) => {
	html.on("click", "button[data-action='concentrationsave']", async (event) => {
		const button = event.currentTarget;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		
		const actorUuid = message.data.flags?.concentrationNotifier?.actorUuid ?? "";
		if(!actorUuid) return;
		
		let actor = await fromUuid(actorUuid);
		if(actor instanceof TokenDocument) actor = actor.actor;
		if(!actor) return;
		
		const concentrationBonus = actor.data.flags?.dnd5e?.concentrationBonus;
		const concentrationReliable = actor.data.flags?.dnd5e?.concentrationReliable ?? false;
		
		const saveDC = message.data.flags?.concentrationNotifier?.saveDC;
		const parts = concentrationBonus ? [concentrationBonus] : [];
		const targetValue = saveDC ? saveDC : [];
		const reliableTalent = concentrationReliable;
		
		const {abilityShort} = ConcentrationNotifier.getConcentrationAbility(actor);
		actor.rollAbilitySave(abilityShort, {parts, targetValue, reliableTalent});
	});
};

Hooks.on("renderChatLog", onClickDeleteButton);
Hooks.on("renderChatPopout", onClickDeleteButton);

Hooks.on("renderChatLog", onClickSaveButton);
Hooks.on("renderChatPopout", onClickSaveButton);

class ConcentrationNotifier {
	static MODULE_NAME = "concentrationnotifier";
	static MODULE_TITLE = "Z's Concentration Notifier";
	
	/* Method to apply concentration when using a specific item. */
	static applyConcentrationOnItem = async (item = null)  => {
		if(item instanceof Item.implementation){
			const origin = item.uuid;
			const concentrating = item.parent?.effects?.find(i => i.data.flags?.concentrationNotifier?.spellName);
			if(!concentrating || concentrating.data.origin !== origin){
				await concentrating?.delete();
				const effectData = this.createEffectData(item);
				return item.parent?.createEmbeddedDocuments("ActiveEffect", [effectData]);
			}
		}
	}
	
	static createEffectData = (item = null) => {
		const name = item?.name;
		const origin = item?.uuid;
		
		const effectData = {
			icon: "icons/magic/light/orb-lightbulb-gray.webp",
			label: `Concentration - ${name}`,
			origin,
			tint: "#000000",
			"flags.concentrationNotifier.spellName": name,
			"flags.core.statusId": `Concentration - ${name}`,
			"flags.convenientDescription": `You are concentrating on ${name}.`
		};
		return effectData;
	};
	
	static getConcentrationAbility = (actor = null) => {
		const abilities = CONFIG.DND5E.abilities;
		const concentrationAbility = actor?.data?.flags?.dnd5e?.concentrationAbility;
		const abilityShort = Object.keys(abilities).includes(concentrationAbility) ? concentrationAbility : "con";
		const abilityLong = abilities[abilityShort] ?? "Constitution";
		return {abilityShort, abilityLong};
	};
}
