# WordPress AI Site Management — Setup Plan

## Goal
Use Claude (in VS Code) to manage our SiteGround-hosted WordPress site: improve SEO meta data, clean up content, and organize the site.

## Approach
Claude talks to WordPress over HTTPS via the built-in REST API (`/wp-json/wp/v2/`), using an Application Password for auth. An MCP server running locally wraps those endpoints so Claude can list/edit posts, pages, media, categories, tags, and SEO meta.

**Nothing runs on SiteGround.** No SSH, no file edits on the server, no direct DB access. All work happens from the local machine — SiteGround just sees authenticated API calls.

## Why not direct DB access
Bypasses WP hooks, cache invalidation, and revisions. Corrupts state. Don't do it.

## Why not WordPress.com / Jetpack AI
Self-hosted on SiteGround gives full REST API access and full control over meta fields (needed for SEO plugin data).

## Setup Steps

### 1. Generate an Application Password
- Log into wp-admin
- Users → Profile → Application Passwords
- Name it "Claude MCP" → Add New Application Password
- Copy the generated password (shown once)

### 2. Confirm REST API is reachable
- Visit `https://<site-url>/wp-json/` in a browser
- Should return JSON, not a 404

### 3. MCP server (local, in this project folder)
Wraps these endpoints:
- `GET/POST/PUT /wp/v2/posts`
- `GET/POST/PUT /wp/v2/pages`
- `GET/POST/PUT /wp/v2/media`
- `GET/POST/PUT /wp/v2/categories`, `/tags`
- `GET/POST/PUT` on post meta (SEO fields)

Auth: Basic Auth with username + Application Password.

### 4. SEO plugin meta keys
Meta field names depend on which plugin is installed:
- **Yoast SEO** — `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw`, etc.
- **Rank Math** — `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`, etc.
- **All in One SEO** — `_aioseo_title`, `_aioseo_description`, etc.

MCP server needs to be configured for whichever is in use.

## Open Questions (answer before building)
1. Site URL?
2. Which SEO plugin is installed? (wp-admin → Plugins)
3. Roughly how many pages/posts? (affects batch vs page-by-page workflow)
4. Build custom MCP server (Node or Python) or try an existing community one first?

## Workflow Once Set Up
1. Claude pulls a page's content + SEO meta
2. Proposes rewrites (title, meta description, focus keyword, body cleanup)
3. On approval, PUTs the update back
4. Sweeps site section by section — pages first, then posts, then taxonomies

## Not in Scope (yet)
- Visitor-facing AI chat on the live site (would be a separate custom WP plugin proxying to Claude API server-side)
- Theme/plugin code edits (would need SiteGround SFTP or Git deploy)
