// This generates the inline script string for pre-hydration theme resolution.
// It runs BEFORE React hydrates, preventing flash of wrong theme.
//
// Resolution order:
// 1. Valid localStorage value ("light" or "dark") → use it
// 2. Invalid/missing localStorage → check system preference (prefers-color-scheme)
// 3. No system preference available → fallback to "light"
//
// Side effects (all synchronous, before first paint):
// - Sets html[data-theme] attribute
// - Sets document.documentElement.style.colorScheme
// - Writes resolved theme to localStorage (so next visit is instant)

export function getThemeBootstrapScript(): string {
  return '(function(){try{var s=localStorage.getItem("theme");if(s!=="light"&&s!=="dark"){s=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.dataset.theme=s;document.documentElement.style.colorScheme=s;localStorage.setItem("theme",s)}catch(e){document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light"}})()';
}
