import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  /** Liste des catégories actives (public) */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }
}
