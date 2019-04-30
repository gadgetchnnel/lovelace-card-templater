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
