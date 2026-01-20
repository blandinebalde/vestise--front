import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('🔵 AuthInterceptor - INTERCEPT CALLED for:', req.method, req.url);
  
  const authService = inject(AuthService);
  
  // Récupérer le token directement depuis localStorage ET via le service
  const tokenFromService = authService.getToken();
  const tokenFromStorage = localStorage.getItem('token');
  
  // Utiliser le token du service, ou celui du localStorage en fallback
  const token = tokenFromService || tokenFromStorage;
  
  // Log détaillé pour les requêtes admin/auth
  if (req.url.includes('/api/admin') || req.url.includes('/api/auth')) {
    console.log('🔵 AuthInterceptor - Request URL:', req.url);
    console.log('🔵 AuthInterceptor - Token from service:', !!tokenFromService);
    console.log('🔵 AuthInterceptor - Token from storage:', !!tokenFromStorage);
    console.log('🔵 AuthInterceptor - Token to use:', !!token);
    if (token) {
      console.log('🔵 AuthInterceptor - Token length:', token.length);
      console.log('🔵 AuthInterceptor - Token preview:', token.substring(0, 30) + '...');
    } else {
      console.error('❌ AuthInterceptor - NO TOKEN FOUND!');
      console.error('❌ AuthInterceptor - localStorage.getItem("token"):', localStorage.getItem('token'));
      console.error('❌ AuthInterceptor - authService.getToken():', tokenFromService);
    }
  }
  
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (req.url.includes('/api/admin') || req.url.includes('/api/auth')) {
      console.log('✅ AuthInterceptor - Authorization header added');
      console.log('✅ AuthInterceptor - Header value:', `Bearer ${token.substring(0, 30)}...`);
      console.log('✅ AuthInterceptor - All headers:', Array.from(clonedRequest.headers.keys()));
    }
    
    return next(clonedRequest);
  }
  
  // Si pas de token, continuer sans modification mais logger l'erreur
  if (req.url.includes('/api/admin') || req.url.includes('/api/auth')) {
    console.error('❌ AuthInterceptor - Request sent WITHOUT Authorization header!');
    console.error('❌ AuthInterceptor - This will cause 401 Unauthorized error');
  }
  
  return next(req);
};
