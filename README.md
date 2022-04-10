# Z's Concentration Notifier
This is a module for helping Dungeon Masters and players track concentration. It is not an automation module.

At its core, a short chat message will notify all active clients when an actor starts concentrating on a spell or loses concentration on a spell.
* An actor who is concentrating on something and takes damage will receive a message with two buttons; one for rolling a saving throw to maintain concentration and one button for convenience to remove the concentration effect.
* The message also details the spell and the DC for the saving throw.

An active effect is created on the actor when they start concentrating on a spell.
* The active effect is named after the spell, e.g., "Concentration - Bless".
* If you use DFred's Effects Panel, a description is included.
* If an actor who is already concentrating on a spell casts another (different) spell, the active effect will get swapped.
* A method `ConcentrationNotifier.applyConcentrationOnItem` can be used to apply concentration using non-spell items.

The module supplies new fields (found under Special Traits). These fields work with Active effects.
* `flags.dnd5e.concentrationBonus`: give an actor a bonus to Concentration (such as `@abilities.int.mod` or `1d6` - intended for Wizard Bladesingers).
* `flags.dnd5e.concentrationAbility`: change the ability that is used for the actor's concentration saves, e.g., use Wisdom instead of Constitution.
* `flags.dnd5e.concentrationReliable`: change concentration saves such that rolls on the d20s cannot go below 10.
* `flags.dnd5e.concentrationAdvantage`: set default of concentration saves to have Advantage. This does not skip the roll dialog unless hotkeys or other modules are involved.

The effect placed on an actor to denote concentration contains several flags by default, intended to make macros easier for persistently activated spells such as Call Lightning or Moonbeam:
* The level at which the spell was cast.
* The school of the spell (three-letter key).
* Its components (V, S, M, C), duration, and base level.
* An object with the details of the chat message that triggered the effect (can be used as is with `ChatMessage.create()`).

### Compatibility

#### Compatible:
* Minimal Rolling Enhancements.

#### Incompatible:
* Better Rolls for 5e.

#### Untested:
* Midi-QoL (most likely incompatible).
