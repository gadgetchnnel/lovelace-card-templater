# lovelace-card-templater
Custom Lovelace card which allows Jinja2 templates to be applied to other cards

## Installation

This requires [card-tools](https://github.com/thomasloven/lovelace-card-tools) to be installed, check the link for details on installing this if you don't have it installed.

This card can either be installed using [HACS](https://github.com/custom-components/hacs) or manually.

### With HACS
Search for "Lovelace Card Templater" in the store and follow the instructions

### Manually

Download the lovelace-text-input-row.js and put it somewhere under *config folder*/www

    resources:
      - url: local/path/to/file/lovelace-card-templater.js?v=0.0.2
        type: js

## Options

| Name     | Type   | Optional/Required | Description                                                                           |
|----------|--------|-------------------|---------------------------------------------------------------------------------------|
| type     | string | Required          | custom:card-templater                                                                 |
| card     | object | Required          | The card to display (see below about templating)                                      |
| entities | list   | Required          | Entities to watch for changes (can also be used to template entity states, see below) |

### Card templating

The **card** option will accept any card configration. Any option in the original card which takes a string value can be templated by changing the option name to be ***option\_name*\_template**. For example, **name** will become **name_template**. Here is an example:

    type: 'custom:card-templater'
    card:
      type: entities
      show_header_toggle: false
      columns: 2
      title: Places
      entities:
        - entity: zone.home
          name_template: >-
            {{ state_attr("zone.home","friendly_name") }} - {{
            (distance(states.device_tracker.my_phone, states.zone.home) *
            0.621371) | round(1) }} miles.
        - entity: zone.work
          name_template: >-
            {{ state_attr("zone.work","friendly_name") }} - {{
            (distance(states.device_tracker.my_phone, states.zone.work) *
            0.621371) | round(1) }} miles.
    entities:
      - device_tracker.my_phone

This will display an **entities** card showing two zones, with the display names including the distance between a device_tracker entity and the zone lke this:

![entities](https://user-images.githubusercontent.com/2099542/57008002-cac2f280-6be4-11e9-8f86-061f781c470f.PNG)

#### Templating lists

Some card options can be a list of strings (e.g. the **state_filter** option in the **entity-filter** card). These can still be templated, but need to be done in a different way, by replacing each string with ```string_template: {{ template }}``` as below:

    state_filter:
      - 'state_one'
      - 'state_two'

could become

    state_filter:
      - string_template: {{ "state_" + "one" }}
      - string_template: {{ "state_" + "two" }}

#### Templating lists, alternative experimental method (since version 0.0.3)

Version 0.0.3 introduced another way of templating list-based properties. These can now be templated via a template which returns valid YAML or JSON, such as this:

    type: 'custom:card-templater'
    card:
      type: entities
      title: Who's at Home
      entities_template: >-
        {{ states.device_tracker | selectattr("state", "equalto",
        "home") | map(attribute="entity_id") | list | tojson }}
    entities:
      - sensor.time

#### Notes:

It is technically possible to template the card type of the templated_card, e.g. something like this:

    type_template: '{{ "entities" if is_state("input_boolean.show_full", "on").state else "glance" }}

However, this has only been tested with the **entities** and **glance** cards and may not work reliably with other card types.

### entities

This option is required in order that the template will only be processed when one of the referenced entities changes and is similar to the **entity** option for template sensors. I am investigating if this can be determined from the template but this is difficult to do client-side and so, for now, this option is required.

For complex templates you can create a time sensor like this:

    sensor:
      - platform: time_date
        display_options:
          - 'time'

and then use sensor.time under **entities**

You can also use this to template the state for an entity, so the entity displays other than its actual state. For example:

    type: 'custom:card-templater'
    card:
      type: entities
      show_header_toggle: false
      columns: 2
      title: Places
      entities:
        - entity: zone.home
          name_template: >-
            {{ (distance(states.device_tracker.my_phone, states.zone.home) * 0.621371) | round(1) }} miles away.
        - entity: zone.work
          name_template: >-
            {{(distance(states.device_tracker.my_phone, states.zone.work) * 0.621371) | round(1) }} miles away.
    entities: 
      - device_tracker.my_phone
      - entity: zone.home
        state_template: '{{ state_attr("zone.home","friendly_name") }}'
      - entity: zone.work
        state_template: '{{ state_attr("zone.work","friendly_name") }}'
    entity: zone.work

will display the states of the zones as their friendly names instead of the actual state of ("zoning") as below:

![StateTemplate](https://user-images.githubusercontent.com/2099542/57028392-e656e900-6c36-11e9-8094-96ff122bb54d.png)

Attributes of entities can also be templated like this:

    type: 'custom:card-templater'
    card:
      ...
    entities:
      - entity: sensor.my_sensor
         state_template: >
           {{ "One" if states.sensor.my_sensor.state == "1" else "Not One" }}
         attributes:
           unit_of_measurement_template: >
             {{ states.sensor.my_sensor_uom.state }}
             
This can be done with or without the **state_template** being defined, so you can do this:

type: 'custom:card-templater'
    card:
      ...
    entities:
      - entity: sensor.my_sensor
         attributes:
           unit_of_measurement_template: >
             {{ states.sensor.my_sensor_uom.state }}
             
### Variables (intorudced in 0.0.6)

0.0.6 added several variables, which are passed to the templating engine so you can use them in the templates

* user.name - the name of the current user
* user.is_admin - whether the current user is an admin
* user.is_owner - whether the current user is the owner
* page.path - the path name of the current page (e.g. /lovelace/home)

#### Example

    type: 'custom:card-templater'
        card:
          type: markdown
          content_template >
            ## Hello {{ user.name }}
            This card is on the page {{ page.path }}
        entities:
          - entity: sensor.time
