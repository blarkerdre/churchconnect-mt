

## Add Purchase Link to Books of the Month

### Summary
Add a `purchase_url` column to the `books_of_the_month` table and display it as a "Buy Now" link on the dashboard card. Also update the admin settings form to include the URL field.

### Changes

1. **Database migration** — Add `purchase_url text` nullable column to `books_of_the_month`

2. **`src/components/dashboard/BookOfTheMonth.jsx`** — Render a "Buy Now" link button below each book's description when `purchase_url` is set (opens in new tab)

3. **`src/components/settings/BookOfTheMonthSettings.jsx`** — Add a "Purchase Link" input field to the add/edit form, and include it in the save payload

