# Block Blast -- Master Recreation Spec

**Developer:** Hungry Studio (Chinese studio)
**Release:** 2021 (scaled through 2024-2025)
**Platforms:** iOS, Android
**Scale:** ~70M DAU, 300M+ MAU, 222M+ downloads, ~$1M/day ad revenue
**Latest known version:** 6.8.1 (iOS, as of 2026-02-17)
**Last Google Play update:** 2026-02-13

> **Critical context:** Hungry Studio runs **10,000+ A/B experiments per year** across gameplay, progression, and UX. This means scoring formulas, combo rules, piece generation, and difficulty curves may differ by platform, build, region, and time. Any recreation should treat scoring and RNG parameters as **runtime-configurable**, not hardcoded constants.

---

## Confidence Model

| Tag | Meaning |
|-----|---------|
| **[VERIFIED]** | Confirmed across multiple independent sources, official listings, or open-source reimplementation code |
| **[LIKELY]** | Consistent across independent player reports or 1-2 credible analytical sources |
| **[UNCERTAIN]** | Single-source, conflicting information, or plausible but unverifiable |
| **[UNKNOWN]** | No reliable data found |

---

## 1. CORE MECHANICS

### 1.1 Grid

| Property | Value | Confidence |
|----------|-------|------------|
| Grid size | 8x8 (64 cells) | [VERIFIED] -- Google Play + App Store descriptions, all reimplementations |
| Orientation | Standard rows (horizontal) + columns (vertical) | [VERIFIED] |
| Background | Dark/deep color for block contrast | [VERIFIED] |
| Grid lines | Subtle, low-contrast | [VERIFIED] |

### 1.2 Gravity Model

**[VERIFIED] There is NO gravity.** This is the defining mechanical distinction from Tetris.

- When a line clears, destroyed cells become empty
- Remaining blocks stay **exactly where they were placed**
- Blocks above a cleared row do NOT fall down
- Blocks beside a cleared column do NOT shift sideways
- A 1x1 hole surrounded by filled cells is permanently wasted space unless filled with a 1x1 single block
- There are **no cascade/chain reactions** -- only simultaneous multi-line clears from a single placement

Confirmed via two independent open-source reimplementations: `clear_lines` functions set cleared cells to null with zero gravity/shift logic.

**Warning:** Some SEO guides describe "chain reactions where blocks fall into place." These describe a **different game** (a match-3 color variant also called "Block Blast"), NOT the Hungry Studio 8x8 placement game.

### 1.3 Block Placement Rules

| Rule | Detail | Confidence |
|------|--------|------------|
| Input method | Drag-and-drop from tray to grid | [VERIFIED] |
| Rotation | **Blocks CANNOT be rotated by the player** | [VERIFIED] |
| Placement constraint | Must fit within 8x8 bounds, no overlapping occupied cells | [VERIFIED] |
| Adjacency requirement | **None** -- pieces can be placed anywhere with open space | [VERIFIED] |
| Permanence | Placement is immediate and irreversible -- no undo exists | [VERIFIED] |
| Atomicity | Entire piece placed at once -- no partial placement | [VERIFIED] |
| Grid snapping | Pieces snap to nearest valid grid position | [VERIFIED] |

Source code validation:
```python
def can_place_shape(self, shape, row, col):
    size = [len(shape.form), len(shape.form[0])]
    if row < 0 or col < 0 or row + size[0] > 8 or col + size[1] > 8:
        return False
    for i in range(size[0]):
        for j in range(size[1]):
            if shape.form[i][j] and self.grid[row + i][col + j]:
                return False
    return True
```

### 1.4 Line Clearing

- When an **entire row** (8/8 cells filled) is completed, that row clears instantly
- When an **entire column** (8/8 cells filled) is completed, that column clears instantly
- Multiple rows AND columns can clear simultaneously from a single placement
- Clearing is checked immediately after every piece placement
- Rows and columns are cleared atomically -- if a placement completes row 3, row 7, and column 5 simultaneously, all three clear at once

### 1.5 Piece Queue System

| Property | Value | Confidence |
|----------|-------|------------|
| Pieces per batch | 3 | [VERIFIED] |
| Visibility | All 3 visible simultaneously in bottom tray | [VERIFIED] |
| Placement order | Player chooses any order | [VERIFIED] |
| Skipping | Not allowed -- all 3 must be placed before new batch | [VERIFIED] |
| New batch trigger | Only after all 3 current pieces are placed | [VERIFIED] |
| Piece colors | Random from palette (cosmetic only, no matching mechanic) | [VERIFIED] |

### 1.6 Game Over Condition

**[VERIFIED]** The game ends when **none of the three current pieces can be placed anywhere on the grid.**

