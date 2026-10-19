let csrf = '';
let sessionPromise:Promise<void>|null = null;
export async function api<T>(path:string, init:RequestInit = {}, adminKey?:string):Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type','application/json');
  if (csrf) headers.set('X-CSRF-Token',csrf);
  if (adminKey) headers.set('X-Admin-Key',adminKey);
  const response = await fetch(`/api${path}`, {...init, headers, credentials:'include'});
  if (!response.ok) {
    const payload = await response.json().catch(()=>null);
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}
export function startSession() {
  if (!sessionPromise) sessionPromise = api<{csrf_token:string}>('/session').then(session=>{csrf=session.csrf_token;}).catch(error=>{sessionPromise=null;throw error;});
  return sessionPromise;
}
export function validateFile(file:File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size > 10 * 1024 * 1024) return 'Your image must be smaller than 10 MiB.';
  if (!file.size) return 'This image is empty. Choose another file.';
  return null;
}
