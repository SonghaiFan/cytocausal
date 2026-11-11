# Historical rendering notes

Audience: maintainers investigating earlier rendering and interaction decisions.

These excerpts were moved out of the user guides during the documentation audience review. They are historical descriptions, not current requirements or newly verified benchmark results. The original measurement date, browser version and full benchmark procedure were not recorded here; reproduce measurements before using them for a performance claim. Current source and tests take precedence.

## Source: theming.md

### One meaning per channel

Some visual channels are read faster and more accurately than others: position first, then length and width, then lightness, then hue, then outline style, glyphs and text. The most important information takes the most effective channel, and no channel carries two meanings, so nothing on the graph has to be decoded twice.

| Importance | Information | Channel |
| :--- | :--- | :--- |
| 1 | Causal structure and direction | Position, from the layout, and arrowheads |
| 2 | What the reader is looking at | Contrast: everything else fades. The chosen nodes, alone or on a chosen loop, path or link, are filled with the accent, the only hue at rest. Their links keep full contrast in ink |
| 3 | What changed between versions, while shown | Contrast again: what stayed the same fades. Added parts are blue and removed ones vermilion. Changed ones keep full contrast |
| 4 | Quantities: how many stated a link, how central a node is | Line width and node size, and nothing else. Highlights never change a width |
| 5 | Polarity | Line style, solid or dashed, with a `+` or `−` sign. Nothing else is dashed |
| 6 | Loop type, flipped polarity | Glyphs: `R` or `B`, and `±` |
| 7 | An app's own categories, such as Perspectiva's annotations | A node's outline style, and a glyph on a link. The framework leaves outlines free for this |

The accent is only ever a fill. Chosen loops used to have links in a darker yellow, which looked like the vermilion of a removed link. And a selection is drawn after the changes, so a chosen loop shows as one loop even where its links changed. Tests check both.

The keyboard cursor has a halo outside the node, for accessibility. It isn't a node outline, so it doesn't compete with an app's categories.

An earlier version used outlines for six things at once: the selected node, its causes and effects, a highlighted route, a changed node, a removed node and Perspectiva's annotations. Highlights also thickened links, so width meant both "stated by more people" and "look here". A test now checks that highlight states set no width, outline or dash, and that only polarity dashes a line.

Blue and vermilion stay apart for most colour vision, and both sit far from the accent's yellow in hue or lightness. A test checks that every other colour is neutral.



## Source: theming.md

### Line, arrow and text sizes

These defaults come from reading Cytoscape 3.31's renderer, not from guessing. A few of its rules aren't in its documentation, and they decide what looks right.

**Sizes are in model units.** Cytoscape's docs say sizes are "as specified at zoom 1". A 2 px line is 6 px wide at zoom 3. That suits a small diagram, which you look at whole. On a dense graph that people zoom into, lines, rings and text would swell, so `spread` keeps them a constant size on screen instead.

**Arrows have a minimum size.** The renderer draws a triangle `0.3 × size` long and wide, where:

```
size = max((width × 13.37) ^ 0.9, 29) × arrow-scale
```

Below a line width of about 3, the arrow ignores the line and depends on `arrow-scale` alone. That's why thinning a line doesn't shrink its arrow. Cytoscape's own default, a 3 px line with scale 1, draws an 8.7 px arrow, about three times the line. `arrowLength(width, scale)` works this out for you.

**`<pos>-arrow-width` isn't the arrow's size.** It's the stroke width of a hollow arrow.

**Transparency costs twice.** When a link's `opacity` is below 1, the renderer first erases the area under each arrow, then draws it, and overlapping links get darker where they cross. Receding links are drawn in a pale opaque colour instead, made with `mix(color, background, amount)`. Only a highlight's dimming uses `opacity`.

**Clicks have a fixed reach.** A pointer counts as on a link within 8 screen pixels, or 24 on touch, at any zoom. So thin lines stay as easy to click as thick ones.

