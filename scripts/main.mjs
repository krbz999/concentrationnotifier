import { CONSTANTS } from "./const.mjs";

export class CN_MAIN {
	// create the data for the new concentration effect.
	static _createEffectData = async (item, castingData = {}, messageData = {}, actorData = {}) => {
		
		// get the caster.
		let caster = item.parent;
		
		// if this is a temporary item, actorId or actorUuid must be provided in actorData.
		if(!caster) caster = actorData.actorUuid ? fromUuidSync(actorData.actorUuid) : undefined;
		
		// bail out if caster is still undefined.
		if(!caster) return ui.notifications.warn("Caster was somehow undefined.");
		
		// create embedded details for the effect to save for later and other functions.
		const flags = {
			core: {statusId: CONSTANTS.MODULE.CONC},
			convenientDescription: game.i18n.format("CN.CONVENIENT_DESCRIPTION", {name: item.name}),
			[CONSTANTS.MODULE.NAME]: {
				actorData: {actorId: caster.id, actorUuid: caster.uuid},
				itemData: !!item.toObject ? item.toObject() : item,
				castingData: foundry.utils.mergeObject(castingData, {
					itemId: item.id,
					itemUuid: item.uuid,
					baseLevel: foundry.utils.getProperty(item, "system.level")
				}),
				messageData
			}
		}

		// append item details to effect description.
		const verbose = !!game.settings.get(CONSTANTS.MODULE.NAME, CONSTANTS.SETTINGS.VERBOSE_TOOLTIPS);
		if(verbose){
			const summary = game.i18n.localize("CN.MESSAGE.DETAILS");
			flags.convenientDescription = `<p>${flags.convenientDescription}</p>
				<details><summary>${summary}</summary>${item.system.description.value}</details>`
		}
		
		// get duration for the effect.
		const itemDuration = foundry.utils.getProperty(item, "system.duration") ?? {};
		const duration = CN_MAIN._getItemDuration(itemDuration);
		
		// get icon for the effect.
		const icon = CN_MAIN._getModuleImage(item);
		
		// get origin for the effect. If the item is temporary, use actor uuid.
		const origin = item.uuid ?? caster.uuid;
		
		// get effect label, depending on settings.
		const prepend = game.settings.get(CONSTANTS.MODULE.NAME, CONSTANTS.SETTINGS.PREPEND_EFFECT_LABELS);
		const label = prepend ? `${game.i18n.localize("CN.NAME.CARD_NAME")} - ${item.name}` : item.name;
		
		// return constructed effect data.
		return {icon, label, origin, duration, flags};
	}
	
	// get the ability the actor uses for concentration saves.
	static _getConcentrationAbility = (actor = null) => {
		// get the game's abilities.
		const abilities = CONFIG.DND5E.abilities;
		
		// get the actor's ability in flags, or default to constitution.
		const concentrationAbility = actor?.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_ABILITY) ?? "con";
		
		// assure that the flag is a valid ability, else default to constitution.
		const abilityShort = Object.keys(abilities).includes(concentrationAbility) ? concentrationAbility : "con";
		
		// get the full name of the ability.
		const abilityLong = abilities[abilityShort];
		
