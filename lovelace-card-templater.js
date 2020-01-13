const complexSettings = ['entities', 'state_filter'];
const entityCards = ['entities', 'glance'];

customElements.whenDefined('card-tools').then(() => {
    class CardTemplater extends cardTools.LitElement {
    
      setConfig(config) {
        if(!config || !config.card)
          throw new Error("Invalid configuration");
    
        this._config = config;
        this.refresh = true;
        
        if(config.entities){
          this.entities = this.processConfigEntities(config.entities);
        }
        else{
          this.entities = [];
        }
        
        this._cardConfig = this.getCardConfigWithoutTemplates(config.card);
        this.card = cardTools.createCard(this._cardConfig);
        
        import("https://cdnjs.cloudflare.com/ajax/libs/yamljs/0.3.0/yaml.js")
        .then((module) => {
            this.yaml = window.YAML;
        });
      }
       
      createRenderRoot() {
        return this;
      }

      render() {
        return cardTools.LitHtml`
          <div id="root">${this.card}</div>
        `;
      }

      processConfigEntities(entities) {
        if(!entities) return [];
        
        if (!Array.isArray(entities)) {
          throw new Error("Entities need to be an array");
        }
        
      return entities.map((entityConf, index) => {
        if (
              typeof entityConf === "object" &&
              !Array.isArray(entityConf) &&
              entityConf.type
            )
          {
              return entityConf;
          }
        if (typeof entityConf === "string") {
              entityConf = { entity: entityConf };
          } else if (typeof entityConf === "object" && !Array.isArray(entityConf)) {
              if (!entityConf.entity) {
                throw new Error(
                    `Entity object at position ${index} is missing entity field.`
                );
              }
          } else {
              throw new Error(`Invalid entity specified at position ${index}.`);
          }
        return entityConf;
        });
    }

    haveEntitiesChanged(){
        for(const entityConf of this.entities) {
          let oldState = this.oldStates[entityConf.entity];
          if(oldState == null) oldState = {"state":"undefined"};

          let newState = this._hass.states[entityConf.entity];
          if(newState == null) newState = {"state":"undefined"};

          if(newState != oldState) return true;
        }
        return false;
      }
	
	 getMockedState(stateObj, state, attributes){
  		var newStateObj = {};
  		Object.assign(newStateObj, stateObj);
  		newStateObj.attributes = {};
  		Object.assign(newStateObj.attributes, stateObj.attributes);
  		
  		if(state) {
  			newStateObj.state = state;
  		}
  		
  		if(attributes) {
  			Object.assign(newStateObj.attributes, attributes);
  		}
  		
  		return newStateObj;
  	}
  
     async applyStateTemplates() {
        if(this._mockHass) {
          for(const entityConf of this.entities) {
            if(entityConf.state_template || entityConf.attributes) {
              let stateObj = this._hass.states[entityConf.entity];
              if(stateObj) {
              	let state = entityConf.state_template ? await this.applyTemplate(entityConf.state_template) : null;
              	let attributes = entityConf.attributes ? await this.getCardConfig(entityConf.attributes) : null;
              	let mockState = this.getMockedState(stateObj, state, attributes);
                this._mockHass.states[entityConf.entity] = mockState;
              }
            }
          }
        }
     }

     set hass(hass) {
        this.oldStates = this._hass != null ? this._hass.states : {};

        this._hass = hass;
        let mockedStates = this._mockHass ? this._mockHass.states : [];
        
        this._mockHass = {};
        Object.assign(this._mockHass, hass);
        this._mockHass.states = JSON.parse(JSON.stringify(this._hass.states));
    	this._templateVariables = { 
    		user: {
    			name: this._hass.user.name, 
				is_admin: this._hass.user.is_admin,
				is_owner: this._hass.user.is_owner
			},
			page: {
				path: location.pathname				
			}
		};
		
        if(this.card)
        {
          
          if(this.haveEntitiesChanged())
          {
        	this.getCardConfig(this._config.card).then(config =>{
              if(config["type"] != this._cardConfig["type"]){
                // If card type has been changed by template, recreate it.
                this.applyStateTemplates().then(() => {
                  this._cardConfig = config;
                  this.card = cardTools.createCard(this._cardConfig);
                  setInterval(() => {
                  	if(this.card.state_templatable){
                  		this.card.hass = this._hass;
            	    	this.card.templated_hass = this._mockHass;
                  	}
                    else{
                    	this.card.hass = this._mockHass;
                    }
                    this.requestUpdate();
                  }, 100);
                }); 
              }
              else{
                this.applyStateTemplates().then(() => {
                  this._cardConfig = config;
                  this.card.setConfig(config);
                  if(this.card.state_templatable){
                  	this.card.hass = this._hass;
            	    this.card.templated_hass = this._mockHass;
                  }
                  else{
                    this.card.hass = this._mockHass;
                  }
                  this.requestUpdate();
                });
              }
            }
            );
          }
          else{
          	this._mockHass.states = mockedStates;
            if(this.card.state_templatable){
                this.card.hass = this._hass;
            	this.card.templated_hass = this._mockHass;
            }
            else{
                this.card.hass = this._mockHass;
            }
          }
        }
      }

      async applyTemplate(template){
        try{
        var result = await this._hass.callApi('post', 'template', { template: template, variables: this._templateVariables });
        return result;
        }
        catch(err){
          console.error("Error parsing template.");
          return "Error!";
        }
      }

      getCardConfigWithoutTemplates(rawConfig, topLevel = true){
        var cardConfig = rawConfig instanceof Array ? [] : {};

        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;
            
            if(key.endsWith("_template")){
                key = key.replace(/^(.*)_template$/,"$1");
                if(key == "entity"){
                  return null;
                }
                else if(complexSettings.includes(key)){
                  value = [];
                }
                else if(key == "type"){
                  value = "entities"; // Avoid issues if templating card type
                }
                else{
                  value = "-";
                }
            }
            if(typeof value === "object"){
              let isArray = (value instanceof Array);  
              value = this.getCardConfigWithoutTemplates(value, false);
              
              if(isArray){
                let new_value = [];

                for(const [item_index, item_value] of Object.entries(value)){
                  if(item_value["string"]) {
                    new_value[item_index] = item_value["string"]
                  }
                  else{
                    new_value[item_index] = item_value;
                  }
                }

                value = new_value;
              }
            }

            

            if(value != null){
              cardConfig[key] = value;
            }
          }
        
        if(topLevel && cardConfig.type && entityCards.includes(cardConfig.type) && !cardConfig.entities) cardConfig.entities = this.entities;
        
        return cardConfig;
    }

    async getCardConfig(rawConfig, topLevel = true){ 
        var cardConfig = rawConfig instanceof Array ? [] : {};
        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;

            if(key.endsWith("_template")){
                key = key.replace(/^(.*)_template$/,"$1");
                if(this._hass && value){
                    value = await this.applyTemplate(value);
                    if(value == 'None') value = null;
                    if(value != null && complexSettings.includes(key)){
                      value = (this.yaml) ? this.yaml.parse(value) : null;
                    }
                }
                
                if(!this._hass || !(value)){
                  if(key == "entity"){
                    return null;
                  }
                  else if(key == "type"){
                    value = "entities"; // Avoid issues if templating card type
                  }
                  else if(complexSettings.includes(key)){
                    value = [];
                  }
                  else{
                    value = "-";
                  }
                }
            }

            if(typeof value === "object"){
                
              let isArray = (value instanceof Array);  
              value = await this.getCardConfig(value, false);
              
              if(isArray){
                let new_value = [];

                for(const [item_index, item_value] of Object.entries(value)){
                  if(item_value["string"]) {
                    new_value[item_index] = item_value["string"]
                  }
                  else{
                    new_value[item_index] = item_value;
                  }
                }
                value = new_value;
              }
            }
            
            if(value != null){
              cardConfig[key] = value;
            }
          }
        
        if(topLevel && cardConfig.type && entityCards.includes(cardConfig.type) && !cardConfig.entities) cardConfig.entities = this.entities;
        
        return cardConfig;
      }
    }
    
    customElements.define('card-templater', CardTemplater);
    });
    
    window.setTimeout(() => {
      if(customElements.get('card-tools')) return;
      customElements.define('card-templater', class extends HTMLElement{
        setConfig() { throw new Error("Can't find card-tools. See https://github.com/thomasloven/lovelace-card-tools");}
      });
    }, 2000);