**Arrows need `straight` or `bezier`.** `haystack` is Cytoscape's fastest edge, but it can't draw a target arrow, which a causal link needs.

| | Line | Arrow | Ring on a selected node |
| :--- | :--- | :--- | :--- |
| Small diagrams (`flowing`) | 2 px | 7 px | 2 px |
| Dense graphs (`straight`) | 1 px, pale | 6 px | 3 px |
| Highlighted | 2 px, or 3 px for a route | Same as unhighlighted | Same |
| `weightBySupport` | 1.5 to 7 px | Grows with lines over 3 px | Same |

These are sizes at zoom 1. With `spread` they hold at every zoom, and with `balanced` they grow by the square root of the zoom.

Labels drawn smaller than `min-zoomed-font-size` are skipped, as they can't be read and still cost time: 6 px for labels beside dots, and 3 px for the smaller text inside pills.



## Source: version-transitions.md

### Interrupted transitions

Users click faster than animations run, and every problem we hit came from a transition being interrupted. All three of these are handled in `transitionToSnapshot`, and they apply to any Cytoscape animation code.

#### Stopping a layout fires layoutstop

`layout.stop()` fires `layoutstop` straight away, with nodes still in mid-flight. If that listener saves positions, it saves wrong ones. A transition marks itself as the current one before stopping the previous one, and a listener only runs if its transition is still current.

#### Interrupted animations never complete

An animation's `complete` callback doesn't run after `stop()`. Cleanup placed there is skipped, which leaves stray elements on the graph. Use a timer that checks the transition is still current.

#### The animation pool tracks elements by id

Removing an element and adding a new one with the same id strands the new element's animations. Cytoscape's pool still holds the removed element, so it treats the new one as already registered and never runs its animations. The element stays flagged as animating forever.

The fix is to not remove leftovers when interrupted. They stay in the graph for the next transition to reuse or fade out.

### Test the interruptions

Each of these bugs looked correct on screen, or only appeared with rapid clicking. Test what you can't see: after rapid switching, check that nothing is still animating, nothing is half-faded, and positions match the first visit. `apps/perspectiva/e2e/graph.spec.ts` does this for every dataset.


## Source: scale-performance.md

Before committing to one renderer, we tested whether Cytoscape could handle Causal Explorer's graph, with 725 nodes and 1,494 edges. Measurements were on an Apple M4 Mac, so expect less on older machines.

| Task | Result |
| :--- | :--- |
| Zoom and pan, canvas renderer | 60 fps |
| Zoom and pan, WebGL renderer | 56 fps |
| Zoom and pan with all 725 labels | 60 fps |
| First render with saved positions | 118 ms |
| Highlight a node's neighbours | 52 ms |
| Find strongly connected components | 322 ms |
| Directed betweenness centrality | 58 ms |
| Full fcose layout | 1–4 s, blocking the page |

So the canvas renderer is enough at this size, and the WebGL option added nothing. Test your own graph, as these numbers depend on the styles you use.



## Source: scale-performance.md

`keepLabelsReadable` does what Sigma's label grid does. Turn it on with `readableLabels` in [`useCausalGraph`](/en/interactions/):

1. Rank nodes by what the reader is looking at first: the selected node and the keyboard cursor, then a highlighted loop or path, then causes and effects, and then centrality.
2. While anything is highlighted, give dimmed nodes no label. They are background, and their labels would crowd out the ones that matter.
3. Try each label above, below, right and left of its node, and keep the first spot that covers no other label and no other node. A selected node keeps its label even where nothing is free.
4. Size text, its outline and the gap to the node as a constant divided by zoom, so they look the same at every zoom. Links and their arrows keep a constant size too, so they don't swell as you zoom in. Cytoscape gives arrows a minimum size whatever the line's width, so arrows need their own scale. See [Line, arrow and text sizes](/en/theming/).
5. Repeat after zooming stops, because restyling every frame is slow, and whenever a highlight changes.

