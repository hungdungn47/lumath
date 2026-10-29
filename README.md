# ✦ Lumath

**Math, lit up.** Lumath is a growing set of animated visualizers for high-school math problems, the kind that are hard to picture in your head.

The first module, **Intervals & sets** (*Khoảng & tập hợp*), handles "find all **m**" problems like:

> Given A = [m − 1; m + 3] and B = (−1; 5). Find all m such that A ∩ B ≠ ∅.

Drag m and watch A slide along the number line. The overlap with B glows, and an m-axis below paints itself green where the condition holds and red where it fails. When you're ready, reveal the answer or play an animated step-by-step solution.

**Live:** https://lumath.vercel.app

> 🇻🇳 **Lumath: Toán học, thắp sáng.** Bộ công cụ trực quan hóa các bài toán THPT. Phần đầu tiên dành cho các bài toán "tìm m" về khoảng, đoạn, giao, hợp và tập con. Giao diện mặc định là tiếng Việt; bấm **EN | VI** ở góc trên bên phải để đổi ngôn ngữ.

## Features

- **Four question types:** A ∩ B ≠ ∅ (overlap), A ∩ B = ∅ (no overlap), A ⊂ B, B ⊂ A.
- **Any linear endpoints:** `m-1`, `2m+1`, `-m`, `m/2`, `(1/2)m`, plain numbers, `-inf` / `+inf`. B may depend on m too.
- **Open and closed ends:** click a bracket to toggle `[` ↔ `(`. The solver decides `<` vs `≤` from the brackets and explains why.
- **Explore mode:** slide m or press ▶ Play; the m-axis records which values worked.
- **Reveal / Walkthrough:** each condition appears as its own track on the m-axis so you can see them combine (AND = intersection, OR = union) into the answer. The walkthrough moves m to every boundary value.
- **Validity checks:** when an endpoint like `2m+1` lets the set shrink to nothing, a condition "V" is added requiring the set to be non-empty, and the picture shows when it is empty.
- **Live step cards:** every inequality is shown solved (`m − 1 < 5 ⇔ m < 6`), with ✓/✗ for the current m. Hover to highlight it on the picture, click to jump there.
- **Vietnamese and English:** Vietnamese by default; the choice is remembered per browser.
- **Light, dark or match system:** follows your device's setting by default and switches live when it changes. Your choice is remembered, and switching plays a circular reveal from the button.
- A starfield background (soft floating dust in light mode), particle bursts and glowing effects. With `prefers-reduced-motion` on, the stars stop drifting and the page animations are switched off.

Keyboard: `Space` play/pause, `←` `→` nudge m (hold `Shift` for bigger steps), `R` reveal the answer.

## Running it

No install and no build step: plain HTML, CSS and JavaScript.

- Open `index.html` directly in a browser, or
- serve the folder with any static server, e.g. `python3 -m http.server`.

Fonts load from Google Fonts; without a connection the page falls back to system fonts.

## How the solver works

Each relation reduces to comparisons between endpoints, and each comparison is a linear inequality in m. With A = [a₁; a₂] and B = [b₁; b₂] (brackets may be open or closed):

| Question | Condition | Combine | `≤` instead of `<` when… |
|---|---|---|---|
| A ∩ B ≠ ∅ | a₁ ? b₂ and b₁ ? a₂ | AND | both compared ends are closed |
| A ∩ B = ∅ | a₂ ? b₁ or b₂ ? a₁ | OR | at least one compared end is open |
| A ⊂ B | b₁ ? a₁ and a₂ ? b₂ | AND | B's end is closed, or A's end is open |
| B ⊂ A | a₁ ? b₁ and b₂ ? a₂ | AND | A's end is closed, or B's end is open |

Any set whose endpoints move at different rates also gets the validity condition left end ≤ right end (`<` if a bracket is open). Each inequality is solved exactly, flipping the sign when dividing by a negative, and the results are combined with interval-set intersection and union. Answers are shown as fractions, e.g. `m ∈ (−7/2; 6]`.

## Project structure

```
index.html          page layout
css/style.css       styles
js/theme.js         light / dark / system theme, loaded in <head> to avoid a flash
js/i18n.js          English + Vietnamese dictionaries, t(key, params)
js/solver.js        parsing, inequality solving, interval-set algebra (also runs in Node)
js/scene.js         canvas drawing: number line, m-axis tracks, particles
js/background.js    animated starfield behind the page
js/app.js           UI: problem builder, slider, play, walkthrough, step cards
tests/              Node tests for the solver and translations
```

## Tests

```bash
node tests/solver.test.js   # 15 problems with known answers, plus parser checks
node tests/i18n.test.js     # dictionaries match, every used key exists, Vietnamese output
```

## Adding a language

Add a new block next to `en` and `vi` in `js/i18n.js` and a button for it in the `#lang` switch in `index.html`. Any key you leave out falls back to English. `tests/i18n.test.js` currently compares only `en` and `vi`, so add the new language to its key check. (The sliding highlight needs a position rule for a third button, like the ones for `.switch-thumb` in `css/style.css`.)
