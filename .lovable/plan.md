# Improve Follow-up Flowchart Readability

Update `/mnt/documents/Followup_Feature_Flow.mmd` so the diagram is significantly more visible, bold and clear when rendered inline.

## Changes

1. **Larger, spaced layout**
   - Add a Mermaid `%%{init}%%` block setting `flowchart: { nodeSpacing: 60, rankSpacing: 70, curve: 'basis', htmlLabels: true }` and `themeVariables` with bigger `fontSize` (16px) and bold `fontFamily`.
   - Keep `flowchart TD` orientation.

2. **Bold, high-contrast styling**
   - Define `classDef` groups with strong stroke widths (`stroke-width:2.5px`) and readable fills that work in both light/dark themes:
     - `entry` — entry points
     - `role` — role gate / decisions
     - `state` — lifecycle statuses
     - `action` — detail-panel actions
     - `referral` — sign-post sub-flow
     - `report` — reporting/export
     - `notify` — notifications
     - `decision` — diamond decisions (thicker border)
   - Apply `class NodeA,NodeB entry` groupings per subgraph.

3. **Clearer node labels**
   - Wrap long labels with `<br/>` for balanced two-line nodes instead of long single lines.
   - Bold key terms using `<b>…</b>` (htmlLabels enabled) — e.g. status names, dialog names.

4. **Stronger edges**
   - Use `linkStyle default stroke-width:2px` and thicker highlighted edges (`===>`) for the primary happy path (Auto-create → Pending → In Progress → Completed).
   - Label decision edges with concise text (Yes/No, admin/non-admin, etc.).

5. **Subgraph titles**
   - Prefix each subgraph title with a number (1..7) and keep them short so headings stand out.

6. **Preserve coverage**
   - Same 7 clusters and all branches from the prior version — only visual/structural clarity changes.

## Deliverable

- Overwrite `/mnt/documents/Followup_Feature_Flow.mmd` with the restyled diagram.
- Re-surface it via `<lov-artifact url="/__l5e/documents/Followup_Feature_Flow.mmd" mime_type="text/vnd.mermaid"></lov-artifact>`.
- No application code changes.
