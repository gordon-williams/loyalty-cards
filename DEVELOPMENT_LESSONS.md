# Development Lessons - Loyalty Cards PWA

This document captures lessons learned during development. Future AI assistants should read this to avoid repeating mistakes.

## CSS Animation Pitfalls

### Transform Does NOT Affect Layout Flow

**Problem**: When animating cards with `transform: translateY()`, the cards visually move but still occupy their original layout space. Other elements don't reflow around them.

**Example failure**: Tried to move a selected card to the top by calculating `translateY(-Npx)` based on the difference between its position and the first card's position. The calculation was correct, but the card didn't visually move to the right place because the cards above it (even though they were transformed off-screen) still occupied layout space.

**Solution**: Use `position: absolute` to take the selected card out of the document flow entirely. Then position it with `top`, `left`, `right` properties.

### Debugging Animations Without a Console

**Problem**: iOS Safari in the Simulator doesn't have an easily accessible console. Claude cannot "watch" animations - it can only see static frames.

**Solutions used**:
1. User recorded video in iOS Simulator, saved as .mov file
2. Used ffmpeg to extract frames: `ffmpeg -i video.mov -vf fps=10 frames/frame_%03d.jpg`
3. Claude analyzed individual frames to understand animation behavior
4. Added visible debug info directly on the page (a red box showing calculated values)

### Staggered Animations Need Pre-hiding

**Problem**: When creating multiple elements that animate in with staggered timing, all elements briefly appear at once before their individual animations start.

**Solution**: Add a `pre-animate` class that positions elements off-screen (`transform: translateY(-100%)`), then remove it when each element's turn comes to animate.

```css
.loyalty-card.pre-animate {
    transform: translateY(-100%);
}

.loyalty-card.animate-in {
    animation: slideIn 0.25s ease-out forwards;
}
```

### Timing: Remove Elements Before Re-rendering

**Problem**: When fading out a selected card and then re-rendering all cards, the old card briefly appears as a "ghost" because `innerHTML = ''` doesn't immediately remove absolutely-positioned elements visually.

**Solution**: Explicitly `element.remove()` the old card after fade-out completes, THEN call renderCards().

## Animation Design Principles

### "Cards are solid objects"

User insight: Cards should move (slide) but not fade/materialise. Fading looks unnatural for physical objects like cards. Exception: the selected card fades in at its new position because it can't smoothly animate from its stacked position.

### Simplify When Fighting CSS

If an animation requires complex calculations and keeps failing, step back and simplify:

**Complex approach (failed)**: Calculate exact pixel offset to move selected card while other cards animate around it.

**Simple approach (worked)**:
1. Slide ALL cards off-screen
2. Wait for animation to complete
3. Fade in selected card at fixed position (position: absolute, top: 20px)
4. On deselect: fade out card, then re-render all cards with staggered slide-in

## Current Animation Timings (v20)

- Card slide-away: 0.4s ease-out
- Card slide-in: 0.25s ease-out
- Stagger delay between cards: 50ms
- Selected card fade-in: 0.3s
- Selected card fade-out: 0.3s

## Testing Approach

1. User records video in iOS Simulator
2. Save to `GitIgnore/` folder (not committed)
3. Extract frames with ffmpeg
4. Claude analyzes frames to see what's actually happening
5. Add visible version number to UI (`v20` etc.) to confirm correct version is deployed

## File Structure Notes

- `style.css?v=N` and `app.js?v=N` - cache busters in index.html
- Version number shown in header: `<span style="font-size:12px;opacity:0.5">v20</span>`
- GitIgnore folder for test videos and extracted frames
