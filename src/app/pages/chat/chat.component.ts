import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import {
  cloneConversation,
  ConversationService,
  ConversationDTO,
  MessageDTO,
  CONVERSATION_POLL_MS,
  samePublicId
} from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="chat-page">
      <div class="container">
        <a routerLink="/dashboard" class="back-link">← Retour</a>
        <div class="chat-header" *ngIf="conversation">
          <h1>💬 {{ conversation.annonceTitle }}</h1>
          <p class="chat-with">
            Avec {{ isSeller ? conversation.buyerName : conversation.sellerName }}
          </p>
        </div>
        
        <div class="chat-box" *ngIf="conversation">
          <div class="messages" #messagesContainer>
            <div
              *ngFor="let msg of conversation.messages; trackBy: trackMessage"
              class="message"
              [class.mine]="isMine(msg)"
            >
              <span class="message-sender">{{ msg.senderName }}</span>
              <p class="message-content">{{ msg.content }}</p>
              <span class="message-date">{{ msg.createdAt | date:'short' }}</span>
            </div>
          </div>
          <form class="send-form" (ngSubmit)="sendMessage()">
            <textarea [(ngModel)]="newMessage" name="newMessage" rows="2" 
                      placeholder="Écrivez votre message..." required></textarea>
            <button type="submit" class="btn btn-primary" [disabled]="!newMessage.trim() || sending">
              Envoyer
            </button>
          </form>
        </div>
        
        <div class="loading" *ngIf="!conversation && !error">
          <p>Chargement de la conversation...</p>
        </div>
        <div class="error" *ngIf="error">
          <p>{{ error }}</p>
          <a routerLink="/dashboard" class="btn btn-outline">Retour au tableau de bord</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-page { padding: 2rem 0; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: var(--primary-color); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .chat-header { margin-bottom: 1.5rem; }
    .chat-header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .chat-with { color: var(--text-light); font-size: 0.95rem; }
    .chat-box {
      background: var(--background-white);
      border-radius: 12px;
      box-shadow: var(--shadow);
      overflow: hidden;
      max-width: 700px;
    }
    .messages {
      padding: 1rem;
      max-height: 400px;
      overflow-y: auto;
    }
    .message {
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: var(--background-light);
      max-width: 85%;
    }
    .message.mine {
      margin-left: auto;
      background: var(--primary-light);
      color: var(--text-dark);
    }
    .message-sender { font-weight: 600; font-size: 0.9rem; display: block; margin-bottom: 0.25rem; }
    .message-content { margin: 0 0 0.25rem 0; white-space: pre-wrap; }
    .message-date { font-size: 0.8rem; color: var(--text-light); }
    .send-form {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .send-form textarea {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      resize: none;
    }
    .loading, .error { text-align: center; padding: 2rem; }
    .error p { color: var(--error-color); margin-bottom: 1rem; }
  `]
})
export class ChatComponent implements OnInit, OnDestroy {
  conversation: ConversationDTO | null = null;
  newMessage = '';
  sending = false;
  error = '';
  private pollSub?: Subscription;
  private conversationPublicId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conversationService: ConversationService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get isSeller(): boolean {
    const user = this.authService.getCurrentUser();
    return (
      !!user &&
      !!this.conversation &&
      samePublicId(user.publicId, this.conversation.sellerPublicId)
    );
  }

  trackMessage(_index: number, msg: MessageDTO): number {
    return msg.id;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.conversationPublicId = id;
      this.loadConversation(id);
    } else {
      this.error = 'Conversation introuvable.';
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadConversation(publicId: string) {
    this.conversationPublicId = publicId;
    this.conversationService.get(publicId).subscribe({
      next: (conv) => {
        this.applyConversation(conv, true);
        this.startPolling(publicId);
      },
      error: (err) => {
        this.error = err.error?.message || 'Impossible de charger la conversation.';
        this.cdr.markForCheck();
      }
    });
  }

  private applyConversation(conv: ConversationDTO, scroll: boolean): void {
    const prevLen = this.conversation?.messages?.length ?? 0;
    this.conversation = cloneConversation(conv);
    this.cdr.markForCheck();
    if (scroll || (conv.messages?.length ?? 0) > prevLen) {
      setTimeout(() => this.scrollMessages(), 30);
    }
  }

  private startPolling(publicId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = timer(0, CONVERSATION_POLL_MS).subscribe(() => {
      if (!this.conversationPublicId || this.sending) {
        return;
      }
      this.conversationService.get(publicId).subscribe({
        next: (conv) => this.applyConversation(conv, false),
        error: () => {}
      });
    });
  }

  private scrollMessages(): void {
    const el = document.querySelector('.chat-page .messages');
    if (el) {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    }
  }

  isMine(msg: MessageDTO): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && samePublicId(msg.senderPublicId, user.publicId);
  }

  sendMessage() {
    if (!this.conversation || !this.newMessage.trim()) return;
    this.sending = true;
    this.conversationService
      .sendMessage({
        conversationPublicId: String(this.conversation.publicId),
        content: this.newMessage.trim()
      })
      .subscribe({
        next: (msg) => {
          const msgs = this.conversation!.messages || [];
          if (!msgs.some((m) => m.id === msg.id)) {
            this.conversation = cloneConversation({
              ...this.conversation!,
              messages: [...msgs, msg]
            });
          }
          this.newMessage = '';
          this.sending = false;
          this.cdr.markForCheck();
          this.scrollMessages();
          this.conversationService.refreshUnreadCounts();
        },
        error: (err) => {
          this.sending = false;
          this.cdr.markForCheck();
          alert(err.error?.message || "Erreur lors de l'envoi.");
        }
      });
  }
}
