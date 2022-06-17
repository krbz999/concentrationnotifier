import { CONSTS } from "./const.mjs";

export class ConcentrationNotifier {
	// determine if you are concentrating on a specific item.
	static concentratingOn = (actor, item) => {
		return actor?.effects?.find(i => i.getFlag(CONSTS.MODULE.NAME, "itemUuid") === item?.uuid);
	};
	
	// determine if you are concentrating on ANY item.
	static concentratingAny = (actor) => {
		return actor?.effects?.find(i => ConcentrationNotifier.concentrationEffect(i));
	};
	
	// determine if effect is concentration effect.
	static concentrationEffect = (effect) => {
		return effect.getFlag("core", "statusId") === CONSTS.MODULE.CONC;
	};
	
	// apply concentration when using a specific item.
	static applyConcentrationOnItem = async (item, details = {})  => {
		
		// make the origin of the effect the item uuid if the uuid exists, else the actor uuid (intended for temporary items).
		const casterFromUuid = await fromUuid(details.actorUuid ?? item.parent.uuid);
		const caster = casterFromUuid.actor ? casterFromUuid.actor : casterFromUuid;
		const concentrating = this.concentratingAny(caster);
		
		// create effect data.
		const effectData = await this._createEffectData(item, details);
		
		// case 1: not concentrating.
		if(!concentrating) return caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
		
		// case 2: concentrating on a different item.
		if(concentrating.getFlag(CONSTS.MODULE.NAME, "itemId") !== details.itemId){
			await concentrating.delete();
			return caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
		}
		
		// case 3: concentrating on the same item.
		return;
	};
	
	// Method to request a save for concentration.
	static triggerSavingThrow = async (caster, dc = 10, options = {}) => {
		if(!caster) return ui.notifications.error("You must provide an actor to perform the saving throw.");
		
		// get actor from token.
		const actor = caster.actor ? caster.actor : caster;
		
		// find a concentration effect.
		const effect = ConcentrationNotifier.concentratingAny(actor);
		if(!effect) return ui.notifications.error("The provided actor is not concentrating on anything.");
		
		// get the name of the item being concentrated on.
		const itemName = effect.getFlag(CONSTS.MODULE.NAME, "name");
		
		// build the message.
		const {abilityShort, abilityLong} = this._getConcentrationAbility(actor);
		const name = "Concentration";
		
		// flags needed for message button listeners.
		const flags = {
			[`${CONSTS.MODULE.NAME}.effectUuid`]: effect.uuid,
			[`${CONSTS.MODULE.NAME}.actorUuid`]: actor.uuid,
			[`${CONSTS.MODULE.NAME}.saveDC`]: dc
		};
		
		// icon of the effect, used in the chat message.
		const moduleImage = effect.data.icon;
		
		// the description in the chat message.
		const cardContent = options.cardContent ?? "";
		
		// the full contents of the chat message.  item-card
		const content = `
			<div class="dnd5e chat-card">
			<header class="card-header flexrow">
				<img src="${moduleImage}" title="${name}" width="36" height="36"/>
				<h3 class="item-name">${name}</h3>
			</header>
			<div class="card-content">
				${cardContent}
			</div>
			<div class="card-buttons">
				<button id="${CONSTS.BUTTON_ID.SAVE}">Saving Throw DC ${dc} ${abilityLong}</button>
				<button id="${CONSTS.BUTTON_ID.DELETE}">Remove Concentration</button>
			</div>`;
		
		// get array of users with Owner permission of the actor.
		const whisper = Object.entries(actor.data.permission).filter(([id, perm]) => {
			if(!game.users.get(id)) return false;
			if(perm !== CONST.DOCUMENT_PERMISSION_LEVELS.OWNER) return false;
			return true;
		}).map(([id, perm]) => id);
		
		// get array of users with Owner permission of the actor who are not GMs.
		const playerOwners = whisper.filter(i => !game.users.get(i)?.isGM);
		
		// creator of the message is the PLAYER owner doing the damage, if they exist, otherwise the first player owner, otherwise the one doing the update, otherwise the current user.
		const user = (playerOwners.length > 0) ? (playerOwners.includes(options.userId) ? options.userId : playerOwners[0]) : options.userId ? options.userId : game.user.id;
		
		// set message speaker alias.
		const speaker = {alias: CONSTS.MODULE.SPEAKER};
		
		// create message.
		return ChatMessage.create({flags, content, whisper, user, speaker});
	};
	
