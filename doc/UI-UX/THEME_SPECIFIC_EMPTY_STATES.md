# Theme-Specific Empty States

## Goal
Every major empty state should share one structure:

1. eyebrow
2. icon
3. title
4. supporting copy
5. one clear action

The structure stays the same across the app. The atmosphere changes with:

- screen purpose
- day vs night theme

## Shared Rule
- background carries the mood
- card stays readable
- copy is calm and direct
- only one primary action is shown inside the empty state

## Screen States

### Discovery
- Kind: `discovery`
- Mood: paused momentum
- Night: cosmic, luminous, slightly adventurous
- Day: bright sky, gentle gold warmth
- Action: `Refresh feed`

### Matches
- Kind: `matches`
- Mood: hopeful, waiting for mutual alignment
- Night: warmer glow with romantic undertone
- Day: soft blush and sunlight warmth
- Action: `Go to Discover`

### Chat
- Kind: `chat`
- Mood: quiet, intimate, invitation to begin
- Night: moonlit and private
- Day: airy and calm
- Action:
  - conversation list: `View matches`
  - empty thread: `Send a hello`

### Kundali
- Kind: `kundali`
- Mood: mystical but practical
- Night: strongest celestial treatment after landing
- Day: soft gold and sky clarity
- Action: `Open birth details`

### Notifications
- Kind: `notifications`
- Mood: calm, informational, not alarming
- Night: cool and hushed
- Day: light, airy, unobtrusive
- Action: `Explore people`

## Interaction Notes
- empty states should not feel like errors unless the system is genuinely failing
- missing data should feel recoverable
- action labels should be short and specific
- empty states should sit comfortably on mobile without pushing content off-screen
