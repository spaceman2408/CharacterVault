# Import & Export

Character Vault supports importing and exporting character cards in multiple formats, with full compatibility for SillyTavern and other platforms that use the V2/V3 character card specification.

## Importing Characters

### From PNG

PNG character cards contain embedded `chara` metadata in the image file. Character Vault reads this metadata and imports the character data.

1. Click the **Import** button in the character library.
2. Select a PNG file containing embedded character data.
3. The character is added to your vault.

### From JSON

JSON files can contain V2 or V3 character card data.

1. Click the **Import** button.
2. Select a JSON file.
3. The character is imported and added to your vault.

### From SillyTavern Clipboard

Character Vault supports importing characters copied to the clipboard from SillyTavern:

1. In SillyTavern, copy a character to the clipboard.
2. In Character Vault, navigate to the **Import** page (accessible via the `/import` route or the SillyTavern export extension deep link).
3. Paste the character data.

### SillyTavern Export Extension

The **[SillyTavern CharacterVault Export Extension](https://github.com/spaceman2408/SillyTavern-CharacterVaultExport)** adds a direct "Export to CharacterVault" option inside SillyTavern's export menu.

## Exporting Characters

### As PNG

Exports the character card as a PNG image with the character data embedded in the `chara` metadata field. This is the most portable format — it can be re-imported into Character Vault, SillyTavern, or any other compatible tool.

### As JSON V3

Exports the full V3 character card specification as a JSON file. This includes all V2 fields plus V3 additions: `avatar`, `creator_notes`, `creator`, `character_version`, `tags`, and `physical_description`.

### As JSON V2

Exports the character card in the V2 specification format for compatibility with older tools. V3-only fields (appearance, tags, creator notes, etc.) are omitted.

## Card Specification Support

Character Vault supports both **V2** and **V3** character card specifications:

| Spec | Key Fields |
| :--- | :--- |
| **V2** | `name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`, `system_prompt`, `post_history_instructions`, `alternate_greetings`, `character_book`, `extensions` |
| **V3** | All V2 fields plus `avatar`, `creator_notes`, `creator`, `character_version`, `tags`, `physical_description` |

## Next Steps

- [Organize your vault](/features/vault-organization)
- [Back up with snapshots](/features/snapshots-history)
