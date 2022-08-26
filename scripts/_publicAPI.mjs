export class API {
    
    // determine if you are concentrating at all.
	static isActorConcentrating(caster){
		const actor = caster.actor ?? caster;
		const effect = actor.effects.find(eff => {
            return API.isEffectConcentration(eff);
        });
		return !!effect ? effect : false;
	}

    // determine if you are concentrating on a specific item.
	static isActorConcentratingOnItem(caster, item){
		const actor = caster.actor ?? caster;
		const effect = actor.effects.find(eff => {
			const itemUuid = eff.getFlag("concentrationnotifier", "castingData.itemUuid");
			return itemUuid === item.uuid;
		});
		return !!effect ? effect : false;
	}
	
	// determine if effect is concentration effect.
	static isEffectConcentration(effect){
		return effect.getFlag("core", "statusId") === "concentration";
	}
	
	// end all concentration effects on an actor.
	static async breakConcentration(caster){
		const actor = caster.actor ?? caster;
		const deleteIds = actor.effects.filter(eff => {
            return API.isEffectConcentration(eff);
        }).map(i => i.id);
        return actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds);
	}
	
	// wait for concentration on item to be applied on actor.
	static async waitForConcentrationStart(caster, {item, max_wait = 10000} = {}){
		const actor = caster.actor ?? caster;

		async function wait(ms){
			return new Promise(resolve => {
				setTimeout(resolve, ms);
			});
		}
		
		let conc = !!item ? API.isActorConcentratingOnItem(actor, item) : API.isActorConcentrating(actor);
		let waited = 0;
		while( !conc && waited < max_wait ){
			await wait(100);
			waited = waited + 100;
			conc = !!item ? API.isActorConcentratingOnItem(actor, item) : API.isActorConcentrating(actor);
		}
		if( !!conc ) return conc;
		return false;
	}
}
