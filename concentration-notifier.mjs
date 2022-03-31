Hooks.on('preCreateChatMessage', async (msg, caster) => {
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
	
	const concentrating = token.actor.effects.find(i => i.data.flags?.concentrationNotifier?.spellName);
	if(concentrating) await concentrating.delete();
	
	const effectData = {
		icon: 'icons/magic/light/orb-lightbulb-gray.webp',
		label: `Concentration - ${item.name}`,
		origin: `Actor.${token.actor.id}.Item.${itemId}`,
		tint: '#000000',
		'flags.concentrationNotifier.spellName': item.name,
		'flags.core.statusId': `Concentration - ${item.name}`,
		'flags.convenientDescription': `You are concentrating on ${item.name}.`,
	};
	return token.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
});

Hooks.on('preDeleteActiveEffect', async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.data.flags?.concentrationNotifier?.spellName ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} lost concentration on ${concentrating}.`,
		'speaker.alias': 'Concentration Notifier'
	});
});

Hooks.on('preCreateActiveEffect', async (effect) => {
	const tokenActor = effect.parent;
	const concentrating = effect.data.flags?.concentrationNotifier?.spellName ?? false;
	if(!concentrating) return;
	
	ChatMessage.create({
		content: `${tokenActor.name} is concentrating on ${concentrating}.`,
		'speaker.alias': 'Concentration Notifier'
	});
});

Hooks.on('updateActor', async (actor, data, dmg) => {
	if(!game.user.isGM) return;
	
	const damageTaken = dmg.dhp ?? 0;
	const effect = actor.effects.find(i => i.data.flags.concentrationNotifier.spellName) ?? false;
	if(!effect || damageTaken >= 0) return;
	
	const itemName = effect.data.flags.concentrationNotifier.spellName;
	const dc = Math.max(10, Math.floor(Math.abs(damageTaken) / 2));
	const ability = 'con';
	const actorId = actor.id;
	const name = 'Concentration';
	const fakeMessage = new ChatMessage();
	const messageData = fakeMessage.toObject();
	
	messageData.flags['dnd5e.itemData'] = {name, type: 'loot'};
	messageData.flags['concentrationNotifier.effectUuid'] = effect.uuid;
	messageData.flags['concentrationNotifier.actorUuid'] = actor.uuid;
	messageData.content = `
		<div class="dnd5e chat-card item-card" data-actor-id="${actorId}">
		<header class="card-header flexrow">
			<img src="icons/magic/light/orb-lightbulb-gray.webp" title="${name}" width="36" height="36"/>
			<h3 class="item-name">${name}</h3>
		</header>
		<div class="card-content">
			${actor.name} has taken ${Math.abs(damageTaken)} damage and must make a DC ${dc} ${CONFIG.DND5E.abilities[ability]} saving throw to maintain concentration on ${itemName}.
		</div>
		<div class="card-buttons">
			<button data-action="concentrationsave">Saving Throw DC ${dc} ${CONFIG.DND5E.abilities[ability]}</button>
			<button data-action="removeeffect">Remove Concentration</button>
		</div>`;
	messageData.speaker.alias = 'Concentration Notifier';
	messageData.whisper = Object.entries(actor.data.permission).filter(i => i[0] !== 'default' && i[1] === 3).map(i => i[0]); // array of users with owner permission
	ChatMessage.create(messageData);
});

Hooks.on('ready', () => {
	CONFIG.DND5E.characterFlags.concentrationBonus = {
		name: 'Concentration Bonus',
		hint: 'Bonus to Constitution saving throws to maintain concentration.',
		section: 'DND5E.Feats',
		type: String
	};
	CONFIG.DND5E.allowedActorFlags.push('concentrationBonus');
});

const onClickDeleteButton = (_chatLog, html) => {
	html.on('click', 'button[data-action="removeeffect"]', async (event) => {
		const button = event.currentTarget;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		
		const effectUuid = message.data.flags?.concentrationNotifier?.effectUuid ?? '';
		if(!effectUuid) return;
		
		const effect = await fromUuid(effectUuid);
		if(!effect) return;
		
		effect.delete();
	});
};

const onClickSaveButton = (_chatLog, html) => {
	html.on('click', 'button[data-action="concentrationsave"]', async (event) => {
		const button = event.currentTarget;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		
		const actorUuid = message.data.flags?.concentrationNotifier?.actorUuid ?? '';
		if(!actorUuid) return;
		
		let theActor = await fromUuid(actorUuid);
		if(theActor instanceof TokenDocument) theActor = theActor.actor;
		if(!theActor) return;
		
		const concentrationFlag = theActor.data.flags?.dnd5e?.concentrationBonus;
		const parts = concentrationFlag ? [concentrationFlag] : [];
		theActor.rollAbilitySave('con', {parts});
	});
};

Hooks.on('renderChatLog', onClickDeleteButton);
Hooks.on('renderChatPopout', onClickDeleteButton);

Hooks.on('renderChatLog', onClickSaveButton);
Hooks.on('renderChatPopout', onClickSaveButton);