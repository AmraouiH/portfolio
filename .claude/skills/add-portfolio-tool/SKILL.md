---
name: add-portfolio-tool
description: Add or update a tool (XrmToolBox plugin, Power Platform ToolBox tool, AI agent) on the portfolio from its name and link(s), then commit and push. Use when the user gives a tool name with a GitHub / NuGet / npm / PPTB link and wants it on the portfolio ("ajoute X au portfolio", "/add-portfolio-tool").
---

# Add a tool to the portfolio

Site: Jekyll on GitHub Pages (repo AmraouiH/portfolio, branch `main`, live at amraouih.github.io/portfolio/).
Every tool is one entry in `_data/tools.yml`. `index.html` renders them; nothing else needs editing in the normal case.

## 1. Gather facts from the links

For each link the user gives:
- **GitHub repo**: `gh repo view AmraouiH/<repo> --json description,primaryLanguage` and the README (`gh api repos/AmraouiH/<repo>/readme -q .content | base64 -d`). Use it to write the summary.
- **NuGet** (XrmToolBox plugin): `curl -s "https://azuresearch-usnc.nuget.org/query?q=packageid:<Id>"` gives `totalDownloads`. Check `authors` is AmraouiH.
- **npm** (PPTB tools, agents): `curl -s https://api.npmjs.org/downloads/point/<start>:<today>/<package>` (max 18 months range).
- **Power Platform ToolBox page** (`https://www.powerplatformtoolbox.com/tools/<guid>`): use it as `link`. Its counter is not readable; use the npm package instead.

If a GitHub repo has an npm or NuGet package mentioned in its README / package.json / .nuspec, find it even if the user did not give it. If the platform (XrmToolBox / PPTB / agent) or the store link is unclear, ask.

If the tool already exists in `tools.yml`, update that entry instead of adding a new one.

## 2. Entry format (`_data/tools.yml`)

```yaml
- name: Full Tool Name
  short: Short label        # orbit bubble label, ~15 chars max
  icon: "🧭"                # one emoji, not already used by another tool
  year: 2026
  platform: Power Platform ToolBox   # omit for XrmToolBox; "Claude Code agent" for AI agents
  link: https://...         # main button URL; omit for XrmToolBox (built from nuget id)
  button: GitHub            # optional main button label (default = platform)
  nuget: PackageId          # "" when not on NuGet; gives live counter + NuGet button
  npm: package-name         # optional; gives live counter + npm button
  github: https://github.com/AmraouiH/<repo>   # "" to hide the Source button
  downloads: 123            # current count, fallback when the live API fails
  featured: true            # optional, highlights the card
  summary: >-
    One or two plain sentences, English, concrete features, no marketing words.
```

Rules:
- Groups shown on the page, in this order: AI agents (`platform: Claude Code agent`), Power Platform ToolBox, XrmToolBox (default). A new platform value needs a new group in the `tool_groups` string of `index.html`.
- Never two buttons to the same URL (e.g. if `link` is the GitHub repo, set `github: ""`).
- Keep the style of the existing summaries (English, factual, ~200-300 chars).
- Append the entry at the end of its platform's block of entries.

## 3. Check, commit, push

- `git diff` and re-read the YAML (indentation, quotes around emoji and "" values).
- If `index.html` or `assets/site.js` was touched: `node --check assets/site.js`.
- Commit on `main` with a short English message ("Add <Tool> to the portfolio"), ending with the attribution lines from the system reminder, then `git push`. The user has asked for the push: no extra confirmation needed.
- Report to the user in French: what was added (name, group, counter source, buttons), the commit hash, and that GitHub Pages takes a minute or two.

Never touch the root site amraouih.github.io (separate repo, privacy policy of the extension).
