

## Make Cover Image Upload Side-by-Side

### Change
In the Book of the Month dialog form, rearrange the Cover Image section so the preview image and the upload button sit side-by-side instead of stacked vertically.

### Changes to `src/components/settings/BookOfTheMonthSettings.jsx`

Replace lines 178-191 (the Cover Image section) with a horizontal flex layout:

```jsx
<div className="space-y-1">
  <Label>Cover Image</Label>
  <div className="flex items-center gap-3">
    {form.cover_image_url && (
      <img src={form.cover_image_url} alt="Cover" className="h-20 w-14 rounded object-cover shrink-0" />
    )}
    <Button variant="outline" size="sm" asChild disabled={uploading}>
      <label className="cursor-pointer gap-1.5">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading..." : "Upload Cover"}
        <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </label>
    </Button>
  </div>
</div>
```

The image preview and upload button are now wrapped in a single `flex items-center gap-3` container. The `mb-2` on the image is removed since the flex gap handles spacing.

### Files changed
- `src/components/settings/BookOfTheMonthSettings.jsx` — rearrange cover image section to horizontal layout

