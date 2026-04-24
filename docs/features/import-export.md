# Import & Export

CharacterVault plays well with the wider character card ecosystem. Whether you're moving characters from other apps, sharing them with friends, or just backing up your work, you can import and export in formats that work with SillyTavern, TavernAI, and most other character card tools.

## Importing Characters

Click **Import** in the vault header, then select a file. CharacterVault accepts PNG images with embedded data or JSON files.

### PNG Files

Character cards saved as PNG images store all their data in a special metadata chunk inside the file. When you import one, CharacterVault reads that chunk, parses the JSON inside, and creates a new character with the image as its avatar. This works with cards from SillyTavern, TavernAI, and similar tools.

### JSON Files

JSON imports are flexible. CharacterVault recognizes several formats:

- **Flat V2** — a simple JSON object with fields like `name`, `description`, `personality` sitting at the top level
- **Wrapped V2 or V3** — the same fields nested inside a structure that declares the specification version
- **CharacterVault export** — CharacterVault's own format includes everything the app stores about a character

All three load cleanly into your vault.

### From SillyTavern

The **[SillyTavern CharacterVault Export Extension](https://github.com/spaceman2408/SillyTavern-CharacterVaultExport)** adds an "Export to CharacterVault" button right inside SillyTavern's export menu. When you use it, the extension copies the character to your clipboard in a format CharacterVault understands — no need to save files manually.

## Exporting Characters

Open a character and click **Export** in the toolbar. You have two choices:

### PNG

Your character becomes a PNG image with all data embedded in the image file itself. This is the most versatile option — send it to anyone and they can drag it straight into SillyTavern, CharacterVault, or any compatible app. The data is embedded as a V3 specification.

### JSON

Exports a JSON file using the V3 specification. Includes name, description, personality, scenario, greetings, lorebook, creator information, tags, and notes.

## What Each Format Includes

| Feature | PNG | JSON |
| :--- | :--- | :--- |
| Basic fields (name, description, etc.) | ✓ | ✓ |
| Alternate greetings | ✓ | ✓ |
| Lorebook / character book | ✓ | ✓ |
| Creator name, version, tags | ✓ | ✓ |
| Creator notes | ✓ | ✓ |
| Character image | ✓ | — |

## Next Steps

- [Organize your vault](/features/vault-organization)
- [Back up with snapshots](/features/snapshots-history)