Labels are measured with the browser's own text metrics and wrapped the way Cytoscape wraps them. Wrapping can still differ by a pixel, so the labels chosen are then checked against the boxes Cytoscape actually drew, and a less important one that clashes is dropped.

A highlight used to force a label onto every node it touched, which skipped all of this. Three steps out from a central event in Explorer, that stacked about 80 labels on top of each other.

### Look at the result

The label problem passed every test, including the one for performance. The numbers were fine and the screen was unreadable. Check screenshots at several zoom levels, and turn what you find into a test: Explorer now counts overlapping labels at each zoom level, and at each highlight depth.


## Source: case-explorer.mdx

### What was wrong

The original app ran on Sigma, and its data was sound. The problems were in exploring it:

- Search only matched the start of a label, and 716 of 725 labels start with "a person". Searching for `sleep` found nothing.
- Sentences appeared in a hover card that vanished when the mouse moved away.
- Highlighting didn't separate causes from effects.
- Node sizes ignored direction.
- Every node was its own cluster, so the filters added up to 1,450 checkboxes that couldn't group anything.

### Moving to Cytoscape

The move depended on one question: could Cytoscape draw this graph with labels? [Benchmarks](/en/scale-performance/) showed 60 fps, so both demos could share one engine.

The harder problem was keeping labels readable, which took collision handling.



## Source: case-perspectiva.mdx

### The alignment problem

The original app matched nodes by id, on the assumption that a node keeps its id across versions. It doesn't:

- V1 ids came from a master id column, while final ids came from a mapping index.
- When several V1 nodes merged into one, only the last row's index was kept.

Only 44 of 126 mapped pairs shared an id, and three datasets shared none, so the view looked aligned but wasn't.

Rewriting the ids wasn't an option, because merged nodes would collide. The mapping table was already the source of truth, so it became a [correspondence](/en/data-model/), which left the data untouched.



## Source: interactions.md

### Press-and-hold menu

Cycle configuration, count, timing and selection share one sidebar panel. Selecting a node scopes the list; the scope selector can switch to all nodes. Path endpoint selection also starts in the sidebar. The graph menu only changes steps and traverses adjacent nodes.

- Plain-click a node to select it and show details, without opening the menu. Search selects and positions only.
- Hold a node for about 400 ms to open the menu and lock it, without moving the camera. The node gets a border while the menu is locked.
- While locked, the fan stays on the last node committed. Pointing inside one of its areas chooses that neighbour; past the fan, or past its reach, nothing is chosen and the fan doesn't move on. Only a commit moves it: the chosen neighbour becomes the new fan centre, with angles and radii recomputed from its own neighbours. Dead ends show an empty fan. A locked menu has no step limit: each commit adds to the walk, which stays lit, and every step after the first node is numbered on its node (1, 2, 3, …), with the steps being steered toward numbered more faintly. A link the walk has taken isn't offered again, so it can't go back and forth between two nodes; a loop can still close through another link. Only a locked menu numbers steps; the menu opened by a click previews one step. Hovering or selecting a node always highlights one step; the menu's ring reaches further for that selection only. A click, or letting go of the press that locked the menu, commits the final node and the traversed path, and the locked menu moves to that node. The current centre has a compact, translucent sunburst without an outline: each segment follows an adjacent node’s real direction, and the chosen direction darkens. It keeps the halo’s size and moves between levels. Fan areas are visible only with direction debugging enabled (`?debug=directions`), one step’s fan at a time. The earlier path remains highlighted, and steps are numbered on their nodes; fan fills and outlines stay hidden during normal use. Reduced-motion preferences disable these animations.
- There is no need to keep holding: move toward an adjacent-node direction or step ring to preview it.
- Only the current step’s fan is active, and only it is drawn: its areas are where a click acts. Click anywhere past them, on the canvas or outside it, or press Escape, to leave: the menu closes, the border goes, and the selection and the walk so far stay highlighted. Past the fan nothing is highlighted, since a click there commits nothing. The way in from the step before, up to the far side of the new centre, still counts as inside, as do the menu’s own rings and buttons.
- Once the menu is closed, click empty canvas to clear the retained selection and highlight.
- Moving more than 8 px before the hold activates performs a normal node drag. Escape cancels a held preview and closes the menu, retaining the origin.
- Shift-click and Shift-box remain multi-selection gestures and do not open a held menu. The open menu still owns graph interaction.
- Keyboard alternative: focus the graph and use Shift+F10 / Context Menu on the cursor or single selected node, then Tab and Enter.


