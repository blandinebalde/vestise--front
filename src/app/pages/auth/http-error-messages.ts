/**
 * Extrait un message lisible renvoyé par l'API (évite d'afficher du JSON brut).
 */
function extractServerMessage(err: any): string {
  if (!err) return '';
  const body = err.error;
  if (typeof body === 'string' && body.trim()) {
    const t = body.trim();
    if (t.startsWith('{') || t.length > 500) return '';
    return t;
  }
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
    if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
    if (Array.isArray(body.errors)) {
      const parts = body.errors.map((e: any) => (typeof e === 'string' ? e : e?.defaultMessage || '')).filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    if (Array.isArray(body.messages)) {
      return body.messages.filter((m: any) => typeof m === 'string').join(' ');
    }
  }
  if (typeof err.message === 'string' && err.message !== 'Http failure response') {
    return err.message;
  }
  return '';
}

/**
 * Message utilisateur unique, en français, sans emoji.
 */
export function formatHttpErrorForUser(
  err: any,
  context?: 'login' | 'register' | 'password' | 'verify' | 'forgot'
): string {
  const status = err?.status;
  const server = extractServerMessage(err);
  const raw = (server + ' ' + (err?.message || '')).toLowerCase();

  if (status === 0 || raw.includes('network') || raw.includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau ou réessayez dans quelques instants.';
  }

  if (context === 'login' && (raw.includes("n'existe pas") || raw.includes('nexiste pas') || raw.includes('inscrivez-vous'))) {
    return server.trim() || 'Ce compte n\'existe pas. Créez un compte via la page Inscription.';
  }

  if (context === 'login' && (raw.includes('verify') || raw.includes('vérif') || raw.includes('non vérifié') || raw.includes('not verified'))) {
    return 'Votre compte doit être vérifié par e-mail avant la première connexion. Consultez votre boîte de réception et les courriers indésirables.';
  }

  if (server && server.length > 0 && server.length < 400 && !server.includes('{')) {
    return server.trim();
  }

  switch (status) {
    case 400:
      if (context === 'register') {
        return 'Les informations envoyées sont invalides. Vérifiez les champs et réessayez.';
      }
      if (context === 'forgot') {
        return 'Adresse e-mail ou numéro de téléphone non reconnu. Vérifiez la saisie.';
      }
      return 'Requête invalide. Vérifiez les informations saisies.';
    case 401:
      return context === 'login'
        ? 'E-mail ou téléphone ou mot de passe incorrect. Vérifiez vos identifiants ou réinitialisez le mot de passe.'
        : 'Authentification requise ou session expirée.';
    case 403:
      return 'Accès refusé. Votre compte ne permet pas cette action pour le moment.';
    case 404:
      if (context === 'password') {
        return 'Lien introuvable ou expiré. Demandez un nouveau lien de réinitialisation.';
      }
      if (context === 'forgot') {
        return 'Aucun compte ne correspond à cette adresse e-mail ou à ce numéro. Vérifiez vos informations ou inscrivez-vous.';
      }
      if (context === 'verify') {
        return 'Ce lien de vérification est invalide ou a expiré. Inscrivez-vous à nouveau ou demandez un nouvel e-mail d\'activation.';
      }
      return 'Ressource introuvable.';
    case 409:
      return context === 'register'
        ? 'Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.'
        : 'Conflit : cette opération ne peut pas être effectuée dans l\'état actuel.';
    case 422:
      return 'Données refusées par le serveur. Corrigez les champs indiqués et réessayez.';
    case 429:
      return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
    default:
      if (status >= 500) {
        return 'Le serveur rencontre une erreur temporaire. Réessayez dans quelques instants.';
      }
      return 'Une erreur est survenue. Réessayez ou contactez le support si le problème continue.';
  }
}
