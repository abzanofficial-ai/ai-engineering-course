// Runs before first paint to apply the saved theme without a flash (design-system §1).
// Kept tiny and static so its CSP hash never changes at runtime.
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}document.documentElement.classList.add("js")`;
