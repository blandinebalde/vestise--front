import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError, map, of, finalize, shareReplay } from 'rxjs';
import { Router } from '@angular/router';
import { API_URL } from '../config/api.config';

export interface User {
  /** Identifiant public (UUID). */
  publicId: string;
  /** Code unique de l'utilisateur (18 caractères). */
  code?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  whatsapp?: string;
  avatarPath?: string;
  role: 'ADMIN' | 'VENDEUR' | 'USER';
  creditBalance?: number;
  sellerPlan?: string;
  sellerPlanLabel?: string;
}

export interface AuthResponse {
  token: string;
  type?: string;
  /** Durée de vie du jeton (secondes), renvoyée par le serveur. */
  expiresInSeconds?: number;
  publicId: string;
  code?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  whatsapp?: string;
  avatarPath?: string;
  role: string;
  creditBalance?: number;
  sellerPlan?: string;
  sellerPlanLabel?: string;
}

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  whatsapp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = API_URL;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private sessionCheck$: Observable<boolean> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  /** Rafraîchir le solde de crédits (après achat ou au chargement du dashboard). N'émet que si le solde a changé pour éviter une boucle de rechargement. */
  refreshCreditBalance(balance: number): void {
    const user = this.currentUserSubject.value;
    if (!user) return;
    if (user.creditBalance === balance) return;
    const updated = { ...user, creditBalance: balance };
    localStorage.setItem('user', JSON.stringify(updated));
    this.currentUserSubject.next(updated);
  }

  /** Connexion par email ou téléphone */
  login(emailOrPhone: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { emailOrPhone, password })
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

  forgotPassword(emailOrPhone: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/forgot-password`, { emailOrPhone });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/reset-password`, { token, newPassword });
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post<void>(`${this.apiUrl}/auth/logout`, {}).pipe(
        catchError(() => of(null)),
        finalize(() => this.clearLocalSession())
      ).subscribe();
    } else {
      this.clearLocalSession();
    }
  }

  private clearLocalSession(): void {
    this.clearSessionOnly();
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /** Utilisateur connecté (synchrone). */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Vérifie auprès du serveur que le JWT est encore valide. */
  ensureValidSession(): Observable<boolean> {
    if (!this.getToken()) {
      return of(false);
    }
    if (!this.sessionCheck$) {
      this.sessionCheck$ = this.http.get<Record<string, unknown>>(`${this.apiUrl}/auth/me`).pipe(
        tap((data) => {
          const user = this.currentUserSubject.value;
          if (!user || !data) {
            return;
          }
          const updated: User = {
            ...user,
            email: String(data['email'] ?? user.email),
            firstName: String(data['firstName'] ?? user.firstName),
            lastName: String(data['lastName'] ?? user.lastName),
            role: (data['role'] ? String(data['role']) : user.role) as User['role'],
            creditBalance: data['creditBalance'] != null ? Number(data['creditBalance']) : user.creditBalance,
            sellerPlan: data['sellerPlan'] != null ? String(data['sellerPlan']) : user.sellerPlan,
            sellerPlanLabel: data['sellerPlanLabel'] != null ? String(data['sellerPlanLabel']) : user.sellerPlanLabel
          };
          localStorage.setItem('user', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }),
        map(() => true),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 401 || err.status === 403) {
            this.clearSessionOnly();
          }
          return of(false);
        }),
        finalize(() => {
          this.sessionCheck$ = null;
        }),
        shareReplay(1)
      );
    }
    return this.sessionCheck$;
  }

  /** Session expirée : déconnexion locale + redirection login. */
  handleUnauthorized(redirectUrl?: string): void {
    this.clearSessionOnly();
    const returnUrl = redirectUrl ?? this.router.url;
    if (!returnUrl.startsWith('/login')) {
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
    }
  }

  private clearSessionOnly(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.sessionCheck$ = null;
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
    const user = this.authResponseToUser(response);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private authResponseToUser(r: AuthResponse | Record<string, any>): User {
    const anyR = r as Record<string, any>;
    const publicId = anyR['publicId'] ?? anyR['id'];
    return {
      publicId: publicId != null ? String(publicId) : '',
      code: r.code,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      address: r.address,
      whatsapp: r.whatsapp,
      avatarPath: r.avatarPath,
      role: (r.role || 'USER') as 'ADMIN' | 'VENDEUR' | 'USER',
      creditBalance: r.creditBalance ?? 0,
      sellerPlan: r.sellerPlan,
      sellerPlanLabel: r.sellerPlanLabel
    };
  }

  /** Met à jour plan vendeur et solde en session (après abonnement). */
  patchSessionUser(partial: Pick<User, 'sellerPlan' | 'sellerPlanLabel' | 'creditBalance'>): void {
    const user = this.currentUserSubject.value;
    if (!user) {
      return;
    }
    const updated = { ...user, ...partial };
    localStorage.setItem('user', JSON.stringify(updated));
    this.currentUserSubject.next(updated);
  }

  /** Met à jour le profil (nom, prénom, téléphone, adresse, whatsapp). Retourne l'utilisateur mis à jour. */
  updateProfile(data: ProfileUpdateRequest): Observable<User> {
    return this.http.put<Record<string, any>>(`${this.apiUrl}/auth/profile`, data).pipe(
      map(response => this.authResponseToUser(response)),
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  /** Upload de la photo de profil. Retourne l'utilisateur mis à jour (avec avatarPath). */
  uploadProfilePhoto(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Record<string, any>>(`${this.apiUrl}/auth/profile/photo`, formData).pipe(
      map(response => this.authResponseToUser(response)),
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
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