		// return the names.
		return {abilityShort, abilityLong};
	}
	
	// the function executed when clicking the DELETE button for concentration effects.
	static _onClickDeleteButton = (_chatLog, html) => {
		html[0].addEventListener("click", async (event) => {
			
			// get the target of the mouse click.
			const button = event.target;
			
			// bail out if it is not the 'removeeffect' button.
			if(event.target.id !== CONSTANTS.BUTTON_ID.DELETE) return;
			
			// get the chat card of the button.
			const card = button.closest(".chat-card");
			
			// get the id of the chat card.
			const messageId = card.closest(".message").dataset.messageId;
			
			// get the message itself.
			const message = game.messages.get(messageId);
			
			// get the uuid of the effect to delete.
			const effectUuid = message.getFlag(CONSTANTS.MODULE.NAME, "effectUuid") ?? false;
			
			// bail out if the effect uuid could not be found for some reason.
			if(!effectUuid) return;
			
			// get the actual effect.
			const effect = fromUuidSync(effectUuid);
			
			// bail out if the effect could not be found for some reason.
			if(!effect) return;
			
			// reset the button, it should never be disabled unless something is missing.
			button.removeAttribute("disabled");
			
			// if shift key, skip the dialog and just delete the effect.
			if(event.shiftKey) return effect.delete();
			
			// create the dialog to prompt for deletion of the effect.
			const itemName = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.name");
			return Dialog.confirm({
				title: game.i18n.format("CN.DELETE_DIALOG_TITLE", {name: itemName}),
				content: `
					<h4>${game.i18n.localize("AreYouSure")}</h4>
					<p>${game.i18n.format("CN.DELETE_DIALOG_TEXT", {name: itemName})}</p>`,
				yes: effect.delete.bind(effect),
				options: {}
			});
		});
	}
	
	// the function executed when clicking the SAVING THROW button for concentration effects.
	static _onClickSaveButton = (_chatLog, html) => {
		html[0].addEventListener("click", async (event) => {
			
			// get the target of the mouse click.
			const button = event.target;
			
			// bail out if it is not the 'concentrationsave' button.
			if(event.target.id !== CONSTANTS.BUTTON_ID.SAVE) return;
			
			// get the chat card of the button.
			const card = button.closest(".chat-card");
			
			// get the id of the chat card.
			const messageId = card.closest(".message").dataset.messageId;
			
			// get the message itself.
			const message = game.messages.get(messageId);
			
			// get the actor uuid.
			const actorUuid = message.getFlag(CONSTANTS.MODULE.NAME, "actorUuid") ?? false;
			
			// bail out if the uuid could not be found.
			if(!actorUuid) return;
			
			// get the actor from the uuid.
			const uuidActor = fromUuidSync(actorUuid);
			
			// if the actor is a token, use the token actor.
			const actor = uuidActor?.actor ? uuidActor.actor : uuidActor;
			
			// bail out if the actor could not be found.
			if(!actor) return;
			
			// create object of saving throw options.
			const options = {}
			
			// get the DC of the saving throw.
			const saveDC = message.getFlag(CONSTANTS.MODULE.NAME, "saveDC") ?? false;
			if(!!saveDC) options.targetValue = saveDC;
			
			// enable button again; it should never be off.
			button.removeAttribute("disabled");
			
			// roll the save.
			return actor.rollConcentrationSave(options);
		});
	}
	
	// get the image used for the effect.
	static _getModuleImage = (item) => {
		// the custom icon in the settings.
		const moduleImage = game.settings.get(CONSTANTS.MODULE.NAME, CONSTANTS.SETTINGS.CONCENTRATION_ICON);
		
		// whether or not to use the item img instead.
		const useItemImage = game.settings.get(CONSTANTS.MODULE.NAME, CONSTANTS.SETTINGS.CONCENTRATION_ICON_ITEM);
		
		// Case 1: the item has an image, and it is prioritised.
		if(useItemImage && !!item?.img) return item.img;
		
		// Case 2: there is no custom image in the settings, so use the default image.
		if(!moduleImage) return CONSTANTS.MODULE.IMAGE;
		
		// Case 3: Use the custom image in the settings.
		return moduleImage;
	}
	
	// set up the duration of the effect depending on the item.
	static _getItemDuration = (duration) => {
		if(!duration?.value) return {};
		const {value, units} = duration;
		
		// do not bother for these duration types:
		if(["inst", "month", "perm", "spec", "year"].includes(units)) return {};
		
		// cases for the remaining units of time:
		if(units === "round") return {rounds: value};
		if(units === "turn") return {turns: value};
		if(units === "minute") return {seconds: value * 60};
		if(units === "hour") return {seconds: value * 60 * 60};
		if(units === "day") return {seconds: value * 24 * 60 * 60};
	}
	
	// the primary hook. Gets details of the message.
	static _getMessageDetails = (msg, msgData) => {
		
		// get the html of the message.
		const template = document.createElement("template");
		template.innerHTML = msgData.content;
		const html = template.content.firstChild;
		const isHTML = html instanceof HTMLElement;
		if(!isHTML) return;
		
		// get ids from chat message.
		const syntheticActorId = html.getAttribute("data-token-id") ?? false;
		const actorId = html.getAttribute("data-actor-id") ?? false;
		
		// set caster as token uuid if it exists, else use the actor id, but only if linked actor.
		let caster;
		if(syntheticActorId){
			const split = syntheticActorId.split(".");
			const tokenDoc = game.scenes.get(split[1])?.tokens.get(split[3]);
			caster = tokenDoc?.actor;
		}
		else if(game.actors.get(actorId)?.prototypeToken.actorLink){
			caster = game.actors.get(actorId);
		}
		else return;
		
		// get item and spell level.
		const itemId = html.getAttribute("data-item-id");
		const castLevel = Number(html.getAttribute("data-spell-level"));
		const messageData = msg.toObject();
		delete messageData.timestamp;
		
		// bail out if something could not be found.
		if(!caster || !itemId || isNaN(castLevel)) return;
		
		// get item data; if the item does not exist on the actor, use the embedded flag data.
		const itemActor = caster.items.get(itemId);
		const itemFlags = msg.getFlag("dnd5e", "itemData");
		const item = itemActor ? itemActor : itemFlags;
		
		// make sure it is a concentration spell.
		const is_concentration = !!foundry.utils.getProperty(item, "system.components.concentration");
		if(!is_concentration) return;
		
		// create castingData.
		const castingData = {itemId, castLevel};
		
		// create actorData.
		const actorData = {actorId, actorUuid: caster.uuid}
		
		// apply concentration.
		return CN_HELPERS.start_concentration_on_item(item, castingData, messageData, actorData);
	}
	
	// send a message when an actor LOSES concentration.
	static _messageConcLoss = (effect) => {
		// get whether the effect being deleted is a concentration effect.
		if(!CN_HELPERS.effect_is_concentration_effect(effect)) return;
		
		// build the chat message.
		const name = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.name");
		const description = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.system.description.value");
		const content = `
			<p>${game.i18n.format("CN.MESSAGE.CONC_LOSS", {name: effect.parent.name, item: name})}</p>
			<hr>
			<details>
				<summary>${game.i18n.localize("CN.MESSAGE.DETAILS")}</summary> <hr> ${description}
			</details> <hr>`;
		const speaker = {alias: CONSTANTS.MODULE.SPEAKER};
		const flags = {core: {canPopout: true}};
		const user = game.user.id;
		
		return ChatMessage.create({content, speaker, flags, user});
	}
	
	// send a message when an actor GAINS concentration.
	static _messageConcGain = (effect) => {
		// get whether the effect being created is a concentration effect.
		if(!CN_HELPERS.effect_is_concentration_effect(effect)) return;
		
		// build the chat message.
		const name = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.name");
		const description = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.system.description.value");
		const content = `
			<p>${game.i18n.format("CN.MESSAGE.CONC_GAIN", {name: effect.parent.name, item: name})}</p>
			<hr>
			<details>
				<summary>${game.i18n.localize("CN.MESSAGE.DETAILS")}</summary> <hr> ${description}
			</details> <hr>`;
		const speaker = {alias: CONSTANTS.MODULE.SPEAKER};
		const flags = {core: {canPopout: true}};
		const user = game.user.id;
		
		return ChatMessage.create({content, speaker, flags, user});
	}
	
	// store values for use in "updateActor" hook if HP has changed.
	static _storeOldValues = (actor, data, context) => {
		
		// get old values. These always exist, but temp is null when 0.
		const old_temp = foundry.utils.getProperty(actor, "system.attributes.hp.temp") ?? 0;
		const old_value = foundry.utils.getProperty(actor, "system.attributes.hp.value");
		
		// get new values. If they are undefined, there was no change to them, so we use old values.
		const dataTemp = foundry.utils.getProperty(data, "system.attributes.hp.temp");
		const new_temp = (dataTemp === undefined) ? old_temp : (dataTemp ?? 0);
		const new_value = foundry.utils.getProperty(data, "system.attributes.hp.value") ?? old_value;
		
		// calculate health difference.
		const damageTaken = (old_temp + old_value) - (new_temp + new_value);
		
		// if damageTaken > 0, tag context for a saving throw.
		if(damageTaken > 0) context[CONSTANTS.MODULE.NAME] = {save: true, damage: damageTaken};
	}
	
	// if the user is concentrating, and has taken damage, build a chat card, and call for a saving throw.
	static _buildSavingThrowData = async (actor, data, context, userId) => {
		// only do this for the one doing the update.
		if(userId !== game.user.id) return;
		
		// bail out if there is no save needed.
		if(!foundry.utils.getProperty(context, `${CONSTANTS.MODULE.NAME}.save`)) return;
		
		// get damage taken.
		const damageTaken = context[CONSTANTS.MODULE.NAME].damage;
		
		// find a concentration effect.
		const effect = CN_HELPERS.actor_is_concentrating_on_anything(actor);
		
		// bail out if actor is not concentrating.
		if(!effect) return;
		
		// get the name of the item being concentrated on.
		const name = effect.getFlag(CONSTANTS.MODULE.NAME, "itemData.name");
		
		// calculate DC from the damage taken.
		const dc = Math.max(10, Math.floor(Math.abs(damageTaken) / 2));
		
		// get the ability being used for concentration saves.
		const {abilityShort, abilityLong} = CN_MAIN._getConcentrationAbility(actor);
		
		// the chat message contents.
		const cardContent = game.i18n.format("CN.MESSAGE.CONC_SAVE", {
			name: actor.name,
			damage: Math.abs(damageTaken),
			dc,
			ability: abilityLong,
			item: name
		});
		
		// pass to saving throw.
		return CN_HELPERS.request_saving_throw(actor, dc, {cardContent, userId});
	}
	
	// apply min and max to the roll if they exist.
	static min_max_roll_on_save = async (actor, message, options) => {
		const msg = message;
		const floor = actor.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_FLOOR) ?? 1;
		const ceil = actor.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_CEILING) ?? 20;
		
		const useFloor = 20 >= floor && floor > 1;
		const useCeil = 20 > ceil && ceil > 0;
				
		if(useFloor) msg.dice[0].modifiers.push(`min${floor}`);
		if(useCeil) msg.dice[0].modifiers.push(`max${ceil}`);
		msg._formula = msg._formula.replace("d20", "d20" + (
			useFloor ? `min${floor}` : ""
		) + (useCeil > 0 ? `max${ceil}` : ""));
		for(let d20 of msg.dice[0].results){
			if(useFloor && d20.result < floor){
				d20.rerolled = true;
				d20.count = floor;
			}
			if(useCeil && d20.result > ceil){
				d20.rerolled = true;
				d20.count = ceil;
			}
		}
		msg._total = Roll.safeEval(msg.result);
		const speaker = options.speaker ?? ChatMessage.getSpeaker({actor});
		return !options.chatMessage ? msg.toMessage({speaker}) : msg;
	}
	
	// roll for concentration. This will be added to the Actor prototype.
	static roll_concentration_save = async function(options = {}){
		// create object of saving throw options.
		const saveModifiers = foundry.utils.mergeObject({fumble: -1, critical: 21, event}, options);
		
		// get the DC of the saving throw.
		const targetValue = options.targetValue ?? false;
		if(!!targetValue) saveModifiers.targetValue = targetValue;
		
		// add any additional bonuses to the saving throw.
		const concentrationBonus = this.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_BONUS) ?? false;
		saveModifiers.parts = options.parts ? [options.parts] : [];
		if(!!concentrationBonus) saveModifiers.parts.push(concentrationBonus);
		
		// apply min10.
		const concentrationReliable = !!this.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_RELIABLE);
		if(concentrationReliable) saveModifiers.reliableTalent = true;
		
		// apply advantage if flag exists.
		const concentrationAdvantage = !!this.getFlag("dnd5e", CONSTANTS.FLAG.CONCENTRATION_ADVANTAGE);
		if(concentrationAdvantage) saveModifiers.advantage = true;
		
		// get the shorthand key of the ability used for the save.
		const saveAbility = options.ability ? options.ability : CN_MAIN._getConcentrationAbility(this).abilityShort;
		
		// roll the save.
		const initial_roll = await this.rollAbilitySave(saveAbility, {...saveModifiers, chatMessage: false});
		
		// pass the saving throw through the min/max modifier.
		return CN_MAIN.min_max_roll_on_save(this, initial_roll, options);
	}
}