```python
def check_game_over(self) -> bool:
    for piece in self.next_pieces:
        if piece is None:
            continue
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                if self.can_place_piece(piece, x, y):
                    return False
    return True
```

Key implications:
- Empty space does NOT prevent game over if shapes don't fit available gaps
- The check runs after each placement and when a new batch of 3 is generated
- If a new batch is generated and none of the 3 fit, the game ends immediately

---

## 2. BLOCK SHAPES

### 2.1 Pre-rotation System

**[VERIFIED]** The player cannot rotate pieces, but the game **pre-rotates** each shape before offering it. An L-shape might appear pointing up, down, left, or right. The orientation is fixed once offered.

Source code confirms: each shape in the `FORMS` array includes multiple rotation variants, and one is randomly selected at generation time.

### 2.2 Complete Shape Catalog

From two independent open-source reimplementations -- **13 confirmed base shape types**:

| # | Shape | Bounding Box | Cells | Visual Pattern | Rotation Variants |
|---|-------|-------------|-------|----------------|-------------------|
| 1 | Single block | 1x1 | 1 | `X` | 1 |
| 2 | Domino | 1x2 | 2 | `XX` | 2 (H/V) |
| 3 | Tromino line | 1x3 | 3 | `XXX` | 2 (H/V) |
| 4 | Small corner | 2x2 | 3 | `X.` / `XX` | 4 rotations |
| 5 | Tetromino line | 1x4 | 4 | `XXXX` | 2 (H/V) |
| 6 | Small L-shape | 2x3 | 4 | `XXX` / `X..` | 8 (rot + mirror) |
| 7 | T-shape | 2x3 | 4 | `.X.` / `XXX` | 4 rotations |
| 8 | Z/S Zigzag | 2x3 | 4 | `.XX` / `XX.` | 4 variants |
| 9 | 2x2 Square | 2x2 | 4 | `XX` / `XX` | 1 (symmetric) |
| 10 | Pentomino line | 1x5 | 5 | `XXXXX` | 2 (H/V) |
| 11 | Big L-shape | 3x3 | 5 | `XXX` / `X..` / `X..` | 4 rotations |
| 12 | Rectangle | 2x3 | 6 | Full 2x3 | 2 (H/V) |
| 13 | 3x3 Square | 3x3 | 9 | Full 3x3 | 1 (symmetric) |

### 2.3 Additional Shapes (Secondary Source Only)

Found in one reimplementation but not the other -- may be clone additions:

| Shape | Bounding Box | Cells | Confidence |
|-------|-------------|-------|------------|
| 4x2 Rectangle | 4x2 | 8 | [UNCERTAIN] |
| Diagonal 2x2 | 2x2 | 2 | [UNCERTAIN] |
| Diagonal 3x3 | 3x3 | 3 | [UNCERTAIN] |

**[LIKELY]** The commonly cited "19 unique shapes" figure counts certain rotation variants as distinct shapes. The 13 base types with all rotation/mirror variants expand to roughly 19-22 distinct orientations.

### 2.4 "Big Three" Threat Pieces

These shapes most frequently cause game over due to their footprint:

1. **3x3 Square** (9 cells) -- requires a clean 3x3 open area. Largest piece.
2. **Big L-shape** (5 cells in 3x3 bounding box) -- awkward non-rectangular footprint
3. **Pentomino line** (5 cells in 1x5) -- requires 5 consecutive empty cells in a row or column

---

## 3. SCORING SYSTEM

### 3.1 Critical Caveat

**Hungry Studio does NOT publish scoring formulas.** Official store copy markets "combos", "streaks", and "massive scores" but provides zero numeric detail. Given their 10,000+ annual A/B experiments, scoring behavior likely varies by platform, build, and cohort.

**Recommendation:** Implement scoring as a **configurable engine** with runtime-switchable formulas and coefficients. Do not hardcode any scoring values.

### 3.2 Base Scoring -- Two Competing Interpretations

| Model | Formula | Row Clear Value | Source Quality |
|-------|---------|----------------|----------------|
| **Model A: Per-block** | 10 points per block destroyed | 8 blocks x 10 = **80 points** | Multiple guide sites + reimplementation code |
| **Model B: Per-line** | 10 points per line cleared | 1 line = **10 points** | Some fan guides |

**[LIKELY]** Model A (10 per block, 80 per row) is more widely reported and consistent with observed high scores. Model B may describe a variant or earlier version.

**[UNCERTAIN]** Whether placing a piece (without clearing) awards any points. One source mentions `placement_points = cells_in_piece`. Others only count cleared blocks.

### 3.3 Simultaneous Multi-Line Clear Bonus

When clearing multiple lines with a single placement, a flat bonus is added:

