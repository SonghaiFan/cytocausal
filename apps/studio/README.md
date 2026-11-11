# cytocausal Studio

A browser-local causal graph editor built with the cytocausal library. Run `npm run dev:studio` from the repository root, then open port 3103.

## Author

- Double-click empty canvas (or use **Add variable**) and type. The name is typed into a yellow pill standing where the variable will be, ringed in blue because it is new. Enter creates it; Escape discards it; clicking away keeps a typed name and drops an empty one.
- Right-click or double-click a node to open the edit ring. A selected node has no button of its own; a hint at the foot of the canvas says what it answers to (**Hold** to explore, **Double-click** to add). The edit ring is four sectors around the node, which stays visible as the yellow hub. **Shift+F10** opens it for the selected node; each arrow key goes to the sector on that side, Tab cycles, Enter commits.
- **Add cause** is the left sector and creates `other → selected`; **Add effect** is the right sector and creates `selected → other`, so the ring reads `… → this → …`. The link being drawn is a solid blue arrow. Drag out of the sector and let go on a variable to connect it, or on empty canvas to name a new one there; or click the sector, then click the place. The blue arrow stays attached to the name while you type. Creation of the node and edge is one undo step. Existing directed relationships are selected instead of duplicated.
- **Rename** is the top sector, and types into the same pill, on top of the node. Enter or clicking away commits; Escape discards.
- A new or selected link offers **Unknown / + Positive / − Negative** controls. Unknown is the default.
- **Delete** is the bottom sector and turns red when pointed at. Deleting a node also removes incident links and affected correspondence entries, and can be undone.
- Undo/redo covers creation, deletion, labels, polarity, graph names and authored node movement. Use the buttons or **Cmd/Ctrl+Z**, **Cmd/Ctrl+Shift+Z**; typing fields retain native text undo. History holds 50 edits in memory and resets on reload.

- **Node style** applies to the whole graph. **Text in node** makes the name the node, on flowing links, for a diagram read whole (as Perspectiva draws it). **Text by dot** puts the name beside a dot, on straight links, for a dense network (as Explorer draws it). Switching restyles in place: nothing moves, and the ring and the pill you type into follow the style. It is a view preference kept in this browser, not part of the exported JSON.
- Right-click only ever opens a ring, so on empty canvas it adds nothing. Double-click is for editing: on a node it opens the edit ring, on empty canvas it names a new one.

- Holding a node means one thing in both modes: it opens the traversal fan, because choosing where to look is the same act whether or not the graph can be edited. Walking the fan moves the selection and edits nothing.

## Explore

Author and Explore share the same Cytoscape instance and selection state. Switching modes cancels provisional authoring, but retains camera, selected nodes/edge and authored positions. Explore keeps the library's radial traversal, search, evidence, contributor filtering, paths, cycles and version-difference panels. Node movement in Explore is temporary; returning to Author restores authored positions without moving the camera.

## Data and verification

Data is stored under `cytocausal-studio-v1` in this origin's localStorage. It is not uploaded or synced. Export JSON for backup; clearing browser storage or switching domains/devices does not preserve it. Invalid imports leave the current graph intact. Replacing/resetting a graph asks for confirmation and can be undone. Imported evidence and metadata are preserved.

Use `npm test -w @cytocausal/studio` and, after building, `npm run test:e2e -w @cytocausal/studio`. The browser suite covers creation direction, atomic undo, cancellation, inline editing, keyboard access, mode continuity, dragging, storage, export and mobile layout.

Vercel project root: `apps/studio`; include source files outside the root. `NEXT_PUBLIC_DOCS_URL` points to the library docs. No server secrets or database are required.

### Shared interaction language: the yellow causal sector

One shape carries both modes, the same one as the logo: **a yellow node with sectors around it.** Yellow is where you are; sectors are where you can go.

| | Explore | Author |
| :--- | :--- | :--- |
| Hub | The selected node, filled yellow | The same node, same yellow, never covered |
| Sectors | One toward each linked node: the links that exist | Four fixed ones: the cause, effect, name and deletion that could exist |
| Point at a sector | It turns ink and the link is previewed | It turns ink (red for Delete) |
| Click | The focus moves to that node | The edit begins |

The gestures are the same in both: click selects; hold opens the traversal fan; Escape dismisses a ring and keeps the selection. Right-click and **Shift+F10** open the mode's own ring: the edit ring in Author (double-click too), the links in Explore. Opening the ring pans the canvas just enough to show it, so it never leaves its node.

A ring around a node only ever means directions. How far the highlight reaches is a setting, not a direction, so Explore sets it with **Steps shown** in the sidebar rather than a ring around the node. With **Text by dot**, both rings go around the dot and its name, so neither covers the label.

Each colour and line style keeps one meaning across modes:

- **Yellow** fills the current selection, and nothing else. It is never a border.
- **Ink** is what the pointer aims at. Neutral grey is what is available.
- **Blue** is being added: the provisional link while authoring, added elements in a version comparison.
- **Red** is being removed: the Delete sector and buttons, removed elements in a version comparison.
- **Dashes** mean negative polarity only, so a link in progress is solid. Arrows always run from cause to effect.
