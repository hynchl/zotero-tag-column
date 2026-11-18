/* Tag Column — adds a "Tags" column to the Zotero item tree.
 * Clicking a cell in the column opens a menu to add or remove tags. */

var PLUGIN_ID = "tag-column@local.plugin";
var CELL_CLASS = "tag-column-cell";
var POPUP_ID = "tag-column-popup";

var registeredKey = null;
var windowHandlers = new Map(); // window -> { click, dblclick }

function log(msg) {
  Zotero.debug("[Tag Column] " + msg);
}

function getColorMap(libraryID) {
  try {
    return Zotero.Tags.getColors(libraryID); // Map<name, {color, position}>
  } catch (e) {
    log("Could not read tag colors: " + e);
    return new Map();
  }
}

// Colored tags first (in their assigned order), then the rest alphabetically.
function getSortedTags(item) {
  let tags = item.getTags().map((t) => t.tag);
  if (!tags.length) return [];

  let colorMap = getColorMap(item.libraryID);
  let colored = tags
    .filter((t) => colorMap.has(t))
    .sort((a, b) => colorMap.get(a).position - colorMap.get(b).position);
  let coloredSet = new Set(colored);
  let rest = tags
    .filter((t) => !coloredSet.has(t))
    .sort((a, b) => Zotero.localeCompare(a, b));
  return colored.concat(rest);
}

// ---------------------------------------------------------------------------
// Tag editing menu
// ---------------------------------------------------------------------------

function findTagCell(win, event) {
  // The row is re-rendered when the selection changes on mousedown, so the
  // click target can be stale. Look up whatever is under the pointer now.
  let el = win.document.elementFromPoint(event.clientX, event.clientY);
  return el && el.closest ? el.closest("." + CELL_CLASS) : null;
}

function getItemForCell(win, cell) {
  let index = parseInt(cell.dataset.index, 10);
  let itemsView = win.ZoteroPane && win.ZoteroPane.itemsView;
  if (!itemsView || isNaN(index)) return null;
  let row = itemsView.getRow(index);
  let item = row && row.ref;
  return item instanceof Zotero.Item ? item : null;
}

async function applyTagChange(item, fn) {
  try {
    fn(item);
    await item.saveTx();
  } catch (e) {
    Zotero.logError(e);
  }
}

function promptForTags(win, item) {
  let input = { value: "" };
  let ok = Services.prompt.prompt(
    win,
    "Add Tags",
    `Add tags to "${item.getDisplayTitle()}".\nSeparate multiple tags with commas.`,
    input,
    null,
    {}
  );
  if (!ok) return;
  let names = input.value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.length) return;
  applyTagChange(item, (it) => names.forEach((n) => it.addTag(n)));
}

function openTagMenu(win, item, event) {
  let doc = win.document;
  doc.getElementById(POPUP_ID)?.remove();

  let popup = doc.createXULElement("menupopup");
  popup.id = POPUP_ID;
  popup.addEventListener("popuphidden", (e) => {
    if (e.target === popup) popup.remove();
  });

  let addItem = (label, opts = {}) => {
    let mi = doc.createXULElement("menuitem");
    mi.setAttribute("label", label);
    if (opts.checkbox) {
      mi.setAttribute("type", "checkbox");
      if (opts.checked) mi.setAttribute("checked", "true");
    }
    if (opts.disabled) mi.setAttribute("disabled", "true");
    if (opts.onCommand) mi.addEventListener("command", opts.onCommand);
    popup.append(mi);
    return mi;
  };
  let addSeparator = () => popup.append(doc.createXULElement("menuseparator"));

  let editable = item.isEditable();
  let tags = getSortedTags(item);

  if (!editable) {
    addItem("This library is read-only", { disabled: true });
    if (tags.length) addSeparator();
  }

  // Current tags: uncheck to remove.
  for (let tag of tags) {
    addItem(tag, {
      checkbox: true,
      checked: true,
      disabled: !editable,
      onCommand: () => applyTagChange(item, (it) => it.removeTag(tag)),
    });
  }

  if (editable) {
    // Colored tags not yet on the item: check to add.
    let current = new Set(tags);
    let colorMap = getColorMap(item.libraryID);
    let missingColored = [...colorMap.entries()]
      .filter(([name]) => !current.has(name))
      .sort((a, b) => a[1].position - b[1].position)
      .map(([name]) => name);

    if (missingColored.length) {
      if (tags.length) addSeparator();
      for (let tag of missingColored) {
        addItem(tag, {
          checkbox: true,
          checked: false,
          onCommand: () => applyTagChange(item, (it) => it.addTag(tag)),
        });
      }
    }

    if (tags.length || missingColored.length) addSeparator();
    addItem("Add Tag…", { onCommand: () => promptForTags(win, item) });
  }

  (doc.getElementById("mainPopupSet") || doc.documentElement).append(popup);
  popup.openPopupAtScreen(event.screenX, event.screenY, true);
}

// ---------------------------------------------------------------------------
// Window hookup
// ---------------------------------------------------------------------------

function addToWindow(win) {
  if (!win || windowHandlers.has(win) || !win.ZoteroPane) return;

  let click = (event) => {
    if (event.button !== 0 || event.detail !== 1) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    let cell = findTagCell(win, event);
    if (!cell) return;
    let item = getItemForCell(win, cell);
    if (!item) return;
    openTagMenu(win, item, event);
  };

  // Don't let a double-click on the Tags cell open the attachment.
  let dblclick = (event) => {
    if (findTagCell(win, event)) {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  win.addEventListener("click", click, true);
  win.addEventListener("dblclick", dblclick, true);
  windowHandlers.set(win, { click, dblclick });
}

function removeFromWindow(win) {
  let handlers = windowHandlers.get(win);
  if (!handlers) return;
  win.removeEventListener("click", handlers.click, true);
  win.removeEventListener("dblclick", handlers.dblclick, true);
  win.document.getElementById(POPUP_ID)?.remove();
  windowHandlers.delete(win);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;

  registeredKey = Zotero.ItemTreeManager.registerColumn({
    dataKey: "tags",
    label: "Tags",
    pluginID: PLUGIN_ID,
    enabledTreeIDs: ["main"],
    flex: 1,
    zoteroPersist: ["width", "hidden", "sortDirection"],
    dataProvider: (item, dataKey) => getSortedTags(item).join(", "),
    renderCell: (index, data, column, isFirstColumn, doc) => {
      const cell = doc.createElement("span");
      cell.className = `cell ${column.className} ${CELL_CLASS}`;
      cell.dataset.index = index;
      cell.textContent = data;
      cell.title = data ? data + "\n\nClick to edit tags" : "Click to add tags";
      cell.style.cursor = "pointer";
      return cell;
    },
  });

  for (let win of Zotero.getMainWindows()) {
    addToWindow(win);
  }

  log("Registered column: " + registeredKey);
}

function shutdown({ id, version, rootURI }, reason) {
  for (let win of [...windowHandlers.keys()]) {
    removeFromWindow(win);
  }
  if (registeredKey) {
    Zotero.ItemTreeManager.unregisterColumn(registeredKey);
    registeredKey = null;
  }
}

function onMainWindowLoad({ window }) {
  addToWindow(window);
}

function onMainWindowUnload({ window }) {
  removeFromWindow(window);
}
