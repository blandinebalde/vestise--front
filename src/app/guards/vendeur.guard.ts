import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Réservé aux vendeurs et administrateurs (publication d'annonces, achat de crédits). */
export const vendeurGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return authService.ensureValidSession().pipe(
    map((valid) => {
      if (!valid) {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
      if (!authService.isVendeur()) {
        router.navigate(['/dashboard']);
        return false;
      }
      return true;
    })
  );
};
