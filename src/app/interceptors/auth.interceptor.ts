import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { API_URL } from '../config/api.config';

function isPublicAuthRequest(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes(`${API_URL.toLowerCase()}/auth/login`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/google`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/google-config`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/register`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/verify-email`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/resend-verification`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/forgot-password`) ||
    u.includes(`${API_URL.toLowerCase()}/auth/reset-password`)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const token = authService.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const url = req.url.toLowerCase();
      const isSessionProbe = url.includes('/auth/me');
      if (err.status === 401 && !isPublicAuthRequest(req.url) && !isSessionProbe) {
        authService.handleUnauthorized();
      }
      return throwError(() => err);
    })
  );
};
