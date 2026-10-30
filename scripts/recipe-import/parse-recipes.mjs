// Parses the client's single-page recipe PDFs (one recipe per PDF, fixed template)
// into recipes.json for the admin importer and review.csv for human review.
//
// Usage: node parse-recipes.mjs <pdfDir> <outDir>
//   <pdfDir> must contain manifest.json (collection, fileId, name, localPath per PDF).
//
// Nutrition in the PDFs is PER SERVING. The app stores recipe TOTALS in `meals`
// (see technical overview, data rule 4.3), so macros are multiplied by servings.
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import zlib from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [pdfDir, outDir] = process.argv.slice(2);
if (!pdfDir || !outDir) {
  console.error('usage: node parse-recipes.mjs <pdfDir> <outDir>');
  process.exit(1);
}

// Collection folder → tags. health_tags carry the "situation" (clinician-reviewed),
// diet_tags carry dietary constraints the collection guarantees.
const COLLECTIONS = {
  blood_sugar_regulation: { label: 'Blood Sugar Regulation', health: ['blood-sugar'] },
  brain_health: { label: 'Brain Health', health: ['brain-health'] },
  family_friendly: { label: 'Family Friendly', tags: ['family-friendly'] },
  glowing_summer_vegan_smoothies: { label: 'Glowing Summer Vegan Smoothies', diet: ['vegan'], tags: ['smoothie', 'summer'] },
  golden_summer_protein_smoothies: { label: 'Golden Summer Protein Smoothies', tags: ['smoothie', 'summer', 'high-protein'] },
  healthier_desserts: { label: 'Health(ier) Desserts', tags: ['dessert'] },
  healthy_hormones: { label: 'Healthy Hormones', health: ['hormone-health'] },
  high_protein: { label: 'High Protein', tags: ['high-protein'] },
  holiday: { label: 'Holiday', tags: ['holiday'] },
  metabolism_reboot: { label: 'Metabolism Reboot', health: ['metabolism'] },
  minimal_ingredient: { label: 'Minimal Ingredient', tags: ['minimal-ingredient'] },
  muscle_building: { label: 'Muscle Building', tags: ['muscle-building', 'high-protein'] },
  no_cook: { label: 'No-Cook', tags: ['no-cook'] },
  perimenopause: { label: 'Perimenopause', health: ['perimenopause'] },
  postpartum_nourishment: { label: 'Postpartum Nourishment', health: ['postpartum'] },
  primal_plate: { label: 'Primal Plate', diet: ['paleo'] },
  vegan_plant_based: { label: 'Vegan Plant Based', diet: ['vegan'] },
};

const round1 = (n) => Math.round(n * 10) / 10;
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Groups positioned text items into lines, joining fragments by their horizontal gap. */
function toLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= 3);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines
    .map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = null;
      for (const it of l.items) {
        if (prevEnd !== null && it.x - prevEnd > 1.2) text += ' ';
        text += it.str;
        prevEnd = it.x + it.w;
      }
      return { y: l.y, x: l.items[0].x, text: text.replace(/\s+/g, ' ').trim() };
    })
    .filter((l) => l.text)
    .sort((a, b) => b.y - a.y);
}

const QTY = String.raw`(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?|\d+\s+\d+\/\d+|[½¼¾⅓⅔])`;
const INGREDIENT_RE = new RegExp(String.raw`^${QTY}\s*(.*?)\s*\[\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*\]\s*(.+)$`, 'i');

function parseIngredient(line) {
  const m = line.match(INGREDIENT_RE);
  if (!m) return { raw: line, display: tidy(line), quantity: null, unit: null, grams: null, ml: null, name: tidy(line), note: null };
  const [, qty, unit, amount, amountUnit, rest] = m;
  const noteMatch = rest.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  // A trailing "(...)" is usually a prep note; a mid-name "(Coriander)" stays in the name.
  const name = (noteMatch && noteMatch[1] ? noteMatch[1] : rest).replace(/\s+\)/g, ')').trim();
  const note = noteMatch && noteMatch[1] ? noteMatch[2].trim() || null : null;
  const unitClean = unit.replace(/,\s*$/, '').trim();
  return {
    raw: line,
    display: [qty, unitClean, name].filter(Boolean).join(' ') + (note ? ` (${note})` : ''),
    quantity: qty,
    unit: unitClean || null,
    grams: amountUnit.toLowerCase() === 'g' ? Number(amount) : null,
    ml: amountUnit.toLowerCase() === 'ml' ? Number(amount) : null,
    name,
    note,
  };
}

