# Editor Controls

Every text editor in Character Vault (standard sections, Greetings, Lorebook entries, Creator Notes, and Extensions) shares the same keyboard shortcuts and writing helpers. This page collects them in one place. For the toolbar and AI tools, see [Editor & AI Toolkit](/features/editor).

On a Mac, use `⌘` where the tables say `Ctrl`, unless a separate Mac key is listed.

## Writing helpers

These work as you type, no shortcut needed.

| Do this | What happens |
| :--- | :--- |
| Select text, type `*` | Wraps it as `*action*`. The text stays selected, so a second `*` makes `**bold**`. |
| Select text, type `"` | Wraps it as `"dialogue"`. |
| Type `char` or `user` as a word | Becomes `{{char}}` or `{{user}}`. Press `Backspace` right after to keep the plain word. See [Name macros](/features/editor#name-macros). |
| Switch to another section and back | Your cursor, scroll position, and undo history are where you left them. |

Wrapping works with several cursors at once and is a single undo step.

## Undo and saving

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Undo | `Ctrl+Z` | `⌘+Z` |
| Redo | `Ctrl+Y` | `⌘+Shift+Z` |
| Undo the last cursor or selection change | `Ctrl+U` | `⌘+U` |
| Save now | `Ctrl+S` | `⌘+S` |

Undo only covers edits you made in that editor. Changes made elsewhere, such as by the [AI Agent](/features/ai-agent), Orion, or a [snapshot](/features/snapshots-history) rollback, are not undone by `Ctrl+Z`. Use Snapshots to roll those back.

The card saves as you type. `Ctrl+S` just saves right away.

## Selecting and multiple cursors

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Select all | `Ctrl+A` | `⌘+A` |
| Select the next match of the selection | `Ctrl+D` | `⌘+D` |
| Select the current line | `Alt+L` | `Ctrl+L` |
| Add a cursor | `Ctrl+click` | `⌘+click` |
| Add a cursor above / below | `Ctrl+Alt+↑` / `↓` | `⌘+⌥+↑` / `↓` |
| Box (column) selection | `Alt+drag` | `⌥+drag` |
| Back to a single cursor | `Escape` | `Escape` |

`Ctrl+D` with nothing selected selects the word at the cursor. Press it again to add the next match, then type to edit all of them at once.

## Moving and editing lines

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Move line up / down | `Alt+↑` / `↓` | `⌥+↑` / `↓` |
| Copy line up / down | `Shift+Alt+↑` / `↓` | `Shift+⌥+↑` / `↓` |
| Delete line | `Ctrl+Shift+K` | `⌘+Shift+K` |
| Insert a blank line below | `Ctrl+Enter` | `⌘+Enter` |
| Indent / outdent | `Tab` / `Shift+Tab` | `Tab` / `Shift+Tab` |
| Jump by word | `Ctrl+←` / `→` | `⌥+←` / `→` |
| Delete a word | `Ctrl+Backspace` | `⌥+Backspace` |
| Start / end of the text | `Ctrl+Home` / `End` | `⌘+Home` / `End` |

`Tab` inserts a tab instead of moving focus. Press `Ctrl+M` (`Shift+⌥+M` on Mac) to let `Tab` move between controls instead, and press it again to switch back.

## Search and replace

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Search | `Ctrl+F` | `⌘+F` |
| Search and replace | `Ctrl+H` | `⌘+⌥+F` |
| Next / previous match | `F3` / `Shift+F3`, `Ctrl+G` / `Ctrl+Shift+G`, or `Enter` / `Shift+Enter` in the search box | Same, with `⌘` |
| Close search | `Escape` | `Escape` |

More in [Search & Replace](/features/editor#search-replace).

## AI toolbar

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Accept an AI suggestion | `Ctrl+Enter` | `⌘+Enter` |
| Reject a suggestion, dismiss an error, or stop a running request | `Escape` | `Escape` |
| Send a Custom instruction | `Enter` | `Enter` |
| New line in a Custom instruction | `Shift+Enter` | `Shift+Enter` |
| Recall a recent instruction (empty Custom box) | `↑` | `↑` |

`Escape` does one thing at a time: it closes search first, then deals with the AI suggestion, then returns to a single cursor.

## Font size

| Action | Windows / Linux | Mac |
| :--- | :--- | :--- |
| Bigger / smaller | `Ctrl+=` / `Ctrl+-` | `⌘+=` / `⌘+-` |
| Reset to 16px | `Ctrl+0` | `⌘+0` |

The size applies to every editor. More in [Font Size](/features/editor#font-size).
