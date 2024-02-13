Interested in following along with development of any of my modules? Join the [Discord server](https://discord.gg/QAG8eWABGT).

# Concentration Notifier

This is a module for `dnd5e` helping Dungeon Masters and players track concentration.
At its core, a chat message will notify all active clients when an actor starts concentrating on an item or loses concentration on an item.

* An active effect is created on the actor when they use an item that has the `Concentration` component (for spells), and for other items a field has been supplied next to the `Duration` for non-spell items that should require concentration.
* An actor who is concentrating on something and takes damage will receive a message with two buttons; one for rolling a saving throw to maintain concentration, and one button for convenience to remove the concentration effect (the deletion button will prompt the user; the prompt can be skipped by holding Shift).
* The message also has a link to the item and shows the DC for the saving throw (standard calculation of half the damage taken, rounded down, to a minimum of 10).
* The active effect used to track concentration is named after the item, e.g., 'Bless' or 'Concentration - Bless'. The format can be toggled in the settings.
* If an actor who is already concentrating on an item uses a different item that requires concentration (or the same item but at a different level for spells), the active effect will get swapped. The effects otherwise have a duration equal to the item's duration, as set in the details of the item.

Additionally, when a scroll is made from a spell that requires concentration, that will also be tagged as requiring concentration.

## Character Flags

** NOTE: The module known as 'Dynamic Active Effects Using Active Effects' (or DAE for short) is known to break this simple behaviour due to DAE's very poor implementation. It is strongly advised to remove DAE. **

The module supplies new fields (found under Special Traits). These fields work with Active Effects.
* `flags.dnd5e.concentrationAbility`: Change the ability that is used for the actor's concentration saves. For example, use Wisdom instead of Constitution by putting `wis` in this field.
* `flags.dnd5e.concentrationAdvantage`: Set the default of concentration saves to be rolled with advantage.
* `flags.dnd5e.concentrationBonus`: Give an actor a bonus to Concentration saves, such as `@abilities.int.mod` or `1d6`. Good for  Wizard Bladesingers. This field respects roll data.
* `flags.dnd5e.concentrationReliable`: Change concentration saves such that rolls on the d20s cannot go below 10.
* `flags.dnd5e.concentrationUnfocused`: Prevent an actor from starting concentration. If the 'Ability Use Warnings' setting is enabled, the actor will also be given a warning in the AbilityUseDialog that their item cannot be concentrated on.

## Helper Functions

The Actor document is supplied with the new function `Actor#rollConcentrationSave`, which accepts the usual arguments (same as `rollAbilitySave`) but makes use of the above flags automatically.

Additionally, these functions are found in the global namespace `CN` (here `caster` refers to a token placeable, token document, or an actor document):
* `CN.isActorConcentrating(caster)`: returns the effect if the actor is concentrating on any item, otherwise `false`.
* `CN.isActorConcentratingOnItem(caster, item)`: returns the effect if the actor is concentrating on the given item, otherwise `false`.
* `CN.isEffectConcentration(effect)`: returns `true` or `false` if the effect is a concentration effect.
* `CN.breakConcentration(caster, {message=true}={})`: ends all concentration effects on the actor. Returns the array of deleted effects. Set `message` to false to suppress notifications.
* `CN.waitForConcentrationStart(caster, {item, max_wait=10000}={})`: will wait for the actor to receive any concentration effect (or specific to the item, if provided). Useful for halting scripts in edge cases. The optional integer denotes the maximum number of ms to wait for. Returns the effect if one exists, otherwise `false`.
* `CN.redisplayCard(caster)`: displays the chat card of the item being concentrated on, at the level it was cast.
* `CN.extendModule(status, require)`: (detailed below.)

## Effect Flags

The effect placed on an actor to denote concentration contains some useful data, intended to make script writing easier for persistently active spells such as <em>call lightning</em> or <em>moonbeam</em>:
* `flags.concentrationnotifier.data.itemData`, with all the details of the item being concentrated on.
* `flags.concentrationnotifier.data.castData`, with the item's base level, the level at which it was cast, and its uuid.

Using a macro to set the flag `unbreakable` within `castData` to `true` will prevent automatically prompting the caster for saving throws to maintain concentration when they take damage. Useful in rare instances where a feature lets you have unbreakable concentration on a particular spell.

## Extending the Module
If you want to support other 'groupings' of concentration, this is quite simple to do. For example, if you want to support concentration on Hex for the Witch class from Valda's Spire of Secrets, which are tracked separately from spells, you would run this script in a module or world script.
```js
Hooks.once("setup", () => CN.extendModule("hex-concentration", function itemRequiresConcentration(item) {
  return item.type === "feat"
    && item.system.type.value === "class"
    && item.system.type.subtype === "witchHex"
    && item.requiresConcentration;
}));
```
This assumes the existence of 'witchHex' added as a custom class feature type.

The `extendModule` function takes the new status (a string, which must be different from 'concentration' or 'concentrating') and a synchronous function that is run to determine whether an item being used is requiring this type of concentration. In the above example, a hex requires concentration if it has a duration, is set by this module to require concentration, and is a class feature with the 'witchHex' subtype.

Here is another example, which causes the module to track concentration separately for all spells that are cast at 9th level or higher.
```js
Hooks.once("setup", () => CN.extendModule("nine-concentration", function itemRequiresConcentration(item) {
  return (item.type === "spell") && (item.system.level >= 9) && item.requiresConcentration;
}));
```

# Migration
If you are using this module in version 3.0.0 or later of the dnd5e system and have previously made use of the checkbox this module implemented to allow for concentration on items that are not spells, be aware this module no longer has this capability, as most items are now able to be tagged as having 'concentration' with no effort needed from Concentration Notifier.

You will need to find these items yourself and tag them appropriately.
