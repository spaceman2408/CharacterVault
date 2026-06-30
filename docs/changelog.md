# Changelog

## Recent Changes

### Current Release Notes

- **In-editor spellcheck** — A Hunspell-backed spellchecker (English dictionary) runs inside the shared editor. Misspelled words are underlined with a wavy-red decoration; hover one to see a quick-fix tooltip with suggestions plus **Ignore word** and **Add to dictionary**. Code fences, `{{macro}}` placeholders, numbers, and ALL-CAPS acronyms are skipped automatically. Your ignored words and personal dictionary persist across all cards. Toggle the feature in **Settings → Studio → Spellcheck**. The dictionary is cached in IndexedDB after first load, so it works offline.
- **NanoGPT PKCE sign-in** — Sign in to NanoGPT directly from Settings → AI Config with a new **Sign in with NanoGPT** button. The OAuth flow uses PKCE (no client secret, no password leaves NanoGPT), and your available models are automatically fetched and loaded into the model picker as soon as sign-in completes. Popup blockers must be allowed. Works on Chrome for Android; other mobile browsers may not relay the auth code back — paste an API key manually if sign-in doesn't complete on your phone.
- Added a **Sections** tab in Settings — hide, reorder, and reset your section tabs to match your workflow.
- Improved the AI Settings tabs so they are easier to read and no longer overlap.
- Reduced unwanted browser password prompts when entering AI settings.
- Improved the character history view for screen readers.
- Added simple editing for character names and creator names.
- Added a cleaner tag editor where you can add, paste, and remove tags quickly.
- Improved tag choices in AI Creation Studio so related tags work together more reliably.

### Latest Commits (Newest to Oldest)

- `00c188d` - feat(auth): auto-fetch models after NanoGPT OAuth sign-in
- `f019115` - style(ui): update NanoGPT sign-in success toast message
- `55c0ec7` - feat(auth): add NanoGPT OAuth sign-in flow
- `974ff11` - refactor(ai): enhance copy button timeout handling and variable scoping
- `461ace4` - feat(mobile): enable copy button visibility on mobile devices
- `43bb8ce` - feat(ui): add stats tooltip and mobile copy button visibility
- `4379702` - feat(ai): implement response performance metrics
- `2789636` - feat(character): adjust sampler parameter ranges
- `8952b08` - perf(character): optimize model caching and provider selection
- `456ded4` - feat(eslint): add 'docs' to global ignores in ESLint configuration
- `a33ff1d` - feat(character): add caching for AI models in settings panel
- `52de543` - feat(character): implement imported character flag for conditional snapshot creation
- `cce7d44` - feat(ui): add create new button and improve create form layout for mobile
- `281be66` - fix(editor): integrate toolbar search with CodeMirror panel lifecycle to stop selection scroll oscillation
- `324ce81` - feat(editor): enhance search navigation with auto-scroll and panel positioning
- `9a014e0` - fix(ai): resolve context at call time to prevent stale system prompt
- `1992244` - feat(editor): add custom tab handling and indentation settings in useAIEditor
- `9722bba` - feat(editor): add lorebook import and export functionality
- `640e573` - refactor(lorebook): filter out empty character books during export
- `9d0d662` - refactor(history): prevent content flash during modal entrance with delayed visibility
- `d4f9696` - feat(components): enhance input handling and loading animations
- `9fc0bd7` - refactor(db): implement content-addressed storage for character images
- `aa4cc58` - feat(ai): enable multi-line input in AI chat and toolbar panels
- `24a629d` - refactor(lorebook): swap name and comment fields in entry editor to match SillyTavern convention
- `f4618c6` - refactor(lorebook): extract case_sensitive extension handling to variable
- `7851a6f` - fix(lorebook): Lorebook Export/Import Compatibility Fix
