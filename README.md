# Z's Concentration Notifier
This is a module for helping Dungeon Masters and players track concentration.
A short chat message will notify all active users when an actor starts concentrating on a spell or loses concentration on a spell.

* When an actor casts a spell that requires concentration, an Active Effect will be placed on them. The active effect is named after the spell, e.g., "Concentration - Bless". If you use DFred's Effects Panel, a description is included.
* If an actor who is already concentrating on a spell casts another (different) spell that requires concentration, the active effect will get swapped.
* If an actor who is concentrating on a spell takes damage, they will receive a whispered message from the DM (or the DM whispers to themselves in case of an NPC or if the character's owner is inactive).
  * The message details the spell and the saving throw, and supplies two buttons - one for rolling the saving throw and one for removing the effect. 
  * The module does no automation beyond applying effects and displaying buttons.
  * The button to remove the effect will only work for the effect that triggered it and conveniently does not require an actor to be selected.

The module supplies new fields (found under Special Traits):
* `flags.dnd5e.concentrationBonus` gives the actor a bonus to Concentration (good for Bladesinger wizards). The bonus applies only to concentration using the supplied chat message button. The field also supports dynamic roll data, such as the actor's wizard level or proficiency bonus.
* `flags.dnd5e.concentrationAbility` changes the ability that is used for the actor's concentration saves, e.g., to use Wisdom instead of Constitution.
* `flags.dnd5e.concentrationReliable` applies a roll minimum of 10 to saving throws to maintain concentration (good for Circle of Stars druid).

A method `ConcentrationNotifier.applyConcentrationOnItem(item)` can be used to apply concentration using non-spell items.