	// create the data for the new concentration effect.
	static _createEffectData = async (item, details = {}) => {
		
		// make fixes to details.
		if(!details.actorId) details.actorId = item.parent.id;
		if(!details.actorUuid) details.actorUuid = item.parent.uuid;
		
		if(!details.duration) details.duration = item.data?.data?.duration ?? {};
		const effectDuration = this._getItemDuration(details.duration);
		
		if(!details.img) details.img = item.data?.img ?? item.img ?? CONSTS.MODULE.IMAGE;
		details.img = this._getModuleImage(details.img);
		
		if(!details.itemId) details.itemId = item.id;
		if(!details.itemUuid) details.itemUuid = item.uuid ?? details.actorUuid;
		if(!details.name) details.name = item.name;
		
		// get the correct img.
		const item_img = details.img ?? item?.data.img ?? item?.img ?? CONSTS.MODULE.IMAGE;
		const icon = this._getModuleImage(item_img);
		
		// create origin of item; if the item does not exist, use the actor.
		const fromItemUuid = await fromUuid(details.itemUuid);
		const origin = !!fromItemUuid ? details.itemUuid : details.actorUuid;
		
		// create effect label, depending on module settings.
		const prepend = game.settings.get(CONSTS.MODULE.NAME, CONSTS.SETTINGS.PREPEND_EFFECT_LABELS);
		const label = prepend ? `Concentration - ${details.name}` : details.name;
		
		// create effect data.
		const effectData = {
			icon: details.img,
			label,
			origin,
			tint: "#000000",
			duration: effectDuration ? effectDuration : details.duration,
			flags: {
				core: {statusId: CONSTS.MODULE.CONC},
				convenientDescription: `You are concentrating on ${details.name}.`
			}
		};
		
		// merge object and put all of the details in the flags.
		return mergeObject(expandObject(effectData), {flags: {[CONSTS.MODULE.NAME]: details}});
	};
	
	// get the ability the actor uses for concentration saves.
	static _getConcentrationAbility = (actor = null) => {
		// get the game's abilities.
		const abilities = CONFIG.DND5E.abilities;
		
		// get the actor's ability in flags, or default to constitution.
		const concentrationAbility = actor?.getFlag("dnd5e", CONSTS.FLAG.CONCENTRATION_ABILITY) ?? "con";
		
		// assure that the flag is a valid ability, else default to constitution.
		const abilityShort = Object.keys(abilities).includes(concentrationAbility) ? concentrationAbility : "con";
		
		// get the full name of the ability.
		const abilityLong = abilities[abilityShort];
		
		// return the names.
		return {abilityShort, abilityLong};
	};
	
