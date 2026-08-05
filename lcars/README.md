# Flecs Tour

An interactive, LCARS-styled (Star Trek panel) tour of the Flecs Entity
Component System: every part of the core and every addon, explained from
ELI5 analogies down to struct-member level detail, with diagrams.

## Viewing

Open `index.html` directly in a browser, or serve the directory:

```
python3 -m http.server 8787
```

then visit http://localhost:8787/.

## Using the tour

- Click decks in the left panel (or the "Go deeper" cards) to drill into the
  concept hierarchy.
- Arrow keys (or the bottom buttons) walk the entire tour in order.
- Press `/` to search all 170 pages by name; Enter jumps to the best match.
- Every page is deep-linkable via its URL hash, e.g. `#/qry-rematching`.

## Structure

- `index.html` — page shell, loads all data files
- `css/lcars.css` — the LCARS theme
- `js/app.js` — tree navigation, routing, search, and the diagram renderers
  (flow, stack, grid SVG diagrams generated from declarative specs)
- `js/data.js` — the content registry
- `data/*.js` — the content, one file per deck, registered as plain JS objects
- `CONTENT-GUIDE.md` — the authoring schema and tone rules for content files

## Adding or editing content

Follow `CONTENT-GUIDE.md`. Each page is one object with an id, parent,
tagline, intro, and a list of section blocks (text, code, struct tables,
diagrams). Add the object to the relevant `data/` file (or a new file wired
into `index.html`) and reload.
