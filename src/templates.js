import { subscribeRenderTemplate } from "card-tools/src/templates";

class Template {
	
	constructor(template, variables, entity_ids, callback, connection){
		this.template = template;
		this.variables = variables;
		this.entity_ids = entity_ids;
		this.subscribed = false;
		this.callback = callback;
		this.connection = connection;
	}
	
	subscribe(){
 		try {
      			this._unsubRenderTemplate = subscribeRenderTemplate(this.connection, (result) => {
          			this.templateResult = result;
          			if(this.callback) this.callback();
          			
        		}, { template: this.template, entity_ids: this.entity_ids, variables: this.variables}, false);
        		
        		this.subscribed = true;
    		} catch (_err) {
      			this.templateResult = null;
      			console.log("Error", this.template, _err);
      			this._unsubRenderTemplate = undefined;
    		}
	  }
	  
	async unsubscribe() {
    	if (!this._unsubRenderTemplate) {
      		return;
    	}
		
    	try {
      		const unsub = await this._unsubRenderTemplate;
      		unsub();
      		this._unsubRenderTemplate = undefined;
    	} catch (err) {
      		if (err.code === "not_found") {
        		// If we get here, the connection was probably already closed. Ignore.
      		} else {
        		throw err;
      		}
    	}
    	
    	this.subscribed = false;
  	}
}

export class TemplateHandler {
	constructor(callback){
		this.templates = {};
		this.callback = callback;
	}
	
	registerTemplate(template, variables, entity_ids, callback, connection){
		let tpl = this.templates[template];
		if(!tpl){
        	tpl = new Template(template, variables, entity_ids, callback, connection);
        	this.templates[template] = tpl;
        }
        tpl.subscribe();
	}
	
	async subscribe(){
		for (const [key, value] of Object.entries(this.templates)) {
			if(!value.subscribed) value.subscribe();
  		}
	}
	
	async unsubscribe(){
		for (const [key, value] of Object.entries(this.templates)) {
  			if(value.subscribed) await value.unsubscribe();
  		}
	}
	
	getTemplateResult(template){
		let tpl = this.templates[template];
		return tpl && tpl.templateResult;
	}
}