export class CN_SETUP {
	// create the concentration flags on actor Special Traits.
	static _createActorFlags = () => {
		const section = game.i18n.localize("CN.NAME.CARD_NAME");
		const abilityScoreKeys = Object.keys(CONFIG.DND5E.abilities).map(i => `'${i}'`).join(", ");
		
		/* Add bonus on top of the saving throw. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_BONUS] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.BONUS.NAME"),
			hint: game.i18n.localize("CN.CHARACTER_FLAGS.BONUS.HINT"),
			section,
			type: String
		}
		
		/* Change the ability being used for the saving throw. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_ABILITY] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.ABILITY.NAME"),
			hint: game.i18n.format("CN.CHARACTER_FLAGS.ABILITY.HINT", {keys: abilityScoreKeys}),
			section,
			type: String
		}
		
		/* Set a flag for having advantage on Concentration saves. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_ADVANTAGE] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.ADVANTAGE.NAME"),
			hint: game.i18n.localize("CN.CHARACTER_FLAGS.ADVANTAGE.HINT"),
			section,
			type: Boolean
		}
		
		/* Set a flag for not being able to roll below 10. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_RELIABLE] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.RELIABLE.NAME"),
			hint: game.i18n.localize("CN.CHARACTER_FLAGS.RELIABLE.HINT"),
			section,
			type: Boolean
		}
		
		/* Set a number a character cannot roll below. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_FLOOR] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.FLOOR.NAME"),
			hint: game.i18n.localize("CN.CHARACTER_FLAGS.FLOOR.HINT"),
			section,
			type: Number
		}
		
		/* Set a number a character cannot roll above. */
		CONFIG.DND5E.characterFlags[CONSTANTS.FLAG.CONCENTRATION_CEILING] = {
			name: game.i18n.localize("CN.CHARACTER_FLAGS.CEILING.NAME"),
			hint: game.i18n.localize("CN.CHARACTER_FLAGS.CEILING.HINT"),
			section,
			type: Number
		}
	}
}

