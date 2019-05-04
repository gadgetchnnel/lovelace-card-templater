from homeassistant.components import http
import json
import logging
import homeassistant.helpers.template as template_helper
from homeassistant.const import MATCH_ALL

_LOGGER = logging.getLogger(__name__)

CARD_TEMPLATER_HTTP_ENDPOINT = '/api/card_templater'

class CardTemplaterView(http.HomeAssistantView):
    """Expose Card Template status check interface via HTTP POST."""

    url = CARD_TEMPLATER_HTTP_ENDPOINT
    name = 'api:card_templater'

    def __init__(self):
        """Initialize."""
    
    async def get(self, request):
        """Handle Card Templater status check requests
        """
        hass = request.app['hass']
        user = request[http.KEY_HASS_USER]
        
        return self.json({"status":"OK"})

class ProcessTemplatesView(http.HomeAssistantView):
    """Expose template process interface via HTTP POST."""

    url = CARD_TEMPLATER_HTTP_ENDPOINT + '/process_templates'
    name = 'api:card_templater:process_templates'

    def __init__(self):
        """Initialize."""
    
    def getValue(self, key, value, hass):
        if key.endswith("_template"):
            templ = template_helper.Template(value, hass)
            new_value = template_helper.render_complex(templ, None)
            if new_value == "None" or new_value == "null":
                if key == "type_template":
                    new_value = "entities"
                else:
                    new_value = "-"
            return new_value
        else:
            if type(value) is list or type(value) is dict:
                new_value = self.getConfig(value, hass)
                return new_value
            else:
                return value
    
    def isEmpty(self, item):
        if item is None:
            return True
        if item == "-":
            return True
        elif type(item) is dict and "entity" in item and self.isEmpty(item["entity"]):
            return True
        else:
            return False
    
    def getKey(self, key):
        if key.endswith("_template"):
            import re
            return re.sub(r"^(.*)_template$", r"\1", key)
        else:
            return key

    def getConfig(self, config, hass):
        if type(config) is list:
            new_list = [ self.getValue("item", v, hass) for v in config ]
            return [ item for item in new_list if not self.isEmpty(item) ]
        else:
            if "string_template" in config and len(config.keys()) == 1:
                # Special case for lists using "string_template"
                templ = template_helper.Template(config["string_template"], hass)
                return template_helper.render_complex(templ, None)
            else:
                new_dict = { self.getKey(k): self.getValue(k, v, hass) for (k, v) in config.items() }
                #return { k:v for (k, v) in new_dict.items() if not self.isEmpty(v) }
                return new_dict

    async def post(self, request):
        """Handle Card Templater template process requests.
        """
        hass = request.app['hass']
        user = request[http.KEY_HASS_USER]
        raw_config = await request.json()
        templated_config = self.getConfig(raw_config, hass)

        _LOGGER.debug("Received Card Templater: Config: %s", raw_config)
        _LOGGER.debug("Sending Card Templater response: %s", templated_config)

        return b'' if templated_config is None else self.json(templated_config)

class ExtractEntitiesView(http.HomeAssistantView):
    """Expose template extract entities interface via HTTP POST."""

    url = CARD_TEMPLATER_HTTP_ENDPOINT + '/extract_entities'
    name = 'api:card_templater:extract_entities'

    def __init__(self):
        """Initialize."""
    
    def flatten_dict(self, d):
        def items():
            for key, value in d.items():
                if isinstance(value, dict):
                    for subkey, subvalue in self.flatten_dict(value).items():
                        yield key + "." + subkey, subvalue
                elif isinstance(value, list):
                    for idx, val in enumerate(value):
                        if isinstance(val, dict):
                            for subkey, subvalue in self.flatten_dict(val).items():
                                yield key + "." + str(idx) + "." + subkey, subvalue
                else:
                    yield key, value
        return dict(items())

    def extractEntities(self, template_string, hass):
        templ = template_helper.Template(template_string, hass)
        return template_helper.extract_entities(templ, None)
    
    def getEntities(self, config, hass):
        templates = { property_name: template_helper.extract_entities(property_value, None)
                    for (property_name, property_value)
                    in self.flatten_dict(config).items() if property_name.endswith("_template") }
        
        entity_ids = set()
        invalid_templates = []

        for (template_name, template_entity_ids) in templates.items():
            if template_entity_ids == MATCH_ALL:
                entity_ids = MATCH_ALL
                # Cut off _template from name
                invalid_templates.append(template_name.replace('_template', ''))
            elif entity_ids != MATCH_ALL:
                entity_ids |= set(template_entity_ids)
        
        error = ""
        if invalid_templates:
            error = ('Templated config has no entity ids configured to track nor'
                     ' were we able to extract the entities to track from the %s '
                     'template(s). This entity will only be able to be updated '
                     'manually.' % ', '.join(invalid_templates))

        return { "entity_ids": entity_ids, "invalid_templates": invalid_templates, "error": error}

    async def post(self, request):
        """Handle Card Templater extract entities requests.
        """
        hass = request.app['hass']
        user = request[http.KEY_HASS_USER]
        raw_config = await request.json()
        entities = self.getEntities(raw_config, hass)

        _LOGGER.debug("Received Card Templater: Config: %s", raw_config)
        _LOGGER.debug("Sending Card Templater response: %s", entities)

        return b'' if entities is None else self.json(entities)

async def async_setup(hass, config):
    """Register Card Templater API endpoint
    """
    hass.http.register_view(CardTemplaterView())
    hass.http.register_view(ProcessTemplatesView())
    hass.http.register_view(ExtractEntitiesView())
    return True
