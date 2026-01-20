import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'VENDEUR' | 'USER';
}

export interface AuthResponse {
  token: string;
  type: string;
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap(response => {
          this.setUser(response);
        }),
        catchError((error: HttpErrorResponse) => {
          // Améliorer la gestion des erreurs pour les erreurs réseau
          if (error.status === 0 || !error.status) {
            return throwError(() => ({
              status: 0,
              message: 'ERR_CONNECTION_REFUSED',
              error: { message: 'Impossible de se connecter au serveur. Vérifiez que le serveur est démarré.' }
            }));
          }
          return throwError(() => error);
        })
      );
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, data);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/auth/verify-email`, { 
      params: { token }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        // Extraire le message d'erreur de manière cohérente
        let errorMessage = 'Erreur lors de la vérification de l\'email';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return throwError(() => ({ error: { message: errorMessage } }));
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/reset-password`, { token, newPassword });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'ADMIN';
  }

  isVendeur(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'VENDEUR' || user?.role === 'ADMIN';
  }

  private setUser(response: AuthResponse): void {
    const user: User = {
      id: response.id,
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      role: response.role as 'ADMIN' | 'VENDEUR' | 'USER'
    };
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUserSubject.next(JSON.parse(userStr));
    }
  }

  getErrorMessage(error: any): string {
    if (!error) {
      return 'Une erreur inattendue s\'est produite';
    }

    // Si c'est une HttpErrorResponse
    if (error.error) {
      // Si error.error est une chaîne
      if (typeof error.error === 'string') {
        return error.error;
      }
      // Si error.error a une propriété message
      if (error.error.message) {
        return error.error.message;
      }
      // Si error.error a une propriété error
      if (error.error.error) {
        return typeof error.error.error === 'string' ? error.error.error : error.error.error.message || 'Erreur inconnue';
      }
    }

    // Si c'est un objet avec une propriété message
    if (error.message) {
      return error.message;
    }

    // Si c'est directement une chaîne
    if (typeof error === 'string') {
      return error;
    }

    // Par défaut
    return 'Erreur lors de l\'opération. Veuillez réessayer.';
  }
}
