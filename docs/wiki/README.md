# Wiki landing source

Home.md and _Sidebar.md are the compact GitHub wiki landing/navigation source. They link to canonical repository guides rather than duplicating version-specific instructions.

On 2026-10-18 the public repository reported has_wiki=true and administrator access, but its wiki Git remote returned Repository not found. The wiki has not been initialized, so these pages are prepared and publication remains blocked. Create the first page through GitHub's Wiki interface, then clone the wiki remote and copy Home.md and _Sidebar.md into it. Review its diff before pushing; preserve any intervening wiki edits. No repository API wiki endpoint or authenticated browser was available in this session.

After publication, check the rendered navigation. Subsequent wiki changes should update these source pages and a permanent work record together. Current user instructions remain in the linked repository guides.