	// the function executed when clicking the DELETE button for concentration effects.
	static _onClickDeleteButton = (_chatLog, html) => {
		html[0].addEventListener("click", async (event) => {
			
			// get the target of the mouse click.
			const button = event.target;
			
			// bail out if it is not the 'removeeffect' button.
			if(event.target.id !== CONSTS.BUTTON_ID.DELETE) return;
			
			// get the chat card of the button.
			const card = button.closest(".chat-card");
			
			// get the id of the chat card.
			const messageId = card.closest(".message").dataset.messageId;
			
			// get the message itself.
			const message = game.messages.get(messageId);
			
			// get the uuid of the effect to delete.
			const effectUuid = message.getFlag(CONSTS.MODULE.NAME, "effectUuid") ?? false;
			
			// bail out if the effect uuid could not be found for some reason.
			if(!effectUuid) return;
			
			// get the actual effect.
			const effect = await fromUuid(effectUuid);
			
			// bail out if the effect could not be found for some reason.
			if(!effect) return;
			
			// reset the button, it should never be disabled unless something is missing.
			button.removeAttribute("disabled");
			
			// if shift key, skip the dialog and just delete the effect.
			if(event.shiftKey) return effect.delete();
			
			// create the dialog to prompt for deletion of the effect.
			const itemName = effect.getFlag(CONSTS.MODULE.NAME, "name");
			return Dialog.confirm({
				title: `End concentration on ${itemName}?`,
				content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>This will end concentration on ${itemName}.</p>`,
				yes: effect.delete.bind(effect),
				options: {}
			});
		});
	};
	
	// the function executed when clicking the SAVING THROW button for concentration effects.
	static _onClickSaveButton = (_chatLog, html) => {
		html[0].addEventListener("click", async (event) => {
			
			// get the target of the mouse click.
			const button = event.target;
			
			// bail out if it is not the 'concentrationsave' button.
			if(event.target.id !== CONSTS.BUTTON_ID.SAVE) return;
			
			// get the chat card of the button.
			const card = button.closest(".chat-card");
			
			// get the id of the chat card.
			const messageId = card.closest(".message").dataset.messageId;
			
			// get the message itself.
			const message = game.messages.get(messageId);
			
			// get the actor uuid.
			const actorUuid = message.getFlag(CONSTS.MODULE.NAME, "actorUuid") ?? false;
			
			// bail out if the uuid could not be found.
			if(!actorUuid) return;
			
			// get the actor from the uuid.
			const uuidActor = await fromUuid(actorUuid);
			
			// if the actor is a token, use the token actor.
			const actor = uuidActor?.actor ? uuidActor.actor : uuidActor;
			
			// bail out if the actor could not be found.
			if(!actor) return;
			
			// get the actor's relevant flags that modify specifically concentration saving throws.
			const concentrationBonus = actor.getFlag("dnd5e", CONSTS.FLAG.CONCENTRATION_BONUS) ?? false;
			const concentrationReliable = actor.getFlag("dnd5e", CONSTS.FLAG.CONCENTRATION_RELIABLE) ?? false;
			const concentrationAdvantage = actor.getFlag("dnd5e", CONSTS.FLAG.CONCENTRATION_ADVANTAGE) ?? false;
			
			// get the DC of the saving throw.
			const saveDC = message.getFlag(CONSTS.MODULE.NAME, "saveDC") ?? false;
			
			// add any additional bonuses to the saving throw.
			const parts = concentrationBonus ? [concentrationBonus] : [];
			
			// set the target value from the DC.
			const targetValue = saveDC ? saveDC : [];
			
			// apply min10.
			const reliableTalent = concentrationReliable;
			
			// get the shorthand key of the ability used for the save.
			const {abilityShort} = this._getConcentrationAbility(actor);
			
			// create object of saving throw options.
			const saveModifiers = {parts, targetValue, reliableTalent, fumble: -1, critical: 21, event};
			
			// apply advantage if flag exists.
			if(concentrationAdvantage) saveModifiers.advantage = true;
			
			// enable button again; it should never be off.
			button.removeAttribute("disabled");
			
			// roll the save.
			await actor.rollAbilitySave(abilityShort, saveModifiers);
		});
	};
	
	// get the image used for the effect.
	static _getModuleImage = (item_img) => {
		// the custom icon in the settings.
		const moduleImage = game.settings.get(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON);
		
		// whether or not to use the item img instead.
		const useItemImage = game.settings.get(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON_ITEM);
		
		// use the provided img if it exists and item images are prioritised.
		if(useItemImage && item_img) return item_img;
		
		// if there is no module image, use the default one.
		if(!moduleImage) return CONSTS.MODULE.IMAGE;
		
		// use the module image.
		return moduleImage;
	};
	
	static _getItemDuration = (duration) => {
		if(!duration?.value) return false;
		const {value, units} = duration;
		
		// do not bother for these duration types:
		if(["inst", "month", "perm", "spec", "year"].includes(units)) return false;
		
		// cases for the remaining units of time:
		if(units === "round") return {rounds: value};
		if(units === "turn") return {turns: value};
		if(units === "minute") return {seconds: value * 60};
		if(units === "hour") return {seconds: value * 60 * 60};
		if(units === "day") return {seconds: value * 24 * 60 * 60};
	};
	
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
		}else if(game.actors.get(actorId)?.data?.token?.actorLink){
			caster = game.actors.get(actorId);
		}else return;
		
		// get item and spell level.
		const itemId = html.getAttribute("data-item-id");
		const spellLevel = Number(html.getAttribute("data-spell-level"));
		const message = msg.toObject();
		
		// bail out if something could not be found.
		if(!caster || !itemId || isNaN(spellLevel)) return;
		const itemActor = caster.items.get(itemId);
		const itemFlags = msg.getFlag("dnd5e", "itemData");
		
		// make sure it's a concentration spell.
		const item = itemActor ? itemActor : itemFlags;
		const itemData = item?.data?.data ? duplicate(item.data.data) : item?.data ? duplicate(item.data) : {};
		if(!itemData?.components?.concentration) return;
		
		// get item data to save in the effect.
		const {school, components, duration, level: baseLevel} = itemData;
		const {img, uuid: itemUuid, name} = item;
		const actorUuid = caster.uuid;
		
		/* Create the effect. */
		const details = {
			spellLevel, baseLevel, school, components, duration, img, name,
			message, itemUuid, actorUuid, itemId, actorId
		};
		ConcentrationNotifier.applyConcentrationOnItem(item, details);
	};
	
	// send a message when an actor LOSES concentration.
	static _messageConcLoss = (effect) => {
		// get whether the effect being deleted is a concentration effect.
		if(!ConcentrationNotifier.concentrationEffect(effect)) return;
		
		// build the chat message.
		const name = effect.getFlag(CONSTS.MODULE.NAME, "name");
		const content = `${effect.parent.name} lost concentration on ${name}.`
		const speaker = {alias: CONSTS.MODULE.SPEAKER};
		
		ChatMessage.create({content, speaker});
	};
	
	// send a message when an actor GAINS concentration.
	static _messageConcGain = (effect) => {
		// get whether the effect being created is a concentration effect.
		if(!ConcentrationNotifier.concentrationEffect(effect)) return;
		
		// build the chat message.
		const name = effect.getFlag(CONSTS.MODULE.NAME, "name");
		const content = `${effect.parent.name} is concentrating on ${name}.`;
		const speaker = {alias: CONSTS.MODULE.SPEAKER};
		
		ChatMessage.create({content, speaker});
	};
	
	// store values for use in "updateActor" hook if HP has changed.
	static _storeOldValues = (actor, data, context) => {
		
		// get old values. These always exist, but temp is null when 0.
		const old_temp = getProperty(actor, "data.data.attributes.hp.temp") ?? 0;
		const old_value = getProperty(actor, "data.data.attributes.hp.value");
		
		// get new values. If they are undefined, there was no change to them, so we use old values.
		const new_temp = getProperty(data, "data.attributes.hp.temp") === undefined ? old_temp : (getProperty(data, "data.attributes.hp.temp") ?? 0);
		const new_value = getProperty(data, "data.attributes.hp.value") ?? old_value;
		
		// calculate health difference.
		const damageTaken = (old_temp + old_value) - (new_temp + new_value);
		
		// if damageTaken > 0, tag context for a saving throw.
		if(damageTaken > 0) context[CONSTS.MODULE.NAME] = {save: true, damage: damageTaken};
	};
	
	// if the user is concentrating, and has taken damage, build a chat card, and call for a saving throw.
	static _buildSavingThrowData = async (actor, data, context, userId) => {
		// only do this for the one doing the update.
		if(userId !== game.user.id) return;
		
		// bail out if there is no save needed.
		if(!getProperty(context, `${CONSTS.MODULE.NAME}.save`)) return;
		
		// get damage taken.
		const damageTaken = context[CONSTS.MODULE.NAME].damage;
		
		// find a concentration effect.
		const effect = ConcentrationNotifier.concentratingAny(actor);
		
		// bail out if actor is not concentrating.
		if(!effect) return;
		
		// get the name of the item being concentrated on.
		const name = effect.getFlag(CONSTS.MODULE.NAME, "name");
		
		// calculate DC from the damage taken.
		const dc = Math.max(10, Math.floor(Math.abs(damageTaken) / 2));
		
		// get the ability being used for concentration saves.
		const {abilityShort, abilityLong} = ConcentrationNotifier._getConcentrationAbility(actor);
		
		// the chat message contents.
		const cardContent = `${actor.name} has taken <strong>${Math.abs(damageTaken)}</strong> damage and must make a <strong>DC ${dc}</strong> ${abilityLong} saving throw to maintain concentration on <strong>${name}</strong>.`;
		
		// pass to saving throw.
		return ConcentrationNotifier.triggerSavingThrow(actor, dc, {cardContent, userId});
	};
	
	// create the concentration flags on actor Special Traits.
	static _createActorFlags = () => {
		const section = "Concentration";
		const abilityScoreKeys = Object.keys(CONFIG.DND5E.abilities).map(i => `'${i}'`).join(", ");
		
		/* Add bonus on top of the saving throw. */
		CONFIG.DND5E.characterFlags[CONSTS.FLAG.CONCENTRATION_BONUS] = {
			name: "Concentration Bonus",
			hint: `A bonus to saving throws to maintain concentration. This field supports dynamic values such as @classes.sorcerer.levels as well as dice expressions.`,
			section,
			type: String
		};
		
		/* Change the ability being used for the saving throw. */
		CONFIG.DND5E.characterFlags[CONSTS.FLAG.CONCENTRATION_ABILITY] = {
			hint: `The ability this character uses for saving throws to maintain concentration. The possible values are ${abilityScoreKeys}.`,
			name: "Concentration Ability",
			section,
			type: String
		};
		
		/* Set a flag for not being able to roll below 10. */
		CONFIG.DND5E.characterFlags[CONSTS.FLAG.CONCENTRATION_RELIABLE] = {
			hint: "This character cannot roll below 10 to maintain concentration.",
			name: "Reliable Concentration",
			section,
			type: Boolean
		};
		
		/* Set a flag for having advantage on Concentration saves. */
		CONFIG.DND5E.characterFlags[CONSTS.FLAG.CONCENTRATION_ADVANTAGE] = {
			hint: "This character rolls with advantage to maintain concentration.",
			name: "Concentration Advantage",
			section,
			type: Boolean
		};
	};
}

// button-click hooks:
Hooks.on("renderChatLog", ConcentrationNotifier._onClickDeleteButton);
Hooks.on("renderChatPopout", ConcentrationNotifier._onClickDeleteButton);
Hooks.on("renderChatLog", ConcentrationNotifier._onClickSaveButton);
Hooks.on("renderChatPopout", ConcentrationNotifier._onClickSaveButton);

// functionality hooks:
Hooks.on("preCreateChatMessage", ConcentrationNotifier._getMessageDetails);
Hooks.on("preUpdateActor", ConcentrationNotifier._storeOldValues);
Hooks.on("updateActor", ConcentrationNotifier._buildSavingThrowData);
Hooks.once("ready", ConcentrationNotifier._createActorFlags);

// gain and loss messages.
Hooks.on("preDeleteActiveEffect", ConcentrationNotifier._messageConcLoss);
Hooks.on("preCreateActiveEffect", ConcentrationNotifier._messageConcGain);