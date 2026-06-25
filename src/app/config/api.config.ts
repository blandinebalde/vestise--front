/**
 * URL de base de l'API backend. Utilisée par tous les services.
 * Pour les images (annonces, profil, etc.) : API_BASE_URL + chemin relatif.
 */
export const API_URL = 'http://localhost:9090/api';
export const API_BASE_URL = 'http://localhost:9090';

/** URL complète pour afficher une image (annonce, profil). */
export function imageUrlFor(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  let p = path.startsWith('/') ? path.slice(1) : path;
  // Chemins legacy ou absolus depuis le dossier uploads
  if (p.startsWith('uploads/images/')) {
    p = p.slice('uploads/images/'.length);
  } else if (p.startsWith('uploads/')) {
    p = p.slice('uploads/'.length);
  }
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : API_BASE_URL + '/';
  return base + p;
}
