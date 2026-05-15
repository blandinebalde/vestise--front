import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService, User, ProfileUpdateRequest } from '../../services/auth.service';
import { imageUrlFor } from '../../config/api.config';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  currentUser: User | null = null;
  error = '';
  success = '';
  loading = false;
  photoLoading = false;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  readonly imageUrlFor = imageUrlFor;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.profileForm = this.fb.group({
      firstName: [this.currentUser?.firstName ?? '', [Validators.required]],
      lastName: [this.currentUser?.lastName ?? '', [Validators.required]],
      phone: [this.currentUser?.phone ?? ''],
      address: [this.currentUser?.address ?? ''],
      whatsapp: [this.currentUser?.whatsapp ?? '']
    });
  }

  get avatarUrl(): string {
    if (this.previewUrl) return this.previewUrl;
    if (this.currentUser?.avatarPath) return imageUrlFor(this.currentUser.avatarPath) ?? '';
    return '';
  }

  get avatarInitials(): string {
    const u = this.currentUser;
    if (!u) return '?';
    const f = (u.firstName || '').charAt(0).toUpperCase();
    const l = (u.lastName || '').charAt(0).toUpperCase();
    if (f || l) return f + l;
    return (u.email || '?').charAt(0).toUpperCase();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
      this.error = 'Choisissez une image JPG, PNG ou WebP (max 2 Mo).';
      input.value = '';
      return;
    }
    this.error = '';
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePhoto() {
    this.selectedFile = null;
    this.previewUrl = null;
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.error = '';
    this.success = '';
    this.loading = true;
    const data: ProfileUpdateRequest = {
      firstName: this.profileForm.get('firstName')?.value?.trim(),
      lastName: this.profileForm.get('lastName')?.value?.trim(),
      phone: this.profileForm.get('phone')?.value?.trim() || undefined,
      address: this.profileForm.get('address')?.value?.trim() || undefined,
      whatsapp: this.profileForm.get('whatsapp')?.value?.trim() || undefined
    };
    this.authService.updateProfile(data).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.loading = false;
        this.success = 'Profil enregistré.';
        if (this.selectedFile) this.uploadPhoto();
      },
      error: (err) => {
        this.loading = false;
        this.error = this.authService.getErrorMessage(err);
      }
    });
  }

  uploadPhoto() {
    if (!this.selectedFile) return;
    this.photoLoading = true;
    this.error = '';
    this.authService.uploadProfilePhoto(this.selectedFile).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.selectedFile = null;
        this.previewUrl = null;
        this.photoLoading = false;
        this.success = 'Profil et photo enregistrés.';
      },
      error: (err) => {
        this.photoLoading = false;
        this.error = this.authService.getErrorMessage(err);
      }
    });
  }

  onSubmit() {
    this.saveProfile();
  }
}
