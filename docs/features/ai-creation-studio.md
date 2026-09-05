# AI Creation Studio

The **AI Creation Studio** is a dedicated workspace for generating complete character cards from scratch. Describe a concept or pick tags, and the AI writes the fields you enabled — name and description always, first message and examples if you leave them on.

::: tip
AI Creation Studio requires an AI provider. See [AI Setup](/configuration/ai-setup). It always uses the **global** model from **Settings → AI Config**.
:::

## Opening the Studio

From the main vault:

1. Click **✨ AI Creation Studio** in the vault header.
2. The studio opens full-screen.

## Input Modes

### Write Mode

Type a free-form description of the character. The AI uses that text as the concept.

**Examples:**
- "A cynical dwarven blacksmith with a secret past, living in a mountain fortress who speaks in riddles"
- "A cheerful android barista who dreams of becoming human"
- "A mysterious vampire librarian who collects forbidden knowledge"

**Requirements:**
- Minimum 3 words
- Choose a generation style before generating
- More detail usually means a closer match

### Tags Mode

Select tags across categories. **Generation** (perspective and tense) is always first.

| Category | Purpose | Examples |
| :--- | :--- | :--- |
| **Generation** | Writing perspective and tense | First Person, Third Person, Present Tense |
| **Identity** | Core identity | Female, Male, Elf, Android, Vampire |
| **Personality** | Traits | Tsundere, Cheerful, Cynical |
| **Role** | Occupation or relationship | Teacher, Knight, Barista, Rival |
| **Genre** | Setting | Fantasy, Sci-Fi, Modern |
| **Tone** | Interaction style | Romantic, Dark, Comedic |
| **Appearance** | Physical traits | Tall, Muscular, Petite |
| **Dynamic** | Relationship or power setup | Enemies to lovers, Harem, Arranged marriage |
| **Kink & Fetish** | Adult tags (NSFW) | Hidden when **Hide NSFW tags** is on |

**Tag selection:**
- Click a tag to select or deselect it
- Multiple tags per category (except one perspective and one tense)
- Tags convert to a readable concept (`female_knight` → "Female, Knight")
- Conflicting tags are excluded (for example, selecting "female" disables "male")
- **Star** a tag to pin it in **Favorites**. Recently used tags appear under **Recents**.
- **Add your own tag** at the bottom of a category (not Generation). Custom tags save in settings. A slug that already exists in another category is rejected.

::: tip Switching Modes
Switching from Tags to Write copies the selected tags into the concept field so you can edit them as prose.
:::

