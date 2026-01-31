import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  whatsapp?: string;
  role: 'ADMIN' | 'VENDEUR' | 'USER';
  enabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  annoncesCount?: number;
  creditBalance?: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${API_URL}/admin`;

  constructor(private http: HttpClient) {}

  // ========== USERS CRUD ==========
  getUsers(page: number = 0, size: number = 20): Observable<PageResponse<User>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<User>>(`${this.apiUrl}/users`, { params });
  }

  getAllUsers(page: number = 0, size: number = 20): Observable<PageResponse<User>> {
    return this.getUsers(page, size);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  createUser(user: Partial<User> & { password: string }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${id}`);
  }

  // ========== CATEGORIES CRUD ==========
  getCategories(page: number = 0, size: number = 20): Observable<PageResponse<Category>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Category>>(`${this.apiUrl}/categories`, { params });
  }

  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/categories/${id}`);
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, category);
  }

  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, category);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`);
  }

  // ========== TARIFS CRUD ==========
  createTarif(tarif: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tarifs`, tarif);
  }

  deleteTarif(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tarifs/${id}`);
  }

  // ========== ANNONCES CRUD ==========
  createAnnonce(annonce: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/annonces`, annonce);
  }

  updateAnnonce(id: number, annonce: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/annonces/${id}`, annonce);
  }

  deleteAnnonce(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/annonces/${id}`);
  }

  // ========== CREDITS CONFIG (admin) ==========
  getCreditsConfig(): Observable<{ id: number; pricePerCreditFcfa: number }> {
    return this.http.get<{ id: number; pricePerCreditFcfa: number }>(`${this.apiUrl}/credits/config`);
  }

  updateCreditsConfig(pricePerCreditFcfa: number): Observable<{ id: number; pricePerCreditFcfa: number }> {
    return this.http.put<{ id: number; pricePerCreditFcfa: number }>(`${this.apiUrl}/credits/config`, { pricePerCreditFcfa });
  }
}