| Lines Cleared | Bonus | Confidence |
|---------------|-------|------------|
| 1 | +20 | [LIKELY] |
| 2 | +30 | [LIKELY] |
| 3 | +40 | [LIKELY] |
| 4 | +50 | [LIKELY] |
| 5 | +60 | [LIKELY] |
| 6 | +70 | [LIKELY] |
| 7 | +80 | [LIKELY] |
| 8 | +90 | [LIKELY] |
| 9 | +100 | [LIKELY] |

Pattern: **+20 base, then +10 per additional line**, capping at +100 for 9 lines.

Alternative formula representation: `combo_bonus = 20 + 10 * max(lines_cleared - 1, 0)`

**Worked example** (using Model A): Clearing 2 rows simultaneously = 16 blocks x 10 = 160 base + 30 combo bonus = **190 points** (before streak multiplier).

### 3.4 Streak / Combo Multiplier

This is the primary high-score driver and the least well-documented mechanic.

**How it works [LIKELY]:**
- Clearing at least one line increments the streak counter
- The streak resets when you fail to clear within the **combo window**

**Combo window -- two competing models:**

| Model | Rule | Source |
|-------|------|--------|
| **Per-placement** | Must clear on every individual piece placement | Single guide site |
| **Per-3-placement window** | Must clear at least once within each batch of 3 placements | Multiple Reddit discussions, community consensus |

**[LIKELY]** The 3-placement window model is more widely reported by actual players. The streak breaks if you place all 3 pieces in a batch without clearing a single line.

**[UNCERTAIN]** Android and iOS may use different window rules. Some Reddit users report platform-specific differences. Given Hungry Studio's A/B testing volume, this is plausible.

**Multiplier formula candidate** (from one detailed source):

```
score = base_points * (1 + streak_count * 0.5)
```

| Streak Count | Multiplier |
|-------------|------------|
| 0 (first clear) | 1.0x |
| 1 | 1.5x |
| 2 | 2.0x |
| 3 | 2.5x |
| 4 | 3.0x |
| 5 | 3.5x |
| 6 | 4.0x |
| ... | +0.5x per level |
| 14 | 8.0x (reported max) |

**Confidence: LOW-MEDIUM.** This formula is from a single source. One other source mentions a patch changing the cap from 2.5x to 3.0x for combos over 5, suggesting Hungry Studio actively modifies these values.

### 3.5 Special Bonuses

| Bonus | Trigger | Value | Confidence |
|-------|---------|-------|------------|
| Board clear | Empty the entire 8x8 grid | Unknown flat bonus | [VERIFIED exists, UNKNOWN value] |
| Multi-line premium | Clear 3+ lines at once | ~3-4x more than equivalent sequential clears | [LIKELY] |

### 3.6 Multiplier Stacking Order

| Component | Type | Confidence |
|-----------|------|------------|
| Base block points (10/block) | Foundation | [LIKELY] |
| Simultaneous line bonus (+20 to +100) | Flat additive | [LIKELY] |
| Streak multiplier (1.0x to 8.0x) | Multiplicative | [LIKELY] |

**[UNKNOWN]** Whether the line bonus is applied before or after the streak multiplier. This changes the math significantly at high streaks.

### 3.7 Recommended Configurable Scoring Engine

Given the unknowns, implement all coefficients as tunable parameters:

```
CONFIG = {
    "points_per_block_cleared": 10,        # or 0 if per-line model
    "points_per_line_cleared": 0,          # or 10 if per-line model
    "placement_points_per_cell": 0,        # or 1 if placement awards points
    "combo_base_bonus": 20,
    "combo_bonus_per_extra_line": 10,
    "combo_bonus_cap": 100,
    "streak_multiplier_base": 1.0,
    "streak_multiplier_increment": 0.5,
    "streak_multiplier_cap": 8.0,
    "combo_window_placements": 3,          # placements before streak resets
    "board_clear_bonus": 0,                # unknown, set when measured
    "streak_bonus_applies_to": "base+combo" # or "base_only"
}
```

### 3.8 Score Benchmarks (Community Data)

| Score | Rating | Confidence |
|-------|--------|------------|
| 10,000+ | Solid | [LIKELY] |
| 50,000+ | Competitive | [LIKELY] |
| 100,000+ | Top-tier | [LIKELY] |
| 500,000+ | World-record territory | [UNCERTAIN] |

---

## 4. PIECE GENERATION AND DIFFICULTY

### 4.1 What's Confirmed

- Pieces are selected from the fixed pool of ~13 base shape types with pre-applied rotation variants
- Each piece gets a random color from the available palette (cosmetic only)
- Pieces arrive in batches of 3; all must be placed before new batch generates