export class CN_HELPERS {
	// determine if you are concentrating on a specific item.
	static actor_is_concentrating_on_item = (actor, item) => {
		const caster = actor.actor ? actor.actor : actor;
		const effect = caster.effects.find(i => {
			let itemUuid = i.getFlag(CONSTANTS.MODULE.NAME, "castingData.itemUuid");
			return itemUuid === item.uuid;
		});
		return !!effect ? effect : false;
	}
	
	// determine if you are concentrating on ANY item.
	static actor_is_concentrating_on_anything = (actor) => {
		const caster = actor.actor ? actor.actor : actor;
		const effect = caster.effects.find(i => CN_HELPERS.effect_is_concentration_effect(i));
		return !!effect ? effect : false;
	}
	
	// determine if effect is concentration effect.
	static effect_is_concentration_effect = (effect) => {
		return effect.getFlag("core", "statusId") === CONSTANTS.MODULE.CONC;
	}
	
	// end all concentration effects on an actor.
	static end_concentration_on_actor = async (actor) => {
		const caster = actor.actor ? actor.actor : actor;
		const effects = caster.effects.filter(i => CN_HELPERS.effect_is_concentration_effect(i));
		if(effects.length > 0){
			const deleteIds = effects.map(i => i.id);
			return caster.deleteEmbeddedDocuments("ActiveEffect", deleteIds);
		}
		return [];
	}
	
