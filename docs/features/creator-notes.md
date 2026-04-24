# Creator Notes Preview

The **Creator Notes** tab lets you write notes for other users who import your character card. Unlike other text fields, Creator Notes supports **HTML and CSS** with a live sandboxed preview.

## Writing Creator Notes

Type your content in the editor on the Creator Notes tab. You can write:

- **Plain text** — Displayed as-is with a monospace font in the preview.
- **HTML** — Any markup tags (headings, lists, styled text, etc.) are rendered in the preview.
- **CSS** — Style rules in `<style>` blocks are applied within the preview sandbox.

## Preview Modal

Click the **preview button** to open a full-screen preview modal that renders your Creator Notes content exactly as other users would see it. The modal shows:

- A dark-themed sandboxed iframe with your rendered HTML/CSS content.
- An **Add to Editor** button that inserts the content back into the editor.
- A **Close** button (or press `Escape`).

### Sandboxed Rendering

The preview renders inside an `<iframe>` with the `sandbox="allow-same-origin"` attribute. This means:

- Your HTML and CSS are isolated from the rest of the app — styles won't leak out.
- Scripts and form submissions are blocked for security.
- The preview environment provides a dark gradient background and a base sans-serif font stack.

If your content contains no HTML tags, it's displayed as plain preformatted text with a monospace font.

## Tips

- **Test with the preview** — Always check your styled notes in the preview before exporting, to make sure they look the way you intended.
- **Keep it self-contained** — Since the preview is sandboxed, external resources (fonts, images, scripts) may not load. Include styles inline or in `<style>` tags.
- **Dark theme only** — The preview environment uses a dark color scheme. Design your CSS accordingly.

## Next Steps

- [Lorebook editor](/features/lorebook-editor)
- [Import & export](/features/import-export)
