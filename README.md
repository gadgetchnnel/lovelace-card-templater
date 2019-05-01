# lovelace-card-templater
Custom Lovelace card which allows Jinja2 templates to be applied to other cards

## Installation

### With custom_updater

    resources:
      - url: /customcards/github/gadgetchnnel/lovelace-card-templater.js?track=true
        type: js

### Manually

Download the lovelace-text-input-row.js and put it somewhere under *config folder*/www

    resources:
      - url: local/path/to/file/lovelace-card-templater.js?v=0.0.1
        type: js

## Options

| Name     | Type   | Optional/Required | Description                                        |
|----------|--------|-------------------|----------------------------------------------------|
| type     | string | Required          | custom:card-templater                              |
| card     | object | Required          | The card to display (see below about templating)   |
| entities | list   | Rquired           | Entities to watch for changes                      |

### Card templating

The **card** option will accept any card configration. Any option in the original card which takes a string value can be templated by changing the option name to be ***option name*\_template**. For example, **name** will become **name_template**. Here is an example:

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
    entities: device_tracker.my_phone

This will display an **entities** card showing two zones, with the display names including the distance between a device_tracker entity and the zone lke this:

![entities](https://user-images.githubusercontent.com/2099542/57008002-cac2f280-6be4-11e9-8f86-061f781c470f.PNG)

#### Templating lists

Some card options can be a list of strings (e.g. the **state_filter** option in the **entity-filter** card). These can still be templated, but need to be done in a different way:

state_filter:
  - 'state_one'
  - 'state_two'

state_filter:
  - string_template: {{ template which returns "state_one" }}
  - string_template: {{ template which returns "state_two" }}

### entities

This option is required in order that the template will only be processed when one of the referenced entities changes and is similar to the **entity** option for template sensors. I am investigating if this can be determined from the template but this is difficult to do client-side and so, for now, this option is required.

For complex templates you can create a time sensor like this:

  sensor:
    - platform: time_date
      display_options:
        - 'time'

and then use sensor.time under **entities**

