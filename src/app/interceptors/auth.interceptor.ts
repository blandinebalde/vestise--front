import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  // Récupérer le token depuis le service ou localStorage
  const token = authService.getToken() || localStorage.getItem('token');
  
  // Ajouter le header Authorization si un token est présent
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedRequest);
  }
  
  // Si pas de token, continuer sans modification
  return next(req);
};
