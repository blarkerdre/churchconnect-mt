

## Plan: Remove Feature Toggles from Settings

### What
Remove the "Features" tab and its `FeatureTogglesSection` component from the Settings page.

### Changes

**File: `src/pages/Settings.jsx`**

1. Remove the `TOGGLEABLE_FEATURES` array and `FeatureTogglesSection` function (lines 354-499)
2. Remove the `useDisabledSubFeatures` and `SUB_FEATURES` imports from `@/hooks/useSubFeature` (if only used here)
3. Remove the "Features" `TabsTrigger` (lines 664-666)
4. Remove the "Features" `TabsContent` block (lines 740-743)
5. Remove unused icon imports (`ToggleLeft`, `ChevronRight`, `ChevronDown`) if no longer referenced elsewhere in the file

