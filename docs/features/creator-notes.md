# Creator Notes Preview

The **Creator Notes** tab lets you write notes for other users who import your character card. Unlike other text fields, Creator Notes supports **HTML and CSS** with a live sandboxed preview.

## Writing Creator Notes

Type your content in the editor on the Creator Notes tab. You can write:

- **Plain text** — Displayed as-is with a monospace font in the preview
- **HTML** — Any markup tags (headings, lists, styled text, etc.) are rendered in the preview
- **CSS** — Style rules in `<style>` blocks are applied within the preview sandbox

::: tip
If your content has no HTML tags at all, the preview displays it as plain preformatted text in a monospace font. You don't need to write HTML if you just want to leave a simple note.
:::

## Preview Modes

Click **Preview CSS** to open a full-screen preview modal. The modal shows your Creator Notes content exactly as other users would see it. Press **Escape** or click **Close** to return to the editor.

Click **Add to Editor** inside the modal to switch to a split view. The screen splits into two panels: your editor on the right, the live preview on the left. Changes you make in the editor update the preview in real time.

To exit split view, click **Stop Previewing CSS**.

::: tip
The split view is useful for iterating on styled notes. Make a change, see it immediately, and adjust until it looks right.
:::

### Sandboxed Rendering

The preview renders inside an isolated frame with security restrictions:

- Your HTML and CSS are isolated from the rest of the app, so styles won't leak out
- Scripts and form submissions are blocked for security
- The preview environment uses a dark gradient background and a base sans-serif font stack

::: tip
Always design your CSS for a dark background. The preview environment uses a dark color scheme by default, and most SillyTavern setups do too.
:::

::: tip
Keep your styles self-contained. External resources like fonts or images may not load inside the sandbox. Include styles inline or in `<style>` tags instead.
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