	// end concentration on single item.
	static end_concentration_on_item = async (actor, item) => {
		const caster = item.parent;
		if(!caster) return ui.notifications.warn(game.i18n.localize("CN.WARN.MISSING_CASTER"));

		const effect = CN_HELPERS.actor_is_concentrating_on_item(caster, item);
		if(!!effect) return effect.delete();
		else return ui.notifications.warn(game.i18n.localize("CN.WARN.MISSING_CONC_ON_ITEM"));
	}
	
	// wait for concentration on item to be applied on actor.
	static wait_for_concentration_to_begin = async (actor, item = null, max_wait = 10000) => {
		async function wait(ms){return new Promise(resolve => {setTimeout(resolve, ms)})}
		
		let conc = !!item ? CN_HELPERS.actor_is_concentrating_on_item(actor, item) : CN_HELPERS.actor_is_concentrating_on_anything(actor);
		let waited = 0;
		while(!conc && waited < max_wait){
			await wait(100);
			waited = waited + 100;
			conc = !!item ? CN_HELPERS.actor_is_concentrating_on_item(actor, item) : CN_HELPERS.actor_is_concentrating_on_anything(actor);
		}
		if(!!conc) return conc;
		return false;
	}

	// apply concentration manually (public API method)
	static start_concentration_on_item_API = async (item, castLevel = null) => {
		return CN_HELPERS.start_concentration_on_item(item, {castLevel});
	}
	
