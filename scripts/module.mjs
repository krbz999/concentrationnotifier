class Module {
  static ID = "concentrationnotifier";
  static STATUS = "concentration";
  static REASON = {NOT_REQUIRED: 0, NOT_CONCENTRATING: 1, DIFFERENT_ITEM: 2, DIFFERENT_LEVEL: 3, UPCASTABLE: 4};

  /* ---------------------------- */
  /*                              */
  /*         MODULE SETUP         */
  /*                              */
  /* ---------------------------- */

  /** Initialize module. */
  static init() {
    Module._characterFlags();
    Hooks.on("renderItemSheet", Module._renderItemSheet);
    Hooks.on("dnd5e.createScrollFromSpell", Module._createScrollFromSpell);
    Hooks.on("renderChatMessage", Module._renderChatMessage);
    Hooks.on("createActiveEffect", Module._createActiveEffect);
    Hooks.on("deleteActiveEffect", Module._deleteActiveEffect);
  }

  /**
   * Add character flags for concentration-related attributes.
   */
  static _characterFlags() {
    const abils = Object.entries(CONFIG.DND5E.abilities).map(v => {
      return [v[0], v[1].label];
    });
    const data = {
      /* Add bonus on top of the saving throw. */
      concentrationBonus: {type: String},
      /* Change the ability being used for the saving throw. */
      concentrationAbility: {type: String, choices: Object.fromEntries([['', null], ...abils])},
      /* Set a flag for having advantage on Concentration saves. */
      concentrationAdvantage: {type: Boolean},
      /* Set a flag for not being able to roll below 10. */
      concentrationReliable: {type: Boolean},
      /* Set a flag for not being able to concentrate on any items. */
      concentrationUnfocused: {type: Boolean}
    };
    Object.entries(data).forEach(([key, values]) => {
      CONFIG.DND5E[key] = {
        name: `CN.Flag${key.capitalize()}`,
        hint: `CN.Flag${key.capitalize()}Hint`,
        section: "DND5E.Concentration",
        ...values
      };
    });
  }

  /**
   * Hook function to add a checkbox for concentration on non-spell items.
   * @param {ItemSheet5e} sheet     The item sheet.
   * @param {HTMLElement} html      The element of the sheet.
   */
  static async _renderItemSheet(sheet, [html]) {
    const item = sheet.document;
    if (item.type === "spell") return;
    const durationSelect = html.querySelector("[name='system.duration.units']");
    if (!durationSelect) return;

    // The current duration type must be in `CONFIG.DND5E.scalarTimePeriods`.
    if (!(item.system.duration?.units in CONFIG.DND5E.scalarTimePeriods)) return;

    const div = document.createElement("DIV");
    const template = `modules/${Module.ID}/templates/concentrationCheckbox.hbs`;
    div.innerHTML = await renderTemplate(template, {
      requiresConcentration: item.flags[Module.ID]?.data?.requiresConcentration
    });
    durationSelect.after(...div.children);
  }

  /**
   * Hook function to add the concentration value to created scrolls.
   * @param {Item5e|object} spell         The spell or item data to be made into a scroll.
   * @param {object} spellScrollData      The final item data used to make the scroll.
   */
  static _createScrollFromSpell(spell, spellScrollData) {
    const conc = spell.system?.components?.concentration;
    if (conc) foundry.utils.setProperty(spellScrollData, `flags.${Module.ID}.data.requiresConcentration`, true);
  }

  /**
   * Create a message in chat when an actor begins concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was created.
   * @param {object} options            The creation options.
   * @param {string} userId             The id of the user who created the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _createActiveEffect(effect, options, userId) {
    return Module._notifyConcentration(effect, options, userId, 1);
  }

  /**
   * Create a message in chat when an actor ends concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was deleted.
   * @param {object} options            The deletion options.
   * @param {string} userId             The id of the user who deleted the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _deleteActiveEffect(effect, options, userId) {
    return Module._notifyConcentration(effect, options, userId, 0);
  }

  /**
   * Create and send a message when an actor gains or loses concentration.
   * @param {ActiveEffect5e} effect     An active effect that is created or deleted on an actor.
   * @param {object} options            An object of creation or deletion options.
   * @param {string} userId             The id of the user that created or deleted the effect.
   * @param {number} type               Whether the effect is created (1) or deleted (0).
   * @returns {Promise<ChatMessage>}
   */
  static async _notifyConcentration(effect, options, userId, type) {
    if (game.user.id !== userId) return;
    if (options.concMessage === false) return;
    if (!Module.isEffectConcentration(effect)) return;
    if (!(effect.parent instanceof CONFIG.Actor.documentClass)) return;

    const data = effect.flags[Module.ID].data;
    const templateData = {
      details: game.i18n.format(`CN.NotifyConcentrationHas${type === 1 ? "Begun" : "Ended"}`, {
        itemName: data.itemData.name, actorName: effect.parent.name
      }),
      itemImg: data.itemData.img,
      itemUuid: data.castData.itemUuid,
      effectUuid: effect.uuid,
      showUtilButtons: game.settings.get(Module.ID, "show_util_buttons"),
      showEnd: type === 1
    };
    const template = `modules/${Module.ID}/templates/concentration-notify.hbs`;
    const isPublic = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
    const alwaysWhisper = game.settings.get(Module.ID, "alwayus_whisper_messages");
    let whisper;
    if (isPublic && !alwaysWhisper) whisper = [];
    else whisper = game.users.filter(u => effect.parent.testUserPermission(u, "OWNER")).map(u => u.id);
    const messageData = {
      content: await renderTemplate(template, templateData),
      whisper: whisper,
      flags: {core: {canPopout: true}},
      speaker: {alias: game.i18n.localize("CN.ModuleTitle")}
    };
    return ChatMessage.implementation.create(messageData);
  }

  /* ---------------------------- */
  /*                              */
  /*          API METHODS         */
  /*                              */
  /* ---------------------------- */

  /**
   * Is this effect a concentration effect?
   * @param {ActiveEffect5e} effect
   * @returns {boolean}
   */
  static isEffectConcentration(effect) {
    return effect.statuses.has(Module.STATUS);
  }

  /**
   * Does this item require concentration?
   * @param {Item5e} item
   * @returns {boolean}
   */
  static itemRequiresConcentration(item) {
    const isSpell = item.type === "spell";
    if (isSpell) return item.system.components.concentration;

    const units = item.system.duration?.units in CONFIG.DND5E.scalarTimePeriods;
    return units && !!item.flags[Module.ID]?.data.requiresConcentration;
  }

  /**
   * Determine whether an actor is concentrating.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to test.
   * @returns {ActiveEffect5e|boolean}                    The effect, if concentrating, otherwise false.
   */
  static isActorConcentrating(caster) {
    const actor = Module._getActor(caster);
    return actor ? actor.appliedEffects.find(e => e.statuses.has(Module.STATUS)) : false;
  }

  /**
   * Return an actor, or false, from a given token, token document, or actor.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor.
   * @returns {Actor5e|boolean}
   */
  static _getActor(caster) {
    const classes = [CONFIG.Token.documentClass, CONFIG.Token.objectClass];
    const actor = classes.some(cls => caster instanceof cls) ? caster.actor : caster;
    return (actor instanceof CONFIG.Actor.documentClass) ? actor : false;
  }

  /**
   * Returns whether and why an item being used should affect current concentration. Used to determine
   * if concentration should be changed, and for the AbilityUseDialog to determine if it should display
   * a warning. If no specific reason for one or the other is found, the function returns false.
   * @param {Item5e} item           The item being used.
   * @returns {number|boolean}      An integer from 'REASON', or false.
   */
  static _itemUseAffectsConcentration(item) {
    const {level, preparation} = item.system;

    // Case 0: Does this item even require concentration? (Do Nothing)
    const requires = itemRequiresConcentration(item);
    if (!requires) return Module.REASON.NOT_REQUIRED;

    /* The concentration effect already on the actor, if any. */
    const effect = Module.isActorConcentrating(item.actor);

    // Case 1: Are you concentrating on something else?
    if (!effect) return Module.REASON.NOT_CONCENTRATING;
    const cast = effect.flags[Module.ID]?.data.castData ?? {};

    // Case 2: Are you concentrating on an entirely different item?
    if (cast.itemUuid !== item.uuid) return Module.REASON.DIFFERENT_ITEM;

    // Case 3: Are you concentrating on the same item at a different spell level?
    if (cast.castLevel !== item.system.level) return Module.REASON.DIFFERENT_LEVEL;

    // Case 4: You are concentrating on the same item, at the same level, but it can be upcast.
    if ((level > 0) && CONFIG.DND5E.spellUpcastModes.includes(preparation.mode)) return Module.REASON.UPCASTABLE;

    // None of the above are true, so the usage is 'free' far as concentration is concerned.
    return false;
  }

  /* ---------------------------- */
  /*                              */
  /*        CHATLOG METHODS       */
  /*                              */
  /* ---------------------------- */

  /**
   * Append chat log listeners to rendered chat messages.
   * @param {ChatMessage} message     The rendered chat message.
   * @param {HTMLElement} html        The element of the chat message.
   */
  static _renderChatMessage(message, [html]) {
    html.querySelectorAll(".concentrationnotifier [data-prompt]").forEach(n => {
      const action = n.dataset.prompt;
      if (action === "save") n.addEventListener("click", Module._onClickSave);
      else if (action === "end") n.addEventListener("click", Module._onClickEnd);
      else if (action === "templates") n.addEventListener("click", Module._onClickTemplates);
      else if (action === "item") n.addEventListener("click", Module._onClickItem);
    });
  }

  /**
   * Perform a saving throw to maintain concentration on the spell.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {Promise<D20Roll>}      The rolled save.
   */
  static async _onClickSave(event) {
    const data = event.currentTarget.dataset;
    const actor = await fromUuid(data.uuid);
    return actor.rollConcentrationSave(data.ability, {targetValue: data.target, event});
  }

  /**
   * Prompt or immediately end the concentration.
   * @param {PointerEvent} event                The initiating click event.
   * @returns {Promise<ActiveEffect|null>}      The deleted effect.
   */
  static async _onClickEnd(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const effect = await fromUuid(uuid);
    if (event.shiftKey) return effect.delete();
    const name = effect.flags[Module.ID].data.itemData.name;
    return Dialog.wait({
      title: game.i18n.format("CN.ConfirmEndConcentrationTitle", {name}),
      content: game.i18n.format("CN.ConfirmEndConcentrationText", {name}),
      buttons: {
        yes: {
          icon: "<i class='fa-solid fa-check'></i>",
          label: game.i18n.localize("Yes"),
          callback: effect.delete.bind(effect)
        },
        no: {
          icon: "<i class='fa-solid fa-times'></i>",
          label: game.i18n.localize("No")
        }
      }
    }, {id: `${Module.ID}-delete-${effect.id}`}).render(true);
  }

  /**
   * Delete all related templates on the scene that you have permission to delete.
   * @param {PointerEvent} event                        The initiating click event.
   * @returns {Promise<MeasuredTemplateDocument[]>}     The deleted templates.
   */
  static async _onClickTemplates(event) {
    if (!canvas?.ready) return;
    const origin = event.currentTarget.dataset.origin;
    const ids = canvas.scene.templates.reduce((acc, t) => {
      if (t.isOwner && (t.flags.dnd5e?.origin === origin)) acc.push(t.id);
      return acc;
    }, []);
    return canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
  }

  /**
   * Render the item being concentrated on.
   * @param {PointerEvent} event          The initiating click event.
   * @returns {Promise<ItemSheet5e>}      The rendered item sheet.
   */
  static async _onClickItem(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const item = await fromUuid(uuid);
    return item.sheet.render(true);
  }

  /* ---------------------------- */
  /*                              */
  /*      COLLECTION HANDLING     */
  /*                              */
  /* ---------------------------- */

  /**
   * A mapping of all currently concentrating actors. This collection is dynamically updated when effects change,
   * and should not be considered an ultimate truth.
   * @type {Collection<Actor5e>}
   */
  get collection() {
    const collection = this._collection ??= new foundry.utils.Collection();
    for (const key of collection.keys()) if (!Module.isActorConcentrating(collection.get(key))) collection.delete(key);
    return collection;
  }

  /**
   * Convert a key, which can be a document, to the uuid of an actor, if possible.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   * @returns {string|null}                                         An actor uuid.
   */
  _convertKey(key) {
    const classes = [CONFIG.Item.documentClass, CONFIG.Token.documentClass, CONFIG.Token.objectClass];
    if (classes.some(cls => key instanceof cls)) return key.actor?.uuid ?? null;
    else if (key instanceof CONFIG.Actor.documentClass) return key.uuid ?? null;
    return key;
  }

  /**
   * Get an actor from the collection of concentrating actors.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   * @returns {Actor5e}                                             The stored actor with this uuid.
   */
  get(key) {
    key = this._convertKey(key);
    return this.collection.get(key) ?? null;
  }

  /**
   * Set an actor in the collection of concentrating actors.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   */
  set(key) {
    key = this._convertKey(key);
    const actor = fromUuidSync(key);
    if (!(actor instanceof CONFIG.Actor.documentClass)) return null;
    return this.collection.set(key, actor);
  }
}

Hooks.once("init", Module.init);
