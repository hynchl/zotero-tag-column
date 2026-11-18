# Zotero Tag Column

A small Zotero plugin that adds a **Tags** column to the item list, so you can see each item's tags without opening the item pane.

![Zotero](https://img.shields.io/badge/Zotero-7%E2%80%9310-red)

## Features

- Shows all tags of an item in one column, separated by commas
- Colored tags come first, in the order you assigned them; the rest are sorted alphabetically
- Hover over a cell to see the full tag list when it's truncated
- Column width, visibility, and sort direction persist across restarts
- Sortable like any other column

## Installation

1. Download `tag-column.xpi` from the [Releases](../../releases) page, or build it yourself (see below).
2. In Zotero, open **Tools → Plugins**.
3. Click the gear icon → **Install Plugin From File…** and select `tag-column.xpi`.
4. Right-click any column header in the item list and check **Tags**.

## Building

The plugin is just two files zipped together. From the repository root:

**PowerShell**
```powershell
Compress-Archive -Path manifest.json, bootstrap.js -DestinationPath tag-column.zip -Force
Rename-Item tag-column.zip tag-column.xpi
```

**macOS / Linux**
```bash
zip tag-column.xpi manifest.json bootstrap.js
```

## How it works

The plugin uses Zotero's `Zotero.ItemTreeManager.registerColumn` API (Zotero 7+) to register a custom column in the main item tree. The column's data provider reads `item.getTags()` and orders them using the library's tag colors from `Zotero.Tags.getColors`. The column is unregistered when the plugin is disabled or removed.

## Compatibility

Tested on Zotero 10.0.8 (Windows). Should work on Zotero 7 and later.

## License

MIT
