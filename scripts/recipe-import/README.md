# Recipe import

Turns the client's single-page recipe PDFs (Drive: Meal Vault → Single page recipes) into
data the admin importer at `/admin/import-recipes` can load.

```
npm install
npm run parse        # reads ../../content-import/pdfs, writes ../../content-import/out (~9 min)
```

`content-import/` is gitignored: it holds client content, not code.

## Output

| File | Purpose |
|---|---|
| `recipes.import.json` | Unique recipes in the importer's `RecipeJson` shape, `is_public: false` |
| `recipes.json` | Everything, plus source page, per-serving nutrition, structured ingredients (grams) and review flags |
| `review.csv` | One row per recipe for review in Sheets; `approved` / `reviewer_notes` columns are blank |
| `skipped.json` | Pages that are not recipes (section dividers, meal plans, shopping lists) or were merged |
| `images/*.png` | Recipe photo per recipe, named to match `image_filename` |

## Rules the parser applies

- PDF nutrition is per serving; `calories/protein/carbs/fats` are multiplied by servings because
  `meals` stores recipe totals.
- A recipe that overflows onto the next page is merged with it.
- Section divider pages ("Lunch", "Dinner", "Snack") set `category` for the recipes that follow.
- "Cooking tip", "Equipment option" and anything under a NOTES heading go to `coach_notes`.
- The same recipe in several books is imported once with the tags of every book; a recipe that
  shares a title but differs is kept and flagged for renaming.
