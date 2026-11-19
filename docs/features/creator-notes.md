# Creator Notes Preview

The **Creator Notes** tab lets you write notes for other users who import your character card. Unlike other text fields, Creator Notes supports **HTML and CSS** with a live sandboxed preview.

## Writing Creator Notes

Type your content in the editor on the Creator Notes tab. You can write:

- **Markdown** — `**bold**`, lists, tables, and so on, the same as SillyTavern renders it
- **HTML** — Any markup tags (headings, lists, styled text, etc.) are rendered in the preview
- **CSS** — Style rules in `<style>` blocks are applied within the preview sandbox
- **Macros** — `{{char}}` shows as the card's name and `{{user}}` as "User"

If imported Creator Notes contain encoded entities like `&nbsp;` or `&amp;`, click the **;&** button in the editor toolbar to convert them back into readable characters before editing.

## Preview Modes

Click **Preview CSS** to open a large preview window (90% of the screen). Press **Escape** or click **Close** to return to the editor.

Click **Add to Editor** inside the preview to switch to a split view. On large screens the editor is on the left and the live preview on the right; on narrower screens they stack, with the editor on top. Changes you make in the editor update the preview in real time. **Add to Editor** is not available on phones.

To exit split view, click **Stop Previewing CSS**.

::: tip
The split view is useful for iterating on styled notes. Make a change, see it immediately, and adjust until it looks right.
:::

### Match SillyTavern

**Match SillyTavern** (on by default, above the preview) renders the notes the way SillyTavern does:

- Markdown is converted, and a single line break becomes a new line
- `{{char}}` and `{{user}}` are filled in
- Styles are scoped to the notes, so rules on `:root`, `html`, or `body` match nothing. Put shared styles and CSS variables on a wrapper `<div>` instead
- Scripts, event handlers like `onclick`, `<iframe>`, and `@import` are removed
- Remote images, media, and styles with remote URLs are hidden, since SillyTavern blocks remote media unless the user allows it for that card. Images embedded as `data:` URLs still show. Turn on **Remote media** to see them as a user who allowed it
- A CSS comment inside a rule breaks the whole style block while remote media is blocked. Put comments between rules instead

One difference: notes written as a full web page (`<!DOCTYPE>`, `<html>`, `<head>`, `<body>`) leave blank lines at the top and bottom in SillyTavern. The preview hides those.

When the preview changes something, a short list above it says what. Turn **Match SillyTavern** off to see the raw HTML and CSS as written. Other sites, such as Chub, render notes their own way.

### Preview Controls

The buttons above the preview change how it's shown, not the notes. Your choices are remembered in this browser.

- **Width** — Full, Wide (720px), SillyTavern panel (480px), or Phone (390px). Not shown on phones
- **Background** — Dark, Light, or a checkerboard to spot transparent areas. Notes that set their own background still win
- **Replay** — Restarts CSS animations

### Sandboxed Rendering

The preview renders inside an isolated frame with security restrictions:

- Your HTML and CSS are isolated from the rest of the app, so styles won't leak out
- Scripts and form submissions are blocked for security
- Only https images, fonts, and stylesheets load, plus images embedded in the notes (`data:` URLs). Everything else is blocked
- The preview environment uses a dark gray background by default and a base sans-serif font stack

When the notes pull images, fonts, or styles from another site, the preview shows a yellow warning bar: that site can see your IP address and that you opened the card. The warning is on by default; turn it off in **Settings → Character Workspace → Warn about remote content in Creator Notes preview**.

::: tip
Always design your CSS for a dark background. The preview environment uses a dark color scheme by default, and most SillyTavern setups do too.
:::

::: tip
Keep your styles self-contained. Plain http resources never load in the preview, remote https ones can tell their host who opened the card, and SillyTavern hides them by default. Include styles inline or in `<style>` tags, and embed small images as `data:` URLs.
:::

## Example

Paste this into the Creator Notes editor and click **Preview CSS** to see it rendered:

```html
<style>
  .card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
  }
  .card h2 {
    color: #60a5fa;
    margin: 0 0 8px 0;
    font-size: 1.2em;
  }
  .card p {
    color: #cbd5e1;
    margin: 0;
    line-height: 1.5;
  }
  .tag {
    display: inline-block;
    background: rgba(96, 165, 250, 0.15);
    color: #93c5fd;
    border-radius: 6px;
    padding: 2px 8px;
    margin: 4px 4px 0 0;
    font-size: 0.85em;
  }
</style>

<div class="card">
  <h2>About This Character</h2>
  <p>Works best with temperature 0.8 and a context size of 8K.</p>
</div>

<div class="card">
  <h2>Recommended Tags</h2>
  <span class="tag">Fantasy</span>
  <span class="tag">Adventure</span>
  <span class="tag">Slow Burn</span>
</div>
```

## Next Steps

- [Lorebook editor](/features/lorebook-editor)
- [Import & export](/features/import-export)