	// apply concentration when using a specific item.
	static start_concentration_on_item = async (item, castingData = {}, messageData = {}, actorData = {})  => {
		
		// get the caster.
		let caster = item.parent;
		
		// if this is a temporary item, actorId or actorUuid must be provided in actorData.
		if(!caster) caster = actorData.actorUuid ? fromUuidSync(actorData.actorUuid) : undefined;
		
		// bail out if caster is still undefined.
		if(!caster) return ui.notifications.warn(game.i18n.localize("CN.WARN.MISSING_CASTER"));
		
		// get whether the caster is already concentrating.
		const concentrating = CN_HELPERS.actor_is_concentrating_on_anything(caster);
		
		// create effect data.
		const effectData = await CN_MAIN._createEffectData(item, castingData, messageData, actorData);
		
		// get some needed properties for the following cases.
		const {castLevel, itemId} = foundry.utils.getProperty(effectData, `flags.${CONSTANTS.MODULE.NAME}.castingData`);
		
		// case 1: not concentrating.
		if(!concentrating){
			return caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
		}
		
		// case 2: concentrating on a different item.
		if(concentrating.getFlag(CONSTANTS.MODULE.NAME, "castingData.itemId") !== itemId){
			await CN_HELPERS.end_concentration_on_actor(caster);
			return caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
		}
		
		// case 3: concentrating on the same item but at a different level.
		if(concentrating.getFlag(CONSTANTS.MODULE.NAME, "castingData.castLevel") !== castLevel){
			await CN_HELPERS.end_concentration_on_actor(caster);
			return caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
		}
		
		// case 4: concentrating on the same item at the same level.
		return [];
	}
	
	// method to request a save for concentration.
	static request_saving_throw = async (caster, dc = 10, options = {}) => {
		if(!caster) return ui.notifications.warn(game.i18n.localize("CN.WARN.MISSING_ACTOR"));
		
		// get actor from token.
		const actor = caster.actor ? caster.actor : caster;
		
		// find a concentration effect.
		const effect = CN_HELPERS.actor_is_concentrating_on_anything(actor);
		if(!effect) return ui.notifications.error(game.i18n.localize("CN.WARN.MISSING_CONC"));
		
		// build the message.
		const {abilityShort, abilityLong} = CN_MAIN._getConcentrationAbility(actor);
		const name = game.i18n.localize("CN.NAME.CARD_NAME");
		
		// start constructing the message.
		const messageData = {};
		
		// flags needed for message button listeners.
		messageData["flags"] = {
			[CONSTANTS.MODULE.NAME]: {
				effectUuid: effect.uuid,
				actorUuid: actor.uuid,
				saveDC: dc
			},
			core: {
				canPopout: true
			}
		}
		
		// icon of the effect, used in the chat message.
		const moduleImage = effect.icon;
		
		// the description in the chat message.
		const cardContent = options.cardContent ?? "";
		
		// the full contents of the chat message.
		const saveLabel = game.i18n.format("CN.LABEL.SAVING_THROW", {dc, ability: abilityLong});
		const deleteLabel = game.i18n.localize("CN.LABEL.DELETE_CONC");
		
		messageData["content"] = `
			<div class="dnd5e chat-card">
			<header class="card-header flexrow">
				<img src="${moduleImage}" title="${name}" width="36" height="36"/>
				<h3 class="item-name">${name}</h3>
			</header>
			<div class="card-content"> ${cardContent} </div>
			<div class="card-buttons">
				<button id="${CONSTANTS.BUTTON_ID.SAVE}">${saveLabel}</button>
				<button id="${CONSTANTS.BUTTON_ID.DELETE}">${deleteLabel}</button>
			</div>`;
		
		// get array of users with Owner permission of the actor.
		const whisper = Object.entries(actor.ownership).filter(([id, perm]) => {
			if(!game.users.get(id)) return false;
			if(perm !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return false;
			return true;
		}).map(([id, perm]) => id);
		messageData["whisper"] = whisper;
		
		// get array of users with Owner permission of the actor who are not GMs.
		const playerOwners = whisper.filter(i => !game.users.get(i)?.isGM);
		
		/* creator of the message is:
		the *player owner* applying the damage, if they exist,
		otherwise the first player owner,
		otherwise the one doing the update,
		otherwise the current user. */
		messageData["user"] = (playerOwners.length > 0) ? (
			playerOwners.includes(options.userId) ? options.userId : playerOwners[0]
		) : options.userId ? options.userId : game.user.id;
		
		// set message speaker alias.
		messageData["speaker.alias"] = game.i18n.localize("CN.MESSAGE.SPEAKER");
		
		// create message.
		return ChatMessage.create(messageData);
	}
}
