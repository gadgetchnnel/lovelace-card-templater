customElements.whenDefined('card-tools').then(() => {
    class CardTemplater extends cardTools.LitElement {
    
      setConfig(config) {
        if(!config || !config.card)
          throw new Error("Invalid configuration");
    
        this._config = config;
        this.refresh = true;
        this._cardConfig = this.getCardConfigWithoutTemplates(config.card);
        this.card = cardTools.createCard(this._cardConfig);
        if(config.entities){
          this.entities = this.processConfigEntities(config.entities);
        }
        else{
          this.entities = [];
        }
        this.extractedEntities = false;
        this.customComponentChecked = false;
        this.customComponentLoaded = false;
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

     async applyStateTemplates() {
        if(this._hass) {
          var entities = this.entities;
          for(const entityConf of entities) {
            if(entityConf.state)
            {
              let stateObj = this._hass.states[entityConf.entity];
              stateObj.state = entityConf.state;
              this._hass.states[entityConf.entity] = stateObj;
            }
            else if(entityConf.state_template) {
                let stateObj = this._hass.states[entityConf.entity];
                if(stateObj) {
                  stateObj.state = await this.applyTemplate(entityConf.state_template);
                  this._hass.states[entityConf.entity] = stateObj;
              }
            }
          }
        }
      }

     set hass(hass) {
        this.oldStates = this._hass != null ? this._hass.states : {};

        this._hass = hass;
          this.checkCustomComponent().then(loaded => {
            this.customComponentChecked = true;
            if(loaded && !this.extractedEntities){
              this.extractEntities(this._config.card).then(()=>{
                this.extractedEntities = true;
              });
            }

          if(this.card)
          {
          let changed = this.haveEntitiesChanged();
          if(changed || !this.extractedEntities)
          {
            console.log("Refreshing");
            this.getCardConfig(this._config.card).then(config =>{
              if("cardConfig" in config){
                var cardConfig = config["cardConfig"];
              }
              else{
                var cardConfig = config;
              }

              if(cardConfig["type"] != this._cardConfig["type"]){
                // If card type has been changed by template, recreate it.
                this.applyStateTemplates().then(() => {
                  this._cardConfig = cardConfig;
                  this.card = cardTools.createCard(this._cardConfig);
                  setInterval(() => {
                    this.card.hass = this._hass;
                    this.requestUpdate();
                  }, 100);
                }); 
              }
              else{
                this.applyStateTemplates(config).then(() => {
                  this._cardConfig = cardConfig;
                  this.card.setConfig(cardConfig);
                  this.card.hass = this._hass;
                });
              }
            }
            );
          }
          else{
            this.card.hass = this._hass;
          }
        }
          });      
      }

      async applyTemplate(template){
        try{
        var result = await this._hass.callApi('post', 'template', { template: template });
        return result;
        }
        catch(err){
          console.error("Error parsing template.");
          return "Error!";
        }
      }

      getCardConfigWithoutTemplates(rawConfig){
        var cardConfig = rawConfig instanceof Array ? [] : {};

        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;
            
            if(key.endsWith("_template")){
                key = key.replace(/^(.*)_template$/,"$1");
                if(key == "entity"){
                  return null;
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
              value = this.getCardConfigWithoutTemplates(value);
              
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
        return cardConfig;
    }

    async getCardConfigLocal(rawConfig){
      var cardConfig = rawConfig instanceof Array ? [] : {};
      for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;

            if(key.endsWith("_template")){
                key = key.replace(/^(.*)_template$/,"$1");
                if(this._hass && value){
                    value = await this.applyTemplate(value);
                    if(value == 'None') value = null;
                }
                
                if(!this._hass || !(value)){
                  if(key == "entity"){
                    return null;
                  }
                  else if(key == "type"){
                    value = "entities"; // Avoid issues if templating card type
                  }
                  else{
                    value = "-";
                  }
                }
            }

            if(typeof value === "object"){
                
              let isArray = (value instanceof Array);  
              value = await this.getCardConfigLocal(value);
              
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

          return cardConfig;
    }

    async checkCustomComponent(){
      if(this.customComponentChecked) return this.customComponentLoaded;
      try{
        var result = await this._hass.callApi('get', 'card_templater');
        this.customComponentLoaded = true;
      }
      catch(err){
      }

      return this.customComponentLoaded;
    }

    async extractEntities(rawConfig){ 
      try{
        var templateRequest = {cardConfig: rawConfig, entities: this.entities};
        var result = await this._hass.callApi('post', 'card_templater/extract_entities', templateRequest);
        if(result.entity_ids != "*" && result.entity_ids != []){
          if(!this.entities || this.entities.length == 0){
            this.entities = this.processConfigEntities(result.entity_ids);
          }
        }
        else if(result.entity_ids == "*" && (!this.entities || this.entities.length == 0)){
          console.error(result.error);
        }
        }
        catch(err){
          console.error("Error extracting entities.");
        }
    }

    async getCardConfig(rawConfig){ 
      if(this.customComponentLoaded){
        try{
          var templateRequest = {cardConfig: rawConfig, entities: this.entities};

          var result = await this._hass.callApi('post', 'card_templater/process_templates', templateRequest);
          return result;
          }
          catch(err){
            console.error("Error parsing template.");
            return "Error!";
          }
      }
      else{
        console.log("Custom component not loaded. Fallback to local processing.");
        return await this.getCardConfigLocal(rawConfig);
      }
    }
    
    // Walk the DOM to find element.
    async recursiveQuery(node, elementName) {
      if(node.nodeName == elementName) return node;
      
      if (node.shadowRoot) {
        let child = await this.recursiveQuery(node.shadowRoot, elementName);
        if (child) return child;
      }

      node = node.firstChild;
      while (node) {
        let child = await this.recursiveQuery(node, elementName);
        if (child) return child;
        node = node.nextSibling;
      }

      return null;
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
