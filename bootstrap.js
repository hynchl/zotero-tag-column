/* Tag Column — adds a "Tags" column to the Zotero item tree. */

var PLUGIN_ID = "tag-column@local.plugin";
var registeredKey = null;

function log(msg) {
  Zotero.debug("[Tag Column] " + msg);
}

// Colored tags first (in their assigned order), then the rest alphabetically.
function getTagText(item) {
  // Notes and attachments under a parent have their own tags too; show them as-is.
  let tags = item.getTags().map((t) => t.tag);
  if (!tags.length) return "";

  let colored = [];
  try {
    let colorMap = Zotero.Tags.getColors(item.libraryID); // Map<name, {color, position}>
    colored = tags
      .filter((t) => colorMap.has(t))
      .sort((a, b) => colorMap.get(a).position - colorMap.get(b).position);
  } catch (e) {
    log("Could not read tag colors: " + e);
  }
  let coloredSet = new Set(colored);
  let rest = tags
    .filter((t) => !coloredSet.has(t))
    .sort((a, b) => Zotero.localeCompare(a, b));

  return colored.concat(rest).join(", ");
}

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
    dataProvider: (item, dataKey) => getTagText(item),
    renderCell: (index, data, column, isFirstColumn, doc) => {
      const cell = doc.createElement("span");
      cell.className = `cell ${column.className}`;
      cell.textContent = data;
      cell.title = data;
      return cell;
    },
  });

  log("Registered column: " + registeredKey);
}

function shutdown({ id, version, rootURI }, reason) {
  if (registeredKey) {
    Zotero.ItemTreeManager.unregisterColumn(registeredKey);
    registeredKey = null;
  }
}

function onMainWindowLoad({ window }) {}
function onMainWindowUnload({ window }) {}
