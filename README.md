# Concentration Notifier
This is a module for `dnd5e` helping Dungeon Masters and players track concentration. It is not an automation module.

At its core, a short chat message will notify all active clients when an actor starts concentrating on a spell or loses concentration on a spell.
* An actor who is concentrating on something and takes damage will receive a message with two buttons; one for rolling a saving throw to maintain concentration and one button for convenience to remove the concentration effect.
* The message also details the spell and the DC for the saving throw.

An active effect is created on the actor when they start concentrating on a spell.
* The active effect is named after the spell, e.g., "Concentration - Bless" (the label can be toggled to only show the item's name).
* If an actor who is already concentrating on a spell casts another (different) spell, or the same spell at a different level, the active effect will get swapped.
* A method `ConcentrationNotifier.beginConcentration` can be used to apply concentration using non-spell items.
* A method `ConcentrationNotifier.requestSavingThrow` can be used to ask for saving throws despite not taking damage.

The module supplies new fields (found under Special Traits). These fields work with Active effects.
* `flags.dnd5e.concentrationAbility`: change the ability that is used for the actor's concentration saves, e.g., use Wisdom instead of Constitution.
* `flags.dnd5e.concentrationAdvantage`: set default of concentration saves to have Advantage. This does not skip the roll dialog unless hotkeys or other modules are involved.
* `flags.dnd5e.concentrationBonus`: give an actor a bonus to Concentration (such as `@abilities.int.mod` or `1d6` - intended for Wizard Bladesingers).
* `flags.dnd5e.concentrationReliable`: change concentration saves such that rolls on the d20s cannot go below 10.
* `flags.dnd5e.concentrationFloor`: change concentration saves such that rolls on the d20s cannot go below this value.
* `flags.dnd5e.concentrationCeiling`: change concentration saves such that rolls on the d20s cannot go above this value.

The effect placed on an actor to denote concentration contains several flags by default, intended to make macros easier for persistently activated spells such as Call Lightning or Moonbeam:
* `actorData`, with the caster's id and uuid.
* `itemData`, with all the details of the item being concentrated on.
* `castingData`, with the item's id, uuid, and base level.
* `messageData`, with all the details of the message created in the use of the item.
