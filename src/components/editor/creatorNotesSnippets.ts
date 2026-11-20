export interface CreatorNotesSnippet {
  id: string;
  label: string;
  code: string;
}

// Snippets must survive SillyTavern: no :root/html/body selectors, no @import, no remote
// media, no comments inside rules, and no blank lines or 4-space indents in the markup.
export const CREATOR_NOTES_SNIPPETS: CreatorNotesSnippet[] = [
  {
    id: 'hero',
    label: 'Hero banner',
    code: `<style>
  .cv-hero {
    padding: 28px 20px;
    border-radius: 12px;
    text-align: center;
    background: linear-gradient(135deg, #1e1b4b, #4c1d95);
    color: #ede9fe;
  }
  .cv-hero h1 {
    margin: 0;
    font-size: 2.2em;
    letter-spacing: 0.05em;
  }
  .cv-hero p {
    margin: 8px 0 0;
    opacity: 0.8;
    font-style: italic;
  }
</style>
<div class="cv-hero">
  <h1>{{char}}</h1>
  <p>A one-line hook for your character.</p>
</div>
`,
  },
  {
    id: 'gradient-title',
    label: 'Gradient title',
    code: `<style>
  .cv-gradient-title {
    margin: 0 0 12px;
    font-size: 2em;
    font-weight: 800;
    background: linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
</style>
<h2 class="cv-gradient-title">{{char}}</h2>
`,
  },
  {
    id: 'info',
    label: 'Info block',
    code: `<style>
  .cv-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }
  .cv-info div {
    padding: 10px 12px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 8px;
    background: rgba(148, 163, 184, 0.08);
  }
  .cv-info b {
    display: block;
    font-size: 0.75em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
  }
</style>
<div class="cv-info">
  <div><b>Name</b>{{char}}</div>
  <div><b>Age</b>25</div>
  <div><b>Setting</b>Fantasy</div>
  <div><b>Tone</b>Slow burn</div>
</div>
`,
  },
  {
    id: 'spoiler',
    label: 'Collapsible spoiler',
    code: `<style>
  .cv-spoiler {
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 8px;
    padding: 8px 12px;
  }
  .cv-spoiler summary {
    cursor: pointer;
    font-weight: 600;
  }
</style>
<details class="cv-spoiler">
  <summary>Spoilers (click to open)</summary>
  <p>Hidden details go here.</p>
</details>
`,
  },
  {
    id: 'warnings',
    label: 'Content warnings',
    code: `<style>
  .cv-warnings {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .cv-warnings b {
    margin-right: 4px;
  }
  .cv-warnings span {
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    font-size: 0.85em;
  }
</style>
<div class="cv-warnings">
  <b>Content warnings:</b>
  <span>Violence</span>
  <span>Strong language</span>
</div>
`,
  },
];

/** Pads a snippet so it starts and ends on its own block, which SillyTavern's markdown needs for HTML. */
export function padSnippetForInsert(code: string, before: string, after: string): string {
  const leading = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const body = code.replace(/\n+$/, '');
  const trailing = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  return leading + body + trailing;
}