/** Minimal PNG encoder for pdfjs image data (kind 2 = RGB, kind 3 = RGBA). */
function encodePng({ width, height, kind, data }) {
  const channels = kind === 3 ? 4 : 3;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * channels + 1)] = 0; // filter: none
    Buffer.from(data.buffer, data.byteOffset + y * width * channels, width * channels).copy(raw, y * (width * channels + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])));
    return Buffer.concat([len, Buffer.from(type), body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The recipe photo is the largest colour image painted on the page. The page frame and
 * header bands are large grayscale images, so they are skipped (pdfjs reports kind 1 or
 * expands gray to RGB with identical channels).
 */
async function extractPhoto(page) {
  const ops = await page.getOperatorList();
  let best = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
    const id = ops.argsArray[i][0];
    const img = await new Promise((resolve) => page.objs.get(id, resolve));
    if (!img?.data || (img.kind !== 2 && img.kind !== 3)) continue;
    const step = img.kind === 3 ? 4 : 3;
    let colourful = false;
    for (let p = 0; p < img.data.length && !colourful; p += step * 97) {
      if (img.data[p] !== img.data[p + 1] || img.data[p + 1] !== img.data[p + 2]) colourful = true;
    }
    if (colourful && (!best || img.width * img.height > best.width * best.height)) best = img;
  }
  return best ? { png: encodePng(best), width: best.width, height: best.height } : null;
}

async function parsePdf(file) {
  const buf = await readFile(file);
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }));
  const pageCount = doc.numPages;
  const isRecipe = items.some((it) => it.str.trim().toUpperCase() === 'INGREDIENTS');
  const photo = isRecipe ? await extractPhoto(page) : null;
  await doc.destroy();

  const flags = [];
  if (pageCount > 1) flags.push(`pdf has ${pageCount} pages; only page 1 parsed`);

  const findHeader = (word) => items.find((it) => it.str.trim().toUpperCase() === word);
  const ingHeader = findHeader('INGREDIENTS');
  const dirHeader = findHeader('DIRECTIONS');
  const nutHeader = findHeader('NUTRITION');
  const allLines = toLines(items.filter((it) => it.y > 20));
  const text = allLines.map((l) => l.text).join(' | ');
  if (!ingHeader || !dirHeader) {
    // Section divider, e.g. "High Protein | Lunch | RE - FUEL AND RE - ENERGIZE".
    const section = text.match(/\|\s*(Breakfast|Lunch|Dinner|Snacks?|Desserts?)\s*\|/i);
    if (section && allLines.length <= 6) return { kind: 'divider', category: section[1].toLowerCase().replace(/s$/, ''), text };
    // Overflow of the previous recipe: its nutrition box and/or the rest of its numbered steps.
    const stepLines = allLines.filter((l) => l.x > 280 && (!nutHeader || l.y < nutHeader.y - 5 || l.y > nutHeader.y + 30));
    const looksLikeSteps = stepLines.length && /^\d+\s*\./.test(stepLines[0].text);
    if (nutHeader || looksLikeSteps) {
      return {
        kind: 'continuation',
        perServing: nutHeader ? readNutrition(items, nutHeader) : null,
        steps: looksLikeSteps ? toSteps(stepLines) : [],
        text,
      };
    }
    return { kind: 'other', text: text.slice(0, 300) };
  }

  // Title: the largest text above the meta row.
  const maxH = Math.max(...items.map((it) => it.h));
  const titleItems = items.filter((it) => it.h >= Math.max(18, maxH - 1) && it.y > ingHeader.y);
  const title = toLines(titleItems).map((l) => l.text).join(' ').trim();
  if (!title) flags.push('title not found');

  // Meta row: SERVINGS / PREP TIME / COOKING TIME, between title and section headers.
  const metaText = toLines(items.filter((it) => it.y > ingHeader.y + 10 && it.h < 18)).map((l) => l.text).join(' ');
  const num = (re) => {
    const m = metaText.match(re);
    return m ? Number(m[1]) : null;
  };
  const servings = num(/SERVINGS\s*:\s*(\d+(?:\.\d+)?)/i);
  const prep = num(/PREP\s*TIME\s*:\s*(\d+)/i);
  const cook = num(/COOKING\s*TIME\s*:\s*(\d+)/i);
  const toMinutes = (n, unitRe) => (n == null ? null : unitRe.test(metaText) ? n * 60 : n);
  const prep_time = toMinutes(prep, /PREP\s*TIME\s*:\s*\d+\s*HOUR/i);
  const cook_time = toMinutes(cook, /COOKING\s*TIME\s*:\s*\d+\s*HOUR/i);
  if (servings == null) flags.push('servings missing');

  // Columns: everything between the section headers and the nutrition box.
  const bodyTop = ingHeader.y - 5;
  const bodyBottom = nutHeader ? nutHeader.y + 10 : 0;
  // Step numbers sit ~24pt left of the DIRECTIONS header; ingredient text never reaches that far.
  const splitX = dirHeader.x - 32;
  // y > 20 drops the page-number footer.
  const body = items.filter((it) => it.y < bodyTop && it.y > Math.max(bodyBottom, 20));
  const ingLines = toLines(body.filter((it) => it.x < splitX));
  const dirLines = toLines(body.filter((it) => it.x >= splitX));

  // Ingredients: a line starting near the column's left edge with a quantity starts a new
  // ingredient; anything else continues the previous one (wrapped text).
  const ingLeft = Math.min(...ingLines.map((l) => l.x));
  const rawIngredients = [];
  for (const l of ingLines) {
    const startsNew = l.x <= ingLeft + 3 && (/^[\d½¼¾⅓⅔]/.test(l.text) || rawIngredients.length === 0);
    if (startsNew || rawIngredients.length === 0) rawIngredients.push(l.text);
    else rawIngredients[rawIngredients.length - 1] += ' ' + l.text;
  }
  const ingredients = rawIngredients.map(parseIngredient);
  // "1 medium Lemon" without a gram weight is normal; a line that doesn't start with a
  // quantity is probably a sub-heading or a mis-joined wrap, so a human should look.
  const odd = ingredients.filter((i) => i.grams == null && i.ml == null && !/^[\d½¼¾⅓⅔]/.test(i.raw));
  if (odd.length) flags.push(`ingredient line(s) without a quantity: ${odd.map((i) => i.raw).join('; ')}`);
  if (!ingredients.length) flags.push('no ingredients');

  const steps = toSteps(dirLines);
  if (!steps.length) flags.push('no directions');

  const perServing = nutHeader ? readNutrition(items, nutHeader) : null;

  return { kind: 'recipe', title, servings, prep_time, cook_time, ingredients, steps, perServing, flags, photo };
}

