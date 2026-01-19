---
paths:
  - "frontend/**/*.js"
  - "frontend/**/*.html"
  - "frontend/**/*.css"
---

# Frontend Development Rules

## Security
- Always use `escapeHtml()` for user-provided content displayed in HTML
- Never use innerHTML with unsanitized user input

## UI Patterns

### Notifications
```javascript
showToast('Success message');
showToast('Error message', true);  // isError = true
```

### API Calls
```javascript
// Use the API client functions
const data = await visitorApi.signIn({
  firstName,
  lastName,
  reasonId,
  reasonName
});
```

## PWA Considerations
- Update service worker cache version (CACHE_NAME) when making changes
- Test offline functionality after changes
- Ensure touch-friendly UI for kiosk/tablet use

## Kiosk Mode Best Practices
- Large touch targets (min 44px)
- Clear visual feedback on tap
- Auto-reset forms after actions
- Countdown timers for screen transitions

## Existing Patterns
- Check existing code for similar functionality before creating new patterns
- Follow naming conventions already in use
- Use existing CSS classes before creating new ones