### States and priority

| State | Enter | Behaviour | Exit |
| :--- | :--- | :--- | :--- |
| Browse / node selection | Plain click or search | Hover previews, click selects; details in the sidebar, menu closed | Empty canvas or Clear selection clears; hold opens the menu |
| Locked menu | Hold a node for about 400 ms; the node is bordered | Graph-level modal: bright and faded elements cannot independently intercept input; move, with or without the button held, over adjacent-node directions or step controls to preview; a click commits, and the menu moves to the node reached | A click past the current fan, or Escape, closes it and keeps the selection |
| Retained highlight | Commit a menu choice or click a route control | Keeps the selected node, connection route or loop; ordinary hover does not replace it | Empty canvas / Clear selection clears; a new selection replaces it |
| Multi-selection | Shift-click or Shift-box outside the menu | Unlimited nodes; all details and a sparse directed shortest-path connection. Disconnected selected nodes remain bright | Shift-click removes one; plain click replaces with one; empty canvas clears |
| Trace endpoint | Choose ⤳ in the menu | Fans disabled; choose another node to finish. Sidebar gives the next instruction | Escape, origin or background cancels and retains the origin |
| Link details | Click a link outside the menu or use a sidebar link button | Keeps the link and endpoints highlighted, no menu | Same link, empty canvas or Clear selection exits |

Closing the menu and clearing selection are separate. Leaving the locked menu closes it without clearing the committed highlight, and the press that locked it never becomes an extra ordinary click.

Preview never changes selection. Highlight priority: temporary route preview → retained route/link → selected node(s) → ordinary hover. While open, the menu owns pointer interpretation; Shift cannot bypass it, and box selection and background node dragging are disabled. Ordinary interaction resumes on close.

Multi-selection uses one directed shortest path per candidate connection, then greedily joins disconnected selections while preferring fewer new edges and intermediate nodes. Existing paths are reused. This is a sparse approximation, not a globally optimal Steiner network. Unreachable selections remain highlighted; shortest paths have no eight-node cutoff.

### Menu controls

| Control | Move while locked | Click, or let go of the locking press |
| :--- | :--- | :--- |
| Direction fan | Preview neighbour and connection route | Select neighbour and retain route highlight |
| Loop arc | Preview feedback loop | Retain origin and loop highlight |
| Step ring | Preview neighbourhood depth | Retain depth and origin |
| ⤳ | Explain path tracing | Close menu and enter endpoint picking |
| No fan or control | Restore origin highlight | Nothing: the menu stays locked |

Fans use real angular Voronoi directions, capped at 60° on either side of the neighbour, from the origin's edge to just past the neighbour. Default `maxDepth: 2` provides one two-step ring, configurable through `graphOptions.maxDepth`.

### Keyboard and details

With graph focus, arrows move the node cursor; Enter/Space selects. Shift+F10 or Context Menu opens a keyboard menu for the cursor or single selected node; Tab reaches controls, Enter/Space activates. A keyboard menu has no held mouse, so Escape follows the layered exit rules: cancel tracing or a pinned route first, then clear selection. Clear selection always exits everything.

Nodes have no tooltip by default: labels stay on the graph and details/evidence in the sidebar. Modal backdrop has no link tooltip. Without a sidebar, use `renderNodeInfo` / `renderInfo` for a details card. Search and sidebar remain explicit commands; this is not a page-wide dialog.
