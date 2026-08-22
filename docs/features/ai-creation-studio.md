# AI Creation Studio

The **AI Creation Studio** is a dedicated workspace for generating complete character cards from scratch using AI. Describe your concept or select tags, and the AI generates a name, description, first message, and example dialogue — all in one flow.

::: tip
AI Creation Studio requires an AI provider to be configured. See [AI Setup](/configuration/ai-setup) to get connected first.
:::

## Opening the Studio

Access the AI Creation Studio from the main vault view:

1. Click the **✨ AI Creation Studio** button in the vault header.
2. The studio opens in a full-screen workspace with a clean, focused interface.

## Input Modes

The studio supports two ways to define your character concept:

### Write Mode

Type a free-form description of your character idea. The AI uses your text as the creative foundation.

**Example concepts:**
- "A cynical dwarven blacksmith with a secret past, living in a mountain fortress who speaks in riddles"
- "A cheerful android barista who dreams of becoming human"
- "A mysterious vampire librarian who collects forbidden knowledge"

**Requirements:**
- Minimum 3 words
- Choose a generation style before generating
- The more detail you provide, the better the AI can capture your vision

### Tags Mode

Select from curated tag categories to build your concept visually. The **Generation** category appears first, followed by character tags:

| Category | Purpose | Examples |
| :--- | :--- | :--- |
| **Generation** | Writing perspective and tense | First Person, Third Person, Present Tense |
| **Identity** | Core identity traits | Female, Male, Elf, Android, Vampire |
| **Personality** | Character traits | Tsundere, Yandere, Kuudere, Cheerful, Cynical |
| **Role** | Relationship or occupation | Teacher, Knight, Barista, Mother, Rival |
| **Genre** | Setting or theme | Fantasy, Sci-Fi, Modern, Historical |
| **Tone** | Interaction style | Romantic, Dark, Comedic, Wholesome |
| **Appearance** | Physical traits | Tall, Short, Muscular, Petite |

**Tag Selection:**
- Click tags to select or deselect them
- Select multiple tags per category
- Choose one perspective and one tense from **Generation**
- Tags automatically convert to a readable concept (e.g., `female_knight` → "Female, Knight")
- Conflicting tags are automatically excluded (e.g., selecting "female" disables "male" and related tags)

::: tip Switching Modes
When switching from Tags to Write mode, your selected tags are automatically converted to text and populate the concept field. You can then edit or expand on them.
:::

## Generation Style

Every character needs a generation style before the AI can start. Choose:

- **Perspective** — first person, second person, third person, or first person with `{{user}}`
- **Tense** — present tense or past tense

Only one perspective and one tense can be selected at a time.

Descriptions are written like character-card reference material. If you choose **First Person with `{{user}}`**, descriptions use `{{user}}` instead of talking directly to "you." First messages and example dialogue still follow the style you selected.

## Feeling Lucky

The **🎲 Feeling Lucky** button (Tags mode only) randomly selects character tags and starts generation immediately. Choose a generation style first.

**How it works:**
- Core categories (Identity, Role, Personality): 1–2 tags each
- Supporting categories (Genre, Appearance, Tone): 0–2 tags each
- Respects tag exclusion rules (no conflicting combinations)
- Shows a visual "tag vortex" animation before generation starts (can be disabled in Settings)

**Disabling the Vortex:**
1. Open **Settings** from the studio header
2. Go to the **UI** tab
3. Toggle **Show Lucky Vortex** off
4. When disabled, Feeling Lucky generates immediately without the animation

## Generation Process

When you click **Generate Character**, the AI creates four fields in sequence:

1. **Name** — Character's name
2. **Description** — Detailed character description
3. **First Message** — Opening greeting
4. **Example Dialogue** — Sample conversation demonstrating personality and speech patterns

**During generation:**
- Each field streams in real-time as the AI writes
- A progress indicator shows which field is currently generating
- You can **Stop** generation at any time
- The concept or tags used are displayed for reference

**After generation:**
- Review the generated content in the preview panel
- Edit any field directly in the preview
- Retry individual fields if you're not satisfied
- Regenerate fields to get completely new content
- Continue generation if it was stopped early

## Preview & Editing

The right panel shows a live preview of your character card as it's generated.

**Preview features:**
- Real-time updates as fields are generated
- Click any field to edit it directly
- Changes are saved automatically
- Character count shown for each field

**Field Actions:**

Each completed field has action buttons:

| Button | Action | What It Does |
| :--- | :--- | :--- |
| 🔄 **Retry** | Retry | Re-generate the field if generation failed |
| ✨ **Regenerate** | Regenerate | Generate completely new content for this field |

::: tip
**Retry** is for fixing errors. **Regenerate** is for getting a fresh take on a field you don't like.
:::

## Saving to Vault

Once generation is complete (or partially complete with at least a name), you can save the character:

1. Click **Save to Vault** in the bottom-right corner
2. The character is added to your vault immediately
3. A success message appears with three options:
   - **Open Character** — Jump to the editor to continue working
   - **Create Another** — Start a new character from scratch
   - **Library** — Return to the vault view

::: info Partial Saves
You can save a character even if not all fields are generated, as long as it has a name. Missing fields will be empty in the editor.
:::

## Generation Settings

The studio uses your configured AI provider and sampler settings. To adjust:

1. Click **Settings** in the studio header
2. Configure your AI provider, model, and sampler settings
3. Changes apply immediately to new generations

See [AI Setup](/configuration/ai-setup) and [Sampler Settings](/configuration/sampler-settings) for details.

## API Usage

Each character generation uses **a minimum of 4 API calls** — one per field (Name, Description, First Message, Example Dialogue).

**Additional calls occur when:**
- Retrying a failed field
- Regenerating a field
- Continuing a stopped generation

::: tip Cost Awareness
Generation can consume significant tokens depending on your model and sampler settings. Monitor your API usage if you're on a metered plan.
:::

## Tips for Best Results

**Write Mode:**
- Be specific about personality, setting, and tone
- Include unique quirks or speech patterns
- Mention relationships or background if relevant

**Tags Mode:**
- Mix categories for richer characters (e.g., Identity + Personality + Genre)
- Use Appearance and Tone tags to fine-tune the vibe
- Experiment with Feeling Lucky for unexpected combinations

**After Generation:**
- Edit fields directly in the preview to refine the output
- Regenerate individual fields if they don't match your vision
- Save early and continue editing in the main editor for advanced features

## Troubleshooting

**"AI Provider Not Configured"**
- You need to set up your AI provider first
- Click **Configure AI** in the warning banner
- See [AI Setup](/configuration/ai-setup) for instructions

**Generation fails or returns empty content**
- Check your API key and model configuration
- Verify your model supports chat completions
- Try a different model or adjust sampler settings

**Generation is too slow**
- Reduce `max_tokens` in sampler settings
- Use a faster model
- Check your network connection

**Fields don't match my concept**
- Try regenerating individual fields
- Edit the concept to be more specific
- Manually edit fields in the preview

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Adjust sampler settings](/configuration/sampler-settings)
- [Learn about the character editor](/features/editor)
- [Use the AI Assistant for refinement](/features/ai-assistant)
- [Ask the Agent to write the saved card](/features/ai-agent)
