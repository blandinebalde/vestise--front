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
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'catalogue', component: CatalogueComponent },
  { path: 'produit/:id', component: ProductDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'vendre', component: CreateAnnonceComponent, canActivate: [authGuard] },
  // Note: La route /contact n'a pas encore de composant, redirection vers home pour l'instant
  { path: 'contact', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
