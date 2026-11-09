const storageKey = "query-auth-conversation-return";
const conversationPath = /^\/search\/[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\/?(?:\?[^#]*)?$/i;

export function validConversationReturn(value: string | null): string | null {
  return value && conversationPath.test(value) ? value : null;
}

export function rememberConversationReturn(value: string | null) {
  const destination = validConversationReturn(value);
  try {
    if (destination) window.sessionStorage.setItem(storageKey, destination);
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    // Sign-in still works if tab storage is unavailable.
  }
}

export function pendingConversationReturn(): string | null {
  try {
    return validConversationReturn(window.sessionStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
