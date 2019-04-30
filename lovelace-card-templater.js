customElements.whenDefined('card-tools').then(() => {
    class CardTemplater extends cardTools.LitElement {
    
      setConfig(config) {
        if(!config || !config.card || !config.entities)
          throw new Error("Invalid configuration");
    
        this._config = config;
        this.refresh = true;
        this._cardConfig = this.getCardConfigWithoutTemplates(config.card);
        this.card = cardTools.createCard(this._cardConfig);
        this.entities = config.entities;
      }
      
      createRenderRoot() {
        return this;
      }

      render() {
        return cardTools.LitHtml`
          <div id="root">${this.card}</div>
        `;
      }

      haveEntitiesChanged(){
        for(const entity of this.entities) {
          let oldState = this.oldStates[entity];
          if(oldState == null) oldState = {"state":"undefined"};

          let newState = this._hass.states[entity];
          if(newState == null) newState = {"state":"undefined"};

          if(newState != oldState) return true;
        }

        return false;
      }

      set hass(hass) {
        this.oldStates = this._hass != null ? this._hass.states : {};

        this._hass = hass;
        
        if(this.card)
        {
          
          if(this.haveEntitiesChanged())
          {
            this.getCardConfig(this._config.card, false).then(config =>{
              if(config["type"] != this._cardConfig["type"]){
                // If card type has been changed by template, recreate it.
                this._cardConfig = config;
                this.card = cardTools.createCard(this._cardConfig);
                setInterval(() => {
                  this.card.hass = this._hass;
                  this.requestUpdate();
                }, 100);
              }
              else{
                this._cardConfig = config;
                this.card.setConfig(config);
                this.card.hass = this._hass;
              }
            }
            );
          }
          else{
            this.card.hass = this._hass;
          }
        }
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

    async getCardConfig(rawConfig){ 
        var cardConfig = rawConfig instanceof Array ? [] : {};
        //let editorMode = await this.isEditorMode();

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
              value = await this.getCardConfig(value);
              
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