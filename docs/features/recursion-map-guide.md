# Recursion Map Guide

A hands-on walkthrough of the recursion map: what the picture means, and how to use it to wire up (or tame) recursive lorebook entries. If you only want a quick reference, the [Lorebook Editor](/features/lorebook-editor#recursion-map) page has a summary. This guide is the slow version.

![The recursion map web view: entries as boxes, arrows for unlock paths, inspector on the right](https://i.imgur.com/BnMeHEJ.png)

## How it works

::: details What recursion actually is
In SillyTavern, a lorebook entry activates when the chat mentions one of its keys. With **recursive scanning** on, activated entries get a second life: the text of an activated entry is scanned too. So if lorebook entry A turns on, and A's **content** happens to contain one of entry B's **keys**, B can turn on as well. B's content then gets scanned, which can wake up C, and so on.

That's a chain reaction. Done well, it makes a book feel alive: mentioning a tavern pulls in the tavern keeper, whose entry pulls in her quest. Done badly, one common word snowballs into a wall of context you never asked for.

The recursion map draws those chain reactions for the current book so you can see them before they surprise you.
:::

::: details Reading the picture
Open the map from book settings (**Map**) or an entry's **Options** panel (**Map**). You get a full-screen view where:

- **Each box is an entry.**
- **Each arrow is a possible unlock.** An arrow from A to B means A's content mentions one of B's keys. Hover the arrow (or the boxes) for the actual key.
- **Clusters are families.** Boxes that can reach each other sit together. Separate clusters are independent: nothing in one cluster can wake up anything in another.
- **Dots on a box are flags.** The legend at the bottom decodes them: blue for non-recursable, green for prevent further, grey for delay until recursion, yellow for disabled entries.

Entries with no connections are hidden by default to keep the picture clean. **Show standalone** (top right) brings them in as dim boxes below the clusters. Useful for spotting entries you expected to be wired up but aren't.
:::

::: details Getting around
- **Drag** the background to pan, **scroll** to zoom toward your cursor.
- **Reset view** fits the whole book back on screen.
- **Hover** an entry to spotlight just its connections and fade the rest.
- The **List** button (top right) swaps the picture for a searchable table. Handy on very large books, which open in list mode automatically.
:::

::: details A first inspection
Click any entry. A panel slides in on the right showing three things:

1. The entry's keys and flags.
2. **Unlocked by**: entries whose content mentions this entry's keys. Each row shows which key did the mentioning.
3. **Unlocks**: entries this entry can wake up, and which of their keys it mentions.

Click any entry in those two lists to inspect it instead. Following "mentions / matched" rows is the fastest way to walk a chain and check that each hop makes sense.

For quick fixes, the three flag buttons in the panel (**Non-recursable**, **Prevent further recursion**, **Delay until recursion**) toggle that single entry immediately.
:::

## Flags

::: details The three flags, in plain terms
| Flag | What it does in the chain |
| :--- | :--- |
| **Non-recursable** | This entry is a dead end for incoming chains. Other entries can name its keys all they want; it will not turn on through recursion. It can still activate normally from the chat. |
| **Prevent further recursion** | When this entry activates, it unlocks nothing. A chain stops here even if its content mentions other keys. |
| **Delay until recursion** | This entry ignores the first scan of the chat and only turns on via recursion. Good for "deep lore" that should only surface once a topic is already rolling. |

Two combinations cover most needs:

- **Standalone entry**: non-recursable + prevent further. Fully out of the web; activates only from chat and chains nowhere.
- **Seed entry**: prevent further off, non-recursable on. Starts chains but nothing can recursively start it. Typical for hub entries like a location.
:::

::: details Changing many entries at once
Sometimes a whole cluster needs taming. That's what selection is for:

1. **Select entries.** Ctrl (or Cmd) + click boxes on the web, or use the checkboxes in list view. Or use the shortcuts in the selection bar: **All**, **Visible** (current search results), or **Linked** (everything that has at least one path).
2. **Stage a change.** In the bar that appears at the bottom, press On or Off next to a flag, or press **Isolate: block both directions**. Nothing happens yet. The bar shows exactly what is staged, which direction, and for how many entries.
3. **Commit or back out.** Press **Apply** to write the change, or **Discard** to drop it. Staging something else, or changing the selection, clears the pending change. On selections above 25 entries, Apply asks for a second confirmation click.

The map does not rearrange itself while you work. Flag changes don't add or remove paths (paths come from keys and content), so boxes stay put; only the flag dots update.
:::

## Common repairs

::: details A chain explodes into everything
Inspect the entry where the explosion starts and look at its "Unlocks" list. Usually one broad key (a name, a place) is matching half the book. Either tighten that target's keys, or set **Prevent further recursion** on the entry that fans out.
:::

::: details Two entries keep re-triggering each other
A mentions B's key, B mentions A's key. Flags can't break the loop by themselves; the clean fix is removing one direction's key from the other entry's content. Use the map to find both arrows, then close it and edit that content.
:::

::: details An entry never fires recursively
Click it and check "Unlocked by". Empty? Either nothing mentions its keys (rename the keys or mention them where you want), or **Non-recursable** is on, which the panel will say directly.
:::

::: details Deep lore fires too early
Set **Delay until recursion** so it stays quiet on the first chat scan and only joins once the topic is already active.
:::

::: details What the map does not know
The picture is built from primary keys in content. It deliberately ignores:

- secondary (selective) keys and their logic
- activation probability
- token budgets that might cut an entry mid-chain
- how many scan steps SillyTavern actually runs

So the map shows what *can* connect, not what *will* fire in a specific chat. It's for shaping the wiring, not predicting a single conversation. If **Recursive scanning** is off for the book, the map shows potential connections and reminds you that SillyTavern won't follow them until scanning is enabled.
:::

## Next steps

- [Lorebook Editor](/features/lorebook-editor) - fields, entry editor, reference for the map
- [Lorebook Vault](/features/lorebook-vault) - managing standalone books
- [Snapshots & Rollback](/features/snapshots-history) - snapshot a book before big flag sweeps
