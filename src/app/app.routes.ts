import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { CatalogueComponent } from './pages/catalogue/catalogue.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { ForgotPasswordComponent } from './pages/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/auth/reset-password/reset-password.component';
import { VerifyEmailComponent } from './pages/auth/verify-email/verify-email.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/admin/admin-dashboard/admin-dashboard.component';
import { CreateAnnonceComponent } from './pages/create-annonce/create-annonce.component';
import { ModifierAnnonceComponent } from './pages/modifier-annonce/modifier-annonce.component';
import { SellerMonetizationComponent } from './pages/seller-monetization/seller-monetization.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ChatComponent } from './pages/chat/chat.component';
import { SellerMessagesComponent } from './pages/seller-messages/seller-messages.component';
import { SellerAnnoncesComponent } from './pages/seller-annonces/seller-annonces.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { vendeurGuard } from './guards/vendeur.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'catalogue', component: CatalogueComponent },
  { path: 'produit/:id', component: ProductDetailComponent },
  { path: 'chat/:id', component: ChatComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'vendre', component: CreateAnnonceComponent, canActivate: [vendeurGuard] },
  { path: 'modifier-annonce/:publicId', component: ModifierAnnonceComponent, canActivate: [vendeurGuard] },
  {
    path: 'vendeur/messages',
    component: SellerMessagesComponent,
    canActivate: [vendeurGuard],
    data: { perspective: 'seller' }
  },
  {
    path: 'vendeur/annonces',
    component: SellerAnnoncesComponent,
    canActivate: [vendeurGuard]
  },
  {
    path: 'mes-messages',
    component: SellerMessagesComponent,
    canActivate: [authGuard],
    data: { perspective: 'buyer' }
  },
  { path: 'monetisation', component: SellerMonetizationComponent, canActivate: [vendeurGuard] },
  { path: 'credits', component: SellerMonetizationComponent, canActivate: [vendeurGuard], data: { tab: 'credits' } },
  { path: 'abonnement', component: SellerMonetizationComponent, canActivate: [vendeurGuard], data: { tab: 'abonnement' } },
  // Note: La route /contact n'a pas encore de composant, redirection vers home pour l'instant
  { path: 'contact', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
