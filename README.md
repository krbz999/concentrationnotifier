# Concentration Notifier
This is a module for `dnd5e` helping Dungeon Masters and players track concentration. It is not an automation module.
At its core, a short chat message will notify all active clients when an actor starts concentrating on an item or loses concentration on an item.

* An active effect is created on the actor when they use an item that has the Concentration component.
* An actor who is concentrating on something and takes damage will receive a message with two buttons; one for rolling a saving throw to maintain concentration and one button for convenience to remove the concentration effect.
* The message also mentions the item, its details, and the DC for the saving throw (standard calculation of half the damage taken, rounded down, to a minimum of 10).
* The active effect used to track concentration is named after the item, e.g., 'Bless' or 'Concentration - Bless' (format toggleable in the settings).
* If an actor who is already concentrating on an item uses a different item that requires concentration, or the same item at a different level, the active effect will get swapped.

### Character Flags
The module supplies new fields (found under Special Traits). These fields work with Active Effects.
* `flags.dnd5e.concentrationAbility`: change the ability that is used for the actor's concentration saves, e.g., use Wisdom instead of Constitution.
* `flags.dnd5e.concentrationAdvantage`: set default of concentration saves to have Advantage. This does not skip the roll dialog unless hotkeys or other modules are involved.
* `flags.dnd5e.concentrationBonus`: give an actor a bonus to Concentration (such as `@abilities.int.mod` or `1d6` - intended for Wizard Bladesingers).
* `flags.dnd5e.concentrationReliable`: change concentration saves such that rolls on the d20s cannot go below 10.
* `flags.dnd5e.concentrationFloor`: change concentration saves such that rolls on the d20s cannot go below this value.
* `flags.dnd5e.concentrationCeiling`: change concentration saves such that rolls on the d20s cannot go above this value.

### Helper Functions
The Actor document is supplied with the new function `Actor#rollConcentrationSave`, which accepts the usual arguments (same as `rollAbilitySave`) but makes use of the above flags automatically.

These functions are found in `ConcentrationNotifier`:
* `.beginConcentration` (takes an item and optionally the level the item was cast at) forces the parent actor of the item to begin concentration on it.
* `.breakConcentration` (takes a token placeable, token document, or actor) ends all concentration effects on the caster.
* `.breakConcentrationForItem` (takes an item) ends concentration on this item only (if the effect exists).
* `.isActorConcentrating` (takes a token placeable, token document, or an actor) returns true or false if the actor is concentrating on any item.
* `.isActorConcentratingOnItem` (takes a token placeable, token document, or an actor, and an item) returns true or false if the actor is concentrating on the given item.
* `.promptConcentrationSave` (takes a token placeable, token document, or an actor, a number (the DC of the saving throw) and an object of options) prompts the actor to roll a saving throw, displaying the usual chat card. The options object can contain `cardContent` (a string) which is the message that will accompany the chat card.
* `.isEffectConcentration` (takes an active effect) returns true or false if the effect is a concentration effect.
* `.waitForConcentrationStart` (takes a token placeable, token document, or an actor, optionally an item, and optionally an integer) will wait for the actor to receive any concentration effect (or specific to the item, if provided). Useful for halting scripts in edge cases. The optional integer denotes the maximum number of ms to wait for.

The effect placed on an actor to denote concentration contains several flags by default, intended to make macros easier for persistently activated spells such as Call Lightning or Moonbeam:
* `actorData`, with the caster's id and uuid.
* `itemData`, with all the details of the item being concentrated on.
* `castingData`, with the item's id, uuid, and base level.
* `messageData`, with all the details of the message created in the use of the item.