### 4.2 Adaptive Difficulty Claims

| Claim | Source Quality | Confidence |
|-------|---------------|------------|
| Algorithm analyzes board state and adjusts pieces | SEO guide sites (Playgama) | [UNCERTAIN] |
| Higher scores produce harder piece combinations | Balancy deconstruction + player reports | [LIKELY] |
| Session-length affects difficulty | SEO sites | [UNCERTAIN] |
| "God Mode": after repeated losses, ideal pieces appear | Balancy deconstruction | [LIKELY] |
| Score "walls" at specific thresholds | Player reports on Reddit | [LIKELY] |

**Assessment:** Open-source reimplementations use **pure random selection**. The Balancy professional deconstruction and persistent player reports support some adaptive element. Without proprietary code access, the exact mechanism is unverifiable.

**Recommendation for recreation:** Start with **weighted random** from the shape pool. Add toggleable safety constraints:

```
GENERATION_CONFIG = {
    "use_adaptive_difficulty": false,       # toggle for testing
    "ensure_legal_placement": true,         # at least 1 piece must fit
    "anti_hardlock_threshold": 0.15,        # free-space ratio for assist
    "difficulty_ramp_score_threshold": 5000, # when to start harder pieces
    "god_mode_consecutive_losses": 3         # losses before easy mode
}
```

### 4.3 Anti-Deadlock Rules

**[UNKNOWN]** Whether the official game guarantees at least one legal placement among the 3 offered pieces. Some player frustration posts suggest it does NOT always guarantee this (game over can be forced by the batch). Other sources suggest a soft guarantee exists. Implement as a toggle.

---

## 5. VISUAL DESIGN

### 5.1 Color System

**[VERIFIED]** Block colors are cosmetic only -- no matching mechanic.

**[VERIFIED]** Color palettes rotate based on score milestones or themes. Reported colors: blue, green, purple, orange, yellow, red/pink.

**[VERIFIED]** Score display changes color at milestones:

| Progression | Color |
|------------|-------|
| Starting | White |
| Moderate | Blue |
| Solid progress | Green |
| Higher achievement | Yellow/Gold |
| Excellent | Orange |
| Mastery | Red/Pink |

**[UNKNOWN]** Exact score thresholds for each color transition.

### 5.2 Animations

| Event | Animation | Confidence |
|-------|-----------|------------|
| Block placement | Snap-to-grid with subtle landing effect | [VERIFIED] |
| Line clear | "Blast" / explosive disappearance -- signature visual moment | [VERIFIED] |
| Multi-line clear | Escalating visual effects for bigger combos | [VERIFIED] |
| Score popups | Text callouts ("Perfect", "Excellent") | [VERIFIED] |
| Streak counter | Visible on-screen tracker | [VERIFIED] |
| Drag preview | Ghost/shadow showing where piece will land | [LIKELY] |

### 5.3 Overall Aesthetic

- **Style:** Clean flat/vector design -- not pixel art, not photorealistic
- **Background:** Dark/deep color for maximum block contrast
- **Blocks:** Bright, saturated colors that pop against dark background
- **Philosophy:** Minimalist but polished -- zero visual clutter
- **Clear feedback:** Color burst + short UI emphasis on every clear event

---

## 6. SOUND DESIGN

### 6.1 Music

**[VERIFIED]** 9 audio tracks, all short loops (source: KHInsider soundtrack rip):

| Track | Duration | Purpose |
|-------|----------|---------|
| Music 1 | 0:30 | Background loop |
| Music 2 | 0:43 | Background loop |
| Music 3 | 0:09 | Short stinger/transition |
| Music 4 | 0:29 | Background loop |
| Music 5 | 0:30 | Background loop |
| Music 6 | 0:47 | Background loop |
| Music 7 | 0:47 | Background loop |
| Music 8 | 0:57 | Background loop (longest) |
| Game Over | 0:03 | Game over sting |

**Total soundtrack:** 4 minutes 55 seconds.
**Style:** Calm, relaxing, rhythmic -- light electronic/synthesized tones. Designed to avoid pressure. Official positioning: "relaxing music effects", "rhythmic music".

### 6.2 Sound Effects