const NOTES_MARKER = '__NOTES__';
const tidy = (s) =>
  s.replace(/\s+([,.!?;:)])/g, '$1').replace(/\(\s+/g, '(').replace(/(\w)\s*-\s+(\w)/g, '$1-$2').replace(/\s+/g, ' ').trim();

/** "N." starts a step; other lines continue the current step. A "NOTES" heading switches to notes. */
function toSteps(lines) {
  const steps = [];
  for (const l of lines) {
    if (/^notes?$/i.test(l.text)) {
      steps.push(NOTES_MARKER);
      continue;
    }
    const m = l.text.match(/^(\d+)\s*\.\s*(.*)$/);
    if (m) steps.push(m[2]);
    else if (steps.length && steps[steps.length - 1] !== NOTES_MARKER) steps[steps.length - 1] += ' ' + l.text;
    else steps.push(l.text);
  }
  return steps.map((s) => (s === NOTES_MARKER ? s : tidy(s))).filter(Boolean);
}

function readNutrition(items, nutHeader) {
  const text = toLines(items.filter((it) => it.y <= nutHeader.y + 2 && it.y > nutHeader.y - 30)).map((l) => l.text).join(' ');
  const nut = (label) => {
    const m = text.match(new RegExp(label + String.raw`\s*:\s*(\d+(?:\.\d+)?)`, 'i'));
    return m ? Number(m[1]) : null;
  };
  return { calories: nut('Calories'), fat: nut('Fat'), carbs: nut('Carbs'), protein: nut('Protein'), fiber: nut('Fiber'), sugar: nut('Sugar') };
}

// Steps like "Cooking tip #1: …" or "Equipment option: …" are advice, not method.
const NOTE_RE = /^(cooking tips?|tips?|notes?|equipment options?|preparation options?|storage|make ahead|serving suggestions?|substitutions?|leftovers|variations?)\b[^:]{0,12}:/i;

/** Final checks once a recipe (plus any continuation page) is complete. */
function finalizeChecks(r) {
  const p = r.perServing;
  if (!p) r.flags.push('nutrition missing');
  else {
    for (const [k, v] of Object.entries(p)) if (v == null) r.flags.push(`nutrition ${k} missing`);
    // 4/4/9 kcal from macros should be near the stated calories.
    if (p.calories && p.protein != null && p.carbs != null && p.fat != null) {
      const est = p.protein * 4 + p.carbs * 4 + p.fat * 9;
      const diff = Math.abs(est - p.calories) / p.calories;
      if (diff > 0.2) r.flags.push(`calories (${p.calories}) differ ${Math.round(diff * 100)}% from macros (${Math.round(est)})`);
    }
  }
  if (r.cook_time && /smoothie|shake/i.test(r.title)) r.flags.push(`cook time ${r.cook_time} min on a smoothie/shake`);
}

const manifest = JSON.parse(await readFile(path.join(pdfDir, 'manifest.json'), 'utf8'));
await mkdir(path.join(outDir, 'images'), { recursive: true });

// Pass 1: classify every page. Pages must be read in book order so continuation pages
// and section dividers apply to the right recipes.
const pageNo = (e) => Number((e.name.match(/recipe_(\d+)/) || [])[1]) || 0;
const ordered = [...manifest].sort((a, b) => a.collection.localeCompare(b.collection) || pageNo(a) - pageNo(b));
const pages = [];
for (const [i, entry] of ordered.entries()) {
  let parsed;
  try {
    parsed = await parsePdf(path.join(pdfDir, entry.localPath));
  } catch (e) {
    parsed = { kind: 'error', text: e.message };
  }
  pages.push({ entry, page: pageNo(entry), parsed });
  if ((i + 1) % 50 === 0) console.log(`read ${i + 1}/${ordered.length}`);
}

// Pass 2: assemble recipes, merging continuation pages and applying section categories.
const drafts = [];
const skipped = [];
let collection = null;
let category = null;
let current = null;
for (const { entry, page, parsed } of pages) {
  if (entry.collection !== collection) {
    collection = entry.collection;
    // Books open with breakfast; later sections are announced by divider pages.
    const hasDividers = pages.some((p) => p.entry.collection === collection && p.parsed.kind === 'divider');
    category = hasDividers ? 'breakfast' : null;
    current = null;
  }
  if (parsed.kind === 'recipe') {
    current = { entry, page, category, ...parsed };
    drafts.push(current);
  } else if (parsed.kind === 'divider') {
    category = parsed.category;
    current = null;
    skipped.push({ file: entry.localPath, reason: `section divider (${parsed.category})` });
  } else if (parsed.kind === 'continuation' && current && current.page === page - 1) {
    if (parsed.perServing && !current.perServing) current.perServing = parsed.perServing;
    current.steps.push(...parsed.steps);
    current.flags.push(`continued on page ${page}`);
    current.page = page;
    skipped.push({ file: entry.localPath, reason: `merged into ${current.entry.collection}/${String(pageNo(current.entry)).padStart(3, '0')}` });
  } else {
    current = null;
    skipped.push({ file: entry.localPath, reason: parsed.kind === 'continuation' ? 'orphan continuation page' : parsed.kind === 'error' ? `parse error: ${parsed.text}` : 'not a recipe (meal plan, shopping list, intro)', text: parsed.text?.slice(0, 200) });
  }
}

const recipes = [];
const photoWidths = [];
for (const d of drafts) {
  const { entry } = d;
  const page = pageNo(entry);
  const c = COLLECTIONS[entry.collection] ?? { label: entry.collection };
  const servings = d.servings || 1;
  const total = (v) => (v == null ? null : round1(v * servings));
  const sourceKey = `${entry.collection}/${String(page).padStart(3, '0')}`;
  const parsed = { ...d, perServing: d.perServing ?? {} };
  finalizeChecks(d);

  const notesAt = d.steps.indexOf(NOTES_MARKER);
  const method = notesAt === -1 ? d.steps : d.steps.slice(0, notesAt);
  const instructions = method.filter((s) => !NOTE_RE.test(s));
  const notes = [...method.filter((s) => NOTE_RE.test(s)), ...(notesAt === -1 ? [] : d.steps.slice(notesAt + 1))].filter((s) => s !== NOTES_MARKER);
  if (!d.category && entry.collection.includes('smoothie')) d.category = 'snack';
  if (!d.category) d.flags.push('category not set (no section dividers in this book)');

  let image_filename = null;
  if (parsed.photo) {
    image_filename = `${slugify(entry.collection)}-${String(page).padStart(3, '0')}-${slugify(parsed.title).slice(0, 60)}.png`;
    await writeFile(path.join(outDir, 'images', image_filename), parsed.photo.png);
    photoWidths.push(parsed.photo.width);
  } else {
    parsed.flags.push('no photo found');
  }

  recipes.push({
    // Fields consumed by the existing admin JSON importer (RecipeJson in ImportRecipesPage.tsx).
    title: parsed.title,
    description: null,
    calories: total(parsed.perServing.calories),
    protein: total(parsed.perServing.protein),
    carbs: total(parsed.perServing.carbs),
    fats: total(parsed.perServing.fat),
    prep_time: parsed.prep_time,
    cook_time: parsed.cook_time,
    servings,
    tags: c.tags ?? [],
    diet_tags: c.diet ?? [],
    health_tags: c.health ?? [],
    category: d.category,
    cuisine: null,
    coach_notes: notes.length ? notes.join('\n') : null,
    ingredients: parsed.ingredients.map((i) => i.display),
    instructions,
    image_filename,
    is_public: false,
    // Extra fields for review, dedupe and the future foods table; ignored by the current importer.
    source: { key: sourceKey, collection: c.label, page, file: entry.localPath, driveFileId: entry.fileId },
    nutrition_per_serving: parsed.perServing,
    fiber_total: total(parsed.perServing.fiber),
    sugar_total: total(parsed.perServing.sugar),
    ingredients_structured: parsed.ingredients,
    flags: parsed.flags,
  });
}

// Same recipe appearing in several collections: merge tags onto the first, flag the rest.
const byTitle = new Map();
for (const r of recipes) {
  const k = slugify(r.title);
  if (!byTitle.has(k)) byTitle.set(k, []);
  byTitle.get(k).push(r);
}
const union = (a, b) => [...new Set([...a, ...b])];
for (const group of byTitle.values()) {
  if (group.length < 2) continue;
  const [first] = group;
  for (const r of group.slice(1)) {
    const same = r.calories === first.calories && r.servings === first.servings && r.ingredients.length === first.ingredients.length;
    if (!same) {
      // Same name, different recipe (e.g. a vegan variant): keep both, ask a human to rename.
      r.flags.push(`shares its title with ${first.source.key} but is a different recipe; consider renaming`);
      continue;
    }
    r.duplicate_of = first.source.key;
    r.flags.push(`duplicate of ${first.source.key}`);
    first.tags = union(first.tags, r.tags);
    first.diet_tags = union(first.diet_tags, r.diet_tags);
    first.health_tags = union(first.health_tags, r.health_tags);
    (first.also_in ??= []).push(r.source.collection);
  }
}

const csvCell = (v) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const columns = [
  ['source_key', (r) => r.source.key],
  ['collection', (r) => r.source.collection],
  ['title', (r) => r.title],
  ['servings', (r) => r.servings],
  ['prep_min', (r) => r.prep_time],
  ['cook_min', (r) => r.cook_time],
  ['kcal_per_serving', (r) => r.nutrition_per_serving.calories],
  ['protein_g_per_serving', (r) => r.nutrition_per_serving.protein],
  ['carbs_g_per_serving', (r) => r.nutrition_per_serving.carbs],
  ['fat_g_per_serving', (r) => r.nutrition_per_serving.fat],
  ['kcal_total', (r) => r.calories],
  ['ingredient_count', (r) => r.ingredients.length],
  ['step_count', (r) => r.instructions.length],
  ['tags', (r) => r.tags],
  ['diet_tags', (r) => r.diet_tags],
  ['health_tags', (r) => r.health_tags],
  ['category', (r) => r.category],
  ['has_photo', (r) => (r.image_filename ? 'yes' : 'no')],
  ['duplicate_of', (r) => r.duplicate_of ?? ''],
  ['flags', (r) => r.flags],
  ['approved', () => ''],
  ['reviewer_notes', () => ''],
  ['ingredients', (r) => r.ingredients],
  ['instructions', (r) => r.instructions],
];
const csv = [columns.map(([h]) => h).join(','), ...recipes.map((r) => columns.map(([, f]) => csvCell(f(r))).join(','))].join('\n');

await writeFile(path.join(outDir, 'recipes.json'), JSON.stringify(recipes, null, 2));
// Import-ready file: unique recipes only, without the review-only fields.
const importable = recipes
  .filter((r) => !r.duplicate_of)
  .map(({ source, nutrition_per_serving, fiber_total, sugar_total, ingredients_structured, flags, duplicate_of, also_in, ...rest }) => rest);
await writeFile(path.join(outDir, 'recipes.import.json'), JSON.stringify(importable, null, 2));
await writeFile(path.join(outDir, 'review.csv'), '﻿' + csv);
await writeFile(path.join(outDir, 'skipped.json'), JSON.stringify(skipped, null, 2));

const flagged = recipes.filter((r) => r.flags.length).length;
console.log(`parsed ${recipes.length} recipes (${importable.length} unique), skipped ${skipped.length}, flagged ${flagged}`);
console.log(`photos: ${recipes.filter((r) => r.image_filename).length}/${recipes.length}, width ${Math.min(...photoWidths)}-${Math.max(...photoWidths)}px (source thumbnails are low-res)`);
console.log(`output: ${path.resolve(outDir)}`);