Hide categories or NSFW tags under [Creation Studio settings](#creation-studio-settings). Hidden categories leave the browser, search, and Feeling Lucky; tags you already selected still generate.

## Generation Style

Every character needs a generation style before the AI can start. Choose:

- **Perspective** — first person, second person, third person, or first person with `{{user}}`
- **Tense** — present tense or past tense

Only one perspective and one tense at a time.

Descriptions are written like character-card reference material. If you choose **First Person with `{{user}}`**, descriptions use `{{user}}` instead of talking directly to "you." First messages and example dialogue still follow the style you selected.

## Feeling Lucky

**🎲 Feeling Lucky** (Tags mode only) picks random character tags and starts generation. Choose a generation style first.

**How it works:**
- Core categories (Identity, Role, Personality): 1–2 tags each
- Supporting categories (Genre, Appearance, Tone): 0–2 tags each
- Flavor categories (Dynamic, Kink & Fetish): 0–1 each; Kink is skipped when NSFW is hidden
- Hidden categories are not picked
- Respects tag exclusion rules
- Shows a visual "tag vortex" before generation (can be disabled)

**Disabling the vortex:**
1. Open **Settings** from the studio header
2. Go to **Creation Studio**
3. Toggle **Show "I'm Feeling Lucky" vortex animation** off

## Generation Process

When you click **Generate Character**, the AI writes enabled fields in order:

1. **Name** — always
2. **Description** — always
3. **First Message** — if enabled
4. **Example Dialogue** — if enabled

Toggle First Message and Examples in **Settings → Creation Studio → Generation Fields**.

**During generation:**
- Each field streams as the AI writes
- A progress indicator shows the current field
- **Stop** keeps whatever has already been written
- **Go Back** stops the run, clears the preview, and returns you to the same concept or tags
- The concept or tags used stay on screen for reference

**After generation:**
- Review the card in the preview panel
- Edit any field in place
- Retry a failed field, or regenerate one you do not like
- Continue if you stopped early
- **Go Back** is still available to start over without leaving the studio

## Preview & Editing

The right panel shows a live preview as fields generate.

- Real-time updates
- Click a field to edit it
- Changes are kept in the studio until you save or go back
- Character count on each field
- Disabled fields are omitted from the preview

**Field actions:**

| Button | Action | What it does |
| :--- | :--- | :--- |
| 🔄 **Retry** | Retry | Re-generate the field if generation failed |
| ✨ **Regenerate** | Regenerate | Generate completely new content for this field |

::: tip
**Retry** is for fixing errors. **Regenerate** is for a fresh take on a field you do not like.
:::

## Saving to Vault

Once generation is complete (or you have at least a name), you can save:

1. Click **Save to Vault** in the bottom-right
2. The character is added to your vault
3. A success message offers:
   - **Open Character** — jump to the editor
   - **Create Another** — start a new character
   - **Library** — return to the vault

::: info Partial Saves
You can save with only a name. Missing fields are empty in the editor.
:::

## Creation Studio settings

Open **Settings** from the studio header (or the vault / workspace header) and choose **Creation Studio**. Click **Save Settings** for changes to apply.

### Generation Fields

Name and Description always run. Turn **First Message** and **Examples** off to skip those API calls.

### Tag Browser

- **Hide NSFW tags** — removes Kink & Fetish from the browser, search, and Feeling Lucky
- **Visible categories** — hide Identity, Personality, Role, Genre, Tone, Appearance, Dynamic, or Kink & Fetish. Generation (perspective / tense) always stays.

### Generation Prompts

Each field has an editable template. Variables:

| Variable | Where it is required | What it expands to |
| :--- | :--- | :--- |
| `${concept}` | Name, Description, First Message, Examples | Your write-mode text or the tag-built concept |
| `${name}` | Description, First Message, Examples | The generated name |
| `${description}` | First Message, Examples | The generated description |
| `${styleBlock}` | optional | Perspective + tense instructions |
| `${narrationRule}` | optional (First Message, Examples) | Narration format for the chosen style |

The **system** prompt has no variables; it is sent on every field. Omitting `${styleBlock}` or `${narrationRule}` drops that guidance. Save is blocked if a required `${…}` is missing. **Reset to defaults** restores the stock templates.

### Lucky vortex

Same as above: play the swirling animation, or skip it and generate immediately.

## API Usage

Each run uses **one API call per enabled field**. Name + Description is the minimum (2). First Message and Examples add one call each when enabled (up to 4).

**Extra calls occur when you:**
- Retry a failed field
- Regenerate a field
- Continue a stopped generation

::: tip Cost Awareness
Generation can consume significant tokens depending on your model and sampler. Monitor usage if you are on a metered plan.
:::

## Tips for Best Results

**Write Mode:**
- Be specific about personality, setting, and tone
- Include unique quirks or speech patterns
- Mention relationships or background if relevant

**Tags Mode:**
- Mix categories (Identity + Personality + Genre, plus Dynamic if you want a relationship hook)
- Star tags you reuse; add custom tags for a setting the built-in list does not cover
- Use Feeling Lucky for unexpected combinations

**Prompts:**
- Keep required `${…}` placeholders
- Drop `${styleBlock}` only if you want the model to ignore the generation-style chips

**After Generation:**
- Edit fields in the preview
- Regenerate individual fields
- Save early and continue in the editor, or ask the [Agent](/features/ai-agent) to fill the rest

## Troubleshooting

**"AI Provider Not Configured"**
- Set up a provider first
- Click **Configure AI** in the warning banner
- See [AI Setup](/configuration/ai-setup)

**Generation fails or returns empty content**
- Check your API key and model
- Verify the model supports chat completions
- Try a different model or sampler settings

**Generation is too slow**
- Reduce `max_tokens` in sampler settings
- Use a faster model
- Turn off First Message or Examples if you do not need them yet

**Fields don't match my concept**
- Regenerate individual fields
- Tighten the concept, or edit the Creation Studio prompts
- Edit fields in the preview

**A custom tag will not add**
- Use letters and numbers (they slugify to `snake_case`)
- The same slug cannot exist in another category
- Custom tags cannot go on Generation

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Adjust sampler settings](/configuration/sampler-settings)
- [Learn about the character editor](/features/editor)
- [Use the AI Assistant for refinement](/features/ai-assistant)
- [Ask the Agent to write the saved card](/features/ai-agent)
