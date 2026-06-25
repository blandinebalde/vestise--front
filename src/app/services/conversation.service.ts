import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { API_URL } from '../config/api.config';
import { AuthService } from './auth.service';

export const CONVERSATION_POLL_MS = 3000;

export interface MessageDTO {
  id: number;
  conversationPublicId: string;
  senderPublicId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
}

export interface ConversationDTO {
  publicId: string;
  annoncePublicId: string;
  annonceTitle: string;
  buyerPublicId: string;
  buyerName: string;
  sellerPublicId: string;
  sellerName: string;
  createdAt: string;
  messages: MessageDTO[];
}

export interface MessageCreateRequest {
  conversationPublicId: string;
  content: string;
}

export function normalizePublicId(id: string | undefined | null): string {
  return id == null ? '' : String(id).toLowerCase();
}

export function samePublicId(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  const na = normalizePublicId(a);
  const nb = normalizePublicId(b);
  return na.length > 0 && na === nb;
}

export function isMessageUnread(m: MessageDTO, myPublicId: string | undefined): boolean {
  if (samePublicId(m.senderPublicId, myPublicId)) {
    return false;
  }
  return m.readAt == null || m.readAt === '';
}

/** Copie pour forcer la détection de changements Angular. */
export function cloneConversation(c: ConversationDTO): ConversationDTO {
  return {
    ...c,
    messages: [...(c.messages ?? [])]
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private apiUrl = API_URL;
  private readonly unreadTotalSubject = new BehaviorSubject(0);
  readonly unreadTotal$ = this.unreadTotalSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  static countUnread(conversations: ConversationDTO[], myPublicId: string | undefined): number {
    if (!myPublicId) {
      return 0;
    }
    return (conversations ?? []).reduce((sum, conv) => {
      const n = (conv.messages ?? []).filter((m) => isMessageUnread(m, myPublicId)).length;
      return sum + n;
    }, 0);
  }

  refreshUnreadCounts(): void {
    if (!this.authService.isAuthenticated()) {
      this.unreadTotalSubject.next(0);
      return;
    }
    this.listMine().subscribe({
      next: (list) => {
        const me = this.authService.getCurrentUser()?.publicId;
        this.unreadTotalSubject.next(ConversationService.countUnread(list ?? [], me));
      },
      error: () => this.unreadTotalSubject.next(0)
    });
  }

  getOrCreate(annoncePublicId: string): Observable<ConversationDTO> {
    return this.http.post<ConversationDTO>(
      `${this.apiUrl}/conversations/annonce/${annoncePublicId}`,
      {}
    );
  }

  listMine(): Observable<ConversationDTO[]> {
    return this.http.get<ConversationDTO[]>(`${this.apiUrl}/conversations`);
  }

  /** Charge le fil et marque les messages entrants comme lus (serveur). */
  get(publicId: string): Observable<ConversationDTO> {
    return this.http.get<ConversationDTO>(`${this.apiUrl}/conversations/${publicId}`).pipe(
      tap(() => this.refreshUnreadCounts())
    );
  }

  markAsRead(publicId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/conversations/${publicId}/read`, {}).pipe(
      tap(() => this.refreshUnreadCounts())
    );
  }

  sendMessage(request: MessageCreateRequest): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.apiUrl}/conversations/messages`, request);
  }
}
