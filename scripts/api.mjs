import { CN } from "./concentration-notifier.mjs";

export class api {
	
	static register(){
		api.globals();
	}
	
	static globals(){
		globalThis.ConcentrationNotifier = {
			applyConcentrationOnItem: CN.applyConcentrationOnItem,
			triggerSavingThrow: CN.triggerSavingThrow,
			concentratingOn: CN.concentratingOn,
			concentratingAny: CN.concentratingAny,
			concentrationEffect: CN.concentrationEffect,
			endConcentration: CN.concentrationEnd
		};
	}
}