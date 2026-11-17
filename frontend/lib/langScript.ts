// No React here: the root layout (a server component) puts this script in the page.
export const LANG_KEY = "lang";

/** Run before first paint, so a returning Kinyarwanda reader does not see the switch flip. */
export const LANG_SCRIPT = `try{if(localStorage.getItem("${LANG_KEY}")==="rw"){document.documentElement.dataset.lang="rw";document.documentElement.lang="rw"}}catch(e){}`;