**[VERIFIED]** **349 sound effect files** in the game's audio assets (7.05 MB total, OGG format).
Source: [The Sounds Resource](https://sounds.spriters-resource.com/mobile/blockblastblockjuggle/asset/470047/)

Files use UUID filenames -- exact event-to-file mapping requires decompilation.

**Known SFX categories:**

| Event | Description | Confidence |
|-------|-------------|------------|
| Block placement | Satisfying "click" or "thud" | [VERIFIED] |
| Line clear | Explosive/satisfying burst | [VERIFIED] |
| Combo/multi-line clear | Escalating sounds for bigger combos | [VERIFIED] |
| Game over | 3-second jingle/sting | [VERIFIED] |
| UI interactions | Menu taps, button presses | [VERIFIED] |
| Streak continuation | Possible escalating tone | [LIKELY] |
| Piece pickup/drag | Possible subtle pickup sound | [UNCERTAIN] |

### 6.3 Audio Controls

**[LIKELY]** Independent toggles for: sound effects, background music, master volume. Accessed via gear icon on main menu.

### 6.4 Audio Quality Targets for Recreation

| Target | Value |
|--------|-------|
| Background music | Calm loop, low fatigue, seamless repeat |
| SFX layering | Distinct per-event -- placement, clear, combo, fail must be immediately distinguishable |
| Loudness | Mobile-safe -- no clipping, modern casual game norms |
| Interaction latency | **< 100ms perceived** from input to audio feedback |
| Escalation | Combo sounds should escalate in pitch/intensity with streak depth |

---

## 7. HAPTIC FEEDBACK

**[VERIFIED]** Part of a deliberate multi-sensory reward loop: visual + audio + haptic fire simultaneously on every action.

| Event | Pattern | Confidence |
|-------|---------|------------|
| Block placement | Subtle tap | [VERIFIED] |
| Line clear | Medium pulse | [VERIFIED] |
| Combo/multi-line | Stronger pulse | [LIKELY] |
| Game over | Distinct pattern | [LIKELY] |

**[UNKNOWN]** Exact durations, intensities, iOS Taptic Engine specs. Likely 2-3 distinct patterns given minimalist design philosophy.

---

## 8. GAME MODES

### 8.1 Classic Mode

- Endless, no time limit, no levels
- Place blocks, clear lines, chase high score
- Game ends when no piece can be placed
- One revive per session (watch rewarded ad)
- Core engagement mode

### 8.2 Adventure Mode

| Property | Detail | Confidence |
|----------|--------|------------|
| Total levels | 5,000+ | [VERIFIED] |
| Structure | Worlds/chapters | [VERIFIED] |
| Weekly rotation | 96 levels per weekly set | [VERIFIED] |
| Difficulty tiers | 1-100: tutorial; 100-1000: specials introduced; 1000+: complex | [LIKELY] |
| Objectives | Target scores, clear X rows, clear specific blocks, patterns | [VERIFIED] |
| Weekly reward | Reveals a pixelated image -- no persistent collection | [VERIFIED] |

### 8.3 Additional Features

| Feature | Detail | Confidence |
|---------|--------|------------|
| Daily Challenges | Fresh puzzles daily | [LIKELY] |
| Event Mode | Limited-time themed puzzles (seasonal/holiday) | [LIKELY] |
| Win-streak counter | Displayed on screen, no rewards attached | [VERIFIED] |
| Offline play | Fully supported | [VERIFIED] |

### 8.4 Rapid Update Cadence

**[VERIFIED]** App Store version history shows frequent minor releases. Combined with 10,000+ annual experiments, any feature list represents a point-in-time snapshot that may change.

---

## 9. UI LAYOUT

### 9.1 Gameplay Screen

```
+----------------------------------+
|  [Gear]       SCORE        [?]   |  <- Top bar
|            [Streak: 5x]          |
+----------------------------------+
|                                  |
|          8 x 8  GRID             |  <- Center (dominant element)
|     (dark bg, colored blocks,    |
|      subtle gridlines)           |
|                                  |
+----------------------------------+
| [Piece 1]  [Piece 2]  [Piece 3] |  <- Bottom tray (drag source)
+----------------------------------+
|         [Banner Ad]              |  <- Bottom ad slot
+----------------------------------+
```

### 9.2 HUD Elements

| Element | Location | Confidence |
|---------|----------|------------|
| Current score | Top center, prominent, color-changing | [VERIFIED] |
| Streak/combo counter | Near score | [VERIFIED] |
| Settings gear | Top corner | [VERIFIED] |
| 3-piece tray | Below grid | [VERIFIED] |
| Social proof messages | Occasional overlay ("You defeated 99% of players") | [VERIFIED] |
| Banner ad | Bottom of screen | [VERIFIED] |

### 9.3 Main Menu

- Start button, Settings, Leaderboard, Adventure Mode
- Clean, minimal -- near-zero onboarding friction
- Design philosophy: player understands what to do instantly

---

## 10. MONETIZATION

### 10.1 Revenue Model

**[VERIFIED]** **Ad-only.** No in-game shop. No in-app purchases.

| Ad Type | Placement | Frequency | Confidence |
|---------|-----------|-----------|------------|
| Banner ads | Bottom of screen during gameplay | Constant | [VERIFIED] |
| Interstitial ads | Between sessions/levels | Per session end | [VERIFIED] |
| Rewarded video | Game over -- watch to revive | Once per session max | [VERIFIED] |

No "Remove Ads" purchase option exists. Deliberate choice -- ongoing ad revenue from engaged players exceeds one-time removal purchase.

### 10.2 Revive System

- Game over triggers revive offer: watch 15-30 second video ad
- Watching clears some blocks from the board and continues game
- **Limited to ONE per session**
- **[UNKNOWN]** Exactly which/how many blocks are cleared by revive
- **[UNKNOWN]** Whether revive affects score tracking or leaderboard eligibility

### 10.3 Revenue Scale

| Metric | Value | Confidence |
|--------|-------|------------|
| Daily revenue | ~$1M/day | [VERIFIED] |
| Peak (Black Friday 2025) | ~$1.8M (55M DAU) | [VERIFIED] |
| Ad partner | Google AdMob | [VERIFIED] |

---

## 11. POWER-UPS / BOOSTERS

### 11.1 Critical Finding

**[VERIFIED]** The official Hungry Studio Block Blast has a deliberately **minimal feature set**:
- **No power-up shop**
- **No purchasable boosters**
- **No undo button**
- Only aid is the one-time-per-session ad-revive

Source: Balancy professional game deconstruction (which explicitly recommended adding a rewarded Undo -- implying it doesn't exist) and Gamigion revenue analysis.

### 11.2 SEO Content Discrepancy

Multiple third-party sites describe elaborate power-ups (Color Bombs, Line Blasters, Area Bombs, Rainbow Blasts, Super Bombs). These describe either:
- Clone/copycat games reusing the "Block Blast" name
- Speculative SEO content
- Possible Adventure Mode-only mechanics

**Recommendation:** Do not implement power-ups for Classic Mode recreation. Verify against the live app before implementing for Adventure Mode.

### 11.3 Hidden Mechanics

**[LIKELY]** "God Mode" -- after multiple consecutive losses, the algorithm delivers ideal piece combinations. This is an invisible anti-frustration system, not a player-activated power-up.

---

## 12. SOCIAL FEATURES

| Feature | Status | Confidence |
|---------|--------|------------|
| Global leaderboard | Exists | [VERIFIED] |
| Friends leaderboard | Exists | [VERIFIED] |
| Social proof messaging ("You defeated 99%") | Exists | [VERIFIED] |
| Score sharing to social media | Exists | [VERIFIED] |
| Account sync (Play Games / Game Center) | Exists | [VERIFIED] |
| Real-time multiplayer | **Does NOT exist** | [VERIFIED] |
| Friend challenges | **Does NOT exist** | [VERIFIED] |
| Head-to-head | **Does NOT exist** | [VERIFIED] |
| Robust anti-cheat | **Does NOT exist** | [VERIFIED] |

---

## 13. STRATEGIC DEPTH

### 13.1 Core Concepts

1. **Edge/perimeter building** -- Build from edges inward, keep center flexible
2. **Batch planning** -- Think about all 3 pieces, not just the current one
3. **Streak maintenance** -- Consecutive clears are exponentially more valuable; pressure to clear every batch
4. **Hole avoidance** -- Without gravity, isolated holes are permanent death traps
5. **Shape awareness** -- Know which shapes rescue difficult boards (1x1 is the universal gap-filler)
6. **Placement order optimization** -- Which of the 3 pieces to place first changes outcomes dramatically

### 13.2 The Core Tension

Depth emerges from the interaction of four constraints:
- No rotation → must plan around fixed orientations
- No gravity → holes are permanent
- Batch-of-3 → must accommodate all 3, not just the convenient one
- Streak incentive → pressure to clear every batch even when strategically costly

---

## 14. IMPLEMENTATION DATA MODEL

### 14.1 Core State

```
board[8][8]              # cell occupancy (null = empty, color_id = filled)
active_set[3]            # current 3 pieces (null = already placed)
score_total              # running score
combo_count              # current streak depth
moves_since_last_clear   # placements since last line clear (for combo window)
pieces_placed_in_batch   # 0-3 counter within current batch
mode                     # classic | adventure | daily
revive_used              # boolean
build_variant_id         # for A/B experiment tracking
```

### 14.2 Turn Pipeline

```
1. Player selects one of 3 pieces and drags to grid position
2. Validate placement (bounds + no overlap)
3. Commit cells to board (atomic)
4. Detect completed rows and columns
5. Clear completed lines (set cells to null, NO gravity pass)
6. Compute score:
   a. base_points = blocks_removed * config.points_per_block_cleared
   b. line_bonus = combo_bonus_formula(lines_cleared)
   c. streak_multiplier = 1 + (combo_count * config.streak_multiplier_increment)
   d. turn_score = (base_points + line_bonus) * min(streak_multiplier, config.streak_multiplier_cap)
   e. score_total += turn_score
7. Update combo state:
   - If lines_cleared > 0: combo_count++, moves_since_last_clear = 0
   - Else: moves_since_last_clear++
   - If moves_since_last_clear >= config.combo_window_placements: combo_count = 0
8. Mark piece as placed (active_set[i] = null), pieces_placed_in_batch++
9. If pieces_placed_in_batch == 3: generate new batch of 3, reset batch counter
10. Check game over condition
11. Fire feedback: animation + SFX + haptic (type based on event)
```

### 14.3 Piece Generation Pipeline

```
1. Select 3 shapes from pool (weighted random or adaptive)
2. For each shape, select random rotation variant from its variant set
3. Assign random cosmetic color from current palette
4. If config.ensure_legal_placement:
   - Verify at least 1 of the 3 can be placed on current board
   - If not, re-roll (up to N attempts, then accept -- true deadlock is rare)
5. Present batch to player
```

---

## 15. QUALITY SCORECARD

### 15.1 Performance Targets

| Metric | Target |
|--------|--------|
| Input-to-visual latency | < 50ms on target hardware |
| Frame rate | Jank-free 60 FPS during normal gameplay |
| Audio interaction latency | < 100ms perceived |
| Crash-free sessions | > 99.5% |
| Audio glitch rate | < 0.1% of events |

### 15.2 Accuracy Grading Rubric

| Tier | Definition |
|------|------------|
| **A (near-clone)** | Score/combo parity >= 95% vs benchmark traces, same fail-state cadence, same difficulty feel |
| **B (highly similar)** | Core rules identical, score parity 80-94%, minor pacing differences |
| **C (inspired)** | Recognizable mechanics but materially different scoring/RNG dynamics |

### 15.3 Validation Method

Compare against benchmark gameplay traces:
- Score delta parity: >= 95% move-level match for target profile
- Combo state parity: >= 99% on scripted scenarios
- "One more run" retention feel without perceived unfair hardlocks

---

## 16. GAP CLOSURE: INSTRUMENTATION PLAN

To resolve remaining unknowns, record actual gameplay data using this schema:

```
{
    "timestamp_ms": int,
    "platform": "ios" | "android",
    "app_version": string,
    "mode": "classic" | "adventure" | "daily",
    "piece_id": int,
    "piece_cells": int,
    "placement_coord": [row, col],
    "lines_cleared_count": int,
    "cells_removed_count": int,
    "combo_before": int,
    "combo_after": int,
    "score_before": int,
    "score_after": int,
    "revive_state": boolean
}
```

**Process:**
1. Instrument 2 devices (iOS + Android) on same date/build
2. Record 200+ scripted turns per mode with frame-accurate video
3. OCR score after each placement and each clear
4. Fit candidate formulas via regression
5. Repeat after updates to detect A/B drift
6. Lock a target profile (e.g., "Android v6.8 classic") and ship as v1

---

## 17. CRITICAL UNKNOWNS -- COMPLETE LIST

| # | Gap | Impact | Why Unknown |
|---|-----|--------|-------------|
| 1 | **Exact scoring formula** (base, combo curve, multiplier math) | CRITICAL | Not officially published; likely A/B tested |
| 2 | **Combo reset rule** (per-placement vs per-batch vs per-3-placements) | HIGH | Conflicting reports; may differ by platform/build |
| 3 | **Streak multiplier progression** (linear 0.5x? caps? curve?) | HIGH | Single source formula; patch history suggests changes |
| 4 | **Combo bonus + streak multiplier stacking order** | HIGH | Not documented anywhere |
| 5 | **Exact piece spawn weights** | HIGH | Proprietary |
| 6 | **Adaptive difficulty algorithm details** | HIGH | Proprietary; may not exist as described |
| 7 | **Anti-deadlock generation rules** | MEDIUM | Conflicting player reports |
| 8 | **Board-clear bonus value** | MEDIUM | Confirmed to exist, value unknown |
| 9 | **Whether placement awards points** | MEDIUM | Conflicting sources |
| 10 | **Revive mechanics** (which blocks cleared, score impact) | MEDIUM | Not documented |
| 11 | **Platform-specific rule differences** (iOS vs Android) | MEDIUM | Single-source Reddit reports |
| 12 | **God Mode trigger threshold** | MEDIUM | Not documented |
| 13 | **SFX-to-event mapping** (349 UUID-named files) | MEDIUM | Requires decompilation |
| 14 | **Score color change thresholds** | LOW | Cosmetic only |
| 15 | **Exact haptic patterns/durations** | LOW | Not documented |
| 16 | **4x2 / diagonal pieces in official game** | LOW | Found in one reimplementation only |
| 17 | **Adventure Mode power-up specifics** | MEDIUM | Conflicting; may be from clones |
| 18 | **Hidden score caps / anti-exploit guards** | MEDIUM | Not documented |
| 19 | **Event mode rulesets** (seasonal/limited-time) | LOW | Vary by update |
| 20 | **Leaderboard segmentation** (by variant/build/region?) | LOW | Not documented |

---

## 18. IMPLEMENTATION PRIORITY MATRIX

### Must Be Exact

- 8x8 grid with no gravity
- 3-piece batch system (any order, all must be placed)
- No player rotation (pre-rotation at generation)
- Line clearing (full row or column, simultaneous, no cascades)
- Game over when no piece fits across all 3 current pieces
- Core 13 base shape types with rotation variants

### Should Be Close

- Scoring: configurable engine defaulting to 10pts/block + combo bonus + streak multiplier
- Combo/streak system with 3-placement window
- Multi-sensory feedback loop (visual + audio + haptic on every action)
- Drag-and-drop with grid snapping and placement ghost/preview

### Can Be Approximated

- Adaptive difficulty (start with weighted random, tune via config)
- Animation specifics (line clear blast, score popups, escalation)
- Sound design (calm electronic loops, satisfying mechanical SFX)
- Color palette rotation at score milestones

### Optional for MVP

- Adventure Mode
- Leaderboards / social features
- Daily challenges / events
- Revive system
- Power-ups
- Ad integration

---

## 19. LEGAL / IP BOUNDARY

- Recreating **game mechanics and rules** is generally permissible (game mechanics are not copyrightable in most jurisdictions)
- **Do NOT reuse:** original name, logo, music tracks, SFX assets, UI art, branded event text, or any Hungry Studio trademarks
- **Build your own:** art style, audio identity, brand name, icon, color palette
- **Avoid:** exact UI layout cloning (trade dress), asset extraction for use in your product
- This is not legal advice -- consult a lawyer for your jurisdiction

---

## 20. SOURCES

### Primary / Official-Adjacent
1. [Google Play listing](https://play.google.com/store/apps/details?id=com.block.juggle)
2. [Apple App Store listing](https://apps.apple.com/us/app/block-blast/id1617391485)
3. [APKMirror version history](https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/)
4. [Antara News -- Hungry Studio 10K experiments](https://en.antaranews.com/news/399953/block-blast-scales-to-70m-dau-as-hungry-studio-runs-over-10000-experiments-in-a-single-year)
5. [Google AdMob case study](https://admob.google.com/home/resources/hungry-studio-boosts-user-retention-revenue-with-admob/)

### Professional Game Analysis
6. [Balancy monetization deconstruction](https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/)
7. [Gamigion revenue analysis](https://www.gamigion.com/block-blast-by-hungry-studio-is-doing-1m-a-day/)
8. [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2026/1/19/from-tetris-to-block-blast-why-block-puzzles-never-stop-printing)

### Audio / Asset Sources
9. [KHInsider soundtrack rip](https://downloads.khinsider.com/game-soundtracks/album/block-blast-android-ios-mobile-online-gamerip-2022)
10. [The Sounds Resource -- 349 SFX files](https://sounds.spriters-resource.com/mobile/blockblastblockjuggle/asset/470047/)

### Open-Source Reimplementations (Code-Verified)
11. [RisticDjordje/BlockBlast-Game-AI-Agent](https://github.com/RisticDjordje/BlockBlast-Game-AI-Agent)
12. [tommyothen/BlockBlastML](https://github.com/tommyothen/BlockBlastML)

### Community Evidence (Medium Confidence)
13. [r/blockblast -- combo system changes](https://www.reddit.com/r/blockblast/comments/1l5p3yz)
14. [r/blockblast -- combo timing](https://www.reddit.com/r/blockblast/comments/1ipwrc8)
15. [r/blockblast -- Android vs iPhone](https://www.reddit.com/r/blockblast/comments/1ev07g2/android_vs_iphone_classic_mode/)
16. [r/blockblast -- strategy discussions](https://www.reddit.com/r/blockblast/comments/1gztg7s)

### Guide Sites (Low Confidence -- Cross-Check Only)
17. [blockblast.org](https://blockblast.org/)
18. [blockblastsolver.ai](https://blockblastsolver.ai/)
19. [onlineblockblastsolver.com -- score rules](https://onlineblockblastsolver.com/block-blast-score-rules/)
20. [Playgama FAQ series](https://playgama.com/blog/game-faqs/)
