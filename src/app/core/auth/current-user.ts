import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

export interface CurrentUser {
  name: string;
  email: string;
  initials: string;
}

const NAME_CLAIMS = [
  'name',
  'unique_name',
  'given_name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
];
const EMAIL_CLAIMS = ['email', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];

/** Access token ke claims se naam/email. Token badalta hai (refresh), is liye har dafa taaza padhta hai. */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
    get(): CurrentUser {
    const claims = this.claims();
    const email = this.first(claims, EMAIL_CLAIMS) ?? '';
    const rawName = this.first(claims, NAME_CLAIMS) ?? email;

    // Kuch tokens mein name claim hi email hota hai: "admin@hr-cloud.online" → "Admin"
    const base = rawName.includes('@') ? rawName.split('@')[0] : rawName;
    const name = base
      ? base.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'User';

    return { name, email: email || (rawName.includes('@') ? rawName : ''), initials: this.initials(name) };
  }

  private claims(): Record<string, unknown> {
    try {
      const token = localStorage.getItem('accessToken');
      return token ? jwtDecode<Record<string, unknown>>(token) : {};
    } catch {
      return {};
    }
  }

  private first(claims: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = claims[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private initials(name: string): string {
    const parts = name.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
    return letters.toUpperCase();
  }
}
